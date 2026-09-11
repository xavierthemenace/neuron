import { getStoredProgress, putStoredProgress } from "./db.ts";
import type {
  Cadence,
  CapstoneRecord,
  Difficulty,
  DiagnosticResult,
  EvidenceKind,
  Exercise,
  ExperimentRecord,
  Goal,
  LogEntry,
  MissionRecord,
  NodeKind,
  PersonalNode,
  Prediction,
  Progress,
} from "./types.ts";

/** Legacy v1 localStorage key, retained solely for one-time migration/fallback. */
export const STORAGE_KEY = "neuron.progress.v1";

export function emptyProgress(): Progress {
  return {
    version: 2,
    logs: [],
    diagnostics: [],
    predictions: [],
    missions: [],
    capstones: [],
    personalNodes: [],
    goals: [],
    experiments: [],
    installedPacks: [],
    dismissed: {},
  };
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

function isoString(value: unknown): string | undefined {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function unitInterval(value: unknown): number | undefined {
  const number = finiteNumber(value);
  if (number === undefined) return undefined;
  return Math.min(1, Math.max(0, number));
}

function difficulty(value: unknown): Difficulty | undefined {
  const number = finiteNumber(value);
  if (number === undefined) return undefined;
  const clamped = Math.round(Math.min(5, Math.max(1, number)));
  return clamped as Difficulty;
}

const EVIDENCE_KINDS: EvidenceKind[] = ["self-report", "artifact", "scored", "external"];
const NODE_KINDS: NodeKind[] = [
  "ability",
  "meta",
  "competency",
  "knowledge",
  "enabler",
  "social",
  "augmentation",
];

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
  if (
    log.source === "panel" ||
    log.source === "command" ||
    log.source === "workout" ||
    log.source === "coach" ||
    log.source === "mission" ||
    log.source === "capstone"
  ) {
    parsed.source = log.source;
  }

  const level = difficulty(log.difficulty);
  if (level !== undefined) parsed.difficulty = level;
  if (EVIDENCE_KINDS.includes(log.evidence as EvidenceKind)) {
    parsed.evidence = log.evidence as EvidenceKind;
  }
  const quality = unitInterval(log.quality);
  if (quality !== undefined) parsed.quality = quality;
  const score = unitInterval(log.score);
  if (score !== undefined) parsed.score = score;

  return parsed;
}

function parseDiagnostic(value: unknown): DiagnosticResult | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const at = isoString(row.at);
  const score = unitInterval(row.score);
  if (typeof row.id !== "string" || typeof row.probeId !== "string") return null;
  if (!at || score === undefined) return null;
  const items = finiteNumber(row.items);
  const result: DiagnosticResult = {
    id: row.id,
    probeId: row.probeId,
    nodeIds: stringArray(row.nodeIds),
    score,
    difficulty: difficulty(row.difficulty) ?? 2,
    items: items !== undefined && items > 0 ? Math.round(items) : 1,
    at,
  };
  const medianMs = finiteNumber(row.medianMs);
  if (medianMs !== undefined && medianMs > 0) result.medianMs = medianMs;
  return result;
}

function parsePrediction(value: unknown): Prediction | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const probability = unitInterval(row.probability);
  const createdAt = isoString(row.createdAt);
  const resolveBy = isoString(row.resolveBy);
  if (
    typeof row.id !== "string" ||
    typeof row.claim !== "string" ||
    !row.claim.trim() ||
    probability === undefined ||
    !createdAt ||
    !resolveBy
  ) {
    return null;
  }
  const prediction: Prediction = {
    id: row.id,
    claim: row.claim,
    probability,
    createdAt,
    resolveBy,
    nodeIds: stringArray(row.nodeIds),
  };
  const resolvedAt = isoString(row.resolvedAt);
  if (resolvedAt) prediction.resolvedAt = resolvedAt;
  if (row.outcome === "yes" || row.outcome === "no" || row.outcome === "ambiguous") {
    prediction.outcome = row.outcome;
  }
  const tags = stringArray(row.tags);
  if (tags.length) prediction.tags = tags;
  if (typeof row.note === "string" && row.note.trim()) prediction.note = row.note;
  return prediction;
}

