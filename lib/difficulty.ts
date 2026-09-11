import type { Difficulty, Exercise, LogEntry } from "./types.ts";

/**
 * Adaptive difficulty.
 *
 * The target is desirable difficulty, not comfort: somewhere around a 55-85%
 * success rate, where failure happens often enough to carry information but not
 * so often that the task stops teaching. Practice that is reliably easy feels
 * productive and is close to worthless, which is why this module moves the
 * level up on sustained success rather than waiting to be asked.
 *
 * The curriculum's authored difficulty is an anchor and never changes. What
 * moves is the user's working level around it, expressed as a step up or down
 * the exercise's own progression ladder.
 */

/** Attempts considered when judging whether to move. */
const WINDOW = 5;
/** Minimum attempts at the current level before it can move at all. */
const MIN_ATTEMPTS = 3;
/** Above this success rate the task is too easy. */
export const CEILING = 0.85;
/** Below this success rate the task is not teaching. */
export const FLOOR = 0.45;
/**
 * An unscored completion is weak evidence of success: the user chose the task,
 * chose when to stop, and marked their own work. It counts, at a discount.
 */
const UNSCORED_SUCCESS = 0.7;

export interface AttemptOutcome {
  /** 0-1 success signal for this attempt. */
  success: number;
  /** Whether the attempt carried an objective or judged score. */
  scored: boolean;
  at: string;
  difficulty: Difficulty;
}

export function outcomeFromLog(log: LogEntry, anchor: Difficulty): AttemptOutcome {
  if (typeof log.score === "number") {
    return { success: log.score, scored: true, at: log.at, difficulty: log.difficulty ?? anchor };
  }
  if (typeof log.quality === "number") {
    return {
      success: log.quality,
      scored: true,
      at: log.at,
      difficulty: log.difficulty ?? anchor,
    };
  }
  return {
    success: UNSCORED_SUCCESS,
    scored: false,
    at: log.at,
    difficulty: log.difficulty ?? anchor,
  };
}

export interface AdaptiveState {
  exerciseId: string;
  /** The curriculum's authored difficulty. Never changes. */
  anchor: Difficulty;
  /** The level this user should attempt next. */
  level: Difficulty;
  /** Index into `exercise.progression`, or -1 for the anchor framing. */
  progressionIndex: number;
  /** The framing to actually present. */
  label: string;
  attempts: number;
  /** Success rate over the recent window, or null when there is no history. */
  recentSuccess: number | null;
  /** Share of the window that was objectively scored. */
  scoredShare: number;
  direction: "up" | "down" | "hold" | "new";
  reason: string;
}

function clampDifficulty(value: number): Difficulty {
  return Math.min(5, Math.max(1, Math.round(value))) as Difficulty;
}

/**
 * Chooses the difficulty this user should attempt next for one exercise.
 *
 * Only attempts at or above the current level count toward the ceiling test,
 * so grinding the easy framing of a task can never promote you out of it —
 * that would let a user manufacture a hard-looking level they never reached.
 */
export function adaptiveStateFor(
  exercise: Exercise,
  logs: LogEntry[],
  now = new Date(),
): AdaptiveState {
  const anchor = (exercise.difficulty ?? 2) as Difficulty;
  const progression = exercise.progression ?? [];
  const attemptsAll = logs
    .filter((log) => log.exerciseId === exercise.id)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((log) => outcomeFromLog(log, anchor));

  if (attemptsAll.length === 0) {
    return {
      exerciseId: exercise.id,
      anchor,
      level: anchor,
      progressionIndex: -1,
      label: exercise.label,
      attempts: 0,
      recentSuccess: null,
      scoredShare: 0,
      direction: "new",
      reason: `Starting at the authored difficulty (${anchor}/5). The level will move once there is a track record.`,
    };
  }

  // Replay the history so the level is a pure function of the log, not stored
  // state that could drift out of sync with an import or a cross-tab write.
  let level = anchor;
  let sinceMove: AttemptOutcome[] = [];
  let direction: AdaptiveState["direction"] = "hold";
  let reason = "";

  for (const attempt of attemptsAll) {
    if (attempt.difficulty < level) {
      // An easier framing was attempted. It counts as practice but cannot be
      // evidence that the current level is too easy.
      continue;
    }
    sinceMove.push(attempt);
    if (sinceMove.length < MIN_ATTEMPTS) continue;

    const window = sinceMove.slice(-WINDOW);
    const rate = window.reduce((sum, item) => sum + item.success, 0) / window.length;

    if (rate >= CEILING && level < 5) {
      level = clampDifficulty(level + 1);
      sinceMove = [];
      direction = "up";
      reason = `${window.length} recent attempts averaged ${Math.round(rate * 100)}% success, above the ${Math.round(CEILING * 100)}% ceiling. Difficulty raised to ${level}/5.`;
    } else if (rate <= FLOOR && level > 1) {
      level = clampDifficulty(level - 1);
      sinceMove = [];
      direction = "down";
      reason = `${window.length} recent attempts averaged ${Math.round(rate * 100)}% success, below the ${Math.round(FLOOR * 100)}% floor. Difficulty lowered to ${level}/5 so the task can teach again.`;
    }
  }

  const window = sinceMove.slice(-WINDOW);
  const recentSuccess =
    window.length > 0
      ? window.reduce((sum, item) => sum + item.success, 0) / window.length
      : null;
  const scoredShare =
    window.length > 0 ? window.filter((item) => item.scored).length / window.length : 0;

  if (!reason) {
    if (recentSuccess === null) {
      reason = `Holding at ${level}/5 until there is enough history to judge.`;
    } else {
      reason = `Holding at ${level}/5: recent success is ${Math.round(recentSuccess * 100)}%, inside the ${Math.round(FLOOR * 100)}-${Math.round(CEILING * 100)}% band where the task still teaches.`;
    }
  }

  if (scoredShare === 0 && window.length >= MIN_ATTEMPTS) {
    reason += " None of these attempts were scored, so this level is a guess — attach a score or an artifact to make it a measurement.";
  }

  const progressionIndex = Math.min(progression.length - 1, level - anchor - 1);
  const label =
    progressionIndex >= 0 && progression[progressionIndex]
      ? `${exercise.label} — ${progression[progressionIndex]}`
      : exercise.label;

  void now;

  return {
    exerciseId: exercise.id,
    anchor,
    level,
    progressionIndex,
    label,
    attempts: attemptsAll.length,
    recentSuccess,
    scoredShare,
    direction,
    reason,
  };
}

/**
 * Anti-gaming: has this exercise stopped producing information?
 *
 * Repeating a task you always pass, at the easiest framing, with no score
 * attached, is the exact shape of XP farming. Rather than punishing it, this
 * flag is used to redirect — the workout planner demotes these and the panel
 * offers the harder framing instead.
 */
export function isSaturated(state: AdaptiveState): boolean {
  return (
    state.attempts >= 6 &&
    state.recentSuccess !== null &&
    state.recentSuccess >= CEILING &&
    state.level >= 5
  );
}

/** The fraction of an exercise's XP that a rep at this level should be worth. */
export function difficultyXpFactor(state: AdaptiveState): number {
  // A level below the anchor is still practice, just worth less; a level above
  // it is worth proportionally more, capped so escalation cannot be farmed.
  return Math.min(1.5, Math.max(0.6, 1 + (state.level - state.anchor) * 0.15));
}
