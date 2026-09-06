import type { HighlightSegment } from "../types.js";

/**
 * BONUS: Optionally passes the top-scored segments to an LLM to rewrite
 * the `reason` field as a punchier, human-readable string. Skipped
 * entirely (no-op) if OPENAI_API_KEY is not set — the locally-generated
 * signal-based reason string is used instead.
 */
export async function llmRerank(
  segments: HighlightSegment[]
): Promise<HighlightSegment[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return segments;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You write short (<12 word) punchy reasons a video clip is a highlight, given its transcript and signal scores. Respond ONLY with a JSON array of strings, one per input segment, in the same order. No prose, no markdown fences.",
          },
          {
            role: "user",
            content: JSON.stringify(
              segments.map((s) => ({
                transcript: s.transcript.slice(0, 300),
                signals: s.signals,
              }))
            ),
          },
        ],
        temperature: 0.4,
      }),
    });

    if (!res.ok) return segments;
    const data = (await res.json()) as any;
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const reasons = JSON.parse(cleaned) as string[];

    if (!Array.isArray(reasons) || reasons.length !== segments.length) {
      return segments;
    }

    return segments.map((s, i) => ({ ...s, reason: reasons[i] || s.reason }));
  } catch {
    // LLM re-rank is best-effort; fall back to local reasons on any failure
    return segments;
  }
}
