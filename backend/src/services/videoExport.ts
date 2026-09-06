import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { nanoid } from "nanoid";
import { downloadToTemp, cleanupFiles } from "./media.js";

const execFileAsync = promisify(execFile);
const EXEC_OPTIONS = { maxBuffer: 10 * 1024 * 1024 };

export interface ExportClipRange {
  start: number;
  end: number;
}

const uploadDir = path.join(process.cwd(), "uploads");
const exportDir = path.join(uploadDir, "exports");

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

function getFfmpegPath() {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

function validateRange(range: ExportClipRange) {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    throw new Error("Clip start and end must be valid numbers.");
  }

  if (range.start < 0 || range.end <= range.start) {
    throw new Error("Clip end must be greater than clip start.");
  }
}

async function createClipFile(
  sourcePath: string,
  range: ExportClipRange,
  outputPath: string
) {
  validateRange(range);

  const duration = range.end - range.start;
  const args = [
    "-y",
    "-ss",
    String(range.start),
    "-i",
    sourcePath,
    "-t",
    String(duration),
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  await execFileAsync(getFfmpegPath(), args, EXEC_OPTIONS);
}

export async function createIndividualClip(
  sourceUrl: string,
  range: ExportClipRange
) {
  if (!sourceUrl) {
    throw new Error("Video source is required.");
  }

  validateRange(range);

  const sourcePath = await downloadToTemp(sourceUrl);
  const outputPath = path.join(
    exportDir,
    `edgecut-highlight-${nanoid(8)}.mp4`
  );

  try {
    await createClipFile(sourcePath, range, outputPath);
  } finally {
    cleanupFiles([sourcePath]);
  }

  return outputPath;
}

export async function createCombinedVideo(
  sourceUrl: string,
  ranges: ExportClipRange[]
) {
  if (!sourceUrl) {
    throw new Error("Video source is required.");
  }

  if (!Array.isArray(ranges) || ranges.length === 0) {
    throw new Error("At least one timeline clip is required.");
  }

  ranges.forEach(validateRange);

  const sourcePath = await downloadToTemp(sourceUrl);
  const tempClipPaths: string[] = [];
  const listPath = path.join(
    os.tmpdir(),
    `edgecut-concat-${nanoid(8)}.txt`
  );
  const outputPath = path.join(
    exportDir,
    `edgecut-combined-${nanoid(8)}.mp4`
  );

  try {
    for (const range of ranges) {
      const clipPath = path.join(
        os.tmpdir(),
        `edgecut-part-${nanoid(8)}.mp4`
      );

      await createClipFile(sourcePath, range, clipPath);
      tempClipPaths.push(clipPath);
    }

    const concatLines = tempClipPaths.map((filePath) => {
      const safePath = filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
      return `file '${safePath}'`;
    });

    fs.writeFileSync(listPath, concatLines.join(os.EOL), "utf8");

    await execFileAsync(getFfmpegPath(), [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ], EXEC_OPTIONS);
  } finally {
    cleanupFiles([sourcePath, listPath, ...tempClipPaths]);
  }

  return outputPath;
}
