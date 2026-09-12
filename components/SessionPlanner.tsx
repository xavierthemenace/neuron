"use client";

import { useMemo, useState } from "react";
import { pathsById } from "@/lib/curriculum";
import {
  DEFAULT_CONSTRAINTS,
  SESSION_PRESETS,
  planSession,
  type Energy,
  type SessionConstraints,
  type SessionMode,
  type WorkoutItem,
} from "@/lib/workout";
import type { IntelligenceData } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import {
  Caveat,
  Chip,
  EmptyState,
  Field,
  Sheet,
  Why,
  buttonClass,
  inputClass,
} from "./ui";

/**
 * The session planner.
 *
 * Replaces the fixed three-item "Daily Workout" with a constrained request:
 * the user states how long they have and what state they are in, and the
 * planner fits the best available training into that. Every item shows the
 * weighted factors that selected it, so "why this?" has a real answer rather
 * than a generated sentence.
 */

function ItemCard({
  item,
  index,
  onSelect,
  researchMode,
}: {
  item: WorkoutItem;
  index: number;
  onSelect: () => void;
  researchMode: boolean;
}) {
  const positive = item.factors
    .filter((factor) => factor.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  const negative = item.factors
    .filter((factor) => factor.weight < 0)
    .sort((a, b) => a.weight - b.weight);

  return (
    <li className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-200/12 bg-cyan-200/[0.035] text-[10px] font-semibold text-cyan-100/75">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onSelect}
            className="block w-full text-left text-xs font-medium leading-snug text-neutral-200 transition-colors hover:text-white"
          >
            {item.adaptive.label}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-neutral-500">
            <span>{item.nodeLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{item.categoryLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{item.minutes} min</span>
            <span aria-hidden="true">·</span>
            <span>L{item.difficulty}/5</span>
            {item.exercise.evidence !== "self-report" && (
              <span className="rounded bg-emerald-300/[0.08] px-1 py-0.5 text-[8px] uppercase text-emerald-200/70">
                {item.exercise.evidence}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-500">{item.reason}</p>

          <Why summary="Why this one?">
            <p className="mb-2 text-neutral-500">
              Ranked {item.score.toFixed(2)} out of everything currently available. The score
              is the sum of these factors.
            </p>
            <ul className="space-y-1">
              {positive.map((factor) => (
                <li key={factor.key} className="flex gap-2">
                  <span className="w-10 shrink-0 tabular-nums text-emerald-300/70">
                    +{factor.weight.toFixed(2)}
                  </span>
                  <span>
                    <span className="text-neutral-300">{factor.label}.</span> {factor.detail}
                  </span>
                </li>
              ))}
              {negative.map((factor) => (
                <li key={factor.key} className="flex gap-2">
                  <span className="w-10 shrink-0 tabular-nums text-rose-300/70">
                    {factor.weight.toFixed(2)}
                  </span>
                  <span>
                    <span className="text-neutral-300">{factor.label}.</span> {factor.detail}
                  </span>
                </li>
              ))}
            </ul>
            {researchMode && (
              <p className="mt-2 text-neutral-600">
                Adaptive state: level {item.adaptive.level}, anchor {item.adaptive.anchor},{" "}
                {item.adaptive.attempts} attempts, {Math.round(item.adaptive.scoredShare * 100)}%
                scored. {item.adaptive.reason}
              </p>
            )}
          </Why>
        </div>
        <span className="shrink-0 rounded-full border border-white/8 px-2 py-0.5 text-[9px] tabular-nums text-neutral-400">
          +{item.xp}
        </span>
      </div>
    </li>
  );
}

export function SessionPlanner({
  data,
  open,
  onClose,
  onSelectNode,
  researchMode,
}: {
  data: IntelligenceData;
  open: boolean;
  onClose: () => void;
  onSelectNode: (id: string) => void;
  researchMode: boolean;
}) {
  const model = useProgress();
  const [constraints, setConstraints] = useState<SessionConstraints>(DEFAULT_CONSTRAINTS);
  const [showAlternates, setShowAlternates] = useState(false);

  const activeGoals = model.progress.goals.filter((goal) => goal.status === "active");

  const plan = useMemo(
    () => planSession(data, model, constraints, model.progress.goals),
    [data, model, constraints],
  );

  const update = (patch: Partial<SessionConstraints>) =>
    setConstraints((current) => ({ ...current, ...patch }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Plan a session"
      subtitle="Tell it what you have, not the other way round."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {SESSION_PRESETS.map((preset) => {
            const active =
              constraints.minutes === preset.constraints.minutes &&
              constraints.energy === preset.constraints.energy &&
              constraints.mode === preset.constraints.mode;
            return (
              <Chip
                key={preset.id}
                tone={active ? "active" : "neutral"}
                pressed={active}
                onClick={() => setConstraints({ ...preset.constraints, goalId: constraints.goalId })}
              >
                {preset.label}
              </Chip>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Minutes">
            <input
              type="number"
              min={5}
              max={240}
              step={5}
              value={constraints.minutes}
              onChange={(event) =>
                update({ minutes: Math.max(5, Number(event.target.value) || 5) })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Energy">
            <select
              value={constraints.energy}
              onChange={(event) => update({ energy: event.target.value as Energy })}
              className={inputClass}
            >
              <option value="low">Mentally tired</option>
              <option value="normal">Normal</option>
              <option value="high">Sharp</option>
            </select>
          </Field>
          <Field label="Emphasis">
            <select
              value={constraints.mode}
              onChange={(event) => update({ mode: event.target.value as SessionMode })}
              className={inputClass}
            >
              <option value="balanced">Balanced</option>
              <option value="review">Review what is fading</option>
              <option value="hard">Hard problems</option>
              <option value="evidence">Produce evidence</option>
              <option value="goal">Follow a goal</option>
            </select>
          </Field>
        </div>

        {activeGoals.length > 0 && (
          <Field label="Goal" hint="Goal-relevant nodes are weighted up; in goal mode, everything else is weighted down.">
            <select
              value={constraints.goalId ?? ""}
              onChange={(event) => update({ goalId: event.target.value || undefined })}
              className={inputClass}
            >
              <option value="">All active goals</option>
              {activeGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.label}
                  {goal.pathId ? ` · ${pathsById.get(goal.pathId)?.label ?? ""}` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}

        <p className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-neutral-400">
          {plan.rationale}
        </p>

        {plan.items.length === 0 ? (
          <EmptyState
            title="Nothing fits right now"
            body="Every eligible task is inside its reset window or longer than the budget. Reset windows exist so repetition cannot be farmed; widen the time budget or come back later."
          />
        ) : (
          <ul className="space-y-1.5">
            {plan.items.map((item, index) => (
              <ItemCard
                key={item.exercise.id}
                item={item}
                index={index}
                researchMode={researchMode}
                onSelect={() => {
                  onSelectNode(item.nodeId);
                  onClose();
                }}
              />
            ))}
          </ul>
        )}

        {plan.alternates.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowAlternates((value) => !value)}
              className={buttonClass}
            >
              {showAlternates ? "Hide" : "Show"} what was ranked next
            </button>
            {showAlternates && (
              <ul className="mt-2 space-y-1.5">
                {plan.alternates.map((item, index) => (
                  <ItemCard
                    key={item.exercise.id}
                    item={item}
                    index={plan.items.length + index}
                    researchMode={researchMode}
                    onSelect={() => {
                      onSelectNode(item.nodeId);
                      onClose();
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        <Caveat>
          Ranking factors are weighted judgements, not measured effect sizes. The planner is
          good at noticing what is decaying and what is being neglected; it cannot know
          whether today is the day a particular exercise will land for you.
        </Caveat>
      </div>
    </Sheet>
  );
}

/** Floating launcher that shows what the next session would contain. */
export function SessionLauncher({
  data,
  onOpen,
  panelOpen,
}: {
  data: IntelligenceData;
  onOpen: () => void;
  panelOpen: boolean;
}) {
  const model = useProgress();
  const plan = useMemo(
    () => planSession(data, model, DEFAULT_CONSTRAINTS, model.progress.goals),
    [data, model],
  );

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        "pointer-events-auto absolute bottom-4 left-16 z-30 flex min-h-[44px] items-center gap-2 rounded-full border border-cyan-200/15 bg-[var(--panel)] px-3.5 py-2 text-[11px] font-medium text-cyan-50/85 shadow-xl backdrop-blur-xl transition-colors hover:border-cyan-200/35 hover:text-white",
        // display:none rather than opacity-0. An invisible control that is
        // still focusable is worse than a hidden one: keyboard and screen
        // reader users hit it and cannot see what they have landed on.
        panelOpen ? "max-md:hidden" : "",
      ].join(" ")}
      aria-label={`Plan a training session. ${plan.items.length} items ready.`}
    >
      <span
        className="h-2 w-2 rounded-full bg-cyan-200/80 shadow-[0_0_12px_currentColor]"
        aria-hidden="true"
      />
      Plan a session
      <span className="text-cyan-100/45">
        {plan.items.length > 0 ? `${plan.totalMinutes} min ready` : "nothing due"}
      </span>
    </button>
  );
}
