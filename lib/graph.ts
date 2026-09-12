import type { Edge, Node } from "@xyflow/react";
import bakedLayout from "@/data/layout.json";
import type { NodeEstimate } from "./competence.ts";
import { countEdgeBuild, countNodeBuild } from "./devtools.ts";
import type { Point } from "./layout.ts";
import { radiusForXp, tierForXp } from "./mastery.ts";
import type { RetentionState } from "./retention.ts";
import type {
  Category,
  ConceptNode,
  EvidenceConfidence,
  IntelligenceData,
  LinkRelation,
  LinkType,
} from "./types.ts";

export interface ConceptNodeData extends Record<string, unknown> {
  label: string;
  hue: number;
  xp: number;
  tierIndex: number;
  radius: number;
  opacity: number;
  glow: number;
  lightness: number;
  chroma: number;
  categoryLabel: string;
  retention: number;
  decaying: boolean;
  /** 0-1 competence estimate. Drives the inner core's brightness. */
  competence: number;
  /** True when the estimate rests on nothing but self-report. */
  unproven: boolean;
  /** Highlighted as part of an active path or goal. */
  onPath: boolean;
  /** Flagged by the review inbox as needing attention. */
  flagged: boolean;
  dimmed: boolean;
  contextDimmed: boolean;
  focusMode: boolean;
}

export interface SynapseEdgeData extends Record<string, unknown> {
  hue: number;
  strength: number;
  synergy: boolean;
  inhibition: boolean;
  relation: LinkRelation;
  /** 0-1 from the edge's stated confidence. Drives opacity. */
  certainty: number;
  dimmed: boolean;
  highlighted: boolean;
  contextDimmed: boolean;
  burstKey: string | null;
}

export type ConceptFlowNode = Node<ConceptNodeData, "concept">;
export type SynapseFlowEdge = Edge<SynapseEdgeData, "synapse">;

const LAYOUT = bakedLayout as Record<string, Point>;

/**
 * React Flow shallow-compares node/edge objects. These caches preserve identity
 * whenever a derived visual signature is unchanged, so logging one exercise
 * does not cause the other ~138 nodes or unrelated synapses to re-render.
 */
const NODE_CACHE = new Map<string, { signature: string; value: ConceptFlowNode }>();
const EDGE_CACHE = new Map<string, { signature: string; value: SynapseFlowEdge }>();

export function positionOf(nodeId: string): Point {
  return LAYOUT[nodeId] ?? { x: 0, y: 0 };
}

export function indexBy<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * Which nodes survive the current filters.
 *
 * Text matching is delegated to `lib/search.ts` via `searchMatches`, so the
 * map dims to the same set the search box lists — including synonym hits. A
 * separate substring check here would quietly disagree with the results the
 * user is looking at.
 */
export function matchingNodeIds(
  data: IntelligenceData,
  searchMatches: Set<string> | null,
  activeCategories: Set<string>,
): Set<string> | null {
  const filteringByCategory = activeCategories.size > 0;
  if (!searchMatches && !filteringByCategory) return null;

  const matches = new Set<string>();
  for (const node of data.nodes) {
    if (filteringByCategory && !activeCategories.has(node.categoryId)) continue;
    if (searchMatches && !searchMatches.has(node.id)) continue;
    matches.add(node.id);
  }
  return matches;
}

const CERTAINTY: Record<EvidenceConfidence, number> = {
  strong: 1,
  moderate: 0.78,
  emerging: 0.55,
  speculative: 0.36,
};

/**
 * Visual encoding, deliberately layered rather than simultaneous.
 *
 * At rest the map shows category (hue) and practice (size) — the two things
 * that make it navigable. Competence modulates the core's brightness, retention
 * modulates the glow, and the low-confidence ring only appears on nodes with
 * real practice behind an unproven estimate. Path and inbox highlighting are
 * interaction states rather than permanent channels, because encoding all six
 * at once produces a map nobody can read.
 */
export interface BuildNodesOptions {
  xpByNodeId: Record<string, number>;
  categories: Map<string, Category>;
  estimates: Record<string, NodeEstimate>;
  retentionByNodeId: Record<string, RetentionState>;
  visible: Set<string> | null;
  selectedId?: string | null;
  focusIds?: Set<string> | null;
  focusMode?: boolean;
  pathIds?: Set<string> | null;
  flaggedIds?: Set<string> | null;
}

