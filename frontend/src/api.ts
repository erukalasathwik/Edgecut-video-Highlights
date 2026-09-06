import type { JobStatusResponse, TimelineClip } from "./types";

export async function uploadVideo(
  file: File
): Promise<{ videoUrl: string; filename: string; size: number }> {
  const formData = new FormData();
  formData.append("video", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed (${res.status})`);
  }

  return res.json();
}

export async function createHighlightJob(
  videoUrl: string,
  maxHighlights: number,
  targetDurationSeconds: number
): Promise<{ jobId: string }> {
  const res = await fetch("/api/highlights", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      videoUrl,
      maxHighlights,
      targetDurationSeconds,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function getJobStatus(
  jobId: string
): Promise<JobStatusResponse> {
  const res = await fetch(`/api/highlights/${jobId}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch job status (${res.status})`);
  }

  return res.json();
}

export function pollJob(
  jobId: string,
  onUpdate: (status: JobStatusResponse) => void,
  intervalMs = 2000
): () => void {
  let cancelled = false;

  async function tick() {
    if (cancelled) return;

    try {
      const status = await getJobStatus(jobId);
      onUpdate(status);

      if (status.status === "completed" || status.status === "failed") {
        return;
      }
    } catch {
      // Retry on the next tick for transient network errors.
    }

    if (!cancelled) setTimeout(tick, intervalMs);
  }

  tick();
  return () => {
    cancelled = true;
  };
}

export async function exportClip(
  videoUrl: string,
  clip: Pick<TimelineClip, "start" | "end">
): Promise<{ videoUrl: string; filename: string }> {
  const res = await fetch("/api/export/clip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      videoUrl,
      start: clip.start,
      end: clip.end,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Clip export failed (${res.status})`);
  }

  return res.json();
}

export async function exportCombined(
  videoUrl: string,
  clips: Pick<TimelineClip, "start" | "end">[]
): Promise<{ videoUrl: string; filename: string }> {
  const res = await fetch("/api/export/combined", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      videoUrl,
      clips,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.error || `Combined export failed (${res.status})`
    );
  }

  return res.json();
}
