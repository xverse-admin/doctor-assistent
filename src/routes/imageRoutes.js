// src/routes/imageRoutes.js
const express = require("express");
const multer  = require("multer");
const { handleImageUpload, getReports } = require("../controllers/imageController");

const router = express.Router();

// Accept images AND PDFs, up to 20MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    if (ok) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}. Upload an image or PDF.`), false);
  },
});

// POST /upload-image  — multipart file OR JSON base64
router.post("/upload-image", upload.single("image"), handleImageUpload);

// GET /reports  (all or ?threadId=xxx)
router.get("/reports", getReports);

module.exports = router;
