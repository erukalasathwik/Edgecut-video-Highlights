import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname);

    const filename = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}${extension}`;

    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
  },

  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error("Only MP4, MOV and WebM videos are supported.")
      );
    }

    cb(null, true);
  },
});

router.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "No video file uploaded.",
    });
  }

  res.json({
    success: true,

    // IMPORTANT: return the actual filesystem path
    videoUrl: req.file.path,

    filename: req.file.filename,
    size: req.file.size,
    sizeMB: Number(
      (req.file.size / (1024 * 1024)).toFixed(2)
    ),
  });
});

export { router as uploadRouter };