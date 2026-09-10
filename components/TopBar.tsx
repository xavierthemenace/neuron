"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TIERS, dayKey, tierForXp, totalXp } from "@/lib/mastery";
import { exportProgress, importProgress } from "@/lib/storage";
import type { Category, IntelligenceData } from "@/lib/types";
import { useProgress } from "./ProgressProvider";

export function TopBar({
  data,
  search,
  onSearchChange,
  onSelectNode,
  onOpenAnalytics,
  activeCategories,
  onToggleCategory,
  onClearFilters,
}: {
  data: IntelligenceData;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectNode: (id: string) => void;
  onOpenAnalytics: () => void;
  activeCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onClearFilters: () => void;
}) {
  const { progress, xpByNodeId, replaceProgress, resetProgress } = useProgress();
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);

  const total = totalXp(progress);

  const tierCounts = useMemo(() => {
    const counts = new Array(TIERS.length).fill(0);
    for (const node of data.nodes) {
      counts[tierForXp(xpByNodeId[node.id] ?? 0).index] += 1;
    }
    return counts;
  }, [data.nodes, xpByNodeId]);

  const categoriesById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  );

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return data.nodes
      .filter((node) => {
        if (activeCategories.size > 0 && !activeCategories.has(node.categoryId)) return false;
        return (
          node.label.toLowerCase().includes(query) ||
          node.description.toLowerCase().includes(query)
        );
      })
      .slice(0, 6);
  }, [activeCategories, data.nodes, search]);

  const streak = useMemo(() => {
    const active = new Set(progress.logs.map((log) => dayKey(new Date(log.at))));
    const cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    if (!active.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (active.has(dayKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [progress.logs]);

  const awake = data.nodes.length - tierCounts[0];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      searchInput.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onImport(file: File) {
    try {
      replaceProgress(await importProgress(file));
      setError(null);
    } catch {
      setError("That file could not be read as Neuron progress.");
    }
  }

  const chooseSearchResult = (id: string) => {
    onSelectNode(id);
    onSearchChange("");
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col gap-2 p-3 md:p-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-black/60 px-3 py-2 shadow-lg backdrop-blur-xl">
          <span className="text-sm font-semibold tracking-tight text-white">Neuron</span>
          <span className="h-3.5 w-px bg-white/15" aria-hidden="true" />
          <span className="tabular-nums text-xs text-neutral-300">
            <span className="font-semibold text-white">{total.toLocaleString()}</span> XP
          </span>
          <span className="hidden tabular-nums text-xs text-neutral-500 sm:inline">
            {awake}/{data.nodes.length} active
          </span>
        </div>

        <div className="relative order-last w-full sm:order-none sm:w-auto">
          <div className="relative">
            <input
              ref={searchInput}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults[0]) {
                  event.preventDefault();
                  chooseSearchResult(searchResults[0].id);
                } else if (event.key === "Escape" && search) {
                  event.stopPropagation();
                  onSearchChange("");
                }
              }}
              placeholder="Search faculties…"
              aria-label="Search faculties"
              className="w-full rounded-xl border border-white/12 bg-black/60 px-3 py-2 pr-9 text-xs text-neutral-100 shadow-lg outline-none backdrop-blur-xl transition-[border-color,background-color,box-shadow] placeholder:text-neutral-500 focus:border-white/30 focus:bg-black/75 sm:w-64"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  searchInput.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-neutral-500 hover:bg-white/8 hover:text-white"
              >
                ×
              </button>
            ) : (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-neutral-500">/</span>
            )}
          </div>

          {search.trim() && (
            <div className="absolute left-0 top-full z-40 mt-2 w-full min-w-[18rem] overflow-hidden rounded-xl border border-white/12 bg-[oklch(0.135_0.016_265_/_0.98)] p-1.5 shadow-2xl backdrop-blur-2xl sm:w-[22rem]">
              {searchResults.length > 0 ? (
                searchResults.map((node, index) => {
                  const category = categoriesById.get(node.categoryId);
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => chooseSearchResult(node.id)}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.07] focus:bg-white/[0.07] focus:outline-none"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]"
                        style={{
                          color: `oklch(0.78 0.16 ${category?.hue ?? 260})`,
                          background: "currentColor",
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-neutral-100">{node.label}</span>
                        <span className="block truncate text-[10px] text-neutral-500">{category?.label ?? "Faculty"}</span>
                      </span>
                      {index === 0 && <span className="text-[9px] text-neutral-600">Enter</span>}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-3 text-xs text-neutral-500">No matching faculties</div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setLegendOpen((value) => !value)}
          aria-expanded={legendOpen}
          className={[
            "rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur-xl transition-colors",
            activeCategories.size > 0
              ? "border-white/30 bg-white/12 text-white"
              : "border-white/12 bg-black/60 text-neutral-300 hover:border-white/25 hover:text-white",
          ].join(" ")}
        >
          Filter{activeCategories.size > 0 && ` (${activeCategories.size})`}
        </button>

        <button
          type="button"
          onClick={onOpenAnalytics}
          className="rounded-xl border border-white/12 bg-black/60 px-3 py-2 text-xs text-neutral-300 shadow-lg backdrop-blur-xl transition-colors hover:border-white/25 hover:text-white"
        >
          Analytics{streak > 0 && <span className="ml-1.5 text-emerald-200/70">{streak}d</span>}
        </button>

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setDataOpen((value) => !value)}
            aria-expanded={dataOpen}
            className="rounded-xl border border-white/12 bg-black/60 px-3 py-2 text-xs text-neutral-400 shadow-lg backdrop-blur-xl transition-colors hover:border-white/25 hover:text-white"
          >
            Data
          </button>
          {dataOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-36 rounded-xl border border-white/12 bg-[oklch(0.135_0.016_265_/_0.98)] p-1.5 shadow-2xl backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => {
                  exportProgress(progress);
                  setDataOpen(false);
                }}
                className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/[0.07] hover:text-white"
              >
                Export progress
              </button>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/[0.07] hover:text-white"
              >
                Import progress
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onImport(file);
                  event.target.value = "";
                  setDataOpen(false);
                }}
              />
              <div className="my-1 h-px bg-white/8" />
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Erase all logged progress? Export first if you want a backup.")) {
                    resetProgress();
                  }
                  setDataOpen(false);
                }}
                className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-red-300/60 hover:bg-red-400/[0.07] hover:text-red-200"
              >
                Reset progress
              </button>
            </div>
          )}
        </div>

        <div className="hidden items-center gap-1 rounded-xl border border-white/8 bg-black/35 px-2.5 py-2 text-[9px] text-neutral-500 shadow-lg backdrop-blur-xl lg:flex">
          <kbd className="font-mono">⌘/Ctrl K</kbd>
          <span>commands</span>
        </div>
      </div>

      {error && (
        <div className="pointer-events-auto w-fit rounded-lg border border-red-500/30 bg-red-950/70 px-3 py-1.5 text-xs text-red-100 shadow-lg backdrop-blur-xl">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">dismiss</button>
        </div>
      )}

      {legendOpen && (
        <div className="pointer-events-auto w-full max-w-3xl rounded-xl border border-white/12 bg-black/70 p-3 shadow-2xl backdrop-blur-xl">
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
                    borderColor: active ? `oklch(0.75 0.15 ${category.hue})` : "oklch(1 0 0 / 0.14)",
                    background: active ? `oklch(0.7 0.15 ${category.hue} / 0.18)` : "oklch(1 0 0 / 0.025)",
                    color: active ? `oklch(0.92 0.1 ${category.hue})` : "oklch(0.74 0.01 265)",
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: `oklch(0.78 0.16 ${category.hue})` }} aria-hidden="true" />
                  {category.label}
                </button>
              );
            })}
          </div>
          {activeCategories.size > 0 && (
            <button type="button" onClick={onClearFilters} className="mt-2 text-[11px] text-neutral-400 hover:text-white">Clear filters</button>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/8 pt-2.5 text-[10px] text-neutral-500">
            {TIERS.map((tier) => (
              <span key={tier.index} className="flex items-center gap-1.5">
                <span
                  className="rounded-full bg-neutral-200"
                  style={{ width: 5 + tier.index * 1.6, height: 5 + tier.index * 1.6, opacity: tier.opacity }}
                  aria-hidden="true"
                />
                {tier.name}
                <span className="tabular-nums text-neutral-600">{tierCounts[tier.index]}</span>
              </span>
            ))}
            <span className="ml-auto text-amber-200/50">amber dot = retention decay</span>
          </div>
        </div>
      )}
    </div>
  );
}
