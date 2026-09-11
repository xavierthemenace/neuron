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
import { CURRICULUM_VERSION, nodesById } from "@/lib/curriculum";
import { note } from "@/lib/devtools";
import { buildLearnerModel, type LearnerModel } from "@/lib/learner";
import { exerciseResetState } from "@/lib/mastery";
import {
  migrateProgress,
  migrationIsNoteworthy,
  type MigrationReport,
} from "@/lib/migrations";
import {
  emptyProgress,
  loadProgress,
  newId,
  parseProgress,
  saveProgress,
} from "@/lib/storage";
import type {
  CapstoneRecord,
  DiagnosticResult,
  Difficulty,
  EvidenceKind,
  Exercise,
  ExperimentRecord,
  Goal,
  LogEntry,
  PersonalNode,
  Prediction,
  Progress,
} from "@/lib/types";

export interface LogExerciseOptions {
  multiplier?: number;
  minutes?: number;
  source?: LogEntry["source"];
  difficulty?: Difficulty;
  evidence?: EvidenceKind;
  /** Self-rated 0-1 quality of the completion. */
  quality?: number;
  /** Objective 0-1 score, for reps that were actually scored. */
  score?: number;
  /** Overrides the exercise's XP, for adaptive difficulty adjustments. */
  xp?: number;
}

export interface LogSignal {
  id: string;
  nodeId: string;
}

type Action =
  | { kind: "hydrate"; progress: Progress; migration: MigrationReport | null }
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
  | { kind: "tick" }
  | { kind: "diagnostic"; result: Omit<DiagnosticResult, "id"> }
  | { kind: "prediction-add"; prediction: Omit<Prediction, "id" | "createdAt"> }
  | {
      kind: "prediction-resolve";
      id: string;
      outcome: NonNullable<Prediction["outcome"]>;
    }
  | { kind: "prediction-delete"; id: string }
  | { kind: "mission-start"; missionId: string }
  | { kind: "mission-step"; missionId: string; stepId: string; text: string }
  | { kind: "mission-complete"; missionId: string; quality: number; reflection: string }
  | { kind: "capstone-submit"; record: Omit<CapstoneRecord, "id" | "submittedAt"> }
  | { kind: "personal-add"; node: Omit<PersonalNode, "id" | "createdAt"> }
  | { kind: "personal-update"; id: string; patch: Partial<PersonalNode> }
  | { kind: "personal-delete"; id: string }
  | { kind: "goal-add"; goal: Omit<Goal, "id" | "createdAt" | "status"> }
  | { kind: "goal-update"; id: string; patch: Partial<Goal> }
  | { kind: "goal-delete"; id: string }
  | { kind: "experiment-add"; experiment: Omit<ExperimentRecord, "id" | "startedAt" | "observations" | "status"> }
  | {
      kind: "experiment-observe";
      id: string;
      arm: "a" | "b";
      value: number;
      note?: string;
    }
  | { kind: "experiment-conclude"; id: string; conclusion: string }
  | { kind: "dismiss"; key: string }
  | { kind: "pack"; packId: string; installed: boolean };

interface State {
  progress: Progress;
  hydrated: boolean;
  lastLogSignal: LogSignal | null;
  migration: MigrationReport | null;
  /** Bumped hourly so time-dependent derived values refresh. */
  decayTick: number;
}

function initialState(): State {
  return {
    progress: emptyProgress(),
    hydrated: false,
    lastLogSignal: null,
    migration: null,
    decayTick: 0,
  };
}

function withProgress(state: State, progress: Progress): State {
  return { ...state, progress };
}

