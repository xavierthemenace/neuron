import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RETENTION_PARAMS,
  daysUntilRetention,
  retentionRisk,
  retentionStateFor,
  retrievability,
  updateStability,
} from "../../lib/retention.ts";
import {
  EVIDENCE_WEIGHT,
  confidenceFor,
  difficultyFactor,
  displayStrength,
  estimateNode,
} from "../../lib/competence.ts";
import {
  CEILING,
  FLOOR,
  adaptiveStateFor,
  difficultyXpFactor,
  isSaturated,
  outcomeFromLog,
} from "../../lib/difficulty.ts";
import {
  brierScore,
  calibrationCurve,
  calibrationSummary,
  decomposeBrier,
  resolvedPredictions,
} from "../../lib/predictions.ts";
import { migrateProgress } from "../../lib/migrations.ts";
import { overallConfidence, retentionModelFor } from "../../lib/evidence.ts";

const DAY = 864e5;
const NOW = new Date("2026-06-01T12:00:00.000Z");

function daysAgo(days, extra = {}) {
  return {
    id: `log-${days}-${Math.random().toString(36).slice(2, 8)}`,
    nodeId: "n",
    exerciseId: "ex",
    xp: 10,
    at: new Date(NOW.getTime() - days * DAY).toISOString(),
    ...extra,
  };
}

describe("retention: the forgetting curve", () => {
  it("is 0.9 at exactly one stability interval", () => {
    // The FSRS power curve is defined so R(S) = 0.9. If this drifts, every
    // scheduling decision downstream drifts with it.
    assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 0.0001);
    assert.ok(Math.abs(retrievability(3, 3) - 0.9) < 0.0001);
  });

  it("falls monotonically and never goes negative", () => {
    let previous = 1;
    for (let day = 0; day < 400; day += 7) {
      const value = retrievability(day, 12);
      assert.ok(value <= previous + 1e-9, `retention rose at day ${day}`);
      assert.ok(value > 0);
      previous = value;
    }
  });

  it("inverts correctly: daysUntilRetention lands on the target", () => {
    const days = daysUntilRetention(20, 0.7);
    assert.ok(Math.abs(retrievability(days, 20) - 0.7) < 0.0001);
  });

  it("rewards reviewing late more than reviewing immediately", () => {
    // The spacing effect: a review at low retrievability buys more stability.
    const early = updateStability(10, 5, 0.98);
    const late = updateStability(10, 5, 0.6);
    assert.ok(late > early);
  });

  it("gives difficult material less stability per review", () => {
    assert.ok(updateStability(10, 2, 0.7) > updateStability(10, 9, 0.7));
  });

  it("never lowers stability", () => {
    for (const r of [0, 0.5, 0.999]) {
      assert.ok(updateStability(30, 5, r) >= 30);
    }
  });
});

describe("retention: models differ by node kind", () => {
  const logs = [daysAgo(60), daysAgo(50), daysAgo(40)];

  it("treats knowledge, fluency and habits differently after the same gap", () => {
    const knowledge = retentionStateFor(logs, "knowledge", NOW).retention;
    const procedural = retentionStateFor(logs, "procedural", NOW).retention;
    const habit = retentionStateFor(logs, "executive-habit", NOW).retention;

    // A motor skill unpractised for 40 days is in far better shape than a set
    // of facts, and a habit is in worse shape than either.
    assert.ok(procedural > knowledge, "fluency should outlast knowledge");
    assert.ok(knowledge > habit, "a habit should fade faster than knowledge");
  });

  it("respects each model's floor", () => {
    const ancient = [daysAgo(2000), daysAgo(1990)];
    for (const model of Object.keys(RETENTION_PARAMS)) {
      const state = retentionStateFor(ancient, model, NOW);
      assert.ok(
        state.retention >= RETENTION_PARAMS[model].floor - 1e-9,
        `${model} fell below its floor`,
      );
    }
  });

  it("returns full retention and no decay for an untrained node", () => {
    const state = retentionStateFor([], "knowledge", NOW);
    assert.equal(state.retention, 1);
    assert.equal(state.decaying, false);
    assert.equal(state.repetitions, 0);
    assert.equal(state.lastTrainedAt, null);
  });

  it("counts two reps on the same day as one session", () => {
    const sameDay = [daysAgo(5), daysAgo(5.2), daysAgo(5.4)];
    assert.equal(retentionStateFor(sameDay, "procedural", NOW).repetitions, 1);
  });

  it("always explains itself", () => {
    for (const model of Object.keys(RETENTION_PARAMS)) {
      const state = retentionStateFor(logs, model, NOW);
      assert.ok(state.explanation.length > 30, `${model} has no explanation`);
    }
  });

  it("slows decay for a heavily practised procedural skill", () => {
    const few = [daysAgo(90), daysAgo(85)];
    const many = Array.from({ length: 40 }, (_, i) => daysAgo(85 + i * 3));
    assert.ok(
      retentionStateFor(many, "procedural", NOW).retention >
        retentionStateFor(few, "procedural", NOW).retention,
    );
  });
});

