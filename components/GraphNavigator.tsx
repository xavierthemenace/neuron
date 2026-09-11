"use client";

import { useMemo, useState } from "react";
import { neighborsOf, type Neighbor } from "@/lib/graph";
import type { ConceptNode, IntelligenceData } from "@/lib/types";

export function GraphNavigator({
  data,
  selectedNode,
  nodesById,
  onSelectNode,
  onFitView,
  onOpenAnalytics,
  focusMode,
  onToggleFocusMode,
}: {
  data: IntelligenceData;
  selectedNode: ConceptNode | null;
  nodesById: Map<string, ConceptNode>;
  onSelectNode: (id: string) => void;
  onFitView: () => void;
  onOpenAnalytics: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}) {
  const [open, setOpen] = useState(false);

  const pathways = useMemo((): Record<
    "prerequisites" | "downstream" | "synergies" | "tradeoffs",
    Neighbor[]
  > => {
    if (!selectedNode) {
      return { prerequisites: [], downstream: [], synergies: [], tradeoffs: [] };
    }
    const neighbors = neighborsOf(data, selectedNode.id);
    return {
      prerequisites: neighbors.filter(
        (neighbor) => neighbor.type === "prereq" && neighbor.direction === "in",
      ),
      downstream: neighbors.filter(
        (neighbor) => neighbor.type === "prereq" && neighbor.direction === "out",
      ),
      synergies: neighbors.filter((neighbor) => neighbor.type === "synergy"),
      tradeoffs: neighbors.filter((neighbor) => neighbor.type === "inhibition"),
    };
  }, [data, selectedNode]);

  const rightClass = selectedNode ? "md:right-[436px]" : "md:right-4";

  const pathwaySection = (
    title: string,
    items: Neighbor[],
    symbol: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <div>
        <h4 className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
          {title}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const target = nodesById.get(item.id);
            if (!target) return null;
            return (
              <button
                key={`${title}-${item.id}-${item.direction}`}
                type="button"
                onClick={() => onSelectNode(item.id)}
                className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] text-neutral-300 transition-colors hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
              >
                {symbol} {target.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className={[
        "pointer-events-auto absolute bottom-[196px] right-3 z-30 transition-[right] duration-300 md:bottom-[144px] md:right-4",
        rightClass,
      ].join(" ")}
    >
      {open && (
        <div className="absolute bottom-11 right-0 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-white/12 bg-[rgb(255_255_255_/_0.97)] p-3.5 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-neutral-100">
                {selectedNode ? selectedNode.label : "Map & pathways"}
              </h3>
              <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                {selectedNode
                  ? selectedNode.description
                  : "Use the minimap to pan quickly. Solid links are prerequisite pathways; dashed links are cross-domain synergies."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close map guide"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-neutral-600 transition-colors hover:bg-white/5 hover:text-neutral-300"
            >
              ×
            </button>
          </div>

          {selectedNode ? (
            <div className="mt-3 space-y-3 border-t border-white/8 pt-3">
              {pathwaySection("Prerequisites", pathways.prerequisites, "←")}
              {pathwaySection("Builds toward", pathways.downstream, "→")}
              {pathwaySection("Synergy links", pathways.synergies, "↔")}
              {pathwaySection("Trade-offs", pathways.tradeoffs, "⊣")}
              {pathways.prerequisites.length + pathways.downstream.length + pathways.synergies.length + pathways.tradeoffs.length === 0 && (
                <p className="text-[10px] text-neutral-600">This faculty currently has no direct pathway links.</p>
              )}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/8 pt-3 text-[10px]">
              <div className="rounded-lg border border-white/8 bg-white/[0.025] p-2.5 text-neutral-400">
                <span className="mb-1 block font-semibold text-neutral-300">Solid synapse</span>
                Prerequisite → downstream skill.
              </div>
              <div className="rounded-lg border border-dashed border-white/10 p-2.5 text-neutral-400">
                <span className="mb-1 block font-semibold text-neutral-300">Dashed synapse</span>
                Cross-skill reinforcement.
              </div>
              <div className="col-span-2 rounded-lg border border-white/8 bg-white/[0.025] p-2.5 text-neutral-400">
                <span className="mb-1 block font-semibold text-neutral-300">Cluster boundaries</span>
                Each shaded hull is one curriculum category; the softer outer ambient zones group Gardner, EQ, Fluid, and Crystallized intelligence.
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/8 pt-3">
            <button
              type="button"
              onClick={onFitView}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              Fit entire map
            </button>
            <button
              type="button"
              onClick={onOpenAnalytics}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              Open analytics
            </button>
            {selectedNode && (
              <button
                type="button"
                onClick={onToggleFocusMode}
                className={[
                  "rounded-lg border px-2.5 py-1.5 text-[10px] transition-colors",
                  focusMode
                    ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                    : "border-white/10 text-neutral-400 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                Focus mode {focusMode ? "on" : "off"}
              </button>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-white/12 bg-black/65 px-3 py-2 text-[10px] font-medium text-neutral-300 shadow-xl backdrop-blur-xl transition-colors hover:border-white/25 hover:bg-black/80 hover:text-white"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M2.5 3.5 6 2l4 1.5L13.5 2v10.5L10 14l-4-1.5L2.5 14V3.5Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 2v10.5M10 3.5V14" fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" />
        </svg>
        Map guide
      </button>
    </div>
  );
}
