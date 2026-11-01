import type { GscQuery } from "./types";
import { dayKey, rngFor, round } from "./rand";

export type GscPoint = { date: string; clicks: number; impressions: number; ctr: number; position: number };

export function gscSeries(queries: GscQuery[], days = 28, seedKey = "gsc"): GscPoint[] {
  const totals = gscTotals(queries);
  const rng = rngFor("series", seedKey, days);
  const dailyClicks = totals.clicks / days;
  const dailyImpr = totals.impressions / days;
  const points: GscPoint[] = [];
  let clicks = dailyClicks;
  let impressions = dailyImpr;
  let position = totals.position;
  for (let i = 0; i < days; i++) {
    const daysAgo = days - 1 - i;
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    const weekday = d.getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.78 : 1;
    const trend = 1 + (days - daysAgo) * 0.0031;
    clicks = dailyClicks * weekend * trend * (0.9 + rng() * 0.2);
    impressions = dailyImpr * weekend * trend * (0.92 + rng() * 0.16);
    position = Math.max(1, totals.position - (days - daysAgo) * 0.006 + (rng() - 0.5) * 0.4);
    points.push({
      date: dayKey(daysAgo),
      clicks: Math.round(clicks),
      impressions: Math.round(impressions),
      ctr: impressions > 0 ? round((clicks / impressions) * 100, 2) : 0,
      position: round(position, 1),
    });
  }
  return points;
}

export function gscTotals(queries: GscQuery[]) {
  const clicks = queries.reduce((s, q) => s + q.clicks, 0);
  const impressions = queries.reduce((s, q) => s + q.impressions, 0);
  const weightedPos = queries.reduce((s, q) => s + q.position * q.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? round((clicks / impressions) * 100, 2) : 0,
    position: impressions ? round(weightedPos / impressions, 1) : 0,
  };
}

export function gscCompare(queries: GscQuery[]) {
  const now = gscTotals(queries);
  const rng = rngFor("gsccompare", queries.length);
  const prev = {
    clicks: Math.round(now.clicks * (0.86 + rng() * 0.08)),
    impressions: Math.round(now.impressions * (0.9 + rng() * 0.07)),
    ctr: round(now.ctr * (0.97 + rng() * 0.05), 2),
    position: round(now.position + 0.4 + rng() * 1.1, 1),
  };
  return {
    now,
    prev,
    delta: {
      clicks: pctChange(prev.clicks, now.clicks),
      impressions: pctChange(prev.impressions, now.impressions),
      ctr: pctChange(prev.ctr, now.ctr),
      position: round(prev.position - now.position, 1),
    },
  };
}

export function pctChange(prev: number, now: number): number {
  if (prev === 0) return now === 0 ? 0 : 100;
  return round(((now - prev) / prev) * 100, 1);
}
