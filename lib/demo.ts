import { PROBES } from "./diagnostics.ts";
import { curriculum, missions, nodesById } from "./curriculum.ts";
import { emptyProgress } from "./storage.ts";
import type {
  Difficulty,
  EvidenceKind,
  ExperimentRecord,
  LogEntry,
  Prediction,
  Progress,
} from "./types.ts";

/**
 * An example profile.
 *
 * Neuron's whole argument is that its numbers earn their meaning slowly. That
 * is also its worst first impression: on day one every panel correctly says
 * "nothing yet", and someone deciding whether this is worth six months of
 * honest logging has nothing to look at. This builds six months of plausible
 * history so the review queue, the comparison views, the calibration record
 * and the analytics all have something in them.
 *
 * It is generated, not recorded, and the app says so wherever it shows. The
 * shape is deliberately unflattering: two clusters trained properly, several
 * abandoned halfway, a holiday in the middle, a calibration record that is
 * mildly overconfident, and an experiment with too few observations to
 * conclude anything. A demo that showed a tidy upward march would be teaching
 * the wrong thing about what this app is for.
 */

const DAY = 86_400_000;
const WEEKS = 26;

/** Deterministic, so the same profile comes back every time. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface Focus {
  nodeId: string;
  /** Reps per week while it is being trained. */
  perWeek: number;
  /** Week the person stopped, or WEEKS if they never did. */
  stoppedAtWeek: number;
  /** 0-1 ability at week 0 and at the point they stopped. */
  from: number;
  to: number;
}

/**
 * Someone who reads, writes and argues for a living, went at epistemics hard
 * for a while, started executive-function work and dropped it, and has never
 * touched the musical or bodily clusters at all.
 */
const FOCUS: Focus[] = [
  { nodeId: "ling-reading", perWeek: 3, stoppedAtWeek: WEEKS, from: 0.42, to: 0.66 },
  { nodeId: "ling-writing", perWeek: 2, stoppedAtWeek: WEEKS, from: 0.38, to: 0.61 },
  { nodeId: "ling-vocab-depth", perWeek: 2, stoppedAtWeek: 19, from: 0.35, to: 0.52 },
  { nodeId: "epi-evidence-eval", perWeek: 2, stoppedAtWeek: WEEKS, from: 0.3, to: 0.58 },
  { nodeId: "epi-source-reliability", perWeek: 1, stoppedAtWeek: 21, from: 0.28, to: 0.47 },
  { nodeId: "epi-bayesian", perWeek: 1, stoppedAtWeek: WEEKS, from: 0.22, to: 0.44 },
  { nodeId: "dec-calibration", perWeek: 2, stoppedAtWeek: WEEKS, from: 0.25, to: 0.52 },
  { nodeId: "log-probability", perWeek: 1, stoppedAtWeek: 16, from: 0.3, to: 0.43 },
  { nodeId: "log-estimation", perWeek: 1, stoppedAtWeek: WEEKS, from: 0.24, to: 0.41 },
  { nodeId: "gc-retrieval-practice", perWeek: 2, stoppedAtWeek: 12, from: 0.3, to: 0.48 },
  { nodeId: "gc-spaced-repetition", perWeek: 3, stoppedAtWeek: 12, from: 0.33, to: 0.5 },
  // Started late and abandoned: this is what puts things in the review queue.
  { nodeId: "exec-planning", perWeek: 2, stoppedAtWeek: 17, from: 0.26, to: 0.4 },
  { nodeId: "gwm-span", perWeek: 1, stoppedAtWeek: 9, from: 0.2, to: 0.28 },
  { nodeId: "intra-metacognition", perWeek: 1, stoppedAtWeek: WEEKS, from: 0.3, to: 0.45 },
  { nodeId: "aug-decomposition", perWeek: 1, stoppedAtWeek: WEEKS, from: 0.35, to: 0.5 },
];

/** Two weeks off in the middle, because nobody trains 26 weeks straight. */
const HOLIDAY_START_WEEK = 13;
const HOLIDAY_WEEKS = 2;

