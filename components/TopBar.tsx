"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TIERS, tierForXp, totalXp } from "@/lib/mastery";
import { exportProgress, importProgress } from "@/lib/storage";
import type { Category, IntelligenceData } from "@/lib/types";
import { useProgress } from "./ProgressProvider";

export function TopBar({
  data,
  search,
  onSearchChange,
  onSelectNode,
  activeCategories,
  onToggleCategory,
  onClearFilters,
}: {
  data: IntelligenceData;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectNode: (id: string) => void;
  activeCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onClearFilters: () => void;
}) {
  const { progress, xpByNodeId, replaceProgress, resetProgress } = useProgress();
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
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

  const categoriesById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  );

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];

    return data.nodes
      .filter((node) => {
        if (
          activeCategories.size > 0 &&
          !activeCategories.has(node.categoryId)
        ) {
          return false;
        }
        return (
          node.label.toLowerCase().includes(query) ||
          node.description.toLowerCase().includes(query)
        );
      })
      .slice(0, 6);
  }, [activeCategories, data.nodes, search]);

  const awake = data.nodes.length - tierCounts[0];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

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
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 md:p-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/45 px-3 py-2 shadow-sm backdrop-blur-xl">
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

        <div className="relative">
          <div className="relative">
            <input
              ref={searchInput}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
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
              className="w-48 rounded-xl border border-white/10 bg-black/45 px-3 py-2 pr-8 text-xs text-neutral-200 outline-none backdrop-blur-xl transition-[border-color,background-color,box-shadow] placeholder:text-neutral-600 focus:border-white/25 focus:bg-black/60 focus:shadow-lg md:w-64"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  searchInput.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-neutral-600 transition-colors hover:bg-white/8 hover:text-neutral-300"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                  <path
                    d="M2 2l8 8M10 2L2 10"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : (
              <span className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-neutral-600 md:block">
                /
              </span>
            )}
          </div>

          {search.trim() && (
            <div className="absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-white/10 bg-[oklch(0.14_0.016_265_/_0.96)] p-1.5 shadow-2xl backdrop-blur-2xl">
              {searchResults.length > 0 ? (
                <>
                  {searchResults.map((node, index) => {
                    const category = categoriesById.get(node.categoryId);
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => chooseSearchResult(node.id)}
                        className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]"
                          style={{
                            color: `oklch(0.72 0.16 ${category?.hue ?? 260})`,
                            background: "currentColor",
                          }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-neutral-200 group-hover:text-white">
                            {node.label}
                          </span>
                          <span className="block truncate text-[10px] text-neutral-600 group-hover:text-neutral-500">
                            {category?.label ?? "Faculty"}
                          </span>
                        </span>
                        {index === 0 && (
                          <span className="hidden shrink-0 text-[9px] text-neutral-700 md:block">
                            Enter
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <div className="px-2.5 pb-1 pt-1.5 text-[9px] text-neutral-700">
                    {searchResults.length === 6 ? "Showing top matches" : `${searchResults.length} match${searchResults.length === 1 ? "" : "es"}`}
                  </div>
                </>
              ) : (
                <div className="px-3 py-3 text-xs text-neutral-600">
                  No matching faculties
                </div>
              )}
            </div>
          )}
        </div>

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
        <div className="pointer-events-auto w-full max-w-2xl rounded-xl border border-white/10 bg-black/55 p-3 shadow-xl backdrop-blur-xl">
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
