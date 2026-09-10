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

  // The untrained baseline is deliberately well above "barely there": on day
  // one the map has to read as a wired network, otherwise it is just a scatter
  // of dots. Training then widens and brightens the connection from there.
  const opacity = dimmed
    ? 0.04
    : (synergy ? 0.22 : 0.34) + strength * (synergy ? 0.1 : 0.13);
  const width = (synergy ? 1 : 1.4) + strength * 0.4;
  const color = `oklch(${0.66 + strength * 0.06} ${0.08 + strength * 0.05} ${hue})`;

  return (
    <>
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
      {strength > 0 && !dimmed && (
        // motion-safe: the pulses are decorative, and 188 of them animating is
        // exactly the kind of thing reduced-motion exists to switch off.
        <circle
          className="motion-safe:visible motion-reduce:hidden"
          r={1.4 + strength * 0.55}
          fill={`oklch(0.94 ${0.08 + strength * 0.06} ${hue})`}
          opacity={0.22 + strength * 0.16}
        >
          <animateMotion
            dur={`${PULSE_DURATION[strength]}s`}
            repeatCount="indefinite"
            path={path}
          />
        </circle>
      )}
    </>
  );
}

export const SynapseEdge = memo(SynapseEdgeComponent);
