import { tierForXp } from "./mastery.ts";
import type { IntelligenceData } from "./types";

export const SYNERGY_MULTIPLIER = 1.25;

export function prerequisiteBuffSources(
  data: IntelligenceData,
  nodeId: string,
  xpByNodeId: Record<string, number>,
): string[] {
  const sources: string[] = [];
  for (const link of data.links) {
    if (link.type !== "prereq" || link.target !== nodeId) continue;
    if (tierForXp(xpByNodeId[link.source] ?? 0).index >= 3) {
      sources.push(link.source);
    }
  }
  return sources;
}

export function synergyMultiplierForNode(
  data: IntelligenceData,
  nodeId: string,
  xpByNodeId: Record<string, number>,
): number {
  return prerequisiteBuffSources(data, nodeId, xpByNodeId).length > 0
    ? SYNERGY_MULTIPLIER
    : 1;
}

/** First/second-degree ego graph, including the selected faculty itself. */
export function neighborsWithinDepth(
  data: IntelligenceData,
  nodeId: string,
  depth = 2,
): Set<string> {
  const visited = new Set<string>([nodeId]);
  let frontier = new Set<string>([nodeId]);

  for (let step = 0; step < depth; step += 1) {
    const next = new Set<string>();
    for (const current of frontier) {
      for (const link of data.links) {
        let neighbor: string | null = null;
        if (link.source === current) neighbor = link.target;
        else if (link.target === current) neighbor = link.source;
        if (neighbor && !visited.has(neighbor)) {
          visited.add(neighbor);
          next.add(neighbor);
        }
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }

  return visited;
}

/** Tasks whose requested work can naturally be entered directly as text. */
export function isTypableExercise(label: string): boolean {
  return /\b(write|rewrite|explain|argue|map|identify|find|name|list|summari[sz]e|predict|estimate|prove|derive|describe|reflect|journal|answer|outline|compare|design|plan|score|record.*notes?|sentence|paragraph|premise|claim|calibration)\b/i.test(
    label,
  );
}
