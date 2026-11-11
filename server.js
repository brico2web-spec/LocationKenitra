require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const requiredEnvironment = ["CLOUDINARY_URL", "ADMIN_USERNAME", "ADMIN_PASSWORD"];
const missingEnvironment = requiredEnvironment.filter(name => !process.env[name]);
if (missingEnvironment.length) {
  throw new Error(`Missing required environment variables: ${missingEnvironment.join(", ")}`);
}

cloudinary.config();
const cloudinaryConfig = cloudinary.config();
if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  throw new Error("CLOUDINARY_URL must contain a valid Cloudinary cloud name, API key, and API secret.");
}

const app = express();
const port = Number(process.env.PORT) || 3000;
const siteConfigPath = path.resolve(process.env.SITE_CONFIG_PATH || path.join(__dirname, "data", "site-config.json"));
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const sessions = new Map();
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)
);
const loginAttempts = new Map();
const uploadAttempts = new Map();

app.disable("x-powered-by");
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (!origin) return next();
  let sameOrigin = false;
  try {
    const parsedOrigin = new URL(origin);
    sameOrigin = ["http:", "https:"].includes(parsedOrigin.protocol) && parsedOrigin.host === req.get("host");
  } catch (error) {
    sameOrigin = false;
  }
  if (!sameOrigin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: "This website is not allowed to use the upload service." });
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "2mb" }));

async function readSharedSiteConfig() {
  try {
    const saved = await fs.readFile(siteConfigPath, "utf8");
    const value = JSON.parse(saved);
    if (!value || typeof value !== "object" || !Array.isArray(value.cars)) {
      throw new Error("The shared site settings file has an invalid format.");
    }
    return value;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

let siteConfigWrite = Promise.resolve();

function saveSharedSiteConfig(config) {
  const write = siteConfigWrite.then(async () => {
    await fs.mkdir(path.dirname(siteConfigPath), { recursive: true });
    const temporaryPath = `${siteConfigPath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try {
      await fs.writeFile(temporaryPath, JSON.stringify(config), { encoding: "utf8", mode: 0o600 });
      await fs.rename(temporaryPath, siteConfigPath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true });
      throw error;
    }
  });
  siteConfigWrite = write.catch(() => {});
  return write;
}

app.get("/api/site", async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json({ config: await readSharedSiteConfig() });
  } catch (error) {
    next(error);
  }
});

app.put("/api/site", requireSession, async (req, res, next) => {
  const config = req.body;
  if (!config || typeof config !== "object" || Array.isArray(config) || !Array.isArray(config.cars)) {
    return res.status(400).json({ error: "The website settings must include a valid cars list." });
  }

  try {
    await saveSharedSiteConfig(config);
    res.setHeader("Cache-Control", "no-store");
    res.json({ saved: true });
  } catch (error) {
    next(error);
  }
});

function rateLimit(store, limit, windowMs, message) {
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const entry = store.get(key);
    if (!entry || entry.expiresAt <= now) {
      store.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }
    if (entry.count >= limit) {
      res.setHeader("Retry-After", String(Math.ceil((entry.expiresAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    entry.count += 1;
    next();
  };
}

function constantTimeEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function requireSession(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer ([A-Za-z0-9_-]+)$/);
  const token = match?.[1];
  const session = token && sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
  req.sessionToken = token;
  next();
}

app.post("/api/auth/login", rateLimit(loginAttempts, 10, 15 * 60 * 1000, "Too many sign-in attempts. Try again later."), (req, res) => {
  const { username, password } = req.body || {};
  const usernameMatches = constantTimeEqual(username || "", process.env.ADMIN_USERNAME);
  const passwordMatches = constantTimeEqual(password || "", process.env.ADMIN_PASSWORD);
  if (!usernameMatches || !passwordMatches) {
    return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { expiresAt: Date.now() + sessionLifetimeMs });
  res.json({ token, expiresIn: sessionLifetimeMs });
});

app.get("/api/auth/session", requireSession, (req, res) => {
  res.json({ authenticated: true });
});

app.post("/api/auth/logout", requireSession, (req, res) => {
  sessions.delete(req.sessionToken);
  res.sendStatus(204);
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return callback(new Error("Choose a JPEG, PNG, WebP, or GIF image."));
    }
    callback(null, true);
  }
});

app.post(
  "/api/upload",
  requireSession,
  rateLimit(uploadAttempts, 30, 60 * 60 * 1000, "Too many uploads. Try again later."),
  imageUpload.single("image"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Choose an image to upload." });

    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "kraylia/cars", resource_type: "image" },
          (error, uploadedImage) => error ? reject(error) : resolve(uploadedImage)
        );
        stream.end(req.file.buffer);
      });

      if (!result?.secure_url || !result.secure_url.startsWith("https://")) {
        throw new Error("Cloudinary did not return a secure image URL.");
      }
      res.json({ secure_url: result.secure_url });
    } catch (error) {
      console.error("Cloudinary image upload failed.", error);
      res.status(502).json({ error: "ما قدرناش نرفعو الصورة لـCloudinary. عاود المحاولة." });
    }
  }
);

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "The image must be no larger than 10 MB."
      : "Choose one image to upload.";
    return res.status(400).json({ error: message });
  }
  if (error) {
    console.error("Request failed.", error);
    return res.status(400).json({ error: error.message || "The request could not be completed." });
  }
  next();
});

app.get(["/", "/index.html", "/admin.html", "/site-data.js", "/api-config.js"], (req, res, next) => {
  const fileName = req.path === "/" ? "index.html" : req.path.slice(1);
  res.sendFile(path.join(__dirname, fileName), error => {
    if (error) next(error);
  });
});

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  for (const store of [loginAttempts, uploadAttempts]) {
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key);
    }
  }
}, 60 * 60 * 1000);
cleanupTimer.unref();

app.listen(port, () => {
  console.log(`Kraylia admin server listening on port ${port}.`);
});
