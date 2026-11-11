const { allowOrigin, rejectMethod, requireSession, sendJson } = require("../../lib/vercel-api");

module.exports = function handler(req, res) {
  if (!allowOrigin(req, res)) return sendJson(res, 403, { error: "This website is not allowed to use the service." });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return rejectMethod(req, res, ["POST", "OPTIONS"]);
  if (!requireSession(req, res)) return;
  return res.status(204).end();
};