export function buildNodes(
  data: IntelligenceData,
  options: BuildNodesOptions,
): ConceptFlowNode[] {
  const {
    xpByNodeId,
    categories,
    estimates,
    retentionByNodeId,
    visible,
    selectedId = null,
    focusIds = null,
    focusMode = false,
    pathIds = null,
    flaggedIds = null,
  } = options;

  return data.nodes.map((node) => {
    const xp = xpByNodeId[node.id] ?? 0;
    const tier = tierForXp(xp);
    const radius = radiusForXp(xp);
    const category = categories.get(node.categoryId);
    const position = positionOf(node.id);
    const estimate = estimates[node.id];
    const retention = retentionByNodeId[node.id]?.retention ?? 1;
    const trained = (retentionByNodeId[node.id]?.repetitions ?? 0) > 0;
    const competence = estimate?.competence ?? 0;
    const unproven = Boolean(
      estimate && estimate.practice > 0.15 && estimate.strongObservations === 0,
    );
    const selected = node.id === selectedId;
    const inFocusContext = focusIds?.has(node.id) ?? false;
    const onPath = pathIds?.has(node.id) ?? false;
    const flagged = flaggedIds?.has(node.id) ?? false;
    const dimmed = visible ? !visible.has(node.id) : false;
    const contextDimmed = focusIds ? !inFocusContext : false;
    const size = radius * 2;

    const signature = [
      data.curriculumVersion,
      node.label,
      category?.label ?? "",
      category?.hue ?? 0,
      position.x,
      position.y,
      xp,
      retention.toFixed(3),
      competence.toFixed(3),
      trained ? 1 : 0,
      unproven ? 1 : 0,
      onPath ? 1 : 0,
      flagged ? 1 : 0,
      selected ? 1 : 0,
      dimmed ? 1 : 0,
      contextDimmed ? 1 : 0,
      focusMode ? 1 : 0,
    ].join("|");
    const cached = NODE_CACHE.get(node.id);
    if (cached?.signature === signature) return cached.value;
    // A cache miss means this node is about to be recreated, which costs React
    // Flow a re-render. In development the counter makes a broken signature
    // visible immediately instead of as unexplained sluggishness later.
    countNodeBuild(node.id);

    const decaying = trained && retention < 0.9;
    const ariaParts = [
      node.label,
      category?.label ?? "faculty",
      tier.name,
      // An untouched node reads out the prior. Saying "estimated competence"
      // there implies something was estimated from evidence about this person.
      trained
        ? `${Math.round(competence * 100)} percent estimated competence`
        : `${Math.round(competence * 100)} percent, the starting assumption rather than a measurement`,
      trained ? `${Math.round(retention * 100)} percent retention` : "never trained",
    ];
    if (unproven) ariaParts.push("no scored evidence yet");
    if (onPath) ariaParts.push("on your active path");
    if (flagged) ariaParts.push("needs review");

    const value = {
      id: node.id,
      type: "concept",
      position: { x: position.x - radius, y: position.y - radius },
      width: size,
      height: size,
      ariaRole: "button",
      ariaLabel: ariaParts.join(", "),
      focusable: true,
      data: {
        label: node.label,
        hue: category?.hue ?? 0,
        xp,
        tierIndex: tier.index,
        radius,
        opacity: tier.opacity,
        glow: tier.glow * retention,
        lightness: tier.lightness,
        chroma: tier.chroma,
        categoryLabel: category?.label ?? "",
        retention,
        decaying,
        competence,
        unproven,
        onPath,
        flagged,
        dimmed,
        contextDimmed,
        focusMode,
      },
      selected,
      zIndex: selected ? 20 : inFocusContext || onPath ? 10 : 0,
      draggable: false,
    } satisfies ConceptFlowNode;

    NODE_CACHE.set(node.id, { signature, value });
    return value;
  });
}

export interface BuildEdgesOptions {
  xpByNodeId: Record<string, number>;
  categories: Map<string, Category>;
  nodesById: Map<string, ConceptNode>;
  visible: Set<string> | null;
  selectedId?: string | null;
  focusIds?: Set<string> | null;
  focusMode?: boolean;
  burstSignal?: { id: string; nodeId: string } | null;
  /** Relations the user has chosen to hide. */
  hiddenRelations?: Set<LinkRelation>;
  /** When a node is selected, lateral edges elsewhere are dropped entirely. */
  declutter?: boolean;
}

