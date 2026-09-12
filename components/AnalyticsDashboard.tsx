"use client";

import { useMemo, useRef } from "react";
import { MAX_XP, dayKey, estimateExerciseMinutes } from "@/lib/mastery";
import type { IntelligenceData } from "@/lib/types";
import { useDismissable } from "./useDismissable";
import { useProgress } from "./ProgressProvider";

const RADAR_SIZE = 520;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 176;
/**
 * Axis labels sit 34px outside the outer ring and are anchored end/start, so
 * the longest of them ("Working Memory") reaches roughly 110px beyond the
 * plotted circle. Without this horizontal bleed the viewBox cropped it to
 * "orking Memory".
 */
const RADAR_LABEL_PAD = 112;

function polarPoint(index: number, count: number, radius: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
  return {
    x: RADAR_CENTER + Math.cos(angle) * radius,
    y: RADAR_CENTER + Math.sin(angle) * radius,
  };
}

function polygonPoints(values: number[]): string {
  return values
    .map((value, index) => {
      const point = polarPoint(index, values.length, RADAR_RADIUS * value);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

function shortLabel(label: string): string {
  return label
    .replace("Logical-Mathematical", "Logical")
    .replace("Bodily-Kinesthetic", "Kinesthetic")
    .replace("Relationship Management", "Relationship")
    .replace("Crystallized Knowledge", "Crystallized")
    .replace("Abstract Reasoning", "Reasoning")
    .replace("Processing Speed", "Speed");
}

function heatLevel(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

function heatColor(level: number): string {
  return [
    "#ddd8cf",
    "oklch(0.42 0.08 155)",
    "oklch(0.54 0.12 155)",
    "oklch(0.66 0.16 155)",
    "oklch(0.78 0.18 155)",
  ][level];
}

export function AnalyticsDashboard({
  data,
  open,
  onClose,
}: {
  data: IntelligenceData;
  open: boolean;
  onClose: () => void;
}) {
  const { progress, xpByNodeId } = useProgress();
  const dialogRef = useRef<HTMLElement | null>(null);

  useDismissable({ open, onClose, modal: true, container: dialogRef });

  const categoryStats = useMemo(
    () =>
      data.categories.map((category) => {
        const nodes = data.nodes.filter((node) => node.categoryId === category.id);
        const effective = nodes.reduce(
          (sum, node) => sum + Math.min(MAX_XP, xpByNodeId[node.id] ?? 0),
          0,
        );
        const capacity = Math.max(1, nodes.length * MAX_XP);
        return {
          ...category,
          nodeCount: nodes.length,
          score: effective / capacity,
        };
      }),
    [data.categories, data.nodes, xpByNodeId],
  );

  const activity = useMemo(() => {
    const countByDay = new Map<string, number>();
    for (const log of progress.logs) {
      const key = dayKey(new Date(log.at));
      countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
    }

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const days = Array.from({ length: 365 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (364 - index));
      const key = dayKey(date);
      return { key, count: countByDay.get(key) ?? 0, weekday: date.getDay() };
    });
    const leading = days[0]?.weekday ?? 0;
    const heatDays: Array<(typeof days)[number] | null> = [
      ...Array.from({ length: leading }, () => null),
      ...days,
    ];

    let streak = 0;
    const cursor = new Date(today);
    if ((countByDay.get(dayKey(cursor)) ?? 0) === 0) cursor.setDate(cursor.getDate() - 1);
    while ((countByDay.get(dayKey(cursor)) ?? 0) > 0) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const exerciseById = new Map(
      data.nodes.flatMap((node) =>
        node.exercises.map((exercise) => [exercise.id, exercise] as const),
      ),
    );
    const minutes = progress.logs.reduce((sum, log) => {
      if (log.minutes && log.minutes > 0) return sum + log.minutes;
      const exercise = exerciseById.get(log.exerciseId);
      return sum + (exercise ? estimateExerciseMinutes(exercise) : 0);
    }, 0);

    return {
      heatDays,
      streak,
      minutes,
      activeDays: days.filter((day) => day.count > 0).length,
    };
  }, [data.nodes, progress.logs]);

  if (!open) return null;

  const scores = categoryStats.map((category) => category.score);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-3 backdrop-blur-md md:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cognitive analytics dashboard"
        className="max-h-[94dvh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-white/12 bg-[var(--panel)] shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[var(--panel)] px-5 py-4 backdrop-blur-xl">
          <div>
            <h2 className="text-lg font-semibold text-neutral-50">Cognitive analytics</h2>
            <p className="text-xs text-neutral-500">
              Effective mastery includes memory decay; lifetime XP remains preserved in your history.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            Close
          </button>
        </header>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-2xl border border-white/10 bg-[var(--sunk)] p-3 md:p-5">
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-100">Cognitive radar</h3>
                <p className="text-[11px] text-neutral-500">
                  All {categoryStats.length} live curriculum categories · 100% = average Mastered
                </p>
              </div>
            </div>

            {/* Wider than the plot itself: the viewBox carries horizontal bleed
                for the axis labels, so a narrow box would shrink the chart. */}
            <div className="mx-auto max-w-[720px] overflow-hidden">
              <svg
                viewBox={`${-RADAR_LABEL_PAD} 0 ${RADAR_SIZE + RADAR_LABEL_PAD * 2} ${RADAR_SIZE}`}
                className="h-auto w-full"
                role="img"
                aria-label="Radar chart of category mastery"
              >
                {[0.25, 0.5, 0.75, 1].map((ring) => (
                  <polygon
                    key={ring}
                    points={polygonPoints(categoryStats.map(() => ring))}
                    fill="none"
                    stroke="oklch(1 0 0 / 0.09)"
                    strokeWidth={1}
                  />
                ))}
                {categoryStats.map((category, index) => {
                  const point = polarPoint(index, categoryStats.length, RADAR_RADIUS);
                  const labelPoint = polarPoint(index, categoryStats.length, RADAR_RADIUS + 34);
                  return (
                    <g key={category.id}>
                      <line
                        x1={RADAR_CENTER}
                        y1={RADAR_CENTER}
                        x2={point.x}
                        y2={point.y}
                        stroke={`oklch(0.7 0.08 ${category.hue} / 0.18)`}
                        strokeWidth={1}
                      />
                      <text
                        x={labelPoint.x}
                        y={labelPoint.y}
                        textAnchor={
                          labelPoint.x < RADAR_CENTER - 16
                            ? "end"
                            : labelPoint.x > RADAR_CENTER + 16
                              ? "start"
                              : "middle"
                        }
                        dominantBaseline="middle"
                        fill="oklch(0.74 0.015 265)"
                        fontSize={9.5}
                      >
                        {shortLabel(category.label)}
                      </text>
                    </g>
                  );
                })}
                <polygon
                  points={polygonPoints(scores)}
                  fill="oklch(0.68 0.13 245 / 0.2)"
                  stroke="oklch(0.82 0.14 245 / 0.9)"
                  strokeWidth={2}
                />
                {scores.map((score, index) => {
                  const point = polarPoint(index, scores.length, RADAR_RADIUS * score);
                  const category = categoryStats[index];
                  return (
                    <circle
                      key={category.id}
                      cx={point.x}
                      cy={point.y}
                      r={3.5}
                      fill={`oklch(0.82 0.15 ${category.hue})`}
                    >
                      <title>{`${category.label}: ${Math.round(score * 100)}%`}</title>
                    </circle>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <div className="text-xl font-semibold tabular-nums text-neutral-50">{activity.streak}</div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">day streak</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <div className="text-xl font-semibold tabular-nums text-neutral-50">{activity.activeDays}</div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">active days / 365</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <div className="text-xl font-semibold tabular-nums text-neutral-50">{activity.minutes.toLocaleString()}</div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">practice min</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[var(--sunk)] p-4">
              <h3 className="text-sm font-semibold text-neutral-100">365-day activity</h3>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Every square is a local calendar day; brighter means more completed exercises.
              </p>
              <div className="mt-4 overflow-x-auto pb-1">
                <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
                  {activity.heatDays.map((day, index) =>
                    day ? (
                      <span
                        key={day.key}
                        className="h-[10px] w-[10px] rounded-[2px] border border-white/[0.025]"
                        style={{ background: heatColor(heatLevel(day.count)) }}
                        title={`${day.key}: ${day.count} exercise${day.count === 1 ? "" : "s"}`}
                      />
                    ) : (
                      <span key={`pad-${index}`} className="h-[10px] w-[10px]" aria-hidden="true" />
                    ),
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 text-[9px] text-neutral-600">
                <span>Less</span>
                {[0, 1, 2, 3, 4].map((level) => (
                  <span
                    key={level}
                    className="h-2.5 w-2.5 rounded-[2px]"
                    style={{ background: heatColor(level) }}
                  />
                ))}
                <span>More</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[var(--sunk)] p-4">
              <h3 className="text-sm font-semibold text-neutral-100">Category mastery</h3>
              <div className="mt-3 space-y-2.5">
                {categoryStats
                  .slice()
                  .sort((a, b) => b.score - a.score)
                  .map((category) => (
                    <div
                      key={category.id}
                      className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3"
                    >
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-neutral-300">{category.label}</span>
                          <span className="tabular-nums text-neutral-600">{category.nodeCount} nodes</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/7">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(1, Math.round(category.score * 100))}%`,
                              background: `oklch(0.72 0.15 ${category.hue})`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-right text-xs font-medium tabular-nums text-neutral-300">
                        {Math.round(category.score * 100)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
