"use client";

import { useMemo, useState } from "react";
import {
  estimateExerciseMinutes,
  exerciseResetState,
} from "@/lib/mastery";
import {
  isTypableExercise,
  prerequisiteBuffSources,
  synergyMultiplierForNode,
} from "@/lib/training";
import type { ConceptNode, IntelligenceData } from "@/lib/types";
import { useProgress } from "./ProgressProvider";

const CADENCE_LABEL = {
  daily: "daily",
  weekly: "weekly",
  session: "4h session",
} as const;

function resetLabel(resetAt: Date | null): string {
  if (!resetAt) return "ready";
  const diff = Math.max(0, resetAt.getTime() - Date.now());
  const hours = Math.floor(diff / 36e5);
  const minutes = Math.ceil((diff % 36e5) / 6e4);
  if (hours >= 24) return `resets in ${Math.ceil(hours / 24)}d`;
  if (hours > 0) return `resets in ${hours}h ${minutes}m`;
  return `resets in ${Math.max(1, minutes)}m`;
}

export function HabitChecklist({
  data,
  node,
  hue,
}: {
  data: IntelligenceData;
  node: ConceptNode;
  hue: number;
}) {
  const { logExercise, logsByNodeId, xpByNodeId } = useProgress();
  const [openExerciseFor, setOpenExerciseFor] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [minutes, setMinutes] = useState("");
  const logs = logsByNodeId[node.id] ?? [];

  const buffSources = useMemo(
    () => prerequisiteBuffSources(data, node.id, xpByNodeId),
    [data, node.id, xpByNodeId],
  );
  const multiplier = synergyMultiplierForNode(data, node.id, xpByNodeId);

  function openExercise(exerciseId: string) {
    const exercise = node.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    const state = exerciseResetState(logs, exercise.id, exercise.cadence);
    if (!state.available) return;
    setOpenExerciseFor((current) => (current === exerciseId ? null : exerciseId));
    setResponse("");
    setMinutes(String(estimateExerciseMinutes(exercise)));
  }

  function commit(exerciseId: string) {
    const exercise = node.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    // Re-check at commit time so double clicks/racing controls cannot mint XP.
    if (!exerciseResetState(logs, exercise.id, exercise.cadence).available) return;

    const typable = isTypableExercise(exercise.label);
    const typed = response.trim();
    if (typable && typed.length < 3) return;

    const parsedMinutes = Number(minutes);
    logExercise(node.id, exercise, typed || undefined, {
      multiplier,
      minutes:
        Number.isFinite(parsedMinutes) && parsedMinutes > 0
          ? Math.round(parsedMinutes)
          : estimateExerciseMinutes(exercise),
      source: "panel",
    });
    setResponse("");
    setMinutes("");
    setOpenExerciseFor(null);
  }

  return (
    <div>
      {multiplier > 1 && (
        <div
          className="mb-2.5 rounded-lg border px-3 py-2 text-[11px]"
          style={{
            borderColor: `oklch(0.7 0.15 ${hue} / 0.28)`,
            background: `oklch(0.58 0.11 ${hue} / 0.08)`,
            color: `oklch(0.88 0.09 ${hue})`,
          }}
        >
          <span className="font-semibold">+25% Synergy Buff active.</span>{" "}
          {buffSources.length} consolidated prerequisite
          {buffSources.length === 1 ? "" : "s"} supporting this faculty.
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {node.exercises.map((exercise) => {
          const reset = exerciseResetState(logs, exercise.id, exercise.cadence);
          const done = !reset.available;
          const open = openExerciseFor === exercise.id;
          const typable = isTypableExercise(exercise.label);
          const awardedXp = Math.round(exercise.xp * multiplier);
          const canSubmit = !typable || response.trim().length >= 3;

          return (
            <li
              key={exercise.id}
              className={[
                "rounded-xl border p-3 transition-[border-color,background-color,opacity]",
                done
                  ? "border-white/6 bg-white/[0.015]"
                  : open
                    ? "border-white/20 bg-white/[0.045]"
                    : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  disabled={done}
                  onClick={() => openExercise(exercise.id)}
                  aria-label={
                    done
                      ? `${exercise.label}, ${resetLabel(reset.nextResetAt)}`
                      : `Open exercise: ${exercise.label}`
                  }
                  className={[
                    "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-all",
                    done
                      ? "cursor-not-allowed"
                      : "hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                  ].join(" ")}
                  style={{
                    borderColor: done
                      ? `oklch(0.72 0.13 ${hue} / 0.7)`
                      : `oklch(0.68 0.08 ${hue} / 0.55)`,
                    background: done
                      ? `oklch(0.68 0.14 ${hue} / 0.78)`
                      : open
                        ? `oklch(0.65 0.12 ${hue} / 0.18)`
                        : "transparent",
                    boxShadow: done
                      ? `0 0 12px oklch(0.72 0.17 ${hue} / 0.32)`
                      : undefined,
                  }}
                >
                  {done ? (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                      <path
                        d="M2.5 6.2 4.8 8.5 9.5 3.8"
                        fill="none"
                        stroke="oklch(0.13 0.02 265)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: `oklch(0.8 0.13 ${hue})` }}
                    />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={done}
                    onClick={() => openExercise(exercise.id)}
                    className="w-full text-left disabled:cursor-default"
                  >
                    <p
                      className={[
                        "text-[13px] leading-snug",
                        done ? "text-neutral-500" : "text-neutral-100",
                      ].join(" ")}
                    >
                      {exercise.label}
                    </p>
                  </button>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
                    <span>{CADENCE_LABEL[exercise.cadence]}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={done ? "text-neutral-600" : ""}
                      style={done ? undefined : { color: `oklch(0.8 0.13 ${hue})` }}
                    >
                      +{awardedXp} XP
                      {multiplier > 1 && (
                        <span className="ml-1 normal-case text-neutral-500">
                          ({exercise.xp} × 1.25)
                        </span>
                      )}
                    </span>
                    <span className={done ? "text-neutral-500" : "text-emerald-300/70"}>
                      {done ? resetLabel(reset.nextResetAt) : "ready"}
                    </span>
                    {typable && !done && (
                      <span className="ml-auto normal-case tracking-normal text-neutral-500">
                        can complete here
                      </span>
                    )}
                  </div>

                  {open && !done && (
                    <div className="mt-3 space-y-2.5 border-t border-white/8 pt-3">
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                          {typable ? "Complete the task here" : "Completion evidence / notes"}
                        </span>
                        <textarea
                          autoFocus
                          value={response}
                          onChange={(event) => setResponse(event.target.value)}
                          onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                              event.preventDefault();
                              if (canSubmit) commit(exercise.id);
                            }
                            if (event.key === "Escape") setOpenExerciseFor(null);
                          }}
                          placeholder={
                            typable
                              ? "Work through the exercise here. Your response is saved with the XP log…"
                              : "What did you do? Add details so the rep has evidence, not just a click…"
                          }
                          rows={typable ? 5 : 3}
                          className="w-full resize-y rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs leading-relaxed text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-white/25 focus:bg-black/50"
                        />
                      </label>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                          <span>Minutes</span>
                          <input
                            type="number"
                            min={1}
                            max={600}
                            value={minutes}
                            onChange={(event) => setMinutes(event.target.value)}
                            className="w-16 rounded-md border border-white/10 bg-black/35 px-2 py-1 text-xs tabular-nums text-neutral-200 outline-none focus:border-white/25"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenExerciseFor(null)}
                          className="ml-auto rounded-md px-2.5 py-1.5 text-xs text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!canSubmit}
                          onClick={() => commit(exercise.id)}
                          className="rounded-md px-3 py-1.5 text-xs font-semibold text-black transition-[opacity,transform] hover:-translate-y-px hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
                          style={{ background: `oklch(0.8 0.14 ${hue})` }}
                        >
                          Complete · +{awardedXp} XP
                        </button>
                      </div>
                      <p className="text-[9px] text-neutral-600">
                        Ctrl/Cmd + Enter submits. This task cannot award XP again until its reset window opens.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
