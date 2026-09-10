"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { xpByNode } from "@/lib/mastery";
import {
  STORAGE_KEY,
  emptyProgress,
  loadProgress,
  newId,
  parseProgress,
  saveProgress,
} from "@/lib/storage";
import type { Exercise, LogEntry, Progress } from "@/lib/types";

type Action =
  | { kind: "hydrate"; progress: Progress }
  | { kind: "log"; nodeId: string; exercise: Exercise; note?: string }
  | { kind: "undo"; logId: string }
  | { kind: "replace"; progress: Progress }
  | { kind: "reset" };

/**
 * `hydrated` lives in the reducer rather than its own useState so that reading
 * localStorage is a single dispatch — a second setState in the same effect
 * would cause a cascading render.
 */
interface State {
  progress: Progress;
  hydrated: boolean;
}

function initialState(): State {
  return { progress: emptyProgress(), hydrated: false };
}

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case "hydrate":
      return { progress: action.progress, hydrated: true };
    case "replace":
      return { ...state, progress: action.progress };
    case "log": {
      const entry: LogEntry = {
        id: newId(),
        nodeId: action.nodeId,
        exerciseId: action.exercise.id,
        xp: action.exercise.xp,
        note: action.note?.trim() || undefined,
        at: new Date().toISOString(),
      };
      return {
        ...state,
        progress: { ...state.progress, logs: [...state.progress.logs, entry] },
      };
    }
    case "undo":
      return {
        ...state,
        progress: {
          ...state.progress,
          logs: state.progress.logs.filter((l) => l.id !== action.logId),
        },
      };
    case "reset":
      return { ...state, progress: emptyProgress() };
  }
}

interface ProgressContextValue {
  progress: Progress;
  /** False until localStorage has been read — gate rendering on this. */
  hydrated: boolean;
  xpByNodeId: Record<string, number>;
  logsByNodeId: Record<string, LogEntry[]>;
  logExercise: (nodeId: string, exercise: Exercise, note?: string) => void;
  undoLog: (logId: string) => void;
  replaceProgress: (progress: Progress) => void;
  resetProgress: () => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 300;

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [{ progress, hydrated }, dispatch] = useReducer(
    reducer,
    undefined,
    initialState,
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True while an edit made here has not yet reached localStorage. */
  const dirty = useRef(false);

  // Read storage only after mount: the server render has no localStorage, and
  // seeding state from it during render would desync the two.
  useEffect(() => {
    dispatch({ kind: "hydrate", progress: loadProgress() });
  }, []);

  // Debounced write — logging several exercises in a row shouldn't serialise
  // the whole log array on every click.
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dirty.current = true;
    saveTimer.current = setTimeout(() => {
      saveProgress(progress);
      dirty.current = false;
      saveTimer.current = null;
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [progress, hydrated]);

  // Flush a pending debounce if the tab is hidden or closed mid-window — but
  // only when there is genuinely an unsaved change. Writing unconditionally
  // here would stamp this tab's state over a newer one saved by another tab.
  useEffect(() => {
    if (!hydrated) return;
    const flush = () => {
      if (!dirty.current) return;
      saveProgress(progress);
      dirty.current = false;
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [progress, hydrated]);

  // Another tab logging work should show up here rather than being silently
  // overwritten the next time this tab saves. The storage event fires only in
  // the tabs that did *not* make the change, which is exactly what we want.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || event.newValue === null) return;
      try {
        const incoming = parseProgress(JSON.parse(event.newValue));
        if (incoming) {
          dirty.current = false;
          dispatch({ kind: "replace", progress: incoming });
        }
      } catch {
        // A corrupt write from elsewhere shouldn't take this tab down.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const xpByNodeId = useMemo(() => xpByNode(progress.logs), [progress.logs]);

  const logsByNodeId = useMemo(() => {
    const grouped: Record<string, LogEntry[]> = {};
    for (const log of progress.logs) {
      (grouped[log.nodeId] ??= []).push(log);
    }
    // Newest first — the panel shows recent activity.
    for (const list of Object.values(grouped)) {
      list.sort((a, b) => b.at.localeCompare(a.at));
    }
    return grouped;
  }, [progress.logs]);

  const logExercise = useCallback(
    (nodeId: string, exercise: Exercise, note?: string) =>
      dispatch({ kind: "log", nodeId, exercise, note }),
    [],
  );
  const undoLog = useCallback(
    (logId: string) => dispatch({ kind: "undo", logId }),
    [],
  );
  const replaceProgress = useCallback(
    (next: Progress) => dispatch({ kind: "replace", progress: next }),
    [],
  );
  const resetProgress = useCallback(() => dispatch({ kind: "reset" }), []);

  const value = useMemo(
    () => ({
      progress,
      hydrated,
      xpByNodeId,
      logsByNodeId,
      logExercise,
      undoLog,
      replaceProgress,
      resetProgress,
    }),
    [
      progress,
      hydrated,
      xpByNodeId,
      logsByNodeId,
      logExercise,
      undoLog,
      replaceProgress,
      resetProgress,
    ],
  );

  return (
    <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside <ProgressProvider>");
  return ctx;
}
