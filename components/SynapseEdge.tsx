"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { memo } from "react";
import type { SynapseFlowEdge } from "@/lib/graph";

/** Signal traversal time in seconds, by the edge's weaker endpoint tier. */
const PULSE_DURATION = [0, 4.4, 3.4, 2.6, 1.9];

/**
 * A connection between two faculties. Dormant edges are faint static lines;
 * once both endpoints have been trained a signal starts travelling along them,
 * and it quickens as mastery rises — so the network visibly wakes up.
 */
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
  const dimmed = data?.dimmed ?? false;
  const highlighted = data?.highlighted ?? false;
  const contextDimmed = data?.contextDimmed ?? false;

  const baseOpacity = (synergy ? 0.22 : 0.34) + strength * (synergy ? 0.1 : 0.13);
  const opacity = dimmed
    ? 0.025
    : contextDimmed
      ? 0.055
      : highlighted
        ? Math.min(0.96, baseOpacity + 0.4)
        : baseOpacity;
  const width = (synergy ? 1 : 1.4) + strength * 0.4 + (highlighted ? 1.25 : 0);
  const lightness = highlighted ? 0.77 + strength * 0.035 : 0.66 + strength * 0.06;
  const chroma = (highlighted ? 0.12 : 0.08) + strength * 0.05;
  const color = `oklch(${lightness} ${chroma} ${hue})`;

  return (
    <>
      {highlighted && !dimmed && (
        <BaseEdge
          id={`${id}-glow`}
          path={path}
          style={{
            stroke: color,
            strokeWidth: width + 6,
            strokeOpacity: 0.16,
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
          strokeDasharray: synergy ? "5 7" : undefined,
        }}
      />

      {strength > 0 && !dimmed && !contextDimmed && (
        // motion-safe: the pulses are decorative, and 188 of them animating is
        // exactly the kind of thing reduced-motion exists to switch off.
        <circle
          className="motion-safe:visible motion-reduce:hidden"
          r={1.4 + strength * 0.55 + (highlighted ? 0.55 : 0)}
          fill={`oklch(0.94 ${0.08 + strength * 0.06} ${hue})`}
          opacity={highlighted ? 0.72 : 0.22 + strength * 0.16}
        >
          <animateMotion
            dur={`${PULSE_DURATION[strength] * (highlighted ? 0.78 : 1)}s`}
            repeatCount="indefinite"
            path={path}
          />
        </circle>
      )}
    </>
  );
}

export const SynapseEdge = memo(SynapseEdgeComponent);
