const {
  allowOrigin,
  constantTimeEqual,
  createSessionToken,
  readJsonBody,
  rateLimit,
  rejectMethod,
  sendJson,
  sessionLifetimeSeconds
} = require("../../lib/vercel-api");

module.exports = function handler(req, res) {
  if (!allowOrigin(req, res)) return sendJson(res, 403, { error: "This website is not allowed to sign in." });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return rejectMethod(req, res, ["POST", "OPTIONS"]);
  if (!rateLimit(req, res, "login", 10, 15 * 60 * 1000)) return;

  const { username, password } = readJsonBody(req) || {};
  const usernameMatches = constantTimeEqual(username || "", process.env.ADMIN_USERNAME || "");
  const passwordMatches = constantTimeEqual(password || "", process.env.ADMIN_PASSWORD || "");
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !usernameMatches || !passwordMatches) {
    return sendJson(res, 401, { error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
  }

  try {
    const token = createSessionToken();
    return sendJson(res, 200, { token, expiresIn: sessionLifetimeSeconds * 1000 });
  } catch (error) {
    console.error("Admin sign-in is not configured.", error);
    return sendJson(res, 503, { error: "إعداد جلسة الدخول غير مكتمل على الخادم." });
  }
};
