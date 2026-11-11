const crypto = require("node:crypto");
const { get, list, put } = require("@vercel/blob");

const configBlobPath = "kraylia/site-config.json";
const sessionLifetimeSeconds = 8 * 60 * 60;
const sessionAudience = "kraylia-admin";
const attempts = new Map();

function sendJson(res, status, value) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(value);
}

function allowOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;

  const forwardedHost = req.headers["x-forwarded-host"];
  const requestHost = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : String(forwardedHost || req.headers.host || "").split(",")[0].trim();
  let sameOrigin = false;
  try {
    const parsedOrigin = new URL(origin);
    sameOrigin = ["http:", "https:"].includes(parsedOrigin.protocol) && parsedOrigin.host === requestHost;
  } catch (error) {
    sameOrigin = false;
  }

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  if (!sameOrigin && !allowedOrigins.includes(origin)) return false;

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  return true;
}

function rejectMethod(req, res, allowedMethods) {
  if (allowOrigin(req, res)) {
    res.setHeader("Allow", allowedMethods.join(", "));
    sendJson(res, 405, { error: "Method not allowed." });
  } else {
    sendJson(res, 403, { error: "This website is not allowed to use the service." });
  }
}

function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return null;
    }
  }
  return null;
}

function rateLimit(req, res, key, limit, windowMs) {
  const now = Date.now();
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || "unknown";
  const storeKey = `${key}:${ip}`;
  const entry = attempts.get(storeKey);
  if (!entry || entry.expiresAt <= now) {
    attempts.set(storeKey, { count: 1, expiresAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    res.setHeader("Retry-After", String(Math.ceil((entry.expiresAt - now) / 1000)));
    sendJson(res, 429, { error: "طلبات كثيرة. عاود المحاولة من بعد." });
    return false;
  }
  entry.count += 1;
  return true;
}

function constantTimeEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function createSessionToken() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 bytes.");
  }
  const payload = Buffer.from(JSON.stringify({
    audience: sessionAudience,
    expiresAt: Math.floor(Date.now() / 1000) + sessionLifetimeSeconds
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function hasSession(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer ([A-Za-z0-9_.-]+)$/);
  if (!secret || Buffer.byteLength(secret) < 32 || !match) return false;

  const parts = match[1].split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const [payload, signature] = parts;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch (error) {
    return false;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.audience === sessionAudience
      && Number.isInteger(session.expiresAt)
      && session.expiresAt > Math.floor(Date.now() / 1000);
  } catch (error) {
    return false;
  }
}

function requireSession(req, res) {
  if (!hasSession(req)) {
    sendJson(res, 401, { error: "Your session has expired. Please sign in again." });
    return false;
  }
  return true;
}

function configuredBlobToken(res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    sendJson(res, 503, { error: "خاص تربط Vercel Blob بالمشروع وتضيف BLOB_READ_WRITE_TOKEN." });
    return false;
  }
  return true;
}

async function readSharedSiteConfig() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }
  const { blobs } = await list({ prefix: configBlobPath, limit: 10 });
  const configBlob = blobs.find(blob => blob.pathname === configBlobPath);
  if (!configBlob) return null;

  const blob = await get(configBlob.url, { access: "public", useCache: false });
  if (!blob) return null;
  const config = await new Response(blob.stream).json();
  if (!config || typeof config !== "object" || !Array.isArray(config.cars)) {
    throw new Error("The shared website settings have an invalid format.");
  }
  return config;
}

async function writeSharedSiteConfig(config) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  return put(configBlobPath, JSON.stringify(config), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json; charset=utf-8"
  });
}

module.exports = {
  allowOrigin,
  configuredBlobToken,
  constantTimeEqual,
  createSessionToken,
  hasSession,
  readJsonBody,
  readSharedSiteConfig,
  rateLimit,
  rejectMethod,
  requireSession,
  sendJson,
  sessionLifetimeSeconds,
  writeSharedSiteConfig
};
