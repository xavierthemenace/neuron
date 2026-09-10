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
import { decayStateForLogs, xpByNode, type DecayState } from "@/lib/mastery";
import {
  STORAGE_KEY,
  emptyProgress,
  loadProgress,
  newId,
  parseProgress,
  saveProgress,
} from "@/lib/storage";
import type { Exercise, LogEntry, Progress } from "@/lib/types";

export interface LogExerciseOptions {
  multiplier?: number;
  minutes?: number;
  source?: "panel" | "command";
}

export interface LogSignal {
  id: string;
  nodeId: string;
}

type Action =
  | { kind: "hydrate"; progress: Progress }
  | {
      kind: "log";
      nodeId: string;
      exercise: Exercise;
      note?: string;
      options?: LogExerciseOptions;
    }
  | { kind: "undo"; logId: string }
  | { kind: "replace"; progress: Progress }
  | { kind: "reset" }
  | { kind: "tick" };

interface State {
  progress: Progress;
  hydrated: boolean;
  lastLogSignal: LogSignal | null;
  decayTick: number;
}

function initialState(): State {
  return {
    progress: emptyProgress(),
    hydrated: false,
    lastLogSignal: null,
    decayTick: 0,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case "hydrate":
      return { ...state, progress: action.progress, hydrated: true };
    case "replace":
      return { ...state, progress: action.progress, lastLogSignal: null };
    case "log": {
      const multiplier = Math.max(1, action.options?.multiplier ?? 1);
      const id = newId();
      const entry: LogEntry = {
        id,
        nodeId: action.nodeId,
        exerciseId: action.exercise.id,
        baseXp: action.exercise.xp,
        multiplier,
        xp: Math.round(action.exercise.xp * multiplier),
        minutes: action.options?.minutes,
        note: action.note?.trim() || undefined,
        source: action.options?.source ?? "panel",
        at: new Date().toISOString(),
      };
      return {
        ...state,
        lastLogSignal: { id, nodeId: action.nodeId },
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
      return { ...state, progress: emptyProgress(), lastLogSignal: null };
    case "tick":
      return { ...state, decayTick: state.decayTick + 1 };
  }
}

interface ProgressContextValue {
  progress: Progress;
  hydrated: boolean;
  /** Effective XP after memory decay; use this for mastery/visual state. */
  xpByNodeId: Record<string, number>;
  /** Historical awarded XP, before decay. */
  rawXpByNodeId: Record<string, number>;
  decayByNodeId: Record<string, DecayState>;
  logsByNodeId: Record<string, LogEntry[]>;
  lastLogSignal: LogSignal | null;
  logExercise: (
    nodeId: string,
    exercise: Exercise,
    note?: string,
    options?: LogExerciseOptions,
  ) => void;
  undoLog: (logId: string) => void;
  replaceProgress: (progress: Progress) => void;
  resetProgress: () => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);
const SAVE_DEBOUNCE_MS = 300;

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [{ progress, hydrated, lastLogSignal, decayTick }, dispatch] = useReducer(
    reducer,
    undefined,
    initialState,
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    dispatch({ kind: "hydrate", progress: loadProgress() });
  }, []);

  // Decay is wall-clock based. Refresh it hourly without turning the graph into
  // an animation loop or making practice events wait for a reload.
  useEffect(() => {
    const timer = window.setInterval(() => dispatch({ kind: "tick" }), 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  const logsByNodeId = useMemo(() => {
    const grouped: Record<string, LogEntry[]> = {};
    for (const log of progress.logs) {
      (grouped[log.nodeId] ??= []).push(log);
    }
    for (const list of Object.values(grouped)) {
      list.sort((a, b) => b.at.localeCompare(a.at));
    }
    return grouped;
  }, [progress.logs]);

  const rawXpByNodeId = useMemo(() => xpByNode(progress.logs), [progress.logs]);

  const decayByNodeId = useMemo(() => {
    // decayTick deliberately participates so an open tab tracks wall-clock decay.
    void decayTick;
    const now = new Date();
    const states: Record<string, DecayState> = {};
    for (const [nodeId, logs] of Object.entries(logsByNodeId)) {
      states[nodeId] = decayStateForLogs(logs, now);
    }
    return states;
  }, [logsByNodeId, decayTick]);

  const xpByNodeId = useMemo(() => {
    const effective: Record<string, number> = {};
    for (const [nodeId, rawXp] of Object.entries(rawXpByNodeId)) {
      effective[nodeId] = decayByNodeId[nodeId]?.effectiveXp ?? rawXp;
    }
    return effective;
  }, [rawXpByNodeId, decayByNodeId]);

  const logExercise = useCallback(
    (
      nodeId: string,
      exercise: Exercise,
      note?: string,
      options?: LogExerciseOptions,
    ) => dispatch({ kind: "log", nodeId, exercise, note, options }),
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
      rawXpByNodeId,
      decayByNodeId,
      logsByNodeId,
      lastLogSignal,
      logExercise,
      undoLog,
      replaceProgress,
      resetProgress,
    }),
    [
      progress,
      hydrated,
      xpByNodeId,
      rawXpByNodeId,
      decayByNodeId,
      logsByNodeId,
      lastLogSignal,
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
