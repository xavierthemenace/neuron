"use client";

import { useMemo, useState } from "react";
import type { ExperimentRecord } from "@/lib/types";
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

/**
 * Personal experiments.
 *
 * Deliberately modest. A within-person A/B with nine observations is a reason
 * to pay attention, not a result, and the summary language here is written to
 * make that impossible to misread.
 */

const TEMPLATES = [
  {
    hypothesis: "Spaced retrieval beats rereading for this material",
    intervention: "A: retrieval practice. B: rereading the same passage for the same time.",
    measure: "Score on a delayed test taken at least 24 hours later, 0-100",
  },
  {
    hypothesis: "Deep work goes better in the morning than the evening",
    intervention: "A: first block before 10:00. B: first block after 19:00.",
    measure: "Minutes of uninterrupted work before the first self-caught distraction",
  },
  {
    hypothesis: "Ten minutes of meditation before work improves focus",
    intervention: "A: 10 minutes of breath focus first. B: straight into the work.",
    measure: "Self-caught mind-wandering events per hour, counted",
  },
  {
    hypothesis: "Interleaved practice beats blocked practice for this skill",
    intervention: "A: mixed problem types. B: one type at a time.",
    measure: "Accuracy on a mixed test a day later, 0-100",
  },
];

interface ArmStats {
  n: number;
  mean: number;
  sd: number;
}

function stats(values: number[]): ArmStats {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  if (n < 2) return { n, mean, sd: 0 };
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
  return { n, mean, sd: Math.sqrt(variance) };
}

/**
 * A summary written to resist over-reading.
 *
 * There is deliberately no p-value here. Producing one from a handful of
 * self-collected, unblinded observations would give the output a false air of
 * rigour, which is the exact failure mode this feature has to avoid.
 */
function describe(a: ArmStats, b: ArmStats): string {
  if (a.n < 3 || b.n < 3) {
    return `Only ${a.n} and ${b.n} observations so far. Nothing can be read from this yet — aim for at least five in each arm before looking at the difference.`;
  }
  const difference = a.mean - b.mean;
  const spread = Math.max(a.sd, b.sd, 1e-9);
  const ratio = Math.abs(difference) / spread;

  if (ratio < 0.5) {
    return `A averaged ${a.mean.toFixed(1)}, B averaged ${b.mean.toFixed(1)}. The gap is small relative to how much your own results vary day to day, so this run does not distinguish the two.`;
  }
  const direction = difference > 0 ? "A" : "B";
  return `${direction} averaged higher (${a.mean.toFixed(1)} vs ${b.mean.toFixed(1)}), by roughly ${ratio.toFixed(1)}× the day-to-day spread. Suggestive at this sample size, and not controlled for order, expectation or what else was happening those days.`;
}

