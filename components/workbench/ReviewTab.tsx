"use client";

import { useMemo } from "react";
import { buildInbox, summariseInbox, type InboxItem } from "@/lib/inbox";
import { useProgress } from "../ProgressProvider";
import { Caveat, Chip, EmptyState, buttonClass } from "../ui";

const KIND_LABEL: Record<string, string> = {
  retention: "Fading",
  "prediction-due": "Resolve",
  "diagnostic-due": "Measure",
  "mission-open": "Unfinished",
  "capstone-ready": "Ready",
  "goal-stalled": "Stalled",
  "weak-prerequisite": "Foundation",
  "unproven-practice": "Unproven",
  "experiment-open": "Experiment",
};

const KIND_TONE: Record<string, "neutral" | "active" | "warn"> = {
  retention: "warn",
  "prediction-due": "active",
  "capstone-ready": "active",
  "goal-stalled": "warn",
  "weak-prerequisite": "warn",
};

export function ReviewTab({
  onSelectNode,
  onRunProbe,
  onOpenMission,
  onResolvePrediction,
  onOpenGoal,
  onOpenExperiment,
}: {
  onSelectNode: (id: string) => void;
  onRunProbe: (probeId: string) => void;
  onOpenMission: (missionId: string) => void;
  onResolvePrediction: (id: string) => void;
  onOpenGoal: (id: string) => void;
  onOpenExperiment: (id: string) => void;
}) {
  const model = useProgress();
  const { progress, dismissItem } = model;

  const items = useMemo(
    () => buildInbox(model, progress, new Date()),
    [model, progress],
  );
  const summary = summariseInbox(items);

  const act = (item: InboxItem) => {
    if (item.probeId) return onRunProbe(item.probeId);
    if (item.missionId) return onOpenMission(item.missionId);
    if (item.predictionId) return onResolvePrediction(item.predictionId);
    if (item.goalId) return onOpenGoal(item.goalId);
    if (item.experimentId) return onOpenExperiment(item.experimentId);
    if (item.nodeId) return onSelectNode(item.nodeId);
  };

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Nothing needs attention"
          body="No memory is sliding, no prediction is overdue, nothing is half-finished. This is what an empty queue should look like — Neuron does not invent urgency to fill it."
        />
        <Caveat>
          Items appear here when something in your data changes state: a retention curve
          crossing its threshold, a resolution date passing, a mission left open. Dismissing
          an item hides it for two weeks, because the underlying state usually comes back.
        </Caveat>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-neutral-400">{summary.headline}</p>

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className="rounded-xl border border-white/8 bg-white/[0.02] p-3 transition-colors hover:border-white/16"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={KIND_TONE[item.kind] ?? "neutral"}>
                    {KIND_LABEL[item.kind] ?? item.kind}
                  </Chip>
                  <span className="text-xs font-medium text-neutral-200">{item.title}</span>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-500">
                  {item.detail}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button type="button" onClick={() => act(item)} className={buttonClass}>
                  {item.actionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => dismissItem(item.key)}
                  className="rounded-lg px-3 py-1 text-[10px] text-neutral-600 transition-colors hover:text-neutral-300"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Caveat>
        Ordered by how much is lost by ignoring each item, not by how long it has been
        sitting there. Nothing here is a streak and nothing expires in a way that costs you
        progress.
      </Caveat>
    </div>
  );
}
