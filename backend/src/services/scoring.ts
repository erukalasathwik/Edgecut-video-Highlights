import type {
  TranscriptResult,
  TranscriptWord,
  Window,
  HighlightSegment,
} from "../types.js";
import { getRmsLevelDb, normalizeDb } from "./audioEnergy.js";

const STOPWORDS = new Set(
  `a an the and or but if of to in on for with is are was were be been being
   this that these those it its i you he she they we our your their as at
   by from not no yes do does did have has had will would can could should
   so just very really like get got going go into up down out over under
   about than then there here what when where who why how`
    .split(/\s+/)
    .filter(Boolean)
);

/** Splits transcript words into overlapping sliding-window candidates. */
export function buildWindows(
  words: TranscriptWord[],
  durationSeconds: number,
  windowSeconds = 25,
  stepSeconds = 10
): Window[] {
  const windows: Window[] = [];
  for (let start = 0; start < durationSeconds; start += stepSeconds) {
    const end = Math.min(start + windowSeconds, durationSeconds);
    const windowWords = words.filter(
      (w) => w.start / 1000 >= start && w.end / 1000 <= end
    );
    if (windowWords.length === 0) continue;
    windows.push({
      start,
      end,
      words: windowWords,
      text: windowWords.map((w) => w.text).join(" "),
    });
    if (end >= durationSeconds) break;
  }
  return windows;
}

/** Builds a global word-frequency map (used for the keyword-density signal). */
function buildFrequencyMap(words: TranscriptWord[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const w of words) {
    const token = w.text.toLowerCase().replace(/[^a-z0-9']/g, "");
    if (!token || STOPWORDS.has(token) || token.length < 3) continue;
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

/** Keyword density: how concentrated this window's "core" vocabulary is. */
function keywordDensityScore(window: Window, freq: Map<string, number>): number {
  if (window.words.length === 0) return 0;
  let hits = 0;
  for (const w of window.words) {
    const token = w.text.toLowerCase().replace(/[^a-z0-9']/g, "");
    const count = freq.get(token) || 0;
    if (count >= 3) hits += 1; // word that recurs across the video = "core topic"
  }
  return Math.min(1, hits / window.words.length / 0.35);
}

/** Sentiment signal: fraction of the window covered by strong POSITIVE/NEGATIVE spans. */
function sentimentScore(
  window: Window,
  sentiments: TranscriptResult["sentiments"]
): number {
  const overlapping = sentiments.filter(
    (s) => s.start / 1000 < window.end && s.end / 1000 > window.start
  );
  if (overlapping.length === 0) return 0;
  const strong = overlapping.filter(
    (s) => s.sentiment !== "NEUTRAL" && s.confidence >= 0.6
  );
  return Math.min(1, strong.length / overlapping.length);
}

/** Speaking pace signal: words-per-second, normalized against a typical range. */
function speakingPaceScore(window: Window): number {
  const durationSec = window.end - window.start;
  if (durationSec <= 0) return 0;
  const wps = window.words.length / durationSec;
  // ~1.5 wps is average conversational pace, ~3.5+ wps is rapid/excited speech
  return Math.max(0, Math.min(1, (wps - 1.5) / 2.0));
}

/** Position bias: openings and closings of long-form content tend to be strong. */
function positionBiasScore(window: Window, totalDuration: number): number {
  if (window.start <= 60) return 1 - window.start / 60;
  if (totalDuration - window.end <= 30) return 1 - (totalDuration - window.end) / 30;
  return 0;
}

const WEIGHTS = {
  audioEnergy: 0.3,
  keywordDensity: 0.25,
  sentiment: 0.2,
  speakingPace: 0.15,
  positionBias: 0.1,
};

export async function scoreWindows(
  windows: Window[],
  transcript: TranscriptResult,
  audioPath: string,
  onProgress?: (pct: number) => void
): Promise<HighlightSegment[]> {
  const freq = buildFrequencyMap(transcript.words);
  const scored: HighlightSegment[] = [];

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    const rmsDb = await getRmsLevelDb(audioPath, w.start, w.end - w.start);
    const audioEnergy = normalizeDb(rmsDb);
    const keywordDensity = keywordDensityScore(w, freq);
    const sentiment = sentimentScore(w, transcript.sentiments);
    const speakingPace = speakingPaceScore(w);
    const positionBias = positionBiasScore(w, transcript.durationSeconds);

    const score =
      audioEnergy * WEIGHTS.audioEnergy +
      keywordDensity * WEIGHTS.keywordDensity +
      sentiment * WEIGHTS.sentiment +
      speakingPace * WEIGHTS.speakingPace +
      positionBias * WEIGHTS.positionBias;

    scored.push({
      start: Number(w.start.toFixed(1)),
      end: Number(w.end.toFixed(1)),
      score: Number(score.toFixed(3)),
      reason: localReason({ audioEnergy, keywordDensity, sentiment, speakingPace, positionBias }),
      transcript: w.text,
      signals: { audioEnergy, keywordDensity, sentiment, speakingPace, positionBias },
    });

    onProgress?.(65 + Math.round(((i + 1) / windows.length) * 25));
  }

  return scored;
}

/** Generates a short human-readable reason from the dominant signal(s), no LLM required. */
function localReason(signals: HighlightSegment["signals"]): string {
  const entries = Object.entries(signals) as [keyof typeof signals, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const labels: Record<keyof typeof signals, string> = {
    audioEnergy: "High audio energy",
    keywordDensity: "Keyword spike",
    sentiment: "Sentiment peak",
    speakingPace: "Fast, excited pacing",
    positionBias: "Strong opening/closing position",
  };
  const top = entries.filter(([, v]) => v > 0.25).slice(0, 2);
  if (top.length === 0) return "Balanced signal mix";
  return top.map(([k]) => labels[k]).join(" + ");
}

/**
 * Selects the top N highlights, enforcing non-overlap via greedy
 * non-max-suppression: take the highest scoring segment, discard any
 * remaining candidate that overlaps it, repeat.
 */
export function selectTopNonOverlapping(
  segments: HighlightSegment[],
  maxHighlights: number
): HighlightSegment[] {
  const sorted = [...segments].sort((a, b) => b.score - a.score);
  const chosen: HighlightSegment[] = [];

  for (const candidate of sorted) {
    if (chosen.length >= maxHighlights) break;
    const overlaps = chosen.some(
      (c) => candidate.start < c.end && candidate.end > c.start
    );
    if (!overlaps) chosen.push(candidate);
  }

  return chosen.sort((a, b) => a.start - b.start);
}
