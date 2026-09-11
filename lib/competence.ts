import { confidenceRank } from "./evidence.ts";
import { MAX_XP } from "./mastery.ts";
import type { RetentionState } from "./retention.ts";
import type {
  CapstoneRecord,
  ConceptNode,
  DiagnosticResult,
  EvidenceConfidence,
  EvidenceKind,
  LogEntry,
  MissionRecord,
} from "./types.ts";

/**
 * Practice is not competence.
 *
 * XP answers "how much have you done", which is a progression signal and a
 * perfectly good one. It does not answer "how good are you", and using it for
 * both is the central dishonesty of every points-based learning product: forty
 * self-certified daily ticks and one scored diagnostic produce the same number,
 * even though only one of them is evidence.
 *
 * This module keeps four values apart and refuses to average them:
 *
 *   practice    exposure volume, derived from XP
 *   competence  an estimate of ability, derived only from things that could
 *               have gone badly — scored probes, judged artifacts, capstones
 *   retention   how much of it would survive a test right now
 *   confidence  how much the competence number deserves to be believed
 */

/** How much a single observation is worth as evidence about ability. */
export const EVIDENCE_WEIGHT: Record<EvidenceKind, number> = {
  // A tick that says "I did the thing". Barely evidence; counted so that a
  // long, honest practice history is not worth literally nothing.
  "self-report": 0.25,
  // Work was produced and can be re-read. Weak but real.
  artifact: 1.2,
  // Something was actually scored against a criterion.
  scored: 3,
  // Demonstrated outside Neuron, with a real-world consequence attached.
  external: 3.5,
};

/** Observations older than this contribute half as much. */
const OBSERVATION_HALF_LIFE_DAYS = 200;

/**
 * Prior for an untrained node, and its weight in observations. Weak enough
 * that four scored reps dominate it, strong enough that one lucky rep does not
 * produce "competence: 94%".
 */
const PRIOR_MEAN = 0.12;
const PRIOR_WEIGHT = 2.5;

/**
 * Difficulty adjustment. Scoring 0.8 on a difficulty-5 task implies more than
 * scoring 0.8 on a difficulty-1 task, so the observed score is scaled toward
 * what it implies about the underlying ability.
 */
export function difficultyFactor(difficulty: number): number {
  return 0.62 + 0.115 * Math.min(5, Math.max(1, difficulty));
}

export type EstimateConfidence = "none" | "low" | "medium" | "high";

export const ESTIMATE_CONFIDENCE_LABEL: Record<EstimateConfidence, string> = {
  none: "No estimate",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export interface CompetenceObservation {
  kind: EvidenceKind;
  /** 0-1 performance implied by this observation. */
  signal: number;
  /** Recency- and evidence-weighted contribution. */
  weight: number;
  at: string;
  source: string;
}

export interface NodeEstimate {
  nodeId: string;
  /** 0-1 exposure volume. XP-derived; the gamified progression number. */
  practice: number;
  /** Raw lifetime XP, kept for display and for the progression system. */
  xp: number;
  /** 0-1 ability estimate from evidence that could have gone badly. */
  competence: number;
  /** 0-1 share of peak capability that would survive a test right now. */
  retention: number;
  /** Competence discounted by retention — the "right now" number. */
  effectiveCompetence: number;
  confidence: EstimateConfidence;
  /** Total evidence weight behind the estimate, excluding the prior. */
  evidenceWeight: number;
  /** Count of observations that were more than a self-reported tick. */
  strongObservations: number;
  observations: CompetenceObservation[];
  /** ISO date of the most recent observation of any kind. */
  lastEvidenceAt: string | null;
  /** Why the confidence band is what it is. */
  confidenceReason: string;
}

function recencyWeight(at: string, nowMs: number): number {
  const time = new Date(at).getTime();
  if (Number.isNaN(time)) return 0;
  const ageDays = Math.max(0, (nowMs - time) / 864e5);
  return Math.pow(0.5, ageDays / OBSERVATION_HALF_LIFE_DAYS);
}

export interface EstimateInput {
  node: Pick<ConceptNode, "id" | "evidence">;
  logs: LogEntry[];
  diagnostics: DiagnosticResult[];
  missions: MissionRecord[];
  capstones: CapstoneRecord[];
  /** Node ids each mission covers, so a mission can credit several nodes. */
  missionNodeIds: (missionId: string) => string[];
  retention: RetentionState;
  /** Lifetime XP for the node, before decay. */
  xp: number;
}

/**
 * Turns one log into an ability signal.
 *
 * A log with an explicit `score` is used directly. A log with a self-rated
 * `quality` is used, discounted, because self-rating is systematically
 * generous. A bare completion carries a deliberately unimpressive default:
 * finishing a task you chose, at a difficulty you chose, tells us you showed
 * up — which is what the practice number is for.
 */
function signalForLog(log: LogEntry): number {
  const difficulty = log.difficulty ?? 2;
  if (typeof log.score === "number") {
    return Math.min(1, log.score * difficultyFactor(difficulty));
  }
  if (typeof log.quality === "number") {
    return Math.min(1, log.quality * 0.85 * difficultyFactor(difficulty));
  }
  return Math.min(1, 0.55 * difficultyFactor(difficulty));
}

/**
 * A cheap fingerprint of a rep's written work.
 *
 * Case- and whitespace-insensitive so that reformatting does not defeat it,
 * and truncated so that appending a word to the same paragraph does not mint a
 * fresh observation.
 */
function artifactFingerprint(note: string): string {
  return note.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 400);
}

