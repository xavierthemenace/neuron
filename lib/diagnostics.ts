import rawBank from "@/data/diagnostics.json";
import type { Difficulty, DiagnosticResult } from "./types.ts";

/**
 * Cognitive diagnostics.
 *
 * Deliberately not one monolithic IQ test. Each probe is short, targets one or
 * two nodes, and produces a number that is comparable *to your own previous
 * runs of the same probe* and to nothing else. There are no norms here and no
 * population percentiles, because producing either honestly would require a
 * standardisation sample Neuron does not have.
 *
 * Generated probes build their items from a seed so that the same difficulty
 * produces fresh items every run. Static item banks exist only where generation
 * cannot produce a defensible item — reading comprehension, source evaluation
 * and evidence interpretation all need real prose.
 */

export type ProbeItemKind =
  | "choice" // pick one option
  | "recall" // stimulus shown, then hidden, then reproduced
  | "numeric" // a number, scored on log-ratio error
  | "interval"; // a 90% confidence interval, scored on capture

export interface ProbeItem {
  id: string;
  kind: ProbeItemKind;
  prompt: string;
  options?: string[];
  /** Correct option index, exact string, or true numeric value. */
  answer: string | number;
  /** Shown then hidden, for recall items. */
  stimulus?: string;
  /** Milliseconds the stimulus stays visible. */
  exposureMs?: number;
  /** Shown after the run, never before. */
  explanation?: string;
}

export interface Probe {
  id: string;
  label: string;
  blurb: string;
  nodeIds: string[];
  /** Whether response time is part of the measurement. */
  timed: boolean;
  instructions: string;
  /** How this probe's score should and should not be read. */
  caveat: string;
  /** Days after which repeating the probe is informative again. */
  repeatAfterDays: number;
}

export interface ProbeRun extends Probe {
  difficulty: Difficulty;
  items: ProbeItem[];
  seed: number;
}