describe("retention risk", () => {
  it("is zero for something never trained", () => {
    assert.equal(retentionRisk(retentionStateFor([], "knowledge", NOW)), 0);
  });

  it("peaks in the middle of the curve rather than at the bottom", () => {
    const fresh = retentionRisk(retentionStateFor([daysAgo(0)], "knowledge", NOW));
    const sliding = retentionRisk(retentionStateFor([daysAgo(20)], "knowledge", NOW));
    const lost = retentionRisk(retentionStateFor([daysAgo(3000)], "knowledge", NOW));
    assert.ok(sliding > fresh, "a sliding memory should outrank a fresh one");
    assert.ok(sliding > lost, "a sliding memory should outrank an abandoned one");
  });
});

describe("competence: practice is not competence", () => {
  const base = {
    node: { id: "n", evidence: { constructValidity: "strong" } },
    diagnostics: [],
    missions: [],
    capstones: [],
    missionNodeIds: () => [],
    retention: retentionStateFor([], "procedural", NOW),
  };

  it("barely moves competence for a pile of self-reported ticks", () => {
    const logs = Array.from({ length: 25 }, (_, i) => daysAgo(i, { evidence: "self-report" }));
    const estimate = estimateNode(
      { ...base, logs, xp: 700, retention: retentionStateFor(logs, "procedural", NOW) },
      NOW,
    );
    assert.equal(estimate.practice, 1, "XP should max out the practice number");
    assert.ok(
      estimate.competence < 0.62,
      `25 unscored ticks should not imply mastery, got ${estimate.competence}`,
    );
    assert.equal(estimate.strongObservations, 0);
    assert.equal(estimate.confidence, "low");
  });

  it("moves further on four scored reps than on twenty-five ticks", () => {
    const ticks = Array.from({ length: 25 }, (_, i) => daysAgo(i, { evidence: "self-report" }));
    const scored = Array.from({ length: 4 }, (_, i) =>
      daysAgo(i, { evidence: "scored", score: 0.9, difficulty: 4 }),
    );
    const a = estimateNode({ ...base, logs: ticks, xp: 700 }, NOW);
    const b = estimateNode({ ...base, logs: scored, xp: 40 }, NOW);
    assert.ok(b.competence > a.competence);
    assert.ok(b.practice < a.practice, "and with far less practice volume");
  });

  it("weights evidence kinds in the right order", () => {
    assert.ok(EVIDENCE_WEIGHT["self-report"] < EVIDENCE_WEIGHT.artifact);
    assert.ok(EVIDENCE_WEIGHT.artifact < EVIDENCE_WEIGHT.scored);
    assert.ok(EVIDENCE_WEIGHT.scored < EVIDENCE_WEIGHT.external);
  });

  it("credits a hard task more than an easy one at the same score", () => {
    const easy = estimateNode(
      { ...base, logs: [daysAgo(1, { evidence: "scored", score: 0.8, difficulty: 1 })], xp: 10 },
      NOW,
    );
    const hard = estimateNode(
      { ...base, logs: [daysAgo(1, { evidence: "scored", score: 0.8, difficulty: 5 })], xp: 10 },
      NOW,
    );
    assert.ok(hard.competence > easy.competence);
    assert.ok(difficultyFactor(5) > difficultyFactor(1));
  });

  it("discounts old observations", () => {
    const recent = estimateNode(
      { ...base, logs: [daysAgo(1, { evidence: "scored", score: 0.95 })], xp: 10 },
      NOW,
    );
    const stale = estimateNode(
      { ...base, logs: [daysAgo(900, { evidence: "scored", score: 0.95 })], xp: 10 },
      NOW,
    );
    assert.ok(recent.competence > stale.competence);
  });

  it("starts at the untrained prior with no observations at all", () => {
    const estimate = estimateNode({ ...base, logs: [], xp: 0 }, NOW);
    assert.ok(estimate.competence < 0.2);
    assert.equal(estimate.confidence, "none");
    assert.match(estimate.confidenceReason, /not a measurement/);
  });
});