function parseMission(value: unknown): MissionRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const startedAt = isoString(row.startedAt);
  if (typeof row.id !== "string" || typeof row.missionId !== "string" || !startedAt) {
    return null;
  }
  const steps: Record<string, string> = {};
  if (row.steps && typeof row.steps === "object") {
    for (const [key, text] of Object.entries(row.steps as Record<string, unknown>)) {
      if (typeof text === "string") steps[key] = text;
    }
  }
  const mission: MissionRecord = { id: row.id, missionId: row.missionId, startedAt, steps };
  const completedAt = isoString(row.completedAt);
  if (completedAt) mission.completedAt = completedAt;
  const quality = unitInterval(row.quality);
  if (quality !== undefined) mission.quality = quality;
  if (typeof row.reflection === "string" && row.reflection.trim()) {
    mission.reflection = row.reflection;
  }
  return mission;
}

function parseCapstone(value: unknown): CapstoneRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const submittedAt = isoString(row.submittedAt);
  if (typeof row.id !== "string" || typeof row.capstoneId !== "string" || !submittedAt) {
    return null;
  }
  const capstone: CapstoneRecord = {
    id: row.id,
    capstoneId: row.capstoneId,
    nodeIds: stringArray(row.nodeIds),
    submittedAt,
    summary: typeof row.summary === "string" ? row.summary : "",
  };
  const attachmentIds = stringArray(row.attachmentIds);
  if (attachmentIds.length) capstone.attachmentIds = attachmentIds;
  const rubricScore = unitInterval(row.rubricScore);
  if (rubricScore !== undefined) capstone.rubricScore = rubricScore;
  if (row.rubric && typeof row.rubric === "object") {
    const rubric: Record<string, number> = {};
    for (const [key, val] of Object.entries(row.rubric as Record<string, unknown>)) {
      const number = unitInterval(val);
      if (number !== undefined) rubric[key] = number;
    }
    if (Object.keys(rubric).length) capstone.rubric = rubric;
  }
  return capstone;
}

function parseExercise(value: unknown): Exercise | null {
  if (!value || typeof value !== "object") return null;
  const ex = value as Record<string, unknown>;
  if (typeof ex.id !== "string" || typeof ex.label !== "string") return null;
  const xp = finiteNumber(ex.xp);
  const cadence: Cadence =
    ex.cadence === "daily" || ex.cadence === "session" ? ex.cadence : "weekly";
  const exercise: Exercise = {
    id: ex.id,
    label: ex.label,
    xp: xp !== undefined && xp > 0 ? xp : 10,
    cadence,
    difficulty: difficulty(ex.difficulty) ?? 2,
    evidence: EVIDENCE_KINDS.includes(ex.evidence as EvidenceKind)
      ? (ex.evidence as EvidenceKind)
      : "self-report",
  };
  const minutes = finiteNumber(ex.minutes);
  if (minutes !== undefined && minutes > 0) exercise.minutes = Math.round(minutes);
  return exercise;
}

function parsePersonalNode(value: unknown): PersonalNode | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const createdAt = isoString(row.createdAt);
  if (
    typeof row.id !== "string" ||
    typeof row.label !== "string" ||
    !row.label.trim() ||
    !createdAt
  ) {
    return null;
  }
  const exercises = parseList(row.exercises, parseExercise);

  const node: PersonalNode = {
    id: row.id,
    label: row.label,
    description: typeof row.description === "string" ? row.description : "",
    kind: NODE_KINDS.includes(row.kind as NodeKind)
      ? (row.kind as NodeKind)
      : "competency",
    linkedNodeIds: stringArray(row.linkedNodeIds),
    createdAt,
    exercises,
  };
  if (typeof row.notes === "string" && row.notes.trim()) node.notes = row.notes;
  if (typeof row.packId === "string") node.packId = row.packId;
  return node;
}

function parseGoal(value: unknown): Goal | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const createdAt = isoString(row.createdAt);
  if (typeof row.id !== "string" || typeof row.label !== "string" || !createdAt) {
    return null;
  }
  const goal: Goal = {
    id: row.id,
    label: row.label,
    createdAt,
    nodeIds: stringArray(row.nodeIds),
    status:
      row.status === "paused" || row.status === "achieved" || row.status === "abandoned"
        ? row.status
        : "active",
  };
  if (typeof row.motivation === "string" && row.motivation.trim()) {
    goal.motivation = row.motivation;
  }
  const targetDate = isoString(row.targetDate);
  if (targetDate) goal.targetDate = targetDate;
  if (typeof row.pathId === "string") goal.pathId = row.pathId;
  const weeklyMinutes = finiteNumber(row.weeklyMinutes);
  if (weeklyMinutes !== undefined && weeklyMinutes > 0) {
    goal.weeklyMinutes = Math.round(weeklyMinutes);
  }
  return goal;
}

