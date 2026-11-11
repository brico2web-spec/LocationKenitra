const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
const express = require("express");
const nodemailer = require("nodemailer");
const { DatabaseSync } = require("node:sqlite");

const scrypt = promisify(crypto.scrypt);
const app = express();
const root = __dirname;
const dataDirectory = path.join(root, "data");
fs.mkdirSync(dataDirectory, { recursive: true });
const database = new DatabaseSync(process.env.AUTH_DB_PATH || path.join(dataDirectory, "auth.sqlite"));
const sessionCookie = "kraylia_admin_session";
const sessionDurationMs = 8 * 60 * 60 * 1000;
const resetDurationMs = 15 * 60 * 1000;
const resetAttempts = new Map();
const loginAttempts = new Map();

database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS admin_user (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    recovery_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
`);

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(express.json({ limit: "12kb" }));

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(secret, salt, 64);
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

async function verifySecret(secret, encoded) {
  const [algorithm, saltValue, hashValue] = String(encoded).split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;
  const salt = Buffer.from(saltValue, "base64");
  const expected = Buffer.from(hashValue, "base64");
  const actual = await scrypt(secret, salt, expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(part => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([name]) => name));
}

function cleanupExpired() {
  const now = Date.now();
  database.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(now);
  database.prepare("DELETE FROM password_resets WHERE expires_at <= ?").run(now);
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie)[sessionCookie];
  if (!token || token.length > 200) return null;
  cleanupExpired();
  return database.prepare("SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > ?")
    .get(hashToken(token), Date.now()) || null;
}

function requirePageSession(req, res, next) {
  if (getSession(req)) return next();
  res.redirect(302, "/admin-login.html");
}

function requireApiSession(req, res, next) {
  if (getSession(req)) return next();
  res.status(401).json({ error: "سجّل الدخول للمتابعة." });
}

function limited(store, key, maximum, windowMs) {
  const now = Date.now();
  if (store.size > 10000) {
    for (const [entry, timestamps] of store) {
      if (!timestamps.some(timestamp => timestamp > now - windowMs)) store.delete(entry);
    }
  }
  const recent = (store.get(key) || []).filter(timestamp => timestamp > now - windowMs);
  if (recent.length >= maximum) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  return true;
}

function publicUrl(req) {
  const configured = process.env.PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return null;
  return `${req.protocol}://${req.get("host")}`;
}

function emailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(sessionDurationMs / 1000)}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

app.get("/admin.html", requirePageSession, (req, res) => {
  res.sendFile(path.join(root, "admin.html"));
});

app.get("/admin-login.html", (req, res) => {
  if (getSession(req)) return res.redirect(302, "/admin.html");
  res.sendFile(path.join(root, "admin-login.html"));
});

app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(root, "index.html")));
app.get("/site-data.js", (req, res) => {
  res.type("application/javascript").sendFile(path.join(root, "site-data.js"));
});

app.get("/api/auth/session", (req, res) => {
  res.json({ authenticated: Boolean(getSession(req)) });
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!limited(loginAttempts, ip, 10, 15 * 60 * 1000)) {
      return res.status(429).json({ error: "محاولات كثيرة. عاود من بعد 15 دقيقة." });
    }
    const admin = database.prepare("SELECT * FROM admin_user WHERE username = ? COLLATE NOCASE").get(username);
    const valid = admin ? await verifySecret(password, admin.password_hash) : await verifySecret(password, await hashSecret("invalid-login"));
    if (!valid || !admin) return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحين." });

    const token = crypto.randomBytes(32).toString("base64url");
    database.prepare("INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)")
      .run(hashToken(token), Date.now() + sessionDurationMs);
    setSessionCookie(res, token);
    res.json({ authenticated: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  const token = parseCookies(req.headers.cookie)[sessionCookie];
  if (token) database.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(hashToken(token));
  clearSessionCookie(res);
  res.json({ authenticated: false });
});

app.post("/api/auth/recovery", async (req, res, next) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!limited(resetAttempts, ip, 5, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "محاولات كثيرة. عاود بعد ساعة." });
    }
    const admin = database.prepare("SELECT * FROM admin_user WHERE username = ? COLLATE NOCASE")
      .get(String(req.body?.username || "").trim());
    const recoveryWord = String(req.body?.recoveryWord || "");
    if (!admin || !(await verifySecret(recoveryWord, admin.recovery_hash))) {
      return res.status(400).json({ error: "تعذر التحقق من المعلومات." });
    }
    const transport = emailTransport();
    const baseUrl = publicUrl(req);
    if (!transport || !baseUrl) {
      return res.status(503).json({ error: "خدمة البريد غير مهيأة؛ إعدادات SMTP وPUBLIC_URL مطلوبة." });
    }
    const token = crypto.randomBytes(32).toString("base64url");
    database.prepare("DELETE FROM password_resets").run();
    database.prepare("INSERT INTO password_resets (token_hash, expires_at) VALUES (?, ?)")
      .run(hashToken(token), Date.now() + resetDurationMs);
    const link = `${baseUrl}/admin-login.html?reset=${encodeURIComponent(token)}`;
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: admin.email,
        subject: "رابط تغيير كلمة مرور لوحة كراي ليا",
        text: `وصلك هذا الرابط بعد طلب تغيير كلمة مرور لوحة الإدارة:\n${link}\n\nالرابط صالح لمدة 15 دقيقة ويستخدم مرة واحدة. إذا لم تطلب التغيير فتجاهل هذه الرسالة.`
      });
    } catch (error) {
      database.prepare("DELETE FROM password_resets WHERE token_hash = ?").run(hashToken(token));
      console.error("Password reset email delivery failed.", error);
      return res.status(503).json({ error: "تعذر إرسال البريد. تحقق من إعدادات SMTP." });
    }
    res.json({ message: "إذا تطابقت المعلومات، غادي توصلك رسالة فيها رابط آمن لتغيير كلمة المرور." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/reset", async (req, res, next) => {
  try {
    const token = String(req.body?.token || "");
    const password = String(req.body?.password || "");
    const confirmation = String(req.body?.confirmation || "");
    if (password.length < 10 || password.length > 128) {
      return res.status(400).json({ error: "كلمة المرور خاصها تكون بين 10 و128 حرفاً." });
    }
    if (password !== confirmation) return res.status(400).json({ error: "كلمتا المرور غير متطابقتين." });
    cleanupExpired();
    const reset = database.prepare("SELECT token_hash FROM password_resets WHERE token_hash = ? AND expires_at > ?")
      .get(hashToken(token), Date.now());
    if (!reset) return res.status(400).json({ error: "رابط التغيير غير صالح أو انتهت صلاحيته." });
    const passwordHash = await hashSecret(password);
    database.prepare("UPDATE admin_user SET password_hash = ? WHERE id = 1").run(passwordHash);
    database.prepare("DELETE FROM password_resets").run();
    database.prepare("DELETE FROM admin_sessions").run();
    res.json({ message: "تغيرت كلمة المرور. تقدر دابا تسجل الدخول." });
  } catch (error) {
    next(error);
  }
});

