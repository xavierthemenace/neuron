import type { LogEntry, RetentionModel } from "./types.ts";

/**
 * Type-aware retention.
 *
 * A single forgetting curve for both "Method of Loci" and "Strength &
 * Conditioning" is wrong in both directions: declarative knowledge follows a
 * spacing-sensitive stability curve, motor fluency degrades slowly from a high
 * floor, an executive habit is almost entirely a recency phenomenon, and
 * physical adaptations detrain fast and return fast. Each model below is a
 * deliberately simple, testable approximation of its own literature, not one
 * curve with different constants.
 *
 * Every model returns a 0-1 `retention` meaning "share of the peak capability
 * you would show if tested right now", plus an explanation string, because an
 * unexplained decayed node is indistinguishable from a bug.
 */

export interface RetentionParams {
  /** Days of full retention after the last rep. */
  graceDays: number;
  /** Days for the decaying portion to halve. */
  halfLifeDays: number;
  /** Retention never falls below this. Structure that does not disappear. */
  floor: number;
}

/**
 * Base parameters per model. `knowledge` is handled by the FSRS-like path and
 * uses these only as a fallback when there is too little history to fit.
 */
export const RETENTION_PARAMS: Record<RetentionModel, RetentionParams> = {
  // Declarative material: short grace, real decay, low floor.
  knowledge: { graceDays: 3, halfLifeDays: 30, floor: 0.1 },
  // Motor and cognitive fluency: speed goes, structure stays.
  procedural: { graceDays: 21, halfLifeDays: 150, floor: 0.55 },
  // Habits are recency. A fortnight off and the trigger stops firing.
  "executive-habit": { graceDays: 3, halfLifeDays: 21, floor: 0.15 },
  // Detraining: measurable within two weeks, substantial by six.
  physical: { graceDays: 7, halfLifeDays: 28, floor: 0.3 },
  // Social skill fades with demonstration recency, not with study.
  social: { graceDays: 14, halfLifeDays: 60, floor: 0.35 },
  // Meta-skills are about application frequency; recency matters less.
  meta: { graceDays: 10, halfLifeDays: 90, floor: 0.4 },
};

export interface RetentionState {
  model: RetentionModel;
  /** 0-1 current retrievability / fluency. */
  retention: number;
  daysIdle: number;
  /** Current stability in days — how long until retention reaches ~0.9. */
  stabilityDays: number;
  decaying: boolean;
  lastTrainedAt: string | null;
  /** Distinct practice sessions on record. Drives stability growth. */
  repetitions: number;
  /** Plain-language reason this node reads the way it does. */
  explanation: string;
  /** When retention is projected to cross 0.7, if it has not already. */
  reviewDueAt: string | null;
}

const DAY_MS = 864e5;

function daysBetween(fromMs: number, toMs: number): number {
  return Math.max(0, (toMs - fromMs) / DAY_MS);
}

/** Distinct practice days, oldest first. Two reps in one evening are one session. */
function sessionDays(logs: LogEntry[]): number[] {
  const days = new Set<number>();
  for (const log of logs) {
    const time = new Date(log.at).getTime();
    if (Number.isNaN(time)) continue;
    days.add(Math.floor(time / DAY_MS));
  }
  return [...days].sort((a, b) => a - b);
}

// ── FSRS-like path, for declarative knowledge ─────────────────────────────
/**
 * Power forgetting curve with R(S) = 0.9 at t = S, matching the shape used by
 * FSRS. Exponential decay fits single-item recall poorly over long intervals;
 * the power curve is the correction.
 */
export function retrievability(elapsedDays: number, stabilityDays: number): number {
  if (stabilityDays <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stabilityDays), -1);
}

/** Inverse: how long until retention falls to `target`. */
export function daysUntilRetention(
  stabilityDays: number,
  target: number,
  elapsedDays = 0,
): number {
  if (target <= 0 || target >= 1) return Infinity;
  const total = 9 * stabilityDays * (1 / target - 1);
  return Math.max(0, total - elapsedDays);
}

