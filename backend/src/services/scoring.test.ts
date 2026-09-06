import { describe, it, expect } from "vitest";
import { buildWindows, selectTopNonOverlapping } from "./scoring.js";
import type { HighlightSegment, TranscriptWord } from "../types.js";

function word(text: string, startSec: number, endSec: number): TranscriptWord {
  return { text, start: startSec * 1000, end: endSec * 1000, confidence: 0.9 };
}

function segment(start: number, end: number, score: number): HighlightSegment {
  return {
    start,
    end,
    score,
    reason: "test",
    transcript: "",
    signals: {
      audioEnergy: 0,
      keywordDensity: 0,
      sentiment: 0,
      speakingPace: 0,
      positionBias: 0,
    },
  };
}

describe("buildWindows", () => {
  it("creates sliding windows covering the full duration", () => {
    const words = Array.from({ length: 60 }, (_, i) => word(`w${i}`, i, i + 1));
    const windows = buildWindows(words, 60, 25, 10);
    expect(windows.length).toBeGreaterThan(0);
    expect(windows[0].start).toBe(0);
    expect(windows[windows.length - 1].end).toBeLessThanOrEqual(60);
  });

  it("returns no windows for empty transcripts", () => {
    expect(buildWindows([], 60)).toHaveLength(0);
  });
});

describe("selectTopNonOverlapping", () => {
  it("picks the highest scoring segments first", () => {
    const segments = [segment(0, 20, 0.5), segment(30, 50, 0.9), segment(60, 80, 0.7)];
    const top = selectTopNonOverlapping(segments, 2);
    expect(top.map((s) => s.start)).toEqual([30, 60]);
  });

  it("never returns overlapping segments", () => {
    const segments = [segment(0, 20, 0.9), segment(10, 30, 0.8), segment(40, 60, 0.6)];
    const top = selectTopNonOverlapping(segments, 3);
    for (let i = 0; i < top.length - 1; i++) {
      expect(top[i].end <= top[i + 1].start).toBe(true);
    }
  });

  it("respects the maxHighlights cap", () => {
    const segments = [segment(0, 10, 0.9), segment(20, 30, 0.8), segment(40, 50, 0.7)];
    const top = selectTopNonOverlapping(segments, 1);
    expect(top).toHaveLength(1);
    expect(top[0].start).toBe(0);
  });
});