export function estimateNode(input: EstimateInput, now = new Date()): NodeEstimate {
  const nowMs = now.getTime();
  const observations: CompetenceObservation[] = [];

  /**
   * Anti-gaming: the same written work, submitted again, is not a second
   * observation.
   *
   * Without this, pasting one good paragraph into a weekly exercise four times
   * produces four artifact-weighted observations and a competence estimate
   * built on one piece of work. The rep still counts as practice — it happened,
   * and the XP is not clawed back — but it stops being evidence about ability.
   */
  const seenArtifacts = new Set<string>();

  for (const log of input.logs) {
    let kind = log.evidence ?? "self-report";

    if ((kind === "artifact" || kind === "external") && log.note) {
      const fingerprint = artifactFingerprint(log.note);
      if (seenArtifacts.has(fingerprint)) kind = "self-report";
      else seenArtifacts.add(fingerprint);
    }

    const weight = EVIDENCE_WEIGHT[kind] * recencyWeight(log.at, nowMs);
    if (weight <= 0) continue;
    observations.push({
      kind,
      signal: signalForLog(log),
      weight,
      at: log.at,
      source: kind === (log.evidence ?? "self-report") ? "Logged practice" : "Repeated work",
    });
  }

  for (const result of input.diagnostics) {
    if (!result.nodeIds.includes(input.node.id)) continue;
    // More items means a less noisy estimate, but with diminishing returns.
    const itemScale = Math.min(2, Math.sqrt(Math.max(1, result.items) / 5));
    const weight = EVIDENCE_WEIGHT.scored * itemScale * recencyWeight(result.at, nowMs);
    observations.push({
      kind: "scored",
      signal: Math.min(1, result.score * difficultyFactor(result.difficulty)),
      weight,
      at: result.at,
      source: `Diagnostic · ${result.items} items`,
    });
  }

  for (const mission of input.missions) {
    if (!mission.completedAt) continue;
    if (!input.missionNodeIds(mission.missionId).includes(input.node.id)) continue;
    // A mission is multi-node transfer evidence: real, but shared out across
    // every capability it exercised rather than fully credited to each.
    observations.push({
      kind: "artifact",
      signal: Math.min(1, (mission.quality ?? 0.6) * difficultyFactor(4)),
      weight: EVIDENCE_WEIGHT.artifact * 1.8 * recencyWeight(mission.completedAt, nowMs),
      at: mission.completedAt,
      source: "Transfer mission",
    });
  }

  for (const capstone of input.capstones) {
    if (!capstone.nodeIds.includes(input.node.id)) continue;
    observations.push({
      kind: "external",
      signal: Math.min(1, (capstone.rubricScore ?? 0.65) * difficultyFactor(5)),
      weight: EVIDENCE_WEIGHT.external * 1.5 * recencyWeight(capstone.submittedAt, nowMs),
      at: capstone.submittedAt,
      source: "Capstone",
    });
  }

  let weighted = PRIOR_MEAN * PRIOR_WEIGHT;
  let total = PRIOR_WEIGHT;
  let evidenceWeight = 0;
  let strongObservations = 0;
  let lastEvidenceAt: string | null = null;

  for (const observation of observations) {
    weighted += observation.signal * observation.weight;
    total += observation.weight;
    evidenceWeight += observation.weight;
    if (observation.kind !== "self-report") strongObservations += 1;
    if (!lastEvidenceAt || observation.at > lastEvidenceAt) lastEvidenceAt = observation.at;
  }

  const competence = Math.min(1, Math.max(0, weighted / total));
  const practice = Math.min(1, input.xp / MAX_XP);
  const retention = input.retention.retention;

  const { confidence, reason } = confidenceFor(
    evidenceWeight,
    strongObservations,
    input.node.evidence?.constructValidity,
  );

  return {
    nodeId: input.node.id,
    practice,
    xp: input.xp,
    competence,
    retention,
    effectiveCompetence: competence * (0.55 + 0.45 * retention),
    confidence,
    evidenceWeight,
    strongObservations,
    observations,
    lastEvidenceAt,
    confidenceReason: reason,
  };
}

