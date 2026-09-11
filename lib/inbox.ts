import { capstonesForNode, missionsById, nodesById } from "./curriculum.ts";
import { probeHistory, PROBES } from "./diagnostics.ts";
import { analyseGraph } from "./graph-intel.ts";
import type { LearnerModel } from "./learner.ts";
import { retentionRisk } from "./retention.ts";
import type { Goal, Progress } from "./types.ts";

/**
 * The review inbox.
 *
 * One queue of things that actually deserve attention today, ranked by how much
 * is lost by ignoring them. The map answers "what exists"; the workout answers
 * "what should I train"; this answers "what is going stale, unresolved or
 * unfinished" — which is the question a daily user actually has.
 *
 * Nothing in here is manufactured urgency. Every item corresponds to a real
 * state in the data: a memory sliding down its curve, a prediction whose
 * resolution date has passed, a mission abandoned halfway.
 */

export type InboxKind =
  | "retention"
  | "prediction-due"
  | "diagnostic-due"
  | "mission-open"
  | "capstone-ready"
  | "goal-stalled"
  | "weak-prerequisite"
  | "unproven-practice"
  | "experiment-open";

export interface InboxItem {
  /** Stable across sessions so a dismissal sticks to the right thing. */
  key: string;
  kind: InboxKind;
  title: string;
  detail: string;
  /** 0-1. Ranking only; never rendered as a countdown or a streak. */
  urgency: number;
  nodeId?: string;
  missionId?: string;
  probeId?: string;
  predictionId?: string;
  goalId?: string;
  experimentId?: string;
  actionLabel: string;
}

const KIND_CAP: Partial<Record<InboxKind, number>> = {
  retention: 6,
  "weak-prerequisite": 3,
  "unproven-practice": 3,
  "diagnostic-due": 3,
};

/** Dismissals expire, because the underlying state usually comes back. */
const DISMISS_TTL_DAYS = 14;