function reducer(state: State, action: Action): State {
  const { progress } = state;

  switch (action.kind) {
    case "hydrate":
      return {
        ...state,
        progress: action.progress,
        migration: action.migration,
        hydrated: true,
      };
    case "replace":
      return { ...state, progress: action.progress, lastLogSignal: null };
    case "reset":
      return { ...state, progress: emptyProgress(), lastLogSignal: null };
    case "tick":
      return { ...state, decayTick: state.decayTick + 1 };

    case "log": {
      const nodeLogs = progress.logs.filter((log) => log.nodeId === action.nodeId);
      if (
        !exerciseResetState(nodeLogs, action.exercise.id, action.exercise.cadence)
          .available
      ) {
        return state;
      }

      const multiplier = Math.max(1, action.options?.multiplier ?? 1);
      const baseXp = action.options?.xp ?? action.exercise.xp;
      const id = newId();
      const entry: LogEntry = {
        id,
        nodeId: action.nodeId,
        exerciseId: action.exercise.id,
        baseXp,
        multiplier,
        xp: Math.round(baseXp * multiplier),
        minutes: action.options?.minutes,
        note: action.note?.trim() || undefined,
        source: action.options?.source ?? "panel",
        difficulty: action.options?.difficulty ?? action.exercise.difficulty,
        evidence: action.options?.evidence ?? action.exercise.evidence ?? "self-report",
        quality: action.options?.quality,
        score: action.options?.score,
        at: new Date().toISOString(),
      };
      return {
        ...state,
        lastLogSignal: { id, nodeId: action.nodeId },
        progress: { ...progress, logs: [...progress.logs, entry] },
      };
    }

    case "undo":
      return withProgress(state, {
        ...progress,
        logs: progress.logs.filter((log) => log.id !== action.logId),
      });

    case "diagnostic":
      return withProgress(state, {
        ...progress,
        diagnostics: [...progress.diagnostics, { ...action.result, id: newId() }],
      });

    case "prediction-add":
      return withProgress(state, {
        ...progress,
        predictions: [
          ...progress.predictions,
          { ...action.prediction, id: newId(), createdAt: new Date().toISOString() },
        ],
      });

    case "prediction-resolve":
      return withProgress(state, {
        ...progress,
        predictions: progress.predictions.map((prediction) =>
          prediction.id === action.id
            ? {
                ...prediction,
                outcome: action.outcome,
                resolvedAt: new Date().toISOString(),
              }
            : prediction,
        ),
      });

    case "prediction-delete":
      return withProgress(state, {
        ...progress,
        predictions: progress.predictions.filter(
          (prediction) => prediction.id !== action.id,
        ),
      });

    case "mission-start": {
      if (progress.missions.some((m) => m.missionId === action.missionId && !m.completedAt)) {
        return state;
      }
      return withProgress(state, {
        ...progress,
        missions: [
          ...progress.missions,
          {
            id: newId(),
            missionId: action.missionId,
            startedAt: new Date().toISOString(),
            steps: {},
          },
        ],
      });
    }

    case "mission-step":
      return withProgress(state, {
        ...progress,
        missions: progress.missions.map((mission) =>
          mission.missionId === action.missionId && !mission.completedAt
            ? { ...mission, steps: { ...mission.steps, [action.stepId]: action.text } }
            : mission,
        ),
      });

    case "mission-complete":
      return withProgress(state, {
        ...progress,
        missions: progress.missions.map((mission) =>
          mission.missionId === action.missionId && !mission.completedAt
            ? {
                ...mission,
                completedAt: new Date().toISOString(),
                quality: action.quality,
                reflection: action.reflection,
              }
            : mission,
        ),
      });

    case "capstone-submit":
      return withProgress(state, {
        ...progress,
        capstones: [
          ...progress.capstones,
          { ...action.record, id: newId(), submittedAt: new Date().toISOString() },
        ],
      });

    case "personal-add":
      return withProgress(state, {
        ...progress,
        personalNodes: [
          ...progress.personalNodes,
          { ...action.node, id: `personal-${newId()}`, createdAt: new Date().toISOString() },
        ],
      });

    case "personal-update":
      return withProgress(state, {
        ...progress,
        personalNodes: progress.personalNodes.map((node) =>
          node.id === action.id ? { ...node, ...action.patch, id: node.id } : node,
        ),
      });

    case "personal-delete":
      return withProgress(state, {
        ...progress,
        personalNodes: progress.personalNodes.filter((node) => node.id !== action.id),
      });

    case "goal-add":
      return withProgress(state, {
        ...progress,
        goals: [
          ...progress.goals,
          {
            ...action.goal,
            id: newId(),
            createdAt: new Date().toISOString(),
            status: "active",
          },
        ],
      });

    case "goal-update":
      return withProgress(state, {
        ...progress,
        goals: progress.goals.map((goal) =>
          goal.id === action.id ? { ...goal, ...action.patch, id: goal.id } : goal,
        ),
      });

    case "goal-delete":
      return withProgress(state, {
        ...progress,
        goals: progress.goals.filter((goal) => goal.id !== action.id),
      });

    case "experiment-add":
      return withProgress(state, {
        ...progress,
        experiments: [
          ...progress.experiments,
          {
            ...action.experiment,
            id: newId(),
            startedAt: new Date().toISOString(),
            observations: [],
            status: "running",
          },
        ],
      });

    case "experiment-observe":
      return withProgress(state, {
        ...progress,
        experiments: progress.experiments.map((experiment) =>
          experiment.id === action.id
            ? {
                ...experiment,
                observations: [
                  ...experiment.observations,
                  {
                    at: new Date().toISOString(),
                    arm: action.arm,
                    value: action.value,
                    note: action.note,
                  },
                ],
              }
            : experiment,
        ),
      });

    case "experiment-conclude":
      return withProgress(state, {
        ...progress,
        experiments: progress.experiments.map((experiment) =>
          experiment.id === action.id
            ? { ...experiment, status: "concluded", conclusion: action.conclusion }
            : experiment,
        ),
      });

    case "dismiss":
      return withProgress(state, {
        ...progress,
        dismissed: { ...progress.dismissed, [action.key]: new Date().toISOString() },
      });

    case "pack": {
      const installed = new Set(progress.installedPacks ?? []);
      if (action.installed) installed.add(action.packId);
      else installed.delete(action.packId);
      return withProgress(state, { ...progress, installedPacks: [...installed] });
    }
  }
}