// ── Deterministic PRNG ────────────────────────────────────────────────────
/** mulberry32 — small, fast, and identical across runs for a given seed. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, list: T[]): T {
  return list[Math.floor(random() * list.length)];
}

function shuffle<T>(random: () => number, list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Probe catalogue ───────────────────────────────────────────────────────
export const PROBES: Probe[] = [
  {
    id: "probe-wm-manipulation",
    label: "Working memory manipulation",
    blurb: "Hold a sequence, then reorder it before reporting it.",
    nodeIds: ["gwm-span", "gwm-mental-manipulation", "gwm-updating"],
    timed: false,
    instructions:
      "A sequence appears briefly. When it disappears, type it back in the order the prompt asks for, with no spaces.",
    caveat:
      "Span scores improve with practice on the task itself. A rising score here is evidence that you are better at this probe, not that your working memory capacity grew.",
    repeatAfterDays: 21,
  },
  {
    id: "probe-reasoning-series",
    label: "Abstract reasoning",
    blurb: "Infer the rule generating a series and continue it.",
    nodeIds: ["gf-pattern-abstraction", "gf-inductive", "log-deduction"],
    timed: true,
    instructions: "Work out the rule behind each series and choose what comes next.",
    caveat:
      "Series items are the most practice-sensitive format in the whole battery. Treat improvement as strategy learning unless it holds after months away.",
    repeatAfterDays: 30,
  },
  {
    id: "probe-processing-speed",
    label: "Processing speed",
    blurb: "Simple matching decisions, as fast as you can keep them accurate.",
    nodeIds: ["gs-perceptual-speed", "gs-scanning", "gs-decision-speed"],
    timed: true,
    instructions:
      "Decide as quickly as you can without dropping accuracy. Both are recorded; speed alone is meaningless.",
    caveat:
      "Run this at a consistent time of day. Sleep, caffeine and time of day move this score more than months of training will.",
    repeatAfterDays: 14,
  },
  {
    id: "probe-estimation",
    label: "Fermi estimation",
    blurb: "Order-of-magnitude estimates against known true values.",
    nodeIds: ["log-estimation", "gc-quantitative-literacy"],
    timed: false,
    instructions:
      "Give your best estimate as a plain number. Scoring is on order of magnitude, so do not agonise over the leading digit.",
    caveat:
      "Partly a knowledge test: you estimate well in domains whose anchor quantities you already hold.",
    repeatAfterDays: 21,
  },
  {
    id: "probe-calibration",
    label: "Interval calibration",
    blurb: "90% confidence intervals on quantities you do not know.",
    nodeIds: ["dec-calibration", "log-probability", "eqa-bias-awareness"],
    timed: false,
    instructions:
      "Give a lower and upper bound you are 90% sure contain the true value. Wide is allowed. Being right about nine of ten is the target.",
    caveat:
      "Ten items is a small sample. A single run tells you your direction of error, not its size.",
    repeatAfterDays: 14,
  },
  {
    id: "probe-retrieval",
    label: "Paired-associate retrieval",
    blurb: "Study pairs, survive interference, then recall.",
    nodeIds: ["gc-retrieval-practice", "gwm-chunking", "gc-spaced-repetition"],
    timed: false,
    instructions:
      "Study the pairs, work through a short distraction, then recall the partner of each cue.",
    caveat:
      "Measures encoding and short-delay retrieval of arbitrary material. It says little about how you learn material that actually means something to you.",
    repeatAfterDays: 21,
  },
  {
    id: "probe-planning",
    label: "Planning & sequencing",
    blurb: "Find the minimum number of moves before making any.",
    nodeIds: ["exec-planning", "gf-novel-problem", "aug-decomposition"],
    timed: false,
    instructions:
      "Work out the shortest solution before answering. The score is for the plan, not for a solution found by trial and error.",
    caveat:
      "Laboratory planning tasks predict everyday planning poorly. This tracks one narrow, well-defined skill.",
    repeatAfterDays: 30,
  },
  {
    id: "probe-spatial",
    label: "Mental rotation",
    blurb: "Decide whether two shapes are the same object rotated.",
    nodeIds: ["spa-rotation", "spa-visualization"],
    timed: true,
    instructions:
      "Decide whether the second shape is the first one rotated, or its mirror image.",
    caveat:
      "This one does respond to training and the gains are durable — but they are gains at spatial tasks, not at reasoning in general.",
    repeatAfterDays: 30,
  },
  {
    id: "probe-reading",
    label: "Reading comprehension",
    blurb: "Claim, assumption and falsifier from a short passage.",
    nodeIds: ["ling-reading", "epi-evidence-eval"],
    timed: false,
    instructions: "Read each passage once, then answer without scrolling back.",
    caveat:
      "Comprehension is knowledge-bound. Scores vary with how familiar the passage's domain is to you.",
    repeatAfterDays: 30,
  },
  {
    id: "probe-source",
    label: "Source evaluation",
    blurb: "Decide what to do next when a source is unfamiliar.",
    nodeIds: ["epi-source-reliability", "aug-search"],
    timed: false,
    instructions: "For each scenario, choose the action that would most improve your judgement.",
    caveat:
      "Recognising the right move on a written scenario is easier than making it under time pressure on a real page.",
    repeatAfterDays: 45,
  },
  {
    id: "probe-evidence",
    label: "Evidence interpretation",
    blurb: "How much should a given study move you?",
    nodeIds: ["epi-evidence-eval", "epi-causal-inference", "gc-quantitative-literacy"],
    timed: false,
    instructions:
      "Each item describes a finding. Choose the reading that the described evidence actually supports.",
    caveat:
      "People evaluate evidence more rigorously when they dislike the conclusion. Neutral items understate that effect.",
    repeatAfterDays: 45,
  },
];

export const PROBES_BY_ID = new Map(PROBES.map((probe) => [probe.id, probe]));

// ── Static item banks ─────────────────────────────────────────────────────
interface BankProbe {
  id: string;
  items: ProbeItem[];
}
const BANK = rawBank as { probes: BankProbe[] };
const BANK_BY_ID = new Map(BANK.probes.map((probe) => [probe.id, probe.items]));

// ── Generators ────────────────────────────────────────────────────────────
const LETTERS = "BCDFGHJKLMNPQRSTVWXZ".split("");

function generateWorkingMemory(random: () => number, difficulty: Difficulty): ProbeItem[] {
  // Span grows with difficulty; the transformation gets harder too.
  const length = 3 + difficulty;
  const transforms = [
    { key: "reverse", prompt: "in reverse order" },
    { key: "sorted", prompt: "sorted from smallest to largest" },
    { key: "evens", prompt: "keeping only the even digits, in the original order" },
  ] as const;
  const available = transforms.slice(0, Math.min(transforms.length, 1 + Math.floor(difficulty / 2)));

  return Array.from({ length: 5 }, (_, index) => {
    const digits = Array.from({ length }, () => Math.floor(random() * 10));
    const transform = pick(random, [...available]);
    let answer: string;
    if (transform.key === "reverse") answer = [...digits].reverse().join("");
    else if (transform.key === "sorted") answer = [...digits].sort((a, b) => a - b).join("");
    else answer = digits.filter((digit) => digit % 2 === 0).join("");

    return {
      id: `wm-${index}`,
      kind: "recall" as const,
      prompt: `Type the sequence back ${transform.prompt}.`,
      stimulus: digits.join(" "),
      exposureMs: Math.max(1200, 900 + length * 350 - difficulty * 100),
      answer,
      explanation: `The sequence was ${digits.join(" ")}.`,
    };
  });
}

function generateSeries(random: () => number, difficulty: Difficulty): ProbeItem[] {
  return Array.from({ length: 6 }, (_, index) => {
    const style = Math.floor(random() * Math.min(4, 1 + difficulty));
    const start = 2 + Math.floor(random() * 9);
    const step = 2 + Math.floor(random() * (2 + difficulty));
    let series: number[];
    let next: number;
    let rule: string;

    if (style === 0) {
      series = Array.from({ length: 5 }, (_, i) => start + step * i);
      next = start + step * 5;
      rule = `add ${step} each time`;
    } else if (style === 1) {
      const ratio = 2 + Math.floor(random() * 2);
      series = Array.from({ length: 5 }, (_, i) => start * Math.pow(ratio, i));
      next = start * Math.pow(ratio, 5);
      rule = `multiply by ${ratio} each time`;
    } else if (style === 2) {
      // Second differences are constant.
      series = [start];
      let delta = step;
      for (let i = 1; i < 5; i += 1) {
        series.push(series[i - 1] + delta);
        delta += step;
      }
      next = series[4] + delta;
      rule = `the gaps themselves grow by ${step}`;
    } else {
      // Alternating operations.
      series = [start];
      for (let i = 1; i < 5; i += 1) {
        series.push(i % 2 === 1 ? series[i - 1] + step : series[i - 1] * 2);
      }
      next = series[4] + step;
      rule = `alternately add ${step} and double`;
    }

    const distractors = new Set<number>();
    while (distractors.size < 3) {
      const offset = Math.max(1, Math.round(next * (random() * 0.4 - 0.2)));
      const candidate = next + (random() < 0.5 ? offset : -offset);
      if (candidate !== next && candidate > 0) distractors.add(candidate);
    }
    const options = shuffle(random, [next, ...distractors]).map(String);

    return {
      id: `series-${index}`,
      kind: "choice" as const,
      prompt: `${series.join(", ")}, ?`,
      options,
      answer: options.indexOf(String(next)),
      explanation: `The rule is: ${rule}. The next term is ${next}.`,
    };
  });
}

function generateProcessingSpeed(random: () => number, difficulty: Difficulty): ProbeItem[] {
  const width = 3 + difficulty;
  return Array.from({ length: 12 }, (_, index) => {
    const left = Array.from({ length: width }, () => pick(random, LETTERS)).join("");
    const same = random() < 0.5;
    let right = left;
    if (!same) {
      const position = Math.floor(random() * width);
      const replacement = pick(
        random,
        LETTERS.filter((letter) => letter !== left[position]),
      );
      right = left.slice(0, position) + replacement + left.slice(position + 1);
    }
    const options = ["Same", "Different"];
    return {
      id: `speed-${index}`,
      kind: "choice" as const,
      prompt: `${left}   ·   ${right}`,
      options,
      answer: same ? 0 : 1,
    };
  });
}

function generateRetrieval(random: () => number, difficulty: Difficulty): ProbeItem[] {
  const pairs = 4 + difficulty;
  const cues = shuffle(random, LETTERS).slice(0, pairs);
  const targets = cues.map(() => String(100 + Math.floor(random() * 900)));
  const study = cues.map((cue, index) => `${cue} → ${targets[index]}`).join("    ");

  return cues.map((cue, index) => ({
    id: `pa-${index}`,
    kind: "recall" as const,
    prompt: `What number was paired with ${cue}?`,
    // The full study list is the stimulus for the first item only; the runner
    // shows it once, then the cues are tested without it.
    stimulus: index === 0 ? study : undefined,
    exposureMs: index === 0 ? 3000 + pairs * 900 : undefined,
    answer: targets[index],
    explanation: `${cue} was paired with ${targets[index]}.`,
  }));
}

function generatePlanning(random: () => number, difficulty: Difficulty): ProbeItem[] {
  return Array.from({ length: 5 }, (_, index) => {
    // Jug-pouring: reachable targets are multiples of gcd(a, b).
    const a = 3 + Math.floor(random() * (2 + difficulty));
    const b = a + 1 + Math.floor(random() * (2 + difficulty));
    const target = 1 + Math.floor(random() * (b - 1));
    const moves = minimumPourMoves(a, b, target);
    const distractors = new Set<number>();
    while (distractors.size < 3) {
      const candidate = moves + 1 + Math.floor(random() * 4) * (random() < 0.5 ? 1 : -1);
      if (candidate > 0 && candidate !== moves) distractors.add(candidate);
    }
    const options = shuffle(random, [moves, ...distractors]).map(String);
    return {
      id: `plan-${index}`,
      kind: "choice" as const,
      prompt: `You have a ${a}-litre jug and a ${b}-litre jug, both empty, and an unlimited water supply. What is the smallest number of fill, empty or pour actions needed to leave exactly ${target} litres in one of them?`,
      options,
      answer: options.indexOf(String(moves)),
      explanation: `A breadth-first search over jug states reaches ${target} litres in ${moves} actions.`,
    };
  }).filter((item) => item.answer >= 0);
}

/** Breadth-first search over water-jug states. Exact, so the item is fair. */
export function minimumPourMoves(a: number, b: number, target: number): number {
  const start = "0,0";
  const queue: [number, number, number][] = [[0, 0, 0]];
  const seen = new Set([start]);
  while (queue.length > 0) {
    const [x, y, depth] = queue.shift()!;
    if (x === target || y === target) return depth;
    const next: [number, number][] = [
      [a, y],
      [x, b],
      [0, y],
      [x, 0],
      [Math.max(0, x - (b - y)), Math.min(b, y + x)],
      [Math.min(a, x + y), Math.max(0, y - (a - x))],
    ];
    for (const [nx, ny] of next) {
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nx, ny, depth + 1]);
    }
  }
  return -1;
}

