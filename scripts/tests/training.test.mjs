import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { decayStateForLogs, estimateExerciseMinutes } from "../../lib/mastery.ts";
import {
  SYNERGY_MULTIPLIER,
  isTypableExercise,
  neighborsWithinDepth,
  prerequisiteBuffSources,
  synergyMultiplierForNode,
} from "../../lib/training.ts";
import {
  DEFAULT_CONSTRAINTS,
  planSession,
  rankCandidates,
} from "../../lib/workout.ts";
import { buildLearnerModel } from "../../lib/learner.ts";
import { convexHull, paddedHull, smoothClosedPath } from "../../lib/hulls.ts";

const curriculum = JSON.parse(
  readFileSync(new URL("../../data/intelligenceData.json", import.meta.url), "utf8"),
);

/** A minimal graph: a -> b -> c chain plus an unrelated island. */
const graph = {
  version: 1,
  categories: [
    { id: "cat-a", domain: "gardner", label: "A", hue: 200, blurb: "" },
    { id: "cat-b", domain: "fluid", label: "B", hue: 100, blurb: "" },
  ],
  nodes: [
    { id: "a", categoryId: "cat-a", label: "A", tier: 0, description: "", why: "", resources: [], exercises: [] },
    { id: "b", categoryId: "cat-a", label: "B", tier: 1, description: "", why: "", resources: [], exercises: [] },
    { id: "c", categoryId: "cat-b", label: "C", tier: 2, description: "", why: "", resources: [], exercises: [] },
    { id: "island", categoryId: "cat-b", label: "Island", tier: 0, description: "", why: "", resources: [], exercises: [] },
  ],
  links: [
    { source: "a", target: "b", type: "prereq" },
    { source: "b", target: "c", type: "prereq" },
  ],
};

describe("neighborsWithinDepth", () => {
  it("includes the node itself", () => {
    assert.ok(neighborsWithinDepth(graph, "a", 1).has("a"));
  });

  it("reaches one hop at depth 1 and two hops at depth 2", () => {
    assert.deepEqual([...neighborsWithinDepth(graph, "a", 1)].sort(), ["a", "b"]);
    assert.deepEqual([...neighborsWithinDepth(graph, "a", 2)].sort(), ["a", "b", "c"]);
  });

  it("traverses links in both directions", () => {
    // "c" is only ever a link target, so an outgoing-only walk would miss "b".
    assert.deepEqual([...neighborsWithinDepth(graph, "c", 1)].sort(), ["b", "c"]);
  });

  it("returns just the node when it has no links", () => {
    assert.deepEqual([...neighborsWithinDepth(graph, "island", 2)], ["island"]);
  });

  it("terminates on a cycle", () => {
    const cyclic = {
      ...graph,
      links: [
        { source: "a", target: "b", type: "prereq" },
        { source: "b", target: "a", type: "prereq" },
      ],
    };
    assert.deepEqual([...neighborsWithinDepth(cyclic, "a", 9)].sort(), ["a", "b"]);
  });
});

describe("prerequisite synergy", () => {
  it("stays neutral when prerequisites are untrained", () => {
    assert.equal(synergyMultiplierForNode(graph, "b", {}), 1);
    assert.deepEqual(prerequisiteBuffSources(graph, "b", {}), []);
  });

  it("buffs a node once its prerequisite is Consolidated", () => {
    // Tier index 3 (Consolidated) starts at 350 XP.
    assert.equal(synergyMultiplierForNode(graph, "b", { a: 349 }), 1);
    assert.equal(synergyMultiplierForNode(graph, "b", { a: 350 }), SYNERGY_MULTIPLIER);
    assert.deepEqual(prerequisiteBuffSources(graph, "b", { a: 350 }), ["a"]);
  });

  it("only counts incoming prereq links, not outgoing or synergy ones", () => {
    // "a" has no prerequisites of its own, so a trained "b" must not buff it.
    assert.equal(synergyMultiplierForNode(graph, "a", { b: 700 }), 1);

    const synergyOnly = {
      ...graph,
      links: [{ source: "a", target: "b", type: "synergy" }],
    };
    assert.equal(synergyMultiplierForNode(synergyOnly, "b", { a: 700 }), 1);
  });
});

