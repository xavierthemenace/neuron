"use client";

import { useMemo, useState } from "react";
import { capstonesById, missionsById, nodesById } from "@/lib/curriculum";
import { useProgress } from "./ProgressProvider";
import {
  Caveat,
  Chip,
  Field,
  Section,
  Sheet,
  inputClass,
  primaryButtonClass,
} from "./ui";

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * Missions.
 *
 * A mission is several capabilities forced to interact on one real problem.
 * Completion requires actual written work at each step — clicking "done"
 * cannot finish one, because the entire point is to produce something that
 * could be evidence of transfer rather than evidence of attendance.
 */
export function MissionRunner({
  missionId,
  onClose,
  onSelectNode,
}: {
  missionId: string | null;
  onClose: () => void;
  onSelectNode: (id: string) => void;
}) {
  const { progress, startMission, saveMissionStep, completeMission } = useProgress();
  const [quality, setQuality] = useState(0.6);
  const [reflection, setReflection] = useState("");

  const mission = missionId ? missionsById.get(missionId) : null;
  const record = useMemo(
    () =>
      missionId
        ? progress.missions.find((item) => item.missionId === missionId && !item.completedAt)
        : undefined,
    [missionId, progress.missions],
  );

  if (!mission) return null;

  const steps = mission.steps.map((step) => {
    const text = record?.steps[step.id] ?? "";
    return { step, text, words: wordCount(text), met: wordCount(text) >= step.minWords };
  });
  const completeCount = steps.filter((entry) => entry.met).length;
  const allMet = completeCount === steps.length;

  return (
    <Sheet
      open
      onClose={onClose}
      title={mission.label}
      subtitle={mission.blurb}
      wide
      footer={`${mission.estimatedMinutes} minutes · difficulty ${mission.difficulty}/5 · ${completeCount}/${steps.length} steps meet their minimum`}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {mission.nodeIds.map((id) => (
            <Chip key={id} onClick={() => onSelectNode(id)}>
              {nodesById.get(id)?.label ?? id}
            </Chip>
          ))}
        </div>

        <p className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-neutral-400">
          {mission.transferClaim}
        </p>

        {!record ? (
          <button
            type="button"
            onClick={() => startMission(mission.id)}
            className={primaryButtonClass}
          >
            Start mission
          </button>
        ) : (
          <>
            <ol className="space-y-3">
              {steps.map(({ step, text, words, met }, index) => (
                <li key={step.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={[
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px]",
                        met
                          ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100"
                          : "border-white/15 text-neutral-500",
                      ].join(" ")}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-relaxed text-neutral-200">{step.prompt}</p>
                      <textarea
                        value={text}
                        onChange={(event) =>
                          saveMissionStep(mission.id, step.id, event.target.value)
                        }
                        rows={4}
                        className={`${inputClass} mt-2 resize-y leading-relaxed`}
                        aria-label={`Step ${index + 1}`}
                      />
                      <p
                        className={`mt-1 text-[10px] ${met ? "text-emerald-300/60" : "text-neutral-600"}`}
                      >
                        {words} / {step.minWords} words minimum
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <Section
              title="Finish"
              hint="Completion is transfer evidence. It is weighted higher than a normal rep and still far below a capstone."
            >
              <div className="space-y-3">
                <Field label={`How well did this go? ${Math.round(quality * 100)}%`}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(quality * 100)}
                    onChange={(event) => setQuality(Number(event.target.value) / 100)}
                    className="w-full accent-cyan-300"
                    aria-label="Self-assessed mission quality"
                  />
                </Field>
                <Field label="What did this expose that a single exercise would not have?">
                  <textarea
                    value={reflection}
                    onChange={(event) => setReflection(event.target.value)}
                    rows={3}
                    className={`${inputClass} resize-y`}
                  />
                </Field>
                <button
                  type="button"
                  disabled={!allMet || reflection.trim().length < 20}
                  onClick={() => {
                    completeMission(mission.id, quality, reflection.trim());
                    onClose();
                  }}
                  className={primaryButtonClass}
                >
                  Complete mission
                </button>
                {!allMet && (
                  <p className="text-[10px] text-neutral-600">
                    Every step needs to meet its word minimum. The minimums are not busywork —
                    they are the difference between doing the mission and recording that you
                    did it.
                  </p>
                )}
              </div>
            </Section>
          </>
        )}

        <Caveat>
          A completed mission is credited across every capability it exercised rather than
          fully to each. Your own quality rating is a weak signal and is discounted as one.
        </Caveat>
      </div>
    </Sheet>
  );
}

/**
 * Capstones.
 *
 * The strongest evidence Neuron accepts, because the artifact exists outside
 * the app and someone else could look at it. The rubric is scored by the user,
 * which is a real weakness and is stated as one.
 */
export function CapstoneRunner({
  capstoneId,
  onClose,
  onSelectNode,
}: {
  capstoneId: string | null;
  onClose: () => void;
  onSelectNode: (id: string) => void;
}) {
  const model = useProgress();
  const { submitCapstone } = model;
  const [summary, setSummary] = useState("");
  const [rubric, setRubric] = useState<Record<string, number>>({});

  const capstone = capstoneId ? capstonesById.get(capstoneId) : null;
  if (!capstone) return null;

  const qualifying = capstone.nodeIds.filter(
    (id) => (model.estimates[id]?.competence ?? 0) >= capstone.requires.minCompetence,
  );
  const eligible = qualifying.length >= capstone.requires.minNodes;
  const scored = capstone.rubric.filter((criterion) => rubric[criterion.id] !== undefined);
  const rubricScore =
    scored.length > 0
      ? scored.reduce((sum, criterion) => sum + (rubric[criterion.id] ?? 0), 0) / scored.length
      : undefined;

  return (
    <Sheet
      open
      onClose={onClose}
      title={capstone.label}
      subtitle={capstone.blurb}
      footer={capstone.clusterLabel}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {capstone.nodeIds.map((id) => (
            <Chip
              key={id}
              tone={qualifying.includes(id) ? "active" : "neutral"}
              onClick={() => onSelectNode(id)}
            >
              {nodesById.get(id)?.label ?? id}
            </Chip>
          ))}
        </div>

        {!eligible && (
          <p className="rounded-lg border border-amber-200/15 bg-amber-200/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-amber-50/75">
            {qualifying.length} of the required {capstone.requires.minNodes} underlying
            capabilities are past {Math.round(capstone.requires.minCompetence * 100)}%
            competence. You can still submit — the gate is advisory, because Neuron&apos;s
            estimate of your competence is exactly the thing a capstone is meant to correct.
          </p>
        )}

        <Section title="Evidence">
          <Field label={capstone.evidencePrompt}>
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={5}
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </Field>
        </Section>

        <Section
          title="Rubric"
          hint="Score yourself honestly. This is self-assessment, which is the weakest part of the capstone."
        >
          <ul className="space-y-2">
            {capstone.rubric.map((criterion) => (
              <li key={criterion.id}>
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-neutral-300">
                    {criterion.label}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round((rubric[criterion.id] ?? 0.5) * 100)}
                    onChange={(event) =>
                      setRubric((current) => ({
                        ...current,
                        [criterion.id]: Number(event.target.value) / 100,
                      }))
                    }
                    className="w-28 shrink-0 accent-amber-300"
                    aria-label={criterion.label}
                  />
                  <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-neutral-500">
                    {Math.round((rubric[criterion.id] ?? 0.5) * 100)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <button
          type="button"
          disabled={summary.trim().length < 60}
          onClick={() => {
            submitCapstone({
              capstoneId: capstone.id,
              nodeIds: capstone.nodeIds,
              summary: summary.trim(),
              rubricScore,
              rubric,
            });
            onClose();
          }}
          className={primaryButtonClass}
        >
          Submit capstone
        </button>

        <Caveat>
          A capstone carries more weight in the competence model than anything else, which is
          why it asks for a real artifact and a rubric rather than a checkbox. Neuron cannot
          verify any of it — the honesty of this record is entirely yours, and it is the part
          that determines whether your own numbers mean anything in a year.
        </Caveat>
      </div>
    </Sheet>
  );
}