function isHoliday(week: number): boolean {
  return week >= HOLIDAY_START_WEEK && week < HOLIDAY_START_WEEK + HOLIDAY_WEEKS;
}

function buildLogs(now: number, random: () => number): LogEntry[] {
  const logs: LogEntry[] = [];
  let serial = 0;

  for (const focus of FOCUS) {
    const node = nodesById.get(focus.nodeId);
    if (!node || node.exercises.length === 0) continue;

    for (let week = 0; week < focus.stoppedAtWeek; week += 1) {
      if (isHoliday(week)) continue;
      const progressThrough = week / Math.max(1, focus.stoppedAtWeek - 1);
      const ability = focus.from + (focus.to - focus.from) * progressThrough;

      for (let rep = 0; rep < focus.perWeek; rep += 1) {
        const exercise = node.exercises[(week + rep) % node.exercises.length];
        const weeksAgo = WEEKS - 1 - week;
        const at = new Date(
          now - weeksAgo * 7 * DAY - Math.floor(random() * 6) * DAY - Math.floor(random() * 10) * 3_600_000,
        ).toISOString();

        const evidence: EvidenceKind = exercise.evidence ?? "self-report";
        // Ability sets the centre; a single rep is noisy around it.
        const signal = Math.max(0.05, Math.min(0.98, ability + (random() - 0.5) * 0.22));
        const difficulty = Math.max(
          1,
          Math.min(5, Math.round(1 + ability * 4)),
        ) as Difficulty;

        const entry: LogEntry = {
          id: `demo-log-${serial++}`,
          nodeId: focus.nodeId,
          exerciseId: exercise.id,
          xp: exercise.xp,
          baseXp: exercise.xp,
          multiplier: 1,
          minutes: exercise.minutes ?? 15,
          source: "panel",
          difficulty,
          evidence,
          quality: Math.round(signal * 100) / 100,
          at,
        };
        if (evidence === "scored") entry.score = Math.round(signal * 100) / 100;
        if (evidence === "artifact") {
          // Distinct text per rep: the estimator treats a repeated artifact as
          // a self-report, and a demo built on duplicates would understate the
          // very thing it is demonstrating.
          entry.note = `Worked through ${exercise.label.toLowerCase()} in week ${week + 1}. Example data.`;
        }
        logs.push(entry);
      }
    }
  }

  return logs.sort((a, b) => a.at.localeCompare(b.at));
}

function buildDiagnostics(now: number) {
  const runs: { probeId: string; week: number; score: number }[] = [
    { probeId: "probe-reasoning-series", week: 2, score: 0.5 },
    { probeId: "probe-reasoning-series", week: 14, score: 0.58 },
    { probeId: "probe-reasoning-series", week: 24, score: 0.56 },
    { probeId: "probe-calibration", week: 5, score: 0.44 },
    { probeId: "probe-calibration", week: 22, score: 0.63 },
    { probeId: "probe-estimation", week: 11, score: 0.52 },
    { probeId: "probe-reading", week: 8, score: 0.61 },
  ];

  return runs.flatMap((run, index) => {
    const probe = PROBES.find((candidate) => candidate.id === run.probeId);
    if (!probe) return [];
    return [
      {
        id: `demo-diagnostic-${index}`,
        probeId: probe.id,
        nodeIds: probe.nodeIds,
        score: run.score,
        difficulty: 3 as Difficulty,
        items: 12,
        at: new Date(now - (WEEKS - 1 - run.week) * 7 * DAY).toISOString(),
      },
    ];
  });
}

/**
 * A calibration record that is mildly overconfident, which is the ordinary
 * result and the one worth showing. A demo that came out perfectly calibrated
 * would make the feature look decorative.
 */
