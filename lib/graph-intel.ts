import type { NodeEstimate } from "./competence.ts";
import { categoriesById, curriculum } from "./curriculum.ts";
import type { LearnerModel } from "./learner.ts";
import type { ConceptNode, Link } from "./types.ts";

/**
 * Graph-level intelligence.
 *
 * Every other view answers a question about one node. This module answers
 * questions about the shape of the whole capability graph: where the
 * bottlenecks are, which single improvement unblocks the most, where strength
 * is stranded with nothing built on it, and which cluster has been quietly
 * abandoned.
 *
 * Everything here is derived from the curriculum's directed edges plus the
 * learner model, and every finding carries the numbers it was computed from —
 * an insight the user cannot audit is indistinguishable from a horoscope.
 */

export interface GraphIndex {
  /** Directed prerequisite/enabling edges: source *gates* target. */
  downstream: Map<string, string[]>;
  upstream: Map<string, string[]>;
  /** All edges regardless of direction, for degree and clustering. */
  adjacent: Map<string, string[]>;
  /** Transitive closure over influence edges — what a gain here could move. */
  reach: Map<string, Set<string>>;
}

/**
 * Two different directed subgraphs, kept apart on purpose.
 *
 * Gating edges answer "what must I train first", and only a prerequisite or an
 * enabling condition makes that claim; ordering a plan by anything weaker would
 * invent obligations the curriculum never asserted. Influence edges answer
 * "what would a gain here move", which is a broader and looser question, so
 * supporting and transfer edges belong in it. Using one set for both was the
 * bug: leverage came out far too small, because most of the graph's real
 * downstream value flows along supporting edges.
 */
const GATING_RELATIONS = new Set(["prerequisite", "enabling"]);
const INFLUENCE_RELATIONS = new Set([
  "prerequisite",
  "enabling",
  "supporting",
  "transfer",
]);

