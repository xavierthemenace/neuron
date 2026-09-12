"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildProbeRun,
  probeHistory,
  scoreProbe,
  type ItemScore,
  type ProbeItem,
  type ProbeRun,
  type RotationStimulus,
} from "@/lib/diagnostics";
import type { Difficulty } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import { Caveat, Chip, Field, Sheet, buttonClass, inputClass, primaryButtonClass } from "./ui";

/**
 * The diagnostic runner.
 *
 * Runs one short probe, scores it, and shows the result only against the user's
 * own previous runs. Deliberately austere: a probe that feels like a game
 * invites the strategising that makes the score meaningless.
 */

function RotationShape({ cells, size = 68 }: { cells: [number, number][]; size?: number }) {
  const maxX = Math.max(...cells.map(([x]) => x)) + 1;
  const maxY = Math.max(...cells.map(([, y]) => y)) + 1;
  const unit = size / Math.max(maxX, maxY, 3);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${Math.max(maxX, maxY, 3) * unit} ${Math.max(maxX, maxY, 3) * unit}`}
      aria-hidden="true"
      className="shrink-0"
    >
      {cells.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x * unit + 1}
          y={y * unit + 1}
          width={unit - 2}
          height={unit - 2}
          rx={2}
          fill="oklch(0.68 0.13 240)"
          stroke="oklch(0.85 0.1 240)"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

function ItemView({
  item,
  value,
  onChange,
  revealed,
}: {
  item: ProbeItem;
  value: string;
  onChange: (value: string) => void;
  revealed: boolean;
}) {
  // The parent keys this component by item id, so each item mounts fresh and
  // the stimulus starts visible without an effect having to reset it.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!item.exposureMs) return;
    const timer = setTimeout(() => setHidden(true), item.exposureMs);
    return () => clearTimeout(timer);
  }, [item.exposureMs]);

  const rotation = useMemo<RotationStimulus | null>(() => {
    if (!item.stimulus || !item.stimulus.startsWith("{")) return null;
    try {
      return JSON.parse(item.stimulus) as RotationStimulus;
    } catch {
      return null;
    }
  }, [item.stimulus]);

  return (
    <div className="space-y-3">
      {rotation && (
        <div className="flex items-center justify-center gap-6 rounded-xl border border-white/8 bg-[rgb(25_22_20_/_0.035)] p-4">
          <RotationShape cells={rotation.cells} />
          <span className="text-neutral-600" aria-hidden="true">
            vs
          </span>
          <RotationShape cells={rotation.rotatedCells} />
        </div>
      )}

      {item.stimulus && !rotation && (
        <div
          className="rounded-xl border border-white/8 bg-[rgb(25_22_20_/_0.035)] p-4 text-center font-mono text-lg tracking-[0.35em] text-neutral-100"
          aria-live="polite"
        >
          {hidden ? (
            <span className="text-[11px] tracking-normal text-neutral-600">
              (hidden — answer from memory)
            </span>
          ) : (
            item.stimulus
          )}
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-neutral-200">{item.prompt}</p>

      {item.kind === "choice" && item.options && (
        <div className="grid gap-1.5">
          {item.options.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(String(index))}
              aria-pressed={value === String(index)}
              className={[
                "rounded-lg border px-3 py-2.5 text-left text-xs transition-colors",
                value === String(index)
                  ? "border-cyan-300/40 bg-cyan-300/12 text-cyan-50"
                  : "border-white/10 bg-white/[0.02] text-neutral-300 hover:border-white/25 hover:bg-white/[0.05]",
              ].join(" ")}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {item.kind === "numeric" && (
        <Field label="Your estimate" hint="Scored on order of magnitude. Scientific notation is fine (3e8).">
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
            autoFocus
          />
        </Field>
      )}

      {item.kind === "interval" && (
        <div className="flex gap-2">
          <Field label="Lower bound">
            <input
              type="text"
              inputMode="decimal"
              value={value.split("|")[0] ?? ""}
              onChange={(event) =>
                onChange(`${event.target.value}|${value.split("|")[1] ?? ""}`)
              }
              className={inputClass}
            />
          </Field>
          <Field label="Upper bound">
            <input
              type="text"
              inputMode="decimal"
              value={value.split("|")[1] ?? ""}
              onChange={(event) =>
                onChange(`${value.split("|")[0] ?? ""}|${event.target.value}`)
              }
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {item.kind === "recall" && (
        <Field label="Your answer">
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={`${inputClass} font-mono tracking-widest`}
            autoFocus
            autoComplete="off"
          />
        </Field>
      )}

      {revealed && item.explanation && (
        <p className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-neutral-400">
          {item.explanation}
        </p>
      )}
    </div>
  );
}

export function DiagnosticRunner({
  probeId,
  onClose,
}: {
  probeId: string | null;
  onClose: () => void;
}) {
  const { recordDiagnostic, progress } = useProgress();
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const [run, setRun] = useState<ProbeRun | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; perItem: ItemScore[] } | null>(null);
  const startedAt = useRef<number>(0);
  const itemTimes = useRef<number[]>([]);

  const history = useMemo(
    () => (probeId ? probeHistory(probeId, progress.diagnostics) : null),
    [probeId, progress.diagnostics],
  );

  const reset = useCallback(() => {
    setRun(null);
    setIndex(0);
    setAnswers({});
    setResult(null);
    itemTimes.current = [];
  }, []);

  const start = () => {
    if (!probeId) return;
    const built = buildProbeRun(probeId, difficulty, Date.now());
    if (!built) return;
    setRun(built);
    setIndex(0);
    setAnswers({});
    setResult(null);
    startedAt.current = performance.now();
    itemTimes.current = [];
  };

  const finish = (finalAnswers: Record<string, string>) => {
    if (!run) return;
    const scored = scoreProbe(run, finalAnswers);
    setResult(scored);
    const sorted = [...itemTimes.current].sort((a, b) => a - b);
    const medianMs = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : undefined;
    recordDiagnostic({
      probeId: run.id,
      nodeIds: run.nodeIds,
      score: scored.score,
      difficulty: run.difficulty,
      items: run.items.length,
      medianMs: run.timed ? medianMs : undefined,
      at: new Date().toISOString(),
    });
  };

  const advance = () => {
    if (!run) return;
    itemTimes.current.push(performance.now() - startedAt.current);
    startedAt.current = performance.now();
    if (index + 1 >= run.items.length) finish(answers);
    else setIndex(index + 1);
  };

  if (!probeId) return null;
  const probe = run ?? buildProbeRun(probeId, difficulty, 1);
  if (!probe) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={probe.label}
      subtitle={probe.blurb}
      footer={probe.caveat}
    >
      {!run && (
        <div className="space-y-4">
          <p className="text-[12px] leading-relaxed text-neutral-300">{probe.instructions}</p>

          {history && (
            <p className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-neutral-400">
              {history.summary}
            </p>
          )}

          <Field
            label="Difficulty"
            hint="Compare like with like: a score is only comparable to previous runs at the same difficulty."
          >
            <div className="flex flex-wrap gap-1.5">
              {([1, 2, 3, 4, 5] as Difficulty[]).map((level) => (
                <Chip
                  key={level}
                  tone={difficulty === level ? "active" : "neutral"}
                  pressed={difficulty === level}
                  onClick={() => setDifficulty(level)}
                >
                  L{level}
                </Chip>
              ))}
            </div>
          </Field>

          <button type="button" onClick={start} className={primaryButtonClass}>
            Start · {probe.items.length} items
          </button>

          <Caveat>
            Items are generated fresh each run, so repeating a probe does not mean repeating
            the same questions. It still means getting better at the format, which is why a
            rising score here is evidence about this probe rather than about you.
          </Caveat>
        </div>
      )}

      {run && !result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-cyan-300/70 transition-[width] duration-300"
                style={{ width: `${((index + 1) / run.items.length) * 100}%` }}
              />
            </div>
            <span className="shrink-0 tabular-nums text-[10px] text-neutral-500">
              {index + 1} / {run.items.length}
            </span>
          </div>

          <ItemView
            key={run.items[index].id}
            item={run.items[index]}
            value={answers[run.items[index].id] ?? ""}
            onChange={(value) =>
              setAnswers((current) => ({ ...current, [run.items[index].id]: value }))
            }
            revealed={false}
          />

          <div className="flex gap-2">
            <button type="button" onClick={advance} className={primaryButtonClass}>
              {index + 1 >= run.items.length ? "Finish" : "Next"}
            </button>
            <button
              type="button"
              onClick={() => {
                itemTimes.current.push(performance.now() - startedAt.current);
                startedAt.current = performance.now();
                if (index + 1 >= run.items.length) finish(answers);
                else setIndex(index + 1);
              }}
              className={buttonClass}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {run && result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-2xl font-semibold tabular-nums text-neutral-100">
              {Math.round(result.score * 100)}%
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              {result.perItem.filter((item) => item.correct).length} of {result.perItem.length}{" "}
              correct at difficulty {run.difficulty}.
            </p>
            {/* `progress.diagnostics` already contains this run — recordDiagnostic
                wrote it before this rendered. Appending a copy here counted the
                same result twice and made a first run report a delta against
                itself. */}
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
              {probeHistory(run.id, progress.diagnostics).summary}
            </p>
          </div>

          <ul className="space-y-2">
            {run.items.map((item, itemIndex) => {
              const scored = result.perItem[itemIndex];
              return (
                <li
                  key={item.id}
                  className={[
                    "rounded-lg border px-3 py-2.5",
                    scored.credit >= 0.999
                      ? "border-emerald-300/20 bg-emerald-300/[0.04]"
                      : scored.credit > 0
                        ? "border-amber-300/20 bg-amber-300/[0.04]"
                        : "border-rose-300/15 bg-rose-300/[0.03]",
                  ].join(" ")}
                >
                  <p className="text-[11px] leading-relaxed text-neutral-300">{item.prompt}</p>
                  <p className="mt-1 text-[10px] text-neutral-500">
                    You: {scored.given || "—"} · Correct: {scored.expected}
                    {scored.credit > 0 && scored.credit < 1 && (
                      <span> · partial credit {Math.round(scored.credit * 100)}%</span>
                    )}
                  </p>
                  {item.explanation && (
                    <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
                      {item.explanation}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex gap-2">
            <button type="button" onClick={reset} className={buttonClass}>
              Run again
            </button>
            <button type="button" onClick={onClose} className={primaryButtonClass}>
              Done
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