interface ProgressContextValue extends LearnerModel {
  progress: Progress;
  /**
   * The app's shared clock, refreshed with the hourly decay tick.
   *
   * Views must read time from here rather than calling Date.now() during
   * render: a per-component clock makes derived lists unstable across
   * re-renders and lets two panels disagree about whether the same item is
   * overdue.
   */
  nowMs: number;
  hydrated: boolean;
  migration: MigrationReport | null;
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
  recordDiagnostic: (result: Omit<DiagnosticResult, "id">) => void;
  addPrediction: (prediction: Omit<Prediction, "id" | "createdAt">) => void;
  resolvePrediction: (id: string, outcome: NonNullable<Prediction["outcome"]>) => void;
  deletePrediction: (id: string) => void;
  startMission: (missionId: string) => void;
  saveMissionStep: (missionId: string, stepId: string, text: string) => void;
  completeMission: (missionId: string, quality: number, reflection: string) => void;
  submitCapstone: (record: Omit<CapstoneRecord, "id" | "submittedAt">) => void;
  addPersonalNode: (node: Omit<PersonalNode, "id" | "createdAt">) => void;
  updatePersonalNode: (id: string, patch: Partial<PersonalNode>) => void;
  deletePersonalNode: (id: string) => void;
  addGoal: (goal: Omit<Goal, "id" | "createdAt" | "status">) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addExperiment: (
    experiment: Omit<ExperimentRecord, "id" | "startedAt" | "observations" | "status">,
  ) => void;
  observeExperiment: (id: string, arm: "a" | "b", value: number, note?: string) => void;
  concludeExperiment: (id: string, conclusion: string) => void;
  dismissItem: (key: string) => void;
  setPackInstalled: (packId: string, installed: boolean) => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);
