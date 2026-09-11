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

/**
 * The user's history as it stood at a past moment.
 *
 * Rebuilding the whole learner model from a truncated log is the only honest
 * way to answer "where was I a month ago": the retention curves, the competence
 * estimates and the confidence bands all have to be recomputed as of that date,
 * not read off today's numbers with a smaller XP total.
 */
export function progressAsOf(progress: Progress, at: Date): Progress {
  const cutoff = at.toISOString();
  return {
    ...progress,
    logs: progress.logs.filter((log) => log.at <= cutoff),
    diagnostics: progress.diagnostics.filter((result) => result.at <= cutoff),
    predictions: progress.predictions.filter(
      (prediction) => prediction.createdAt <= cutoff,
    ),
    missions: progress.missions.filter((mission) => mission.startedAt <= cutoff),
    capstones: progress.capstones.filter((capstone) => capstone.submittedAt <= cutoff),
    personalNodes: progress.personalNodes.filter((node) => node.createdAt <= cutoff),
    goals: progress.goals.filter((goal) => goal.createdAt <= cutoff),
    experiments: progress.experiments.filter(
      (experiment) => experiment.startedAt <= cutoff,
    ),
  };
}

export interface NodeComparison {
  nodeId: string;
  label: string;
  categoryId: string;
  practiceDelta: number;
  competenceDelta: number;
  retentionDelta: number;
  /** Whether the competence estimate gained real evidence, not just reps. */
  evidenceDelta: number;
}

/**
 * Compares two learner models node by node.
 *
 * Deliberately reports competence and practice separately rather than merging
 * them into a single "progress" figure: a month of heavy practice with no
 * evidence should show up as exactly that, and a merged number would hide it.
 */
export function compareModels(
  before: LearnerModel,
  after: LearnerModel,
): NodeComparison[] {
  return after.nodes
    .map((node) => {
      const past = before.estimates[node.id];
      const now = after.estimates[node.id];
      return {
        nodeId: node.id,
        label: node.label,
        categoryId: node.categoryId,
        practiceDelta: (now?.practice ?? 0) - (past?.practice ?? 0),
        competenceDelta: (now?.competence ?? 0) - (past?.competence ?? 0),
        retentionDelta:
          (after.retentionByNodeId[node.id]?.retention ?? 1) -
          (before.retentionByNodeId[node.id]?.retention ?? 1),
        evidenceDelta:
          (now?.strongObservations ?? 0) - (past?.strongObservations ?? 0),
      };
    })
    .filter(
      (row) =>
        Math.abs(row.practiceDelta) > 0.001 ||
        Math.abs(row.competenceDelta) > 0.001 ||
        Math.abs(row.retentionDelta) > 0.01,
    );
}
