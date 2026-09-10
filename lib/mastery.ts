import type { Cadence, Exercise, LogEntry, Progress } from "./types";

/** XP at which a node is considered fully trained. Caps the growth curve. */
export const MAX_XP = 700;
export const DECAY_GRACE_DAYS = 14;
export const DECAY_HALF_LIFE_DAYS = 120;
export const DECAY_FLOOR_XP = 50;
export const SESSION_RESET_HOURS = 4;

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
 * Five visual states. Dormant nodes remain legible enough to navigate while
 * trained nodes progressively become the visual hierarchy of the map.
 */
export const TIERS: Tier[] = [
  { index: 0, min: 0, name: "Dormant", opacity: 0.42, glow: 0, lightness: 0.58, chroma: 0.055 },
  { index: 1, min: 50, name: "Firing", opacity: 0.68, glow: 11, lightness: 0.68, chroma: 0.12 },
  { index: 2, min: 150, name: "Myelinated", opacity: 0.84, glow: 21, lightness: 0.74, chroma: 0.17 },
  { index: 3, min: 350, name: "Consolidated", opacity: 0.94, glow: 33, lightness: 0.8, chroma: 0.2 },
  { index: 4, min: 700, name: "Mastered", opacity: 1, glow: 47, lightness: 0.86, chroma: 0.24 },
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
  return Math.max(0, Math.min(1, (xp - current.min) / (next.min - current.min)));
}

const BASE_RADIUS = 15;
const MAX_GROWTH = 27;

/** Square-rooted so early training creates strong visual feedback. */
export function radiusForXp(xp: number): number {
  const t = Math.min(Math.max(xp, 0), MAX_XP) / MAX_XP;
  return Math.round(BASE_RADIUS + MAX_GROWTH * Math.sqrt(t));
}

/** Diameter of the largest possible orb — used to size layout collision. */
export const MAX_DIAMETER = (BASE_RADIUS + MAX_GROWTH) * 2;

/** Sums awarded logs into a nodeId -> raw XP map in one pass. */
export function xpByNode(logs: LogEntry[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const log of logs) {
    totals[log.nodeId] = (totals[log.nodeId] ?? 0) + log.xp;
  }
  return totals;
}

export interface DecayState {
  rawXp: number;
  effectiveXp: number;
  retention: number;
  daysIdle: number;
  decaying: boolean;
  lastTrainedAt: string | null;
}

/**
 * Ebbinghaus-inspired retention curve. Training has a two-week grace period;
 * afterwards progress decays gently with a 120-day half-life. Once a faculty
 * has reached Firing, decay never erases that foundation completely.
 */
export function decayStateForLogs(
  logs: LogEntry[],
  now = new Date(),
): DecayState {
  if (logs.length === 0) {
    return {
      rawXp: 0,
      effectiveXp: 0,
      retention: 1,
      daysIdle: 0,
      decaying: false,
      lastTrainedAt: null,
    };
  }

  let rawXp = 0;
  let latestMs = 0;
  let latestIso: string | null = null;
  for (const log of logs) {
    rawXp += log.xp;
    const ms = new Date(log.at).getTime();
    if (ms > latestMs) {
      latestMs = ms;
      latestIso = log.at;
    }
  }

  const daysIdle = Math.max(0, (now.getTime() - latestMs) / 864e5);
  if (daysIdle <= DECAY_GRACE_DAYS) {
    return {
      rawXp,
      effectiveXp: rawXp,
      retention: 1,
      daysIdle,
      decaying: false,
      lastTrainedAt: latestIso,
    };
  }

  const decayingDays = daysIdle - DECAY_GRACE_DAYS;
  const factor = Math.pow(0.5, decayingDays / DECAY_HALF_LIFE_DAYS);
  const floor = Math.min(rawXp, DECAY_FLOOR_XP);
  const effectiveXp = floor + (rawXp - floor) * factor;
  // Glow can ebb a little faster than numeric XP while never becoming illegible.
  const retention = Math.max(0.5, Math.pow(0.5, decayingDays / 90));

  return {
    rawXp,
    effectiveXp: Math.round(effectiveXp),
    retention,
    daysIdle,
    decaying: true,
    lastTrainedAt: latestIso,
  };
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

export interface ExerciseResetState {
  available: boolean;
  nextResetAt: Date | null;
}

function latestExerciseLog(logs: LogEntry[], exerciseId: string): LogEntry | null {
  let latest: LogEntry | null = null;
  for (const log of logs) {
    if (log.exerciseId !== exerciseId) continue;
    if (!latest || log.at > latest.at) latest = log;
  }
  return latest;
}

/**
 * Every XP task has a reset boundary. Session tasks intentionally use a
 * four-hour cooldown: they are repeatable, but never infinitely spammable.
 */
export function exerciseResetState(
  logs: LogEntry[],
  exerciseId: string,
  cadence: Cadence,
  now = new Date(),
): ExerciseResetState {
  const latest = latestExerciseLog(logs, exerciseId);
  if (!latest) return { available: true, nextResetAt: null };

  if (cadence === "daily") {
    if (dayKey(new Date(latest.at)) !== dayKey(now)) {
      return { available: true, nextResetAt: null };
    }
    const reset = new Date(now);
    reset.setHours(24, 0, 0, 0);
    return { available: false, nextResetAt: reset };
  }

  const durationMs =
    cadence === "weekly" ? 7 * 864e5 : SESSION_RESET_HOURS * 60 * 60 * 1000;
  const reset = new Date(new Date(latest.at).getTime() + durationMs);
  return reset <= now
    ? { available: true, nextResetAt: null }
    : { available: false, nextResetAt: reset };
}

export function isSatisfied(
  logs: LogEntry[],
  exerciseId: string,
  cadence: Cadence,
  now = new Date(),
): boolean {
  return !exerciseResetState(logs, exerciseId, cadence, now).available;
}

/** Estimate minutes for analytics when a task did not explicitly record them. */
export function estimateExerciseMinutes(exercise: Exercise): number {
  const match = exercise.label.match(/(\d+)\s*(?:-|–)?\s*(?:minute|min)\b/i);
  if (match) return Math.max(1, Number(match[1]));
  return Math.max(5, Math.round((exercise.xp * 0.8) / 5) * 5);
}
