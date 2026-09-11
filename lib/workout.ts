import { adaptiveStateFor, difficultyXpFactor, isSaturated, type AdaptiveState } from "./difficulty.ts";
import { categoriesById, pathsById } from "./curriculum.ts";
import { leverageScore } from "./graph-intel.ts";
import type { LearnerModel } from "./learner.ts";
import { estimateExerciseMinutes, exerciseResetState } from "./mastery.ts";
import { retentionRisk } from "./retention.ts";
import { synergyMultiplierForNode } from "./training.ts";
import type { ConceptNode, Difficulty, Exercise, Goal, IntelligenceData } from "./types.ts";

/**
 * The curriculum engine.
 *
 * This is not "pick three exercises". It is a constrained selection problem:
 * fit the best available training into the time and energy the user actually
 * has, without repeating a faculty, without drifting into one cluster, and
 * without recommending something that is about to be forgotten in favour of
 * something that was already fresh.
 *
 * Every item carries the full list of factors that selected it, with weights,
 * so the "Why this?" answer is generated from the same numbers that made the
 * decision rather than written separately and hoped to stay in sync.
 */

export type Energy = "low" | "normal" | "high";
export type SessionMode = "balanced" | "review" | "hard" | "goal" | "evidence";

export interface SessionConstraints {
  /** Time budget in minutes. */
  minutes: number;
  energy: Energy;
  mode: SessionMode;
  goalId?: string;
  pathId?: string;
  /** Nodes the user has explicitly excluded from this session. */
  excludeNodeIds?: string[];
}

export const DEFAULT_CONSTRAINTS: SessionConstraints = {
  minutes: 25,
  energy: "normal",
  mode: "balanced",
};

export interface RankingFactor {
  key: string;
  label: string;
  /** Signed contribution to the item's score. */
  weight: number;
  detail: string;
}

export interface WorkoutItem {
  nodeId: string;
  nodeLabel: string;
  categoryId: string;
  categoryLabel: string;
  exercise: Exercise;
  adaptive: AdaptiveState;
  /** Difficulty this session should be attempted at. */
  difficulty: Difficulty;
  minutes: number;
  /** XP this rep would award, after synergy and difficulty adjustment. */
  xp: number;
  multiplier: number;
  score: number;
  factors: RankingFactor[];
  reason: string;
}

export interface WorkoutPlan {
  items: WorkoutItem[];
  totalMinutes: number;
  constraints: SessionConstraints;
  /** One paragraph explaining the shape of the session as a whole. */
  rationale: string;
  /** Ranked-but-unselected items, for "show me something else". */
  alternates: WorkoutItem[];
}

/** Difficulty the user should be pushed toward, given how they feel. */
function energyTarget(energy: Energy): { target: number; label: string } {
  if (energy === "low") {
    return {
      target: 2,
      label: "low energy, so this session favours consolidation over new difficulty",
    };
  }
  if (energy === "high") {
    return { target: 4, label: "high energy, so this session reaches for difficulty" };
  }
  return { target: 3, label: "normal energy" };
}

