"use client";

import { useMemo, useState } from "react";
import { generateDailyWorkout } from "@/lib/workout";
import type { IntelligenceData } from "@/lib/types";
import { useProgress } from "./ProgressProvider";

export function DailyWorkout({
  data,
  onSelectNode,
  panelOpen,
}: {
  data: IntelligenceData;
  onSelectNode: (id: string) => void;
  panelOpen: boolean;
}) {
  const { xpByNodeId, decayByNodeId, logsByNodeId } = useProgress();
  const [open, setOpen] = useState(false);

  const workout = useMemo(
    () => generateDailyWorkout(data, xpByNodeId, decayByNodeId, logsByNodeId),
    [data, decayByNodeId, logsByNodeId, xpByNodeId],
  );

  if (workout.length === 0) return null;

  return (
    <div
      className={[
        "pointer-events-auto absolute bottom-4 left-16 z-30 transition-opacity md:bottom-4",
        panelOpen ? "max-md:pointer-events-none max-md:opacity-0" : "",
      ].join(" ")}
    >
      {open ? (
        <section className="w-[min(28rem,calc(100vw-5rem))] rounded-2xl border border-white/12 bg-[oklch(0.13_0.016_265_/_0.96)] p-3 shadow-2xl backdrop-blur-2xl" aria-label="Daily Neuro Workout">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">Daily Neuro Workout</div>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">Three ready exercises chosen from decay pressure, active synergies, and weaker domains.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-lg text-neutral-500 hover:bg-white/7 hover:text-white" aria-label="Collapse daily workout">×</button>
          </div>

          <div className="mt-3 space-y-1.5">
            {workout.map((item, index) => (
              <button
                key={item.exercise.id}
                type="button"
                onClick={() => {
                  onSelectNode(item.nodeId);
                  setOpen(false);
                }}
                className="group flex w-full items-start gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5 text-left transition-colors hover:border-white/18 hover:bg-white/[0.055]"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-200/12 bg-cyan-200/[0.035] text-[10px] font-semibold text-cyan-100/75">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium leading-snug text-neutral-200 group-hover:text-white">{item.exercise.label}</span>
                  <span className="mt-1 block text-[10px] text-neutral-500">{item.nodeLabel} · {item.categoryLabel}</span>
                  <span className="mt-1 block text-[9px] leading-relaxed text-neutral-600">{item.reason}</span>
                </span>
                <span className="shrink-0 rounded-full border border-white/8 px-2 py-0.5 text-[9px] tabular-nums text-neutral-400">
                  +{Math.round(item.exercise.xp * item.multiplier)} XP
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-cyan-200/15 bg-[oklch(0.13_0.02_245_/_0.92)] px-3 py-2 text-[10px] font-medium text-cyan-50/80 shadow-xl backdrop-blur-xl transition-colors hover:border-cyan-200/30 hover:text-white"
          aria-label="Open Daily Neuro Workout"
        >
          <span className="h-2 w-2 rounded-full bg-cyan-200/80 shadow-[0_0_12px_currentColor]" aria-hidden="true" />
          Daily Workout
          <span className="text-cyan-100/40">3 ready</span>
        </button>
      )}
    </div>
  );
}
