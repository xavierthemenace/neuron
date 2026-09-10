"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSetting, putSetting, type CoachSettings } from "@/lib/db";
import type { ConceptNode, IntelligenceData } from "@/lib/types";
import { useDismissable } from "./useDismissable";

const DEFAULT_SETTINGS: CoachSettings = {
  provider: "ollama",
  endpoint: "http://localhost:11434/api/chat",
  model: "llama3.2",
};

function nodeContext(node: ConceptNode | undefined): string {
  if (!node) return "No faculty selected.";
  return `${node.label}: ${node.description}\nWhy it matters: ${node.why}\nAvailable exercises: ${node.exercises.map((exercise) => exercise.label).join("; ")}`;
}

async function requestCoach(
  settings: CoachSettings,
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
  if (settings.apiKey?.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
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
}: {
  data: IntelligenceData;
  selectedNode: ConceptNode | null;
  onSelectNode: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<CoachSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<"exercise" | "connection">("exercise");
  const [goal, setGoal] = useState("");
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);

  useDismissable({
    open,
    onClose: () => setOpen(false),
    modal: true,
    container: dialogRef,
  });

  // The launcher unmounts while the dialog is up, so the generic focus-restore
  // in useDismissable has nothing to return to and focus would fall to <body>,
  // making Tab restart from the top of the page. Re-focus the button once it
  // comes back.
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    void getSetting<CoachSettings>("coach-settings")
      .then((stored) => {
        if (stored) setSettings({ ...DEFAULT_SETTINGS, ...stored });
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

  async function saveSettings(next: CoachSettings) {
    setSettings(next);
    await putSetting("coach-settings", next);
  }

  async function ask() {
    setLoading(true);
    setError(null);
    setAnswer("");
    try {
      const system =
        "You are Neuron's cognitive training coach. Be concrete, evidence-aware, concise, and practical. Never claim a user completed a task. Create exercises that require actual effort and explain cognitive transfer without pseudoscientific certainty.";
      const prompt =
        mode === "exercise"
          ? `Create one custom, self-contained training exercise for this faculty. User goal/context: ${goal || "general improvement"}.\n\nFaculty context:\n${nodeContext(first)}\n\nGive: objective, exact steps, success criteria, suggested duration, and one harder variation.`
          : `Explain how these two faculties can interact and design one exercise that trains their connection. Avoid overstating causality.\n\nFaculty A:\n${nodeContext(first)}\n\nFaculty B:\n${nodeContext(second)}\n\nUser goal/context: ${goal || "general cognitive development"}`;
      setAnswer(await requestCoach(settings, system, prompt));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The coach request failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto absolute bottom-14 left-16 z-30 rounded-full border border-violet-200/15 bg-[oklch(0.13_0.025_295_/_0.92)] px-3 py-2 text-[10px] font-medium text-violet-50/80 shadow-xl backdrop-blur-xl transition-colors hover:border-violet-200/30 hover:text-white md:bottom-4 md:left-[11.5rem]"
      >
        AI Coach
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="AI cognitive coach" className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/12 bg-[oklch(0.14_0.018_265_/_0.985)] shadow-2xl">
        <header className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white">AI Coach</h2>
            <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
              Optional. Ollama can stay entirely on your machine; OpenAI-compatible mode sends only the prompt you explicitly submit to your configured endpoint.
            </p>
          </div>
          <button type="button" onClick={() => setSettingsOpen((value) => !value)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-neutral-400 hover:text-white">Settings</button>
          <button type="button" onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-lg text-neutral-500 hover:bg-white/7 hover:text-white" aria-label="Close AI Coach">×</button>
        </header>

        {settingsOpen && (
          <div className="grid gap-3 border-b border-white/8 bg-black/15 p-4 sm:grid-cols-2">
            <label className="text-[10px] text-neutral-500">Provider
              <select
                value={settings.provider}
                onChange={(event) => {
                  const provider = event.target.value as CoachSettings["provider"];
                  const endpoint = provider === "ollama" ? "http://localhost:11434/api/chat" : "https://api.openai.com/v1/chat/completions";
                  void saveSettings({ ...settings, provider, endpoint });
                }}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-neutral-200 outline-none"
              >
                <option value="ollama">Ollama (local)</option>
                <option value="openai-compatible">OpenAI-compatible endpoint</option>
              </select>
            </label>
            <label className="text-[10px] text-neutral-500">Model
              <input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} onBlur={() => void saveSettings(settings)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-neutral-200 outline-none" />
            </label>
            <label className="text-[10px] text-neutral-500 sm:col-span-2">Endpoint
              <input value={settings.endpoint} onChange={(event) => setSettings({ ...settings, endpoint: event.target.value })} onBlur={() => void saveSettings(settings)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 font-mono text-[11px] text-neutral-200 outline-none" />
            </label>
            {settings.provider === "openai-compatible" && (
              <label className="text-[10px] text-neutral-500 sm:col-span-2">API key (stored locally in IndexedDB)
                <input type="password" value={settings.apiKey ?? ""} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} onBlur={() => void saveSettings(settings)} placeholder="Optional if your endpoint does not require one" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-neutral-200 outline-none" />
              </label>
            )}
          </div>
        )}

        <div className="p-5">
          <div className="flex gap-1 rounded-xl border border-white/8 bg-black/20 p-1">
            <button type="button" onClick={() => setMode("exercise")} className={`flex-1 rounded-lg px-3 py-2 text-xs ${mode === "exercise" ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300"}`}>Generate exercise</button>
            <button type="button" onClick={() => setMode("connection")} className={`flex-1 rounded-lg px-3 py-2 text-xs ${mode === "connection" ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300"}`}>Explain connection</button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] text-neutral-500">Faculty {mode === "connection" ? "A" : ""}
              <select value={firstId || selectedNode?.id || ""} onChange={(event) => { setFirstId(event.target.value); onSelectNode(event.target.value); }} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-neutral-200 outline-none">
                <option value="">Choose a faculty</option>
                {data.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
              </select>
            </label>
            {mode === "connection" && (
              <label className="text-[10px] text-neutral-500">Faculty B
                <select value={secondId} onChange={(event) => setSecondId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-neutral-200 outline-none">
                  <option value="">Choose a second faculty</option>
                  {data.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
                </select>
              </label>
            )}
          </div>

          <label className="mt-3 block text-[10px] text-neutral-500">Real-world goal or constraint
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="e.g. Use chess tactics, prepare for technical interviews, practice during a commute…" className="mt-1 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-neutral-200 outline-none placeholder:text-neutral-650 focus:border-white/25" />
          </label>

          <button type="button" disabled={loading || !first || (mode === "connection" && !second)} onClick={() => void ask()} className="mt-3 rounded-lg border border-violet-200/20 bg-violet-200/10 px-3 py-2 text-xs font-medium text-violet-50 transition-colors hover:bg-violet-200/15 disabled:cursor-not-allowed disabled:opacity-40">
            {loading ? "Thinking…" : mode === "exercise" ? "Generate custom exercise" : "Synthesize connection"}
          </button>

          {error && <div className="mt-4 rounded-xl border border-red-300/15 bg-red-300/[0.05] p-3 text-xs text-red-200/80">{error}<div className="mt-1 text-[10px] text-red-200/45">For local Ollama, browser CORS must allow this app origin.</div></div>}
          {answer && <div className="mt-4 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-4 text-[13px] leading-relaxed text-neutral-300">{answer}</div>}
        </div>
      </section>
    </div>
  );
}