describe("estimate confidence", () => {
  it("rises with scored observations", () => {
    assert.equal(confidenceFor(0, 0, "strong").confidence, "none");
    assert.equal(confidenceFor(2, 1, "strong").confidence, "low");
    assert.equal(confidenceFor(6, 2, "strong").confidence, "medium");
    assert.equal(confidenceFor(12, 5, "strong").confidence, "high");
  });

  it("is capped by how measurable the construct is", () => {
    // Twenty scored observations of something nobody can measure well still
    // does not license a confident estimate. This is the honest cap.
    const speculative = confidenceFor(30, 12, "speculative");
    assert.equal(speculative.confidence, "low");
    assert.match(speculative.reason, /construct validity/);

    const moderate = confidenceFor(30, 12, "moderate");
    assert.equal(moderate.confidence, "medium");
  });
});

describe("display strength", () => {
  it("lets practice drive early and competence drive later", () => {
    const early = displayStrength({
      practice: 0.5,
      effectiveCompetence: 0.1,
      evidenceWeight: 0.5,
    });
    const later = displayStrength({
      practice: 0.5,
      effectiveCompetence: 0.1,
      evidenceWeight: 20,
    });
    assert.ok(early > later, "evidence of low competence should pull the number down");
  });
});

describe("adaptive difficulty", () => {
  const exercise = {
    id: "ex",
    label: "Do the thing",
    xp: 10,
    cadence: "daily",
    difficulty: 2,
    progression: ["harder", "harder still", "hardest"],
  };

  const attempt = (day, success, extra = {}) =>
    daysAgo(day, { exerciseId: "ex", score: success, difficulty: extra.difficulty ?? 2, ...extra });

  it("starts at the authored anchor with no history", () => {
    const state = adaptiveStateFor(exercise, [], NOW);
    assert.equal(state.level, 2);
    assert.equal(state.direction, "new");
    assert.equal(state.label, exercise.label);
  });

  it("raises difficulty after sustained success", () => {
    const logs = [attempt(5, 1), attempt(4, 1), attempt(3, 0.95)];
    const state = adaptiveStateFor(exercise, logs, NOW);
    assert.equal(state.level, 3);
    assert.equal(state.direction, "up");
    assert.match(state.label, /harder/);
  });

  it("lowers difficulty when the task stops teaching", () => {
    const logs = [attempt(5, 0.2), attempt(4, 0.1), attempt(3, 0.3)];
    const state = adaptiveStateFor(exercise, logs, NOW);
    assert.equal(state.level, 1);
    assert.equal(state.direction, "down");
  });

  it("holds inside the desirable-difficulty band", () => {
    const logs = [attempt(5, 0.7), attempt(4, 0.6), attempt(3, 0.75)];
    const state = adaptiveStateFor(exercise, logs, NOW);
    assert.equal(state.level, 2);
    assert.equal(state.direction, "hold");
    assert.ok(state.recentSuccess > FLOOR && state.recentSuccess < CEILING);
  });

  it("cannot be promoted by grinding an easier framing", () => {
    // Ten perfect runs at difficulty 1 must not promote a level-3 user to 4.
    const logs = [
      attempt(20, 1),
      attempt(19, 1),
      attempt(18, 1),
      ...Array.from({ length: 10 }, (_, i) => attempt(10 - i * 0.5, 1, { difficulty: 1 })),
    ];
    const state = adaptiveStateFor(exercise, logs, NOW);
    assert.equal(state.level, 3, "easier attempts must not count toward promotion");
  });

  it("is a pure function of the log, so it replays identically", () => {
    const logs = [attempt(5, 1), attempt(4, 1), attempt(3, 1)];
    const a = adaptiveStateFor(exercise, logs, NOW);
    const b = adaptiveStateFor(exercise, [...logs].reverse(), NOW);
    assert.equal(a.level, b.level);
  });

  it("flags an unscored history rather than pretending it measured something", () => {
    const logs = [daysAgo(3, { exerciseId: "ex" }), daysAgo(2, { exerciseId: "ex" }), daysAgo(1, { exerciseId: "ex" })];
    const state = adaptiveStateFor(exercise, logs, NOW);
    assert.equal(state.scoredShare, 0);
    assert.match(state.reason, /not.*scored|guess/i);
  });

  it("detects saturation for anti-gaming", () => {
    const maxed = { ...exercise, difficulty: 5, progression: [] };
    const logs = Array.from({ length: 8 }, (_, i) => attempt(8 - i, 1, { difficulty: 5 }));
    assert.equal(isSaturated(adaptiveStateFor(maxed, logs, NOW)), true);
  });

  it("scales XP with the level actually attempted", () => {
    assert.ok(difficultyXpFactor({ level: 4, anchor: 2 }) > 1);
    assert.ok(difficultyXpFactor({ level: 1, anchor: 3 }) < 1);
    assert.ok(difficultyXpFactor({ level: 5, anchor: 1 }) <= 1.5, "and is capped");
  });

  it("reads an unscored completion as weak, not full, success", () => {
    const outcome = outcomeFromLog(daysAgo(1, { exerciseId: "ex" }), 2);
    assert.equal(outcome.scored, false);
    assert.ok(outcome.success < 1);
  });
});

