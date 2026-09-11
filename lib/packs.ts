import rawScientificThinking from "@/data/packs/scientific-thinking.json";
import { nodesById } from "./curriculum.ts";
import type {
  Cadence,
  Difficulty,
  EvidenceKind,
  NodeKind,
  PersonalNode,
  Resource,
} from "./types.ts";

/**
 * Skill packs.
 *
 * The canonical core is capped at 140 nodes and is meant to stay that size:
 * it describes general cognitive capability, and every domain that gets added
 * to it makes it worse at that job. Specialised expertise — mathematics,
 * programming, medicine, law — belongs in optional packs that *anchor* into the
 * core rather than extending it.
 *
 * A pack is plain data with a validated schema, so a third party can publish
 * one without touching this repository. Installing one materialises its nodes
 * as the user's own personal nodes: they train, decay, plan and export exactly
 * like anything else the user added by hand, and uninstalling removes the
 * definitions without touching the practice history.
 */

export const PACK_SCHEMA_VERSION = 1;

export interface PackExercise {
  id: string;
  label: string;
  xp: number;
  cadence: Cadence;
  difficulty: Difficulty;
  evidence: EvidenceKind;
  minutes?: number;
  progression?: string[];
}

export interface PackNode {
  /** Unique within the pack. Namespaced with the pack id on install. */
  id: string;
  label: string;
  description: string;
  kind: NodeKind;
  /**
   * Canonical core node ids this capability draws on.
   *
   * Required and non-empty: a pack node that anchors to nothing is a separate
   * curriculum wearing a pack's clothes, and the planner would have no way to
   * reason about where it sits.
   */
  anchors: string[];
  /** Pack-internal prerequisites, by pack node id. */
  requires?: string[];
  exercises: PackExercise[];
  resources?: Resource[];
  /** What this node will not give you. Required, as in the core. */
  limitations: string;
}

export interface SkillPack {
  schemaVersion: number;
  id: string;
  label: string;
  version: string;
  author: string;
  /** Where this came from, so an installed pack is traceable. */
  homepage?: string;
  blurb: string;
  /** Honest statement of what kind of thing this pack contains. */
  scope: string;
  nodes: PackNode[];
}

export interface PackValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const KINDS = new Set<NodeKind>([
  "ability",
  "meta",
  "competency",
  "knowledge",
  "enabler",
  "social",
  "augmentation",
]);
const CADENCES = new Set(["daily", "weekly", "session"]);
const EVIDENCE = new Set(["self-report", "artifact", "scored", "external"]);

/**
 * Validates an untrusted pack.
 *
 * Third-party content gets the same treatment as the core curriculum: an entry
 * that cannot state what it trains, what it builds on, and what it will not do
 * is rejected rather than installed with the gaps hidden.
 */
