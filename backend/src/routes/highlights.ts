import { Router } from "express";
import { nanoid } from "nanoid";
import { insertJob, getJob } from "../db.js";
import { processJob } from "../services/jobProcessor.js";
import type { CreateJobRequest } from "../types.js";

export const highlightsRouter = Router();

highlightsRouter.post("/highlights", (req, res) => {
  const body = req.body as CreateJobRequest;

  if (!body?.videoUrl || typeof body.videoUrl !== "string") {
    return res.status(400).json({ error: "videoUrl is required" });
  }

  const jobId = nanoid(10);
  insertJob(jobId, body.videoUrl);

  // Fire-and-forget async processing; client polls GET /highlights/:jobId
  processJob(jobId, body).catch(() => {
    /* errors are persisted to the job row inside processJob */
  });

  res.status(202).json({ jobId, status: "queued" });
});

highlightsRouter.get("/highlights/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (job.status === "completed") {
    return res.json({
      jobId: job.id,
      status: job.status,
      highlights: job.segments ? JSON.parse(job.segments) : [],
    });
  }

  if (job.status === "failed") {
    return res.json({ jobId: job.id, status: job.status, error: job.error });
  }

  res.json({ jobId: job.id, status: job.status, progress: job.progress });
});
