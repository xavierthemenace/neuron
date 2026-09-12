"use client";

import { useMemo } from "react";
import { ESTIMATE_CONFIDENCE_LABEL, PROVENANCE_LABEL } from "@/lib/competence";
import { calibrationSummary } from "@/lib/predictions";
import { buildInbox, type InboxItem } from "@/lib/inbox";
import { DEFAULT_CONSTRAINTS, planSession, type WorkoutItem } from "@/lib/workout";
import type { IntelligenceData } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import type { WorkbenchTab } from "./Workbench";
import { Why } from "./ui";

/**
 * The front door.
 *
 * Neuron's problem was never that it lacked screens — it opened onto a
 * 139-node map with no instruction and eleven panels behind it. This screen
 * answers one question, "what do I do now", and everything else is one tap
 * away. It invents nothing: the session comes from the same planner the
 * Session sheet uses, and the queue from the same inbox the Review tab reads.
 */

const DATE_FORMAT: Intl.DateTimeFormatOptions = { weekday: "long" };
const LONG_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };

function evidenceNote(item: WorkoutItem): string {
  return item.exercise.evidence === "self-report"
    ? "counts as practice"
    : "can move a competence estimate";
}

/** Green = a measurement could move. Orange = it is waiting on you. */
function itemTone(kind: InboxItem["kind"]): string {
  if (kind === "prediction-due" || kind === "mission-open" || kind === "experiment-open") {
    return "var(--pop)";
  }
  if (kind === "retention") return "var(--warn)";
  return "var(--green-soft)";
}

