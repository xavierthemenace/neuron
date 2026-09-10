"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  estimateExerciseMinutes,
  exerciseResetState,
} from "@/lib/mastery";
import { synergyMultiplierForNode } from "@/lib/training";
import type { IntelligenceData } from "@/lib/types";
import { useDismissable } from "./useDismissable";
import { useProgress } from "./ProgressProvider";

export function CommandPalette({
  data,
  selectedId,
  onSelectNode,
  onOpenAnalytics,
  onFitView,
  focusMode,
  onToggleFocusMode,
}: {
  data: IntelligenceData;
  selectedId: string | null;
  onSelectNode: (id: string) => void;
  onOpenAnalytics: () => void;
  onFitView: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}) {
  const { logsByNodeId, logExercise, xpByNodeId } = useProgress();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (open) {
          setOpen(false);
        } else {
          setQuery("");
          setOpen(true);
        }
        return;
      }
      // Escape is handled by the shared dismiss stack so the topmost layer wins.
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

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
  const nodeResults = useMemo(() => {
    if (!normalized) {
      if (!selectedId) return data.nodes.slice(0, 5);
      const selected = data.nodes.find((node) => node.id === selectedId);
      return selected ? [selected] : [];
    }
    return data.nodes
      .filter((node) =>
        `${node.label} ${node.description} ${categoriesById.get(node.categoryId)?.label ?? ""}`
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 7);
  }, [categoriesById, data.nodes, normalized, selectedId]);

  const exerciseResults = useMemo(() => {
    const rows = data.nodes.flatMap((node) =>
      node.exercises.map((exercise) => ({ node, exercise })),
    );
    return rows
      .filter(({ node, exercise }) => {
        if (
          !exerciseResetState(
            logsByNodeId[node.id] ?? [],
            exercise.id,
            exercise.cadence,
          ).available
        ) {
          return false;
        }
        if (!normalized) return node.id === selectedId;
        return `${exercise.label} ${node.label}`.toLowerCase().includes(normalized);
      })
      .slice(0, 6);
  }, [data.nodes, logsByNodeId, normalized, selectedId]);

  function run(action: () => void) {
    action();
    setOpen(false);
  }

  function quickLog(nodeId: string, exerciseId: string) {
    const node = data.nodes.find((item) => item.id === nodeId);
    const exercise = node?.exercises.find((item) => item.id === exerciseId);
    if (!node || !exercise) return;
    const reset = exerciseResetState(
      logsByNodeId[node.id] ?? [],
      exercise.id,
      exercise.cadence,
    );
    if (!reset.available) return;
    logExercise(node.id, exercise, "Quick completion from command palette", {
      multiplier: synergyMultiplierForNode(data, node.id, xpByNodeId),
      minutes: estimateExerciseMinutes(exercise),
      source: "command",
    });
  }

  if (!open) return null;

  const commandMatches = (label: string) =>
    !normalized || label.toLowerCase().includes(normalized);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/65 px-3 pt-[12vh] backdrop-blur-sm"
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
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-[oklch(0.145_0.018_265_/_0.985)] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4 shrink-0 text-neutral-500"
            aria-hidden="true"
          >
            <circle
              cx="7"
              cy="7"
              r="4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="m10 10 3.2 3.2"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a faculty, log a ready exercise, or run a command…"
            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
          />
          <kbd className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-neutral-600">
            Esc
          </kbd>
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-2">
          {(commandMatches("analytics dashboard") ||
            commandMatches("fit entire map") ||
            commandMatches("focus mode")) && (
            <div className="mb-2">
              <div className="px-2 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-600">
                Commands
              </div>
              {commandMatches("analytics dashboard") && (
                <button
                  type="button"
                  onClick={() => run(onOpenAnalytics)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.03]">
                    ⌁
                  </span>
                  <span className="flex-1">Open analytics dashboard</span>
                  <span className="text-[9px] text-neutral-600">view</span>
                </button>
              )}
              {commandMatches("fit entire map") && (
                <button
                  type="button"
                  onClick={() => run(onFitView)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.03]">
                    ⊙
                  </span>
                  <span className="flex-1">Fit entire map</span>
                  <span className="text-[9px] text-neutral-600">view</span>
                </button>
              )}
              {selectedId && commandMatches("focus mode") && (
                <button
                  type="button"
                  onClick={() => run(onToggleFocusMode)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.03]">
                    ◎
                  </span>
                  <span className="flex-1">
                    Turn Focus Mode {focusMode ? "off" : "on"}
                  </span>
                  <span className="text-[9px] text-neutral-600">view</span>
                </button>
              )}
            </div>
          )}

          {nodeResults.length > 0 && (
            <div className="mb-2 border-t border-white/6 pt-2">
              <div className="px-2 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-600">
                Faculties
              </div>
              {nodeResults.map((node) => {
                const category = categoriesById.get(node.categoryId);
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => run(() => onSelectNode(node.id))}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
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
                        {node.label}
                      </span>
                      <span className="block truncate text-[10px] text-neutral-600">
                        {category?.label}
                      </span>
                    </span>
                    <span className="text-[9px] text-neutral-600">jump</span>
                  </button>
                );
              })}
            </div>
          )}

          {exerciseResults.length > 0 && (
            <div className="border-t border-white/6 pt-2">
              <div className="px-2 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-600">
                Ready XP tasks
              </div>
              {exerciseResults.map(({ node, exercise }) => {
                const multiplier = synergyMultiplierForNode(
                  data,
                  node.id,
                  xpByNodeId,
                );
                const award = Math.round(exercise.xp * multiplier);
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => run(() => quickLog(node.id, exercise.id))}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-emerald-300/15 bg-emerald-300/[0.04] text-[10px] text-emerald-200/80">
                      +{award}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-neutral-300">
                        {exercise.label}
                      </span>
                      <span className="block truncate text-[10px] text-neutral-600">
                        {node.label} · {exercise.cadence}
                      </span>
                    </span>
                    <span className="text-[9px] text-neutral-600">log</span>
                  </button>
                );
              })}
            </div>
          )}

          {nodeResults.length === 0 &&
            exerciseResults.length === 0 &&
            normalized && (
              <div className="px-4 py-10 text-center text-xs text-neutral-600">
                No matching faculties, ready tasks, or commands.
              </div>
            )}
        </div>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/8 px-4 py-2 text-[9px] text-neutral-600">
          <span>Cmd/Ctrl + K toggle</span>
          <span>Quick logs still obey task reset windows</span>
        </footer>
      </section>
    </div>
  );
}