/**
 * Estimate confidence.
 *
 * Capped by how measurable the construct is in the first place: it is not
 * possible to be highly confident about someone's Reflective Solitude no
 * matter how many boxes they tick, because there is no measurement behind it.
 * That cap is the honest part of this function.
 */
export function confidenceFor(
  evidenceWeight: number,
  strongObservations: number,
  constructValidity: EvidenceConfidence | undefined,
): { confidence: EstimateConfidence; reason: string } {
  if (evidenceWeight <= 0) {
    return {
      confidence: "none",
      reason: "No observations yet — this is the untrained prior, not a measurement.",
    };
  }

  let level: EstimateConfidence;
  if (strongObservations >= 4 && evidenceWeight >= 9) level = "high";
  else if (strongObservations >= 2 && evidenceWeight >= 4) level = "medium";
  else level = "low";

  const validity = constructValidity ?? "emerging";
  const cap: EstimateConfidence =
    confidenceRank(validity) >= 3 ? "high" : confidenceRank(validity) >= 2 ? "medium" : "low";
  const order: EstimateConfidence[] = ["none", "low", "medium", "high"];
  const capped = order[Math.min(order.indexOf(level), order.indexOf(cap))];

  const base =
    strongObservations === 0
      ? `Based on ${evidenceWeight.toFixed(1)} weighted observations, all self-reported.`
      : `Based on ${strongObservations} scored or judged observation${strongObservations === 1 ? "" : "s"} (${evidenceWeight.toFixed(1)} weighted).`;

  const note =
    capped !== level
      ? ` Capped at ${capped} because construct validity for this node is ${validity} — the measurement itself is the limit, not your evidence.`
      : "";

  return { confidence: capped, reason: base + note };
}

/**
 * The single number the graph paints with.
 *
 * Practice dominates early so that the map visibly responds to a first week of
 * work, then competence takes over as evidence accumulates. Without the first
 * half nothing happens for a month; without the second half the brightest node
 * on the map is whichever one you clicked most.
 */
export function displayStrength(estimate: NodeEstimate): number {
  const evidenceShare = Math.min(1, estimate.evidenceWeight / 8);
  return (
    estimate.practice * (1 - evidenceShare * 0.7) +
    estimate.effectiveCompetence * evidenceShare * 0.7
  );
}

/** Gap between how much you have practised and how much you can show for it. */
export function practiceCompetenceGap(estimate: NodeEstimate): number {
  return estimate.practice - estimate.competence;
}
