"use client";

import { useMemo, useRef, useState } from "react";
import { TIERS, tierForXp, totalXp } from "@/lib/mastery";
import { exportProgress, importProgress } from "@/lib/storage";
import type { Category, IntelligenceData } from "@/lib/types";
import { useProgress } from "./ProgressProvider";

export function TopBar({
  data,
  search,
  onSearchChange,
  activeCategories,
  onToggleCategory,
  onClearFilters,
}: {
  data: IntelligenceData;
  search: string;
  onSearchChange: (value: string) => void;
  activeCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onClearFilters: () => void;
}) {
  const { progress, xpByNodeId, replaceProgress, resetProgress } = useProgress();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);

  const total = totalXp(progress);

  // How many nodes sit at each mastery tier — the one-line summary of progress.
  const tierCounts = useMemo(() => {
    const counts = new Array(TIERS.length).fill(0);
    for (const node of data.nodes) {
      counts[tierForXp(xpByNodeId[node.id] ?? 0).index] += 1;
    }
    return counts;
  }, [data.nodes, xpByNodeId]);

  const awake = data.nodes.length - tierCounts[0];

  async function onImport(file: File) {
    try {
      replaceProgress(await importProgress(file));
      setError(null);
    } catch {
      setError("That file could not be read as Neuron progress.");
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 md:p-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-xl">
          <span className="text-sm font-semibold tracking-tight text-neutral-100">
            Neuron
          </span>
          <span className="h-3.5 w-px bg-white/15" aria-hidden="true" />
          <span className="tabular-nums text-xs text-neutral-400">
            <span className="font-medium text-neutral-100">{total.toLocaleString()}</span>{" "}
            XP
          </span>
          <span className="tabular-nums text-xs text-neutral-500">
            {awake}/{data.nodes.length} active
          </span>
        </div>

        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search faculties…"
          aria-label="Search faculties"
          className="w-44 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-neutral-200 outline-none backdrop-blur-xl transition-colors placeholder:text-neutral-600 focus:border-white/25 md:w-56"
        />

        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          className={[
            "rounded-xl border px-3 py-2 text-xs backdrop-blur-xl transition-colors",
            activeCategories.size > 0
              ? "border-white/30 bg-white/10 text-neutral-100"
              : "border-white/10 bg-black/45 text-neutral-400 hover:text-neutral-200",
          ].join(" ")}
        >
          Filter
          {activeCategories.size > 0 && ` (${activeCategories.size})`}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportProgress(progress)}
            className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-neutral-400 backdrop-blur-xl transition-colors hover:border-white/25 hover:text-neutral-100"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-neutral-400 backdrop-blur-xl transition-colors hover:border-white/25 hover:text-neutral-100"
          >
            Import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Erase all logged progress? Export first if you want a backup.",
                )
              ) {
                resetProgress();
              }
            }}
            className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-neutral-600 backdrop-blur-xl transition-colors hover:border-red-500/40 hover:text-red-300"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="pointer-events-auto w-fit rounded-lg border border-red-500/30 bg-red-950/50 px-3 py-1.5 text-xs text-red-200 backdrop-blur-xl">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 text-red-400 hover:text-red-200"
          >
            dismiss
          </button>
        </div>
      )}

      {legendOpen && (
        <div className="pointer-events-auto w-full max-w-2xl rounded-xl border border-white/10 bg-black/55 p-3 backdrop-blur-xl">
          <div className="flex flex-wrap gap-1.5">
            {data.categories.map((category: Category) => {
              const active = activeCategories.has(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onToggleCategory(category.id)}
                  aria-pressed={active}
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all"
                  style={{
                    borderColor: active
                      ? `oklch(0.7 0.15 ${category.hue})`
                      : "oklch(1 0 0 / 0.12)",
                    background: active
                      ? `oklch(0.7 0.15 ${category.hue} / 0.16)`
                      : "transparent",
                    color: active
                      ? `oklch(0.88 0.1 ${category.hue})`
                      : "oklch(0.65 0.01 265)",
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: `oklch(0.72 0.16 ${category.hue})` }}
                    aria-hidden="true"
                  />
                  {category.label}
                </button>
              );
            })}
          </div>
          {activeCategories.size > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-2 text-[11px] text-neutral-500 transition-colors hover:text-neutral-300"
            >
              Clear filters
            </button>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/8 pt-2.5 text-[10px] text-neutral-500">
            {TIERS.map((tier) => (
              <span key={tier.index} className="flex items-center gap-1.5">
                <span
                  className="rounded-full bg-neutral-300"
                  style={{
                    width: 4 + tier.index * 1.6,
                    height: 4 + tier.index * 1.6,
                    opacity: tier.opacity,
                  }}
                  aria-hidden="true"
                />
                {tier.name}
                <span className="tabular-nums text-neutral-600">
                  {tierCounts[tier.index]}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
