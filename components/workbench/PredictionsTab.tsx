"use client";

import { useMemo, useState } from "react";
import {
  CALIBRATION_NODE_IDS,
  calibrationCurve,
  calibrationSummary,
  resolvedPredictions,
} from "@/lib/predictions";
import { useProgress } from "../ProgressProvider";
import {
  Caveat,
  Chip,
  EmptyState,
  Field,
  Section,
  Why,
  buttonClass,
  inputClass,
  primaryButtonClass,
} from "../ui";

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}

/**
 * Predictions and calibration.
 *
 * The only objectively scored thing in the app. Everything else is an estimate
 * built from evidence of varying quality; a Brier score over resolved
 * predictions is a measurement, and this screen is deliberately built around
 * that distinction.
 */
export function PredictionsTab({ focusId }: { focusId?: string | null }) {
  const { progress, addPrediction, resolvePrediction, deletePrediction } = useProgress();
  const [claim, setClaim] = useState("");
  const [probability, setProbability] = useState(70);
  const [resolveBy, setResolveBy] = useState(isoDaysFromNow(30));

  const { nowMs } = useProgress();
  const summary = useMemo(() => calibrationSummary(progress.predictions), [progress.predictions]);
  const resolved = useMemo(
    () => resolvedPredictions(progress.predictions),
    [progress.predictions],
  );
  const curve = useMemo(() => calibrationCurve(resolved), [resolved]);

  const open = progress.predictions
    .filter((prediction) => !prediction.outcome)
    .sort((a, b) => a.resolveBy.localeCompare(b.resolveBy));
  const closed = progress.predictions
    .filter((prediction) => prediction.outcome)
    .sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""));

  const submit = () => {
    if (claim.trim().length < 5) return;
    addPrediction({
      claim: claim.trim(),
      probability: probability / 100,
      resolveBy: new Date(`${resolveBy}T12:00:00`).toISOString(),
      nodeIds: CALIBRATION_NODE_IDS,
    });
    setClaim("");
    setProbability(70);
  };

  return (
    <div className="space-y-6">
      <Section title="Your calibration">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-neutral-200">{summary.headline}</p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-500">{summary.caveat}</p>

          {curve.length > 0 && (
            <div className="mt-4">
              <CalibrationChart curve={curve} />
              <Why summary="How to read this">
                <p>
                  The diagonal is perfect calibration: of the things you called 70% likely,
                  70% should have happened. Bars below the line mean overconfidence, above
                  means under. Bar width is how many predictions landed in that band — a
                  single prediction in a band tells you nothing.
                </p>
                {summary.decomposition && (
                  <p className="mt-1.5 text-neutral-500">
                    Brier {summary.decomposition.brier.toFixed(3)} = calibration{" "}
                    {summary.decomposition.calibration.toFixed(3)} − resolution{" "}
                    {summary.decomposition.resolution.toFixed(3)} + uncertainty{" "}
                    {summary.decomposition.uncertainty.toFixed(3)}. Resolution is the part
                    that measures whether you are actually discriminating rather than
                    forecasting the base rate on everything.
                  </p>
                )}
              </Why>
            </div>
          )}
        </div>
      </Section>

      <Section
        title="New prediction"
        hint="Specific enough that you could not argue your way out of it later."
      >
        <div className="space-y-3">
          <textarea
            value={claim}
            onChange={(event) => setClaim(event.target.value)}
            rows={2}
            placeholder="e.g. The migration will be merged before 30 June without a rollback"
            className={`${inputClass} resize-y`}
            aria-label="Prediction claim"
          />
          <div className="flex flex-wrap items-end gap-3">
            <Field label={`Probability: ${probability}%`}>
              <input
                type="range"
                min={1}
                max={99}
                value={probability}
                onChange={(event) => setProbability(Number(event.target.value))}
                className="w-48 accent-cyan-300"
                aria-label="Probability"
              />
            </Field>
            <Field label="Resolve by">
              <input
                type="date"
                value={resolveBy}
                onChange={(event) => setResolveBy(event.target.value)}
                className={`${inputClass} w-40`}
              />
            </Field>
            <button
              type="button"
              onClick={submit}
              disabled={claim.trim().length < 5}
              className={primaryButtonClass}
            >
              Record
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[7, 30, 90, 180].map((days) => (
              <Chip key={days} onClick={() => setResolveBy(isoDaysFromNow(days))}>
                {days}d
              </Chip>
            ))}
          </div>
        </div>
      </Section>

      <Section title={`Open (${open.length})`}>
        {open.length === 0 ? (
          <EmptyState
            title="Nothing open"
            body="Twenty resolved predictions is where a Brier score starts to mean something. Below that it shows you a direction, not a number."
          />
        ) : (
          <ul className="space-y-1.5">
            {open.map((prediction) => {
              const overdue = new Date(prediction.resolveBy).getTime() <= nowMs;
              return (
                <li
                  key={prediction.id}
                  className={[
                    "rounded-xl border p-3",
                    overdue
                      ? "border-amber-300/25 bg-amber-300/[0.04]"
                      : "border-white/8 bg-white/[0.02]",
                    prediction.id === focusId ? "ring-1 ring-cyan-300/40" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[11px] tabular-nums text-neutral-300">
                      {Math.round(prediction.probability * 100)}%
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] leading-relaxed text-neutral-200">
                        {prediction.claim}
                      </p>
                      <p className="mt-1 text-[10px] text-neutral-500">
                        {overdue ? "Due " : "Resolves "}
                        {new Date(prediction.resolveBy).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => resolvePrediction(prediction.id, "yes")}
                      className={buttonClass}
                    >
                      Happened
                    </button>
                    <button
                      type="button"
                      onClick={() => resolvePrediction(prediction.id, "no")}
                      className={buttonClass}
                    >
                      Did not
                    </button>
                    <button
                      type="button"
                      onClick={() => resolvePrediction(prediction.id, "ambiguous")}
                      className={buttonClass}
                      title="Excluded from the Brier score. Frequent use means your predictions are not specific enough."
                    >
                      Ambiguous
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePrediction(prediction.id)}
                      className="ml-auto rounded-lg px-2 py-2 text-[10px] text-neutral-600 hover:text-rose-300"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {closed.length > 0 && (
        <Section title={`Resolved (${closed.length})`}>
          <ul className="space-y-1">
            {closed.slice(0, 25).map((prediction) => {
              const hit =
                (prediction.outcome === "yes" && prediction.probability >= 0.5) ||
                (prediction.outcome === "no" && prediction.probability < 0.5);
              return (
                <li
                  key={prediction.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] hover:bg-white/[0.03]"
                >
                  <span className="w-9 shrink-0 tabular-nums text-neutral-500">
                    {Math.round(prediction.probability * 100)}%
                  </span>
                  <span
                    className={`w-14 shrink-0 text-[10px] ${
                      prediction.outcome === "ambiguous"
                        ? "text-neutral-600"
                        : hit
                          ? "text-emerald-300/70"
                          : "text-rose-300/70"
                    }`}
                  >
                    {prediction.outcome}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-neutral-400">
                    {prediction.claim}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Caveat>
        Resolving honestly is the whole method. Marking a near-miss as ambiguous, or quietly
        deleting the ones you got wrong, produces a better-looking score and destroys the
        only real measurement in this app.
      </Caveat>
    </div>
  );
}

function CalibrationChart({
  curve,
}: {
  curve: { from: number; to: number; count: number; stated: number; actual: number }[];
}) {
  const size = 220;
  const pad = 26;
  const scale = (value: number) => pad + value * (size - pad * 2);
  const maxCount = Math.max(...curve.map((bin) => bin.count));

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-56 w-full max-w-[16rem]"
      role="img"
      aria-label="Calibration curve: stated probability against observed frequency"
    >
      <rect
        x={pad}
        y={pad}
        width={size - pad * 2}
        height={size - pad * 2}
        fill="oklch(0.16 0.02 265 / 0.5)"
        stroke="oklch(1 0 0 / 0.1)"
      />
      <line
        x1={scale(0)}
        y1={size - scale(0)}
        x2={scale(1)}
        y2={size - scale(1)}
        stroke="oklch(0.6 0.02 265)"
        strokeDasharray="3 3"
      />
      {curve.map((bin) => {
        const cx = scale(bin.stated);
        const cy = size - scale(bin.actual);
        const radius = 3 + (bin.count / Math.max(1, maxCount)) * 6;
        return (
          <g key={bin.from}>
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="oklch(0.78 0.16 200 / 0.85)"
              stroke="oklch(0.2 0.02 265)"
            />
            <title>
              {`${Math.round(bin.stated * 100)}% stated · ${Math.round(bin.actual * 100)}% happened · ${bin.count} prediction${bin.count === 1 ? "" : "s"}`}
            </title>
          </g>
        );
      })}
      <text x={pad} y={size - 8} fill="oklch(0.62 0.01 265)" fontSize="8">
        stated →
      </text>
      <text x={4} y={pad + 4} fill="oklch(0.62 0.01 265)" fontSize="8">
        actual ↑
      </text>
    </svg>
  );
}
