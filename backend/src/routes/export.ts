import { Router } from "express";
import {
  createCombinedVideo,
  createIndividualClip,
  type ExportClipRange,
} from "../services/videoExport.js";

const router = Router();

function isValidRange(value: unknown): value is ExportClipRange {
  if (!value || typeof value !== "object") return false;

  const range = value as Record<string, unknown>;
  return (
    typeof range.start === "number" &&
    typeof range.end === "number" &&
    Number.isFinite(range.start) &&
    Number.isFinite(range.end) &&
    range.start >= 0 &&
    range.end > range.start
  );
}

router.post("/export/clip", async (req, res) => {
  try {
    const { videoUrl, start, end } = req.body ?? {};

    if (typeof videoUrl !== "string" || !videoUrl.trim()) {
      return res.status(400).json({ error: "videoUrl is required." });
    }

    const range = { start, end };

    if (!isValidRange(range)) {
      return res.status(400).json({
        error: "A valid clip start and end are required.",
      });
    }

    const outputPath = await createIndividualClip(videoUrl, range);
    const filename = outputPath.split(/[\\/]/).pop() || "edgecut-highlight.mp4";

    return res.json({
      success: true,
      videoUrl: `/uploads/exports/${filename}`,
      filename,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "Failed to export clip.",
    });
  }
});

router.post("/export/combined", async (req, res) => {
  try {
    const { videoUrl, clips } = req.body ?? {};

    if (typeof videoUrl !== "string" || !videoUrl.trim()) {
      return res.status(400).json({ error: "videoUrl is required." });
    }

    if (!Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({
        error: "At least one timeline clip is required.",
      });
    }

    if (!clips.every(isValidRange)) {
      return res.status(400).json({
        error: "Every timeline clip must have a valid start and end.",
      });
    }

    const outputPath = await createCombinedVideo(videoUrl, clips);
    const filename = outputPath.split(/[\\/]/).pop() || "edgecut-combined.mp4";

    return res.json({
      success: true,
      videoUrl: `/uploads/exports/${filename}`,
      filename,
      clipCount: clips.length,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "Failed to create combined video.",
    });
  }
});

export { router as exportRouter };