export function buildInbox(
  model: LearnerModel,
  progress: Progress,
  now = new Date(),
): InboxItem[] {
  const items: InboxItem[] = [];
  const nowMs = now.getTime();

  // ── Knowledge sliding toward being forgotten ────────────────────────────
  for (const node of model.nodes) {
    const retention = model.retentionByNodeId[node.id];
    if (!retention || retention.repetitions === 0) continue;
    const risk = retentionRisk(retention);
    if (risk < 0.55) continue;
    items.push({
      key: `retention:${node.id}`,
      kind: "retention",
      title: `${node.label} is at ${Math.round(retention.retention * 100)}% retention`,
      detail: retention.explanation,
      urgency: Math.min(1, risk * 0.9),
      nodeId: node.id,
      actionLabel: "Review",
    });
  }

  // ── Predictions past their resolution date ──────────────────────────────
  for (const prediction of progress.predictions) {
    if (prediction.outcome) continue;
    const due = new Date(prediction.resolveBy).getTime();
    if (due > nowMs) continue;
    const daysLate = (nowMs - due) / 864e5;
    items.push({
      key: `prediction:${prediction.id}`,
      kind: "prediction-due",
      title: `Resolve: "${prediction.claim.slice(0, 70)}${prediction.claim.length > 70 ? "…" : ""}"`,
      detail: `You gave this ${Math.round(prediction.probability * 100)}% and it was due ${Math.round(daysLate)} day${Math.round(daysLate) === 1 ? "" : "s"} ago. Unresolved predictions are the fastest way for a calibration record to become worthless.`,
      // Resolution is cheap and the record degrades fast, so this outranks
      // almost everything else.
      urgency: Math.min(1, 0.75 + daysLate / 60),
      predictionId: prediction.id,
      actionLabel: "Resolve",
    });
  }

  // ── Diagnostics worth repeating ─────────────────────────────────────────
  for (const probe of PROBES) {
    const history = probeHistory(probe.id, progress.diagnostics, now);
    if (!history.latest) {
      // Only nudge a first run for probes touching nodes the user trains.
      const engaged = probe.nodeIds.some(
        (id) => (model.estimates[id]?.practice ?? 0) > 0.08,
      );
      if (!engaged) continue;
      items.push({
        key: `diagnostic-first:${probe.id}`,
        kind: "diagnostic-due",
        title: `No baseline for ${probe.label}`,
        detail: `You are training ${probe.nodeIds
          .map((id) => nodesById.get(id)?.label)
          .filter(Boolean)
          .slice(0, 2)
          .join(" and ")} without a measurement. A first run takes a few minutes and becomes the thing every later run is compared against.`,
        urgency: 0.52,
        probeId: probe.id,
        actionLabel: "Run probe",
      });
      continue;
    }
    if (!history.dueAt || new Date(history.dueAt).getTime() > nowMs) continue;
    const daysOver = (nowMs - new Date(history.dueAt).getTime()) / 864e5;
    items.push({
      key: `diagnostic:${probe.id}`,
      kind: "diagnostic-due",
      title: `${probe.label} is due to be repeated`,
      detail: `Last run scored ${Math.round(history.latest.score * 100)}%, ${Math.round(
        (nowMs - new Date(history.latest.at).getTime()) / 864e5,
      )} days ago. Repeating it is the only way to tell whether training is moving measured performance.`,
      urgency: Math.min(0.85, 0.45 + daysOver / 90),
      probeId: probe.id,
      actionLabel: "Run probe",
    });
  }

  // ── Missions started and left ───────────────────────────────────────────
  for (const record of progress.missions) {
    if (record.completedAt) continue;
    const mission = missionsById.get(record.missionId);
    if (!mission) continue;
    const done = Object.values(record.steps).filter((text) => text.trim().length > 0).length;
    const age = (nowMs - new Date(record.startedAt).getTime()) / 864e5;
    items.push({
      key: `mission:${record.id}`,
      kind: "mission-open",
      title: `${mission.label} is ${done}/${mission.steps.length} complete`,
      detail: `Started ${Math.round(age)} days ago. Missions only count as transfer evidence when they are finished — a half-done mission is worth nothing to the competence model.`,
      urgency: Math.min(0.8, 0.35 + (done / mission.steps.length) * 0.3 + age / 120),
      missionId: mission.id,
      actionLabel: "Continue",
    });
  }

  // ── Capstones the user is now qualified for ─────────────────────────────
  const claimed = new Set(progress.capstones.map((record) => record.capstoneId));
  const seenCapstones = new Set<string>();
  for (const node of model.nodes) {
    for (const capstone of capstonesForNode(node.id)) {
      if (claimed.has(capstone.id) || seenCapstones.has(capstone.id)) continue;
      const qualifying = capstone.nodeIds.filter(
        (id) => (model.estimates[id]?.competence ?? 0) >= capstone.requires.minCompetence,
      );
      if (qualifying.length < capstone.requires.minNodes) continue;
      seenCapstones.add(capstone.id);
      items.push({
        key: `capstone:${capstone.id}`,
        kind: "capstone-ready",
        title: `Ready for a capstone: ${capstone.label}`,
        detail: `${qualifying.length} of the underlying capabilities are past ${Math.round(capstone.requires.minCompetence * 100)}% competence. A capstone is the strongest evidence this system accepts, because it is work someone else can inspect.`,
        urgency: 0.6,
        nodeId: capstone.nodeIds[0],
        actionLabel: "Open capstone",
      });
    }
  }

  // ── Goals that have stopped moving ──────────────────────────────────────
  for (const goal of progress.goals) {
    if (goal.status !== "active") continue;
    const lastTouched = goal.nodeIds
      .map((id) => model.retentionByNodeId[id]?.lastTrainedAt)
      .filter((iso): iso is string => Boolean(iso))
      .sort()
      .pop();
    const idleDays = lastTouched
      ? (nowMs - new Date(lastTouched).getTime()) / 864e5
      : (nowMs - new Date(goal.createdAt).getTime()) / 864e5;
    if (idleDays < 10) continue;
    items.push({
      key: `goal:${goal.id}`,
      kind: "goal-stalled",
      title: `"${goal.label}" has been idle for ${Math.round(idleDays)} days`,
      detail: lastTouched
        ? "Nothing on this goal's path has been trained in over a week. Either restart it or park it explicitly — a stalled goal quietly distorts every recommendation the planner makes."
        : "This goal has never been trained. Either start it or remove it.",
      urgency: Math.min(0.7, 0.3 + idleDays / 90),
      goalId: goal.id,
      actionLabel: "Review goal",
    });
  }

  // ── Structural findings worth acting on ─────────────────────────────────
  const goalNodeIds = new Set(
    progress.goals.filter((goal) => goal.status === "active").flatMap((goal) => goal.nodeIds),
  );
  for (const finding of analyseGraph(model, goalNodeIds)) {
    if (finding.kind === "prerequisite-gap") {
      items.push({
        key: `prereq:${finding.nodeIds[0]}`,
        kind: "weak-prerequisite",
        title: finding.headline,
        detail: `${finding.detail} ${finding.evidence}`,
        urgency: finding.priority * 0.8,
        nodeId: finding.nodeIds[1] ?? finding.nodeIds[0],
        actionLabel: "Open prerequisite",
      });
    } else if (finding.kind === "over-practised") {
      items.push({
        key: `unproven:${finding.nodeIds[0]}`,
        kind: "unproven-practice",
        title: finding.headline,
        detail: finding.detail,
        urgency: finding.priority * 0.7,
        nodeId: finding.nodeIds[0],
        actionLabel: "Gather evidence",
      });
    }
  }

  // ── Experiments awaiting observations or a conclusion ───────────────────
  for (const experiment of progress.experiments) {
    if (experiment.status !== "running") continue;
    const age = (nowMs - new Date(experiment.startedAt).getTime()) / 864e5;
    const ended = experiment.endsAt && new Date(experiment.endsAt).getTime() <= nowMs;
    if (!ended && experiment.observations.length > 0 && age < 7) continue;
    items.push({
      key: `experiment:${experiment.id}`,
      kind: "experiment-open",
      title: ended
        ? `"${experiment.hypothesis.slice(0, 60)}" has reached its end date`
        : `"${experiment.hypothesis.slice(0, 60)}" has ${experiment.observations.length} observation${experiment.observations.length === 1 ? "" : "s"}`,
      detail: ended
        ? "Write the conclusion now, before the outcome starts rewriting what you remember expecting."
        : `Running for ${Math.round(age)} days. An experiment with too few observations cannot conclude anything, which is itself worth recording.`,
      urgency: ended ? 0.65 : 0.4,
      experimentId: experiment.id,
      actionLabel: ended ? "Conclude" : "Add observation",
    });
  }

  return rankAndCap(items, progress, now);
}

