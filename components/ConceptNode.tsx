"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { ConceptFlowNode } from "@/lib/graph";

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
    focusMode,
    retention,
    decaying,
    tierIndex,
  } = data;
  const size = radius * 2;

  const core = `oklch(${lightness} ${chroma} ${hue})`;
  const halo = `oklch(${lightness} ${chroma} ${hue} / 0.55)`;
  const retainedOpacity = opacity * (0.76 + retention * 0.24);
  const visualOpacity = selected
    ? Math.max(retainedOpacity, 0.96)
    : dimmed
      ? 0.1
      : contextDimmed
        ? focusMode
          ? 0.05
          : Math.min(retainedOpacity, 0.26)
        : retainedOpacity;

  return (
    <div
      className="group relative flex items-center justify-center"
      style={{ width: size, height: size }}
      title={decaying ? `${data.label} · retention is decaying; train to refresh` : data.label}
    >
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
            inset: -11,
            borderColor: `oklch(0.9 ${Math.max(chroma, 0.1)} ${hue} / 0.78)`,
            boxShadow: `0 0 22px oklch(${lightness} ${chroma} ${hue} / 0.34)`,
          }}
          aria-hidden="true"
        />
      )}

      <div
        className={[
          "relative rounded-full transition-[opacity,box-shadow,transform,filter] duration-300 ease-out",
          selected ? "scale-[1.14]" : "group-hover:scale-110",
          contextDimmed && !selected ? "saturate-50" : "",
          tierIndex >= 3 && !contextDimmed && !decaying ? "animate-node-pulse" : "",
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
            ? `0 0 ${Math.max(glow, 13)}px ${halo}, 0 0 ${Math.max(
                glow * 2.8,
                36,
              )}px oklch(${lightness} ${chroma} ${hue} / 0.34), inset 0 0 0 1px oklch(1 0 0 / 0.2)`
            : glow
              ? `0 0 ${glow}px ${halo}, 0 0 ${glow * 2.2}px oklch(${lightness} ${chroma} ${hue} / ${0.12 + 0.12 * retention}), inset 0 0 0 1px oklch(1 0 0 / 0.1)`
              : "0 1px 8px oklch(0 0 0 / 0.32), inset 0 0 0 1px oklch(0.65 0.035 265 / 0.72)",
        }}
      />

      {decaying && !contextDimmed && !dimmed && (
        <span
          className="pointer-events-none absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-black/60 bg-amber-300/80 shadow-[0_0_8px_currentColor]"
          aria-hidden="true"
        />
      )}

      <span
        className={[
          "pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2",
          "whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-tight",
          "transition-[opacity,background-color,border-color,transform] duration-300",
          selected
            ? "translate-y-0 border-white/15 bg-black/75 opacity-100 shadow-lg backdrop-blur-md"
            : dimmed
              ? "translate-y-0.5 border-transparent bg-transparent opacity-0"
              : contextDimmed && focusMode
                ? "translate-y-0.5 border-transparent bg-transparent opacity-0"
                : contextDimmed
                  ? "translate-y-0.5 border-transparent bg-transparent opacity-20"
                  : "translate-y-0.5 border-transparent bg-black/15 opacity-70 group-hover:translate-y-0 group-hover:border-white/12 group-hover:bg-black/65 group-hover:opacity-100 group-hover:backdrop-blur-md",
        ].join(" ")}
        style={{ color: `oklch(0.96 0.035 ${hue})` }}
      >
        {data.label}
      </span>
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeComponent);
