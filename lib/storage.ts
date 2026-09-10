import type { LogEntry, Progress } from "./types";

export const STORAGE_KEY = "neuron.progress.v1";

export function emptyProgress(): Progress {
  return { version: 1, logs: [] };
}

/** crypto.randomUUID is unavailable on insecure non-localhost origins. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isLogEntry(value: unknown): value is LogEntry {
  if (!value || typeof value !== "object") return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.id === "string" &&
    typeof l.nodeId === "string" &&
    typeof l.exerciseId === "string" &&
    typeof l.xp === "number" &&
    Number.isFinite(l.xp) &&
    typeof l.at === "string" &&
    !Number.isNaN(Date.parse(l.at))
  );
}

/**
 * Validates unknown input into a Progress. Used for both localStorage reads and
 * file imports, since neither source can be trusted to be well-formed — one may
 * have been written by an older build, the other hand-edited.
 */
export function parseProgress(value: unknown): Progress | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (p.version !== 1) return null;
  if (!Array.isArray(p.logs)) return null;
  return { version: 1, logs: p.logs.filter(isLogEntry) };
}

/** Reads saved progress. Returns empty progress rather than throwing. */
export function loadProgress(): Progress {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    return parseProgress(JSON.parse(raw)) ?? emptyProgress();
  } catch {
    // Private-mode browsers and blocked site data both throw on access.
    return emptyProgress();
  }
}

export function saveProgress(progress: Progress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Quota exceeded or storage blocked — the session still works in memory.
  }
}

/** Triggers a download of the progress file. */
export function exportProgress(progress: Progress): void {
  const blob = new Blob([JSON.stringify(progress, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `neuron-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importProgress(file: File): Promise<Progress> {
  const parsed = parseProgress(JSON.parse(await file.text()));
  if (!parsed) throw new Error("Not a valid Neuron progress file.");
  return parsed;
}