function stableNoise(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function daysSince(iso: string | null, now: Date): number {
  if (!iso) return Infinity;
  return (now.getTime() - new Date(iso).getTime()) / 864e5;
}

/**
 * Candidate generation and scoring.
 *
 * Exported separately from planning so the ranking can be tested — and shown
 * in Research Mode — without also running the packing step.
 */
export function rankCandidates(
  data: IntelligenceData,
  model: LearnerModel,
  constraints: SessionConstraints,
  goals: Goal[],
  now = new Date(),
): WorkoutItem[] {
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const goalNodeIds = new Set<string>();
  for (const goal of activeGoals) {
    if (constraints.goalId && goal.id !== constraints.goalId) continue;
    for (const id of goal.nodeIds) goalNodeIds.add(id);
  }
  const path = constraints.pathId ? pathsById.get(constraints.pathId) : undefined;
  if (path) for (const id of path.nodeIds) goalNodeIds.add(id);

  const excluded = new Set(constraints.excludeNodeIds ?? []);
  const { target: difficultyTarget } = energyTarget(constraints.energy);
  const daySeed = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

  // Recent workload, so a session does not pile onto whatever was trained
  // yesterday. Counted per category as well as per node.
  const categoryLoad = new Map<string, number>();
  for (const log of Object.values(model.logsByNodeId).flat()) {
    const age = daysSince(log.at, now);
    if (age > 7) continue;
    const node = model.nodes.find((item) => item.id === log.nodeId);
    if (!node) continue;
    categoryLoad.set(
      node.categoryId,
      (categoryLoad.get(node.categoryId) ?? 0) + Math.max(0, 1 - age / 7),
    );
  }
  const maxCategoryLoad = Math.max(1, ...categoryLoad.values());

  const candidates: WorkoutItem[] = [];

  for (const node of model.nodes as ConceptNode[]) {
    if (excluded.has(node.id)) continue;
    const estimate = model.estimates[node.id];
    const retention = model.retentionByNodeId[node.id];
    const logs = model.logsByNodeId[node.id] ?? [];
    const category = categoriesById.get(node.categoryId);
    const multiplier = synergyMultiplierForNode(data, node.id, model.xpByNodeId);

    for (const exercise of node.exercises) {
      const reset = exerciseResetState(logs, exercise.id, exercise.cadence, now);
      if (!reset.available) continue;

      const adaptive = adaptiveStateFor(exercise, logs, now);
      const minutes = exercise.minutes ?? estimateExerciseMinutes(exercise);
      const factors: RankingFactor[] = [];
      const add = (key: string, label: string, weight: number, detail: string) => {
        if (Math.abs(weight) < 0.01) return;
        factors.push({ key, label, weight, detail });
      };

      // ── Retention risk ─────────────────────────────────────────────────
      const risk = retention ? retentionRisk(retention) : 0;
      add(
        "retention",
        "Retention risk",
        risk * (constraints.mode === "review" ? 5.5 : 3.2),
        retention && retention.repetitions > 0
          ? `${Math.round(retention.retention * 100)}% retained under the ${retention.model} model after ${Math.round(retention.daysIdle)} idle days.`
          : "No history, so nothing to lose yet.",
      );

      // ── Goal relevance ─────────────────────────────────────────────────
      if (goalNodeIds.has(node.id)) {
        const order = path ? path.nodeIds.indexOf(node.id) : -1;
        const earliness = order >= 0 ? 1 - order / Math.max(1, path!.nodeIds.length) : 0.6;
        add(
          "goal",
          "Goal relevance",
          (constraints.mode === "goal" ? 4.5 : 2.8) * earliness,
          path
            ? `Position ${order + 1} of ${path.nodeIds.length} on ${path.label}.`
            : "Named in an active goal.",
        );
      } else if (constraints.mode === "goal" && goalNodeIds.size > 0) {
        add("off-goal", "Outside the goal", -2.2, "Not part of the goal you selected.");
      }

      // ── Prerequisite leverage ──────────────────────────────────────────
      const leverage = leverageScore(node.id, goalNodeIds);
      add(
        "leverage",
        "Downstream leverage",
        leverage * 2.4,
        leverage > 0
          ? "Sits upstream of capabilities you are developing, so gains here propagate."
          : "Nothing depends on this node.",
      );

      // ── Low competence and low confidence ──────────────────────────────
      const competenceGap = 1 - (estimate?.competence ?? 0);
      add(
        "competence",
        "Room to improve",
        competenceGap * 1.5,
        `Competence estimated at ${Math.round((estimate?.competence ?? 0) * 100)}%.`,
      );

      if (estimate && estimate.strongObservations === 0 && estimate.practice > 0.15) {
        add(
          "unproven",
          "Practised but unproven",
          exercise.evidence === "scored" || exercise.evidence === "artifact" ? 2.6 : -0.4,
          exercise.evidence === "scored" || exercise.evidence === "artifact"
            ? "This task produces evidence, and this node has none despite real practice."
            : "Another self-reported rep would not change what is known here.",
        );
      }

      // ── Evidence value of the task itself ──────────────────────────────
      const evidenceValue =
        exercise.evidence === "scored" ? 1.6 : exercise.evidence === "artifact" ? 0.9 : 0;
      add(
        "evidence",
        "Produces evidence",
        evidenceValue * (constraints.mode === "evidence" ? 2.5 : 1),
        exercise.evidence === "self-report"
          ? "Self-reported: counts as practice, not as evidence."
          : `Produces ${exercise.evidence} evidence, which moves the competence estimate.`,
      );

      // ── Synergy ────────────────────────────────────────────────────────
      if (multiplier > 1) {
        add("synergy", "Active synergy", 1.6, "A consolidated prerequisite is buffing this node.");
      }

      // ── Difficulty fit ─────────────────────────────────────────────────
      const difficultyDistance = Math.abs(adaptive.level - difficultyTarget);
      add(
        "difficulty",
        "Difficulty fit",
        (constraints.mode === "hard" ? 1.4 : 1) * (1.6 - difficultyDistance * 0.8),
        `Your level here is ${adaptive.level}/5; this session is aiming at ${difficultyTarget}/5.`,
      );
      if (constraints.mode === "hard" && adaptive.level >= 4) {
        add("hard-mode", "Hard session", 2, "You asked for something difficult.");
      }

      // ── Duration fit ───────────────────────────────────────────────────
      if (minutes > constraints.minutes) {
        add(
          "too-long",
          "Does not fit",
          -6,
          `Needs about ${minutes} minutes and you have ${constraints.minutes}.`,
        );
      } else {
        add(
          "duration",
          "Fits the budget",
          0.8 * (1 - minutes / Math.max(1, constraints.minutes)),
          `About ${minutes} minutes of your ${constraints.minutes}.`,
        );
      }

      // ── Recent workload ────────────────────────────────────────────────
      const load = (categoryLoad.get(node.categoryId) ?? 0) / maxCategoryLoad;
      add(
        "workload",
        "Recent workload",
        -load * 1.8,
        load > 0.4
          ? `You have trained ${category?.label ?? "this cluster"} heavily in the last week.`
          : "This cluster has been quiet lately.",
      );

      // ── Novelty ────────────────────────────────────────────────────────
      if (adaptive.attempts === 0) {
        add("novelty", "Never attempted", 1.1, "You have never done this one.");
      }

      // ── Anti-gaming ────────────────────────────────────────────────────
      if (isSaturated(adaptive)) {
        add(
          "saturated",
          "Stopped teaching",
          -4,
          "You pass this every time at the highest framing. Repeating it produces points and nothing else.",
        );
      }

      // ── Tie-breaking noise, stable within a day ────────────────────────
      add(
        "variety",
        "Rotation",
        stableNoise(`${daySeed}:${exercise.id}`) * 0.4,
        "Small stable jitter so the same three items do not appear every day.",
      );

      const score = factors.reduce((sum, factor) => sum + factor.weight, 0);
      const top = [...factors]
        .filter((factor) => factor.weight > 0)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 2);
      const penalty = factors.find((factor) => factor.weight < -1);

      candidates.push({
        nodeId: node.id,
        nodeLabel: node.label,
        categoryId: node.categoryId,
        categoryLabel: category?.label ?? "Personal",
        exercise,
        adaptive,
        difficulty: adaptive.level,
        minutes,
        xp: Math.round(exercise.xp * multiplier * difficultyXpFactor(adaptive)),
        multiplier,
        score,
        factors,
        reason:
          top.map((factor) => factor.detail).join(" ") +
          (penalty ? ` Counted against it: ${penalty.detail.toLowerCase()}` : ""),
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Packs ranked candidates into the time budget.
 *
 * Greedy rather than optimal, with two diversity rules that matter more than
 * the last few points of score: one exercise per node, and no more than two
 * per category, so a session is cross-training rather than three variations of
 * one faculty. Review sessions relax the category rule, because when six things
 * are all about to be forgotten, spreading out is the wrong answer.
 */
export function planSession(
  data: IntelligenceData,
  model: LearnerModel,
  constraints: SessionConstraints = DEFAULT_CONSTRAINTS,
  goals: Goal[] = [],
  now = new Date(),
): WorkoutPlan {
  const ranked = rankCandidates(data, model, constraints, goals, now);
  const maxPerCategory = constraints.mode === "review" ? 3 : 2;

  const items: WorkoutItem[] = [];
  const usedNodes = new Set<string>();
  const perCategory = new Map<string, number>();
  let remaining = constraints.minutes;

  for (const candidate of ranked) {
    if (remaining <= 2) break;
    if (usedNodes.has(candidate.nodeId)) continue;
    if ((perCategory.get(candidate.categoryId) ?? 0) >= maxPerCategory) continue;
    // Allow a slight overrun on the last item rather than leaving the budget
    // unspent — a 20-minute task with 17 minutes left is a better session than
    // nothing at all.
    if (candidate.minutes > remaining + 5) continue;

    items.push(candidate);
    usedNodes.add(candidate.nodeId);
    perCategory.set(candidate.categoryId, (perCategory.get(candidate.categoryId) ?? 0) + 1);
    remaining -= candidate.minutes;
  }

  const totalMinutes = items.reduce((sum, item) => sum + item.minutes, 0);
  const alternates = ranked
    .filter((candidate) => !items.includes(candidate) && !usedNodes.has(candidate.nodeId))
    .slice(0, 6);

  return {
    items,
    totalMinutes,
    constraints,
    rationale: describePlan(items, constraints, totalMinutes),
    alternates,
  };
}

function describePlan(
  items: WorkoutItem[],
  constraints: SessionConstraints,
  totalMinutes: number,
): string {
  if (items.length === 0) {
    return "Nothing is available inside these constraints — every eligible task is still inside its reset window, or nothing fits the time budget. Shorten the budget filter or come back later.";
  }

  const { label: energyLabel } = energyTarget(constraints.energy);
  const evidenceCount = items.filter(
    (item) => item.exercise.evidence !== "self-report",
  ).length;
  const reviewCount = items.filter((item) =>
    item.factors.some((factor) => factor.key === "retention" && factor.weight > 1.5),
  ).length;
  const categories = new Set(items.map((item) => item.categoryId)).size;

  const parts = [
    `${items.length} item${items.length === 1 ? "" : "s"}, about ${totalMinutes} minutes of your ${constraints.minutes}, across ${categories} cluster${categories === 1 ? "" : "s"}.`,
    `Planned for ${energyLabel}.`,
  ];
  if (reviewCount > 0) {
    parts.push(
      `${reviewCount} ${reviewCount === 1 ? "is" : "are"} here because retention is slipping rather than because ${reviewCount === 1 ? "it is" : "they are"} new.`,
    );
  }
  parts.push(
    evidenceCount > 0
      ? `${evidenceCount} will produce evidence that can move a competence estimate; the rest count as practice.`
      : "None of these produce scored evidence, so they will move practice volume but not the competence estimates.",
  );

  return parts.join(" ");
}

/** Preset constraint sets, matching how people actually describe a session. */
export const SESSION_PRESETS: { id: string; label: string; constraints: SessionConstraints }[] = [
  { id: "quick", label: "I have 15 minutes", constraints: { minutes: 15, energy: "normal", mode: "balanced" } },
  { id: "standard", label: "I have 25 minutes", constraints: { minutes: 25, energy: "normal", mode: "balanced" } },
  { id: "long", label: "I have 45 minutes", constraints: { minutes: 45, energy: "normal", mode: "balanced" } },
  { id: "tired", label: "I'm mentally tired", constraints: { minutes: 20, energy: "low", mode: "review" } },
  { id: "hard", label: "Give me one hard problem", constraints: { minutes: 45, energy: "high", mode: "hard" } },
  { id: "evidence", label: "Prove something", constraints: { minutes: 40, energy: "normal", mode: "evidence" } },
];
