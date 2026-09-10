import type { Edge, Node } from "@xyflow/react";
import bakedLayout from "@/data/layout.json";
import type { Point } from "./layout";
import { radiusForXp, tierForXp } from "./mastery";
import type { Category, ConceptNode, IntelligenceData } from "./types";

export interface ConceptNodeData extends Record<string, unknown> {
  label: string;
  hue: number;
  xp: number;
  /** Mastery tier index, 0-4. */
  tierIndex: number;
  radius: number;
  opacity: number;
  glow: number;
  lightness: number;
  chroma: number;
  categoryLabel: string;
  /** Dimmed by search or a legend filter — still visible, but receded. */
  dimmed: boolean;
}

export interface SynapseEdgeData extends Record<string, unknown> {
  hue: number;
  /** min(tier of source, tier of target) — drives how alive the edge looks. */
  strength: number;
  synergy: boolean;
  dimmed: boolean;
}

export type ConceptFlowNode = Node<ConceptNodeData, "concept">;
export type SynapseFlowEdge = Edge<SynapseEdgeData, "synapse">;

/**
 * Positions are precomputed by `npm run bake:layout` rather than simulated at
 * runtime — the force pass costs ~500ms of blocked main thread for a result
 * that is identical on every load. Any node missing from the baked file (added
 * to the data but not yet re-baked) falls back to the origin, which is visibly
 * wrong on purpose rather than silently misplaced.
 */
const LAYOUT = bakedLayout as Record<string, Point>;

export function positionOf(nodeId: string): Point {
  return LAYOUT[nodeId] ?? { x: 0, y: 0 };
}

export function indexBy<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * Which nodes a filter leaves highlighted. Returns null when nothing is
 * filtered, so callers can skip the dimming work entirely.
 */
export function matchingNodeIds(
  data: IntelligenceData,
  search: string,
  activeCategories: Set<string>,
): Set<string> | null {
  const query = search.trim().toLowerCase();
  const filteringByCategory = activeCategories.size > 0;
  if (!query && !filteringByCategory) return null;

  const matches = new Set<string>();
  for (const node of data.nodes) {
    if (filteringByCategory && !activeCategories.has(node.categoryId)) continue;
    if (
      query &&
      !node.label.toLowerCase().includes(query) &&
      !node.description.toLowerCase().includes(query)
    ) {
      continue;
    }
    matches.add(node.id);
  }
  return matches;
}

export function buildNodes(
  data: IntelligenceData,
  xpByNodeId: Record<string, number>,
  categories: Map<string, Category>,
  visible: Set<string> | null,
): ConceptFlowNode[] {
  return data.nodes.map((node) => {
    const xp = xpByNodeId[node.id] ?? 0;
    const tier = tierForXp(xp);
    const radius = radiusForXp(xp);
    const category = categories.get(node.categoryId);
    const position = positionOf(node.id);

    const size = radius * 2;

    return {
      id: node.id,
      type: "concept",
      // React Flow positions by top-left corner, so offset by the radius to
      // keep the orb centred on its computed point as it grows.
      position: { x: position.x - radius, y: position.y - radius },
      // Declared rather than measured. This array is rebuilt on every XP change
      // and these fresh objects carry no `measured` field, so anything reading
      // dimensions off the node itself — the MiniMap especially — would treat
      // every node as unsized. We know the exact size, so we state it.
      width: size,
      height: size,
      data: {
        label: node.label,
        hue: category?.hue ?? 0,
        xp,
        tierIndex: tier.index,
        radius,
        opacity: tier.opacity,
        glow: tier.glow,
        lightness: tier.lightness,
        chroma: tier.chroma,
        categoryLabel: category?.label ?? "",
        dimmed: visible ? !visible.has(node.id) : false,
      },
      draggable: false,
    } satisfies ConceptFlowNode;
  });
}

export function buildEdges(
  data: IntelligenceData,
  xpByNodeId: Record<string, number>,
  categories: Map<string, Category>,
  nodesById: Map<string, ConceptNode>,
  visible: Set<string> | null,
): SynapseFlowEdge[] {
  return data.links.map((link) => {
    const sourceTier = tierForXp(xpByNodeId[link.source] ?? 0).index;
    const targetTier = tierForXp(xpByNodeId[link.target] ?? 0).index;
    // An edge is only as alive as its weaker end — a synapse needs both sides.
    const strength = Math.min(sourceTier, targetTier);

    const sourceCategory = nodesById.get(link.source)?.categoryId;
    const hue = categories.get(sourceCategory ?? "")?.hue ?? 0;

    return {
      id: `${link.source}--${link.target}`,
      source: link.source,
      target: link.target,
      type: "synapse",
      data: {
        hue,
        strength,
        synergy: link.type === "synergy",
        dimmed: visible
          ? !visible.has(link.source) || !visible.has(link.target)
          : false,
      },
    } satisfies SynapseFlowEdge;
  });
}

/** Neighbours of a node, for the side panel's connection chips. */
export function neighborsOf(
  data: IntelligenceData,
  nodeId: string,
): { id: string; type: "prereq" | "synergy"; direction: "in" | "out" }[] {
  const out: { id: string; type: "prereq" | "synergy"; direction: "in" | "out" }[] =
    [];
  for (const link of data.links) {
    if (link.source === nodeId)
      out.push({ id: link.target, type: link.type, direction: "out" });
    else if (link.target === nodeId)
      out.push({ id: link.source, type: link.type, direction: "in" });
  }
  return out;
}