const CLAIMS: { claim: string; probability: number; outcome: "yes" | "no" }[] = [
  { claim: "The redesign ships before the end of the month", probability: 0.8, outcome: "no" },
  { claim: "I finish the reading list I set myself this quarter", probability: 0.7, outcome: "no" },
  { claim: "The client says yes on the first call", probability: 0.6, outcome: "yes" },
  { claim: "This bug is in the parser, not the renderer", probability: 0.85, outcome: "yes" },
  { claim: "I train four days this week", probability: 0.75, outcome: "yes" },
  { claim: "The new approach is faster than the old one", probability: 0.65, outcome: "no" },
  { claim: "Rewriting this section takes under two hours", probability: 0.7, outcome: "no" },
  { claim: "The paper replicates in the larger sample", probability: 0.55, outcome: "no" },
  { claim: "I can explain this well enough to be corrected", probability: 0.9, outcome: "yes" },
  { claim: "The estimate I gave is within a factor of two", probability: 0.8, outcome: "yes" },
  { claim: "This week's plan survives to Wednesday", probability: 0.5, outcome: "no" },
  { claim: "The interview goes to a second round", probability: 0.6, outcome: "yes" },
  { claim: "I remember this deck at a week's delay", probability: 0.75, outcome: "yes" },
  { claim: "The argument holds once I write it down", probability: 0.7, outcome: "no" },
  { claim: "The cheaper option is good enough", probability: 0.65, outcome: "yes" },
  { claim: "I finish the mission I started", probability: 0.8, outcome: "no" },
  { claim: "The measurement moves after four weeks of this", probability: 0.45, outcome: "no" },
  { claim: "The source turns out to be a press release", probability: 0.35, outcome: "yes" },
  { claim: "My first read of the data is the one that survives", probability: 0.6, outcome: "no" },
  { claim: "This takes three sessions rather than one", probability: 0.7, outcome: "yes" },
  { claim: "The counterargument is one I had already considered", probability: 0.55, outcome: "yes" },
  { claim: "I stick with spaced repetition past a month", probability: 0.6, outcome: "no" },
  { claim: "The scored probe comes out above my last run", probability: 0.65, outcome: "yes" },
  { claim: "Writing it out changes my mind", probability: 0.4, outcome: "yes" },
];

const OPEN_CLAIMS: { claim: string; probability: number; dueInDays: number }[] = [
  { claim: "The rewrite is done before the end of next week", probability: 0.65, dueInDays: 9 },
  { claim: "I run the reasoning probe again this month", probability: 0.7, dueInDays: 21 },
  { claim: "Reading holds above 60% retention through the quarter", probability: 0.55, dueInDays: 44 },
  // Two already past their date, so the review queue has something real in it.
  { claim: "I finish the executive-function path I started", probability: 0.6, dueInDays: -12 },
  { claim: "The second experiment reaches ten observations", probability: 0.5, dueInDays: -4 },
];

function buildPredictions(now: number): Prediction[] {
  const resolved = CLAIMS.map((item, index) => {
    const createdAt = new Date(now - (WEEKS * 7 - index * 6) * DAY).toISOString();
    const resolveBy = new Date(now - (WEEKS * 7 - index * 6 - 14) * DAY).toISOString();
    return {
      id: `demo-prediction-${index}`,
      claim: item.claim,
      probability: item.probability,
      createdAt,
      resolveBy,
      resolvedAt: resolveBy,
      outcome: item.outcome,
      nodeIds: ["dec-calibration"],
    } satisfies Prediction;
  });

  const open = OPEN_CLAIMS.map((item, index) => ({
    id: `demo-prediction-open-${index}`,
    claim: item.claim,
    probability: item.probability,
    createdAt: new Date(now - 30 * DAY).toISOString(),
    resolveBy: new Date(now + item.dueInDays * DAY).toISOString(),
    nodeIds: ["dec-calibration"],
  })) satisfies Prediction[];

  return [...resolved, ...open];
}