function relationOf(link: Link): string {
  return link.relation ?? (link.type === "prereq" ? "prerequisite" : "synergy");
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Built once at module load: the curriculum's topology does not change at
 * runtime, and recomputing a transitive closure on every render would be the
 * single most expensive thing in the app.
 */
export function buildIndex(links: Link[]): GraphIndex {
  const downstream = new Map<string, string[]>();
  const upstream = new Map<string, string[]>();
  const adjacent = new Map<string, string[]>();
  const influence = new Map<string, string[]>();

  for (const link of links) {
    const relation = relationOf(link);
    push(adjacent, link.source, link.target);
    push(adjacent, link.target, link.source);
    if (INFLUENCE_RELATIONS.has(relation)) push(influence, link.source, link.target);
    if (!GATING_RELATIONS.has(relation)) continue;
    push(downstream, link.source, link.target);
    push(upstream, link.target, link.source);
  }

  // Memoised depth-first closure over the influence subgraph. The validator
  // rejects cycles among gating edges but not among supporting ones, so the
  // stack guard here is doing real work rather than being defensive.
  const reach = new Map<string, Set<string>>();
  const visit = (id: string, stack: Set<string>): Set<string> => {
    const cached = reach.get(id);
    if (cached) return cached;
    if (stack.has(id)) return new Set();
    stack.add(id);
    const out = new Set<string>();
    for (const next of influence.get(id) ?? []) {
      out.add(next);
      for (const further of visit(next, stack)) out.add(further);
    }
    stack.delete(id);
    // Only cache a result computed outside any cycle: a set computed while the
    // stack was cut short by the guard above is incomplete, and caching it
    // would make the closure depend on traversal order.
    if (stack.size === 0) reach.set(id, out);
    return out;
  };
  for (const link of links) visit(link.source, new Set());

  return { downstream, upstream, adjacent, reach };
}

export const GRAPH_INDEX = buildIndex(curriculum.links);

export function downstreamOf(nodeId: string): string[] {
  return [...(GRAPH_INDEX.reach.get(nodeId) ?? [])];
}

export function directPrerequisites(nodeId: string): string[] {
  return GRAPH_INDEX.upstream.get(nodeId) ?? [];
}

// ── Findings ──────────────────────────────────────────────────────────────
export type FindingKind =
  | "bottleneck"
  | "high-leverage"
  | "isolated-strength"
  | "weak-bridge"
  | "prerequisite-gap"
  | "over-practised"
  | "neglected-cluster"
  | "narrow-development"
  | "unproven";

export interface GraphFinding {
  kind: FindingKind;
  nodeIds: string[];
  headline: string;
  detail: string;
  /** 0-1 how much this deserves the user's attention right now. */
  priority: number;
  /** The raw numbers, so the claim can be checked rather than believed. */
  evidence: string;
}

interface AnalysisContext {
  model: LearnerModel;
  goalNodeIds: Set<string>;
  nodes: ConceptNode[];
}

const TRAINED_THRESHOLD = 0.35;
const WEAK_THRESHOLD = 0.3;

function competence(model: LearnerModel, nodeId: string): number {
  return model.estimates[nodeId]?.competence ?? 0;
}

function estimate(model: LearnerModel, nodeId: string): NodeEstimate | undefined {
  return model.estimates[nodeId];
}

/**
 * Bottlenecks: weak nodes with a lot of graph hanging off them.
 *
 * This is the highest-value thing the graph knows that no per-node view can
 * see. Weighted toward goal-relevant downstream nodes when a goal is active,
 * because "unblocks six capabilities" matters far more when those six are
 * capabilities you said you wanted.
 */
function findBottlenecks(context: AnalysisContext): GraphFinding[] {
  const findings: GraphFinding[] = [];

  for (const node of context.nodes) {
    const own = competence(context.model, node.id);
    if (own >= TRAINED_THRESHOLD) continue;

    const reach = downstreamOf(node.id);
    if (reach.length < 2) continue;

    // Only count downstream nodes the user is actually trying to develop:
    // a weak prerequisite under an untouched subtree blocks nothing yet.
    const engaged = reach.filter(
      (id) =>
        context.goalNodeIds.has(id) ||
        (context.model.estimates[id]?.practice ?? 0) > 0.05,
    );
    if (engaged.length === 0) continue;

    const goalRelevant = engaged.filter((id) => context.goalNodeIds.has(id));
    const priority = Math.min(
      1,
      (1 - own) * (0.25 + engaged.length * 0.1 + goalRelevant.length * 0.15),
    );
    if (priority < 0.2) continue;

    findings.push({
      kind: "bottleneck",
      nodeIds: [node.id, ...engaged.slice(0, 6)],
      headline: `${node.label} is holding up ${engaged.length} capabilit${engaged.length === 1 ? "y" : "ies"} you are already working on`,
      detail:
        goalRelevant.length > 0
          ? `Improving ${node.label} is likely to help ${goalRelevant.length} goal-relevant capabilit${goalRelevant.length === 1 ? "y" : "ies"} downstream of it. Prerequisite edges are the curriculum author's judgement, not an experimental result, so read this as a strong hint rather than a proof.`
          : `${node.label} gates ${engaged.length} capabilities you have started training. Working on them without it is likely to be slower than working on it first.`,
      priority,
      evidence: `Competence ${Math.round(own * 100)}% · ${reach.length} downstream nodes, ${engaged.length} of them active${goalRelevant.length ? `, ${goalRelevant.length} goal-relevant` : ""}.`,
    });
  }

  return findings.sort((a, b) => b.priority - a.priority).slice(0, 4);
}

/** Strong nodes with nothing built on top of them — capability with no outlet. */
function findIsolatedStrengths(context: AnalysisContext): GraphFinding[] {
  const findings: GraphFinding[] = [];
  for (const node of context.nodes) {
    const own = competence(context.model, node.id);
    if (own < 0.5) continue;
    const reach = downstreamOf(node.id);
    const developed = reach.filter((id) => competence(context.model, id) >= 0.3);
    if (reach.length === 0 || developed.length > 0) continue;

    findings.push({
      kind: "isolated-strength",
      nodeIds: [node.id, ...reach.slice(0, 5)],
      headline: `${node.label} is well developed with nothing built on it`,
      detail: `${reach.length} capabilit${reach.length === 1 ? "y depends" : "ies depend"} on ${node.label} and none of them have been trained. This is the cheapest kind of progress available to you: the foundation is already there.`,
      priority: Math.min(0.85, own * 0.6 + reach.length * 0.08),
      evidence: `Competence ${Math.round(own * 100)}% · ${reach.length} untrained downstream nodes.`,
    });
  }
  return findings.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

/** Nodes you have trained whose own prerequisites are weak. */
function findPrerequisiteGaps(context: AnalysisContext): GraphFinding[] {
  const findings: GraphFinding[] = [];
  for (const node of context.nodes) {
    const own = context.model.estimates[node.id];
    if (!own || own.practice < 0.15) continue;
    const weak = directPrerequisites(node.id).filter(
      (id) => competence(context.model, id) < WEAK_THRESHOLD,
    );
    if (weak.length === 0) continue;

    const labels = weak
      .map((id) => context.nodes.find((n) => n.id === id)?.label ?? id)
      .slice(0, 3);
    findings.push({
      kind: "prerequisite-gap",
      nodeIds: [node.id, ...weak],
      headline: `${node.label} is being trained on top of ${weak.length} weak prerequisite${weak.length === 1 ? "" : "s"}`,
      detail: `${labels.join(", ")} ${weak.length === 1 ? "is" : "are"} below 30% competence. Work here tends to plateau in a way that feels like a talent ceiling and is usually a missing foundation.`,
      priority: Math.min(0.9, own.practice * 0.5 + weak.length * 0.15),
      evidence: `Practice ${Math.round(own.practice * 100)}% on ${node.label}; prerequisites at ${weak
        .map((id) => `${Math.round(competence(context.model, id) * 100)}%`)
        .join(", ")}.`,
    });
  }
  return findings.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

/** Lots of reps, nothing that could have gone badly. */
function findOverPractised(context: AnalysisContext): GraphFinding[] {
  const findings: GraphFinding[] = [];
  for (const node of context.nodes) {
    const own = estimate(context.model, node.id);
    if (!own || own.practice < 0.3) continue;
    if (own.strongObservations > 0) continue;

    findings.push({
      kind: "over-practised",
      nodeIds: [node.id],
      headline: `${node.label}: ${Math.round(own.practice * 100)}% practice, no evidence`,
      detail: `Every rep here has been self-reported. That is practice volume, and Neuron counts it as practice volume — but the competence figure beside it is still essentially the untrained prior. A scored diagnostic or one judged artifact would change that more than another twenty reps.`,
      priority: Math.min(0.8, own.practice * 0.8),
      evidence: `Practice ${Math.round(own.practice * 100)}% · competence ${Math.round(own.competence * 100)}% · 0 scored or judged observations.`,
    });
  }
  return findings.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

/** Which clusters have been abandoned, and which one is carrying everything. */
function findClusterImbalance(context: AnalysisContext): GraphFinding[] {
  const byCategory = new Map<string, number[]>();
  for (const node of context.nodes) {
    const list = byCategory.get(node.categoryId) ?? [];
    list.push(competence(context.model, node.id));
    byCategory.set(node.categoryId, list);
  }

  const scored = [...byCategory.entries()]
    .map(([categoryId, values]) => ({
      categoryId,
      label: categoriesById.get(categoryId)?.label ?? categoryId,
      mean: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length),
      count: values.length,
    }))
    .filter((entry) => entry.count >= 3)
    .sort((a, b) => b.mean - a.mean);

  if (scored.length < 3) return [];
  const strongest = scored[0];
  const weakest = scored[scored.length - 1];
  if (strongest.mean < 0.2) return [];

  const findings: GraphFinding[] = [];

  // The interesting version of this is not "you are weak at X" but "the thing
  // you are strong at depends on the thing you are weak at".
  const strongNodes = context.nodes.filter(
    (node) => node.categoryId === strongest.categoryId,
  );
  const dependsOnWeak = strongNodes.filter((node) =>
    directPrerequisites(node.id).some((id) => {
      const prerequisite = context.nodes.find((n) => n.id === id);
      return (
        prerequisite?.categoryId === weakest.categoryId &&
        competence(context.model, id) < WEAK_THRESHOLD
      );
    }),
  );

  if (dependsOnWeak.length > 0) {
    findings.push({
      kind: "weak-bridge",
      nodeIds: dependsOnWeak.map((node) => node.id),
      headline: `Your ${strongest.label} cluster is strong, but parts of it depend on weaker ${weakest.label}`,
      detail: `${dependsOnWeak.length} of your ${strongest.label} capabilities have a prerequisite in ${weakest.label} that is still below 30%. That combination usually shows up as work that is fluent right up to the point where it needs the weaker skill.`,
      priority: 0.72,
      evidence: `${strongest.label} mean competence ${Math.round(strongest.mean * 100)}% · ${weakest.label} ${Math.round(weakest.mean * 100)}%.`,
    });
  }

  if (weakest.mean < 0.06 && strongest.mean > 0.3) {
    findings.push({
      kind: "neglected-cluster",
      nodeIds: context.nodes
        .filter((node) => node.categoryId === weakest.categoryId)
        .slice(0, 5)
        .map((node) => node.id),
      headline: `${weakest.label} is untouched`,
      detail: `Nothing in ${weakest.label} has meaningful practice while ${strongest.label} averages ${Math.round(strongest.mean * 100)}%. That may be a deliberate choice — breadth is not automatically better than depth — but it is worth it being a choice.`,
      priority: 0.45,
      evidence: `${weakest.count} nodes, mean competence ${Math.round(weakest.mean * 100)}%.`,
    });
  }

  return findings;
}

/** Breadth versus depth, stated without a recommendation attached. */
function findShape(context: AnalysisContext): GraphFinding[] {
  const touched = context.nodes.filter(
    (node) => (context.model.estimates[node.id]?.practice ?? 0) > 0.02,
  );
  if (touched.length < 5) return [];

  const deep = touched.filter(
    (node) => (context.model.estimates[node.id]?.competence ?? 0) >= 0.5,
  );
  const coverage = touched.length / context.nodes.length;

  if (deep.length === 0 && coverage > 0.3) {
    return [
      {
        kind: "narrow-development",
        nodeIds: touched.slice(0, 6).map((node) => node.id),
        headline: "Broad and shallow",
        detail: `You have touched ${touched.length} of ${context.nodes.length} capabilities and none has passed 50% competence. Spreading thin is a real strategy for exploration, and a poor one for producing anything demonstrable. If exploration is the aim, this is fine; if not, pick three.`,
        priority: 0.5,
        evidence: `${Math.round(coverage * 100)}% of the graph touched · 0 nodes above 50% competence.`,
      },
    ];
  }

  if (deep.length >= 2 && coverage < 0.12) {
    return [
      {
        kind: "narrow-development",
        nodeIds: deep.slice(0, 6).map((node) => node.id),
        headline: "Deep and narrow",
        detail: `${deep.length} capabilities are past 50% and you have touched only ${Math.round(coverage * 100)}% of the graph. Depth is where demonstrable ability comes from, so this is not a criticism — but transfer evidence is weakest precisely for narrow expertise, so expect it to stay where you put it.`,
        priority: 0.4,
        evidence: `${deep.length} nodes above 50% · ${touched.length} of ${context.nodes.length} touched.`,
      },
    ];
  }

  return [];
}

export function analyseGraph(
  model: LearnerModel,
  goalNodeIds: Set<string> = new Set(),
): GraphFinding[] {
  const context: AnalysisContext = { model, goalNodeIds, nodes: model.nodes };
  return [
    ...findBottlenecks(context),
    ...findPrerequisiteGaps(context),
    ...findIsolatedStrengths(context),
    ...findOverPractised(context),
    ...findClusterImbalance(context),
    ...findShape(context),
  ].sort((a, b) => b.priority - a.priority);
}

/**
 * Leverage score for the workout planner: how much of the graph a single
 * improvement here would unblock, normalised to 0-1.
 */
export function leverageScore(nodeId: string, goalNodeIds: Set<string>): number {
  const reach = GRAPH_INDEX.reach.get(nodeId);
  if (!reach || reach.size === 0) return 0;
  let score = Math.min(1, reach.size / 12) * 0.6;
  if (goalNodeIds.size > 0) {
    let goalHits = 0;
    for (const id of reach) if (goalNodeIds.has(id)) goalHits += 1;
    score += Math.min(1, goalHits / 4) * 0.4;
  }
  return Math.min(1, score);
}

/** Nodes whose prerequisites are all developed enough to build on. */
export function readyToBuild(model: LearnerModel, threshold = 0.4): string[] {
  const ready: string[] = [];
  for (const node of model.nodes) {
    const prerequisites = directPrerequisites(node.id);
    if (prerequisites.length === 0) continue;
    if ((model.estimates[node.id]?.competence ?? 0) >= threshold) continue;
    if (prerequisites.every((id) => (model.estimates[id]?.competence ?? 0) >= threshold)) {
      ready.push(node.id);
    }
  }
  return ready;
}
