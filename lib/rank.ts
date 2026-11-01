import type { Engine, Keyword } from "./types";
import { clamp, dayKey, randInt, rngFor } from "./rand";

export const ENGINES: { key: Engine; label: string; short: string; color: string; device: string }[] = [
  { key: "google", label: "Google · Desktop", short: "Google", color: "#4ADE80", device: "Desktop" },
  { key: "google_mobile", label: "Google · Mobile", short: "Mobile", color: "#38BDF8", device: "Mobile" },
  { key: "bing", label: "Bing · Desktop", short: "Bing", color: "#818CF8", device: "Desktop" },
  { key: "local", label: "Google Local Pack", short: "Local", color: "#FBBF24", device: "Mobile" },
];

export function isEngine(value: string | undefined): value is Engine {
  return !!value && ENGINES.some((e) => e.key === value);
}

/** Deterministic per-engine position, anchored to the keyword's Google desktop rank. */
export function positionForEngine(kw: Keyword, engine: Engine): number | null {
  if (engine === "google") return kw.position;
  const rng = rngFor("engine", kw.id, engine);
  if (engine === "local") {
    if (!kw.serpFeatures.includes("Local pack")) return null;
    if (rng() > 0.72) return null;
    return randInt(rng, 1, 9);
  }
  if (kw.position === null) return rng() > 0.35 ? randInt(rng, 60, 100) : null;
  if (engine === "google_mobile") return clamp(kw.position + randInt(rng, -1, 3), 1, 100);
  return clamp(kw.position + randInt(rng, 2, 9), 1, 100);
}

export type RankPoint = { date: string; position: number | null };

/** Smooth, deterministic 90-day rank history ending at the current position. */
export function rankHistory(kw: Keyword, engine: Engine, days = 90): RankPoint[] {
  const current = positionForEngine(kw, engine);
  if (current === null) {
    return Array.from({ length: days }, (_, i) => ({ date: dayKey(days - 1 - i), position: null }));
  }
  const rng = rngFor("history", kw.id, engine);
  const improving = (kw.prevPosition ?? current) - current;
  const trend = clamp(improving, -4, 4) * 0.18;
  // offsets[a] = how much worse the rank was `a` days ago (0 today)
  const offsets: number[] = new Array(days).fill(0);
  let walk = 0;
  for (let a = 1; a < days; a++) {
    walk = walk * 0.86 + (rng() - 0.5) * 3.1 + trend;
    if (rng() > 0.985) walk += (rng() - 0.5) * 9; // occasional SERP reshuffle
    offsets[a] = walk;
  }
  const points: RankPoint[] = [];
  for (let i = 0; i < days; i++) {
    const daysAgo = days - 1 - i;
    points.push({
      date: dayKey(daysAgo),
      position: clamp(Math.round(current + offsets[daysAgo]), 1, 100),
    });
  }
  // Anchor the final point exactly to the current position.
  points[points.length - 1] = { date: dayKey(0), position: current };
  return points;
}

export function positionDaysAgo(kw: Keyword, engine: Engine, daysAgo: number): number | null {
  const history = rankHistory(kw, engine, Math.max(daysAgo + 1, 2));
  return history[0].position;
}

/** Change in rank vs `days` ago (positive = improved / moved up). */
export function rankDelta(kw: Keyword, engine: Engine, days = 7): number {
  const history = rankHistory(kw, engine, days + 1);
  const past = history[0].position;
  const now = history[history.length - 1].position;
  if (now === null && past === null) return 0;
  if (now === null) return -100;
  if (past === null) return 100;
  return past - now;
}

const CTR_CURVE = [0.284, 0.152, 0.098, 0.071, 0.053, 0.041, 0.032, 0.026, 0.022, 0.019];

export function estimatedClicks(position: number | null, volume: number): number {
  if (position === null) return 0;
  const ctr = position <= 10 ? CTR_CURVE[position - 1] : position <= 20 ? 0.012 : position <= 50 ? 0.004 : 0.0006;
  return Math.round(volume * ctr);
}

export function visibilityFromKeywords(keywords: Keyword[]): number {
  if (!keywords.length) return 0;
  const totalVolume = keywords.reduce((s, k) => s + k.volume, 0) || 1;
  const weighted = keywords.reduce((s, k) => s + (k.position === null ? 0 : Math.max(0, 101 - k.position)) * k.volume, 0);
  return Math.round((weighted / (100 * totalVolume)) * 1000) / 10;
}
