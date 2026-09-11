import { curriculum, missions, paths } from "./curriculum.ts";
import { PROBES } from "./diagnostics.ts";
import { KIND_LABEL } from "./evidence.ts";
import type { ConceptNode, PersonalNode } from "./types.ts";

/**
 * Search that understands what the user is looking for.
 *
 * Matching node labels alone fails on the most common query shape: people
 * search for the problem — "procrastination", "overconfident", "I keep
 * forgetting things" — rather than for the curriculum's name for the
 * capability. The synonym table closes that gap.
 *
 * It is a plain lookup rather than an embedding model, deliberately: it runs
 * with nothing downloaded, a wrong result is visibly wrong, and the mapping is
 * inspectable and editable by anyone who disagrees with it.
 */

/**
 * Query terms that should surface nodes whose text never contains them.
 *
 * Kept small and specific on purpose. A large fuzzy synonym list makes every
 * query return everything, which is worse than a query returning nothing.
 */
const SYNONYMS: Record<string, string[]> = {
  procrastination: ["exec-initiation", "eqr-habit-design", "exec-goal-maintenance"],
  procrastinating: ["exec-initiation", "eqr-habit-design"],
  procrastinate: ["exec-initiation", "eqr-habit-design"],
  focus: ["intra-attention", "exec-goal-maintenance", "gwm-dual-task"],
  distracted: ["intra-attention", "exec-goal-maintenance", "exec-inhibition"],
  adhd: ["intra-attention", "exec-initiation", "exec-goal-maintenance", "exec-planning"],
  forgetting: ["gc-spaced-repetition", "gc-retrieval-practice", "gc-memory-palace"],
  forget: ["gc-spaced-repetition", "gc-retrieval-practice"],
  memory: ["gwm-span", "gc-retrieval-practice", "gc-memory-palace", "gwm-chunking"],
  overconfident: ["dec-calibration", "eqa-bias-awareness", "intra-metacognition"],
  overconfidence: ["dec-calibration", "eqa-bias-awareness"],
  bias: ["eqa-bias-awareness", "epi-falsification", "epi-evidence-eval"],
  anxiety: ["eqr-reappraisal", "eqr-distress-tolerance", "kin-breath"],
  anxious: ["eqr-reappraisal", "eqr-distress-tolerance", "kin-breath"],
  angry: ["eqr-impulse-control", "eqr-reappraisal", "eqa-trigger-mapping"],
  burnout: ["eqr-recovery", "str-resource-allocation", "str-prioritization"],
  sleep: ["eqr-recovery"],
  creativity: ["cre-divergent", "cre-combination", "cre-reframing"],
  stuck: ["cre-reframing", "gf-novel-problem", "aug-decomposition"],
  overwhelmed: ["str-prioritization", "aug-decomposition", "gwm-dual-task"],
  interview: ["ling-speaking", "gf-novel-problem", "log-algorithmic", "inter-perspective"],
  interviews: ["ling-speaking", "gf-novel-problem", "log-algorithmic"],
  negotiation: ["inter-negotiation", "inter-perspective", "eqr-reappraisal"],
  statistics: ["gc-quantitative-literacy", "log-probability", "epi-evidence-eval"],
  misinformation: ["epi-source-reliability", "epi-evidence-eval"],
  ai: ["aug-ai-collaboration", "aug-verification"],
  llm: ["aug-ai-collaboration", "aug-verification"],
  chatgpt: ["aug-ai-collaboration", "aug-verification"],
  decisions: ["dec-expected-value", "dec-journal", "dec-reversibility"],
  reading: ["ling-reading", "ling-vocab-depth", "epi-evidence-eval"],
  writing: ["ling-writing", "ling-rhetoric", "ling-vocab-depth"],
  maths: ["log-proof", "gc-quantitative-literacy", "log-probability"],
  math: ["log-proof", "gc-quantitative-literacy", "log-probability"],
  learning: ["lrn-practice-design", "gc-retrieval-practice", "lrn-difficulty"],
  studying: ["lrn-practice-design", "gc-spaced-repetition", "gc-interleaving"],
};

export type ResultKind = "node" | "path" | "mission" | "probe";