/** Initial stability after a first successful rep, in days. */
const INITIAL_STABILITY = 2.4;
/** How much easier material gains stability faster. D is 1 (easy) to 10 (hard). */
const STABILITY_GAIN = 2.2;
/** Diminishing returns: already-stable memories gain proportionally less. */
const STABILITY_DAMPING = 0.34;
/** Reviewing at low retrievability is worth more — the spacing effect. */
const SPACING_BONUS = 1.4;

/**
 * One stability update for a successful review, in the FSRS family:
 * a review is worth more when the memory was closer to being forgotten, worth
 * less when the material is difficult, and worth less when stability is
 * already high.
 */
export function updateStability(
  stability: number,
  difficulty: number,
  retrievabilityAtReview: number,
): number {
  const ease = (11 - difficulty) / 10;
  const growth =
    STABILITY_GAIN *
    ease *
    Math.pow(stability, -STABILITY_DAMPING) *
    (Math.exp(SPACING_BONUS * (1 - retrievabilityAtReview)) - 1);
  return Math.max(stability, stability * (1 + Math.max(0, growth)));
}

/** Maps a 1-5 curriculum difficulty onto the 1-10 FSRS difficulty scale. */
function fsrsDifficulty(logs: LogEntry[]): number {
  const levels: number[] = [];
  for (const log of logs) {
    if (typeof log.difficulty === "number") levels.push(log.difficulty);
  }
  if (levels.length === 0) return 5;
  const mean = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  return Math.min(10, Math.max(1, 1 + (mean - 1) * 2.25));
}

function knowledgeRetention(
  logs: LogEntry[],
  nowMs: number,
): { retention: number; stability: number } {
  const days = sessionDays(logs);
  if (days.length === 0) return { retention: 0, stability: 0 };

  const difficulty = fsrsDifficulty(logs);
  let stability = INITIAL_STABILITY;
  let previous = days[0];

  for (let index = 1; index < days.length; index += 1) {
    const elapsed = days[index] - previous;
    stability = updateStability(stability, difficulty, retrievability(elapsed, stability));
    previous = days[index];
  }

  const elapsed = daysBetween(previous * DAY_MS, nowMs);
  return { retention: retrievability(elapsed, stability), stability };
}

// ── Recency-and-frequency path, for habits and meta-skills ────────────────
/**
 * Executive habits and meta-skills are not recalled, they are *applied*. A
 * pure time-since-last curve calls a habit intact the day after one isolated
 * attempt, which is exactly wrong. Frequency over the recent window sets the
 * ceiling; recency then decays from it.
 */
function frequencyCeiling(days: number[], nowDay: number, windowDays: number): number {
  const recent = days.filter((day) => nowDay - day <= windowDays).length;
  // Six or more sessions in the window reads as an established pattern.
  return Math.min(1, 0.4 + 0.1 * recent);
}