function rankAndCap(items: InboxItem[], progress: Progress, now: Date): InboxItem[] {
  const dismissed = progress.dismissed ?? {};
  const nowMs = now.getTime();

  const live = items.filter((item) => {
    const at = dismissed[item.key];
    if (!at) return true;
    return (nowMs - new Date(at).getTime()) / 864e5 > DISMISS_TTL_DAYS;
  });

  live.sort((a, b) => b.urgency - a.urgency);

  // Caps per kind so one noisy category cannot fill the whole queue. Without
  // this, a user returning after two months off sees forty retention rows and
  // nothing else — which is exactly when the other item kinds matter most.
  const counts = new Map<InboxKind, number>();
  const capped: InboxItem[] = [];
  for (const item of live) {
    const seen = counts.get(item.kind) ?? 0;
    const cap = KIND_CAP[item.kind] ?? Infinity;
    if (seen >= cap) continue;
    counts.set(item.kind, seen + 1);
    capped.push(item);
  }

  return capped;
}

export interface InboxSummary {
  total: number;
  byKind: Record<string, number>;
  headline: string;
}

export function summariseInbox(items: InboxItem[]): InboxSummary {
  const byKind: Record<string, number> = {};
  for (const item of items) byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;

  let headline: string;
  if (items.length === 0) {
    headline = "Nothing needs attention. Train something new, or stop for today.";
  } else {
    const top = items[0];
    headline = `${items.length} item${items.length === 1 ? "" : "s"}. Most urgent: ${top.title.toLowerCase()}.`;
  }

  return { total: items.length, byKind, headline };
}

/** Node ids implicated by the inbox, for highlighting them on the map. */
export function inboxNodeIds(items: InboxItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) if (item.nodeId) ids.add(item.nodeId);
  return ids;
}

/** Goal helper: has this goal seen any activity in the window? */
export function goalIsActive(goal: Goal, model: LearnerModel, days = 14): boolean {
  const cutoff = Date.now() - days * 864e5;
  return goal.nodeIds.some((id) => {
    const at = model.retentionByNodeId[id]?.lastTrainedAt;
    return at ? new Date(at).getTime() >= cutoff : false;
  });
}
