import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

/**
 * Downloads a remote video/audio file (or copies a local path) to a temp
 * file so ffmpeg + AssemblyAI upload can work on raw bytes.
 */
function isYouTubeUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com";
  } catch {
    return false;
  }
}

function getYtDlpPath() {
  return process.env.YTDLP_PATH || "yt-dlp";
}

async function downloadYouTubeToTemp(sourceUrl: string) {
  const base = path.join(os.tmpdir(), `edgecut-youtube-${nanoid()}`);
  const outputTemplate = `${base}.%(ext)s`;

  try {
    await execFileAsync(getYtDlpPath(), [
      "--no-playlist",
      "--no-part",
      "-f",
      "bv*+ba/b",
      "--merge-output-format",
      "mp4",
      "-o",
      outputTemplate,
      sourceUrl,
    ], { maxBuffer: 20 * 1024 * 1024 });
  } catch (err: any) {
    const details = String(err?.stderr || err?.message || "").trim();
    throw new Error(
      `Could not download the YouTube video. Make sure yt-dlp is installed and the video is publicly accessible.${details ? ` ${details}` : ""}`
    );
  }

  const directory = path.dirname(base);
  const prefix = path.basename(base);
  const files = fs.readdirSync(directory);
  const match = files.find((name) => name.startsWith(`${prefix}.`) && !name.endsWith(".part"));

  if (!match) {
    throw new Error("YouTube download completed but no video file was created.");
  }

  return path.join(directory, match);
}

export async function downloadToTemp(sourceUrl: string): Promise<string> {
  if (!sourceUrl) {
    throw new Error("Video source URL is required.");
  }

  if (isYouTubeUrl(sourceUrl)) {
    return downloadYouTubeToTemp(sourceUrl);
  }

  const ext = path.extname(new URL(sourceUrl, "http://placeholder").pathname) || ".mp4";
  const tmpFile = path.join(os.tmpdir(), `edgecut-${nanoid()}${ext}`);

  if (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://")) {
    const res = await fetch(sourceUrl);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download video (HTTP ${res.status})`);
    }
    const fileStream = fs.createWriteStream(tmpFile);
    await pipeline(res.body, fileStream);
  } else {
    fs.copyFileSync(sourceUrl, tmpFile);
  }

  return tmpFile;
}

/** Extracts mono 16kHz WAV audio from a video/audio file using ffmpeg. */
export async function extractAudio(inputPath: string): Promise<string> {
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const outPath = inputPath.replace(path.extname(inputPath), "") + ".wav";
  await execAsync(
    `${ffmpeg} -y -i "${inputPath}" -ar 16000 -ac 1 -vn "${outPath}"`
  );
  return outPath;
}

/** Returns duration of a media file in seconds via ffprobe-style ffmpeg output. */
export async function getDurationSeconds(filePath: string): Promise<number> {
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  try {
    const { stderr } = await execAsync(`${ffmpeg} -i "${filePath}"`);
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (!match) return 0;
    const [, h, m, s] = match;
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  } catch (err: any) {
    // ffmpeg with no output file exits non-zero but still prints Duration to stderr
    const stderr: string = err.stderr || "";
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (match) {
      const [, h, m, s] = match;
      return Number(h) * 3600 + Number(m) * 60 + Number(s);
    }
    return 0;
  }
}

export function cleanupFiles(paths: string[]) {
  for (const p of paths) {
    fs.rm(p, { force: true }, () => {});
  }
}
