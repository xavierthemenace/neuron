"use client";

import { useMemo, useState } from "react";
import { nodesById, paths, pathsById } from "@/lib/curriculum";
import { buildGoalPlan, seedNodesForPhrase, suggestPaths } from "@/lib/goals";
import type { Goal } from "@/lib/types";
import { useProgress } from "../ProgressProvider";
import {
  Caveat,
  Chip,
  EmptyState,
  Field,
  Meter,
  Section,
  Why,
  inputClass,
  primaryButtonClass,
} from "../ui";

/**
 * Goals and multi-week plans.
 *
 * A goal is a sentence plus a subset of the graph. The plan it generates is
 * explicitly a planning convenience rather than a schedule anyone should trust
 * to the week — the caveat is rendered next to it rather than buried.
 */
export function GoalsTab({
  onSelectNode,
  focusGoalId,
}: {
  onSelectNode: (id: string) => void;
  focusGoalId?: string | null;
}) {
  const model = useProgress();
  const { progress, addGoal, updateGoal, deleteGoal } = model;
  const [phrase, setPhrase] = useState("");
  const [weeklyMinutes, setWeeklyMinutes] = useState(90);
  const [expanded, setExpanded] = useState<string | null>(focusGoalId ?? null);

  const suggestions = useMemo(() => suggestPaths(phrase), [phrase]);
  const fallback = useMemo(
    () => (phrase.trim().length > 4 && suggestions.length === 0 ? seedNodesForPhrase(phrase) : null),
    [phrase, suggestions.length],
  );

  const create = (nodeIds: string[], pathId?: string, label?: string) => {
    if (nodeIds.length === 0) return;
    addGoal({
      label: label ?? phrase.trim() ?? "Untitled goal",
      motivation: phrase.trim() || undefined,
      nodeIds,
      pathId,
      weeklyMinutes,
    });
    setPhrase("");
  };

  return (
    <div className="space-y-6">
      <Section
        title="New goal"
        hint="Say it the way you would say it to a person. The map is searched for what matches."
      >
        <div className="space-y-3">
          <input
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            placeholder="e.g. become a better writer, prepare for technical interviews, make better decisions…"
            className={inputClass}
            aria-label="Describe your goal"
          />
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Weekly minutes" hint="Used only to spread the plan across weeks.">
              <input
                type="number"
                min={15}
                max={1200}
                step={15}
                value={weeklyMinutes}
                onChange={(event) => setWeeklyMinutes(Number(event.target.value) || 90)}
                className={`${inputClass} w-28`}
              />
            </Field>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-1.5">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.path.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-neutral-200">
                        {suggestion.path.label}
                      </div>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                        <span className="text-neutral-400">Done when: </span>
                        {suggestion.path.outcome}
                      </p>
                      <Why summary="Why this path?">
                        Matched on: {suggestion.matchedOn.join(", ")}. Keyword routing, not a
                        language model — it runs locally, you can see exactly why it fired,
                        and when it is wrong it is obviously wrong.
                      </Why>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        create(suggestion.path.nodeIds, suggestion.path.id, suggestion.path.label)
                      }
                      className={primaryButtonClass}
                    >
                      Use this
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {fallback && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[11px] text-neutral-400">
                No curated path matched that. These nodes mention your words:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {fallback.nodeIds.map((id) => (
                  <Chip key={id}>{nodesById.get(id)?.label ?? id}</Chip>
                ))}
              </div>
              {fallback.nodeIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => create(fallback.nodeIds)}
                  className={`${primaryButtonClass} mt-2.5`}
                >
                  Create goal from these
                </button>
              )}
            </div>
          )}
        </div>
      </Section>

      <Section title="Curated paths" hint="Overlays on the same core graph — never a separate curriculum.">
        <div className="flex flex-wrap gap-1.5">
          {paths.map((path) => (
            <Chip
              key={path.id}
              title={path.outcome}
              onClick={() => create(path.nodeIds, path.id, path.label)}
            >
              {path.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Your goals">
        {progress.goals.length === 0 ? (
          <EmptyState
            title="No goals yet"
            body="Without a goal the planner falls back to retention and balance, which is a reasonable default and a weaker one. A goal changes how every recommendation is ranked."
          />
        ) : (
          <ul className="space-y-2">
            {progress.goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                expanded={expanded === goal.id}
                onToggle={() => setExpanded(expanded === goal.id ? null : goal.id)}
                onSelectNode={onSelectNode}
                onUpdate={(patch) => updateGoal(goal.id, patch)}
                onDelete={() => deleteGoal(goal.id)}
              />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function GoalCard({
  goal,
  expanded,
  onToggle,
  onSelectNode,
  onUpdate,
  onDelete,
}: {
  goal: Goal;
  expanded: boolean;
  onToggle: () => void;
  onSelectNode: (id: string) => void;
  onUpdate: (patch: Partial<Goal>) => void;
  onDelete: () => void;
}) {
  const model = useProgress();
  const plan = useMemo(() => buildGoalPlan(goal, model), [goal, model]);

  /**
   * Whether anything on this goal has been observed at all.
   *
   * Progress is competence against a target, and an untouched capability sits
   * at the untrained prior rather than at zero — so a goal set five minutes ago
   * reads about 22%. Every other number in the app says when it is resting on
   * the prior; this one was quietly crediting the user for nothing.
   */
  const restsOnPrior = useMemo(
    () => goal.nodeIds.every((id) => (model.estimates[id]?.provenance ?? "prior") === "prior"),
    [goal.nodeIds, model.estimates],
  );
  const path = goal.pathId ? pathsById.get(goal.pathId) : undefined;

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-100">{goal.label}</span>
            {goal.status !== "active" && <Chip>{goal.status}</Chip>}
            {path && <Chip>{path.label}</Chip>}
          </div>
          <div className="mt-2">
            <Meter
              label="Toward the target competence"
              value={restsOnPrior ? 0 : plan.progress}
              caption={
                restsOnPrior
                  ? `Nothing on this goal has been logged yet, so there is no progress to show. ${plan.steps.length} steps · roughly ${plan.weeks} weeks at ${plan.weeklyMinutes} min/week`
                  : `${plan.steps.length} steps · roughly ${plan.weeks} weeks at ${plan.weeklyMinutes} min/week`
              }
            />
          </div>
        </button>
        <div className="flex shrink-0 flex-col gap-1">
          <select
            value={goal.status}
            onChange={(event) => onUpdate({ status: event.target.value as Goal["status"] })}
            className="rounded-lg border border-white/10 bg-[var(--sunk-strong)] px-2 py-1.5 text-[10px] text-neutral-300 outline-none"
            aria-label={`Status of ${goal.label}`}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="achieved">Achieved</option>
            <option value="abandoned">Abandoned</option>
          </select>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg px-2 py-1 text-[10px] text-neutral-600 hover:text-rose-300"
          >
            Delete
          </button>
        </div>
      </div>

      {plan.nextAction && (
        <p className="mt-2 rounded-lg border border-cyan-200/12 bg-cyan-200/[0.03] px-2.5 py-2 text-[11px] text-cyan-50/80">
          Next: <strong className="font-medium">{plan.nextAction.label}</strong> —{" "}
          {plan.nextAction.reason}
        </p>
      )}

      {plan.blockers.length > 0 && (
        <ul className="mt-2 space-y-1">
          {plan.blockers.map((blocker) => (
            <li key={blocker} className="text-[10px] text-amber-100/70">
              Blocked: {blocker}
            </li>
          ))}
        </ul>
      )}

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/8 pt-3">
          <ol className="space-y-1">
            {plan.steps.map((step) => (
              <li key={step.nodeId} className="flex items-start gap-2.5">
                <span className="w-12 shrink-0 pt-0.5 text-[9px] uppercase tracking-wider text-neutral-600">
                  wk {step.week}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectNode(step.nodeId)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="text-[11px] text-neutral-200 hover:text-white">
                    {step.label}
                    {step.addedAsPrerequisite && (
                      <span className="ml-1.5 text-[9px] text-amber-100/60">prerequisite</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[9px] leading-relaxed text-neutral-600">
                    {step.reason}
                  </span>
                </button>
                <span className="shrink-0 tabular-nums text-[10px] text-neutral-500">
                  {Math.round(step.competence * 100)}%
                </span>
              </li>
            ))}
          </ol>
          <Caveat>{plan.caveat}</Caveat>
        </div>
      )}
    </li>
  );
}
