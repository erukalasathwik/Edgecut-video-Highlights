export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface CreateJobRequest {
  videoUrl: string;
  maxHighlights?: number;
  targetDurationSeconds?: number;
}

export interface HighlightSegment {
  start: number; // seconds
  end: number; // seconds
  score: number; // 0-1
  reason: string;
  transcript: string;
  signals: {
    audioEnergy: number;
    keywordDensity: number;
    sentiment: number;
    speakingPace: number;
    positionBias: number;
  };
}

export interface JobRow {
  id: string;
  video_url: string;
  status: JobStatus;
  progress: number;
  segments: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptWord {
  text: string;
  start: number; // ms
  end: number; // ms
  confidence: number;
}

export interface SentimentResult {
  text: string;
  start: number; // ms
  end: number; // ms
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  confidence: number;
}

export interface TranscriptResult {
  words: TranscriptWord[];
  sentiments: SentimentResult[];
  durationSeconds: number;
  fullText: string;
}

export interface Window {
  start: number;
  end: number;
  words: TranscriptWord[];
  text: string;
}
