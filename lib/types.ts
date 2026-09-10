/**
 * Which model of intelligence a cluster belongs to.
 *
 * `gardner` / `eq` are the friendly visual organisation and are NOT claimed to
 * be validated latent factors; `fluid` / `crystallized` map onto CHC theory.
 * The remaining domains group capabilities the literature takes seriously but
 * that no single popular framework covers.
 */
export type Domain =
  | "gardner"
  | "eq"
  | "fluid"
  | "crystallized"
  | "executive"
  | "epistemic"
  | "generative"
  | "strategic";

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

/**
 * Base difficulty of a task, 1 (approachable) to 5 (expert). Adaptive
 * difficulty moves a *user's* working level around this anchor; the curriculum
 * value itself never changes.
 */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

/**
 * What kind of proof completing this task produces. Only `scored` and
 * `artifact` reps move a competence estimate much — a `self-report` tick is
 * practice volume and little else.
 */
export type EvidenceKind = "self-report" | "artifact" | "scored" | "external";

export interface Exercise {
  id: string;
  label: string;
  xp: number;
  cadence: Cadence;
  /** Anchor difficulty. Optional in legacy data; defaults to 2. */
  difficulty?: Difficulty;
  /** Evidence strength of one completion. Defaults to "self-report". */
  evidence?: EvidenceKind;
  /** Author-stated duration in minutes; beats the label heuristic when present. */
  minutes?: number;
  /**
   * Harder framings of the same task, index 0 being one step above the anchor.
   * Adaptive difficulty walks up and down this list.
   */
  progression?: string[];
}

/** Depth within a cluster: 0 = root faculty, 1 = core skill, 2 = advanced. */
export type ConceptTier = 0 | 1 | 2;

/**
 * What *kind of construct* a node is. Treating a physiological enabler, a
 * knowledge asset and a latent ability as the same thing is the single biggest
 * modelling error a graph like this can make: they are measured differently,
 * they decay differently, and they respond to practice differently.
 */
export type NodeKind =
  | "ability" // Cognitive Ability — latent capacity, slow-moving
  | "meta" // Executive / Meta Skill — control over one's own cognition
  | "competency" // Learned Competency — trainable performance skill
  | "knowledge" // Knowledge Asset — content that can be recalled
  | "enabler" // Physiological / Behavioral Enabler
  | "social" // Social-Emotional Skill
  | "augmentation"; // Augmentation Skill — cognition through tools

/**
 * Scientific taxonomy overlay, largely CHC broad abilities. A node may map to
 * several. `psychomotor` and `socio-emotional` sit outside the CHC narrow-
 * ability core and are marked as such in the UI.
 */
export type CognitiveConstruct =
  | "fluid-reasoning"
  | "crystallized-knowledge"
  | "visual-processing"
  | "auditory-processing"
  | "working-memory"
  | "processing-speed"
  | "learning-retrieval"
  | "quantitative"
  | "reading-writing"
  | "executive-control"
  | "psychomotor"
  | "socio-emotional";

/**
 * Honest confidence bands. `strong` means broad replicated evidence;
 * `speculative` means the construct is plausible and useful but essentially
 * untested as stated here.
 */
export type EvidenceConfidence =
  | "strong"
  | "moderate"
  | "emerging"
  | "speculative";

/**
 * Three claims that popular brain training constantly conflates: that a thing
 * exists and can be measured, that practice moves it, and that moving it
 * changes anything else. Stored separately, displayed separately.
 */
export interface NodeEvidence {
  /** Evidence that the construct exists and is measurable as described. */
  constructValidity: EvidenceConfidence;
  /** Evidence that deliberate practice improves performance on it. */
  trainability: EvidenceConfidence;
  /** Evidence that improvement generalises beyond the trained task. */
  transferEvidence: EvidenceConfidence;
  /** Overall confidence, never higher than the weakest pillar above. */
  evidenceConfidence: EvidenceConfidence;
  /** ISO date this assessment was last reviewed. */
  evidenceUpdatedAt: string;
  /** How Neuron proposes to measure it — including "we cannot, directly". */
  measurementMethod: string;
  /** What training this will NOT do. Required: every node has limits. */
  knownLimitations: string;
  /** Citations. Entries without a `url` render as plain references. */
  sources: Resource[];
}

/**
 * How a capability fades when unpracticed. One forgetting curve for both
 * "Method of Loci" and "Strength & Conditioning" is wrong in both directions.
 */
export type RetentionModel =
  | "knowledge" // FSRS-like stability / retrievability
  | "procedural" // fluency degrades, structure persists
  | "executive-habit" // recency and successful application dominate
  | "physical" // detraining curves: fast loss, fast regain
  | "social" // real-world demonstration recency
  | "meta"; // frequency of successful application

export interface ConceptNode {
  id: string;
  categoryId: string;
  label: string;
  tier: ConceptTier;
  /** What the construct is, precisely. */
  description: string;
  /** Why it is worth training — the rationale for inclusion. */
  why: string;
  /** Construct kind. Optional only for legacy parsing; the validator requires it. */
  kind?: NodeKind;
  /** Scientific taxonomy mappings. */
  constructs?: CognitiveConstruct[];
  /** Structured honesty about what is and is not known. */
  evidence?: NodeEvidence;
  /** Overrides the default retention model implied by `kind`. */
  retentionModel?: RetentionModel;
  resources: Resource[];
  exercises: Exercise[];
}

