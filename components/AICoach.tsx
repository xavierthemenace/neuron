"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { assembleContext, buildContextSections } from "@/lib/coach-context";
import { getJournal, getSetting, putSetting, EMPTY_COACH_CONSENT } from "@/lib/db";
import type { CoachConsent, CoachSettings } from "@/lib/db";
import { newId } from "@/lib/storage";
import type { ConceptNode, IntelligenceData } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import { useDismissable } from "./useDismissable";
import {
  Caveat,
  Chip,
  Field,
  Section,
  buttonClass,
  inputClass,
  primaryButtonClass,
} from "./ui";

/**
 * The AI coach.
 *
 * Three constraints shape this component:
 *
 * 1. Nothing personal leaves the device without an explicit, per-category
 *    consent, and the exact payload is shown before sending. Not a description
 *    of it — the string itself.
 * 2. Remote API keys are session-only by default. IndexedDB is readable by any
 *    script on this origin and survives until the profile is wiped; persisting
 *    a credential there is a decision the user has to make on purpose.
 * 3. Nothing the model produces can award XP or move a competence estimate. An
 *    AI-generated exercise is a draft until the user promotes it, and even then
 *    it becomes a personal exercise they have to actually do.
 */

const DEFAULT_SETTINGS: CoachSettings = {
  provider: "ollama",
  endpoint: "http://localhost:11434/api/chat",
  model: "llama3.2",
  persistKey: false,
};

const SESSION_KEY_STORAGE = "neuron.coach.key";

type Mode = "exercise" | "connection" | "critique" | "misconception" | "diagnostic";

const MODES: { id: Mode; label: string; blurb: string; needsSecond?: boolean }[] = [
  {
    id: "exercise",
    label: "Design an exercise",
    blurb: "A concrete, checkable task at the difficulty you are actually at.",
  },
  {
    id: "connection",
    label: "Explain a connection",
    blurb: "How two capabilities interact, and what would train the link.",
    needsSecond: true,
  },
  {
    id: "critique",
    label: "Critique my work",
    blurb: "Specific problems with what you wrote, not encouragement.",
  },
  {
    id: "misconception",
    label: "Find my misconceptions",
    blurb: "What your recent work suggests you have quietly got wrong.",
  },
  {
    id: "diagnostic",
    label: "Write diagnostic questions",
    blurb: "Items that would discriminate between understanding and recognition.",
  },
];

const SYSTEM_PROMPT = [
  "You are Neuron's cognitive training coach.",
  "Be concrete, specific and brief. Prefer a checkable task over an explanation of a task.",
  "Never claim the user completed anything, and never award or imply points, XP or mastery.",
  "Do not claim that training one skill raises general intelligence; where transfer is uncertain, say so.",
  "If the context you were given is insufficient to answer well, say what is missing rather than guessing.",
  "Do not flatter. If the user's work has a problem, name it plainly.",
].join(" ");

function buildPrompt(
  mode: Mode,
  context: string,
  goal: string,
  first: ConceptNode | undefined,
  second: ConceptNode | undefined,
): string {
  const header = `# Context\n${context}\n\n# Request\n`;
  const constraint = goal.trim() ? `\nUser's stated constraint: ${goal.trim()}` : "";

  switch (mode) {
    case "exercise":
      return `${header}Design one self-contained training exercise for "${first?.label ?? "the selected capability"}". Give: objective, exact steps, a success criterion someone else could check, suggested duration, and one harder variation. Do not restate the capability's description back to me.${constraint}`;
    case "connection":
      return `${header}Explain how "${first?.label}" and "${second?.label}" actually interact, by what mechanism, and design one exercise that trains the connection rather than either endpoint. Be explicit about whether the interaction is well evidenced or speculative.${constraint}`;
    case "critique":
      return `${header}Critique the work shown in the context above. Name the three most significant problems, in order, with a specific fix for each. Do not summarise what I wrote back to me, and do not open with praise.${constraint}`;
    case "misconception":
      return `${header}Based on the work and scores above, identify the misconceptions or systematic errors my output suggests I hold. For each, state the evidence in my work that points to it and a test that would confirm or rule it out.${constraint}`;
    case "diagnostic":
      return `${header}Write five diagnostic questions for "${first?.label ?? "the selected capability"}" that discriminate between real understanding and surface recognition. For each: the question, the correct answer, and the specific misconception a wrong answer would reveal.${constraint}`;
  }
}

