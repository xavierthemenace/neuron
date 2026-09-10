"use client";

import { ViewportPortal } from "@xyflow/react";
import { useMemo } from "react";
import { paddedHull, smoothClosedPath } from "@/lib/hulls";
import { positionOf } from "@/lib/graph";
import type { Domain, IntelligenceData } from "@/lib/types";

const DOMAIN_HUE: Record<Domain, number> = {
  gardner: 285,
  eq: 35,
  fluid: 160,
  crystallized: 110,
  executive: 20,
  epistemic: 175,
  generative: 330,
  strategic: 96,
};

const DOMAIN_LABEL: Record<Domain, string> = {
  gardner: "Gardner intelligences",
  eq: "Emotional intelligence",
  fluid: "Fluid intelligence",
  crystallized: "Crystallized knowledge",
  executive: "Executive & learning control",
  epistemic: "Epistemic & decision intelligence",
  generative: "Generative & augmented cognition",
  strategic: "Long-horizon cognition",
};

export function ClusterBackdrop({ data }: { data: IntelligenceData }) {
  const { categoryShapes, domainShapes } = useMemo(() => {
    const categoryShapes = data.categories.map((category) => {
      const points = data.nodes
        .filter((node) => node.categoryId === category.id)
        .map((node) => positionOf(node.id));
      const hull = paddedHull(points, 72);
      const top = hull.reduce(
        (best, point) => (point.y < best.y ? point : best),
        hull[0] ?? { x: 0, y: 0 },
      );
      return {
        id: category.id,
        label: category.label,
        hue: category.hue,
        path: smoothClosedPath(hull),
        labelPoint: top,
      };
    });

    const domains = new Map<Domain, { x: number; y: number }[]>();
    for (const node of data.nodes) {
      const category = data.categories.find((item) => item.id === node.categoryId);
      if (!category) continue;
      const list = domains.get(category.domain) ?? [];
      list.push(positionOf(node.id));
      domains.set(category.domain, list);
    }

    const domainShapes = Array.from(domains.entries()).map(([domain, points]) => ({
      domain,
      hue: DOMAIN_HUE[domain],
      path: smoothClosedPath(paddedHull(points, 132)),
    }));

    return { categoryShapes, domainShapes };
  }, [data]);

  return (
    <ViewportPortal>
      <svg
        width="1"
        height="1"
        className="pointer-events-none absolute left-0 top-0 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {domainShapes.map((shape) => (
            <filter
              key={shape.domain}
              id={`domain-glow-${shape.domain}`}
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur stdDeviation="34" />
            </filter>
          ))}
        </defs>

        {domainShapes.map((shape) => (
          <path
            key={`ambient-${shape.domain}`}
            d={shape.path}
            fill={`oklch(0.42 0.10 ${shape.hue} / 0.055)`}
            stroke={`oklch(0.68 0.08 ${shape.hue} / 0.08)`}
            strokeWidth={2}
            filter={`url(#domain-glow-${shape.domain})`}
          >
            <title>{DOMAIN_LABEL[shape.domain]}</title>
          </path>
        ))}

        {categoryShapes.map((shape) => (
          <g key={shape.id}>
            <path
              d={shape.path}
              fill={`oklch(0.47 0.11 ${shape.hue} / 0.055)`}
              stroke={`oklch(0.74 0.12 ${shape.hue} / 0.2)`}
              strokeWidth={1.5}
              strokeDasharray="7 9"
            />
            <text
              x={shape.labelPoint.x}
              y={shape.labelPoint.y - 13}
              textAnchor="middle"
              fill={`oklch(0.82 0.08 ${shape.hue} / 0.72)`}
              fontSize={11}
              fontWeight={600}
              letterSpacing="0.08em"
            >
              {shape.label.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
    </ViewportPortal>
  );
}
