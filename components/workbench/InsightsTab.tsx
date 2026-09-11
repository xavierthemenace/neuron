"use client";

import { useMemo } from "react";
import { nodesById } from "@/lib/curriculum";
import { analyseGraph, readyToBuild, type FindingKind } from "@/lib/graph-intel";
import { practiceWithoutProof } from "@/lib/learner";
import { useProgress } from "../ProgressProvider";
import { Caveat, Chip, EmptyState, Section, Why } from "../ui";

const KIND_LABEL: Record<FindingKind, string> = {
  bottleneck: "Bottleneck",
  "high-leverage": "Leverage",
  "isolated-strength": "Unused strength",
  "weak-bridge": "Weak bridge",
  "prerequisite-gap": "Foundation gap",
  "over-practised": "Unproven",
  "neglected-cluster": "Neglected",
  "narrow-development": "Shape",
  unproven: "Unproven",
};

const KIND_TONE: Record<FindingKind, "neutral" | "active" | "warn"> = {
  bottleneck: "warn",
  "high-leverage": "active",
  "isolated-strength": "active",
  "weak-bridge": "warn",
  "prerequisite-gap": "warn",
  "over-practised": "warn",
  "neglected-cluster": "neutral",
  "narrow-development": "neutral",
  unproven: "warn",
};

/**
 * Graph-level intelligence.
 *
 * The findings here are the thing no per-node view can produce: statements
 * about the shape of the whole capability graph. Each one carries the numbers
 * it was computed from, because an insight the user cannot audit is
 * indistinguishable from flattery.
 */
export function InsightsTab({ onSelectNode }: { onSelectNode: (id: string) => void }) {
  const model = useProgress();
  const goalNodeIds = useMemo(
    () =>
      new Set(
        model.progress.goals
          .filter((goal) => goal.status === "active")
          .flatMap((goal) => goal.nodeIds),
      ),
    [model.progress.goals],
  );

  const findings = useMemo(() => analyseGraph(model, goalNodeIds), [model, goalNodeIds]);
  const ready = useMemo(() => readyToBuild(model).slice(0, 8), [model]);
  const unproven = useMemo(() => practiceWithoutProof(model), [model]);

  if (findings.length === 0 && ready.length === 0) {
    return (
      <EmptyState
        title="Not enough history yet"
        body="Graph-level analysis needs a few weeks of practice across several nodes before it can say anything you could not see by looking. It will stay quiet until then rather than manufacture an observation."
      />
    );
  }

  return (
    <div className="space-y-6">
      {findings.length > 0 && (
        <Section
          title="What the graph knows"
          hint="Derived from prerequisite structure plus your evidence. Ordered by how much it matters now."
        >
          <ul className="space-y-2">
            {findings.map((finding, index) => (
              <li
                key={`${finding.kind}-${index}`}
                className="rounded-xl border border-white/8 bg-white/[0.02] p-3"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={KIND_TONE[finding.kind]}>{KIND_LABEL[finding.kind]}</Chip>
                  <span className="text-xs font-medium text-neutral-100">
                    {finding.headline}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">
                  {finding.detail}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {finding.nodeIds.slice(0, 6).map((id) => (
                    <Chip key={id} onClick={() => onSelectNode(id)}>
                      {nodesById.get(id)?.label ?? id}
                    </Chip>
                  ))}
                </div>
                <Why summary="Show the numbers">
                  <p>{finding.evidence}</p>
                  <p className="mt-1.5 text-neutral-600">
                    Prerequisite structure is a curriculum author&apos;s judgement, recorded
                    with a stated confidence per edge. It is a strong hint about ordering, not
                    an experimental result about you.
                  </p>
                </Why>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {ready.length > 0 && (
        <Section
          title="Foundations already in place"
          hint="Every prerequisite for these is developed. This is usually the cheapest progress available."
        >
          <div className="flex flex-wrap gap-1.5">
            {ready.map((id) => (
              <Chip key={id} tone="active" onClick={() => onSelectNode(id)}>
                {nodesById.get(id)?.label ?? id}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {unproven.length > 0 && (
        <Section
          title="Practice without proof"
          hint="Real reps, no evidence. Not a criticism — a measurement gap."
        >
          <ul className="space-y-1">
            {unproven.map((estimate) => (
              <li key={estimate.nodeId} className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => onSelectNode(estimate.nodeId)}
                  className="min-w-0 flex-1 truncate text-left text-neutral-300 hover:text-white"
                >
                  {nodesById.get(estimate.nodeId)?.label ?? estimate.nodeId}
                </button>
                <span className="shrink-0 tabular-nums text-neutral-500">
                  {Math.round(estimate.practice * 100)}% practice ·{" "}
                  {Math.round(estimate.competence * 100)}% competence
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Caveat>
        These findings describe your recorded data, not you. A capability you have and never
        log looks identical here to one you do not have — which is a limitation of the
        method, not a fact about your abilities.
      </Caveat>
    </div>
  );
}
