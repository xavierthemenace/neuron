import type { Progress } from "./types.ts";

/**
 * Curriculum migrations.
 *
 * The ontology is meant to keep evolving; a user's two years of practice
 * history is not meant to evaporate when it does. Every rename, merge or split
 * of a node or exercise id is declared here, applied in version order, and
 * recorded on the Progress so it runs exactly once.
 *
 * Migrations only ever rewrite *references*. They never delete a log, because a
 * log the current curriculum cannot place is still a record that the user did
 * something — it is parked against its original id and surfaced as orphaned
 * history rather than silently discarded.
 */

export type MigrationOp =
  | { kind: "rename-node"; from: string; to: string }
  | { kind: "rename-exercise"; from: string; to: string }
  /**
   * Several nodes become one. All history is credited to the survivor, which
   * is safe: the union of evidence for the parts is evidence for the whole.
   */
  | { kind: "merge-nodes"; from: string[]; to: string }
  /**
   * One node becomes several. This direction is lossy and the policy has to be
   * stated rather than guessed: history cannot be attributed to a narrower
   * construct it was never measured against. `primary` inherits the practice
   * record; the other successors start empty, and the split is explained in the
   * UI so the drop is not read as a bug.
   */
  | { kind: "split-node"; from: string; primary: string; into: string[]; note: string };

export interface Migration {
  /** Curriculum version this migration brings progress up to. */
  version: string;
  summary: string;
  ops: MigrationOp[];
}

/**
 * Declared migrations, oldest first.
 *
 * The 2.0.0 entry is the worked example of the split policy: the original
 * curriculum's "Updating & Inhibition" conflated two of Miyake's separable
 * executive functions, and 2.0.0 pulls response inhibition out into its own
 * node in the new executive cluster. Practice history stays with the working-
 * memory updating half, because that is what the original exercises actually
 * trained; the new inhibition node starts with no evidence, which is the
 * truthful position.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: "2.0.0",
    summary:
      "Updating & Inhibition split into Working Memory Updating and a separate Response Inhibition node.",
    ops: [
      {
        kind: "split-node",
        from: "gwm-updating",
        primary: "gwm-updating",
        into: ["gwm-updating", "exec-inhibition"],
        note: "The original node's exercises trained working-memory updating, so that history stays where it was. Response Inhibition is a new construct with no observations yet — it is not missing data, it is data that was never collected.",
      },
    ],
  },
];

export interface MigrationReport {
  from: string | null;
  to: string;
  applied: Migration[];
  /** Whether there was any user history for the migration to act on. */
  hadData: boolean;
  /** Node ids in the progress that the current curriculum does not contain. */
  orphanedNodeIds: string[];
  /** Logs rewritten by a rename or merge. */
  rewrittenLogs: number;
  notes: string[];
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if ((pa[index] ?? 0) !== (pb[index] ?? 0)) return (pa[index] ?? 0) - (pb[index] ?? 0);
  }
  return 0;
}

function buildRewrites(migrations: Migration[]): {
  nodes: Map<string, string>;
  exercises: Map<string, string>;
  notes: string[];
} {
  const nodes = new Map<string, string>();
  const exercises = new Map<string, string>();
  const notes: string[] = [];

  for (const migration of migrations) {
    for (const op of migration.ops) {
      if (op.kind === "rename-node") {
        nodes.set(op.from, op.to);
      } else if (op.kind === "rename-exercise") {
        exercises.set(op.from, op.to);
      } else if (op.kind === "merge-nodes") {
        for (const from of op.from) nodes.set(from, op.to);
      } else if (op.kind === "split-node") {
        if (op.from !== op.primary) nodes.set(op.from, op.primary);
        notes.push(op.note);
      }
    }
  }

  return { nodes, exercises, notes };
}

/**
 * Brings a Progress up to the current curriculum version.
 *
 * Pure and idempotent: running it twice on the same input produces the same
 * output, so a cross-tab broadcast or a re-import cannot double-apply a rename.
 */
export function migrateProgress(
  progress: Progress,
  targetVersion: string,
  knownNodeIds: Set<string>,
  migrations: Migration[] = MIGRATIONS,
): { progress: Progress; report: MigrationReport } {
  const from = progress.curriculumVersion ?? null;
  const pending = migrations
    .filter((migration) => from === null || compareVersions(migration.version, from) > 0)
    .filter((migration) => compareVersions(migration.version, targetVersion) <= 0)
    .sort((a, b) => compareVersions(a.version, b.version));

  const { nodes, exercises, notes } = buildRewrites(pending);

  let rewrittenLogs = 0;
  const logs = progress.logs.map((log) => {
    const nodeId = nodes.get(log.nodeId);
    const exerciseId = exercises.get(log.exerciseId);
    if (!nodeId && !exerciseId) return log;
    rewrittenLogs += 1;
    return {
      ...log,
      nodeId: nodeId ?? log.nodeId,
      exerciseId: exerciseId ?? log.exerciseId,
    };
  });

  const remap = (ids: string[]) => ids.map((id) => nodes.get(id) ?? id);

  const migrated: Progress = {
    ...progress,
    logs,
    diagnostics: progress.diagnostics.map((result) => ({
      ...result,
      nodeIds: remap(result.nodeIds),
    })),
    predictions: progress.predictions.map((prediction) => ({
      ...prediction,
      nodeIds: remap(prediction.nodeIds),
    })),
    capstones: progress.capstones.map((capstone) => ({
      ...capstone,
      nodeIds: remap(capstone.nodeIds),
    })),
    goals: progress.goals.map((goal) => ({ ...goal, nodeIds: remap(goal.nodeIds) })),
    personalNodes: progress.personalNodes.map((node) => ({
      ...node,
      linkedNodeIds: remap(node.linkedNodeIds),
    })),
    curriculumVersion: targetVersion,
  };

  const personalIds = new Set(migrated.personalNodes.map((node) => node.id));
  const orphaned = new Set<string>();
  for (const log of migrated.logs) {
    if (!knownNodeIds.has(log.nodeId) && !personalIds.has(log.nodeId)) {
      orphaned.add(log.nodeId);
    }
  }

  const hadData =
    progress.logs.length > 0 ||
    progress.goals.length > 0 ||
    progress.diagnostics.length > 0 ||
    progress.personalNodes.length > 0;

  return {
    progress: migrated,
    report: {
      from,
      to: targetVersion,
      applied: pending,
      hadData,
      orphanedNodeIds: [...orphaned].sort(),
      rewrittenLogs,
      notes,
    },
  };
}

/**
 * True when there is anything worth telling the user about.
 *
 * A fresh install has no `curriculumVersion`, which makes every declared
 * migration look pending. Reporting those would greet a first-time user with a
 * notice about an ontology change that predates their account and never touched
 * a single one of their records.
 */
export function migrationIsNoteworthy(report: MigrationReport): boolean {
  if (report.rewrittenLogs > 0 || report.orphanedNodeIds.length > 0) return true;
  return report.applied.length > 0 && report.hadData;
}