// ── Public API ────────────────────────────────────────────────────────────
export function retentionStateFor(
  logs: LogEntry[],
  model: RetentionModel,
  now = new Date(),
): RetentionState {
  const nowMs = now.getTime();
  const days = sessionDays(logs);

  if (days.length === 0) {
    return {
      model,
      retention: 1,
      daysIdle: 0,
      stabilityDays: 0,
      decaying: false,
      lastTrainedAt: null,
      repetitions: 0,
      explanation: "Never trained, so there is nothing to retain yet.",
      reviewDueAt: null,
    };
  }

  const lastDay = days[days.length - 1];
  let lastMs = 0;
  let lastIso: string | null = null;
  for (const log of logs) {
    const time = new Date(log.at).getTime();
    if (!Number.isNaN(time) && time > lastMs) {
      lastMs = time;
      lastIso = log.at;
    }
  }
  const daysIdle = daysBetween(lastMs, nowMs);
  const params = RETENTION_PARAMS[model];
  const repetitions = days.length;

  let retention: number;
  let stabilityDays: number;
  let explanation: string;

  if (model === "knowledge") {
    const result = knowledgeRetention(logs, nowMs);
    stabilityDays = result.stability;
    retention = Math.max(params.floor, result.retention);
    explanation =
      `Knowledge model: ${repetitions} spaced session${repetitions === 1 ? "" : "s"} ` +
      `built a memory stability of about ${stabilityDays.toFixed(1)} days, and ` +
      `${daysIdle.toFixed(0)} day${Math.round(daysIdle) === 1 ? "" : "s"} have passed since the last one.`;
  } else if (model === "executive-habit" || model === "meta") {
    const windowDays = model === "executive-habit" ? 30 : 60;
    const ceiling = frequencyCeiling(days, lastDay + Math.floor(daysIdle), windowDays);
    const decayDays = Math.max(0, daysIdle - params.graceDays);
    const decayed = Math.pow(0.5, decayDays / params.halfLifeDays);
    retention = Math.max(params.floor, ceiling * decayed);
    stabilityDays = params.halfLifeDays;
    const recent = days.filter(
      (day) => lastDay + Math.floor(daysIdle) - day <= windowDays,
    ).length;
    explanation =
      `${model === "meta" ? "Meta-skill" : "Habit"} model: measured by how often it is ` +
      `successfully applied. ${recent} session${recent === 1 ? "" : "s"} in the last ${windowDays} days ` +
      `sets the ceiling at ${Math.round(ceiling * 100)}%, and ${daysIdle.toFixed(0)} idle days decay it from there.`;
  } else {
    // Procedural, physical and social all share a floored exponential shape;
    // what differs is how fast it falls and how much survives underneath.
    // Accumulated practice slows the fall — an overlearned skill degrades less.
    const practiceBonus = 1 + Math.log10(1 + repetitions) * 0.8;
    const halfLife = params.halfLifeDays * practiceBonus;
    const decayDays = Math.max(0, daysIdle - params.graceDays);
    const decayed = Math.pow(0.5, decayDays / halfLife);
    retention = params.floor + (1 - params.floor) * decayed;
    stabilityDays = halfLife;
    const noun =
      model === "physical"
        ? "Detraining model"
        : model === "social"
          ? "Demonstration-recency model"
          : "Fluency model";
    const tail =
      model === "physical"
        ? "Physical adaptations are lost quickly and regained quickly."
        : model === "social"
          ? "Only real-world demonstration refreshes this; reading about it does not."
          : "Speed degrades first; the underlying structure persists.";
    explanation =
      `${noun}: ${repetitions} session${repetitions === 1 ? "" : "s"} pushed the half-life to ` +
      `${Math.round(halfLife)} days, with a floor of ${Math.round(params.floor * 100)}%. ` +
      `${daysIdle.toFixed(0)} days idle. ${tail}`;
    if (daysIdle <= params.graceDays) {
      explanation += " Still inside the grace period.";
    }
  }

  retention = Math.min(1, Math.max(0, retention));
  const decaying = retention < 0.995;

  let reviewDueAt: string | null = null;
  if (model === "knowledge" && stabilityDays > 0 && retention > 0.7) {
    const remaining = daysUntilRetention(stabilityDays, 0.7, daysIdle);
    if (Number.isFinite(remaining)) {
      reviewDueAt = new Date(nowMs + remaining * DAY_MS).toISOString();
    }
  }

  return {
    model,
    retention,
    daysIdle,
    stabilityDays,
    decaying,
    lastTrainedAt: lastIso,
    repetitions,
    explanation,
    reviewDueAt,
  };
}

/**
 * Retention risk, 0 (safe) to 1 (about to be lost). Used by the review inbox
 * and the workout planner to rank what is most urgent.
 *
 * Deliberately not just `1 - retention`: a node that has already bottomed out
 * at its floor is not urgent — it is either lost or was never really held —
 * while one sliding through the middle of its curve is exactly where a single
 * review buys the most.
 */
export function retentionRisk(state: RetentionState): number {
  if (state.repetitions === 0) return 0;
  const floor = RETENTION_PARAMS[state.model].floor;
  const span = Math.max(0.05, 1 - floor);
  const position = (state.retention - floor) / span; // 1 = fresh, 0 = bottomed
  // Peaks around 0.35 retention-above-floor, where a review is most valuable.
  return Math.max(0, Math.min(1, 1 - Math.abs(position - 0.35) / 0.65));
}