export function buildEdges(
  data: IntelligenceData,
  options: BuildEdgesOptions,
): SynapseFlowEdge[] {
  const {
    xpByNodeId,
    categories,
    nodesById,
    visible,
    selectedId = null,
    focusIds = null,
    focusMode = false,
    burstSignal = null,
    hiddenRelations,
    declutter = true,
  } = options;

  return data.links.map((link) => {
    const edgeId = `${link.source}--${link.target}`;
    const relation: LinkRelation =
      link.relation ?? (link.type === "prereq" ? "prerequisite" : "synergy");
    const type: LinkType = link.type;
    const sourceTier = tierForXp(xpByNodeId[link.source] ?? 0).index;
    const targetTier = tierForXp(xpByNodeId[link.target] ?? 0).index;
    const strength = Math.min(sourceTier, targetTier);
    const sourceCategory = nodesById.get(link.source)?.categoryId;
    const hue = categories.get(sourceCategory ?? "")?.hue ?? 0;
    const certainty = CERTAINTY[link.confidence ?? "emerging"];
    const highlighted = Boolean(
      selectedId && (link.source === selectedId || link.target === selectedId),
    );
    const inFocusContext = focusIds
      ? focusIds.has(link.source) && focusIds.has(link.target)
      : highlighted;

    // Edge legibility: with 280 edges over 139 nodes, drawing every lateral
    // relation at all times produces a hairball. Dependencies stay visible
    // because they carry the map's structure; lateral edges become a selection
    // affordance instead.
    const lateral = type !== "prereq";
    const suppressed = declutter && lateral && Boolean(selectedId) && !highlighted;
    const hidden = Boolean(
      (focusMode && focusIds && !inFocusContext) ||
        hiddenRelations?.has(relation) ||
        suppressed,
    );
    const dimmed = visible
      ? !visible.has(link.source) || !visible.has(link.target)
      : false;
    const contextDimmed = Boolean(selectedId) && !inFocusContext;
    const bursts = Boolean(
      burstSignal &&
        (link.source === burstSignal.nodeId || link.target === burstSignal.nodeId),
    );
    const burstKey = bursts && burstSignal ? burstSignal.id : null;

    const signature = [
      data.curriculumVersion,
      link.source,
      link.target,
      relation,
      hue,
      strength,
      certainty.toFixed(2),
      hidden ? 1 : 0,
      dimmed ? 1 : 0,
      highlighted ? 1 : 0,
      contextDimmed ? 1 : 0,
      burstKey ?? "",
    ].join("|");
    const cached = EDGE_CACHE.get(edgeId);
    if (cached?.signature === signature) return cached.value;
    countEdgeBuild(edgeId);

    const value = {
      id: edgeId,
      source: link.source,
      target: link.target,
      type: "synapse",
      hidden,
      focusable: false,
      data: {
        hue,
        strength,
        synergy: type === "synergy",
        inhibition: type === "inhibition",
        relation,
        certainty,
        dimmed,
        highlighted,
        contextDimmed,
        burstKey,
      },
      zIndex: highlighted ? 5 : inFocusContext ? 2 : 0,
    } satisfies SynapseFlowEdge;

    EDGE_CACHE.set(edgeId, { signature, value });
    return value;
  });
}

export interface Neighbor {
  id: string;
  type: LinkType;
  relation: LinkRelation;
  direction: "in" | "out";
  strength: number;
  confidence: EvidenceConfidence;
  mechanism?: string;
  conditional?: string;
}

export function neighborsOf(data: IntelligenceData, nodeId: string): Neighbor[] {
  const out: Neighbor[] = [];
  for (const link of data.links) {
    const direction =
      link.source === nodeId ? "out" : link.target === nodeId ? "in" : null;
    if (!direction) continue;
    out.push({
      id: direction === "out" ? link.target : link.source,
      type: link.type,
      relation: link.relation ?? (link.type === "prereq" ? "prerequisite" : "synergy"),
      direction,
      strength: link.strength ?? (link.type === "prereq" ? 0.6 : 0.35),
      confidence: link.confidence ?? "emerging",
      mechanism: link.mechanism,
      conditional: link.conditional,
    });
  }
  return out;
}
