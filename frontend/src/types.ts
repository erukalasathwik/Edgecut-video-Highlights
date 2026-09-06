export interface HighlightSignals {
  audioEnergy: number;
  keywordDensity: number;
  sentiment: number;
  speakingPace: number;
  positionBias: number;
}

export interface HighlightSegment {
  start: number;
  end: number;
  score: number;
  reason: string;
  transcript: string;
  signals?: HighlightSignals;
}

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  progress?: number;
  highlights?: HighlightSegment[];
  error?: string;
}

export interface TimelineClip extends HighlightSegment {
  id: string;
}
