import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Uses ffmpeg's `astats` filter to measure RMS loudness (in dB) for a
 * single time window of an audio file. This is our proxy for "audio
 * energy" — loud moments (applause, vocal emphasis, impact sounds)
 * produce higher RMS values than quiet talking-head speech.
 *
 * Returns RMS level in dB (typically -60 .. 0, where 0 is loudest).
 */
export async function getRmsLevelDb(
  audioPath: string,
  startSec: number,
  durationSec: number
): Promise<number> {
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const cmd = `${ffmpeg} -ss ${startSec} -t ${durationSec} -i "${audioPath}" -af astats=metadata=1:reset=1 -f null - 2>&1`;
  try {
    const { stdout, stderr } = await execAsync(cmd);
    const out = stdout + stderr;
    const matches = [...out.matchAll(/RMS level dB:\s*(-?\d+(\.\d+)?)/g)];
    if (matches.length === 0) return -60;
    const values = matches.map((m) => Number(m[1])).filter((v) => Number.isFinite(v));
    if (values.length === 0) return -60;
    return values.reduce((a, b) => a + b, 0) / values.length;
  } catch {
    return -60;
  }
}

/** Normalizes a dB value (roughly -60 to 0) into a 0-1 energy score. */
export function normalizeDb(db: number): number {
  const clamped = Math.max(-60, Math.min(0, db));
  return (clamped + 60) / 60;
}
