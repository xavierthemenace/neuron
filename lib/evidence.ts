import type {
  CognitiveConstruct,
  ConceptNode,
  EvidenceConfidence,
  LinkRelation,
  NodeKind,
  RetentionModel,
} from "./types.ts";

/** Ordered weakest → strongest so bands can be compared numerically. */
export const CONFIDENCE_ORDER: EvidenceConfidence[] = [
  "speculative",
  "emerging",
  "moderate",
  "strong",
];

export function confidenceRank(band: EvidenceConfidence): number {
  return CONFIDENCE_ORDER.indexOf(band);
}

export function weakerOf(
  a: EvidenceConfidence,
  b: EvidenceConfidence,
): EvidenceConfidence {
  return confidenceRank(a) <= confidenceRank(b) ? a : b;
}

/**
 * Overall confidence in a node entry.
 *
 * Deliberately NOT the minimum of all three pillars: transfer evidence is weak
 * for nearly every trainable capability, so a strict minimum would stamp
 * "emerging" on the whole curriculum and stop discriminating between a
 * well-measured, well-trained construct and a guess. Instead the overall band
 * is the weaker of construct validity and trainability — the two claims Neuron
 * actually makes when it puts a node on the map — capped at one band above the
 * transfer evidence so a node can never look authoritative while its
 * generalisation claim is speculative. Transfer is always displayed on its own.
 */
export function overallConfidence(
  constructValidity: EvidenceConfidence,
  trainability: EvidenceConfidence,
  transferEvidence: EvidenceConfidence,
): EvidenceConfidence {
  const base = confidenceRank(weakerOf(constructValidity, trainability));
  const cap = confidenceRank(transferEvidence) + 1;
  return CONFIDENCE_ORDER[Math.max(0, Math.min(base, cap, 3))];
}

export const CONFIDENCE_LABEL: Record<EvidenceConfidence, string> = {
  strong: "Strong",
  moderate: "Moderate",
  emerging: "Emerging",
  speculative: "Speculative",
};

/** OKLCH hue per band, from green (strong) to grey-violet (speculative). */
export const CONFIDENCE_HUE: Record<EvidenceConfidence, number> = {
  strong: 152,
  moderate: 95,
  emerging: 62,
  speculative: 295,
};

export const CONFIDENCE_BLURB: Record<EvidenceConfidence, string> = {
  strong: "Replicated across independent samples and methods.",
  moderate: "Consistent evidence, with real disagreement at the edges.",
  emerging: "Suggestive results; small samples or narrow tasks.",
  speculative: "Plausible and useful in practice, largely untested as stated.",
};

export const KIND_LABEL: Record<NodeKind, string> = {
  ability: "Cognitive Ability",
  meta: "Executive / Meta Skill",
  competency: "Learned Competency",
  knowledge: "Knowledge Asset",
  enabler: "Physiological Enabler",
  social: "Social-Emotional Skill",
  augmentation: "Augmentation Skill",
};

export const KIND_BLURB: Record<NodeKind, string> = {
  ability:
    "A latent capacity. Moves slowly, is measured by timed performance, and rarely transfers far.",
  meta: "Control over your own cognition. Improves through successful application, not repetition.",
  competency:
    "A trainable performance skill. Responds strongly to deliberate practice with feedback.",
  knowledge:
    "Content you can retrieve. Responds to retrieval practice and spacing; forgets on a schedule.",
  enabler:
    "A physiological or behavioural precondition. Gates other capabilities more than it produces them.",
  social:
    "A skill exercised with other people. Only real-world demonstration counts as evidence.",
  augmentation:
    "Cognition performed through tools. Measured by the quality of the tool-assisted output.",
};

/** Short glyph used in dense listings and the graph legend. */
export const KIND_GLYPH: Record<NodeKind, string> = {
  ability: "◆",
  meta: "◇",
  competency: "●",
  knowledge: "▲",
  enabler: "▬",
  social: "◐",
  augmentation: "⬡",
};

export const CONSTRUCT_LABEL: Record<CognitiveConstruct, string> = {
  "fluid-reasoning": "Fluid reasoning (Gf)",
  "crystallized-knowledge": "Crystallized knowledge (Gc)",
  "visual-processing": "Visual processing (Gv)",
  "auditory-processing": "Auditory processing (Ga)",
  "working-memory": "Working memory (Gwm)",
  "processing-speed": "Processing speed (Gs)",
  "learning-retrieval": "Learning & retrieval (Glr)",
  quantitative: "Quantitative knowledge (Gq)",
  "reading-writing": "Reading & writing (Grw)",
  "executive-control": "Executive control",
  psychomotor: "Psychomotor (Gp)",
  "socio-emotional": "Socio-emotional",
};

/**
 * Whether a construct is part of the CHC broad-ability model proper. The two
 * that are not are still useful buckets, but the UI must not imply they carry
 * the same psychometric backing.
 */
export const CHC_CORE: Record<CognitiveConstruct, boolean> = {
  "fluid-reasoning": true,
  "crystallized-knowledge": true,
  "visual-processing": true,
  "auditory-processing": true,
  "working-memory": true,
  "processing-speed": true,
  "learning-retrieval": true,
  quantitative: true,
  "reading-writing": true,
  psychomotor: true,
  "executive-control": false,
  "socio-emotional": false,
};

export const RELATION_LABEL: Record<LinkRelation, string> = {
  prerequisite: "Prerequisite",
  enabling: "Enabling condition",
  supporting: "Supporting factor",
  transfer: "Transfer",
  synergy: "Synergy",
  analogical: "Analogical relation",
  "shared-mechanism": "Shared mechanism",
  inhibition: "Inhibition",
};

export const RELATION_BLURB: Record<LinkRelation, string> = {
  prerequisite: "Training the target without this first mostly wastes the reps.",
  enabling: "A precondition rather than a contributor — it gates, it does not produce.",
  supporting: "Materially helps, but the target is trainable without it.",
  transfer: "Practising the source has been observed to move the target itself.",
  synergy: "Mutual reinforcement with no clear direction of causation.",
  analogical: "Structurally similar; useful as a teaching bridge, not a causal claim.",
  "shared-mechanism": "Both load the same underlying process, so both feel the same limits.",
  inhibition: "More of the source can cost the target. Usually a trade-off to manage.",
};

/** Default retention model implied by a node's kind. */
export const RETENTION_BY_KIND: Record<NodeKind, RetentionModel> = {
  ability: "procedural",
  meta: "meta",
  competency: "procedural",
  knowledge: "knowledge",
  enabler: "physical",
  social: "social",
  augmentation: "procedural",
};

export function retentionModelFor(node: {
  kind?: NodeKind;
  retentionModel?: RetentionModel;
}): RetentionModel {
  if (node.retentionModel) return node.retentionModel;
  return RETENTION_BY_KIND[node.kind ?? "competency"];
}

export const RETENTION_LABEL: Record<RetentionModel, string> = {
  knowledge: "Knowledge decay",
  procedural: "Fluency decay",
  "executive-habit": "Habit recency",
  physical: "Detraining",
  social: "Demonstration recency",
  meta: "Application frequency",
};

export function kindOf(node: ConceptNode): NodeKind {
  return node.kind ?? "competency";
}

/**
 * A single number for "how much should this node's estimate be trusted".
 * Used to rank Research Mode disclosures and to damp confident-sounding copy.
 */
export function evidenceWeight(band: EvidenceConfidence): number {
  return [0.35, 0.55, 0.8, 1][confidenceRank(band)];
}
