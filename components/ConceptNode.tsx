"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { ConceptFlowNode } from "@/lib/graph";

/**
 * One faculty on the map. Everything visual — size, colour, bloom — is derived
 * from the node's XP upstream in lib/graph.ts, so this component stays a pure
 * function of its data and React.memo can skip unchanged nodes.
 */
function ConceptNodeComponent({ data, selected }: NodeProps<ConceptFlowNode>) {
  const {
    radius,
    hue,
    lightness,
    chroma,
    opacity,
    glow,
    dimmed,
    contextDimmed,
    tierIndex,
  } = data;
  const size = radius * 2;

  const core = `oklch(${lightness} ${chroma} ${hue})`;
  const halo = `oklch(${lightness} ${chroma} ${hue} / 0.55)`;
  const visualOpacity = selected
    ? Math.max(opacity, 0.94)
    : dimmed
      ? 0.07
      : contextDimmed
        ? Math.min(opacity, 0.24)
        : opacity;

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

      {selected && (
        <div
          className="animate-node-focus pointer-events-none absolute rounded-full border"
          style={{
            inset: -10,
            borderColor: `oklch(0.88 ${Math.max(chroma, 0.1)} ${hue} / 0.7)`,
            boxShadow: `0 0 18px oklch(${lightness} ${chroma} ${hue} / 0.28)`,
          }}
          aria-hidden="true"
        />
      )}

      <div
        className={[
          "relative rounded-full transition-[opacity,box-shadow,transform,filter] duration-300 ease-out",
          selected ? "scale-[1.14]" : "group-hover:scale-110",
          contextDimmed && !selected ? "saturate-50" : "",
          tierIndex >= 3 && !contextDimmed ? "animate-node-pulse" : "",
        ].join(" ")}
        style={{
          width: size,
          height: size,
          opacity: visualOpacity,
          background: `radial-gradient(circle at 32% 28%, oklch(${Math.min(
            lightness + 0.18,
            0.98,
          )} ${chroma * 0.85} ${hue}) 0%, oklch(${Math.min(
            lightness + 0.08,
            0.94,
          )} ${chroma} ${hue}) 24%, ${core} 60%, oklch(${Math.max(
            lightness - 0.17,
            0.18,
          )} ${chroma * 0.78} ${hue}) 100%)`,
          boxShadow: selected
            ? `0 0 ${Math.max(glow, 12)}px ${halo}, 0 0 ${Math.max(
                glow * 2.8,
                34,
              )}px oklch(${lightness} ${chroma} ${hue} / 0.3), inset 0 0 0 1px oklch(1 0 0 / 0.18)`
            : glow
              ? `0 0 ${glow}px ${halo}, 0 0 ${glow * 2.2}px oklch(${lightness} ${chroma} ${hue} / 0.22), inset 0 0 0 1px oklch(1 0 0 / 0.08)`
              : "inset 0 0 0 1px oklch(0.5 0.03 265 / 0.6)",
        }}
      />

      <span
        className={[
          "pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2",
          "whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-tight",
          "transition-[opacity,background-color,border-color,transform] duration-300",
          selected
            ? "translate-y-0 border-white/12 bg-black/65 opacity-100 shadow-lg backdrop-blur-md"
            : dimmed || contextDimmed
              ? "translate-y-0.5 border-transparent bg-transparent opacity-0"
              : "translate-y-0.5 border-transparent bg-transparent opacity-55 group-hover:translate-y-0 group-hover:border-white/10 group-hover:bg-black/55 group-hover:opacity-100 group-hover:backdrop-blur-md",
        ].join(" ")}
        style={{ color: `oklch(0.94 0.035 ${hue})` }}
      >
        {data.label}
      </span>
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeComponent);