describe("isTypableExercise", () => {
  it("recognises tasks whose work is text", () => {
    for (const label of [
      "Write 300 words explaining one idea to a smart stranger",
      "Explain something you learned today to another person",
      "Identify the underlying interest behind one stated position",
      "Estimate one quantity from first principles, then look it up",
    ]) {
      assert.equal(isTypableExercise(label), true, label);
    }
  });

  it("rejects tasks that must happen away from the keyboard", () => {
    for (const label of [
      "Complete a planned training session",
      "30 minutes of zone-2 aerobic work",
      "Hit your target sleep window",
      "10 minutes of paced breathing with a long exhale",
    ]) {
      assert.equal(isTypableExercise(label), false, label);
    }
  });
});

describe("session planner", () => {
  const now = new Date("2026-06-01T09:00:00.000Z");

  const emptyProgress = {
    version: 2,
    logs: [],
    diagnostics: [],
    predictions: [],
    missions: [],
    capstones: [],
    personalNodes: [],
    goals: [],
    experiments: [],
  };

  const plan = (constraints = {}, progress = emptyProgress, goals = []) =>
    planSession(
      curriculum,
      buildLearnerModel(progress, now),
      { ...DEFAULT_CONSTRAINTS, ...constraints },
      goals,
      now,
    );

  it("fills a time budget without blowing past it", () => {
    const session = plan({ minutes: 25 });
    assert.ok(session.items.length > 0);
    // One item is allowed to overrun slightly rather than leaving the budget
    // unspent, so the assertion is on the overrun allowance, not on equality.
    assert.ok(
      session.totalMinutes <= 25 + 5,
      `planned ${session.totalMinutes} minutes against a 25-minute budget`,
    );
  });

  it("plans a longer session for a longer budget", () => {
    assert.ok(plan({ minutes: 60 }).items.length > plan({ minutes: 15 }).items.length);
  });

  it("never repeats a faculty within one session", () => {
    const ids = plan({ minutes: 90 }).items.map((item) => item.nodeId);
    assert.equal(new Set(ids).size, ids.length, `duplicate faculty in ${ids}`);
  });

  it("cross-trains rather than drilling one cluster", () => {
    const items = plan({ minutes: 90 }).items;
    const counts = {};
    for (const item of items) counts[item.categoryId] = (counts[item.categoryId] ?? 0) + 1;
    assert.ok(
      Object.values(counts).every((count) => count <= 2),
      `a balanced session took more than two from one cluster: ${JSON.stringify(counts)}`,
    );
  });

  it("is stable within a day so the session does not reshuffle on reload", () => {
    assert.deepEqual(
      plan().items.map((item) => item.exercise.id),
      plan().items.map((item) => item.exercise.id),
    );
  });

  it("excludes exercises still inside their reset window", () => {
    const first = plan();
    const blocked = first.items[0];
    const node = curriculum.nodes.find((n) => n.id === blocked.nodeId);
    const progress = {
      ...emptyProgress,
      logs: node.exercises.map((exercise, index) => ({
        id: `blocked-${index}`,
        nodeId: blocked.nodeId,
        exerciseId: exercise.id,
        xp: exercise.xp,
        at: now.toISOString(),
      })),
    };
    const next = plan({}, progress);
    assert.ok(
      !next.items.some((item) => item.nodeId === blocked.nodeId),
      `${blocked.nodeId} was offered again while on cooldown`,
    );
    assert.ok(next.items.length > 0, "the session should backfill");
  });

  it("surfaces a decaying faculty and says so in the factors", () => {
    const target = curriculum.nodes.find((node) => node.kind === "knowledge");
    const progress = {
      ...emptyProgress,
      logs: [1, 2, 3].map((n) => ({
        id: `stale-${n}`,
        nodeId: target.id,
        exerciseId: target.exercises[0].id,
        xp: 60,
        at: new Date(now.getTime() - (40 + n * 4) * 864e5).toISOString(),
      })),
    };
    const candidates = rankCandidates(
      curriculum,
      buildLearnerModel(progress, now),
      DEFAULT_CONSTRAINTS,
      [],
      now,
    );
    const item = candidates.find((candidate) => candidate.nodeId === target.id);
    assert.ok(item, `${target.id} should still be a candidate`);
    const retention = item.factors.find((factor) => factor.key === "retention");
    assert.ok(retention.weight > 0, "decay should contribute positively to the score");
  });

  it("explains every selection with weighted factors", () => {
    for (const item of plan({ minutes: 60 }).items) {
      assert.ok(item.reason.trim().length > 0, `${item.nodeId} had no reason`);
      assert.ok(item.factors.length >= 3, `${item.nodeId} had too few factors`);
      for (const factor of item.factors) {
        assert.ok(factor.detail.trim().length > 0, `${factor.key} had no detail`);
        assert.equal(typeof factor.weight, "number");
      }
      // The score must actually be the sum of the factors shown, or the
      // explanation is decoration rather than a reason.
      const sum = item.factors.reduce((total, factor) => total + factor.weight, 0);
      assert.ok(Math.abs(sum - item.score) < 1e-9, `${item.nodeId} score does not match its factors`);
    }
  });

  it("respects a goal by ranking goal nodes above the rest", () => {
    const goal = {
      id: "g",
      label: "Decision quality",
      createdAt: now.toISOString(),
      nodeIds: ["dec-calibration", "log-probability", "dec-journal"],
      status: "active",
    };
    const session = plan({ minutes: 60, mode: "goal", goalId: "g" }, emptyProgress, [goal]);
    assert.ok(
      session.items.some((item) => goal.nodeIds.includes(item.nodeId)),
      "a goal-mode session should contain goal nodes",
    );
  });

  it("prefers harder work when the user says they have energy", () => {
    const tired = plan({ minutes: 45, energy: "low" });
    const sharp = plan({ minutes: 45, energy: "high", mode: "hard" });
    const mean = (session) =>
      session.items.reduce((sum, item) => sum + item.difficulty, 0) /
      Math.max(1, session.items.length);
    assert.ok(mean(sharp) >= mean(tired), "a hard session should not be easier than a tired one");
  });

  it("prefers evidence-producing tasks in evidence mode", () => {
    const evidence = plan({ minutes: 60, mode: "evidence" });
    const balanced = plan({ minutes: 60, mode: "balanced" });
    const share = (session) =>
      session.items.filter((item) => item.exercise.evidence !== "self-report").length /
      Math.max(1, session.items.length);
    assert.ok(share(evidence) >= share(balanced));
  });

  it("never plans an item that does not fit at all", () => {
    for (const item of plan({ minutes: 10 }).items) {
      assert.ok(item.minutes <= 15, `${item.exercise.id} needs ${item.minutes} minutes of a 10-minute budget`);
    }
  });

  it("says so plainly when nothing is available", () => {
    const session = plan({ minutes: 1 });
    assert.equal(session.items.length, 0);
    assert.match(session.rationale, /Nothing is available/);
  });
});