/**
 * Mental rotation over a fixed polyomino alphabet. The runner renders these as
 * SVG grids; the item only needs the cell coordinates and the verdict.
 */
export interface RotationStimulus {
  cells: [number, number][];
  rotatedCells: [number, number][];
  mirrored: boolean;
}

const SHAPES: [number, number][][] = [
  [[0, 0], [1, 0], [2, 0], [2, 1]], // J
  [[0, 0], [0, 1], [1, 1], [2, 1]], // L
  [[0, 0], [1, 0], [1, 1], [2, 1]], // S
  [[0, 1], [1, 1], [1, 0], [2, 0]], // Z
  [[0, 0], [1, 0], [2, 0], [1, 1]], // T
  [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1]], // P
];

function rotate(cells: [number, number][], quarterTurns: number): [number, number][] {
  let out = cells;
  for (let turn = 0; turn < quarterTurns; turn += 1) {
    out = out.map(([x, y]) => [y, -x] as [number, number]);
  }
  const minX = Math.min(...out.map(([x]) => x));
  const minY = Math.min(...out.map(([, y]) => y));
  return out.map(([x, y]) => [x - minX, y - minY] as [number, number]);
}

function mirror(cells: [number, number][]): [number, number][] {
  const maxX = Math.max(...cells.map(([x]) => x));
  return cells.map(([x, y]) => [maxX - x, y] as [number, number]);
}

