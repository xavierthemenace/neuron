"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { paths } from "@/lib/curriculum";
import { exportAnkiCsv, exportObsidianVault } from "@/lib/knowledge-export";
import { exportBackup, importBackup } from "@/lib/backup";
import { search as conceptSearch } from "@/lib/search";
import { TIERS, tierForXp } from "@/lib/mastery";
import type { Category, IntelligenceData } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import type { WorkbenchTab } from "./Workbench";
import { Chip } from "./ui";

export function TopBar({
  data,
  search,
  onSearchChange,
  onSelectNode,
  onOpenWorkbench,
  activeCategories,
  onToggleCategory,
  onClearFilters,
  activePathId,
  onShowPath,
  onClearPath,
  inboxCount,
}: {
  data: IntelligenceData;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectNode: (id: string) => void;
  onOpenWorkbench: (tab: WorkbenchTab) => void;
  activeCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onClearFilters: () => void;
  activePathId: string | null;
  onShowPath: (pathId: string) => void;
  onClearPath: () => void;
  inboxCount: number;
}) {
  const model = useProgress();
  const { progress, xpByNodeId, totalXp, replaceProgress, resetProgress } = model;
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [pathsOpen, setPathsOpen] = useState(false);

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
    if (!search.trim()) return [];
    const nodesByIdLocal = new Map(data.nodes.map((node) => [node.id, node]));
    return conceptSearch(search, progress.personalNodes, 8)
      .filter((result) => result.kind === "node")
      .filter((result) => {
        if (activeCategories.size === 0) return true;
        const node = nodesByIdLocal.get(result.id);
        return node ? activeCategories.has(node.categoryId) : true;
      })
      .slice(0, 6);
  }, [activeCategories, data.nodes, progress.personalNodes, search]);

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
      const result = await importBackup(file);
      replaceProgress(result.progress);
      setError(null);
      setNotice(result.summary);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "That file could not be read as Neuron data.",
      );
    }
  }

  const chooseSearchResult = (id: string) => {
    onSelectNode(id);
    onSearchChange("");
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col gap-2 p-3 md:p-4 sm:pl-[20.5rem] md:pl-[20.5rem]">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        <div className="flex min-h-[40px] items-center gap-2.5 rounded-xl border border-white/12 bg-black/60 px-3 py-2 shadow-lg backdrop-blur-xl">
          <span className="text-sm font-semibold tracking-tight text-white">Neuron</span>
          <span className="h-3.5 w-px bg-white/15" aria-hidden="true" />
          <span className="tabular-nums text-xs text-neutral-300">
            <span className="font-semibold text-white">{totalXp.toLocaleString()}</span> XP
          </span>
          <span className="hidden tabular-nums text-xs text-neutral-500 sm:inline">
            {awake}/{data.nodes.length} active
          </span>
        </div>

        <div className="relative order-last w-full sm:order-none sm:w-auto">
          <div className="relative">
            <input
              ref={searchInput}
              type="search"
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
              placeholder="Search capabilities…"
              aria-label="Search capabilities"
              className="min-h-[40px] w-full rounded-xl border border-white/12 bg-black/60 px-3 py-2 pr-9 text-xs text-neutral-100 shadow-lg outline-none backdrop-blur-xl transition-[border-color,background-color] placeholder:text-neutral-500 focus:border-white/30 focus:bg-black/75 sm:w-64"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  searchInput.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-neutral-500 hover:bg-white/8 hover:text-white"
              >
                ×
              </button>
            ) : (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-neutral-500">
                /
              </span>
            )}
          </div>

          {search.trim() && (
            <div className="absolute left-0 top-full z-40 mt-2 w-full min-w-[18rem] overflow-hidden rounded-xl border border-white/12 bg-[rgb(255_255_255_/_0.98)] p-1.5 shadow-2xl backdrop-blur-2xl sm:w-[22rem]">
              {searchResults.length > 0 ? (
                searchResults.map((result, index) => {
                  const node = data.nodes.find((item) => item.id === result.id);
                  const category = node ? categoriesById.get(node.categoryId) : undefined;
                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => chooseSearchResult(result.id)}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.07] focus:bg-white/[0.07] focus:outline-none"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]"
                        style={{
                          color: `oklch(0.46 0.14 ${category?.hue ?? 260})`,
                          background: "currentColor",
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-neutral-100">
                          {result.label}
                        </span>
                        <span className="block truncate text-[10px] text-neutral-500">
                          {category?.label ?? result.detail}
                          {/* A synonym hit is not obvious from the label, so say
                              why it is in the list rather than looking arbitrary. */}
                          {result.matchedOn?.startsWith('"') && (
                            <span className="text-neutral-600"> · matched {result.matchedOn}</span>
                          )}
                        </span>
                      </span>
                      {index === 0 && <span className="text-[9px] text-neutral-600">Enter</span>}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-3 text-xs text-neutral-500">No matching capabilities</div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpenWorkbench("review")}
          className={[
            "relative min-h-[40px] rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur-xl transition-colors",
            inboxCount > 0
              ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-50"
              : "border-white/12 bg-black/60 text-neutral-300 hover:border-white/25 hover:text-white",
          ].join(" ")}
        >
          Review
          {inboxCount > 0 && (
            <span className="ml-1.5 tabular-nums text-cyan-200/80">{inboxCount}</span>
          )}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setPathsOpen((value) => !value)}
            aria-expanded={pathsOpen}
            className={[
              "min-h-[40px] rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur-xl transition-colors",
              activePathId
                ? "border-white/30 bg-white/12 text-white"
                : "border-white/12 bg-black/60 text-neutral-300 hover:border-white/25 hover:text-white",
            ].join(" ")}
          >
            Paths
          </button>
          {pathsOpen && (
            <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-xl border border-white/12 bg-[rgb(255_255_255_/_0.98)] p-1.5 shadow-2xl backdrop-blur-2xl">
              {activePathId && (
                <button
                  type="button"
                  onClick={() => {
                    onClearPath();
                    setPathsOpen(false);
                  }}
                  className="mb-1 w-full rounded-lg px-2.5 py-2 text-left text-xs text-neutral-400 hover:bg-white/[0.07] hover:text-white"
                >
                  Clear path overlay
                </button>
              )}
              {paths.map((path) => (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => {
                    onShowPath(path.id);
                    setPathsOpen(false);
                  }}
                  className={[
                    "w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-white/[0.07] hover:text-white",
                    activePathId === path.id ? "bg-white/10 text-white" : "text-neutral-300",
                  ].join(" ")}
                >
                  {path.label}
                  <span className="mt-0.5 block text-[9px] text-neutral-600">
                    {path.nodeIds.length} capabilities
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setLegendOpen((value) => !value)}
          aria-expanded={legendOpen}
          className={[
            "min-h-[40px] rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur-xl transition-colors",
            activeCategories.size > 0
              ? "border-white/30 bg-white/12 text-white"
              : "border-white/12 bg-black/60 text-neutral-300 hover:border-white/25 hover:text-white",
          ].join(" ")}
        >
          Filter{activeCategories.size > 0 && ` (${activeCategories.size})`}
        </button>

        <div className="relative sm:ml-auto">
          <button
            type="button"
            onClick={() => setDataOpen((value) => !value)}
            aria-expanded={dataOpen}
            className="min-h-[40px] rounded-xl border border-white/12 bg-black/60 px-3 py-2 text-xs text-neutral-400 shadow-lg backdrop-blur-xl transition-colors hover:border-white/25 hover:text-white"
          >
            Data
          </button>
          {dataOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-white/12 bg-[rgb(255_255_255_/_0.98)] p-1.5 shadow-2xl backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => {
                  void exportBackup(progress);
                  setDataOpen(false);
                }}
                className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/[0.07] hover:text-white"
              >
                Export full backup
                <span className="mt-0.5 block text-[9px] text-neutral-600">
                  Everything, including journals and attachments
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  exportAnkiCsv(data);
                  setDataOpen(false);
                }}
                className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/[0.07] hover:text-white"
              >
                Export Anki CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  void exportObsidianVault(data);
                  setDataOpen(false);
                }}
                className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/[0.07] hover:text-white"
              >
                Export Obsidian ZIP
              </button>
              <div className="my-1 h-px bg-white/8" />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/[0.07] hover:text-white"
              >
                Import backup
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
                  // Export first, always. A reset dialog without a backup step
                  // is how people lose years of records to one misread prompt.
                  void exportBackup(progress).then(() => {
                    if (
                      window.confirm(
                        "A backup has been downloaded. Erase all local progress, journals and settings?",
                      )
                    ) {
                      resetProgress();
                    }
                  });
                  setDataOpen(false);
                }}
                className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-red-300/60 hover:bg-red-400/[0.07] hover:text-red-200"
              >
                Reset progress
                <span className="mt-0.5 block text-[9px] text-red-300/40">
                  Exports a backup first
                </span>
              </button>
            </div>
          )}
        </div>

        {/* The keyboard hint is the first thing to give up its space: the row
            now starts clear of the navigation pill. */}
        <div className="hidden items-center gap-1 rounded-xl border border-white/8 bg-black/70 px-2.5 py-2 text-[9px] text-neutral-400 shadow-lg backdrop-blur-xl xl:flex">
          <kbd className="font-mono">⌘/Ctrl K</kbd>
          <span>commands</span>
        </div>
      </div>

      {error && (
        <div className="pointer-events-auto w-fit rounded-lg border border-red-500/30 bg-red-950/70 px-3 py-1.5 text-xs text-red-100 shadow-lg backdrop-blur-xl">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-white"
          >
            dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="pointer-events-auto w-fit max-w-lg rounded-lg border border-emerald-400/25 bg-emerald-950/60 px-3 py-1.5 text-xs text-emerald-100 shadow-lg backdrop-blur-xl">
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-2 text-emerald-300 hover:text-white"
          >
            dismiss
          </button>
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
                  className="flex min-h-[26px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all"
                  style={{
                    borderColor: active
                      ? `oklch(0.52 0.14 ${category.hue})`
                      : "oklch(1 0 0 / 0.14)",
                    background: active
                      ? `oklch(0.72 0.13 ${category.hue} / 0.22)`
                      : "oklch(1 0 0 / 0.025)",
                    color: active ? `oklch(0.38 0.13 ${category.hue})` : "oklch(0.44 0.01 265)",
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: `oklch(0.58 0.15 ${category.hue})` }}
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
              className="mt-2 text-[11px] text-neutral-400 hover:text-white"
            >
              Clear filters
            </button>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/8 pt-2.5 text-[10px] text-neutral-500">
            {TIERS.map((tier) => (
              <span key={tier.index} className="flex items-center gap-1.5">
                <span
                  className="rounded-full bg-neutral-200"
                  style={{
                    width: 5 + tier.index * 1.6,
                    height: 5 + tier.index * 1.6,
                    opacity: tier.opacity,
                  }}
                  aria-hidden="true"
                />
                {tier.name}
                <span className="tabular-nums text-neutral-600">{tierCounts[tier.index]}</span>
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/8 pt-2.5 text-[10px] text-neutral-500">
            <Chip tone="warn">amber dot = retention slipping</Chip>
            <Chip>dashed ring = practised, nothing scored</Chip>
            <Chip tone="active">cyan dot = in the review queue</Chip>
            <Chip>faded edge = weaker evidence for that relationship</Chip>
          </div>
        </div>
      )}
    </div>
  );
}