const SAVE_DEBOUNCE_MS = 300;
const CHANNEL_NAME = "neuron-progress-v2";

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [{ progress, hydrated, lastLogSignal, migration, decayTick }, dispatch] =
    useReducer(reducer, undefined, initialState);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const suppressNextPersist = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadProgress().then((loaded) => {
      if (cancelled) return;
      // Curriculum migrations run once, at hydration, before anything reads the
      // progress. Running them lazily would mean two components disagreeing
      // about which node id a log belongs to.
      const { progress: migrated, report } = migrateProgress(
        loaded,
        CURRICULUM_VERSION,
        new Set(nodesById.keys()),
      );
      note(
        "hydrate",
        `${migrated.logs.length} logs, migrations ${report.applied.length}, rewritten ${report.rewrittenLogs}, orphans ${report.orphanedNodeIds.length}`,
      );
      dispatch({
        kind: "hydrate",
        progress: migrated,
        migration: migrationIsNoteworthy(report) ? report : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const broadcast = new BroadcastChannel(CHANNEL_NAME);
    channel.current = broadcast;
    broadcast.onmessage = (event: MessageEvent<unknown>) => {
      const incoming = parseProgress(event.data);
      if (!incoming) return;
      // A remote snapshot is already persisted by its originating tab. Mark the
      // next progress effect as read-only so this tab does not immediately echo
      // the same snapshot back and create an endless cross-tab broadcast cycle.
      suppressNextPersist.current = true;
      dirty.current = false;
      dispatch({ kind: "replace", progress: incoming });
    };
    return () => {
      broadcast.close();
      if (channel.current === broadcast) channel.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(
      () => dispatch({ kind: "tick" }),
      60 * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (suppressNextPersist.current) {
      suppressNextPersist.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dirty.current = true;
    saveTimer.current = setTimeout(() => {
      const snapshot = progress;
      void saveProgress(snapshot).then(() => {
        dirty.current = false;
        channel.current?.postMessage(snapshot);
      });
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
      dirty.current = false;
      void saveProgress(progress);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [progress, hydrated]);

  const { model, nowMs } = useMemo(() => {
    void decayTick;
    const now = new Date();
    return { model: buildLearnerModel(progress, now), nowMs: now.getTime() };
  }, [progress, decayTick]);

  const logExercise = useCallback(
    (
      nodeId: string,
      exercise: Exercise,
      note?: string,
      options?: LogExerciseOptions,
    ) => dispatch({ kind: "log", nodeId, exercise, note, options }),
    [],
  );
  const undoLog = useCallback((logId: string) => dispatch({ kind: "undo", logId }), []);
  const replaceProgress = useCallback(
    (next: Progress) => dispatch({ kind: "replace", progress: next }),
    [],
  );
  const resetProgress = useCallback(() => dispatch({ kind: "reset" }), []);
  const recordDiagnostic = useCallback(
    (result: Omit<DiagnosticResult, "id">) => dispatch({ kind: "diagnostic", result }),
    [],
  );
  const addPrediction = useCallback(
    (prediction: Omit<Prediction, "id" | "createdAt">) =>
      dispatch({ kind: "prediction-add", prediction }),
    [],
  );
  const resolvePrediction = useCallback(
    (id: string, outcome: NonNullable<Prediction["outcome"]>) =>
      dispatch({ kind: "prediction-resolve", id, outcome }),
    [],
  );
  const deletePrediction = useCallback(
    (id: string) => dispatch({ kind: "prediction-delete", id }),
    [],
  );
  const startMission = useCallback(
    (missionId: string) => dispatch({ kind: "mission-start", missionId }),
    [],
  );
  const saveMissionStep = useCallback(
    (missionId: string, stepId: string, text: string) =>
      dispatch({ kind: "mission-step", missionId, stepId, text }),
    [],
  );
  const completeMission = useCallback(
    (missionId: string, quality: number, reflection: string) =>
      dispatch({ kind: "mission-complete", missionId, quality, reflection }),
    [],
  );
  const submitCapstone = useCallback(
    (record: Omit<CapstoneRecord, "id" | "submittedAt">) =>
      dispatch({ kind: "capstone-submit", record }),
    [],
  );
  const addPersonalNode = useCallback(
    (node: Omit<PersonalNode, "id" | "createdAt">) =>
      dispatch({ kind: "personal-add", node }),
    [],
  );
  const updatePersonalNode = useCallback(
    (id: string, patch: Partial<PersonalNode>) =>
      dispatch({ kind: "personal-update", id, patch }),
    [],
  );
  const deletePersonalNode = useCallback(
    (id: string) => dispatch({ kind: "personal-delete", id }),
    [],
  );
  const addGoal = useCallback(
    (goal: Omit<Goal, "id" | "createdAt" | "status">) => dispatch({ kind: "goal-add", goal }),
    [],
  );
  const updateGoal = useCallback(
    (id: string, patch: Partial<Goal>) => dispatch({ kind: "goal-update", id, patch }),
    [],
  );
  const deleteGoal = useCallback((id: string) => dispatch({ kind: "goal-delete", id }), []);
  const addExperiment = useCallback(
    (
      experiment: Omit<
        ExperimentRecord,
        "id" | "startedAt" | "observations" | "status"
      >,
    ) => dispatch({ kind: "experiment-add", experiment }),
    [],
  );
  const observeExperiment = useCallback(
    (id: string, arm: "a" | "b", value: number, note?: string) =>
      dispatch({ kind: "experiment-observe", id, arm, value, note }),
    [],
  );
  const concludeExperiment = useCallback(
    (id: string, conclusion: string) =>
      dispatch({ kind: "experiment-conclude", id, conclusion }),
    [],
  );
  const dismissItem = useCallback((key: string) => dispatch({ kind: "dismiss", key }), []);
  const setPackInstalled = useCallback(
    (packId: string, installed: boolean) => dispatch({ kind: "pack", packId, installed }),
    [],
  );

  const value = useMemo(
    () => ({
      ...model,
      progress,
      nowMs,
      hydrated,
      migration,
      lastLogSignal,
      logExercise,
      undoLog,
      replaceProgress,
      resetProgress,
      recordDiagnostic,
      addPrediction,
      resolvePrediction,
      deletePrediction,
      startMission,
      saveMissionStep,
      completeMission,
      submitCapstone,
      addPersonalNode,
      updatePersonalNode,
      deletePersonalNode,
      addGoal,
      updateGoal,
      deleteGoal,
      addExperiment,
      observeExperiment,
      concludeExperiment,
      dismissItem,
      setPackInstalled,
    }),
    [
      model,
      progress,
      nowMs,
      hydrated,
      migration,
      lastLogSignal,
      logExercise,
      undoLog,
      replaceProgress,
      resetProgress,
      recordDiagnostic,
      addPrediction,
      resolvePrediction,
      deletePrediction,
      startMission,
      saveMissionStep,
      completeMission,
      submitCapstone,
      addPersonalNode,
      updatePersonalNode,
      deletePersonalNode,
      addGoal,
      updateGoal,
      deleteGoal,
      addExperiment,
      observeExperiment,
      concludeExperiment,
      dismissItem,
      setPackInstalled,
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