function buildExperiments(now: number): ExperimentRecord[] {
  const concluded: ExperimentRecord = {
    id: "demo-experiment-1",
    hypothesis: "Spaced retrieval beats rereading for this material",
    intervention: "A: retrieval practice. B: rereading the same passage for the same time.",
    measure: "Score on a delayed test taken at least 24 hours later, 0-100",
    startedAt: new Date(now - 90 * DAY).toISOString(),
    endsAt: new Date(now - 30 * DAY).toISOString(),
    observations: [
      { at: new Date(now - 86 * DAY).toISOString(), arm: "a", value: 72 },
      { at: new Date(now - 83 * DAY).toISOString(), arm: "b", value: 61 },
      { at: new Date(now - 76 * DAY).toISOString(), arm: "a", value: 78 },
      { at: new Date(now - 72 * DAY).toISOString(), arm: "b", value: 58 },
      { at: new Date(now - 65 * DAY).toISOString(), arm: "a", value: 69 },
      { at: new Date(now - 61 * DAY).toISOString(), arm: "b", value: 66 },
      { at: new Date(now - 54 * DAY).toISOString(), arm: "a", value: 81 },
      { at: new Date(now - 48 * DAY).toISOString(), arm: "b", value: 63 },
      { at: new Date(now - 40 * DAY).toISOString(), arm: "a", value: 74 },
      { at: new Date(now - 34 * DAY).toISOString(), arm: "b", value: 59 },
    ],
    conclusion:
      "Retrieval came out ahead on nine of ten pairs, which is worth keeping. Ten observations on one person is a reason to carry on doing it, not a finding about anybody else.",
    status: "concluded",
  };

  // Deliberately underpowered, so the app gets to say so.
  const running: ExperimentRecord = {
    id: "demo-experiment-2",
    hypothesis: "Deep work goes better in the morning than the evening",
    intervention: "A: first block before 10:00. B: first block after 19:00.",
    measure: "Minutes of uninterrupted work before the first self-caught distraction",
    startedAt: new Date(now - 21 * DAY).toISOString(),
    observations: [
      { at: new Date(now - 18 * DAY).toISOString(), arm: "a", value: 42 },
      { at: new Date(now - 14 * DAY).toISOString(), arm: "b", value: 31 },
      { at: new Date(now - 9 * DAY).toISOString(), arm: "a", value: 27 },
    ],
    status: "running",
  };

  return [concluded, running];
}

export function buildDemoProgress(now = new Date()): Progress {
  const nowMs = now.getTime();
  const random = rng(20260911);
  const base = emptyProgress();

  const mission = missions[0];
  const stalled = missions[1];

  return {
    ...base,
    demo: true,
    curriculumVersion: curriculum.curriculumVersion,
    logs: buildLogs(nowMs, random),
    diagnostics: buildDiagnostics(nowMs),
    predictions: buildPredictions(nowMs),
    experiments: buildExperiments(nowMs),
    missions: mission
      ? [
          {
            id: "demo-mission-1",
            missionId: mission.id,
            startedAt: new Date(nowMs - 70 * DAY).toISOString(),
            completedAt: new Date(nowMs - 63 * DAY).toISOString(),
            quality: 0.7,
            reflection:
              "The numbers step was the one that actually changed my mind; the rest confirmed what I already thought, which is its own warning.",
            steps: Object.fromEntries(
              mission.steps.map((step) => [
                step.id,
                "Example data: written up at the time, kept short.",
              ]),
            ),
          },
          ...(stalled
            ? [
                {
                  id: "demo-mission-2",
                  missionId: stalled.id,
                  startedAt: new Date(nowMs - 26 * DAY).toISOString(),
                  steps: Object.fromEntries(
                    stalled.steps
                      .slice(0, 2)
                      .map((step) => [step.id, "Example data: started, not finished."]),
                  ),
                },
              ]
            : []),
        ]
      : [],
    goals: [
      {
        id: "demo-goal-1",
        label: "Read a paper and know what it does not show",
        nodeIds: [
          "epi-evidence-eval",
          "epi-source-reliability",
          "epi-bayesian",
          "log-probability",
        ],
        createdAt: new Date(nowMs - 150 * DAY).toISOString(),
        status: "active",
      },
      {
        id: "demo-goal-2",
        label: "Plan a week and have it survive contact",
        nodeIds: ["exec-planning", "exec-goal-maintenance", "lrn-prioritization"].filter((id) =>
          nodesById.has(id),
        ),
        createdAt: new Date(nowMs - 120 * DAY).toISOString(),
        status: "active",
      },
    ],
  };
}
