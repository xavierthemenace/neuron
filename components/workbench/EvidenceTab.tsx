"use client";

import { useMemo } from "react";
import { capstonesById, missionsById, nodesById } from "@/lib/curriculum";
import { PROBES_BY_ID } from "@/lib/diagnostics";
import { bestEvidenced } from "@/lib/learner";
import { resolvedPredictions } from "@/lib/predictions";
import { useProgress } from "../ProgressProvider";
import { Caveat, Chip, EmptyState, EstimateChip, Section } from "../ui";

/**
 * The evidence portfolio.
 *
 * Everything that would still be true if the app's scoring model were thrown
 * away: work produced, probes taken, missions finished, predictions resolved.
 * If a user ever wants to check whether Neuron's numbers mean anything, this is
 * the screen that answers it.
 */
export function EvidenceTab({ onSelectNode }: { onSelectNode: (id: string) => void }) {
  const model = useProgress();
  const { progress } = model;

  const artifacts = useMemo(
    () =>
      progress.logs
        .filter((log) => log.note && log.note.trim().length >= 40)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 40),
    [progress.logs],
  );

  const strongest = useMemo(() => bestEvidenced(model, 8), [model]);
  const resolved = useMemo(() => resolvedPredictions(progress.predictions), [progress.predictions]);
  const completedMissions = progress.missions.filter((record) => record.completedAt);

  const empty =
    artifacts.length === 0 &&
    strongest.length === 0 &&
    progress.diagnostics.length === 0 &&
    completedMissions.length === 0 &&
    progress.capstones.length === 0;

  if (empty) {
    return (
      <EmptyState
        title="No evidence yet"
        body="This view collects the things that would still be true if Neuron's scoring model were deleted: work you produced, probes you took, missions you finished, predictions you resolved. Right now there are none."
      />
    );
  }

  return (
    <div className="space-y-6">
      {strongest.length > 0 && (
        <Section
          title="Best-evidenced capabilities"
          hint="Ranked by how much observation stands behind the estimate, not by the estimate itself."
        >
          <ul className="space-y-1">
            {strongest.map((estimate) => (
              <li
                key={estimate.nodeId}
                className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => onSelectNode(estimate.nodeId)}
                  className="min-w-0 flex-1 truncate text-left text-[11px] text-neutral-200 hover:text-white"
                >
                  {nodesById.get(estimate.nodeId)?.label ?? estimate.nodeId}
                </button>
                <span className="shrink-0 tabular-nums text-[11px] text-neutral-400">
                  {Math.round(estimate.competence * 100)}%
                </span>
                <EstimateChip
                  level={estimate.confidence}
                  observations={estimate.strongObservations}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {progress.capstones.length > 0 && (
        <Section title="Capstones">
          <ul className="space-y-1.5">
            {progress.capstones.map((record) => {
              const capstone = capstonesById.get(record.capstoneId);
              return (
                <li
                  key={record.id}
                  className="rounded-xl border border-amber-200/15 bg-amber-200/[0.03] p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-amber-50/90">
                      {capstone?.label ?? record.capstoneId}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-amber-100/50">
                      {record.rubricScore !== undefined
                        ? `${Math.round(record.rubricScore * 100)}%`
                        : ""}{" "}
                      {new Date(record.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                    {record.summary}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {record.nodeIds.map((id) => (
                      <Chip key={id} onClick={() => onSelectNode(id)}>
                        {nodesById.get(id)?.label ?? id}
                      </Chip>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {completedMissions.length > 0 && (
        <Section title="Completed missions">
          <ul className="space-y-1.5">
            {completedMissions.map((record) => {
              const mission = missionsById.get(record.missionId);
              return (
                <li
                  key={record.id}
                  className="rounded-xl border border-white/8 bg-white/[0.02] p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-neutral-200">
                      {mission?.label ?? record.missionId}
                    </span>
                    <span className="shrink-0 text-[10px] text-neutral-600">
                      {record.completedAt &&
                        new Date(record.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {record.reflection && (
                    <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                      {record.reflection}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {progress.diagnostics.length > 0 && (
        <Section title="Diagnostic results">
          <ul className="space-y-1">
            {[...progress.diagnostics]
              .sort((a, b) => b.at.localeCompare(a.at))
              .slice(0, 25)
              .map((result) => (
                <li
                  key={result.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] hover:bg-white/[0.03]"
                >
                  <span className="w-10 shrink-0 tabular-nums text-neutral-300">
                    {Math.round(result.score * 100)}%
                  </span>
                  <span className="min-w-0 flex-1 truncate text-neutral-400">
                    {PROBES_BY_ID.get(result.probeId)?.label ?? result.probeId}
                  </span>
                  <span className="shrink-0 text-[10px] text-neutral-600">
                    L{result.difficulty} · {result.items} items ·{" "}
                    {new Date(result.at).toLocaleDateString()}
                  </span>
                </li>
              ))}
          </ul>
        </Section>
      )}

      {resolved.length > 0 && (
        <Section title="Resolved predictions" hint={`${resolved.length} scored outcomes.`}>
          <ul className="space-y-1">
            {resolved.slice(-12).reverse().map((prediction) => (
              <li key={prediction.id} className="flex items-center gap-2 text-[11px]">
                <span className="w-9 shrink-0 tabular-nums text-neutral-500">
                  {Math.round(prediction.probability * 100)}%
                </span>
                <span className="w-8 shrink-0 text-[10px] text-neutral-500">
                  {prediction.outcome}
                </span>
                <span className="min-w-0 flex-1 truncate text-neutral-400">
                  {prediction.claim}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {artifacts.length > 0 && (
        <Section
          title="Produced work"
          hint="Completions with substantial written work attached. These are re-readable, which is what makes them evidence."
        >
          <ul className="space-y-1.5">
            {artifacts.map((log) => (
              <li key={log.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectNode(log.nodeId)}
                    className="truncate text-[11px] font-medium text-neutral-200 hover:text-white"
                  >
                    {nodesById.get(log.nodeId)?.label ?? log.nodeId}
                  </button>
                  <span className="shrink-0 text-[10px] text-neutral-600">
                    {new Date(log.at).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-400">
                  {log.note}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Caveat>
        Everything above is your own record. Neuron does not verify that a capstone happened
        or that a written artifact is any good — a portfolio is evidence for you and for
        anyone you choose to show it to, not a credential.
      </Caveat>
    </div>
  );
}
