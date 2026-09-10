"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { ConceptFlowNode } from "@/lib/graph";

/**
 * One faculty on the map. Everything visual — size, colour, bloom — is derived
 * from the node's XP upstream in lib/graph.ts, so this component stays a pure
 * function of its data and React.memo can skip the other 99 nodes on every log.
 */
function ConceptNodeComponent({ data, selected }: NodeProps<ConceptFlowNode>) {
  const { radius, hue, lightness, chroma, opacity, glow, dimmed, tierIndex } =
    data;
  const size = radius * 2;

  const core = `oklch(${lightness} ${chroma} ${hue})`;
  const halo = `oklch(${lightness} ${chroma} ${hue} / 0.55)`;

  return (
    <div
      className="group relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Handles are invisible anchors — edges need them, the design doesn't. */}
      <Handle
        type="target"
        position={Position.Top}
        className="!pointer-events-none !h-px !w-px !min-w-0 !border-0 !bg-transparent !opacity-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!pointer-events-none !h-px !w-px !min-w-0 !border-0 !bg-transparent !opacity-0"
      />

      <div
        className={[
          "relative rounded-full transition-[opacity,box-shadow,transform] duration-300",
          "group-hover:scale-110",
          dimmed ? "opacity-10" : "",
          tierIndex >= 3 ? "animate-node-pulse" : "",
        ].join(" ")}
        style={{
          width: size,
          height: size,
          opacity: dimmed ? undefined : opacity,
          background: `radial-gradient(circle at 35% 32%, oklch(${Math.min(
            lightness + 0.14,
            0.97,
          )} ${chroma} ${hue}), ${core} 62%, oklch(${Math.max(
            lightness - 0.16,
            0.2,
          )} ${chroma * 0.8} ${hue}))`,
          boxShadow: glow
            ? `0 0 ${glow}px ${halo}, 0 0 ${glow * 2.2}px oklch(${lightness} ${chroma} ${hue} / 0.22)`
            : "inset 0 0 0 1px oklch(0.5 0.03 265 / 0.6)",
          outline: selected ? `2px solid ${core}` : undefined,
          outlineOffset: selected ? 5 : undefined,
        }}
      />

      <span
        className={[
          "pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2",
          "whitespace-nowrap text-[11px] font-medium tracking-tight",
          "transition-opacity duration-300",
          dimmed
            ? "opacity-0"
            : "opacity-55 group-hover:opacity-100",
        ].join(" ")}
        style={{ color: `oklch(0.92 0.03 ${hue})` }}
      >
        {data.label}
      </span>
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeComponent);
