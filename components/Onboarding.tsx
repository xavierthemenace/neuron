"use client";

import { useEffect, useMemo, useState } from "react";
import { getSetting, putSetting } from "@/lib/db";
import { nodesById, paths } from "@/lib/curriculum";
import { buildDemoProgress } from "@/lib/demo";
import { seedNodesForPhrase, suggestPaths } from "@/lib/goals";
import { useProgress } from "./ProgressProvider";
import {
  Caveat,
  Chip,
  Field,
  Sheet,
  buttonClass,
  inputClass,
  primaryButtonClass,
} from "./ui";

const SETTING_KEY = "onboarding-complete-v2";

/**
 * Onboarding.
 *
 * Dropping someone onto 139 nodes with no context is how a capability map
 * becomes a thing people open once. Four short steps: what the map is, what
 * you want, what the numbers mean, and three places to start. Skippable at
 * every step, and it never runs again once dismissed.
 */
export function Onboarding({
  onSelectNode,
  onOpenMap,
  onRunProbe,
}: {
  onSelectNode: (id: string) => void;
  onOpenMap: () => void;
  onRunProbe: (probeId: string) => void;
}) {
  const { progress, hydrated, addGoal, replaceProgress } = useProgress();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [phrase, setPhrase] = useState("");
  const [chosenPathId, setChosenPathId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    // Anyone with history has already been here; never interrupt them.
    if (progress.logs.length > 0 || progress.goals.length > 0) return;
    void getSetting<boolean>(SETTING_KEY)
      .then((done) => {
        if (!done) setOpen(true);
      })
      .catch(() => setOpen(true));
  }, [hydrated, progress.logs.length, progress.goals.length]);

  const finish = () => {
    void putSetting(SETTING_KEY, true).catch(() => undefined);
    setOpen(false);
  };

  const suggestions = useMemo(() => suggestPaths(phrase), [phrase]);
  const chosenPath = chosenPathId ? paths.find((path) => path.id === chosenPathId) : null;

  const starters = useMemo(() => {
    if (chosenPath) return chosenPath.nodeIds.slice(0, 5);
    if (phrase.trim()) return seedNodesForPhrase(phrase).nodeIds.slice(0, 5);
    // A defensible default for someone with no stated goal: the three
    // best-evidenced techniques in the whole curriculum, plus the two things
    // that gate everything else.
    return [
      "gc-retrieval-practice",
      "gc-spaced-repetition",
      "eqr-recovery",
      "intra-attention",
      "dec-calibration",
    ];
  }, [chosenPath, phrase]);

  if (!open) return null;

  return (
    <Sheet
      open
      onClose={finish}
      title="Neuron"
      closeLabel="Close the welcome"
      subtitle="A map of trainable cognitive capability, and an honest record of what you can actually do."
      footer={
        <div className="flex items-center justify-between gap-3">
          <span>Step {step + 1} of 4</span>
          <div className="flex items-center gap-4">
            {/* An empty app is the honest first state and a terrible first
                impression. This is the way out of that without lying. */}
            <button
              type="button"
              onClick={() => {
                replaceProgress(buildDemoProgress());
                finish();
              }}
              className="underline hover:text-neutral-300"
            >
              Show me an example first
            </button>
            <button type="button" onClick={finish} className="underline hover:text-neutral-300">
              Skip setup
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-neutral-200">
              The map holds 139 capabilities grouped into clusters. Lines between them are
              relationships: solid lines are dependencies, dashed lines are looser
              connections, and faded lines mean the evidence for that relationship is weak.
            </p>
            <p className="text-[13px] leading-relaxed text-neutral-300">
              You do not have to learn the map. Most days you will open Today, which shows
              one thing to do and what is going stale underneath it. The map is there for
              when you want to see how things connect.
            </p>
            <Caveat>
              This is not a brain-training app. Practising here trains specific, named skills.
              There is no credible evidence that any of it raises general intelligence, and
              Neuron will keep telling you so at the point where it matters.
            </Caveat>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-neutral-200">
              What would you like to be better at? A goal changes how every recommendation is
              ranked. You can skip this and add one later.
            </p>
            <input
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              placeholder="e.g. make better decisions, write more clearly, stop procrastinating"
              className={inputClass}
              aria-label="Your goal"
              autoFocus
            />
            {suggestions.length > 0 && (
              <div className="space-y-1.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.path.id}
                    type="button"
                    onClick={() => setChosenPathId(suggestion.path.id)}
                    aria-pressed={chosenPathId === suggestion.path.id}
                    className={[
                      "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                      chosenPathId === suggestion.path.id
                        ? "border-cyan-300/40 bg-cyan-300/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25",
                    ].join(" ")}
                  >
                    <span className="block text-xs font-medium text-neutral-100">
                      {suggestion.path.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-relaxed text-neutral-500">
                      <span className="text-neutral-400">Done when: </span>
                      {suggestion.path.outcome}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {phrase.trim() && suggestions.length === 0 && (
              <p className="text-[11px] text-neutral-500">
                No curated path matched that phrasing. That is fine — Neuron will search the
                map for matching capabilities instead.
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-neutral-200">
              Neuron keeps four numbers per capability, and they are deliberately different
              things:
            </p>
            <dl className="space-y-2.5">
              {(
                [
                  [
                    "Practice",
                    "How much you have done. This is the XP number, and it goes up whenever you log anything. It is a progression signal, not a measure of ability.",
                  ],
                  [
                    "Competence",
                    "An estimate of what you can actually do. It only moves on things that could have gone badly: scored probes, judged work, finished missions, capstones. A hundred self-reported ticks barely move it.",
                  ],
                  [
                    "Retention",
                    "How much would survive a test right now. Different capabilities forget differently — facts, motor fluency, habits and physical capacity each get their own model.",
                  ],
                  [
                    "Confidence",
                    "How much the competence number deserves to be believed. It is capped by how measurable the capability is at all, so some nodes can never show high confidence no matter what you do.",
                  ],
                ] as const
              ).map(([term, definition]) => (
                <div key={term} className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                  <dt className="text-xs font-medium text-neutral-100">{term}</dt>
                  <dd className="mt-0.5 text-[11px] leading-relaxed text-neutral-400">
                    {definition}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-neutral-200">
              {chosenPath
                ? `Starting points on ${chosenPath.label}:`
                : phrase.trim()
                  ? "Capabilities that match what you described:"
                  : "With no goal stated, these are a defensible default — the best-evidenced learning techniques in the curriculum, plus the two things that gate almost everything else."}
            </p>
            <div className="space-y-1.5">
              {starters.map((id) => {
                const node = nodesById.get(id);
                if (!node) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onSelectNode(id);
                      finish();
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-white/25 hover:bg-white/[0.05]"
                  >
                    <span className="block text-xs font-medium text-neutral-100">
                      {node.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-relaxed text-neutral-500">
                      {node.why}
                    </span>
                  </button>
                );
              })}
            </div>

            <Field
              label="Optional: take a baseline"
              hint="A first diagnostic becomes the thing every later run is compared against. Without one, nothing here is objectively measured."
            >
              <div className="flex flex-wrap gap-1.5">
                <Chip
                  onClick={() => {
                    onRunProbe("probe-calibration");
                    finish();
                  }}
                >
                  Calibration
                </Chip>
                <Chip
                  onClick={() => {
                    onRunProbe("probe-reasoning-series");
                    finish();
                  }}
                >
                  Reasoning
                </Chip>
                <Chip
                  onClick={() => {
                    onRunProbe("probe-wm-manipulation");
                    finish();
                  }}
                >
                  Working memory
                </Chip>
              </div>
            </Field>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-white/8 pt-4">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className={buttonClass}>
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && (chosenPath || phrase.trim())) {
                  const seed = chosenPath
                    ? { nodeIds: chosenPath.nodeIds, pathId: chosenPath.id }
                    : seedNodesForPhrase(phrase);
                  if (seed.nodeIds.length > 0) {
                    addGoal({
                      label: chosenPath?.label ?? phrase.trim(),
                      motivation: phrase.trim() || undefined,
                      nodeIds: seed.nodeIds,
                      pathId: seed.pathId,
                      weeklyMinutes: 90,
                    });
                  }
                }
                setStep(step + 1);
              }}
              className={`${primaryButtonClass} ml-auto`}
            >
              {step === 1 && !phrase.trim() && !chosenPath ? "Skip this" : "Continue"}
            </button>
          ) : (
            <div className="ml-auto flex gap-2">
              {/* Finishing lands on Today, which has a session in it. The map
                  is worth seeing but it is not a place to start. */}
              <button
                type="button"
                onClick={() => {
                  finish();
                  onOpenMap();
                }}
                className={buttonClass}
              >
                Look at the map first
              </button>
              <button type="button" onClick={finish} className={primaryButtonClass}>
                Start
              </button>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
