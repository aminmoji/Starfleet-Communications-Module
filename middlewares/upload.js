const multer = require("multer");

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    if (!allowedImageTypes.has(file.mimetype)) {
      const error = new Error("Unsupported image type");
      error.code = "INVALID_FILE_TYPE";
      return callback(error);
    }

    return callback(null, true);
  },
});

module.exports = { upload };
