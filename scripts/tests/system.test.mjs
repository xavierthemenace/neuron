import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROBES,
  buildProbeRun,
  estimationCredit,
  isMeaningfulDelta,
  minimumPourMoves,
  probeHistory,
  rng,
  scoreProbe,
} from "../../lib/diagnostics.ts";
import {
  GRAPH_INDEX,
  analyseGraph,
  directPrerequisites,
  downstreamOf,
  leverageScore,
  readyToBuild,
} from "../../lib/graph-intel.ts";
import { buildInbox, summariseInbox } from "../../lib/inbox.ts";
import {
  buildGoalPlan,
  expandWithPrerequisites,
  orderByPrerequisite,
  seedNodesForPhrase,
  suggestPaths,
} from "../../lib/goals.ts";
import { buildLearnerModel } from "../../lib/learner.ts";
import { capstones, curriculum, missions, paths } from "../../lib/curriculum.ts";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const DAY = 864e5;

function progressWith(overrides = {}) {
  return {
    version: 2,
    logs: [],
    diagnostics: [],
    predictions: [],
    missions: [],
    capstones: [],
    personalNodes: [],
    goals: [],
    experiments: [],
    dismissed: {},
    ...overrides,
  };
}

function logsFor(nodeId, exerciseId, count, { evidence = "self-report", spacingDays = 3, score } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${nodeId}-${index}`,
    nodeId,
    exerciseId,
    xp: 15,
    evidence,
    score,
    difficulty: 3,
    at: new Date(NOW.getTime() - (count - index) * spacingDays * DAY).toISOString(),
  }));
}

describe("diagnostics: probe generation", () => {
  it("generates every probe at every difficulty without throwing", () => {
    for (const probe of PROBES) {
      for (const difficulty of [1, 2, 3, 4, 5]) {
        const run = buildProbeRun(probe.id, difficulty, 12345);
        assert.ok(run, `${probe.id} failed to build at difficulty ${difficulty}`);
        assert.ok(run.items.length > 0, `${probe.id} produced no items`);
        for (const item of run.items) {
          assert.ok(item.prompt.trim().length > 0, `${probe.id} item has no prompt`);
          assert.ok(item.answer !== undefined, `${probe.id} item has no answer`);
          if (item.kind === "choice") {
            assert.ok(Array.isArray(item.options) && item.options.length >= 2);
            assert.ok(
              Number.isInteger(item.answer) && item.answer >= 0 && item.answer < item.options.length,
              `${probe.id} choice answer is out of range`,
            );
          }
        }
      }
    }
  });

  it("is deterministic for a given seed and different across seeds", () => {
    const a = buildProbeRun("probe-reasoning-series", 3, 7);
    const b = buildProbeRun("probe-reasoning-series", 3, 7);
    const c = buildProbeRun("probe-reasoning-series", 3, 8);
    assert.deepEqual(a.items.map((i) => i.prompt), b.items.map((i) => i.prompt));
    assert.notDeepEqual(a.items.map((i) => i.prompt), c.items.map((i) => i.prompt));
  });

  it("makes working-memory items longer as difficulty rises", () => {
    const easy = buildProbeRun("probe-wm-manipulation", 1, 99).items[0];
    const hard = buildProbeRun("probe-wm-manipulation", 5, 99).items[0];
    assert.ok(hard.stimulus.length > easy.stimulus.length);
  });

  it("carries a caveat on every probe so no score is presented bare", () => {
    for (const probe of PROBES) {
      assert.ok(probe.caveat.length > 40, `${probe.id} has no caveat`);
      assert.ok(probe.nodeIds.length > 0, `${probe.id} targets no nodes`);
      for (const id of probe.nodeIds) {
        assert.ok(
          curriculum.nodes.some((node) => node.id === id),
          `${probe.id} targets unknown node ${id}`,
        );
      }
    }
  });

  it("solves the jug-pouring items correctly", () => {
    // Classic 3/5 jug puzzle: four actions to leave exactly 4 litres.
    assert.equal(minimumPourMoves(3, 5, 4), 6);
    assert.equal(minimumPourMoves(3, 5, 3), 1);
    assert.equal(minimumPourMoves(3, 5, 5), 1);
  });

  it("produces a stable uniform stream from the PRNG", () => {
    const random = rng(42);
    const values = Array.from({ length: 1000 }, () => random());
    assert.ok(values.every((value) => value >= 0 && value < 1));
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    assert.ok(Math.abs(mean - 0.5) < 0.05, `mean drifted to ${mean}`);
    assert.deepEqual(rng(42)(), rng(42)());
  });
});

describe("diagnostics: scoring", () => {
  it("scores choice items exactly", () => {
    const run = buildProbeRun("probe-reasoning-series", 2, 5);
    const perfect = Object.fromEntries(run.items.map((item) => [item.id, String(item.answer)]));
    assert.equal(scoreProbe(run, perfect).score, 1);
    assert.equal(scoreProbe(run, {}).score, 0);
  });

  it("scores estimation on order of magnitude, not exactness", () => {
    assert.equal(estimationCredit(100, 100), 1);
    assert.ok(estimationCredit(200, 100) > 0.8, "a factor of two should score well");
    assert.ok(estimationCredit(1000, 100) < 0.6, "a factor of ten should not");
    assert.equal(estimationCredit(100000, 100), 0, "a factor of 1000 scores nothing");
    assert.equal(estimationCredit(-5, 100), 0);
    assert.equal(estimationCredit(0, 100), 0);
  });

  it("gives full credit for an interval that captures the truth", () => {
    const run = buildProbeRun("probe-calibration", 3, 3);
    const item = run.items[0];
    const truth = Number(item.answer);
    const wide = scoreProbe(run, { [item.id]: `${truth * 0.5}|${truth * 2}` });
    const missed = scoreProbe(run, { [item.id]: `${truth * 10}|${truth * 20}` });
    assert.equal(wide.perItem[0].credit, 1);
    assert.ok(missed.perItem[0].credit < 0.5);
  });

  it("scores recall items case- and space-insensitively", () => {
    const run = buildProbeRun("probe-wm-manipulation", 2, 11);
    const item = run.items[0];
    const result = scoreProbe(run, { [item.id]: ` ${String(item.answer)} ` });
    assert.equal(result.perItem[0].credit, 1);
  });
});

describe("diagnostics: comparison to your own history", () => {
  const result = (score, daysAgo, items = 10) => ({
    id: `d-${daysAgo}`,
    probeId: "probe-calibration",
    nodeIds: ["dec-calibration"],
    score,
    difficulty: 3,
    items,
    at: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
  });

  it("refuses to call a small change meaningful", () => {
    const history = probeHistory("probe-calibration", [result(0.6, 40), result(0.65, 1)], NOW);
    assert.equal(history.meaningful, false);
    assert.match(history.summary, /inside the noise/);
  });

  it("calls a large change meaningful", () => {
    const history = probeHistory("probe-calibration", [result(0.4, 40), result(0.85, 1)], NOW);
    assert.equal(history.meaningful, true);
    assert.match(history.summary, /noise floor/);
  });

  it("uses the standard error of a proportion for the noise floor", () => {
    // With 10 binary items, SE ≈ 0.158, so the 2-SE threshold is ≈ 0.32.
    assert.equal(isMeaningfulDelta(0.2, 10), false);
    assert.equal(isMeaningfulDelta(0.4, 10), true);
    // More items, a tighter threshold.
    assert.equal(isMeaningfulDelta(0.2, 100), true);
  });

  it("says a single run is a baseline, not a measurement", () => {
    const history = probeHistory("probe-calibration", [result(0.7, 1)], NOW);
    assert.equal(history.delta, null);
    assert.match(history.summary, /One run/);
  });
});

describe("graph intelligence", () => {
  it("builds a transitive downstream closure over gating edges only", () => {
    // log-probability gates epi-bayesian, which gates model uncertainty.
    const reach = downstreamOf("log-probability");
    assert.ok(reach.includes("epi-bayesian"));
    assert.ok(reach.includes("epi-model-uncertainty"), "closure should be transitive");
  });

  it("keeps supporting edges out of the ordering graph", () => {
    // "Supporting" means helps, not requires. Letting it order a plan would
    // invent obligations the curriculum never asserted.
    assert.ok(!directPrerequisites("epi-model-uncertainty").includes("epi-bayesian"));
    assert.ok(downstreamOf("epi-bayesian").includes("epi-model-uncertainty"));
  });

  it("does not treat synergy edges as prerequisites", () => {
    for (const link of curriculum.links) {
      const relation = link.relation ?? "synergy";
      if (relation !== "synergy" && relation !== "shared-mechanism") continue;
      const reach = GRAPH_INDEX.downstream.get(link.source) ?? [];
      assert.ok(
        !reach.includes(link.target) || curriculum.links.some(
          (other) =>
            other.source === link.source &&
            other.target === link.target &&
            (other.relation === "prerequisite" || other.relation === "enabling"),
        ),
        `${link.source} -> ${link.target} leaked into the gating graph`,
      );
    }
  });

  it("finds the bottleneck under work the user is actually doing", () => {
    // Train something downstream of a weak prerequisite and nothing else.
    const progress = progressWith({
      logs: logsFor("epi-bayesian", "epi-bayesian-1", 6),
    });
    const model = buildLearnerModel(progress, NOW);
    const findings = analyseGraph(model, new Set(["epi-bayesian"]));
    assert.ok(
      findings.some((finding) => finding.nodeIds.includes("log-probability")),
      "probabilistic thinking gates bayesian updating and should be flagged",
    );
  });

  it("attaches checkable numbers to every finding", () => {
    const progress = progressWith({ logs: logsFor("ling-writing", "ling-writing-1", 12) });
    const model = buildLearnerModel(progress, NOW);
    for (const finding of analyseGraph(model, new Set())) {
      assert.ok(finding.evidence.trim().length > 0, `${finding.kind} has no evidence line`);
      assert.ok(finding.headline.trim().length > 0);
      assert.ok(finding.priority > 0 && finding.priority <= 1);
    }
  });

  it("calls out practice with no evidence behind it", () => {
    const progress = progressWith({
      logs: logsFor("ling-writing", "ling-writing-1", 30, { evidence: "self-report", spacingDays: 1 }),
    });
    const model = buildLearnerModel(progress, NOW);
    const findings = analyseGraph(model, new Set());
    assert.ok(
      findings.some((finding) => finding.kind === "over-practised"),
      "30 self-reported reps with no scored evidence should be flagged",
    );
  });

  it("returns nothing at all for an empty history", () => {
    const model = buildLearnerModel(progressWith(), NOW);
    assert.equal(analyseGraph(model, new Set()).length, 0);
  });

  it("scores leverage higher for nodes with more downstream reach", () => {
    const many = leverageScore("log-probability", new Set());
    const none = leverageScore("epi-model-uncertainty", new Set());
    assert.ok(many > none);
  });

  it("finds nodes whose prerequisites are all in place", () => {
    const progress = progressWith({
      logs: [
        ...logsFor("log-probability", "log-probability-1", 8, { evidence: "scored", score: 0.9 }),
        ...logsFor("epi-evidence-eval", "epi-evidence-eval-1", 8, { evidence: "scored", score: 0.9 }),
      ],
    });
    const model = buildLearnerModel(progress, NOW);
    assert.ok(readyToBuild(model).includes("epi-bayesian"));
  });
});

describe("review inbox", () => {
  it("is empty for a user with no history", () => {
    const model = buildLearnerModel(progressWith(), NOW);
    const items = buildInbox(model, progressWith(), NOW);
    assert.equal(items.length, 0);
    assert.match(summariseInbox(items).headline, /Nothing needs attention/);
  });

  it("surfaces an overdue prediction above almost everything else", () => {
    const progress = progressWith({
      predictions: [
        {
          id: "p1",
          claim: "The thing will happen",
          probability: 0.7,
          createdAt: new Date(NOW.getTime() - 60 * DAY).toISOString(),
          resolveBy: new Date(NOW.getTime() - 20 * DAY).toISOString(),
          nodeIds: [],
        },
      ],
    });
    const items = buildInbox(buildLearnerModel(progress, NOW), progress, NOW);
    assert.equal(items[0].kind, "prediction-due");
    assert.equal(items[0].predictionId, "p1");
  });

  it("caps any single kind so one category cannot flood the queue", () => {
    // A user returning after a long absence: everything is decaying at once.
    const stale = curriculum.nodes
      .filter((node) => node.kind === "knowledge")
      .flatMap((node) => logsFor(node.id, node.exercises[0].id, 3, { spacingDays: 2 }))
      .map((log) => ({ ...log, at: new Date(NOW.getTime() - 60 * DAY).toISOString() }));
    const progress = progressWith({ logs: stale });
    const items = buildInbox(buildLearnerModel(progress, NOW), progress, NOW);
    const retention = items.filter((item) => item.kind === "retention");
    assert.ok(retention.length <= 6, `${retention.length} retention rows flooded the inbox`);
  });

  it("respects a dismissal until it expires", () => {
    const progress = progressWith({
      predictions: [
        {
          id: "p1",
          claim: "c",
          probability: 0.7,
          createdAt: new Date(NOW.getTime() - 60 * DAY).toISOString(),
          resolveBy: new Date(NOW.getTime() - 20 * DAY).toISOString(),
          nodeIds: [],
        },
      ],
      dismissed: { "prediction:p1": new Date(NOW.getTime() - 2 * DAY).toISOString() },
    });
    assert.equal(buildInbox(buildLearnerModel(progress, NOW), progress, NOW).length, 0);

    const expired = progressWith({
      ...progress,
      dismissed: { "prediction:p1": new Date(NOW.getTime() - 40 * DAY).toISOString() },
    });
    assert.ok(buildInbox(buildLearnerModel(expired, NOW), expired, NOW).length > 0);
  });

  it("nags about an unfinished mission", () => {
    const progress = progressWith({
      missions: [
        {
          id: "m1",
          missionId: "mission-controversial-claim",
          startedAt: new Date(NOW.getTime() - 30 * DAY).toISOString(),
          steps: { prior: "I think it is 60% likely" },
        },
      ],
    });
    const items = buildInbox(buildLearnerModel(progress, NOW), progress, NOW);
    assert.ok(items.some((item) => item.kind === "mission-open"));
  });

  it("gives every item a stable key and a real explanation", () => {
    const progress = progressWith({
      logs: logsFor("gc-spaced-repetition", "gc-spaced-repetition-1", 4).map((log) => ({
        ...log,
        at: new Date(NOW.getTime() - 45 * DAY).toISOString(),
      })),
    });
    const items = buildInbox(buildLearnerModel(progress, NOW), progress, NOW);
    const keys = items.map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length, "inbox keys must be unique");
    for (const item of items) {
      assert.ok(item.detail.length > 30, `${item.key} has no detail`);
      assert.ok(item.actionLabel.length > 0);
    }
  });
});

describe("goals", () => {
  it("routes a plain-language goal to a curated path", () => {
    assert.equal(suggestPaths("I want to make better decisions")[0].path.id, "path-decision-quality");
    assert.equal(suggestPaths("become a better writer")[0].path.id, "path-writing");
    assert.equal(suggestPaths("stop procrastinating")[0].path.id, "path-executive-function");
    assert.equal(suggestPaths("get better at maths")[0].path.id, "path-math-reasoning");
  });

  it("returns nothing rather than guessing when nothing matches", () => {
    assert.deepEqual(suggestPaths("zzzz qqqq"), []);
  });

  it("falls back to a node search when no path matches", () => {
    const seed = seedNodesForPhrase("improve my mental rotation and visualisation");
    assert.ok(seed.nodeIds.length > 0);
    assert.ok(seed.nodeIds.includes("spa-rotation") || seed.nodeIds.includes("spa-visualization"));
  });

  it("pulls in weak prerequisites but not strong ones", () => {
    const untrained = buildLearnerModel(progressWith(), NOW);
    const { added } = expandWithPrerequisites(["epi-bayesian"], untrained);
    assert.ok(added.has("log-probability"), "a weak prerequisite should be scheduled");

    const strong = buildLearnerModel(
      progressWith({
        logs: logsFor("log-probability", "log-probability-1", 10, { evidence: "scored", score: 0.95 }),
      }),
      NOW,
    );
    const second = expandWithPrerequisites(["epi-bayesian"], strong);
    assert.ok(!second.added.has("log-probability"), "a strong prerequisite should not be");
  });

  it("orders a plan so prerequisites come first", () => {
    const model = buildLearnerModel(progressWith(), NOW);
    const ordered = orderByPrerequisite(
      ["epi-experimental-design", "epi-bayesian", "log-probability", "epi-causal-inference"],
      model,
    );
    assert.ok(
      ordered.indexOf("log-probability") < ordered.indexOf("epi-bayesian"),
      `got ${ordered.join(" -> ")}`,
    );
    assert.ok(
      ordered.indexOf("epi-causal-inference") < ordered.indexOf("epi-experimental-design"),
      `got ${ordered.join(" -> ")}`,
    );
  });

  it("keeps every node when the ordering hits a cycle", () => {
    const model = buildLearnerModel(progressWith(), NOW);
    const input = ["ling-writing", "ling-reading", "ling-vocab-depth"];
    assert.equal(orderByPrerequisite(input, model).length, input.length);
  });

  it("builds a dated plan with a next action and a stated caveat", () => {
    const goal = {
      id: "g",
      label: "Think like a scientist",
      createdAt: NOW.toISOString(),
      nodeIds: [],
      pathId: "path-scientist",
      status: "active",
      weeklyMinutes: 120,
    };
    const plan = buildGoalPlan(goal, buildLearnerModel(progressWith(), NOW));
    assert.ok(plan.steps.length >= 9);
    assert.ok(plan.weeks > 1);
    assert.ok(plan.nextAction);
    assert.match(plan.caveat, /not a measured rate/);
    for (const step of plan.steps) {
      assert.ok(step.reason.length > 20, `${step.nodeId} has no reason`);
      assert.ok(step.week >= 1);
    }
  });

  it("reports progress as competence against the target, not as XP", () => {
    const goal = {
      id: "g",
      label: "Decisions",
      createdAt: NOW.toISOString(),
      nodeIds: ["dec-calibration"],
      status: "active",
    };
    const empty = buildGoalPlan(goal, buildLearnerModel(progressWith(), NOW));
    const trained = buildGoalPlan(
      goal,
      buildLearnerModel(
        progressWith({
          logs: logsFor("dec-calibration", "dec-calibration-1", 12, {
            evidence: "scored",
            score: 0.9,
          }),
        }),
        NOW,
      ),
    );
    assert.ok(trained.progress > empty.progress);
  });
});

describe("curriculum companion data", () => {
  it("keeps every path, mission and capstone pointing at real nodes", () => {
    const ids = new Set(curriculum.nodes.map((node) => node.id));
    for (const path of paths) {
      for (const id of path.nodeIds) assert.ok(ids.has(id), `${path.id} -> unknown ${id}`);
    }
    for (const mission of missions) {
      for (const id of mission.nodeIds) assert.ok(ids.has(id), `${mission.id} -> unknown ${id}`);
      assert.ok(mission.transferClaim.length > 40, `${mission.id} has no transfer claim`);
    }
    for (const capstone of capstones) {
      for (const id of capstone.nodeIds) assert.ok(ids.has(id), `${capstone.id} -> unknown ${id}`);
      assert.ok(capstone.rubric.length >= 3, `${capstone.id} has a thin rubric`);
    }
  });

  it("gives every node a defensible evidence block", () => {
    for (const node of curriculum.nodes) {
      assert.ok(node.kind, `${node.id} has no kind`);
      assert.ok(node.evidence, `${node.id} has no evidence`);
      assert.ok(
        node.evidence.knownLimitations.length > 40,
        `${node.id} has no real limitations stated`,
      );
      assert.ok(node.evidence.sources.length > 0, `${node.id} has no sources`);
      assert.ok(
        node.evidence.measurementMethod.length > 40,
        `${node.id} has no measurement method`,
      );
    }
  });

  it("never claims strong transfer evidence for a working-memory trainer", () => {
    // The single most over-claimed result in the field. If a future edit sets
    // this to "strong", this test is the thing that should stop it.
    const span = curriculum.nodes.find((node) => node.id === "gwm-span");
    assert.ok(["speculative", "emerging"].includes(span.evidence.transferEvidence));
    const matrices = curriculum.nodes.find((node) => node.id === "gf-pattern-abstraction");
    assert.ok(["speculative", "emerging"].includes(matrices.evidence.transferEvidence));
  });

  it("prices prerequisite edges above synergy edges", () => {
    const prereq = curriculum.links.filter((link) => link.relation === "prerequisite");
    const synergy = curriculum.links.filter((link) => link.relation === "synergy");
    const mean = (list) => list.reduce((sum, link) => sum + link.strength, 0) / list.length;
    assert.ok(mean(prereq) > mean(synergy));
  });

  it("draws at least one real trade-off", () => {
    const inhibition = curriculum.links.filter((link) => link.relation === "inhibition");
    assert.ok(inhibition.length > 0);
    for (const link of inhibition) {
      assert.ok(link.mechanism.length > 40, `${link.source}->${link.target} has no mechanism`);
      assert.equal(link.type, "inhibition");
    }
  });
});

describe("prerequisite graph shape", () => {
  it("has no cycles among gating edges", () => {
    // The validator enforces this at build time; this asserts the runtime index
    // agrees, because a cycle here would hang the closure or the goal planner.
    const seen = new Set();
    for (const node of curriculum.nodes) {
      const reach = downstreamOf(node.id);
      assert.ok(!reach.includes(node.id), `${node.id} reaches itself`);
      seen.add(node.id);
    }
    assert.equal(seen.size, curriculum.nodes.length);
  });

  it("gives foundational nodes no prerequisites", () => {
    const roots = curriculum.nodes.filter((node) => directPrerequisites(node.id).length === 0);
    assert.ok(roots.length > 5, "a graph with no roots cannot be entered");
  });
});