function generateRotation(random: () => number, difficulty: Difficulty): ProbeItem[] {
  return Array.from({ length: 8 }, (_, index) => {
    const shape = pick(random, SHAPES);
    const turns = 1 + Math.floor(random() * Math.min(3, difficulty));
    const isMirrored = random() < 0.5;
    const transformed = rotate(isMirrored ? mirror(shape) : shape, turns);
    const stimulus: RotationStimulus = {
      cells: shape,
      rotatedCells: transformed,
      mirrored: isMirrored,
    };
    const options = ["Same shape, rotated", "Mirror image"];
    return {
      id: `rot-${index}`,
      kind: "choice" as const,
      prompt: "Is the second shape the first one rotated, or its mirror image?",
      stimulus: JSON.stringify(stimulus),
      options,
      answer: isMirrored ? 1 : 0,
      explanation: isMirrored
        ? "It was flipped before being rotated, so no rotation in the plane can produce it."
        : `It was rotated by ${turns * 90} degrees.`,
    };
  });
}

/** Draws `count` items from a static bank, rotating by seed so runs differ. */
function fromBank(probeId: string, random: () => number, count: number): ProbeItem[] {
  const items = BANK_BY_ID.get(probeId) ?? [];
  return shuffle(random, items).slice(0, Math.min(count, items.length));
}