export function validatePack(input: unknown): PackValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (message: string) => errors.push(message);

  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Not an object."], warnings };
  }
  const pack = input as Partial<SkillPack>;

  if (pack.schemaVersion !== PACK_SCHEMA_VERSION) {
    fail(
      `Unsupported schemaVersion ${String(pack.schemaVersion)}; this build reads version ${PACK_SCHEMA_VERSION}.`,
    );
  }
  if (!pack.id || !/^[a-z0-9][a-z0-9-]{2,40}$/.test(pack.id)) {
    fail("Pack id must be lowercase kebab-case, 3-41 characters.");
  }
  if (!pack.label?.trim()) fail("Pack needs a label.");
  if (!pack.author?.trim()) fail("Pack needs an author — installed content must be traceable.");
  if (!/^\d+\.\d+\.\d+$/.test(pack.version ?? "")) fail("Pack version must be semver.");
  if (!pack.scope?.trim()) {
    fail("Pack needs a scope statement saying what kind of content it contains.");
  }
  if (pack.homepage && !/^https:\/\//.test(pack.homepage)) {
    fail("Pack homepage must be https.");
  }
  if (!Array.isArray(pack.nodes) || pack.nodes.length === 0) {
    return { ok: false, errors: [...errors, "Pack has no nodes."], warnings };
  }

  const ids = new Set<string>();
  const exerciseIds = new Set<string>();

  for (const node of pack.nodes) {
    const where = `node ${node?.id ?? "(unnamed)"}`;
    if (!node?.id || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(node.id)) {
      fail(`${where}: id must be lowercase kebab-case.`);
      continue;
    }
    if (ids.has(node.id)) fail(`${where}: duplicate id.`);
    ids.add(node.id);

    if (!node.label?.trim()) fail(`${where}: needs a label.`);
    if (!node.description?.trim()) fail(`${where}: needs a description.`);
    if (!KINDS.has(node.kind)) fail(`${where}: invalid kind "${String(node.kind)}".`);
    if (!node.limitations?.trim()) {
      fail(`${where}: needs a limitations statement. Every capability has limits.`);
    }

    if (!Array.isArray(node.anchors) || node.anchors.length === 0) {
      fail(`${where}: must anchor to at least one core capability.`);
    } else {
      for (const anchor of node.anchors) {
        if (!nodesById.has(anchor)) {
          fail(`${where}: anchors to unknown core node "${anchor}".`);
        }
      }
    }

    for (const required of node.requires ?? []) {
      if (!pack.nodes.some((other) => other.id === required)) {
        fail(`${where}: requires "${required}", which is not in this pack.`);
      }
    }

    if (!Array.isArray(node.exercises) || node.exercises.length === 0) {
      fail(`${where}: needs at least one exercise.`);
      continue;
    }
    for (const exercise of node.exercises) {
      const exWhere = `${where} exercise ${exercise?.id ?? "(unnamed)"}`;
      if (!exercise?.id) {
        fail(`${exWhere}: needs an id.`);
        continue;
      }
      if (exerciseIds.has(exercise.id)) fail(`${exWhere}: duplicate exercise id.`);
      exerciseIds.add(exercise.id);
      if (!exercise.label?.trim()) fail(`${exWhere}: needs a label.`);
      if (!(exercise.xp > 0)) fail(`${exWhere}: xp must be positive.`);
      if (!CADENCES.has(exercise.cadence)) fail(`${exWhere}: bad cadence.`);
      if (![1, 2, 3, 4, 5].includes(exercise.difficulty)) {
        fail(`${exWhere}: difficulty must be 1-5.`);
      }
      if (!EVIDENCE.has(exercise.evidence)) fail(`${exWhere}: bad evidence kind.`);
    }

    if (!node.exercises.some((exercise) => exercise.evidence !== "self-report")) {
      warnings.push(
        `${where}: every exercise is self-reported, so this node can never accumulate evidence and its competence estimate will stay near the prior.`,
      );
    }
    if (!node.resources?.length) {
      warnings.push(`${where}: no resources.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Turns a validated pack into personal nodes.
 *
 * Ids are namespaced with the pack, so two packs can both ship a node called
 * "recursion" without colliding, and so uninstalling can find exactly what it
 * installed.
 */
export function materialisePack(pack: SkillPack, now = new Date()): PersonalNode[] {
  return pack.nodes.map((node) => ({
    id: `pack:${pack.id}:${node.id}`,
    label: node.label,
    description: node.description,
    kind: node.kind,
    linkedNodeIds: node.anchors,
    createdAt: now.toISOString(),
    packId: pack.id,
    notes: [
      node.limitations ? `Limitations: ${node.limitations}` : "",
      `From the "${pack.label}" pack (${pack.version}) by ${pack.author}.`,
      pack.homepage ?? "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    exercises: node.exercises.map((exercise) => ({
      id: `pack:${pack.id}:${exercise.id}`,
      label: exercise.label,
      xp: exercise.xp,
      cadence: exercise.cadence,
      difficulty: exercise.difficulty,
      evidence: exercise.evidence,
      minutes: exercise.minutes,
      progression: exercise.progression,
    })),
  }));
}

/** Node ids belonging to an installed pack, for uninstall. */
export function packNodeIds(packId: string, personalNodes: PersonalNode[]): string[] {
  return personalNodes
    .filter((node) => node.packId === packId)
    .map((node) => node.id);
}

/**
 * Packs that ship with the app.
 *
 * Deliberately one, as a worked reference implementation of the schema rather
 * than a content library. The point of packs is that they do not have to live
 * in this repository.
 */
export const BUNDLED_PACKS: SkillPack[] = [rawScientificThinking as SkillPack];

export function bundledPack(id: string): SkillPack | undefined {
  return BUNDLED_PACKS.find((pack) => pack.id === id);
}

export async function readPackFile(file: File): Promise<SkillPack> {
  const parsed = JSON.parse(await file.text()) as unknown;
  const validation = validatePack(parsed);
  if (!validation.ok) {
    throw new Error(
      `This pack has ${validation.errors.length} problem${validation.errors.length === 1 ? "" : "s"}:\n${validation.errors.slice(0, 6).join("\n")}`,
    );
  }
  return parsed as SkillPack;
}
