"use client";

import { useEffect } from "react";
import { nextTier, tierForXp, tierProgress } from "@/lib/mastery";
import { neighborsOf } from "@/lib/graph";
import type { Category, ConceptNode, IntelligenceData, ResourceType } from "@/lib/types";
import { HabitChecklist } from "./HabitChecklist";
import { useProgress } from "./ProgressProvider";

const RESOURCE_LABEL: Record<ResourceType, string> = {
  book: "Book",
  course: "Course",
  tool: "Tool",
  paper: "Paper",
  practice: "Practice",
  video: "Video",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function SidePanel({
  data,
  node,
  category,
  nodesById,
  onClose,
  onSelectNode,
}: {
  data: IntelligenceData;
  node: ConceptNode | null;
  category: Category | null;
  nodesById: Map<string, ConceptNode>;
  onClose: () => void;
  onSelectNode: (id: string) => void;
}) {
  const { xpByNodeId, logsByNodeId, undoLog } = useProgress();

  useEffect(() => {
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, onClose]);

  const open = Boolean(node);
  const hue = category?.hue ?? 260;
  const xp = node ? (xpByNodeId[node.id] ?? 0) : 0;
  const tier = tierForXp(xp);
  const next = nextTier(xp);
  const fill = tierProgress(xp);
  const logs = node ? (logsByNodeId[node.id] ?? []) : [];
  const neighbors = node ? neighborsOf(data, node.id) : [];

  return (
    <aside
      aria-hidden={!open}
      className={[
        "fixed z-20 flex flex-col border-white/10 bg-[oklch(0.16_0.018_265_/_0.92)] backdrop-blur-xl",
        "transition-transform duration-300 ease-out",
        // Bottom sheet on narrow screens, right rail from md up.
        "inset-x-0 bottom-0 max-h-[78vh] rounded-t-2xl border-t",
        "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0",
        open
          ? "translate-y-0 md:translate-x-0"
          : "translate-y-full md:translate-y-0 md:translate-x-full",
      ].join(" ")}
    >
      {node && (
        <>
          <header
            className="relative shrink-0 border-b border-white/10 p-5"
            style={{
              background: `linear-gradient(160deg, oklch(0.3 0.09 ${hue} / 0.35), transparent 70%)`,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-md text-neutral-500 transition-colors hover:bg-white/8 hover:text-neutral-200"
            >
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M2 2l10 10M12 2L2 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <span
              className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{
                color: `oklch(0.85 0.12 ${hue})`,
                background: `oklch(0.7 0.15 ${hue} / 0.14)`,
              }}
            >
              {category?.label}
            </span>

            <h2 className="mt-2.5 pr-8 text-xl font-semibold leading-tight text-neutral-50">
              {node.label}
            </h2>

            <div className="mt-4 flex items-baseline justify-between text-xs">
              <span style={{ color: `oklch(0.82 0.13 ${hue})` }}>{tier.name}</span>
              <span className="tabular-nums text-neutral-500">
                {xp} XP{next ? ` · ${next.min - xp} to ${next.name}` : " · fully trained"}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.round(fill * 100)}%`,
                  background: `oklch(0.75 0.16 ${hue})`,
                  boxShadow: `0 0 10px oklch(0.75 0.16 ${hue} / 0.7)`,
                }}
              />
            </div>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <section>
              <p className="text-[13px] leading-relaxed text-neutral-300">
                {node.description}
              </p>
              <p
                className="mt-3 border-l-2 pl-3 text-[13px] italic leading-relaxed text-neutral-400"
                style={{ borderColor: `oklch(0.7 0.15 ${hue} / 0.5)` }}
              >
                {node.why}
              </p>
            </section>

            <section>
              <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                Habit log
              </h3>
              <HabitChecklist node={node} hue={hue} />
            </section>

            <section>
              <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                Resources
              </h3>
              <ul className="flex flex-col gap-1.5">
                {node.resources.map((resource) => {
                  const meta = (
                    <>
                      <span className="shrink-0 rounded bg-white/6 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-neutral-500">
                        {RESOURCE_LABEL[resource.type]}
                      </span>
                      <span className="min-w-0 flex-1">{resource.title}</span>
                    </>
                  );
                  return (
                    <li key={resource.title}>
                      {resource.url ? (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg border border-white/8 px-2.5 py-2 text-[13px] text-neutral-300 transition-colors hover:border-white/20 hover:bg-white/[0.03] hover:text-neutral-100"
                        >
                          {meta}
                          <svg
                            viewBox="0 0 12 12"
                            className="h-3 w-3 shrink-0 text-neutral-600"
                            aria-hidden="true"
                          >
                            <path
                              d="M4.5 2h5.5v5.5M10 2L2.5 9.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                            />
                          </svg>
                        </a>
                      ) : (
                        // No URL by design: these are citations, not links.
                        <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/8 px-2.5 py-2 text-[13px] text-neutral-400">
                          {meta}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {neighbors.length > 0 && (
              <section>
                <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                  Connections
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {neighbors.map((neighbor) => {
                    const target = nodesById.get(neighbor.id);
                    if (!target) return null;
                    return (
                      <button
                        key={`${neighbor.id}-${neighbor.direction}`}
                        type="button"
                        onClick={() => onSelectNode(neighbor.id)}
                        title={
                          neighbor.type === "prereq"
                            ? neighbor.direction === "in"
                              ? "Builds toward this"
                              : "This builds toward it"
                            : "Reinforces each other"
                        }
                        className={[
                          "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                          neighbor.type === "prereq"
                            ? "border border-white/12 bg-white/[0.03] text-neutral-300 hover:border-white/30 hover:text-neutral-100"
                            : "border border-dashed border-white/12 text-neutral-400 hover:border-white/30 hover:text-neutral-200",
                        ].join(" ")}
                      >
                        {neighbor.direction === "in" ? "← " : ""}
                        {target.label}
                        {neighbor.direction === "out" ? " →" : ""}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {logs.length > 0 && (
              <section>
                <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                  Recent activity
                </h3>
                <ul className="flex flex-col gap-1">
                  {logs.slice(0, 10).map((log) => (
                    <li
                      key={log.id}
                      className="group flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-neutral-500 hover:bg-white/[0.03]"
                    >
                      <span className="tabular-nums" style={{ color: `oklch(0.72 0.13 ${hue})` }}>
                        +{log.xp}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {log.note ?? relativeTime(log.at)}
                      </span>
                      {log.note && (
                        <span className="shrink-0 text-neutral-600">
                          {relativeTime(log.at)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => undoLog(log.id)}
                        className="shrink-0 rounded px-1 text-neutral-600 opacity-0 transition-opacity hover:text-neutral-300 focus:opacity-100 group-hover:opacity-100"
                      >
                        undo
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