export function buildProbeRun(
  probeId: string,
  difficulty: Difficulty = 3,
  seed = Date.now(),
): ProbeRun | null {
  const probe = PROBES_BY_ID.get(probeId);
  if (!probe) return null;
  const random = rng(seed);

  let items: ProbeItem[];
  switch (probeId) {
    case "probe-wm-manipulation":
      items = generateWorkingMemory(random, difficulty);
      break;
    case "probe-reasoning-series":
      items = generateSeries(random, difficulty);
      break;
    case "probe-processing-speed":
      items = generateProcessingSpeed(random, difficulty);
      break;
    case "probe-retrieval":
      items = generateRetrieval(random, difficulty);
      break;
    case "probe-planning":
      items = generatePlanning(random, difficulty);
      break;
    case "probe-spatial":
      items = generateRotation(random, difficulty);
      break;
    default:
      items = fromBank(probeId, random, probeId === "probe-calibration" ? 10 : 6);
      break;
  }

  return { ...probe, difficulty, items, seed };
}

// ── Scoring ───────────────────────────────────────────────────────────────
export interface ItemScore {
  itemId: string;
  correct: boolean;
  /** 0-1 partial credit, where the item type supports it. */
  credit: number;
  given: string;
  expected: string;
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/[\s,]+/g, "");
}

/** Log-ratio accuracy: within a factor of 2 is good, a factor of 10 is not. */
export function estimationCredit(given: number, truth: number): number {
  if (!(given > 0) || !(truth > 0)) return 0;
  const magnitudes = Math.abs(Math.log10(given / truth));
  return Math.max(0, 1 - magnitudes / 2);
}

