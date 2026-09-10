import type { LogEntry, Progress } from "./types";

/** XP at which a node is considered fully trained. Caps the growth curve. */
export const MAX_XP = 700;

export interface Tier {
  index: number;
  /** Minimum XP to reach this tier. */
  min: number;
  name: string;
  /** Base opacity of the orb. Dormant nodes recede into the background. */
  opacity: number;
  /** Glow spread in px. */
  glow: number;
  /** OKLCH lightness + chroma for the orb core. */
  lightness: number;
  chroma: number;
}

/**
 * Five visual states. The map should read at a glance: a dim scatter when you
 * start, a lit-up brain once you've put the work in.
 */
export const TIERS: Tier[] = [
  { index: 0, min: 0,   name: "Dormant",      opacity: 0.3,  glow: 0,  lightness: 0.55, chroma: 0.04 },
  { index: 1, min: 50,  name: "Firing",       opacity: 0.62, glow: 10, lightness: 0.66, chroma: 0.11 },
  { index: 2, min: 150, name: "Myelinated",   opacity: 0.8,  glow: 20, lightness: 0.72, chroma: 0.16 },
  { index: 3, min: 350, name: "Consolidated", opacity: 0.92, glow: 32, lightness: 0.78, chroma: 0.2  },
  { index: 4, min: 700, name: "Mastered",     opacity: 1,    glow: 46, lightness: 0.85, chroma: 0.24 },
];

export function tierForXp(xp: number): Tier {
  let tier = TIERS[0];
  for (const t of TIERS) if (xp >= t.min) tier = t;
  return tier;
}

/** The next tier up, or null when already Mastered. */
export function nextTier(xp: number): Tier | null {
  return TIERS.find((t) => t.min > xp) ?? null;
}

/** Progress through the current tier, 0-1. Feeds the panel's XP bar. */
export function tierProgress(xp: number): number {
  const current = tierForXp(xp);
  const next = nextTier(xp);
  if (!next) return 1;
  return (xp - current.min) / (next.min - current.min);
}

const BASE_RADIUS = 15;
const MAX_GROWTH = 27;

/**
 * Square-rooted so the first few logs produce visible growth while late ones
 * taper — early feedback matters more than late precision, and a linear curve
 * would blow the layout apart at high XP.
 */
export function radiusForXp(xp: number): number {
  const t = Math.min(xp, MAX_XP) / MAX_XP;
  return Math.round(BASE_RADIUS + MAX_GROWTH * Math.sqrt(t));
}

/** Diameter of the largest possible orb — used to size layout collision. */
export const MAX_DIAMETER = (BASE_RADIUS + MAX_GROWTH) * 2;

/** Sums logs into a nodeId -> xp map in one pass. */
export function xpByNode(logs: LogEntry[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const log of logs) {
    totals[log.nodeId] = (totals[log.nodeId] ?? 0) + log.xp;
  }
  return totals;
}

export function totalXp(progress: Progress): number {
  return progress.logs.reduce((sum, log) => sum + log.xp, 0);
}

/** Local (not UTC) day key, so "done today" matches the user's calendar. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Whether an exercise counts as satisfied right now. `session` exercises have
 * no window — they're done whenever you choose to do them.
 */
export function isSatisfied(
  logs: LogEntry[],
  exerciseId: string,
  cadence: "daily" | "weekly" | "session",
  now = new Date(),
): boolean {
  if (cadence === "session") return false;
  const windowMs = cadence === "daily" ? 864e5 : 7 * 864e5;
  if (cadence === "daily") {
    const today = dayKey(now);
    return logs.some(
      (l) => l.exerciseId === exerciseId && dayKey(new Date(l.at)) === today,
    );
  }
  const cutoff = now.getTime() - windowMs;
  return logs.some(
    (l) => l.exerciseId === exerciseId && new Date(l.at).getTime() >= cutoff,
  );
}
