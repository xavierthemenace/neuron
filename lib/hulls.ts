import type { Point } from "./layout.ts";

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Monotonic-chain convex hull; tiny and deterministic for baked graph points. */
export function convexHull(points: Point[]): Point[] {
  const unique = Array.from(
    new Map(points.map((point) => [`${point.x}:${point.y}`, point])).values(),
  ).sort((a, b) => a.x - b.x || a.y - b.y);

  if (unique.length <= 2) return unique;

  const lower: Point[] = [];
  for (const point of unique) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Point[] = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Expand each point into a small octagon before taking the hull. This produces
 * breathing room around edge nodes and also handles one/two-node groups.
 */
export function paddedHull(points: Point[], padding: number): Point[] {
  const expanded: Point[] = [];
  const steps = 8;
  for (const point of points) {
    for (let index = 0; index < steps; index += 1) {
      const angle = (Math.PI * 2 * index) / steps;
      expanded.push({
        x: point.x + Math.cos(angle) * padding,
        y: point.y + Math.sin(angle) * padding,
      });
    }
  }
  return convexHull(expanded);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Quadratic midpoint smoothing keeps hulls organic without another dependency. */
export function smoothClosedPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} Z`;
  }

  const firstMid = midpoint(points[points.length - 1], points[0]);
  let path = `M ${firstMid.x} ${firstMid.y}`;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const mid = midpoint(current, next);
    path += ` Q ${current.x} ${current.y} ${mid.x} ${mid.y}`;
  }
  return `${path} Z`;
}
