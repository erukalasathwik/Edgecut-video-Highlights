import fs from "node:fs";
import type { TranscriptResult, TranscriptWord, SentimentResult } from "../types.js";

const AAI_BASE = "https://api.assemblyai.com/v2";

function apiKey(): string {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    throw new Error(
      "ASSEMBLYAI_API_KEY is not set. Add it to backend/.env (see .env.example)."
    );
  }
  return key;
}

/** Uploads a local audio file to AssemblyAI and returns their internal upload URL. */
async function uploadAudio(audioPath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(audioPath);
  const res = await fetch(`${AAI_BASE}/upload`, {
    method: "POST",
    headers: { authorization: apiKey() },
    body: fileBuffer,
  });
  if (!res.ok) {
    throw new Error(`AssemblyAI upload failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { upload_url: string };
  return data.upload_url;
}

/**
 * Runs full transcription with word-level timestamps + sentiment analysis
 * using AssemblyAI's free-tier REST API, polling until completion.
 */
export async function transcribeAudio(
  audioPath: string,
  onProgress?: (pct: number) => void
): Promise<TranscriptResult> {
  onProgress?.(10);
  const uploadUrl = await uploadAudio(audioPath);
  onProgress?.(25);

  const createRes = await fetch(`${AAI_BASE}/transcript`, {
    method: "POST",
    headers: {
      authorization: apiKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: uploadUrl,
      sentiment_analysis: true,
      punctuate: true,
      format_text: true,
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `AssemblyAI transcript creation failed (${createRes.status}): ${await createRes.text()}`
    );
  }
  const { id: transcriptId } = (await createRes.json()) as { id: string };

  // Poll until completed/error
  let attempt = 0;
  while (true) {
    const pollRes = await fetch(`${AAI_BASE}/transcript/${transcriptId}`, {
      headers: { authorization: apiKey() },
    });
    const data = (await pollRes.json()) as any;

    if (data.status === "completed") {
      onProgress?.(65);
      const words: TranscriptWord[] = (data.words || []).map((w: any) => ({
        text: w.text,
        start: w.start, // ms
        end: w.end, // ms
        confidence: w.confidence,
      }));
      const sentiments: SentimentResult[] = (
        data.sentiment_analysis_results || []
      ).map((s: any) => ({
        text: s.text,
        start: s.start,
        end: s.end,
        sentiment: s.sentiment,
        confidence: s.confidence,
      }));
      const durationSeconds =
        words.length > 0 ? words[words.length - 1].end / 1000 : 0;

      return {
        words,
        sentiments,
        durationSeconds,
        fullText: data.text || "",
      };
    }

    if (data.status === "error") {
      throw new Error(`AssemblyAI transcription failed: ${data.error}`);
    }

    // still queued/processing
    attempt += 1;
    const progress = Math.min(60, 25 + attempt * 3);
    onProgress?.(progress);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
