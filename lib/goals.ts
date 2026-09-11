import { curriculum, nodesById, paths, pathsById, type Path } from "./curriculum.ts";
import { directPrerequisites } from "./graph-intel.ts";
import type { LearnerModel } from "./learner.ts";
import type { Goal } from "./types.ts";

/**
 * Goals and multi-week plans.
 *
 * A goal is a named subset of the graph plus a schedule. The work here is
 * turning a sentence like "become a better writer" into a defensible ordering:
 * which nodes, in what sequence, with which prerequisites pulled in, and how
 * long it plausibly takes at the user's stated weekly budget.
 *
 * The ordering is a topological sort over prerequisite edges, broken by
 * competence gap, so the plan starts where the foundations are weakest rather
 * than where the path author happened to put node one.
 */

export interface GoalSuggestion {
  path: Path;
  /** 0-1 how well the phrase matches this path. */
  match: number;
  matchedOn: string[];
}

/**
 * Keyword routing from a free-text goal to curated paths.
 *
 * Deliberately a keyword index rather than an embedding model: it runs locally
 * with no download, it is inspectable, and when it fails it fails visibly
 * instead of confidently returning the wrong path.
 *
 * Entries ending in `*` match a word prefix; everything else must match a whole
 * word. Substring matching over the raw phrase looked simpler and was wrong —
 * "become a better writer" matched the decision path, because "better" contains
 * "bet". Short stems in particular have to be anchored.
 */
const PATH_KEYWORDS: Record<string, string[]> = {
  "path-learn-faster": ["learn*", "study*", "memor*", "remember*", "retain*", "retention", "revision", "exam*", "school", "course*"],
  "path-better-thinker": ["think*", "thought", "reason*", "logic*", "argu*", "critical", "rational*", "clearly"],
  "path-scientist": ["scien*", "research*", "experiment*", "evidence", "hypothes*", "academ*", "phd", "lab", "replicat*"],
  "path-persuasive": ["persua*", "convince", "convincing", "influen*", "present*", "pitch*", "speak*", "speech", "sell", "selling", "communicat*"],
  "path-creative-output": ["creat*", "idea*", "invent*", "design*", "art", "artist*", "music*", "innovat*", "imagination"],
  "path-emotional-regulation": ["emotion*", "regulat*", "calm*", "anger", "angry", "anxiet*", "anxious", "stress*", "reactiv*", "temper", "mood*"],
  "path-math-reasoning": ["math*", "quantitat*", "statistic*", "algebra*", "calculus", "proof*", "numbers", "data"],
  "path-founder": ["found*", "startup*", "business*", "company", "entrepreneur*", "leader*", "manag*", "ceo"],
  "path-ai-augmented": ["ai", "llm*", "tools", "tooling", "automat*", "prompt*", "copilot", "productiv*"],
  "path-decision-quality": ["decis*", "decide", "deciding", "choos*", "judgement", "judgment", "forecast*", "predict*", "betting", "wager*", "risk*"],
  "path-executive-function": ["focus*", "attention", "procrastinat*", "adhd", "distract*", "discipline", "habit*", "starting"],
  "path-writing": ["writ*", "prose", "essay*", "blog*", "report*", "author*", "editing"],
};

