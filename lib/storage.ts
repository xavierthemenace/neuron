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

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseLogEntry(value: unknown): LogEntry | null {
  if (!value || typeof value !== "object") return null;
  const log = value as Record<string, unknown>;
  if (
    typeof log.id !== "string" ||
    typeof log.nodeId !== "string" ||
    typeof log.exerciseId !== "string" ||
    typeof log.xp !== "number" ||
    !Number.isFinite(log.xp) ||
    typeof log.at !== "string" ||
    Number.isNaN(Date.parse(log.at))
  ) {
    return null;
  }

  const parsed: LogEntry = {
    id: log.id,
    nodeId: log.nodeId,
    exerciseId: log.exerciseId,
    xp: log.xp,
    at: log.at,
  };

  const baseXp = finiteNumber(log.baseXp);
  const multiplier = finiteNumber(log.multiplier);
  const minutes = finiteNumber(log.minutes);
  if (baseXp !== undefined && baseXp >= 0) parsed.baseXp = baseXp;
  if (multiplier !== undefined && multiplier >= 1) parsed.multiplier = multiplier;
  if (minutes !== undefined && minutes > 0) parsed.minutes = minutes;
  if (typeof log.note === "string" && log.note.trim()) parsed.note = log.note;
  if (log.source === "panel" || log.source === "command") parsed.source = log.source;

  return parsed;
}

/**
 * Validates unknown input into a Progress. Richer log metadata remains optional
 * so every existing `neuron.progress.v1` export continues to import cleanly.
 */
export function parseProgress(value: unknown): Progress | null {
  if (!value || typeof value !== "object") return null;
  const progress = value as Record<string, unknown>;
  if (progress.version !== 1 || !Array.isArray(progress.logs)) return null;
  return {
    version: 1,
    logs: progress.logs
      .map(parseLogEntry)
      .filter((log): log is LogEntry => log !== null),
  };
}

/** Reads saved progress. Returns empty progress rather than throwing. */
export function loadProgress(): Progress {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    return parseProgress(JSON.parse(raw)) ?? emptyProgress();
  } catch {
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
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `neuron-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function importProgress(file: File): Promise<Progress> {
  const parsed = parseProgress(JSON.parse(await file.text()));
  if (!parsed) throw new Error("Not a valid Neuron progress file.");
  return parsed;
}
