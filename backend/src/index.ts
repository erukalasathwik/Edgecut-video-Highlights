import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";

import { highlightsRouter } from "./routes/highlights.js";
import { uploadRouter } from "./routes/upload.js";
import { exportRouter } from "./routes/export.js";

import "./db.js";

const app = express();

app.use(cors());

app.use(express.json({ limit: "10mb" }));

// Serve uploaded videos
app.use(
  "/uploads",
  express.static(
    path.join(process.cwd(), "uploads")
  )
);

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// API routes
app.use("/api", highlightsRouter);
app.use("/api", uploadRouter);
app.use("/api", exportRouter);

// Serve React frontend
const frontendPath = path.resolve(
  __dirname,
  "..",
  "frontend",
  "dist"
);

app.use(
  express.static(frontendPath)
);

// React SPA fallback
app.get("*", (req, res, next) => {
  if (
    req.path.startsWith("/api/") ||
    req.path.startsWith("/uploads/")
  ) {
    return next();
  }

  res.sendFile(
    path.join(
      frontendPath,
      "index.html"
    )
  );
});

// Error handler
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (
      err instanceof multer.MulterError
    ) {
      if (
        err.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(413).json({
          error:
            "Video is too large. Maximum allowed size is 500 MB.",
        });
      }
    }

    if (err) {
      return res.status(400).json({
        error:
          err.message ||
          "Upload failed.",
      });
    }

    next();
  }
);

const port =
  Number(process.env.PORT) || 8787;

app.listen(port, () => {
  console.log(
    `EdgeCut Highlights API listening on http://localhost:${port}`
  );
});