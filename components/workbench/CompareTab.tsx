"use client";

import { useMemo, useState } from "react";
import { categoriesById, pathsById } from "@/lib/curriculum";
import {
  buildLearnerModel,
  compareModels,
  progressAsOf,
  type NodeComparison,
} from "@/lib/learner";
import { useProgress } from "../ProgressProvider";
import { Caveat, Chip, EmptyState, Meter, Section, Why } from "../ui";

/**
 * Comparison views.
 *
 * The honest way to answer "am I getting better" is to rebuild the entire
 * learner model as it stood at a past date — retention curves, competence
 * estimates and confidence bands all recomputed from the truncated log — and
 * diff it against today. Reading today's numbers with a smaller XP total would
 * be much cheaper and would quietly lie about retention.
 *
 * Practice and competence are reported as separate deltas on purpose. A month
 * of heavy practice that produced no evidence should look like exactly that.
 */

const WINDOWS = [7, 30, 90, 180] as const;
type Window = (typeof WINDOWS)[number];

function DeltaBar({ value, label }: { value: number; label: string }) {
  const magnitude = Math.min(1, Math.abs(value));
  const positive = value >= 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[10px] text-neutral-500">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            width: `${magnitude * 50}%`,
            left: positive ? "50%" : `${50 - magnitude * 50}%`,
            background: positive ? "oklch(0.76 0.15 152)" : "oklch(0.7 0.15 25)",
          }}
        />
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
      </div>
      <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-neutral-400">
        {value >= 0 ? "+" : ""}
        {Math.round(value * 100)}
      </span>
    </div>
  );
}

export function CompareTab({ onSelectNode }: { onSelectNode: (id: string) => void }) {
  const model = useProgress();
  const { progress, nowMs } = model;
  const [window, setWindow] = useState<Window>(30);

  const comparison = useMemo(() => {
    const then = new Date(nowMs - window * 864e5);
    const before = buildLearnerModel(progressAsOf(progress, then), then);
    return compareModels(before, model);
  }, [progress, model, window, nowMs]);

  const improved = useMemo(
    () => [...comparison].sort((a, b) => b.competenceDelta - a.competenceDelta).slice(0, 8),
    [comparison],
  );
  const faded = useMemo(
    () =>
      [...comparison]
        .filter((row) => row.retentionDelta < -0.02)
        .sort((a, b) => a.retentionDelta - b.retentionDelta)
        .slice(0, 6),
    [comparison],
  );
  const unproven = useMemo(
    () =>
      comparison
        .filter((row) => row.practiceDelta > 0.03 && row.evidenceDelta === 0)
        .sort((a, b) => b.practiceDelta - a.practiceDelta)
        .slice(0, 6),
    [comparison],
  );

  const activeGoal = progress.goals.find((goal) => goal.status === "active");
  const goalGap = useMemo(() => {
    if (!activeGoal) return null;
    const ids = activeGoal.nodeIds.length
      ? activeGoal.nodeIds
      : (pathsById.get(activeGoal.pathId ?? "")?.nodeIds ?? []);
    const rows = ids.map((id) => ({
      id,
      label: model.nodes.find((node) => node.id === id)?.label ?? id,
      competence: model.estimates[id]?.competence ?? 0,
    }));
    return { label: activeGoal.label, rows: rows.sort((a, b) => a.competence - b.competence) };
  }, [activeGoal, model]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {WINDOWS.map((value) => (
          <Chip
            key={value}
            tone={window === value ? "active" : "neutral"}
            pressed={window === value}
            onClick={() => setWindow(value)}
          >
            vs {value} days ago
          </Chip>
        ))}
      </div>

      {comparison.length === 0 ? (
        <EmptyState
          title="Nothing has changed in this window"
          body="Either there is no history that far back, or nothing has moved. Both are real answers and neither is a reason to show you a chart."
        />
      ) : (
        <>
          <Section
            title="Where competence moved"
            hint="Rebuilt from your log as it stood then, not inferred from today's totals."
          >
            <ul className="space-y-2">
              {improved.map((row) => (
                <ComparisonRow key={row.nodeId} row={row} onSelect={() => onSelectNode(row.nodeId)} />
              ))}
            </ul>
            <Why summary="Why are practice and competence shown separately?">
              Because they can disagree, and the disagreement is the useful part. A month of
              heavy practice with no scored or judged evidence shows a large practice delta
              and a near-zero competence delta — which is a real finding about how you spent
              the month, not a bug in the estimate.
            </Why>
          </Section>

          {faded.length > 0 && (
            <Section title="Where retention fell" hint="Trained once and not revisited.">
              <ul className="space-y-2">
                {faded.map((row) => (
                  <ComparisonRow
                    key={row.nodeId}
                    row={row}
                    onSelect={() => onSelectNode(row.nodeId)}
                  />
                ))}
              </ul>
            </Section>
          )}

          {unproven.length > 0 && (
            <Section
              title="Practised, still unproven"
              hint="Real reps in this window, no evidence attached to any of them."
            >
              <ul className="space-y-1">
                {unproven.map((row) => (
                  <li key={row.nodeId} className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => onSelectNode(row.nodeId)}
                      className="min-w-0 flex-1 truncate text-left text-neutral-300 hover:text-white"
                    >
                      {row.label}
                    </button>
                    <span className="shrink-0 tabular-nums text-neutral-500">
                      +{Math.round(row.practiceDelta * 100)} practice, +
                      {Math.round(row.competenceDelta * 100)} competence
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      {goalGap && (
        <Section
          title={`Gap to "${goalGap.label}"`}
          hint="Where you are against what the goal needs. Weakest first."
        >
          <ul className="space-y-1.5">
            {goalGap.rows.slice(0, 10).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode(row.id)}
                  className="w-full text-left"
                >
                  <Meter
                    label={row.label}
                    value={row.competence}
                    hue={
                      categoriesById.get(
                        model.nodes.find((node) => node.id === row.id)?.categoryId ?? "",
                      )?.hue ?? 230
                    }
                  />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Caveat>
        A comparison over a window this short is dominated by what you happened to log. It
        describes your record, not your capability — and a capability you have and never log
        looks identical here to one you do not have.
      </Caveat>
    </div>
  );
}

function ComparisonRow({
  row,
  onSelect,
}: {
  row: NodeComparison;
  onSelect: () => void;
}) {
  return (
    <li className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <button
        type="button"
        onClick={onSelect}
        className="mb-2 block text-left text-xs font-medium text-neutral-200 hover:text-white"
      >
        {row.label}
        {row.evidenceDelta > 0 && (
          <span className="ml-2 text-[9px] uppercase tracking-wider text-emerald-300/70">
            +{row.evidenceDelta} evidence
          </span>
        )}
      </button>
      <div className="space-y-1.5">
        <DeltaBar label="Practice" value={row.practiceDelta} />
        <DeltaBar label="Competence" value={row.competenceDelta} />
        <DeltaBar label="Retention" value={row.retentionDelta} />
      </div>
    </li>
  );
}
