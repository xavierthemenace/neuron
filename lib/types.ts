/** Which model of intelligence a cluster belongs to. */
export type Domain = "gardner" | "eq" | "fluid" | "crystallized";

/** A cluster of related concepts — renders as one visual lobe of the brain. */
export interface Category {
  id: string;
  domain: Domain;
  label: string;
  /** OKLCH hue angle, 0-360. Drives every colour the cluster paints. */
  hue: number;
  blurb: string;
}

export type ResourceType =
  | "book"
  | "course"
  | "tool"
  | "paper"
  | "practice"
  | "video";

/**
 * A curated pointer. `url` is optional on purpose: entries without one are
 * citations (title + author) and render as non-clickable chips.
 */
export interface Resource {
  title: string;
  type: ResourceType;
  url?: string;
}

/** How often an exercise is meant to be repeated. Drives reset gating. */
export type Cadence = "daily" | "weekly" | "session";

export interface Exercise {
  id: string;
  label: string;
  xp: number;
  cadence: Cadence;
}

/** Depth within a cluster: 0 = root faculty, 1 = core skill, 2 = advanced. */
export type ConceptTier = 0 | 1 | 2;

export interface ConceptNode {
  id: string;
  categoryId: string;
  label: string;
  tier: ConceptTier;
  description: string;
  why: string;
  resources: Resource[];
  exercises: Exercise[];
}

/**
 * `prereq` links order skills inside a cluster; `synergy` links cross clusters
 * and are the reason this is a graph rather than fourteen lists.
 */
export type LinkType = "prereq" | "synergy";

export interface Link {
  source: string;
  target: string;
  type: LinkType;
}

export interface IntelligenceData {
  version: number;
  categories: Category[];
  nodes: ConceptNode[];
  links: Link[];
}

/** One completed rep. Logs are the source of truth; XP is derived from them. */
export interface LogEntry {
  id: string;
  nodeId: string;
  exerciseId: string;
  /** Awarded XP after any active synergy multiplier. */
  xp: number;
  /** Exercise XP before buffs. Optional for backwards-compatible v1 logs. */
  baseXp?: number;
  /** Multiplier used for the award, e.g. 1.25 for a synergy buff. */
  multiplier?: number;
  /** Estimated or user-entered practice duration. */
  minutes?: number;
  /** Typed work, evidence, or a short completion note. */
  note?: string;
  source?: "panel" | "command" | "workout" | "coach";
  /** ISO 8601 timestamp. */
  at: string;
}

export interface Progress {
  version: 1;
  logs: LogEntry[];
}
