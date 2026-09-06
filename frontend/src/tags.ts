import type { HighlightSegment, HighlightSignals } from "./types";

/**
 * Interest tags shown to the user (matches the "what kind of moments do you
 * want" filter). These are derived client-side from the backend's raw
 * signal scores — no separate classification model needed. A highlight can
 * match more than one tag; "All" always matches everything.
 */
export const INTEREST_TAGS = [
  "All",
  "Funny",
  "Emotional",
  "Exciting",
  "Surprise",
  "Shocking",
  "Informative",
  "Dramatic",
  "Key Insight",
] as const;

export type InterestTag = (typeof INTEREST_TAGS)[number];

/** Falls back to a neutral signal split when a highlight has no signals attached. */
const DEFAULT_SIGNALS: HighlightSignals = {
  audioEnergy: 0.3,
  keywordDensity: 0.3,
  sentiment: 0.3,
  speakingPace: 0.3,
  positionBias: 0,
};

export function deriveTags(h: HighlightSegment): InterestTag[] {
  const s = h.signals ?? DEFAULT_SIGNALS;
  const tags = new Set<InterestTag>();

  if (s.sentiment > 0.5 && s.speakingPace > 0.4) tags.add("Funny");
  if (s.sentiment > 0.4) tags.add("Emotional");
  if (s.audioEnergy > 0.55) tags.add("Exciting");
  if (s.audioEnergy > 0.6 && s.sentiment < 0.3) tags.add("Shocking");
  if (s.keywordDensity > 0.5) tags.add("Informative");
  if (s.speakingPace > 0.55) tags.add("Dramatic");
  if (s.positionBias > 0.5) tags.add("Key Insight");
  if (tags.size === 0) tags.add("Surprise");

  return Array.from(tags);
}
