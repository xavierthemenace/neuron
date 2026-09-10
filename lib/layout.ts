import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import { MAX_DIAMETER } from "./mastery.ts";
import type { Category, Domain, IntelligenceData } from "./types";

export interface Point {
  x: number;
  y: number;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  categoryId: string;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  type: "prereq" | "synergy";
}

/**
 * Concentric rings by domain, mirroring how the models actually nest: the
 * general factors sit at the core and the specific intelligences radiate out
 * from them. A single shared radius put every cluster on one annulus and left a
 * dead hole in the middle.
 */
const DOMAIN_RING: Record<Domain, { radius: number; offset: number }> = {
  crystallized: { radius: 0, offset: 0 },
  fluid: { radius: 520, offset: 0.5 },
  eq: { radius: 980, offset: 0.12 },
  gardner: { radius: 1420, offset: 0 },
};

/** Spread of the deterministic seed cloud around each centre. */
const SEED_SPREAD = 150;
const TICKS = 500;

/** Golden angle — spaces seeded points evenly with no clumping and no RNG. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Category centres. Clusters are spaced evenly around their domain's ring, so
 * each domain reads as a coherent band and the whole thing reads as a nucleus
 * with lobes around it.
 */
function categoryCenters(data: IntelligenceData): Map<string, Point> {
  const centers = new Map<string, Point>();

  const byDomain = new Map<Domain, Category[]>();
  for (const category of data.categories) {
    const list = byDomain.get(category.domain);
    if (list) list.push(category);
    else byDomain.set(category.domain, [category]);
  }

  for (const [domain, categories] of byDomain) {
    const ring = DOMAIN_RING[domain];
    categories.forEach((category, i) => {
      // A lone category on a ring sits dead centre rather than off to one side.
      if (categories.length === 1 && ring.radius === 0) {
        centers.set(category.id, { x: 0, y: 0 });
        return;
      }
      // -PI/2 puts the first category of each ring at the top; the per-domain
      // offset stops inner and outer clusters lining up radially.
      const angle =
        ((i + ring.offset) / categories.length) * Math.PI * 2 - Math.PI / 2;
      centers.set(category.id, {
        x: Math.cos(angle) * ring.radius,
        y: Math.sin(angle) * ring.radius,
      });
    });
  }

  return centers;
}

/**
 * Computes a stable position for every node.
 *
 * Seeding is deliberately deterministic (phyllotaxis, not `Math.random`) so the
 * map is pixel-identical on every reload — the spatial memory you build up over
 * months is the whole point, and a reshuffling graph would destroy it.
 */
export function computeLayout(data: IntelligenceData): Map<string, Point> {
  const centers = categoryCenters(data);

  // Per-category counters so each cluster seeds its own phyllotaxis spiral.
  const seenInCategory = new Map<string, number>();

  const simNodes: SimNode[] = data.nodes.map((node) => {
    const center = centers.get(node.categoryId) ?? { x: 0, y: 0 };
    const i = seenInCategory.get(node.categoryId) ?? 0;
    seenInCategory.set(node.categoryId, i + 1);

    const angle = i * GOLDEN_ANGLE;
    const radius = SEED_SPREAD * Math.sqrt(i + 0.5);
    return {
      id: node.id,
      categoryId: node.categoryId,
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });

  const simLinks: SimLink[] = data.links.map((l) => ({ ...l }));

  const simulation = forceSimulation(simNodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        // Synergy links span clusters, so they rest long and pull weakly —
        // otherwise they'd drag the lobes into each other.
        .distance((l) => (l.type === "prereq" ? 95 : 260))
        .strength((l) => (l.type === "prereq" ? 0.5 : 0.06)),
    )
    .force("charge", forceManyBody<SimNode>().strength(-620))
    // These keep each node near its own cluster centre — without them the
    // synergy links smear every category across the canvas.
    .force("x", forceX<SimNode>((d) => centers.get(d.categoryId)?.x ?? 0).strength(0.14))
    .force("y", forceY<SimNode>((d) => centers.get(d.categoryId)?.y ?? 0).strength(0.14))
    // Collide against the largest orb a node can grow into, so a fully trained
    // map never overlaps.
    .force("collide", forceCollide<SimNode>(MAX_DIAMETER / 2 + 26).strength(0.85))
    .stop();

  // Runs to convergence synchronously. This costs ~500ms for 100 nodes, which
  // is why it happens in scripts/bake-layout.mjs at build time rather than in
  // the browser — see lib/graph.ts.
  simulation.tick(TICKS);

  const positions = new Map<string, Point>();
  for (const node of simNodes) {
    positions.set(node.id, {
      x: Math.round(node.x ?? 0),
      y: Math.round(node.y ?? 0),
    });
  }
  return positions;
}