/** Tokenises a phrase the same way the keyword matcher expects. */
function tokenise(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function keywordMatches(keyword: string, tokens: string[]): boolean {
  if (keyword.endsWith("*")) {
    const stem = keyword.slice(0, -1);
    return tokens.some((token) => token.startsWith(stem));
  }
  return tokens.includes(keyword);
}

export function suggestPaths(phrase: string, limit = 3): GoalSuggestion[] {
  const text = phrase.toLowerCase();
  if (!text.trim()) return [];
  const tokens = tokenise(phrase);

  const scored: GoalSuggestion[] = [];
  for (const path of paths) {
    const keywords = PATH_KEYWORDS[path.id] ?? [];
    const matchedOn = keywords
      .filter((keyword) => keywordMatches(keyword, tokens))
      .map((keyword) => keyword.replace(/\*$/, ""));
    // The path's own label and outcome are searched too, so a user typing the
    // path's name gets it back even if no keyword fires.
    const labelHit = text.includes(path.label.toLowerCase()) ? 1 : 0;
    if (matchedOn.length === 0 && !labelHit) continue;
    scored.push({
      path,
      match: Math.min(1, matchedOn.length * 0.34 + labelHit),
      matchedOn: labelHit ? [...matchedOn, path.label] : matchedOn,
    });
  }

  return scored.sort((a, b) => b.match - a.match).slice(0, limit);
}

export interface PlanStep {
  nodeId: string;
  label: string;
  /** 1-based week this step is scheduled to start. */
  week: number;
  competence: number;
  /** Estimated minutes of practice to reach the target competence. */
  estimatedMinutes: number;
  /** Why this step sits where it does. */
  reason: string;
  /** Prerequisites pulled in that were not in the original node set. */
  addedAsPrerequisite: boolean;
  blocked: string[];
}

export interface GoalPlan {
  goalId: string;
  label: string;
  steps: PlanStep[];
  weeks: number;
  weeklyMinutes: number;
  /** Mean competence across the goal's target nodes, 0-1. */
  progress: number;
  nextAction: PlanStep | null;
  blockers: string[];
  caveat: string;
}

/** Rough minutes of practice to move one node a meaningful amount. */
const MINUTES_PER_NODE = 120;
const TARGET_COMPETENCE = 0.55;

/**
 * Expands a node set with the prerequisites it actually needs.
 *
 * Only weak prerequisites are pulled in — there is no point scheduling a
 * foundation the user already has — and only one level up, because transitively
 * closing the prerequisite graph on a twelve-node path produces a fifty-step
 * plan nobody will ever start.
 */
export function expandWithPrerequisites(
  nodeIds: string[],
  model: LearnerModel,
  threshold = 0.3,
): { ids: string[]; added: Set<string> } {
  const set = new Set(nodeIds);
  const added = new Set<string>();
  for (const id of nodeIds) {
    for (const prerequisite of directPrerequisites(id)) {
      if (set.has(prerequisite)) continue;
      if ((model.estimates[prerequisite]?.competence ?? 0) >= threshold) continue;
      set.add(prerequisite);
      added.add(prerequisite);
    }
  }
  return { ids: [...set], added };
}

/**
 * Orders a node set so prerequisites come first.
 *
 * Kahn's algorithm over the prerequisite edges inside the set, with ties broken
 * by competence gap so the weakest foundation goes first. Any cycle — which the
 * curriculum validator forbids, but a personal node could introduce — degrades
 * to the original order rather than dropping nodes.
 */
export function orderByPrerequisite(nodeIds: string[], model: LearnerModel): string[] {
  const inside = new Set(nodeIds);
  const indegree = new Map<string, number>();
  const edges = new Map<string, string[]>();

  for (const id of nodeIds) indegree.set(id, 0);
  for (const link of curriculum.links) {
    const relation = link.relation ?? (link.type === "prereq" ? "prerequisite" : "synergy");
    if (relation !== "prerequisite" && relation !== "enabling") continue;
    if (!inside.has(link.source) || !inside.has(link.target)) continue;
    edges.set(link.source, [...(edges.get(link.source) ?? []), link.target]);
    indegree.set(link.target, (indegree.get(link.target) ?? 0) + 1);
  }

  const gap = (id: string) => 1 - (model.estimates[id]?.competence ?? 0);
  const ready = nodeIds
    .filter((id) => (indegree.get(id) ?? 0) === 0)
    .sort((a, b) => gap(b) - gap(a));
  const ordered: string[] = [];

  while (ready.length > 0) {
    const id = ready.shift()!;
    ordered.push(id);
    for (const next of edges.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) {
        ready.push(next);
        ready.sort((a, b) => gap(b) - gap(a));
      }
    }
  }

  if (ordered.length !== nodeIds.length) {
    // A cycle exists. Append the stragglers rather than losing them.
    for (const id of nodeIds) if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

export function buildGoalPlan(goal: Goal, model: LearnerModel): GoalPlan {
  const path = goal.pathId ? pathsById.get(goal.pathId) : undefined;
  const base = goal.nodeIds.length > 0 ? goal.nodeIds : (path?.nodeIds ?? []);
  const { ids, added } = expandWithPrerequisites(base, model);
  const ordered = orderByPrerequisite(ids, model);

  const weeklyMinutes = goal.weeklyMinutes ?? 90;
  let cumulativeMinutes = 0;
  const steps: PlanStep[] = ordered.map((nodeId) => {
    const node = nodesById.get(nodeId);
    const competence = model.estimates[nodeId]?.competence ?? 0;
    const remaining = Math.max(0, TARGET_COMPETENCE - competence) / TARGET_COMPETENCE;
    const estimatedMinutes = Math.round(MINUTES_PER_NODE * remaining);
    const week = Math.max(1, Math.ceil((cumulativeMinutes + 1) / Math.max(30, weeklyMinutes)));
    cumulativeMinutes += estimatedMinutes;

    const blocked = directPrerequisites(nodeId).filter(
      (id) => (model.estimates[id]?.competence ?? 0) < 0.25,
    );

    return {
      nodeId,
      label: node?.label ?? nodeId,
      week,
      competence,
      estimatedMinutes,
      addedAsPrerequisite: added.has(nodeId),
      blocked,
      reason: added.has(nodeId)
        ? `Pulled in as a prerequisite: it is at ${Math.round(competence * 100)}% and something on your path depends on it.`
        : competence >= TARGET_COMPETENCE
          ? `Already past the ${Math.round(TARGET_COMPETENCE * 100)}% target — scheduled only for maintenance.`
          : `At ${Math.round(competence * 100)}%, needing roughly ${estimatedMinutes} minutes of practice to reach the target.`,
    };
  });

  const targetSteps = steps.filter((step) => !step.addedAsPrerequisite);
  const progress =
    targetSteps.length === 0
      ? 0
      : targetSteps.reduce(
          (sum, step) => sum + Math.min(1, step.competence / TARGET_COMPETENCE),
          0,
        ) / targetSteps.length;

  const nextAction =
    steps.find((step) => step.competence < TARGET_COMPETENCE && step.blocked.length === 0) ??
    steps.find((step) => step.competence < TARGET_COMPETENCE) ??
    null;

  const blockers = steps
    .filter((step) => step.blocked.length > 0)
    .slice(0, 3)
    .map(
      (step) =>
        `${step.label} is blocked by ${step.blocked
          .map((id) => nodesById.get(id)?.label ?? id)
          .join(", ")}`,
    );

  const weeks = Math.max(1, steps.length > 0 ? steps[steps.length - 1].week : 1);

  return {
    goalId: goal.id,
    label: goal.label,
    steps,
    weeks,
    weeklyMinutes,
    progress,
    nextAction,
    blockers,
    caveat: `The schedule assumes roughly ${MINUTES_PER_NODE} minutes of focused practice moves one capability to ${Math.round(TARGET_COMPETENCE * 100)}%. That figure is a planning convenience, not a measured rate — it will be wrong for you, in both directions, depending on the node.`,
  };
}

/** A starting node set for a goal typed as free text. */
export function seedNodesForPhrase(phrase: string): { nodeIds: string[]; pathId?: string } {
  const [best] = suggestPaths(phrase, 1);
  if (best) return { nodeIds: best.path.nodeIds, pathId: best.path.id };

  // No path matched. Fall back to a literal search over node labels and
  // descriptions so a specific request still lands somewhere sensible.
  const text = phrase.toLowerCase();
  const terms = text.split(/\s+/).filter((term) => term.length > 3);
  const hits = curriculum.nodes
    .map((node) => {
      const haystack = `${node.label} ${node.description}`.toLowerCase();
      const score = terms.filter((term) => haystack.includes(term)).length;
      return { node, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return { nodeIds: hits.map((entry) => entry.node.id) };
}
