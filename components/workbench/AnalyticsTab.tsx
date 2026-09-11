"use client";

import { useMemo, useState } from "react";
import { categoriesById, curriculum } from "@/lib/curriculum";
import { PROBES, probeHistory } from "@/lib/diagnostics";
import { calibrationSummary } from "@/lib/predictions";
import { dayKey } from "@/lib/mastery";
import { useProgress } from "../ProgressProvider";
import { Caveat, Chip, EmptyState, Meter, Section, Why } from "../ui";

/**
 * Cognitive telemetry.
 *
 * Everything here is a trajectory rather than a total, and every headline is
 * derived from something measurable. There is deliberately no "cognitive score"
 * and no streak: both are vanity metrics that reward opening the app rather
 * than improving at anything.
 */

type Window = 7 | 30 | 90 | 3650;

const WINDOW_LABEL: Record<Window, string> = {
  7: "Week",
  30: "Month",
  90: "Quarter",
  3650: "Lifetime",
};

export function AnalyticsTab({ onSelectNode }: { onSelectNode: (id: string) => void }) {
  const model = useProgress();
  const { progress } = model;
  const [window, setWindow] = useState<Window>(30);

  const cutoff = model.nowMs - window * 864e5;
  const windowLogs = useMemo(
    () => progress.logs.filter((log) => new Date(log.at).getTime() >= cutoff),
    [progress.logs, cutoff],
  );

  const minutes = windowLogs.reduce((sum, log) => sum + (log.minutes ?? 0), 0);
  const evidenceReps = windowLogs.filter(
    (log) => log.evidence && log.evidence !== "self-report",
  ).length;
  const activeDays = new Set(windowLogs.map((log) => dayKey(new Date(log.at)))).size;

  const coverage = useMemo(() => {
    const touched = model.nodes.filter(
      (node) => (model.estimates[node.id]?.practice ?? 0) > 0.02,
    ).length;
    return touched / Math.max(1, model.nodes.length);
  }, [model]);

  const meanCompetence = useMemo(() => {
    const values = model.nodes.map((node) => model.estimates[node.id]?.competence ?? 0);
    return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  }, [model]);

  const byCategory = useMemo(() => {
    const totals = new Map<string, { sum: number; count: number }>();
    for (const node of curriculum.nodes) {
      const entry = totals.get(node.categoryId) ?? { sum: 0, count: 0 };
      entry.sum += model.estimates[node.id]?.competence ?? 0;
      entry.count += 1;
      totals.set(node.categoryId, entry);
    }
    return [...totals.entries()]
      .map(([id, entry]) => ({
        id,
        label: categoriesById.get(id)?.label ?? id,
        hue: categoriesById.get(id)?.hue ?? 260,
        mean: entry.sum / Math.max(1, entry.count),
      }))
      .sort((a, b) => b.mean - a.mean);
  }, [model]);

  const calibration = useMemo(
    () => calibrationSummary(progress.predictions),
    [progress.predictions],
  );

  /**
   * The monthly headline.
   *
   * Built only from diagnostics with a statistically meaningful change, so it
   * cannot congratulate the user on noise. When there is nothing real to
   * report, it says that instead of finding something.
   */
  const headline = useMemo(() => {
    const moves = PROBES.map((probe) => probeHistory(probe.id, progress.diagnostics))
      .filter((history) => history.meaningful && history.delta !== null)
      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));

    if (moves.length > 0 && (moves[0].delta ?? 0) > 0) {
      const best = moves[0];
      return `Your clearest measured improvement is ${
        PROBES.find((probe) => probe.id === best.probeId)?.label.toLowerCase()
      }: ${Math.round((best.delta ?? 0) * 100)} points above your previous run at the same difficulty.`;
    }
    const declines = moves.filter((history) => (history.delta ?? 0) < 0);
    if (declines.length > 0) {
      return `No measured improvement this period. ${
        PROBES.find((probe) => probe.id === declines[0].probeId)?.label
      } went down by ${Math.abs(Math.round((declines[0].delta ?? 0) * 100))} points, which is worth knowing.`;
    }
    if (progress.diagnostics.length < 2) {
      return "Nothing has been measured twice yet, so there is no trajectory to report. Two runs of the same probe is the minimum.";
    }
    return "No diagnostic has moved further than its own noise floor this period. That is a real result, not a missing one.";
  }, [progress.diagnostics]);

  if (progress.logs.length === 0) {
    return (
      <EmptyState
        title="Nothing to analyse"
        body="Telemetry needs history. Log some practice and run a diagnostic, and this view will start showing trajectories rather than totals."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(WINDOW_LABEL) as unknown as string[]).map((key) => {
          const value = Number(key) as Window;
          return (
            <Chip
              key={key}
              tone={window === value ? "active" : "neutral"}
              pressed={window === value}
              onClick={() => setWindow(value)}
            >
              {WINDOW_LABEL[value]}
            </Chip>
          );
        })}
      </div>

      <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-[12px] leading-relaxed text-neutral-200">
        {headline}
      </p>

      <Section title="This period">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              [String(windowLogs.length), "reps logged"],
              [`${Math.round(minutes / 60)}h`, "practice time"],
              [String(evidenceReps), "produced evidence"],
              [String(activeDays), "active days"],
            ] as const
          ).map(([value, label]) => (
            <div
              key={label}
              className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5"
            >
              <div className="text-lg font-semibold tabular-nums text-neutral-100">{value}</div>
              <div className="text-[9px] uppercase tracking-wider text-neutral-600">{label}</div>
            </div>
          ))}
        </div>
        <Why summary="Why no streak?">
          Streaks measure app-opening, not improvement, and they create a cost to missing a
          day that has nothing to do with learning. Active days is shown because it is a fact;
          nothing is lost by it reaching zero.
        </Why>
      </Section>

      <Section title="Overall shape">
        <div className="space-y-2.5">
          <Meter
            label="Graph coverage"
            value={coverage}
            caption={`${Math.round(coverage * 100)}% of ${model.nodes.length} capabilities have any practice at all.`}
          />
          <Meter
            label="Mean competence across the graph"
            value={meanCompetence}
            caption="Averaged over every node including untouched ones, so this number stays low by construction. Its trend matters, its value does not."
          />
        </div>
      </Section>

      <Section title="Competence by cluster" hint="Strongest first. Untouched clusters sit at the bottom.">
        <ul className="space-y-1.5">
          {byCategory.slice(0, 10).map((entry) => (
            <li key={entry.id}>
              <Meter label={entry.label} value={entry.mean} hue={entry.hue} />
            </li>
          ))}
        </ul>
        {byCategory.length > 10 && (
          <p className="mt-2 text-[10px] text-neutral-600">
            Weakest: {byCategory.slice(-3).map((entry) => entry.label).join(", ")}.
          </p>
        )}
      </Section>

      <Section title="Measured performance" hint="Diagnostics compared against your own history.">
        <ul className="space-y-1">
          {PROBES.map((probe) => {
            const history = probeHistory(probe.id, progress.diagnostics);
            if (!history.latest) return null;
            return (
              <li
                key={probe.id}
                className="flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-[11px] hover:bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => onSelectNode(probe.nodeIds[0])}
                  className="min-w-0 flex-1 truncate text-left text-neutral-300 hover:text-white"
                >
                  {probe.label}
                </button>
                <span className="shrink-0 tabular-nums text-neutral-200">
                  {Math.round(history.latest.score * 100)}%
                </span>
                {history.delta !== null && (
                  <span
                    className={`w-16 shrink-0 text-right text-[10px] tabular-nums ${
                      history.meaningful
                        ? history.delta > 0
                          ? "text-emerald-300/80"
                          : "text-rose-300/80"
                        : "text-neutral-600"
                    }`}
                  >
                    {history.delta >= 0 ? "+" : ""}
                    {Math.round(history.delta * 100)}
                    {!history.meaningful && " (noise)"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {progress.diagnostics.length === 0 && (
          <p className="text-[11px] text-neutral-600">
            No diagnostics run yet. Without them, nothing in this app is objectively measured.
          </p>
        )}
      </Section>

      <Section title="Calibration">
        <p className="text-[11px] text-neutral-300">{calibration.headline}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">{calibration.caveat}</p>
      </Section>

      <Caveat>
        None of these numbers is a measure of intelligence, and none of them supports a claim
        that training here has improved your general cognitive ability. They describe your
        practice and your performance on specific probes, which is a smaller and more
        defensible claim.
      </Caveat>
    </div>
  );
}