export function Today({
  data,
  onSelectNode,
  onOpenPlanner,
  onOpenTab,
  onRunProbe,
  onOpenMission,
  onOpenMap,
}: {
  data: IntelligenceData;
  onSelectNode: (nodeId: string) => void;
  onOpenPlanner: () => void;
  onOpenTab: (tab: WorkbenchTab) => void;
  onRunProbe: (probeId: string) => void;
  onOpenMission: (missionId: string) => void;
  onOpenMap: () => void;
}) {
  const model = useProgress();

  const plan = useMemo(
    () => planSession(data, model, DEFAULT_CONSTRAINTS, model.progress.goals),
    [data, model],
  );
  const inbox = useMemo(
    () => buildInbox(model, model.progress),
    [model],
  );

  const calibration = useMemo(
    () => calibrationSummary(model.progress.predictions),
    [model.progress.predictions],
  );

  const now = new Date();
  const lead = plan.items[0];
  const rest = plan.items.slice(1, 3);
  const queue = inbox.slice(0, 3);
  const estimate = lead ? model.estimates[lead.nodeId] : undefined;
  const retention = lead ? model.retentionByNodeId[lead.nodeId] : undefined;

  const openItem = (item: InboxItem) => {
    if (item.probeId) return onRunProbe(item.probeId);
    if (item.missionId) return onOpenMission(item.missionId);
    if (item.nodeId) return onSelectNode(item.nodeId);
    return onOpenTab("review");
  };

  return (
    <div className="animate-rise mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-6 pt-4 sm:px-6 sm:pt-7 lg:max-w-5xl lg:gap-6">
      {model.progress.demo && (
        <p className="rounded-xl border border-dashed border-[var(--pop)]/45 bg-[var(--pop-soft)] px-3.5 py-2.5 text-[12px] leading-relaxed text-[var(--ink)]">
          <strong className="font-semibold">This is an example profile.</strong> Six months of
          generated history, so the queue, the comparisons and the calibration record have
          something in them. None of it is yours. Clear it from Data when you have seen enough.
        </p>
      )}

      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] leading-none text-[var(--ink)] sm:text-[38px] lg:text-[46px]">
            {now.toLocaleDateString(undefined, DATE_FORMAT)}
          </h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            {now.toLocaleDateString(undefined, LONG_DATE)}
          </p>
        </div>
        <p className="text-right text-[11px] leading-snug text-[var(--ink-soft)]">
          {model.totalXp.toLocaleString()} XP
          <span className="block text-[var(--ink-faint)]">practice, not ability</span>
        </p>
      </header>

      {/* On a laptop the day splits in two: what to do on the left, what is
          waiting and whether any of it is working on the right. On a phone it
          stays one column in that same order. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-5">
      {/* ── The one thing ─────────────────────────────────────────────── */}
      {lead ? (
        <section
          className="flex flex-col gap-4 rounded-[20px] p-5 text-[#f3efe7] shadow-[0_10px_30px_rgb(31_61_46_/_0.22)]"
          style={{ background: "var(--green)" }}
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-70">
            Do this next
          </span>
          <h2 className="font-display text-[26px] leading-[1.12] text-balance sm:text-[31px] lg:text-[35px]">
            {lead.exercise.label}
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] opacity-80">
            <button
              type="button"
              onClick={() => onSelectNode(lead.nodeId)}
              className="underline decoration-dotted underline-offset-4"
            >
              {lead.nodeLabel}
            </button>
            <span>{lead.minutes} min</span>
            <span>level {lead.difficulty}/5</span>
            <span>{evidenceNote(lead)}</span>
          </p>
          <button
            type="button"
            onClick={() => onSelectNode(lead.nodeId)}
            className="min-h-[48px] rounded-full px-6 text-[15px] font-bold text-[#fff] transition-transform duration-150 active:scale-[0.985]"
            style={{ background: "var(--pop)" }}
          >
            Start
          </button>
        </section>
      ) : (
        <section
          className="rounded-[20px] p-5 text-[#f3efe7]"
          style={{ background: "var(--green)" }}
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-70">
            Nothing planned
          </span>
          <h2 className="font-display mt-3 text-[25px] leading-[1.14] lg:text-[30px]">
            Everything eligible is inside its reset window.
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed opacity-80">
            Reset windows exist so repetition cannot be farmed. Widen the time budget in the
            planner, or pick something off the map yourself.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onOpenPlanner}
              className="min-h-[44px] rounded-full border border-white/30 px-5 text-[13px] font-medium"
            >
              Open the planner
            </button>
            <button
              type="button"
              onClick={onOpenMap}
              className="min-h-[44px] rounded-full px-5 text-[13px] font-medium text-[#fff]"
              style={{ background: "var(--pop)" }}
            >
              Browse the map
            </button>
          </div>
        </section>
      )}

      {/* ── The three numbers for whatever is on deck ──────────────────── */}
      {lead && estimate && (
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              k: "retention",
              v: retention?.repetitions
                ? `${Math.round((retention.retention ?? 0) * 100)}%`
                : "—",
              note: retention?.repetitions ? "since your last rep" : "never trained",
            },
            {
              k: "ability",
              v: `${Math.round(estimate.competence * 100)}%`,
              // Never let a percentage imply it was measured when it was not.
              note: PROVENANCE_LABEL[estimate.provenance].toLowerCase(),
            },
            {
              k: "certainty",
              v: ESTIMATE_CONFIDENCE_LABEL[estimate.confidence],
              note:
                estimate.observations.length === 1
                  ? "1 observation"
                  : `${estimate.observations.length} observations`,
            },
          ].map((cell) => (
            <div
              key={cell.k}
              className="rounded-2xl bg-[var(--card)] px-3 py-3 ring-1 ring-[var(--rule)]"
            >
              <p
                className={
                  cell.v.length > 4
                    ? "text-[15px] font-semibold leading-tight text-[var(--ink)]"
                    : "font-display text-[25px] leading-none tabular-nums text-[var(--ink)]"
                }
              >
                {cell.v}
              </p>
              <p className="mt-1.5 text-[9.5px] font-medium uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                {cell.k}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-[var(--ink-faint)]">
                {cell.note}
              </p>
            </div>
          ))}
        </div>
      )}

      {lead && (
        <Why summary="Why this one?">
          <span className="block text-[var(--ink-soft)]">
            Ranked {lead.score.toFixed(2)} out of everything available. The score is the sum
            of these factors.
          </span>
          <ul className="mt-2 space-y-1">
            {lead.factors.map((factor) => (
              <li key={factor.key} className="flex gap-2">
                <span className="w-12 shrink-0 tabular-nums text-[var(--green-soft)]">
                  +{factor.weight.toFixed(2)}
                </span>
                <span className="text-[var(--ink-soft)]">{factor.detail}</span>
              </li>
            ))}
          </ul>
        </Why>
      )}

        </div>

        <div className="flex flex-col gap-5">
      {/* ── Then, if there's time ──────────────────────────────────────── */}
      {(rest.length > 0 || queue.length > 0) && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            Then, if there&rsquo;s time
          </h3>

          {rest.map((item) => (
            <button
              key={item.exercise.id}
              type="button"
              onClick={() => onSelectNode(item.nodeId)}
              className="flex min-h-[56px] w-full items-start gap-3 rounded-2xl bg-[var(--card)] p-3.5 text-left ring-1 ring-[var(--rule)] transition-shadow duration-150 hover:shadow-[0_6px_18px_rgb(25_22_20_/_0.08)]"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: "var(--green-soft)" }}
              />
              <span className="min-w-0">
                <span className="block text-[13.5px] leading-snug text-[var(--ink)]">
                  {item.exercise.label}
                </span>
                <span className="mt-1 block text-[11px] text-[var(--ink-faint)]">
                  {item.nodeLabel} · {item.minutes} min · {evidenceNote(item)}
                </span>
              </span>
            </button>
          ))}

          {queue.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => openItem(item)}
              className="flex min-h-[56px] w-full items-start gap-3 rounded-2xl bg-[var(--card)] p-3.5 text-left ring-1 ring-[var(--rule)] transition-shadow duration-150 hover:shadow-[0_6px_18px_rgb(25_22_20_/_0.08)]"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: itemTone(item.kind) }}
              />
              <span className="min-w-0">
                <span className="block text-[13.5px] leading-snug text-[var(--ink)]">
                  {item.title}
                </span>
                <span className="mt-1 block text-[11px] text-[var(--ink-faint)]">
                  {item.actionLabel}
                </span>
              </span>
            </button>
          ))}
        </section>
      )}

      {inbox.length === 0 && plan.items.length > 0 && (
        <p className="rounded-2xl bg-[var(--green-wash)] px-4 py-3 text-[12px] leading-relaxed text-[var(--green)]">
          Nothing is sliding and nothing is overdue. An empty queue is what it should look
          like — Neuron does not invent urgency to fill it.
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          Is it working?
        </h3>
        <button
          type="button"
          onClick={() => onOpenTab("predictions")}
          className="rounded-2xl bg-[var(--card)] p-3.5 text-left ring-1 ring-[var(--rule)] transition-shadow duration-150 hover:shadow-[0_6px_18px_rgb(25_22_20_/_0.08)]"
        >
          <span className="block text-[13px] leading-snug text-[var(--ink)]">
            {calibration.headline}
          </span>
          <span className="mt-1.5 block text-[11px] leading-relaxed text-[var(--ink-faint)]">
            {calibration.caveat}
          </span>
          {calibration.overdue > 0 && (
            <span className="mt-2 inline-block rounded-full bg-[var(--pop-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink)]">
              {calibration.overdue} past{" "}
              {calibration.overdue === 1 ? "its date" : "their dates"} — resolve them
            </span>
          )}
        </button>
      </section>

      <footer className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onOpenPlanner}
          className="min-h-[44px] rounded-full bg-[var(--card)] px-4 text-[12.5px] font-medium text-[var(--ink)] ring-1 ring-[var(--rule)]"
        >
          Plan a longer session
        </button>
        <button
          type="button"
          onClick={() => onOpenTab("predictions")}
          className="min-h-[44px] rounded-full bg-[var(--card)] px-4 text-[12.5px] font-medium text-[var(--ink)] ring-1 ring-[var(--rule)]"
        >
          Make a call
        </button>
        {inbox.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenTab("review")}
            className="min-h-[44px] rounded-full bg-[var(--card)] px-4 text-[12.5px] font-medium text-[var(--ink)] ring-1 ring-[var(--rule)]"
          >
            Review queue ({inbox.length})
          </button>
        )}
      </footer>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--ink-faint)]">
        The ranking is a weighted judgement, not a measured effect size. It is good at
        noticing what is decaying and what you have neglected; it cannot know whether today
        is the day a particular exercise lands for you.
      </p>
    </div>
  );
}