describe("calibration", () => {
  const prediction = (probability, outcome) => ({
    id: Math.random().toString(36),
    claim: "c",
    probability,
    createdAt: NOW.toISOString(),
    resolveBy: NOW.toISOString(),
    resolvedAt: NOW.toISOString(),
    outcome,
    nodeIds: [],
  });

  it("computes the Brier score", () => {
    const perfect = [prediction(1, "yes"), prediction(0, "no")];
    assert.equal(brierScore(resolvedPredictions(perfect)), 0);

    const coinflip = [prediction(0.5, "yes"), prediction(0.5, "no")];
    assert.equal(brierScore(resolvedPredictions(coinflip)), 0.25);
  });

  it("ignores unresolved predictions", () => {
    const mixed = [prediction(0.9, "yes"), { ...prediction(0.9, undefined), outcome: undefined }];
    assert.equal(resolvedPredictions(mixed).length, 1);
  });

  it("separates calibration from resolution", () => {
    // Predicting the base rate every time: well calibrated, zero resolution.
    const hedged = [
      ...Array.from({ length: 5 }, () => prediction(0.5, "yes")),
      ...Array.from({ length: 5 }, () => prediction(0.5, "no")),
    ];
    const decomposition = decomposeBrier(resolvedPredictions(hedged));
    assert.ok(decomposition.calibration < 0.01, "hedging is well calibrated");
    assert.ok(decomposition.resolution < 0.01, "and has no resolution at all");
  });

  it("bins the calibration curve by stated probability", () => {
    const rows = calibrationCurve(
      resolvedPredictions([prediction(0.95, "yes"), prediction(0.92, "no"), prediction(0.1, "no")]),
    );
    const high = rows.find((bin) => bin.from >= 0.9);
    assert.equal(high.count, 2);
    assert.equal(high.actual, 0.5);
  });

  it("refuses to over-interpret a small sample", () => {
    const summary = calibrationSummary([prediction(0.8, "yes"), prediction(0.7, "yes")]);
    assert.match(summary.caveat, /below the 20|direction, not a measurement/);
  });

  it("detects overconfidence", () => {
    const overconfident = Array.from({ length: 10 }, (_, i) =>
      prediction(0.9, i < 5 ? "yes" : "no"),
    );
    const summary = calibrationSummary(overconfident);
    assert.ok(summary.overconfidence > 0.3);
    assert.match(summary.headline, /overconfident/);
  });

  it("counts overdue resolutions", () => {
    const overdue = {
      id: "p",
      claim: "c",
      probability: 0.5,
      createdAt: new Date(NOW.getTime() - 40 * DAY).toISOString(),
      resolveBy: new Date(NOW.getTime() - 10 * DAY).toISOString(),
      nodeIds: [],
    };
    assert.equal(calibrationSummary([overdue], NOW).overdue, 1);
  });
});

