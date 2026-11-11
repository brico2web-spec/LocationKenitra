const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const {
  allowOrigin,
  hasSession,
  rateLimit,
  sendJson
} = require("../lib/vercel-api");

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return callback(new Error("اختار صورة بصيغة JPEG أو PNG أو WebP أو GIF."));
    }
    return callback(null, true);
  }
}).single("image");

module.exports = async function handler(req, res) {
  if (!allowOrigin(req, res)) return sendJson(res, 403, { error: "This website is not allowed to upload images." });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!hasSession(req)) return sendJson(res, 401, { error: "Your session has expired. Please sign in again." });
  if (!process.env.CLOUDINARY_URL) {
    return sendJson(res, 503, { error: "CLOUDINARY_URL is not configured on the server." });
  }
  if (!rateLimit(req, res, "upload", 30, 60 * 60 * 1000)) return;

  return uploadImage(req, res, async error => {
    if (error) {
      const status = error instanceof multer.MulterError ? 400 : 400;
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "حجم الصورة خاصو ما يفوتش 10 ميغابايت."
        : error.message || "تعذر قراءة الصورة.";
      return sendJson(res, status, { error: message });
    }
    if (!req.file) return sendJson(res, 400, { error: "اختار صورة باش ترفعها." });

    try {
      cloudinary.config();
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "kraylia/cars", resource_type: "image" },
          (uploadError, uploadedImage) => uploadError ? reject(uploadError) : resolve(uploadedImage)
        );
        stream.end(req.file.buffer);
      });

      if (!result?.secure_url || !result.secure_url.startsWith("https://")) {
        throw new Error("Cloudinary did not return a secure image URL.");
      }
      return sendJson(res, 200, { secure_url: result.secure_url });
    } catch (uploadError) {
      console.error("Cloudinary image upload failed.", uploadError);
      return sendJson(res, 502, { error: "ما قدرناش نرفعو الصورة لـCloudinary. تحقق من إعدادات الحساب." });
    }
  });
};

module.exports.config = {
  api: { bodyParser: false }
};