export interface SearchResult {
  kind: ResultKind;
  id: string;
  label: string;
  detail: string;
  /** Higher is better. */
  score: number;
  /** Why this matched, shown when it is not obvious from the label. */
  matchedOn?: string;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
}

/**
 * Searches capabilities, paths, missions and probes together.
 *
 * Ranked so a label hit always beats a description hit, with synonym hits in
 * between: someone typing "procrastination" wants Task Initiation before they
 * want a node whose description happens to contain the word.
 */
export function search(
  query: string,
  personalNodes: PersonalNode[] = [],
  limit = 12,
): SearchResult[] {
  const raw = query.trim().toLowerCase();
  if (raw.length < 2) return [];
  const queryTokens = tokens(raw);

  const results = new Map<string, SearchResult>();
  const add = (result: SearchResult) => {
    const key = `${result.kind}:${result.id}`;
    const existing = results.get(key);
    if (!existing || existing.score < result.score) results.set(key, result);
  };

  const scoreNode = (node: ConceptNode | PersonalNode, isPersonal: boolean) => {
    const label = node.label.toLowerCase();
    const why = "why" in node ? node.why : "";
    const haystack = `${node.label} ${node.description} ${why}`.toLowerCase();

    let score = 0;
    let matchedOn: string | undefined;
    if (label === raw) score = 100;
    else if (label.startsWith(raw)) score = 80;
    else if (label.includes(raw)) score = 60;
    else if (haystack.includes(raw)) {
      score = 30;
      matchedOn = "description";
    } else {
      const hits = queryTokens.filter((token) => haystack.includes(token)).length;
      if (hits > 0) {
        score = 10 + hits * 4;
        matchedOn = "description";
      }
    }

    if (score === 0) return;
    add({
      kind: "node",
      id: node.id,
      label: node.label,
      detail: isPersonal
        ? "Personal capability"
        : KIND_LABEL[(node as ConceptNode).kind ?? "competency"],
      score,
      matchedOn,
    });
  };

  for (const node of curriculum.nodes) scoreNode(node, false);
  for (const node of personalNodes) scoreNode(node, true);

  for (const [term, nodeIds] of Object.entries(SYNONYMS)) {
    if (!raw.includes(term) && !queryTokens.includes(term)) continue;
    for (const id of nodeIds) {
      const node = curriculum.nodes.find((candidate) => candidate.id === id);
      if (!node) continue;
      add({
        kind: "node",
        id: node.id,
        label: node.label,
        detail: KIND_LABEL[node.kind ?? "competency"],
        score: 50,
        matchedOn: `"${term}"`,
      });
    }
  }

  for (const path of paths) {
    const haystack = `${path.label} ${path.blurb} ${path.outcome}`.toLowerCase();
    if (!haystack.includes(raw)) continue;
    add({
      kind: "path",
      id: path.id,
      label: path.label,
      detail: `Path · ${path.nodeIds.length} capabilities`,
      score: path.label.toLowerCase().includes(raw) ? 70 : 25,
    });
  }

  for (const mission of missions) {
    const haystack = `${mission.label} ${mission.blurb}`.toLowerCase();
    if (!haystack.includes(raw)) continue;
    add({
      kind: "mission",
      id: mission.id,
      label: mission.label,
      detail: `Mission · ${mission.estimatedMinutes} min`,
      score: mission.label.toLowerCase().includes(raw) ? 65 : 22,
    });
  }

  for (const probe of PROBES) {
    const haystack = `${probe.label} ${probe.blurb}`.toLowerCase();
    if (!haystack.includes(raw)) continue;
    add({
      kind: "probe",
      id: probe.id,
      label: probe.label,
      detail: "Diagnostic probe",
      score: probe.label.toLowerCase().includes(raw) ? 65 : 22,
    });
  }

  return [...results.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Node ids matching a query, for dimming the map. */
export function matchingNodeIdsFor(
  query: string,
  personalNodes: PersonalNode[] = [],
): Set<string> {
  return new Set(
    search(query, personalNodes, 400)
      .filter((result) => result.kind === "node")
      .map((result) => result.id),
  );
}
