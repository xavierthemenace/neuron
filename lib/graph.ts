import type { Edge, Node } from "@xyflow/react";
import bakedLayout from "@/data/layout.json";
import type { Point } from "./layout";
import { radiusForXp, tierForXp } from "./mastery";
import type { Category, ConceptNode, IntelligenceData } from "./types";

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
  dimmed: boolean;
  contextDimmed: boolean;
  focusMode: boolean;
}

export interface SynapseEdgeData extends Record<string, unknown> {
  hue: number;
  strength: number;
  synergy: boolean;
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
 * does not cause the other ~99 nodes or unrelated synapses to re-render.
 */
const NODE_CACHE = new Map<
  string,
  { signature: string; value: ConceptFlowNode }
>();
const EDGE_CACHE = new Map<
  string,
  { signature: string; value: SynapseFlowEdge }
>();

export function positionOf(nodeId: string): Point {
  return LAYOUT[nodeId] ?? { x: 0, y: 0 };
}

export function indexBy<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

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
    const selected = node.id === selectedId;
    const inFocusContext = focusIds?.has(node.id) ?? false;
    const dimmed = visible ? !visible.has(node.id) : false;
    const contextDimmed = focusIds ? !inFocusContext : false;
    const size = radius * 2;

    const signature = [
      data.version,
      node.label,
      category?.label ?? "",
      category?.hue ?? 0,
      position.x,
      position.y,
      xp,
      retention.toFixed(4),
      selected ? 1 : 0,
      dimmed ? 1 : 0,
      contextDimmed ? 1 : 0,
      focusMode ? 1 : 0,
    ].join("|");
    const cached = NODE_CACHE.get(node.id);
    if (cached?.signature === signature) return cached.value;

    const value = {
      id: node.id,
      type: "concept",
      position: { x: position.x - radius, y: position.y - radius },
      width: size,
      height: size,
      ariaRole: "button",
      ariaLabel: `${node.label}, ${category?.label ?? "faculty"}, ${tier.name}, ${xp} effective XP${retention < 0.999 ? `, ${Math.round(retention * 100)} percent retention` : ""}`,
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
        decaying: retention < 0.999,
        dimmed,
        contextDimmed,
        focusMode,
      },
      selected,
      zIndex: selected ? 20 : inFocusContext ? 10 : 0,
      draggable: false,
    } satisfies ConceptFlowNode;

    NODE_CACHE.set(node.id, { signature, value });
    return value;
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
    const edgeId = `${link.source}--${link.target}`;
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
      data.version,
      link.source,
      link.target,
      link.type,
      hue,
      strength,
      hidden ? 1 : 0,
      dimmed ? 1 : 0,
      highlighted ? 1 : 0,
      contextDimmed ? 1 : 0,
      burstKey ?? "",
    ].join("|");
    const cached = EDGE_CACHE.get(edgeId);
    if (cached?.signature === signature) return cached.value;

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
        synergy: link.type === "synergy",
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

export function neighborsOf(
  data: IntelligenceData,
  nodeId: string,
): { id: string; type: "prereq" | "synergy"; direction: "in" | "out" }[] {
  const out: {
    id: string;
    type: "prereq" | "synergy";
    direction: "in" | "out";
  }[] = [];
  for (const link of data.links) {
    if (link.source === nodeId) {
      out.push({ id: link.target, type: link.type, direction: "out" });
    } else if (link.target === nodeId) {
      out.push({ id: link.source, type: link.type, direction: "in" });
    }
  }
  return out;
}
