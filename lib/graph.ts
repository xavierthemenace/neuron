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
  /** Ebbinghaus retention multiplier, 0.5-1 for trained nodes. */
  retention: number;
  decaying: boolean;
  /** Dimmed by search or a legend filter — still visible, but receded. */
  dimmed: boolean;
  /** Receded because another node is focused and this is outside its local network. */
  contextDimmed: boolean;
  focusMode: boolean;
}

export interface SynapseEdgeData extends Record<string, unknown> {
  hue: number;
  /** min(tier of source, tier of target) — drives how alive the edge looks. */
  strength: number;
  synergy: boolean;
  dimmed: boolean;
  /** True when this edge directly touches the focused node. */
  highlighted: boolean;
  /** Receded because a different edge is part of the focused node's local network. */
  contextDimmed: boolean;
  /** Changes when a connected exercise is logged, restarting the particle burst. */
  burstKey: string | null;
}

export type ConceptFlowNode = Node<ConceptNodeData, "concept">;
export type SynapseFlowEdge = Edge<SynapseEdgeData, "synapse">;

const LAYOUT = bakedLayout as Record<string, Point>;

export function positionOf(nodeId: string): Point {
  return LAYOUT[nodeId] ?? { x: 0, y: 0 };
}

export function indexBy<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Which nodes a filter leaves highlighted. */
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
  selectedId: string | null = null,
  focusIds: Set<string> | null = null,
  focusMode = false,
  retentionByNodeId: Record<string, number> = {},
): ConceptFlowNode[] {
  return data.nodes.map((node) => {
    const xp = xpByNodeId[node.id] ?? 0;
    const tier = tierForXp(xp);
    const radius = radiusForXp(xp);
    const category = categories.get(node.categoryId);
    const position = positionOf(node.id);
    const retention = retentionByNodeId[node.id] ?? 1;

    const size = radius * 2;
    const selected = node.id === selectedId;
    const inFocusContext = focusIds?.has(node.id) ?? false;

    return {
      id: node.id,
      type: "concept",
      position: { x: position.x - radius, y: position.y - radius },
      width: size,
      height: size,
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
        decaying: retention < 0.999,
        dimmed: visible ? !visible.has(node.id) : false,
        contextDimmed: focusIds ? !inFocusContext : false,
        focusMode,
      },
      selected,
      zIndex: selected ? 20 : inFocusContext ? 10 : 0,
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
  selectedId: string | null = null,
  focusIds: Set<string> | null = null,
  focusMode = false,
  burstSignal: { id: string; nodeId: string } | null = null,
): SynapseFlowEdge[] {
  return data.links.map((link) => {
    const sourceTier = tierForXp(xpByNodeId[link.source] ?? 0).index;
    const targetTier = tierForXp(xpByNodeId[link.target] ?? 0).index;
    const strength = Math.min(sourceTier, targetTier);

    const sourceCategory = nodesById.get(link.source)?.categoryId;
    const hue = categories.get(sourceCategory ?? "")?.hue ?? 0;
    const highlighted = Boolean(
      selectedId && (link.source === selectedId || link.target === selectedId),
    );
    const inFocusContext = focusIds
      ? focusIds.has(link.source) && focusIds.has(link.target)
      : highlighted;
    const hidden = Boolean(focusMode && focusIds && !inFocusContext);
    const bursts = Boolean(
      burstSignal &&
        (link.source === burstSignal.nodeId || link.target === burstSignal.nodeId),
    );

    return {
      id: `${link.source}--${link.target}`,
      source: link.source,
      target: link.target,
      type: "synapse",
      hidden,
      data: {
        hue,
        strength,
        synergy: link.type === "synergy",
        dimmed: visible
          ? !visible.has(link.source) || !visible.has(link.target)
          : false,
        highlighted,
        contextDimmed: Boolean(selectedId) && !inFocusContext,
        burstKey: bursts && burstSignal ? burstSignal.id : null,
      },
      zIndex: highlighted ? 5 : inFocusContext ? 2 : 0,
    } satisfies SynapseFlowEdge;
  });
}

/** Neighbours of a node, for the side panel and pathway guide. */
export function neighborsOf(
  data: IntelligenceData,
  nodeId: string,
): { id: string; type: "prereq" | "synergy"; direction: "in" | "out" }[] {
  const out: { id: string; type: "prereq" | "synergy"; direction: "in" | "out" }[] = [];
  for (const link of data.links) {
    if (link.source === nodeId)
      out.push({ id: link.target, type: link.type, direction: "out" });
    else if (link.target === nodeId)
      out.push({ id: link.source, type: link.type, direction: "in" });
  }
  return out;
}
