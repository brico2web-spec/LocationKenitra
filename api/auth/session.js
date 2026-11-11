const { allowOrigin, rejectMethod, requireSession, sendJson } = require("../../lib/vercel-api");

module.exports = function handler(req, res) {
  if (!allowOrigin(req, res)) return sendJson(res, 403, { error: "This website is not allowed to use the service." });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return rejectMethod(req, res, ["GET", "OPTIONS"]);
  if (!requireSession(req, res)) return;
  return sendJson(res, 200, { authenticated: true });
};
