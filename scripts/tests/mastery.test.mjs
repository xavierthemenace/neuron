import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DECAY_FLOOR_XP,
  DECAY_GRACE_DAYS,
  DECAY_HALF_LIFE_DAYS,
  MAX_XP,
  TIERS,
  dayKey,
  decayStateForLogs,
  estimateExerciseMinutes,
  exerciseResetState,
  isSatisfied,
  radiusForXp,
  tierForXp,
  tierProgress,
  totalXp,
  xpByNode,
} from "../../lib/mastery.ts";

const DAY = 864e5;

const log = (over = {}) => ({
  id: over.id ?? "l1",
  nodeId: over.nodeId ?? "n1",
  exerciseId: over.exerciseId ?? "e1",
  xp: over.xp ?? 10,
  at: over.at ?? new Date().toISOString(),
});

describe("tiers", () => {
  it("places XP in the right tier at every boundary", () => {
    // Boundaries are where off-by-one errors hide, so test both sides of each.
    for (const tier of TIERS) {
      assert.equal(tierForXp(tier.min).name, tier.name, `at ${tier.min}`);
      if (tier.min > 0) {
        assert.ok(
          tierForXp(tier.min - 1).index === tier.index - 1,
          `${tier.min - 1} should sit one tier below ${tier.name}`,
        );
      }
    }
  });

  it("never returns a tier above Mastered", () => {
    const top = TIERS[TIERS.length - 1];
    assert.equal(tierForXp(MAX_XP * 10).name, top.name);
  });

  it("reports tier progress as 0 at a tier floor and 1 once mastered", () => {
    assert.equal(tierProgress(0), 0);
    assert.equal(tierProgress(MAX_XP), 1);
    assert.equal(tierProgress(MAX_XP + 500), 1);
    const mid = tierProgress(100);
    assert.ok(mid > 0 && mid < 1, `expected 0<p<1, got ${mid}`);
  });
});

describe("orb radius", () => {
  it("grows with XP but stops at the cap", () => {
    assert.ok(radiusForXp(0) < radiusForXp(50));
    assert.ok(radiusForXp(50) < radiusForXp(MAX_XP));
    // Past the cap the layout must stay stable or baked collision spacing lies.
    assert.equal(radiusForXp(MAX_XP), radiusForXp(MAX_XP * 4));
  });

  it("front-loads growth so early reps feel like progress", () => {
    const firstQuarter = radiusForXp(MAX_XP * 0.25) - radiusForXp(0);
    const lastQuarter = radiusForXp(MAX_XP) - radiusForXp(MAX_XP * 0.75);
    assert.ok(
      firstQuarter > lastQuarter,
      `sqrt curve expected: ${firstQuarter} should exceed ${lastQuarter}`,
    );
  });
});

describe("xp aggregation", () => {
  it("sums per node and in total", () => {
    const logs = [
      log({ id: "a", nodeId: "x", xp: 10 }),
      log({ id: "b", nodeId: "x", xp: 5 }),
      log({ id: "c", nodeId: "y", xp: 7 }),
    ];
    assert.deepEqual(xpByNode(logs), { x: 15, y: 7 });
    assert.equal(totalXp({ version: 1, logs }), 22);
  });

  it("treats an empty history as zero", () => {
    assert.deepEqual(xpByNode([]), {});
    assert.equal(totalXp({ version: 1, logs: [] }), 0);
  });
});