app.use("/api/admin", requireApiSession);
app.use((req, res) => res.status(404).send("Not found"));

app.use((error, req, res, next) => {
  console.error("Unhandled server error.", error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "وقع خطأ غير متوقع. عاود المحاولة." });
});

async function setupAdmin() {
  if (database.prepare("SELECT id FROM admin_user WHERE id = 1").get()) {
    throw new Error("حساب الإدارة موجود مسبقاً. استعمل استرجاع كلمة المرور لتغييرها.");
  }
  if (!process.stdin.isTTY) throw new Error("شغّل setup-admin في Terminal تفاعلي.");

  const readline = require("node:readline/promises");
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const username = (await prompt.question("اسم المستخدم: ")).trim();
  const email = (await prompt.question("بريد استرجاع كلمة المرور: ")).trim();
  prompt.close();

  function readMaskedSecret(label) {
    return new Promise((resolve, reject) => {
      const input = process.stdin;
      if (!input.isTTY || !input.setRawMode) return reject(new Error("تعذر قراءة كلمة المرور بأمان من هذا الطرفية."));
      let value = "";
      process.stdout.write(label);
      input.setRawMode(true);
      input.resume();
      const onData = chunk => {
        for (const char of chunk.toString("utf8")) {
          if (char === "\u0003") {
            input.setRawMode(false);
            input.off("data", onData);
            process.stdout.write("\n");
            reject(new Error("تم إلغاء الإعداد."));
            return;
          }
          if (char === "\r" || char === "\n") {
            input.setRawMode(false);
            input.off("data", onData);
            process.stdout.write("\n");
            resolve(value);
            return;
          }
          if (char === "\u007f" || char === "\b") {
            if (value) {
              value = value.slice(0, -1);
              process.stdout.write("\b \b");
            }
          } else if (char >= " ") {
            value += char;
            process.stdout.write("*");
          }
        }
      };
      input.on("data", onData);
    });
  }

  if (!username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("أدخل اسم مستخدم وبريد استرجاع صحيحين.");
  }
  const password = await readMaskedSecret("كلمة المرور (10 أحرف على الأقل): ");
  const confirmation = await readMaskedSecret("أكد كلمة المرور: ");
  const recoveryWord = await readMaskedSecret("كلمة الاسترجاع: ");
  if (password.length < 10 || password.length > 128) throw new Error("كلمة المرور خاصها تكون بين 10 و128 حرفاً.");
  if (password !== confirmation) throw new Error("كلمتا المرور غير متطابقتين.");
  if (recoveryWord.length < 5 || recoveryWord.length > 128) throw new Error("كلمة الاسترجاع خاصها تكون بين 5 و128 حرفاً.");

  database.prepare("INSERT INTO admin_user (id, username, email, password_hash, recovery_hash) VALUES (1, ?, ?, ?, ?)")
    .run(username, email, await hashSecret(password), await hashSecret(recoveryWord));
  console.log("تجهز حساب الإدارة. كلمة المرور وكلمة الاسترجاع مخزنتان كقيم مشفرة.");
}

if (process.argv[2] === "setup-admin") {
  setupAdmin().then(() => database.close()).catch(error => {
    console.error(error.message);
    database.close();
    process.exitCode = 1;
  });
} else {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT غير صالح.");
  const host = process.env.HOST || "127.0.0.1";
  app.listen(port, host, () => console.log(`Kraylia server listening on http://${host}:${port}`));
}