describe("curriculum migrations", () => {
  const progress = {
    version: 2,
    logs: [
      { id: "1", nodeId: "old-node", exerciseId: "old-ex", xp: 10, at: NOW.toISOString() },
      { id: "2", nodeId: "kept", exerciseId: "kept-ex", xp: 5, at: NOW.toISOString() },
    ],
    diagnostics: [],
    predictions: [],
    missions: [],
    capstones: [],
    personalNodes: [],
    goals: [{ id: "g", label: "g", createdAt: NOW.toISOString(), nodeIds: ["old-node"], status: "active" }],
    experiments: [],
  };

  const renameOnly = [
    { version: "2.0.0", summary: "rename", ops: [{ kind: "rename-node", from: "old-node", to: "new-node" }] },
  ];

  it("rewrites node references rather than dropping history", () => {
    const { progress: out, report } = migrateProgress(
      progress,
      "2.0.0",
      new Set(["new-node", "kept"]),
      renameOnly,
    );
    assert.equal(out.logs[0].nodeId, "new-node");
    assert.equal(out.logs[1].nodeId, "kept");
    assert.equal(out.goals[0].nodeIds[0], "new-node");
    assert.equal(report.rewrittenLogs, 1);
    assert.equal(out.logs.length, 2, "no log may be lost to a migration");
  });

  it("is idempotent", () => {
    const once = migrateProgress(progress, "2.0.0", new Set(["new-node", "kept"]), renameOnly);
    const twice = migrateProgress(once.progress, "2.0.0", new Set(["new-node", "kept"]), renameOnly);
    assert.deepEqual(twice.progress.logs, once.progress.logs);
    assert.equal(twice.report.applied.length, 0, "an applied migration must not run again");
  });

  it("credits merged nodes to the survivor", () => {
    const merge = [
      { version: "3.0.0", summary: "merge", ops: [{ kind: "merge-nodes", from: ["old-node", "kept"], to: "merged" }] },
    ];
    const { progress: out } = migrateProgress(progress, "3.0.0", new Set(["merged"]), merge);
    assert.deepEqual(
      out.logs.map((log) => log.nodeId),
      ["merged", "merged"],
    );
  });

  it("keeps split history with the primary successor and explains the policy", () => {
    const split = [
      {
        version: "3.0.0",
        summary: "split",
        ops: [
          {
            kind: "split-node",
            from: "old-node",
            primary: "old-node",
            into: ["old-node", "brand-new"],
            note: "history stays with the original half",
          },
        ],
      },
    ];
    const { progress: out, report } = migrateProgress(
      progress,
      "3.0.0",
      new Set(["old-node", "brand-new", "kept"]),
      split,
    );
    assert.equal(out.logs[0].nodeId, "old-node");
    assert.ok(report.notes.some((note) => note.includes("history stays")));
  });

  it("reports orphans instead of silently deleting them", () => {
    const { progress: out, report } = migrateProgress(progress, "2.0.0", new Set(["kept"]), []);
    assert.deepEqual(report.orphanedNodeIds, ["old-node"]);
    assert.equal(out.logs.length, 2, "orphaned logs are parked, not deleted");
  });
});

