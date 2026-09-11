"use client";

import { useState } from "react";
import { Sheet } from "./ui";
import { AnalyticsTab } from "./workbench/AnalyticsTab";
import { BrowseTab } from "./workbench/BrowseTab";
import { EvidenceTab } from "./workbench/EvidenceTab";
import { ExperimentsTab } from "./workbench/ExperimentsTab";
import { GoalsTab } from "./workbench/GoalsTab";
import { InsightsTab } from "./workbench/InsightsTab";
import { PersonalTab } from "./workbench/PersonalTab";
import { PredictionsTab } from "./workbench/PredictionsTab";
import { ReviewTab } from "./workbench/ReviewTab";

/**
 * The workbench.
 *
 * Everything that is not the map lives here behind one keystroke. The
 * alternative — a separate floating panel per feature — was already crowding
 * the canvas at four features and does not survive twelve.
 */

export type WorkbenchTab =
  | "review"
  | "goals"
  | "insights"
  | "predictions"
  | "experiments"
  | "evidence"
  | "analytics"
  | "personal"
  | "browse";

const TABS: { id: WorkbenchTab; label: string; subtitle: string }[] = [
  { id: "review", label: "Review", subtitle: "What deserves attention today, ranked by what is lost by ignoring it." },
  { id: "goals", label: "Goals", subtitle: "Turn a sentence into a subset of the graph and a multi-week order." },
  { id: "insights", label: "Insights", subtitle: "What the shape of your capability graph implies." },
  { id: "predictions", label: "Predictions", subtitle: "The only objectively scored thing in Neuron." },
  { id: "experiments", label: "Experiments", subtitle: "n-of-1 tests on your own practice. Cautiously reported." },
  { id: "evidence", label: "Evidence", subtitle: "What you can actually show for it." },
  { id: "analytics", label: "Analytics", subtitle: "Trajectories, not totals." },
  { id: "personal", label: "Personal", subtitle: "Capabilities specific to your work and life." },
  { id: "browse", label: "Browse", subtitle: "The whole graph as a list. Complete keyboard alternative to the map." },
];

export function Workbench({
  open,
  tab,
  onTabChange,
  onClose,
  onSelectNode,
  onRunProbe,
  onOpenMission,
  selectedId,
}: {
  open: boolean;
  tab: WorkbenchTab;
  onTabChange: (tab: WorkbenchTab) => void;
  onClose: () => void;
  onSelectNode: (id: string) => void;
  onRunProbe: (probeId: string) => void;
  onOpenMission: (missionId: string) => void;
  selectedId: string | null;
}) {
  const active = TABS.find((entry) => entry.id === tab) ?? TABS[0];
  // Cross-tab focus lives entirely here. Mirroring it in from a prop would mean
  // an effect writing state on every parent render, which is the render-loop
  // shape this codebase has been bitten by before.
  const [internalFocus, setInternalFocus] = useState<{
    kind: "prediction" | "goal" | "experiment";
    id: string;
  } | null>(null);

  const jump = (next: WorkbenchTab, target?: { kind: "prediction" | "goal" | "experiment"; id: string }) => {
    onTabChange(next);
    setInternalFocus(target ?? null);
  };

  return (
    <Sheet open={open} onClose={onClose} title={active.label} subtitle={active.subtitle} wide>
      <div
        role="tablist"
        aria-label="Workbench sections"
        className="-mx-1 mb-4 flex gap-1 overflow-x-auto pb-1"
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => jump(entry.id)}
            className={[
              "shrink-0 rounded-lg px-3 py-2 text-xs transition-colors",
              tab === entry.id
                ? "bg-white/10 text-white"
                : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300",
            ].join(" ")}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "review" && (
        <ReviewTab
          onSelectNode={(id) => {
            onSelectNode(id);
            onClose();
          }}
          onRunProbe={(probeId) => {
            onClose();
            onRunProbe(probeId);
          }}
          onOpenMission={(missionId) => {
            onClose();
            onOpenMission(missionId);
          }}
          onResolvePrediction={(id) => jump("predictions", { kind: "prediction", id })}
          onOpenGoal={(id) => jump("goals", { kind: "goal", id })}
          onOpenExperiment={(id) => jump("experiments", { kind: "experiment", id })}
        />
      )}

      {tab === "goals" && (
        <GoalsTab
          onSelectNode={(id) => {
            onSelectNode(id);
            onClose();
          }}
          focusGoalId={internalFocus?.kind === "goal" ? internalFocus.id : null}
        />
      )}

      {tab === "insights" && (
        <InsightsTab
          onSelectNode={(id) => {
            onSelectNode(id);
            onClose();
          }}
        />
      )}

      {tab === "predictions" && (
        <PredictionsTab
          focusId={internalFocus?.kind === "prediction" ? internalFocus.id : null}
        />
      )}

      {tab === "experiments" && (
        <ExperimentsTab
          focusId={internalFocus?.kind === "experiment" ? internalFocus.id : null}
        />
      )}

      {tab === "evidence" && (
        <EvidenceTab
          onSelectNode={(id) => {
            onSelectNode(id);
            onClose();
          }}
        />
      )}

      {tab === "analytics" && (
        <AnalyticsTab
          onSelectNode={(id) => {
            onSelectNode(id);
            onClose();
          }}
        />
      )}

      {tab === "personal" && (
        <PersonalTab
          onSelectNode={(id) => {
            onSelectNode(id);
            onClose();
          }}
        />
      )}

      {tab === "browse" && (
        <BrowseTab
          selectedId={selectedId}
          onSelectNode={(id) => {
            onSelectNode(id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
