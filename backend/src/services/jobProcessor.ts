import { updateJobStatus, completeJob, failJob } from "../db.js";
import { downloadToTemp, extractAudio, getDurationSeconds, cleanupFiles } from "./media.js";
import { transcribeAudio } from "./transcribe.js";
import { buildWindows, scoreWindows, selectTopNonOverlapping } from "./scoring.js";
import { llmRerank } from "./llmRerank.js";
import type { CreateJobRequest } from "../types.js";

/**
 * Runs the full highlight-analysis pipeline for a job. Fire-and-forget:
 * the API route returns immediately after queueing; this function updates
 * job progress/status in SQLite as it works, which the GET endpoint reads.
 */
export async function processJob(jobId: string, req: CreateJobRequest) {
  const maxHighlights = req.maxHighlights ?? 5;
  const tempFiles: string[] = [];

  try {
    updateJobStatus(jobId, "processing", 5);
    const videoPath = await downloadToTemp(req.videoUrl);
    tempFiles.push(videoPath);

    updateJobStatus(jobId, "processing", 10);
    const audioPath = await extractAudio(videoPath);
    tempFiles.push(audioPath);

    const duration = await getDurationSeconds(videoPath);

    const transcript = await transcribeAudio(audioPath, (pct) =>
      updateJobStatus(jobId, "processing", pct)
    );

    const effectiveDuration = duration || transcript.durationSeconds;
    const windows = buildWindows(transcript.words, effectiveDuration);

    updateJobStatus(jobId, "processing", 65);
    const scored = await scoreWindows(windows, transcript, audioPath, (pct) =>
      updateJobStatus(jobId, "processing", pct)
    );

    let top = selectTopNonOverlapping(scored, maxHighlights);
    top = await llmRerank(top); // no-op if OPENAI_API_KEY unset

    completeJob(jobId, top);
  } catch (err: any) {
    failJob(jobId, err?.message || "Unknown error during highlight analysis");
  } finally {
    cleanupFiles(tempFiles);
  }
}