/**
 * Coarse visual bucket, retained because the renderer and the layout baker key
 * off it. `relation` carries the precise semantics.
 */
export type LinkType = "prereq" | "synergy" | "inhibition";

/**
 * Precise edge semantics. Drawing "prerequisite" and "shares a mechanism with"
 * as the same line implies a certainty the evidence does not support.
 */
export type LinkRelation =
  | "prerequisite" // target cannot be trained well without source
  | "enabling" // source is a precondition, often physiological
  | "supporting" // source materially helps, but is not required
  | "transfer" // practising source measurably moves target
  | "synergy" // mutual reinforcement, no clear direction
  | "analogical" // structural similarity used as a teaching bridge
  | "shared-mechanism" // both load the same underlying process
  | "inhibition"; // more of source can cost target

export interface Link {
  source: string;
  target: string;
  type: LinkType;
  relation?: LinkRelation;
  /** 0-1. How much the source moves the target. */
  strength?: number;
  /** Confidence in the relationship itself, not in either endpoint. */
  confidence?: EvidenceConfidence;
  /** One line: by what mechanism. Shown in Research Mode. */
  mechanism?: string;
  /** When the relationship only holds under some condition, say so. */
  conditional?: string;
}

export interface IntelligenceData {
  /** Data-format version. Bumped only when the shape changes. */
  version: number;
  /** Semantic version of the *content*, independent of the app version. */
  curriculumVersion: string;
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
  source?: "panel" | "command" | "workout" | "coach" | "mission" | "capstone";
  /** Difficulty actually attempted, after adaptive adjustment. */
  difficulty?: Difficulty;
  /** Evidence strength of this rep. */
  evidence?: EvidenceKind;
  /** Self-rated 0-1 quality of the completion, when the user supplied one. */
  quality?: number;
  /** Objective 0-1 score, for reps that were actually scored. */
  score?: number;
  /** ISO 8601 timestamp. */
  at: string;
}

/** A short, repeatable objective probe of one capability. */
export interface DiagnosticResult {
  id: string;
  probeId: string;
  nodeIds: string[];
  /** 0-1 performance. */
  score: number;
  /** Difficulty band the probe ran at. */
  difficulty: Difficulty;
  /** Number of items — drives how much this result is trusted. */
  items: number;
  /** Median response time in ms, where the probe is timed. */
  medianMs?: number;
  at: string;
}

/** A dated, probability-tagged claim the user commits to before knowing. */
export interface Prediction {
  id: string;
  claim: string;
  /** 0-1, the user's stated probability at the time of writing. */
  probability: number;
  createdAt: string;
  /** When the outcome should be known. */
  resolveBy: string;
  resolvedAt?: string;
  outcome?: "yes" | "no" | "ambiguous";
  nodeIds: string[];
  tags?: string[];
  note?: string;
}

/** A multi-node challenge whose output is an artifact, not a checkbox. */
export interface MissionRecord {
  id: string;
  missionId: string;
  startedAt: string;
  completedAt?: string;
  /** Per-step user work, keyed by step id. */
  steps: Record<string, string>;
  /** Self-assessed 0-1 quality, recorded at completion. */
  quality?: number;
  reflection?: string;
}

/** Demonstrated work standing as evidence for a cluster of capabilities. */
export interface CapstoneRecord {
  id: string;
  capstoneId: string;
  nodeIds: string[];
  submittedAt: string;
  summary: string;
  /** Attachment ids in the IndexedDB attachment store. */
  attachmentIds?: string[];
  /** 0-1 rubric total. */
  rubricScore?: number;
  rubric?: Record<string, number>;
}

/** A user-authored capability that is not part of the canonical core. */
export interface PersonalNode {
  id: string;
  label: string;
  description: string;
  kind: NodeKind;
  /** Canonical node ids this personal capability draws on. */
  linkedNodeIds: string[];
  createdAt: string;
  exercises: Exercise[];
  notes?: string;
  packId?: string;
}

export interface Goal {
  id: string;
  label: string;
  /** Why the user wants this — quoted back in explanations. */
  motivation?: string;
  createdAt: string;
  targetDate?: string;
  /** Canonical + personal node ids this goal trains. */
  nodeIds: string[];
  /** Curated path this goal was seeded from, if any. */
  pathId?: string;
  status: "active" | "paused" | "achieved" | "abandoned";
  weeklyMinutes?: number;
}

/** A lightweight personal experiment. Never presented as science. */
export interface ExperimentRecord {
  id: string;
  hypothesis: string;
  intervention: string;
  measure: string;
  startedAt: string;
  endsAt?: string;
  observations: { at: string; arm: "a" | "b"; value: number; note?: string }[];
  conclusion?: string;
  status: "running" | "concluded" | "abandoned";
}

export interface Progress {
  version: 2;
  logs: LogEntry[];
  diagnostics: DiagnosticResult[];
  predictions: Prediction[];
  missions: MissionRecord[];
  capstones: CapstoneRecord[];
  personalNodes: PersonalNode[];
  goals: Goal[];
  experiments: ExperimentRecord[];
  /** Curriculum version this progress was last reconciled against. */
  curriculumVersion?: string;
  /** Ids of installed optional skill packs. */
  installedPacks?: string[];
  /** Review-inbox items the user explicitly dismissed, with an ISO date. */
  dismissed?: Record<string, string>;
}
