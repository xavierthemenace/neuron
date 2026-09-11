"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { memo } from "react";
import type { SynapseFlowEdge } from "@/lib/graph";

/** Signal traversal time in seconds, by the edge's weaker endpoint tier. */
const PULSE_DURATION = [0, 4.4, 3.4, 2.6, 1.9];

function SynapseEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<SynapseFlowEdge>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const hue = data?.hue ?? 260;
  const strength = data?.strength ?? 0;
  const synergy = data?.synergy ?? false;
  const inhibition = data?.inhibition ?? false;
  const dimmed = data?.dimmed ?? false;
  const highlighted = data?.highlighted ?? false;
  const contextDimmed = data?.contextDimmed ?? false;
  const burstKey = data?.burstKey ?? null;
  // How sure the curriculum is about this relationship, 0.36 to 1. Opacity is
  // the right channel for it: hue is already spent on category, and an edge
  // nobody has replicated should not look as solid as one that has.
  const certainty = data?.certainty ?? 0.55;

  const baseOpacity =
    ((synergy ? 0.26 : 0.38) + strength * (synergy ? 0.1 : 0.13)) * certainty;
  const opacity = dimmed
    ? 0.04
    : contextDimmed
      ? 0.075
      : highlighted
        ? Math.min(0.98, baseOpacity + 0.38)
        : Math.min(0.82, baseOpacity);
  const width = (synergy ? 1.15 : 1.55) + strength * 0.42 + (highlighted ? 1.25 : 0);
  // Inhibition edges are a trade-off rather than a pathway, so they take a
  // fixed warning hue instead of inheriting the source cluster's colour.
  const edgeHue = inhibition ? 18 : hue;
  const lightness = highlighted ? 0.79 + strength * 0.03 : 0.7 + strength * 0.05;
  const chroma = (highlighted ? 0.13 : 0.09) + strength * 0.05;
  const color = `oklch(${lightness} ${inhibition ? 0.16 : chroma} ${edgeHue})`;

  return (
    <>
      {highlighted && !dimmed && (
        <BaseEdge
          id={`${id}-glow`}
          path={path}
          style={{
            stroke: color,
            strokeWidth: width + 6,
            strokeOpacity: 0.17,
            filter: "blur(3px)",
          }}
        />
      )}

      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: width,
          strokeOpacity: opacity,
          strokeDasharray: inhibition ? "2 4" : synergy ? "5 7" : undefined,
        }}
      />

      {/* Signal particles travel along pathways. An inhibition edge is not a
          pathway — nothing flows along it — so it never animates. */}
      {strength > 0 && !inhibition && !dimmed && !contextDimmed && (
        <circle
          className="motion-safe:visible motion-reduce:hidden"
          r={1.5 + strength * 0.55 + (highlighted ? 0.55 : 0)}
          fill={`oklch(0.95 ${0.09 + strength * 0.06} ${edgeHue})`}
          opacity={highlighted ? 0.76 : 0.3 + strength * 0.15}
        >
          <animateMotion
            dur={`${PULSE_DURATION[strength] * (highlighted ? 0.78 : 1)}s`}
            repeatCount="indefinite"
            path={path}
          />
        </circle>
      )}

      {burstKey && !dimmed &&
        [0, 1, 2, 3, 4].map((particle) => (
          <circle
            key={`${burstKey}-${particle}`}
            className="motion-safe:visible motion-reduce:hidden"
            r={3.2 - particle * 0.28}
            fill={`oklch(0.96 0.16 ${hue})`}
            opacity={0}
            style={{ filter: `drop-shadow(0 0 5px oklch(0.86 0.18 ${hue}))` }}
          >
            <animate
              attributeName="opacity"
              values="0;0.95;0.78;0"
              keyTimes="0;0.12;0.78;1"
              dur="1.05s"
              begin={`${particle * 0.075}s`}
              fill="freeze"
            />
            <animateMotion
              dur="1.05s"
              begin={`${particle * 0.075}s`}
              path={path}
              fill="freeze"
            />
          </circle>
        ))}
    </>
  );
}

export const SynapseEdge = memo(SynapseEdgeComponent);
