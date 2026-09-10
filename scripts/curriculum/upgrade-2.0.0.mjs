/**
 * One-shot upgrade of data/intelligenceData.json from curriculum 1.0.0 to
 * 2.0.0. Kept in the repository as the record of how the ontology changed;
 * it is idempotent, so re-running it on an already-upgraded file is a no-op
 * apart from re-deriving computed fields.
 *
 *   node scripts/curriculum/upgrade-2.0.0.mjs
 *
 * Afterwards: npm run bake:layout && npm run check:data
 */
import { readFileSync, writeFileSync } from "node:fs";
import { cite } from "./citations.mjs";
import { NODE_META } from "./node-meta.mjs";
import { NEW_CATEGORIES, NEW_NODES } from "./new-nodes.mjs";
import { NEW_LINKS } from "./new-links.mjs";

const DATA_URL = new URL("../../data/intelligenceData.json", import.meta.url);
const EVIDENCE_REVIEWED = "2026-09-10";
const CURRICULUM_VERSION = "2.0.0";

const ORDER = ["speculative", "emerging", "moderate", "strong"];
const rank = (band) => ORDER.indexOf(band);

/** Mirrors lib/evidence.ts overallConfidence — keep the two in step. */
function overall(cv, tr, tx) {
  const base = rank(rank(cv) <= rank(tr) ? cv : tr);
  return ORDER[Math.max(0, Math.min(base, rank(tx) + 1, 3))];
}

function buildEvidence({ bands, measure, limits, cite: keys }) {
  const [cv, tr, tx] = bands.split("/");
  for (const band of [cv, tr, tx]) {
    if (!ORDER.includes(band)) throw new Error(`bad confidence band: ${band}`);
  }
  return {
    constructValidity: cv,
    trainability: tr,
    transferEvidence: tx,
    evidenceConfidence: overall(cv, tr, tx),
    evidenceUpdatedAt: EVIDENCE_REVIEWED,
    measurementMethod: measure,
    knownLimitations: limits,
    sources: cite(keys),
  };
}

const data = JSON.parse(readFileSync(DATA_URL, "utf8"));

// ── 1. Categories ─────────────────────────────────────────────────────────
const existingCategoryIds = new Set(data.categories.map((c) => c.id));
for (const category of NEW_CATEGORIES) {
  if (!existingCategoryIds.has(category.id)) data.categories.push(category);
}

// ── 2. Backfill evidence metadata onto the original nodes ─────────────────
let annotated = 0;
for (const node of data.nodes) {
  const meta = NODE_META[node.id];
  if (!meta) continue;
  const [kind, constructs, bands, measure, limits, keys, retention] = meta;
  node.kind = kind;
  node.constructs = constructs;
  if (retention) node.retentionModel = retention;
  else delete node.retentionModel;
  node.evidence = buildEvidence({ bands, measure, limits, cite: keys });
  annotated += 1;
}

// ── 3. Difficulty + evidence kind for legacy exercises ────────────────────
/**
 * Legacy exercises carry no difficulty. Rather than guessing per task, derive
 * a defensible anchor from XP and cadence — the original author already used
 * XP as an effort proxy — and mark tasks that produce written work as
 * artifact evidence via the same predicate the UI uses to decide typability.
 */
const TYPABLE =
  /\b(write|rewrite|explain|argue|map|identify|find|name|list|summari[sz]e|predict|estimate|prove|derive|describe|reflect|journal|answer|outline|compare|design|plan|score|record.*notes?|sentence|paragraph|premise|claim|calibration)\b/i;

function anchorDifficulty(exercise) {
  if (exercise.xp >= 24) return 4;
  if (exercise.xp >= 18) return 3;
  if (exercise.xp >= 11) return 2;
  return 1;
}

