"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GROUP_LABEL,
  GROUP_ORDER,
  buildCommands,
  filterCommands,
  type CommandGroup,
} from "@/lib/commands";
import { adaptiveStateFor, difficultyXpFactor } from "@/lib/difficulty";
import { estimateExerciseMinutes, exerciseResetState } from "@/lib/mastery";
import { synergyMultiplierForNode } from "@/lib/training";
import type { IntelligenceData } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import { useDismissable } from "./useDismissable";
import type { WorkbenchTab } from "./Workbench";

/**
 * The command palette.
 *
 * Renders the shared command registry rather than its own hardcoded list, so a
 * feature added anywhere becomes keyboard-reachable here without being wired in
 * twice. Faculties and ready exercises are merged in as dynamic rows.
 */
export function CommandPalette({
  data,
  selectedId,
  onSelectNode,
  onOpenWorkbench,
  onOpenPlanner,
  onRunProbe,
  onOpenMission,
  onShowPath,
  onFitView,
  focusMode,
  onToggleFocusMode,
  researchMode,
  onToggleResearchMode,
}: {
  data: IntelligenceData;
  selectedId: string | null;
  onSelectNode: (id: string) => void;
  onOpenWorkbench: (tab: WorkbenchTab) => void;
  onOpenPlanner: () => void;
  onRunProbe: (probeId: string) => void;
  onOpenMission: (missionId: string) => void;
  onShowPath: (pathId: string) => void;
  onFitView: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  researchMode: boolean;
  onToggleResearchMode: () => void;
}) {
  const { logsByNodeId, logExercise, xpByNodeId } = useProgress();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  const commands = useMemo(
    () =>
      buildCommands(
        {
          openWorkbench: onOpenWorkbench,
          openPlanner: onOpenPlanner,
          runProbe: onRunProbe,
          openMission: onOpenMission,
          showPath: onShowPath,
          selectNode: onSelectNode,
          fitView: onFitView,
          toggleFocusMode: onToggleFocusMode,
          toggleResearchMode: onToggleResearchMode,
        },
        { hasSelection: Boolean(selectedId), focusMode, researchMode },
      ),
    [
      onOpenWorkbench,
      onOpenPlanner,
      onRunProbe,
      onOpenMission,
      onShowPath,
      onSelectNode,
      onFitView,
      onToggleFocusMode,
      onToggleResearchMode,
      selectedId,
      focusMode,
      researchMode,
    ],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (open) {
          setOpen(false);
        } else {
          setQuery("");
          setCursor(0);
          setOpen(true);
        }
        return;
      }

      // Single-key shortcuts, only when nothing is capturing text and no modal
      // is up. Without the guard these fire while typing in the journal.
      if (open || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable ||
        target?.closest("[role='dialog']")
      ) {
        return;
      }
      const match = commands.find((command) => command.shortcut === event.key.toLowerCase());
      if (!match) return;
      event.preventDefault();
      match.run();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, commands]);

  useDismissable({
    open,
    onClose: () => setOpen(false),
    modal: true,
    container: dialogRef,
  });

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const categoriesById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  );

  const normalized = query.trim().toLowerCase();

  const matchedCommands = useMemo(
    () => filterCommands(commands, query).slice(0, 8),
    [commands, query],
  );

  const nodeResults = useMemo(() => {
    if (!normalized) return [];
    return data.nodes
      .filter((node) =>
        `${node.label} ${node.description} ${categoriesById.get(node.categoryId)?.label ?? ""}`
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 6);
  }, [categoriesById, data.nodes, normalized]);

  const exerciseResults = useMemo(() => {
    const rows = data.nodes.flatMap((node) =>
      node.exercises.map((exercise) => ({ node, exercise })),
    );
    return rows
      .filter(({ node, exercise }) => {
        if (
          !exerciseResetState(logsByNodeId[node.id] ?? [], exercise.id, exercise.cadence)
            .available
        ) {
          return false;
        }
        if (!normalized) return node.id === selectedId;
        return `${exercise.label} ${node.label}`.toLowerCase().includes(normalized);
      })
      .slice(0, 5);
  }, [data.nodes, logsByNodeId, normalized, selectedId]);

  const rows = useMemo(
    () => [
      // Sorted by group so the "new group starts here" heading fires once per
      // group rather than once per row. Stable within a group, so the ranking
      // the matcher produced is kept.
      ...[...matchedCommands]
        .sort(
          (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
        )
        .map((command) => ({ kind: "command" as const, command })),
      ...nodeResults.map((node) => ({ kind: "node" as const, node })),
      ...exerciseResults.map((entry) => ({ kind: "exercise" as const, ...entry })),
    ],
    [matchedCommands, nodeResults, exerciseResults],
  );

  function run(action: () => void) {
    action();
    setOpen(false);
  }

  function quickLog(nodeId: string, exerciseId: string) {
    const node = data.nodes.find((item) => item.id === nodeId);
    const exercise = node?.exercises.find((item) => item.id === exerciseId);
    if (!node || !exercise) return;
    const logs = logsByNodeId[node.id] ?? [];
    if (!exerciseResetState(logs, exercise.id, exercise.cadence).available) return;
    const adaptive = adaptiveStateFor(exercise, logs);
    logExercise(node.id, exercise, "Quick completion from command palette", {
      multiplier: synergyMultiplierForNode(data, node.id, xpByNodeId),
      minutes: exercise.minutes ?? estimateExerciseMinutes(exercise),
      source: "command",
      difficulty: adaptive.level,
      // A quick log records no work and no score, so it is the weakest kind of
      // evidence there is. Marking it as anything else would let the palette
      // become the fastest route to an inflated competence estimate.
      evidence: "self-report",
      xp: Math.round(exercise.xp * difficultyXpFactor(adaptive)),
    });
  }

  const activate = (index: number) => {
    const row = rows[index];
    if (!row) return;
    if (row.kind === "command") run(row.command.run);
    else if (row.kind === "node") run(() => onSelectNode(row.node.id));
    else run(() => quickLog(row.node.id, row.exercise.id));
  };

  if (!open) return null;

  let lastGroup: CommandGroup | null = null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-[rgb(25_22_20_/_0.34)] px-3 pt-[10vh] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Neuron command palette"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-[rgb(255_255_255_/_0.985)] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true">
            <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="m10 10 3.2 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((value) => Math.min(rows.length - 1, value + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((value) => Math.max(0, value - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                activate(cursor);
              }
            }}
            placeholder="Run a command, jump to a capability, or log a ready exercise…"
            aria-label="Command palette input"
            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
          />
          <kbd className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-neutral-600">
            Esc
          </kbd>
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-2">
          {rows.length === 0 && (
            <div className="px-4 py-10 text-center text-xs text-neutral-600">
              Nothing matches that.
            </div>
          )}

          {rows.map((row, index) => {
            const active = index === cursor;
            const className = [
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
              active ? "bg-white/[0.09]" : "hover:bg-white/[0.06]",
            ].join(" ");

            if (row.kind === "command") {
              const showHeading = row.command.group !== lastGroup;
              lastGroup = row.command.group;
              return (
                <div key={row.command.id}>
                  {showHeading && (
                    <div className="px-2 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-600">
                      {GROUP_LABEL[row.command.group]}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => activate(index)}
                    onMouseEnter={() => setCursor(index)}
                    className={className}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-[10px] text-neutral-400">
                      {row.command.shortcut?.toUpperCase() ?? "⌘"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-neutral-200">
                      {row.command.label}
                    </span>
                    {row.command.hint && (
                      <span className="shrink-0 text-[9px] text-neutral-600">
                        {row.command.hint}
                      </span>
                    )}
                  </button>
                </div>
              );
            }

            if (row.kind === "node") {
              lastGroup = null;
              const category = categoriesById.get(row.node.categoryId);
              return (
                <button
                  key={`node-${row.node.id}`}
                  type="button"
                  onClick={() => activate(index)}
                  onMouseEnter={() => setCursor(index)}
                  className={className}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full shadow-[0_0_12px_currentColor]"
                    style={{
                      color: `oklch(0.76 0.16 ${category?.hue ?? 260})`,
                      background: "currentColor",
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-neutral-200">
                      {row.node.label}
                    </span>
                    <span className="block truncate text-[10px] text-neutral-600">
                      {category?.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-[9px] text-neutral-600">jump</span>
                </button>
              );
            }

            lastGroup = null;
            const multiplier = synergyMultiplierForNode(data, row.node.id, xpByNodeId);
            const adaptive = adaptiveStateFor(row.exercise, logsByNodeId[row.node.id] ?? []);
            const award = Math.round(
              row.exercise.xp * multiplier * difficultyXpFactor(adaptive),
            );
            return (
              <button
                key={`ex-${row.exercise.id}`}
                type="button"
                onClick={() => activate(index)}
                onMouseEnter={() => setCursor(index)}
                className={className}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-emerald-300/15 bg-emerald-300/[0.04] text-[10px] text-emerald-200/80">
                  +{award}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-neutral-300">
                    {adaptive.label}
                  </span>
                  <span className="block truncate text-[10px] text-neutral-600">
                    {row.node.label} · {row.exercise.cadence} · L{adaptive.level}
                  </span>
                </span>
                <span className="shrink-0 text-[9px] text-neutral-600">log</span>
              </button>
            );
          })}
        </div>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/8 px-4 py-2 text-[9px] text-neutral-600">
          <span>↑↓ to move, Enter to run</span>
          <span>Quick logs obey reset windows and record as self-reported only</span>
        </footer>
      </section>
    </div>
  );
}
