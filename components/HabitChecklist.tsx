"use client";

import { useMemo, useState } from "react";
import { adaptiveStateFor, difficultyXpFactor, isSaturated } from "@/lib/difficulty";
import { estimateExerciseMinutes, exerciseResetState } from "@/lib/mastery";
import {
  isTypableExercise,
  prerequisiteBuffSources,
  synergyMultiplierForNode,
} from "@/lib/training";
import type { ConceptNode, EvidenceKind, IntelligenceData } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import { Why, inputClass } from "./ui";

const CADENCE_LABEL = {
  daily: "daily",
  weekly: "weekly",
  session: "4h session",
} as const;

const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  "self-report": "Self-reported",
  artifact: "Produced work",
  scored: "Scored",
  external: "Real-world",
};

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
  const [quality, setQuality] = useState(0.7);
  const logs = logsByNodeId[node.id] ?? [];

  const buffSources = useMemo(
    () => prerequisiteBuffSources(data, node.id, xpByNodeId),
    [data, node.id, xpByNodeId],
  );
  const multiplier = synergyMultiplierForNode(data, node.id, xpByNodeId);

  function openExercise(exerciseId: string) {
    const exercise = node.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    if (!exerciseResetState(logs, exercise.id, exercise.cadence).available) return;
    setOpenExerciseFor((current) => (current === exerciseId ? null : exerciseId));
    setResponse("");
    setQuality(0.7);
    setMinutes(String(exercise.minutes ?? estimateExerciseMinutes(exercise)));
  }

  function commit(exerciseId: string) {
    const exercise = node.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    // Re-check at commit time so double clicks/racing controls cannot mint XP.
    if (!exerciseResetState(logs, exercise.id, exercise.cadence).available) return;

    const typable = isTypableExercise(exercise.label);
    const typed = response.trim();
    if (typable && typed.length < 3) return;

    const adaptive = adaptiveStateFor(exercise, logs);
    const parsedMinutes = Number(minutes);
    const evidence: EvidenceKind =
      typed.length >= 40 ? "artifact" : (exercise.evidence ?? "self-report");

    logExercise(node.id, exercise, typed || undefined, {
      multiplier,
      minutes:
        Number.isFinite(parsedMinutes) && parsedMinutes > 0
          ? Math.round(parsedMinutes)
          : (exercise.minutes ?? estimateExerciseMinutes(exercise)),
      source: "panel",
      difficulty: adaptive.level,
      evidence,
      quality,
      xp: Math.round(exercise.xp * difficultyXpFactor(adaptive)),
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
          <span className="font-semibold">+25% synergy buff active.</span>{" "}
          {buffSources.length} consolidated prerequisite
          {buffSources.length === 1 ? "" : "s"} supporting this faculty. This affects XP
          only — it does not touch the competence estimate.
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {node.exercises.map((exercise) => {
          const reset = exerciseResetState(logs, exercise.id, exercise.cadence);
          const done = !reset.available;
          const open = openExerciseFor === exercise.id;
          const typable = isTypableExercise(exercise.label);
          const adaptive = adaptiveStateFor(exercise, logs);
          const saturated = isSaturated(adaptive);
          const awardedXp = Math.round(
            exercise.xp * multiplier * difficultyXpFactor(adaptive),
          );
          const canSubmit = !typable || response.trim().length >= 3;

          return (
            <li
              key={exercise.id}
              className={[
                "rounded-xl border p-3 transition-[border-color,background-color,opacity]",
                done
                  ? "border-white/6 bg-white/[0.015]"
                  : saturated
                    ? "border-white/8 bg-white/[0.015]"
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
                      ? `${adaptive.label}, ${resetLabel(reset.nextResetAt)}`
                      : `Open exercise: ${adaptive.label}`
                  }
                  className={[
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all",
                    done
                      ? "cursor-not-allowed"
                      : "hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
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
                    boxShadow: done ? `0 0 12px oklch(0.72 0.17 ${hue} / 0.32)` : undefined,
                  }}
                >
                  {done ? (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                      <path
                        d="M2.5 6.2 4.8 8.5 9.5 3.8"
                        fill="none"
                        stroke="#ffffff"
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
                      {adaptive.label}
                    </p>
                  </button>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
                    <span>{CADENCE_LABEL[exercise.cadence]}</span>
                    <span aria-hidden="true">·</span>
                    <span title="Your current working difficulty for this task">
                      L{adaptive.level}/5
                      {adaptive.level !== adaptive.anchor && (
                        <span className="ml-0.5 text-neutral-600">
                          ({adaptive.level > adaptive.anchor ? "+" : ""}
                          {adaptive.level - adaptive.anchor})
                        </span>
                      )}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={done ? "text-neutral-600" : ""}
                      style={done ? undefined : { color: `oklch(0.8 0.13 ${hue})` }}
                    >
                      +{awardedXp} XP
                    </span>
                    <span className={done ? "text-neutral-500" : "text-emerald-300/70"}>
                      {done ? resetLabel(reset.nextResetAt) : "ready"}
                    </span>
                    <span className="ml-auto normal-case tracking-normal text-neutral-600">
                      {EVIDENCE_LABEL[exercise.evidence ?? "self-report"]}
                    </span>
                  </div>

                  {saturated && !done && (
                    <p className="mt-1.5 rounded-lg border border-amber-200/15 bg-amber-200/[0.03] px-2 py-1.5 text-[10px] leading-relaxed text-amber-50/70">
                      You pass this every time at the highest framing. Repeating it will add
                      XP and change nothing else — a harder task elsewhere is a better use of
                      the same twenty minutes.
                    </p>
                  )}

                  {!done && (
                    <Why summary="Why this difficulty?">
                      <p>{adaptive.reason}</p>
                      {adaptive.progressionIndex >= 0 && (
                        <p className="mt-1.5 text-neutral-500">
                          The harder framing comes from this exercise&apos;s own progression
                          ladder, not from an arbitrary multiplier.
                        </p>
                      )}
                    </Why>
                  )}

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
                              ? "Work through the exercise here. Anything over 40 characters is filed as produced work, which counts as evidence…"
                              : "What did you actually do? Specifics turn this from a tick into evidence…"
                          }
                          rows={typable ? 5 : 3}
                          className={`${inputClass} resize-y leading-relaxed`}
                        />
                      </label>

                      <div className="flex flex-wrap items-center gap-3">
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
                        <label className="flex min-w-[9rem] flex-1 items-center gap-2 text-[10px] text-neutral-500">
                          <span className="shrink-0">How did it go?</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(quality * 100)}
                            onChange={(event) => setQuality(Number(event.target.value) / 100)}
                            className="min-w-0 flex-1 accent-cyan-300"
                            aria-label="Self-rated completion quality"
                          />
                          <span className="w-8 shrink-0 tabular-nums text-right">
                            {Math.round(quality * 100)}%
                          </span>
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenExerciseFor(null)}
                          className="rounded-md px-2.5 py-2 text-xs text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!canSubmit}
                          onClick={() => commit(exercise.id)}
                          className="ml-auto rounded-md px-3 py-2 text-xs font-semibold text-black transition-[opacity,transform] hover:-translate-y-px hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
                          style={{ background: `oklch(0.8 0.14 ${hue})` }}
                        >
                          Complete · +{awardedXp} XP
                        </button>
                      </div>
                      <p className="text-[9px] leading-relaxed text-neutral-600">
                        Ctrl/Cmd + Enter submits. Your self-rating is recorded as a weak
                        signal and discounted accordingly — it moves difficulty more than it
                        moves competence.
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