export function scoreProbe(
  run: ProbeRun,
  answers: Record<string, string>,
): { score: number; perItem: ItemScore[] } {
  const perItem: ItemScore[] = run.items.map((item) => {
    const given = answers[item.id] ?? "";
    let credit = 0;
    let expected = String(item.answer);

    if (item.kind === "choice") {
      // `Number("")` is 0, so a blank answer used to score as if the first
      // option had been chosen — silently inflating every abandoned run.
      const index = given.trim() === "" ? Number.NaN : Number(given);
      credit = Number.isInteger(index) && index === item.answer ? 1 : 0;
      expected = item.options?.[Number(item.answer)] ?? expected;
    } else if (item.kind === "numeric") {
      credit = estimationCredit(Number(given), Number(item.answer));
    } else if (item.kind === "interval") {
      // "lower|upper" — captured or not. Partial credit for a near miss keeps
      // a single wild item from swamping a ten-item run.
      const [lower, upper] = given.split("|").map(Number);
      const truth = Number(item.answer);
      if (Number.isFinite(lower) && Number.isFinite(upper) && lower <= truth && truth <= upper) {
        credit = 1;
      } else if (Number.isFinite(lower) && Number.isFinite(upper)) {
        const nearest = truth < lower ? lower : upper;
        credit = Math.max(0, estimationCredit(nearest, truth) * 0.5);
      }
    } else {
      credit = normalise(given) === normalise(String(item.answer)) ? 1 : 0;
    }

    return {
      itemId: item.id,
      correct: credit >= 0.999,
      credit,
      given,
      expected,
    };
  });

  const score =
    perItem.length === 0
      ? 0
      : perItem.reduce((sum, item) => sum + item.credit, 0) / perItem.length;
  return { score, perItem };
}

// ── Comparison to your own history ────────────────────────────────────────
export interface ProbeHistory {
  probeId: string;
  results: DiagnosticResult[];
  latest: DiagnosticResult | null;
  previous: DiagnosticResult | null;
  /** Change against the previous run at comparable difficulty, or null. */
  delta: number | null;
  /** Whether the change is large enough to mean anything at this item count. */
  meaningful: boolean;
  dueAt: string | null;
  summary: string;
}

/**
 * Whether a score change is worth mentioning.
 *
 * With ten binary items the standard error of a proportion near 0.5 is about
 * 0.16, so anything under roughly a third of a scale is noise. Saying so is the
 * difference between a measurement system and a dashboard.
 */
export function isMeaningfulDelta(delta: number, items: number): boolean {
  const standardError = Math.sqrt(0.25 / Math.max(1, items));
  return Math.abs(delta) >= 2 * standardError;
}

export function probeHistory(
  probeId: string,
  diagnostics: DiagnosticResult[],
  now = new Date(),
): ProbeHistory {
  const probe = PROBES_BY_ID.get(probeId);
  const results = diagnostics
    .filter((result) => result.probeId === probeId)
    .sort((a, b) => a.at.localeCompare(b.at));
  const latest = results[results.length - 1] ?? null;
  const previous =
    [...results]
      .slice(0, -1)
      .reverse()
      .find((result) => !latest || result.difficulty === latest.difficulty) ?? null;

  const delta = latest && previous ? latest.score - previous.score : null;
  const meaningful =
    delta !== null && latest ? isMeaningfulDelta(delta, Math.min(latest.items, previous?.items ?? latest.items)) : false;

  let dueAt: string | null = null;
  if (latest && probe) {
    dueAt = new Date(
      new Date(latest.at).getTime() + probe.repeatAfterDays * 864e5,
    ).toISOString();
  }

  let summary: string;
  if (!latest) {
    summary = "Never run. A first result becomes the baseline everything else is compared against.";
  } else if (delta === null) {
    summary = `One run on record (${Math.round(latest.score * 100)}%). A second run at the same difficulty is what makes it a measurement.`;
  } else if (!meaningful) {
    summary = `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)} points since the previous run, which is inside the noise for ${latest.items} items. No change worth reading into.`;
  } else {
    summary = `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)} points since the previous run at the same difficulty — larger than this probe's noise floor.`;
  }

  const overdue = dueAt !== null && new Date(dueAt).getTime() <= now.getTime();
  if (overdue) summary += " Due to be repeated.";

  return { probeId, results, latest, previous, delta, meaningful, dueAt, summary };
}

/** Probes that touch a node, for the panel's diagnostics section. */
export function probesForNode(nodeId: string): Probe[] {
  return PROBES.filter((probe) => probe.nodeIds.includes(nodeId));
}
