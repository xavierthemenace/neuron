import rawCapstones from "@/data/capstones.json";
import rawData from "@/data/intelligenceData.json";
import rawMissions from "@/data/missions.json";
import rawPaths from "@/data/paths.json";
import type {
  ConceptNode,
  Difficulty,
  IntelligenceData,
  PersonalNode,
} from "./types.ts";

/**
 * Single access layer for the shipped curriculum. Everything else imports from
 * here rather than reaching into data/*.json, so the migration surface is one
 * file wide when the ontology changes.
 */
export const curriculum = rawData as IntelligenceData;

export const CURRICULUM_VERSION = curriculum.curriculumVersion;

export const nodesById = new Map(curriculum.nodes.map((node) => [node.id, node]));
export const categoriesById = new Map(
  curriculum.categories.map((category) => [category.id, category]),
);

// ── Paths ─────────────────────────────────────────────────────────────────
export interface Path {
  id: string;
  label: string;
  hue: number;
  blurb: string;
  outcome: string;
  /** Ordered: earlier entries are meant to be trained first. */
  nodeIds: string[];
}

export const paths = (rawPaths as { paths: Path[] }).paths;
export const pathsById = new Map(paths.map((path) => [path.id, path]));

export function pathsForNode(nodeId: string): Path[] {
  return paths.filter((path) => path.nodeIds.includes(nodeId));
}

// ── Missions ──────────────────────────────────────────────────────────────
export interface MissionStep {
  id: string;
  prompt: string;
  minWords: number;
}

export interface Mission {
  id: string;
  label: string;
  blurb: string;
  estimatedMinutes: number;
  difficulty: Difficulty;
  nodeIds: string[];
  /** Why this mission is evidence of something a single exercise is not. */
  transferClaim: string;
  steps: MissionStep[];
}

export const missions = (rawMissions as { missions: Mission[] }).missions;
export const missionsById = new Map(missions.map((mission) => [mission.id, mission]));

export function missionNodeIds(missionId: string): string[] {
  return missionsById.get(missionId)?.nodeIds ?? [];
}

export function missionsForNode(nodeId: string): Mission[] {
  return missions.filter((mission) => mission.nodeIds.includes(nodeId));
}

// ── Capstones ─────────────────────────────────────────────────────────────
export interface RubricCriterion {
  id: string;
  label: string;
}

export interface Capstone {
  id: string;
  label: string;
  blurb: string;
  clusterLabel: string;
  nodeIds: string[];
  requires: { minCompetence: number; minNodes: number };
  evidencePrompt: string;
  rubric: RubricCriterion[];
}

export const capstones = (rawCapstones as { capstones: Capstone[] }).capstones;
export const capstonesById = new Map(
  capstones.map((capstone) => [capstone.id, capstone]),
);

export function capstonesForNode(nodeId: string): Capstone[] {
  return capstones.filter((capstone) => capstone.nodeIds.includes(nodeId));
}

// ── Personal nodes folded into the same shape ─────────────────────────────
/**
 * A personal node is rendered, trained and estimated exactly like a canonical
 * one; it simply carries no evidence block and sits in its own category. This
 * adapter is what lets every downstream module stay ignorant of the difference.
 */
export const PERSONAL_CATEGORY_ID = "personal";

export function personalAsConcept(personal: PersonalNode): ConceptNode {
  return {
    id: personal.id,
    categoryId: PERSONAL_CATEGORY_ID,
    label: personal.label,
    tier: 1,
    kind: personal.kind,
    constructs: [],
    description: personal.description,
    why: "A capability you added yourself.",
    resources: [],
    exercises: personal.exercises,
  };
}

/** All trainable nodes: the canonical core plus whatever the user has added. */
export function allNodes(personalNodes: PersonalNode[]): ConceptNode[] {
  return [...curriculum.nodes, ...personalNodes.map(personalAsConcept)];
}

export function resolveNode(
  nodeId: string,
  personalNodes: PersonalNode[],
): ConceptNode | null {
  const canonical = nodesById.get(nodeId);
  if (canonical) return canonical;
  const personal = personalNodes.find((node) => node.id === nodeId);
  return personal ? personalAsConcept(personal) : null;
}