for (const node of data.nodes) {
  for (const exercise of node.exercises) {
    if (exercise.difficulty === undefined) {
      exercise.difficulty = anchorDifficulty(exercise);
    }
    if (exercise.evidence === undefined) {
      exercise.evidence = TYPABLE.test(exercise.label) ? "artifact" : "self-report";
    }
  }
}

// ── 4. Append the new nodes ───────────────────────────────────────────────
const existingNodeIds = new Set(data.nodes.map((node) => node.id));
let added = 0;
for (const spec of NEW_NODES) {
  if (existingNodeIds.has(spec.id)) continue;
  const node = {
    id: spec.id,
    categoryId: spec.categoryId,
    label: spec.label,
    tier: spec.tier,
    kind: spec.kind,
    constructs: spec.constructs,
    description: spec.desc,
    why: spec.why,
    resources: spec.res.map(([title, type, url]) =>
      url ? { title, type, url } : { title, type },
    ),
    exercises: spec.ex.map((exercise, index) => ({
      id: `${spec.id}-${index + 1}`,
      label: exercise.label,
      xp: exercise.xp,
      cadence: exercise.cadence,
      difficulty: exercise.difficulty,
      evidence: exercise.evidence,
      minutes: exercise.minutes,
      progression: exercise.progression,
    })),
    evidence: buildEvidence({
      bands: spec.bands,
      measure: spec.measure,
      limits: spec.limits,
      cite: spec.cite,
    }),
  };
  if (spec.retention) node.retentionModel = spec.retention;
  data.nodes.push(node);
  added += 1;
}

// ── 5. Enrich legacy links, then append the new ones ──────────────────────
/**
 * The original 188 edges were hand-drawn by a curriculum author, not derived
 * from a literature review. They are annotated to say exactly that: a
 * prerequisite edge gets moderate confidence, a synergy edge gets emerging,
 * and neither claims a mechanism it cannot back up. Mechanisms are required
 * for every relation type where the label alone does not carry the meaning.
 */
for (const link of data.links) {
  if (link.relation) continue;
  if (link.type === "prereq") {
    link.relation = "prerequisite";
    link.strength = 0.6;
    link.confidence = "moderate";
  } else {
    link.relation = "synergy";
    link.strength = 0.35;
    link.confidence = "emerging";
  }
}

const linkKey = (a, b) => [a, b].sort().join("::");
const seen = new Set(data.links.map((link) => linkKey(link.source, link.target)));
let newEdges = 0;
for (const link of NEW_LINKS) {
  const key = linkKey(link.source, link.target);
  if (seen.has(key)) {
    console.warn(`skip duplicate edge ${link.source} -- ${link.target}`);
    continue;
  }
  seen.add(key);
  data.links.push(link);
  newEdges += 1;
}

// ── 6. Version + field ordering ───────────────────────────────────────────
data.curriculumVersion = CURRICULUM_VERSION;

const NODE_FIELD_ORDER = [
  "id",
  "categoryId",
  "label",
  "tier",
  "kind",
  "constructs",
  "retentionModel",
  "description",
  "why",
  "evidence",
  "resources",
  "exercises",
];
data.nodes = data.nodes.map((node) => {
  const ordered = {};
  for (const key of NODE_FIELD_ORDER) {
    if (node[key] !== undefined) ordered[key] = node[key];
  }
  for (const key of Object.keys(node)) {
    if (!(key in ordered)) ordered[key] = node[key];
  }
  return ordered;
});

const ordered = {
  version: data.version,
  curriculumVersion: data.curriculumVersion,
  categories: data.categories,
  nodes: data.nodes,
  links: data.links,
};

writeFileSync(DATA_URL, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");

console.log(
  [
    `curriculum ${CURRICULUM_VERSION}`,
    `${data.categories.length} categories (+${NEW_CATEGORIES.length})`,
    `${data.nodes.length} nodes (+${added}, ${annotated} backfilled)`,
    `${data.links.length} links (+${newEdges})`,
  ].join("\n  "),
);
