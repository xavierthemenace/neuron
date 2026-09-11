import { estimateNode, type NodeEstimate } from "./competence.ts";
import { allNodes, missionNodeIds } from "./curriculum.ts";
import { retentionModelFor } from "./evidence.ts";
import { DECAY_FLOOR_XP } from "./mastery.ts";
import { retentionStateFor, type RetentionState } from "./retention.ts";
import type { ConceptNode, LogEntry, Progress } from "./types.ts";

/**
 * The learner model: one pass over the user's history that produces every
 * derived number the rest of the app reads.
 *
 * Kept as a pure function of (curriculum, progress, now) so it can be unit
 * tested without a browser and recomputed from scratch whenever progress
 * changes. Nothing here is stored; storing derived state is how a learner model
 * drifts out of agreement with the log it claims to summarise.
 */

export interface LearnerModel {
  nodes: ConceptNode[];
  logsByNodeId: Record<string, LogEntry[]>;
  /** Lifetime awarded XP, before any decay. The progression number. */
  rawXpByNodeId: Record<string, number>;
  /** XP discounted by retention. What the graph paints with. */
  xpByNodeId: Record<string, number>;
  retentionByNodeId: Record<string, RetentionState>;
  estimates: Record<string, NodeEstimate>;
  totalXp: number;
  /** Node ids with logs that the current curriculum no longer contains. */
  orphanedNodeIds: string[];
}

/**
 * Effective XP after retention.
 *
 * Keeps the original floor: once a faculty has been genuinely established,
 * decay erodes the top of the curve rather than returning it to zero. Losing
 * the whole record for a month off is both wrong and demoralising.
 */
export function effectiveXp(rawXp: number, retention: number): number {
  const floor = Math.min(rawXp, DECAY_FLOOR_XP);
  return Math.round(floor + (rawXp - floor) * retention);
}

export function buildLearnerModel(progress: Progress, now = new Date()): LearnerModel {
  const nodes = allNodes(progress.personalNodes);

  const logsByNodeId: Record<string, LogEntry[]> = {};
  for (const log of progress.logs) {
    (logsByNodeId[log.nodeId] ??= []).push(log);
  }
  for (const list of Object.values(logsByNodeId)) {
    list.sort((a, b) => b.at.localeCompare(a.at));
  }

  const rawXpByNodeId: Record<string, number> = {};
  let totalXp = 0;
  for (const log of progress.logs) {
    rawXpByNodeId[log.nodeId] = (rawXpByNodeId[log.nodeId] ?? 0) + log.xp;
    totalXp += log.xp;
  }

  const retentionByNodeId: Record<string, RetentionState> = {};
  const xpByNodeId: Record<string, number> = {};
  const estimates: Record<string, NodeEstimate> = {};

  for (const node of nodes) {
    const logs = logsByNodeId[node.id] ?? [];
    const retention = retentionStateFor(logs, retentionModelFor(node), now);
    retentionByNodeId[node.id] = retention;

    const rawXp = rawXpByNodeId[node.id] ?? 0;
    xpByNodeId[node.id] = effectiveXp(rawXp, retention.retention);

    estimates[node.id] = estimateNode(
      {
        node,
        logs,
        diagnostics: progress.diagnostics,
        missions: progress.missions,
        capstones: progress.capstones,
        missionNodeIds,
        retention,
        xp: rawXp,
      },
      now,
    );
  }

  const known = new Set(nodes.map((node) => node.id));
  const orphanedNodeIds = Object.keys(rawXpByNodeId)
    .filter((id) => !known.has(id))
    .sort();

  return {
    nodes,
    logsByNodeId,
    rawXpByNodeId,
    xpByNodeId,
    retentionByNodeId,
    estimates,
    totalXp,
    orphanedNodeIds,
  };
}

/** Nodes ordered by how much evidence stands behind their estimate. */
export function bestEvidenced(model: LearnerModel, limit = 5): NodeEstimate[] {
  return Object.values(model.estimates)
    .filter((estimate) => estimate.strongObservations > 0)
    .sort((a, b) => b.evidenceWeight - a.evidenceWeight)
    .slice(0, limit);
}

/**
 * Nodes where practice has substantially outrun demonstrated competence.
 *
 * This is the honest version of "you have been busy": a large gap means lots of
 * reps and little proof, which is either a measurement problem or a practice-
 * quality problem. Either way it is worth surfacing rather than rewarding.
 */
export function practiceWithoutProof(
  model: LearnerModel,
  minPractice = 0.2,
  limit = 5,
): NodeEstimate[] {
  return Object.values(model.estimates)
    .filter(
      (estimate) =>
        estimate.practice >= minPractice && estimate.strongObservations === 0,
    )
    .sort((a, b) => b.practice - a.practice)
    .slice(0, limit);
}
