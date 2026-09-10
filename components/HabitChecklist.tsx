"use client";

import { useState } from "react";
import { isSatisfied } from "@/lib/mastery";
import { useProgress } from "./ProgressProvider";
import type { ConceptNode } from "@/lib/types";

const CADENCE_LABEL = {
  daily: "daily",
  weekly: "weekly",
  session: "per session",
} as const;

export function HabitChecklist({
  node,
  hue,
}: {
  node: ConceptNode;
  hue: number;
}) {
  const { logExercise, logsByNodeId } = useProgress();
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const logs = logsByNodeId[node.id] ?? [];

  function commit(exerciseId: string) {
    const exercise = node.exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;
    logExercise(node.id, exercise, note);
    setNote("");
    setOpenNoteFor(null);
  }

  return (
    <ul className="flex flex-col gap-2">
      {node.exercises.map((exercise) => {
        const done = isSatisfied(logs, exercise.id, exercise.cadence);
        const noteOpen = openNoteFor === exercise.id;

        return (
          <li
            key={exercise.id}
            className="rounded-lg border border-white/8 bg-white/[0.02] p-3 transition-colors hover:border-white/15"
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => commit(exercise.id)}
                aria-label={`Log: ${exercise.label}`}
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all hover:scale-110"
                style={{
                  borderColor: done
                    ? `oklch(0.75 0.16 ${hue})`
                    : "oklch(0.5 0.02 265)",
                  background: done ? `oklch(0.72 0.17 ${hue})` : "transparent",
                  boxShadow: done ? `0 0 12px oklch(0.72 0.17 ${hue} / 0.6)` : undefined,
                }}
              >
                {done && (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                    <path
                      d="M2.5 6.2 4.8 8.5 9.5 3.8"
                      fill="none"
                      stroke="oklch(0.16 0.02 265)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-neutral-200">
                  {exercise.label}
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
                  <span>{CADENCE_LABEL[exercise.cadence]}</span>
                  <span aria-hidden="true">·</span>
                  <span style={{ color: `oklch(0.75 0.14 ${hue})` }}>
                    +{exercise.xp} XP
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenNoteFor(noteOpen ? null : exercise.id)
                    }
                    className="ml-auto rounded px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-300"
                  >
                    {noteOpen ? "cancel" : "+ note"}
                  </button>
                </div>

                {noteOpen && (
                  <div className="mt-2 flex gap-2">
                    <input
                      autoFocus
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commit(exercise.id);
                        if (e.key === "Escape") setOpenNoteFor(null);
                      }}
                      placeholder="What did you actually do?"
                      className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-white/25"
                    />
                    <button
                      type="button"
                      onClick={() => commit(exercise.id)}
                      className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-black transition-opacity hover:opacity-85"
                      style={{ background: `oklch(0.75 0.15 ${hue})` }}
                    >
                      Log
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