function parseExperiment(value: unknown): ExperimentRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const startedAt = isoString(row.startedAt);
  if (typeof row.id !== "string" || typeof row.hypothesis !== "string" || !startedAt) {
    return null;
  }
  const observations = Array.isArray(row.observations)
    ? row.observations
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const obs = item as Record<string, unknown>;
          const at = isoString(obs.at);
          const value_ = finiteNumber(obs.value);
          if (!at || value_ === undefined) return null;
          return {
            at,
            arm: obs.arm === "b" ? ("b" as const) : ("a" as const),
            value: value_,
            note: typeof obs.note === "string" ? obs.note : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const experiment: ExperimentRecord = {
    id: row.id,
    hypothesis: row.hypothesis,
    intervention: typeof row.intervention === "string" ? row.intervention : "",
    measure: typeof row.measure === "string" ? row.measure : "",
    startedAt,
    observations,
    status:
      row.status === "concluded" || row.status === "abandoned" ? row.status : "running",
  };
  const endsAt = isoString(row.endsAt);
  if (endsAt) experiment.endsAt = endsAt;
  if (typeof row.conclusion === "string" && row.conclusion.trim()) {
    experiment.conclusion = row.conclusion;
  }
  return experiment;
}

function parseList<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(parse).filter((item): item is T => item !== null);
}

/**
 * Validates unknown input into a Progress.
 *
 * v1 payloads carried only `logs`. They are upgraded in place rather than
 * rejected: every existing `neuron.progress.v1` export must keep importing
 * cleanly, and the ontology growing is not a reason for someone to lose two
 * years of practice history.
 */
export function parseProgress(value: unknown): Progress | null {
  if (!value || typeof value !== "object") return null;
  const progress = value as Record<string, unknown>;
  if (progress.version !== 1 && progress.version !== 2) return null;
  if (!Array.isArray(progress.logs)) return null;

  const dismissed: Record<string, string> = {};
  if (progress.dismissed && typeof progress.dismissed === "object") {
    for (const [key, at] of Object.entries(progress.dismissed as Record<string, unknown>)) {
      if (typeof at === "string") dismissed[key] = at;
    }
  }

  return {
    version: 2,
    logs: parseList(progress.logs, parseLogEntry),
    diagnostics: parseList(progress.diagnostics, parseDiagnostic),
    predictions: parseList(progress.predictions, parsePrediction),
    missions: parseList(progress.missions, parseMission),
    capstones: parseList(progress.capstones, parseCapstone),
    personalNodes: parseList(progress.personalNodes, parsePersonalNode),
    goals: parseList(progress.goals, parseGoal),
    experiments: parseList(progress.experiments, parseExperiment),
    curriculumVersion:
      typeof progress.curriculumVersion === "string"
        ? progress.curriculumVersion
        : undefined,
    installedPacks: stringArray(progress.installedPacks),
    dismissed,
  };
}

function loadLegacyProgress(): Progress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseProgress(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * IndexedDB is authoritative. On the first visit after an upgrade, a valid
 * localStorage v1 payload is copied into IndexedDB and then removed after the
 * write succeeds.
 */
export async function loadProgress(): Promise<Progress> {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const stored = parseProgress(await getStoredProgress());
    if (stored) return stored;

    const legacy = loadLegacyProgress();
    if (legacy) {
      await putStoredProgress(legacy);
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Migration succeeded even if a privacy mode blocks localStorage writes.
      }
      return legacy;
    }
  } catch {
    // IndexedDB can be blocked by browser policy. Fall back to the legacy store
    // so the app remains usable instead of losing the entire session.
    return loadLegacyProgress() ?? emptyProgress();
  }
  return emptyProgress();
}

export async function saveProgress(progress: Progress): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await putStoredProgress(progress);
  } catch {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Storage can be completely unavailable; in-memory state still works.
    }
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