describe("evidence helpers", () => {
  it("never reports overall confidence above its weakest pillar", () => {
    assert.equal(overallConfidence("strong", "emerging", "strong"), "emerging");
    assert.equal(overallConfidence("strong", "strong", "speculative"), "emerging");
    assert.equal(overallConfidence("strong", "strong", "strong"), "strong");
  });

  it("picks a retention model from node kind when none is set", () => {
    assert.equal(retentionModelFor({ kind: "knowledge" }), "knowledge");
    assert.equal(retentionModelFor({ kind: "enabler" }), "physical");
    assert.equal(retentionModelFor({ kind: "social" }), "social");
    assert.equal(
      retentionModelFor({ kind: "knowledge", retentionModel: "meta" }),
      "meta",
      "an explicit override wins",
    );
  });
});

describe("anti-gaming", () => {
  const base = {
    node: { id: "n", evidence: { constructValidity: "strong" } },
    diagnostics: [],
    missions: [],
    capstones: [],
    missionNodeIds: () => [],
    retention: retentionStateFor([], "procedural", NOW),
  };

  const artifact = (day, note) =>
    daysAgo(day, { evidence: "artifact", note, quality: 0.8, difficulty: 3 });

  it("counts the same written work once, however many times it is submitted", () => {
    const text = "A careful two hundred word analysis that took real effort to produce.";
    const repeated = estimateNode(
      {
        ...base,
        logs: [artifact(1, text), artifact(3, text), artifact(5, text), artifact(7, text)],
        xp: 80,
      },
      NOW,
    );
    const distinct = estimateNode(
      {
        ...base,
        logs: [
          artifact(1, `${text} One.`),
          artifact(3, `${text} Two, and different.`),
          artifact(5, `${text} Three, also different.`),
          artifact(7, `${text} Four, distinct again.`),
        ],
        xp: 80,
      },
      NOW,
    );

    assert.equal(repeated.strongObservations, 1, "only the first submission is evidence");
    assert.equal(distinct.strongObservations, 4);
    assert.ok(distinct.competence > repeated.competence);
  });

  it("is not defeated by reformatting or by trailing whitespace", () => {
    const text = "The same paragraph, merely re-wrapped.";
    const estimate = estimateNode(
      {
        ...base,
        logs: [artifact(1, text), artifact(2, `  ${text.replace(/, /g, ",\n")}  `)],
        xp: 40,
      },
      NOW,
    );
    assert.equal(estimate.strongObservations, 1);
  });

  it("still counts the repeat as practice rather than erasing it", () => {
    const text = "Identical work.";
    const estimate = estimateNode(
      { ...base, logs: [artifact(1, text), artifact(2, text)], xp: 40 },
      NOW,
    );
    // Two observations exist; only one of them is strong.
    assert.equal(estimate.observations.length, 2);
    assert.equal(estimate.strongObservations, 1);
    assert.ok(estimate.practice > 0, "the practice volume is untouched");
  });

  it("never lets self-reported volume alone reach a confident estimate", () => {
    const ticks = Array.from({ length: 200 }, (_, index) =>
      daysAgo(index * 0.5, { evidence: "self-report" }),
    );
    const estimate = estimateNode({ ...base, logs: ticks, xp: 700 }, NOW);
    assert.equal(estimate.strongObservations, 0);
    assert.equal(estimate.confidence, "low");
    assert.ok(
      estimate.competence < 0.65,
      `200 ticks should not imply mastery, got ${estimate.competence}`,
    );
  });
});