describe("memory decay", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("returns a neutral state with no history", () => {
    const state = decayStateForLogs([], now);
    assert.equal(state.rawXp, 0);
    assert.equal(state.effectiveXp, 0);
    assert.equal(state.retention, 1);
    assert.equal(state.decaying, false);
    assert.equal(state.lastTrainedAt, null);
  });

  it("does not decay inside the grace period", () => {
    const at = new Date(now.getTime() - (DECAY_GRACE_DAYS - 1) * DAY).toISOString();
    const state = decayStateForLogs([log({ xp: 300, at })], now);
    assert.equal(state.decaying, false);
    assert.equal(state.effectiveXp, 300);
    assert.equal(state.retention, 1);
  });

  it("decays after the grace period by the documented half-life", () => {
    const idle = DECAY_GRACE_DAYS + DECAY_HALF_LIFE_DAYS;
    const at = new Date(now.getTime() - idle * DAY).toISOString();
    const state = decayStateForLogs([log({ xp: 700, at })], now);
    assert.equal(state.decaying, true);
    assert.equal(state.rawXp, 700, "lifetime XP must never be rewritten");
    // One half-life past grace: floor + half of the amount above the floor.
    assert.equal(state.effectiveXp, DECAY_FLOOR_XP + (700 - DECAY_FLOOR_XP) * 0.5);
  });

  it("never decays a faculty below the floor it has earned", () => {
    const at = new Date(now.getTime() - 4000 * DAY).toISOString();
    const strong = decayStateForLogs([log({ xp: 700, at })], now);
    assert.ok(
      strong.effectiveXp >= DECAY_FLOOR_XP,
      `${strong.effectiveXp} fell below the ${DECAY_FLOOR_XP} floor`,
    );

    // Below the floor, XP is its own floor and must be preserved exactly.
    const weak = decayStateForLogs([log({ xp: 40, at })], now);
    assert.equal(weak.effectiveXp, 40);
  });

  it("keeps retention legible however long the idle gap", () => {
    const at = new Date(now.getTime() - 9000 * DAY).toISOString();
    assert.equal(decayStateForLogs([log({ xp: 700, at })], now).retention, 0.5);
  });

  it("measures idleness from the most recent log, not the first", () => {
    const state = decayStateForLogs(
      [
        log({ id: "old", xp: 10, at: new Date(now.getTime() - 900 * DAY).toISOString() }),
        log({ id: "new", xp: 10, at: new Date(now.getTime() - 1 * DAY).toISOString() }),
      ],
      now,
    );
    assert.equal(state.decaying, false);
    assert.equal(state.rawXp, 20);
    assert.ok(state.daysIdle < 2, `expected ~1 idle day, got ${state.daysIdle}`);
  });
});

describe("exercise reset windows", () => {
  it("is available when never logged", () => {
    const state = exerciseResetState([], "e1", "daily");
    assert.equal(state.available, true);
    assert.equal(state.nextResetAt, null);
  });

  it("locks a daily task for the rest of the local day", () => {
    const now = new Date();
    const logs = [log({ at: now.toISOString() })];
    const state = exerciseResetState(logs, "e1", "daily", now);
    assert.equal(state.available, false);
    assert.ok(state.nextResetAt instanceof Date);
    assert.equal(
      dayKey(state.nextResetAt),
      dayKey(new Date(now.getTime() + DAY)),
      "a daily task should unlock at the next local midnight",
    );
    assert.equal(isSatisfied(logs, "e1", "daily", now), true);
  });

  it("frees a daily task once the calendar day turns over", () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - DAY);
    const logs = [log({ at: yesterday.toISOString() })];
    assert.equal(exerciseResetState(logs, "e1", "daily", now).available, true);
  });

  it("holds a weekly task for seven days", () => {
    const now = new Date("2026-06-10T12:00:00.000Z");
    const recent = [log({ at: new Date(now.getTime() - 6 * DAY).toISOString() })];
    const stale = [log({ at: new Date(now.getTime() - 8 * DAY).toISOString() })];
    assert.equal(exerciseResetState(recent, "e1", "weekly", now).available, false);
    assert.equal(exerciseResetState(stale, "e1", "weekly", now).available, true);
  });

  it("gives session tasks a short cooldown instead of being spammable", () => {
    const now = new Date("2026-06-10T12:00:00.000Z");
    const justNow = [log({ at: new Date(now.getTime() - 30 * 60000).toISOString() })];
    const earlier = [log({ at: new Date(now.getTime() - 5 * 3600_000).toISOString() })];
    assert.equal(exerciseResetState(justNow, "e1", "session", now).available, false);
    assert.equal(exerciseResetState(earlier, "e1", "session", now).available, true);
  });

  it("scopes the window to one exercise id", () => {
    const now = new Date();
    const logs = [log({ exerciseId: "other", at: now.toISOString() })];
    assert.equal(exerciseResetState(logs, "e1", "daily", now).available, true);
  });
});

describe("dayKey", () => {
  it("uses local calendar days so late-evening reps count today", () => {
    const late = new Date(2026, 5, 10, 23, 30, 0);
    assert.equal(dayKey(late), "2026-06-10");
  });

  it("zero-pads month and day", () => {
    assert.equal(dayKey(new Date(2026, 0, 5)), "2026-01-05");
  });
});

describe("estimateExerciseMinutes", () => {
  it("prefers a duration stated in the label", () => {
    assert.equal(estimateExerciseMinutes({ label: "25 minutes of practice", xp: 20 }), 25);
    assert.equal(estimateExerciseMinutes({ label: "Do a 10 min drill", xp: 99 }), 10);
  });

  it("falls back to an XP-derived estimate with a sane minimum", () => {
    assert.ok(estimateExerciseMinutes({ label: "Read a chapter", xp: 30 }) >= 5);
    assert.equal(estimateExerciseMinutes({ label: "Tiny task", xp: 1 }), 5);
  });
});
