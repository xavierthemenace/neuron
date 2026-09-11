import type { Prediction } from "./types.ts";

/**
 * Predictions and calibration.
 *
 * This is the one part of Neuron that produces a genuinely objective score.
 * Everything else is an estimate built on evidence of varying quality; a Brier
 * score over resolved predictions is a measurement, and it is the reason
 * calibration is treated as the anchor of the whole decision cluster.
 */

/** Nodes whose competence estimate a resolved prediction is evidence for. */
export const CALIBRATION_NODE_IDS = [
  "dec-calibration",
  "log-probability",
  "eqa-bias-awareness",
  "epi-bayesian",
];

export interface ResolvedPrediction extends Prediction {
  outcome: "yes" | "no";
  resolvedAt: string;
}

export function resolvedPredictions(predictions: Prediction[]): ResolvedPrediction[] {
  return predictions.filter(
    (prediction): prediction is ResolvedPrediction =>
      (prediction.outcome === "yes" || prediction.outcome === "no") &&
      typeof prediction.resolvedAt === "string",
  );
}

/** Brier score: mean squared error of the probability. Lower is better. */
export function brierScore(predictions: ResolvedPrediction[]): number | null {
  if (predictions.length === 0) return null;
  const total = predictions.reduce((sum, prediction) => {
    const actual = prediction.outcome === "yes" ? 1 : 0;
    return sum + Math.pow(prediction.probability - actual, 2);
  }, 0);
  return total / predictions.length;
}

export interface CalibrationBin {
  /** Lower edge of the bin, 0-1. */
  from: number;
  to: number;
  count: number;
  /** Mean stated probability inside the bin. */
  stated: number;
  /** Share that actually happened. */
  actual: number;
}

const BIN_EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0001];

export function calibrationCurve(predictions: ResolvedPrediction[]): CalibrationBin[] {
  const bins: CalibrationBin[] = [];
  for (let index = 0; index < BIN_EDGES.length - 1; index += 1) {
    const from = BIN_EDGES[index];
    const to = BIN_EDGES[index + 1];
    const inside = predictions.filter(
      (prediction) => prediction.probability >= from && prediction.probability < to,
    );
    if (inside.length === 0) continue;
    bins.push({
      from,
      to: Math.min(1, to),
      count: inside.length,
      stated:
        inside.reduce((sum, prediction) => sum + prediction.probability, 0) / inside.length,
      actual: inside.filter((prediction) => prediction.outcome === "yes").length / inside.length,
    });
  }
  return bins;
}

/**
 * Murphy's decomposition of the Brier score.
 *
 * Reporting a bare Brier score rewards hedging: predicting the base rate for
 * everything scores well while saying nothing. Splitting it shows whether you
 * are actually discriminating (resolution) or merely well-behaved
 * (calibration), which is the difference that matters.
 */
export interface BrierDecomposition {
  brier: number;
  /** Squared gap between stated confidence and reality. Lower is better. */
  calibration: number;
  /** How far your forecasts move from the base rate. Higher is better. */
  resolution: number;
  /** Irreducible variance of the outcomes themselves. */
  uncertainty: number;
  baseRate: number;
  count: number;
}

export function decomposeBrier(
  predictions: ResolvedPrediction[],
): BrierDecomposition | null {
  const brier = brierScore(predictions);
  if (brier === null) return null;

  const count = predictions.length;
  const baseRate =
    predictions.filter((prediction) => prediction.outcome === "yes").length / count;
  const bins = calibrationCurve(predictions);

  let calibration = 0;
  let resolution = 0;
  for (const bin of bins) {
    const share = bin.count / count;
    calibration += share * Math.pow(bin.stated - bin.actual, 2);
    resolution += share * Math.pow(bin.actual - baseRate, 2);
  }

  return {
    brier,
    calibration,
    resolution,
    uncertainty: baseRate * (1 - baseRate),
    count,
    baseRate,
  };
}

export interface CalibrationSummary {
  count: number;
  pending: number;
  overdue: number;
  brier: number | null;
  decomposition: BrierDecomposition | null;
  /** Positive means overconfident: you say 80% and are right 60% of the time. */
  overconfidence: number | null;
  headline: string;
  caveat: string;
}

/** Below this many resolutions, a Brier score is not worth interpreting. */
export const MIN_RESOLUTIONS_FOR_SIGNAL = 20;

export function calibrationSummary(
  predictions: Prediction[],
  now = new Date(),
): CalibrationSummary {
  const resolved = resolvedPredictions(predictions);
  const open = predictions.filter((prediction) => !prediction.outcome);
  const overdue = open.filter(
    (prediction) => new Date(prediction.resolveBy).getTime() <= now.getTime(),
  ).length;

  const decomposition = decomposeBrier(resolved);
  const brier = decomposition?.brier ?? null;

  let overconfidence: number | null = null;
  if (resolved.length > 0) {
    const stated =
      resolved.reduce((sum, prediction) => sum + prediction.probability, 0) / resolved.length;
    const actual =
      resolved.filter((prediction) => prediction.outcome === "yes").length / resolved.length;
    // Only meaningful for predictions stated above 50%; below that, a low hit
    // rate is the correct outcome rather than overconfidence.
    const confident = resolved.filter((prediction) => prediction.probability >= 0.5);
    if (confident.length >= 5) {
      const confidentStated =
        confident.reduce((sum, prediction) => sum + prediction.probability, 0) /
        confident.length;
      const confidentActual =
        confident.filter((prediction) => prediction.outcome === "yes").length /
        confident.length;
      overconfidence = confidentStated - confidentActual;
    } else {
      overconfidence = stated - actual;
    }
  }

  let headline: string;
  if (resolved.length === 0) {
    headline =
      open.length > 0
        ? `${open.length} prediction${open.length === 1 ? "" : "s"} open, none resolved yet.`
        : "No predictions yet. This is the only objectively scored thing in Neuron.";
  } else if (brier !== null) {
    headline = `Brier ${brier.toFixed(3)} over ${resolved.length} resolved prediction${resolved.length === 1 ? "" : "s"}.`;
    if (overconfidence !== null && Math.abs(overconfidence) > 0.05) {
      headline += ` You are ${overconfidence > 0 ? "overconfident" : "underconfident"} by about ${Math.abs(Math.round(overconfidence * 100))} points.`;
    }
  } else {
    headline = "No resolved predictions.";
  }

  const caveat =
    resolved.length === 0
      ? "A Brier score needs resolved predictions. Twenty is the point at which it starts to mean something."
      : resolved.length < MIN_RESOLUTIONS_FOR_SIGNAL
        ? `${resolved.length} resolutions is below the ${MIN_RESOLUTIONS_FOR_SIGNAL} where this number becomes stable. Treat it as a direction, not a measurement.`
        : decomposition && decomposition.resolution < 0.02
          ? "Your calibration is fine but your resolution is near zero — you are forecasting close to the base rate on everything, which scores well without telling anyone anything."
          : "Calibration is domain-specific: a good score on work predictions says little about your judgement elsewhere.";

  return {
    count: resolved.length,
    pending: open.length,
    overdue,
    brier,
    decomposition,
    overconfidence,
    headline,
    caveat,
  };
}

/**
 * Calibration as a 0-1 competence signal, for the estimate model.
 *
 * A Brier score of 0.25 is what you get by saying 50% to everything, so that is
 * the zero point; 0.10 is a genuinely good forecaster and anchors the top.
 */
export function calibrationCompetence(summary: CalibrationSummary): number | null {
  if (summary.brier === null || summary.count < 10) return null;
  return Math.max(0, Math.min(1, (0.25 - summary.brier) / 0.15));
}
