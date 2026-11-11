const {
  allowOrigin,
  configuredBlobToken,
  readJsonBody,
  readSharedSiteConfig,
  rejectMethod,
  requireSession,
  sendJson,
  writeSharedSiteConfig
} = require("../lib/vercel-api");

module.exports = async function handler(req, res) {
  if (!allowOrigin(req, res)) return sendJson(res, 403, { error: "This website is not allowed to use the service." });
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    if (!configuredBlobToken(res)) return;
    try {
      return sendJson(res, 200, { config: await readSharedSiteConfig() });
    } catch (error) {
      console.error("Unable to read shared site settings.", error);
      return sendJson(res, 500, { error: "تعذر تحميل بيانات الموقع المشتركة." });
    }
  }

  if (req.method !== "PUT") return rejectMethod(req, res, ["GET", "PUT", "OPTIONS"]);
  if (!requireSession(req, res)) return;
  if (!configuredBlobToken(res)) return;

  const config = readJsonBody(req);
  if (!config || typeof config !== "object" || Array.isArray(config) || !Array.isArray(config.cars)) {
    return sendJson(res, 400, { error: "بيانات إعدادات الموقع غير صالحة." });
  }

  try {
    await writeSharedSiteConfig(config);
    return sendJson(res, 200, { saved: true });
  } catch (error) {
    console.error("Unable to save shared site settings.", error);
    return sendJson(res, 500, { error: "تعذر حفظ إعدادات الموقع. تحقق من ربط Vercel Blob." });
  }
};
