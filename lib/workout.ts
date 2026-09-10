import {
  MAX_XP,
  exerciseResetState,
  type DecayState,
} from "./mastery.ts";
import { synergyMultiplierForNode } from "./training.ts";
import type { Exercise, IntelligenceData, LogEntry } from "./types";

export interface WorkoutItem {
  nodeId: string;
  nodeLabel: string;
  categoryId: string;
  categoryLabel: string;
  exercise: Exercise;
  score: number;
  reason: string;
  multiplier: number;
}

function stableNoise(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

export function generateDailyWorkout(
  data: IntelligenceData,
  xpByNodeId: Record<string, number>,
  decayByNodeId: Record<string, DecayState>,
  logsByNodeId: Record<string, LogEntry[]>,
  now = new Date(),
): WorkoutItem[] {
  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const categoryNodes = new Map<string, string[]>();
  for (const node of data.nodes) {
    const list = categoryNodes.get(node.categoryId) ?? [];
    list.push(node.id);
    categoryNodes.set(node.categoryId, list);
  }

  const categoryScore = new Map<string, number>();
  for (const [categoryId, nodeIds] of categoryNodes) {
    const average =
      nodeIds.reduce((sum, id) => sum + Math.min(MAX_XP, xpByNodeId[id] ?? 0), 0) /
      Math.max(1, nodeIds.length * MAX_XP);
    categoryScore.set(categoryId, average);
  }

  const daySeed = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const candidates: WorkoutItem[] = [];

  for (const node of data.nodes) {
    const category = categories.get(node.categoryId);
    const decay = decayByNodeId[node.id];
    const multiplier = synergyMultiplierForNode(data, node.id, xpByNodeId);
    const weakness = 1 - (categoryScore.get(node.categoryId) ?? 0);

    for (const exercise of node.exercises) {
      const reset = exerciseResetState(
        logsByNodeId[node.id] ?? [],
        exercise.id,
        exercise.cadence,
        now,
      );
      if (!reset.available) continue;

      const decayNeed = decay?.decaying
        ? 3 + (1 - decay.retention) * 5 + Math.min(2, decay.daysIdle / 30)
        : decay
          ? Math.min(1.5, decay.daysIdle / 14)
          : 0.4;
      const buffBoost = multiplier > 1 ? 2.4 : 0;
      const lowDomainBoost = weakness * 3.2;
      const masteryGap = 1 - Math.min(1, (xpByNodeId[node.id] ?? 0) / MAX_XP);
      const variety = stableNoise(`${daySeed}:${exercise.id}`) * 0.35;
      const score = decayNeed + buffBoost + lowDomainBoost + masteryGap + variety;

      const reasons: string[] = [];
      if (decay?.decaying) reasons.push(`${Math.round(decay.retention * 100)}% retention — review is due`);
      if (multiplier > 1) reasons.push("active +25% prerequisite synergy");
      if (weakness >= 0.65) reasons.push("one of your lowest-mastery domains");
      if (reasons.length === 0) reasons.push("balanced practice for an under-trained faculty");

      candidates.push({
        nodeId: node.id,
        nodeLabel: node.label,
        categoryId: node.categoryId,
        categoryLabel: category?.label ?? "Faculty",
        exercise,
        score,
        reason: reasons.join(" · "),
        multiplier,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const chosen: WorkoutItem[] = [];
  const usedNodes = new Set<string>();
  const usedCategories = new Set<string>();

  // First pass favors distinct categories and nodes so the routine is cognitive
  // cross-training rather than three variations of one faculty.
  for (const candidate of candidates) {
    if (chosen.length >= 3) break;
    if (usedNodes.has(candidate.nodeId) || usedCategories.has(candidate.categoryId)) continue;
    chosen.push(candidate);
    usedNodes.add(candidate.nodeId);
    usedCategories.add(candidate.categoryId);
  }
  for (const candidate of candidates) {
    if (chosen.length >= 3) break;
    if (usedNodes.has(candidate.nodeId)) continue;
    chosen.push(candidate);
    usedNodes.add(candidate.nodeId);
  }

  return chosen;
}