async function requestCoach(
  settings: CoachSettings,
  apiKey: string,
  system: string,
  prompt: string,
): Promise<string> {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];

  if (settings.provider === "ollama") {
    const response = await fetch(settings.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: settings.model, messages, stream: false }),
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const payload = (await response.json()) as { message?: { content?: string } };
    const text = payload.message?.content?.trim();
    if (!text) throw new Error("Ollama returned an empty response");
    return text;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  const response = await fetch(settings.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: settings.model, messages, temperature: 0.7 }),
  });
  if (!response.ok) throw new Error(`AI endpoint returned ${response.status}`);
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("AI endpoint returned an empty response");
  return text;
}

export function AICoach({
  data,
  selectedNode,
  onSelectNode,
  researchMode,
}: {
  data: IntelligenceData;
  selectedNode: ConceptNode | null;
  onSelectNode: (id: string) => void;
  researchMode: boolean;
}) {
  const model = useProgress();
  const { progress, addPersonalNode, updatePersonalNode } = model;

  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<CoachSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState(() => {
    // Lazy initialiser rather than an effect: setting this from an effect
    // schedules a second render on every mount for a value that is already
    // available synchronously.
    try {
      return window.sessionStorage.getItem(SESSION_KEY_STORAGE) ?? "";
    } catch {
      // Private modes can block sessionStorage; the key stays in memory.
      return "";
    }
  });
  const [consent, setConsent] = useState<CoachConsent>(EMPTY_COACH_CONSENT);
  const [mode, setMode] = useState<Mode>("exercise");
  const [goal, setGoal] = useState("");
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const [journal, setJournal] = useState<{ nodeId: string; markdown: string } | null>(
    null,
  );
  const [answer, setAnswer] = useState("");
  const [showPayload, setShowPayload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoted, setPromoted] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);

  useDismissable({ open, onClose: () => setOpen(false), modal: true, container: dialogRef });

  // The launcher unmounts while the dialog is up, so the generic focus-restore
  // in useDismissable has nothing to return to and focus would fall to <body>.
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    void getSetting<CoachSettings>("coach-settings")
      .then((stored) => {
        if (!stored) return;
        setSettings({ ...DEFAULT_SETTINGS, ...stored });
        if (stored.persistKey && stored.apiKey) setApiKey(stored.apiKey);
      })
      .catch(() => undefined);
    void getSetting<CoachConsent>("coach-context-consent")
      .then((stored) => {
        if (stored) setConsent({ ...EMPTY_COACH_CONSENT, ...stored });
      })
      .catch(() => undefined);
  }, []);

  const first = useMemo(
    () => data.nodes.find((node) => node.id === (firstId || selectedNode?.id)),
    [data.nodes, firstId, selectedNode],
  );
  const second = useMemo(
    () => data.nodes.find((node) => node.id === secondId),
    [data.nodes, secondId],
  );

  // The journal is only read once the user has consented to sending it. The
  // fetched value is stored alongside the node it came from and the excerpt is
  // derived, so switching nodes cannot briefly show the previous node's text
  // and no effect has to synchronously clear state.
  useEffect(() => {
    if (!consent.journal || !first) return;
    let cancelled = false;
    void getJournal(first.id)
      .then((record) => {
        if (!cancelled) setJournal({ nodeId: first.id, markdown: record?.markdown ?? "" });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [consent.journal, first]);

  const journalExcerpt =
    consent.journal && first && journal?.nodeId === first.id ? journal.markdown : null;

  const sections = useMemo(
    () => buildContextSections(model, progress, first ?? null, journalExcerpt),
    [model, progress, first, journalExcerpt],
  );
  const { text: contextText, included } = useMemo(
    () => assembleContext(sections, consent),
    [sections, consent],
  );
  const prompt = useMemo(
    () => buildPrompt(mode, contextText, goal, first, second),
    [mode, contextText, goal, first, second],
  );

  const isLocal = settings.provider === "ollama";
  const sensitiveIncluded = included.filter((section) => section.sensitive);

  async function saveSettings(next: CoachSettings) {
    setSettings(next);
    // The key is written to disk only when persistence is explicitly on.
    const { apiKey: _dropped, ...rest } = next;
    void _dropped;
    await putSetting("coach-settings", next.persistKey ? next : rest);
  }

  function updateKey(value: string) {
    setApiKey(value);
    if (settings.persistKey) {
      void putSetting("coach-settings", { ...settings, apiKey: value });
      return;
    }
    try {
      window.sessionStorage.setItem(SESSION_KEY_STORAGE, value);
    } catch {
      // Memory-only is an acceptable fallback.
    }
  }

  function setConsentKey(key: keyof CoachConsent, value: boolean) {
    const next = { ...consent, [key]: value };
    setConsent(next);
    void putSetting("coach-context-consent", next).catch(() => undefined);
  }

  async function ask() {
    setLoading(true);
    setError(null);
    setAnswer("");
    setPromoted(false);
    try {
      setAnswer(await requestCoach(settings, apiKey, SYSTEM_PROMPT, prompt));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The coach request failed");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Promotion: an accepted exercise becomes a personal exercise on a personal
   * node, never an exercise on a canonical one. The core curriculum stays a
   * reviewed artifact; generated content lives where it belongs, alongside the
   * user's own additions, and still has to be done to count for anything.
   */
  function promote() {
    if (!answer.trim() || !first) return;
    const label = `AI drafted for ${first.label}: ${answer.trim().split("\n")[0].slice(0, 90)}`;
    const existing = progress.personalNodes.find(
      (node) => node.packId === "ai-drafts" && node.linkedNodeIds.includes(first.id),
    );

    const exercise = {
      id: `personal-ex-${newId()}`,
      label,
      xp: 15,
      cadence: "weekly" as const,
      difficulty: 3 as const,
      evidence: "artifact" as const,
      minutes: 30,
    };

    if (existing) {
      updatePersonalNode(existing.id, {
        exercises: [...existing.exercises, exercise],
        notes: `${existing.notes ?? ""}\n\n---\n${answer.trim()}`.trim(),
      });
    } else {
      addPersonalNode({
        label: `AI drafts · ${first.label}`,
        description: `Exercises drafted by the AI coach for ${first.label} and kept because you accepted them.`,
        kind: first.kind ?? "competency",
        linkedNodeIds: [first.id],
        packId: "ai-drafts",
        notes: answer.trim(),
        exercises: [exercise],
      });
    }
    setPromoted(true);
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto absolute bottom-[72px] left-14 z-30 min-h-[44px] rounded-full border border-violet-200/15 bg-[rgb(255_255_255_/_0.93)] px-3.5 py-2 text-[11px] font-medium text-violet-50/85 shadow-xl backdrop-blur-xl transition-colors hover:border-violet-200/30 hover:text-white md:bottom-4 md:left-14"
      >
        AI Coach
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-[rgb(25_22_20_/_0.34)] p-3 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI cognitive coach"
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/12 bg-[rgb(255_255_255_/_0.985)] shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white">AI Coach</h2>
            <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
              {isLocal
                ? "Ollama: requests go to your own machine and nothing leaves it."
                : "Remote endpoint: everything you consent to below is sent to a third party."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen((value) => !value)}
            className={buttonClass}
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-white/7 hover:text-white"
            aria-label="Close AI Coach"
          >
            ×
          </button>
        </header>

        {settingsOpen && (
          <div className="grid gap-3 border-b border-white/8 bg-black/15 p-4 sm:grid-cols-2">
            <Field label="Provider">
              <select
                value={settings.provider}
                onChange={(event) => {
                  const provider = event.target.value as CoachSettings["provider"];
                  const endpoint =
                    provider === "ollama"
                      ? "http://localhost:11434/api/chat"
                      : "https://api.openai.com/v1/chat/completions";
                  void saveSettings({ ...settings, provider, endpoint });
                }}
                className={inputClass}
              >
                <option value="ollama">Ollama (local — strongest privacy)</option>
                <option value="openai-compatible">OpenAI-compatible endpoint</option>
              </select>
            </Field>
            <Field label="Model">
              <input
                value={settings.model}
                onChange={(event) => setSettings({ ...settings, model: event.target.value })}
                onBlur={() => void saveSettings(settings)}
                className={inputClass}
              />
            </Field>
            <Field label="Endpoint">
              <input
                value={settings.endpoint}
                onChange={(event) => setSettings({ ...settings, endpoint: event.target.value })}
                onBlur={() => void saveSettings(settings)}
                className={`${inputClass} font-mono text-[11px]`}
              />
            </Field>

            {settings.provider === "openai-compatible" && (
              <div className="sm:col-span-2">
                <Field
                  label="API key"
                  hint={
                    settings.persistKey
                      ? "Stored in IndexedDB. Any script on this origin can read it, and it survives until you clear site data."
                      : "Held for this tab only. Closing the tab discards it — this is the default and the safer option."
                  }
                >
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => updateKey(event.target.value)}
                    placeholder="Optional if your endpoint does not require one"
                    className={inputClass}
                    autoComplete="off"
                  />
                </Field>
                <label className="mt-2 flex items-start gap-2 text-[10px] leading-relaxed text-neutral-400">
                  <input
                    type="checkbox"
                    checked={settings.persistKey ?? false}
                    onChange={(event) => {
                      const persistKey = event.target.checked;
                      void saveSettings({
                        ...settings,
                        persistKey,
                        apiKey: persistKey ? apiKey : undefined,
                      });
                      if (!persistKey) {
                        try {
                          window.sessionStorage.setItem(SESSION_KEY_STORAGE, apiKey);
                        } catch {
                          // Memory-only fallback.
                        }
                      }
                    }}
                    className="mt-0.5 accent-amber-300"
                  />
                  <span>
                    Remember this key on disk. The browser offers no encrypted credential store
                    a page can use, so &quot;remembered&quot; means plaintext in IndexedDB.
                    Leave this off unless retyping the key is genuinely impractical.
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        <div className="space-y-5 p-5">
          <div className="grid gap-1 sm:grid-cols-5">
            {MODES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setMode(entry.id)}
                aria-pressed={mode === entry.id}
                className={[
                  "rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors",
                  mode === entry.id
                    ? "bg-white/10 text-white"
                    : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300",
                ].join(" ")}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-neutral-500">
            {MODES.find((entry) => entry.id === mode)?.blurb}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={mode === "connection" ? "Capability A" : "Capability"}>
              <select
                value={firstId || selectedNode?.id || ""}
                onChange={(event) => {
                  setFirstId(event.target.value);
                  if (event.target.value) onSelectNode(event.target.value);
                }}
                className={inputClass}
              >
                <option value="">Choose a capability</option>
                {data.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label}
                  </option>
                ))}
              </select>
            </Field>
            {mode === "connection" && (
              <Field label="Capability B">
                <select
                  value={secondId}
                  onChange={(event) => setSecondId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose a second capability</option>
                  {data.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <Field label="Real-world constraint" hint="Optional, and usually what makes the answer useful.">
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={2}
              placeholder="e.g. I have 20 minutes on a train, no notebook"
              className={`${inputClass} resize-y`}
            />
          </Field>

          <Section
            title="What gets sent"
            hint={
              isLocal
                ? "Ollama runs on your machine, so this stays local. The consents still apply."
                : "Nothing here is sent unless you switch it on. Default is off, every time."
            }
          >
            <div className="space-y-1.5">
              {sections.length === 0 && (
                <p className="text-[11px] text-neutral-600">
                  Select a capability to see what context is available.
                </p>
              )}
              {sections.map((section) => (
                <label
                  key={section.key}
                  className="flex items-start gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={consent[section.key]}
                    onChange={(event) => setConsentKey(section.key, event.target.checked)}
                    className="mt-0.5 accent-cyan-300"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-neutral-200">
                        {section.label}
                      </span>
                      {section.sensitive && <Chip tone="warn">personal</Chip>}
                      <span className="text-[9px] tabular-nums text-neutral-600">
                        {section.size} chars
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-relaxed text-neutral-500">
                      {section.rationale}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowPayload((value) => !value)}
              className="mt-2 rounded text-[10px] text-neutral-500 underline decoration-dotted underline-offset-2 hover:text-neutral-200"
            >
              {showPayload ? "Hide" : "Show"} the exact text that will be sent
            </button>
            {showPayload && (
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-white/8 bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-neutral-400">
                {prompt}
              </pre>
            )}
          </Section>

          {!isLocal && sensitiveIncluded.length > 0 && (
            <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.05] px-3 py-2.5 text-[11px] leading-relaxed text-amber-50/85">
              This request will send {sensitiveIncluded.length} personal section
              {sensitiveIncluded.length === 1 ? "" : "s"} (
              {sensitiveIncluded.map((section) => section.label.toLowerCase()).join(", ")}) to{" "}
              <span className="font-mono">{new URL(settings.endpoint).host}</span>. Once sent,
              it is out of your control and may be retained or used for training depending on
              that provider&apos;s terms.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading || !first || (mode === "connection" && !second)}
              onClick={() => void ask()}
              className={primaryButtonClass}
            >
              {loading ? "Thinking…" : isLocal ? "Ask (local)" : "Send to endpoint"}
            </button>
            {answer && (
              <button type="button" onClick={() => setAnswer("")} className={buttonClass}>
                Discard
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-300/15 bg-red-300/[0.05] p-3 text-xs text-red-200/80">
              {error}
              <div className="mt-1 text-[10px] text-red-200/45">
                For local Ollama, its CORS policy must allow this origin
                (OLLAMA_ORIGINS).
              </div>
            </div>
          )}

          {answer && (
            <div className="space-y-3">
              <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-4 text-[13px] leading-relaxed text-neutral-300">
                {answer}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={promote}
                  disabled={promoted}
                  className={buttonClass}
                >
                  {promoted ? "Kept ✓" : "Keep as a personal exercise"}
                </button>
                <button type="button" onClick={() => void ask()} className={buttonClass}>
                  Regenerate
                </button>
              </div>
              <Caveat>
                This is a draft and nothing more. It has awarded no XP and moved no competence
                estimate, and it will not until you do the work and log it yourself. Keeping it
                files it under your personal capabilities — the reviewed core curriculum is not
                modified by generated content.
              </Caveat>
            </div>
          )}

          {researchMode && (
            <Caveat>
              Research mode: system prompt is {SYSTEM_PROMPT.length} characters, context is{" "}
              {contextText.length}, total request {prompt.length + SYSTEM_PROMPT.length}.
              Provider {settings.provider}, model {settings.model}. Key is{" "}
              {settings.persistKey ? "persisted to IndexedDB" : "session-only"}.
            </Caveat>
          )}
        </div>
      </section>
    </div>
  );
}
