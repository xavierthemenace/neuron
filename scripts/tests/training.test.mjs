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
import { generateDailyWorkout } from "../../lib/workout.ts";
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

describe("generateDailyWorkout", () => {
  const now = new Date("2026-06-01T09:00:00.000Z");
  const emptyDecay = {};
  const noLogs = {};

  it("returns three items from the real curriculum", () => {
    const workout = generateDailyWorkout(curriculum, {}, emptyDecay, noLogs, now);
    assert.equal(workout.length, 3);
  });

  it("never repeats a faculty within one routine", () => {
    const workout = generateDailyWorkout(curriculum, {}, emptyDecay, noLogs, now);
    const ids = workout.map((item) => item.nodeId);
    assert.equal(new Set(ids).size, ids.length, `duplicate faculty in ${ids}`);
  });

  it("cross-trains across categories rather than drilling one", () => {
    const workout = generateDailyWorkout(curriculum, {}, emptyDecay, noLogs, now);
    const categories = workout.map((item) => item.categoryId);
    assert.equal(new Set(categories).size, categories.length, `same category twice: ${categories}`);
  });

  it("is stable for a given day so the routine does not reshuffle on reload", () => {
    const a = generateDailyWorkout(curriculum, {}, emptyDecay, noLogs, now);
    const b = generateDailyWorkout(curriculum, {}, emptyDecay, noLogs, now);
    assert.deepEqual(
      a.map((i) => i.exercise.id),
      b.map((i) => i.exercise.id),
    );
  });

  it("excludes exercises still inside their reset window", () => {
    const first = generateDailyWorkout(curriculum, {}, emptyDecay, noLogs, now);
    const blocked = first[0];
    const node = curriculum.nodes.find((n) => n.id === blocked.nodeId);

    // Log every exercise on that faculty today so none of them can be offered.
    const logs = {
      [blocked.nodeId]: node.exercises.map((exercise, index) => ({
        id: `blocked-${index}`,
        nodeId: blocked.nodeId,
        exerciseId: exercise.id,
        xp: exercise.xp,
        at: now.toISOString(),
      })),
    };

    const next = generateDailyWorkout(curriculum, {}, emptyDecay, logs, now);
    assert.ok(
      !next.some((item) => item.nodeId === blocked.nodeId),
      `${blocked.nodeId} was offered again while on cooldown`,
    );
    assert.equal(next.length, 3, "the routine should backfill to three items");
  });

  it("prioritises a decaying faculty and says why", () => {
    const target = curriculum.nodes[0];
    const decayed = {
      [target.id]: decayStateForLogs(
        [
          {
            id: "stale",
            nodeId: target.id,
            exerciseId: target.exercises[0].id,
            xp: 400,
            at: new Date(now.getTime() - 200 * 864e5).toISOString(),
          },
        ],
        now,
      ),
    };
    const workout = generateDailyWorkout(curriculum, { [target.id]: 400 }, decayed, noLogs, now);
    const item = workout.find((entry) => entry.nodeId === target.id);
    assert.ok(item, `${target.id} should be surfaced while its retention is decaying`);
    assert.match(item.reason, /retention/i);
  });

  it("always explains its choice", () => {
    for (const item of generateDailyWorkout(curriculum, {}, emptyDecay, noLogs, now)) {
      assert.ok(item.reason.trim().length > 0, `${item.nodeId} had no reason`);
      assert.ok(item.exercise?.id, `${item.nodeId} had no exercise`);
    }
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
