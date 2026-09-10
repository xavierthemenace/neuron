"use client";

import { useEffect } from "react";
import { nextTier, tierForXp, tierProgress } from "@/lib/mastery";
import { neighborsOf } from "@/lib/graph";
import type {
  Category,
  ConceptNode,
  IntelligenceData,
  ResourceType,
} from "@/lib/types";
import { HabitChecklist } from "./HabitChecklist";
import { MarkdownJournal } from "./MarkdownJournal";
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
  focusMode,
  onFocusModeChange,
}: {
  data: IntelligenceData;
  node: ConceptNode | null;
  category: Category | null;
  nodesById: Map<string, ConceptNode>;
  onClose: () => void;
  onSelectNode: (id: string) => void;
  focusMode: boolean;
  onFocusModeChange: (enabled: boolean) => void;
}) {
  const {
    xpByNodeId,
    rawXpByNodeId,
    decayByNodeId,
    logsByNodeId,
    undoLog,
  } = useProgress();

  useEffect(() => {
    if (!node) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, onClose]);

  const open = Boolean(node);
  const hue = category?.hue ?? 260;
  const xp = node ? (xpByNodeId[node.id] ?? 0) : 0;
  const rawXp = node ? (rawXpByNodeId[node.id] ?? 0) : 0;
  const decay = node ? decayByNodeId[node.id] : undefined;
  const tier = tierForXp(xp);
  const next = nextTier(xp);
  const fill = tierProgress(xp);
  const logs = node ? (logsByNodeId[node.id] ?? []) : [];
  const neighbors = node ? neighborsOf(data, node.id) : [];

  return (
    <aside
      aria-hidden={!open}
      className={[
        "fixed z-40 flex flex-col border-white/12 bg-[oklch(0.145_0.018_265_/_0.955)] shadow-2xl backdrop-blur-2xl",
        "transition-transform duration-300 ease-out",
        "inset-x-0 bottom-0 max-h-[82vh] rounded-t-2xl border-t",
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
              background: `linear-gradient(155deg, oklch(0.34 0.1 ${hue} / 0.36), oklch(0.17 0.02 265 / 0.72) 58%, transparent 100%)`,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border border-transparent text-neutral-400 transition-colors hover:border-white/10 hover:bg-white/8 hover:text-white"
            >
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            <div className="flex flex-wrap items-center gap-2 pr-10">
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  color: `oklch(0.9 0.12 ${hue})`,
                  background: `oklch(0.7 0.15 ${hue} / 0.16)`,
                }}
              >
                {category?.label}
              </span>
              {decay?.decaying && (
                <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-200/80">
                  review due
                </span>
              )}
            </div>

            <h2 className="mt-2.5 pr-8 text-xl font-semibold leading-tight text-neutral-50">
              {node.label}
            </h2>

            <div className="mt-4 flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium" style={{ color: `oklch(0.88 0.13 ${hue})` }}>
                {tier.name}
              </span>
              <span className="text-right tabular-nums text-neutral-400">
                {xp} effective XP
                {next ? ` · ${Math.max(0, next.min - xp)} to ${next.name}` : " · fully trained"}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.round(fill * 100)}%`,
                  background: `oklch(0.78 0.17 ${hue})`,
                  boxShadow: `0 0 12px oklch(0.75 0.16 ${hue} / 0.75)`,
                }}
              />
            </div>

            {rawXp > 0 && (
              <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-neutral-500">
                <span>{rawXp.toLocaleString()} lifetime XP</span>
                {decay?.decaying && (
                  <span className="text-amber-200/60">
                    {Math.round(decay.retention * 100)}% retention · {Math.floor(decay.daysIdle)}d idle
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <div>
                <div className="text-[11px] font-medium text-neutral-200">Focus Mode</div>
                <div className="text-[9px] text-neutral-500">Show only this faculty + 1st/2nd-degree network</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={focusMode}
                onClick={() => onFocusModeChange(!focusMode)}
                className={[
                  "relative h-6 w-11 rounded-full border transition-colors",
                  focusMode
                    ? "border-cyan-300/30 bg-cyan-300/20"
                    : "border-white/12 bg-white/[0.04]",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-neutral-100 shadow transition-transform",
                    focusMode ? "translate-x-[22px]" : "translate-x-[3px]",
                  ].join(" ")}
                />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <section>
              <p className="text-[13px] leading-relaxed text-neutral-200">
                {node.description}
              </p>
              <p
                className="mt-3 border-l-2 pl-3 text-[13px] italic leading-relaxed text-neutral-400"
                style={{ borderColor: `oklch(0.72 0.15 ${hue} / 0.58)` }}
              >
                {node.why}
              </p>
            </section>

            <section>
              <div className="mb-2.5 flex items-end justify-between gap-2">
                <div>
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Training</h3>
                  <p className="mt-0.5 text-[9px] text-neutral-600">Complete work here or log external practice. XP is reset-gated.</p>
                </div>
              </div>
              <HabitChecklist data={data} node={node} hue={hue} />
            </section>

            <MarkdownJournal nodeId={node.id} hue={hue} />

            {neighbors.length > 0 && (
              <section>
                <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Connections</h3>
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
                            ? "border border-white/14 bg-white/[0.035] text-neutral-200 hover:border-white/30 hover:bg-white/[0.07] hover:text-white"
                            : "border border-dashed border-white/14 text-neutral-300 hover:border-white/30 hover:bg-white/[0.04] hover:text-white",
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

            <section>
              <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Resources</h3>
              <ul className="flex flex-col gap-1.5">
                {node.resources.map((resource) => {
                  const meta = (
                    <>
                      <span className="shrink-0 rounded bg-white/7 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-neutral-500">
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
                          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.015] px-2.5 py-2 text-[13px] text-neutral-300 transition-colors hover:border-white/22 hover:bg-white/[0.05] hover:text-white"
                        >
                          {meta}
                          <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0 text-neutral-500" aria-hidden="true">
                            <path d="M4.5 2h5.5v5.5M10 2 2.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                          </svg>
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-2.5 py-2 text-[13px] text-neutral-400">
                          {meta}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {logs.length > 0 && (
              <section>
                <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Recent activity</h3>
                <ul className="flex flex-col gap-1">
                  {logs.slice(0, 12).map((log) => (
                    <li
                      key={log.id}
                      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-neutral-500 hover:bg-white/[0.035]"
                    >
                      <span className="tabular-nums font-medium" style={{ color: `oklch(0.78 0.13 ${hue})` }}>
                        +{log.xp}
                      </span>
                      {log.multiplier && log.multiplier > 1 && (
                        <span className="rounded bg-emerald-300/[0.06] px-1 py-0.5 text-[8px] text-emerald-200/60">buff</span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{log.note ?? relativeTime(log.at)}</span>
                      {log.minutes && <span className="shrink-0 text-neutral-600">{log.minutes}m</span>}
                      {log.note && <span className="shrink-0 text-neutral-600">{relativeTime(log.at)}</span>}
                      <button
                        type="button"
                        onClick={() => undoLog(log.id)}
                        className="shrink-0 rounded px-1 text-neutral-600 opacity-0 transition-opacity hover:text-neutral-200 focus:opacity-100 group-hover:opacity-100"
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