describe("cluster hulls", () => {
  it("keeps only the outer boundary of a point cloud", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 }, // interior — must be dropped
    ];
    assert.equal(convexHull(square).length, 4);
  });

  it("survives degenerate input", () => {
    assert.equal(convexHull([]).length, 0);
    assert.equal(convexHull([{ x: 1, y: 1 }]).length, 1);
    // Collinear points have no area; it must not hang or throw.
    assert.ok(
      convexHull([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]).length <= 3,
    );
  });

  it("expands a padded hull outward and yields a closed path", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const padded = paddedHull(points, 12);
    const xs = padded.map((p) => p.x);
    assert.ok(Math.min(...xs) < 0, "padding should push the boundary outward");

    const path = smoothClosedPath(padded);
    assert.match(path, /^M/, "path should start with a moveto");
    assert.match(path, /Z\s*$/i, "path should be explicitly closed");
  });
});

describe("curriculum data contract", () => {
  it("gives every faculty at least one exercise with positive XP", () => {
    for (const node of curriculum.nodes) {
      assert.ok(node.exercises.length > 0, `${node.id} has no exercises`);
      for (const exercise of node.exercises) {
        assert.ok(exercise.xp > 0, `${exercise.id} awards no XP`);
        assert.ok(
          ["daily", "weekly", "session"].includes(exercise.cadence),
          `${exercise.id} has cadence "${exercise.cadence}"`,
        );
      }
    }
  });

  it("parses the duration out of every task that states one", () => {
    // Guards the plural-minutes regression: these labels must not silently
    // fall back to an XP-derived guess.
    for (const node of curriculum.nodes) {
      for (const exercise of node.exercises) {
        const stated = exercise.label.match(/(\d+)\s*(?:-|–)?\s*(?:minutes?|mins?)\b/i);
        if (!stated) continue;
        assert.equal(
          estimateExerciseMinutes(exercise),
          Number(stated[1]),
          `"${exercise.label}" should report ${stated[1]} minutes`,
        );
      }
    }
  });
});