export function ExperimentsTab({ focusId }: { focusId?: string | null }) {
  const { progress, addExperiment, observeExperiment, concludeExperiment } = useProgress();
  const [draft, setDraft] = useState({ hypothesis: "", intervention: "", measure: "" });

  const running = progress.experiments.filter((item) => item.status === "running");
  const finished = progress.experiments.filter((item) => item.status !== "running");

  return (
    <div className="space-y-6">
      <Section
        title="New experiment"
        hint="One question, two arms, one number you can record each time."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((template) => (
              <Chip key={template.hypothesis} onClick={() => setDraft(template)}>
                {template.hypothesis.slice(0, 42)}…
              </Chip>
            ))}
          </div>
          <Field label="Hypothesis">
            <input
              value={draft.hypothesis}
              onChange={(event) => setDraft({ ...draft, hypothesis: event.target.value })}
              className={inputClass}
              placeholder="What do you think is true?"
            />
          </Field>
          <Field label="Intervention" hint="Describe arm A and arm B explicitly.">
            <input
              value={draft.intervention}
              onChange={(event) => setDraft({ ...draft, intervention: event.target.value })}
              className={inputClass}
              placeholder="A: … B: …"
            />
          </Field>
          <Field label="Outcome measure" hint="A single number you can record after each session.">
            <input
              value={draft.measure}
              onChange={(event) => setDraft({ ...draft, measure: event.target.value })}
              className={inputClass}
              placeholder="e.g. delayed test score 0-100"
            />
          </Field>
          <button
            type="button"
            disabled={draft.hypothesis.trim().length < 8 || draft.measure.trim().length < 3}
            onClick={() => {
              addExperiment(draft);
              setDraft({ hypothesis: "", intervention: "", measure: "" });
            }}
            className={primaryButtonClass}
          >
            Start experiment
          </button>
        </div>
      </Section>

      <Section title={`Running (${running.length})`}>
        {running.length === 0 ? (
          <EmptyState
            title="Nothing running"
            body="Personal experiments are the cheapest way to find out whether a practice change actually does anything for you specifically. They are also the easiest thing in this app to over-interpret."
          />
        ) : (
          <ul className="space-y-2">
            {running.map((experiment) => (
              <ExperimentCard
                key={experiment.id}
                experiment={experiment}
                focused={experiment.id === focusId}
                onObserve={(arm, value, note) => observeExperiment(experiment.id, arm, value, note)}
                onConclude={(conclusion) => concludeExperiment(experiment.id, conclusion)}
              />
            ))}
          </ul>
        )}
      </Section>

      {finished.length > 0 && (
        <Section title="Concluded">
          <ul className="space-y-2">
            {finished.map((experiment) => (
              <li
                key={experiment.id}
                className="rounded-xl border border-white/8 bg-white/[0.02] p-3"
              >
                <p className="text-xs font-medium text-neutral-200">{experiment.hypothesis}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                  {experiment.conclusion}
                </p>
                <p className="mt-1 text-[10px] text-neutral-600">
                  {experiment.observations.length} observations
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Caveat>
        These are n-of-1 observations you collected on yourself, unblinded, while knowing
        which arm you were in. That is enough to notice something worth trying and nowhere
        near enough to establish that it works — for you or for anyone else.
      </Caveat>
    </div>
  );
}

function ExperimentCard({
  experiment,
  focused,
  onObserve,
  onConclude,
}: {
  experiment: ExperimentRecord;
  focused: boolean;
  onObserve: (arm: "a" | "b", value: number, note?: string) => void;
  onConclude: (conclusion: string) => void;
}) {
  const [arm, setArm] = useState<"a" | "b">("a");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [conclusion, setConclusion] = useState("");

  const armA = useMemo(
    () => stats(experiment.observations.filter((o) => o.arm === "a").map((o) => o.value)),
    [experiment.observations],
  );
  const armB = useMemo(
    () => stats(experiment.observations.filter((o) => o.arm === "b").map((o) => o.value)),
    [experiment.observations],
  );

  return (
    <li
      className={[
        "rounded-xl border p-3",
        focused ? "border-cyan-300/35 bg-cyan-300/[0.04]" : "border-white/8 bg-white/[0.02]",
      ].join(" ")}
    >
      <p className="text-xs font-medium text-neutral-100">{experiment.hypothesis}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
        {experiment.intervention}
      </p>
      <p className="mt-0.5 text-[10px] text-neutral-600">Measuring: {experiment.measure}</p>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {(
          [
            ["A", armA],
            ["B", armB],
          ] as const
        ).map(([label, arm_]) => (
          <div key={label} className="rounded-lg border border-white/8 bg-[var(--sunk)] px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wider text-neutral-600">Arm {label}</div>
            <div className="tabular-nums text-sm text-neutral-200">
              {arm_.n > 0 ? arm_.mean.toFixed(1) : "—"}
            </div>
            <div className="text-[9px] text-neutral-600">
              n={arm_.n}
              {arm_.n > 1 && ` · sd ${arm_.sd.toFixed(1)}`}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">{describe(armA, armB)}</p>
      <Why summary="Why no p-value?">
        A significance test on a handful of unblinded self-collected observations would give
        this an air of rigour it does not have. The comparison above is deliberately
        descriptive: two means and how they sit relative to your own day-to-day spread.
      </Why>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-white/8 pt-3">
        <Field label="Arm">
          <select
            value={arm}
            onChange={(event) => setArm(event.target.value as "a" | "b")}
            className={`${inputClass} w-20`}
          >
            <option value="a">A</option>
            <option value="b">B</option>
          </select>
        </Field>
        <Field label="Value">
          <input
            type="number"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={`${inputClass} w-24`}
          />
        </Field>
        <Field label="Note">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={`${inputClass} w-40`}
            placeholder="optional"
          />
        </Field>
        <button
          type="button"
          disabled={!Number.isFinite(Number(value)) || value.trim() === ""}
          onClick={() => {
            onObserve(arm, Number(value), note.trim() || undefined);
            setValue("");
            setNote("");
          }}
          className={buttonClass}
        >
          Record
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Field label="Conclusion">
          <input
            value={conclusion}
            onChange={(event) => setConclusion(event.target.value)}
            className={`${inputClass} w-full min-w-[14rem]`}
            placeholder="What will you actually do differently, if anything?"
          />
        </Field>
        <button
          type="button"
          disabled={conclusion.trim().length < 10}
          onClick={() => onConclude(conclusion.trim())}
          className={buttonClass}
        >
          Conclude
        </button>
      </div>
    </li>
  );
}
