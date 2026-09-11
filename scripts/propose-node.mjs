/**
 * Curriculum proposal tooling.
 *
 * Growth of the canonical core is meant to be deliberate and rare. This script
 * takes a proposed node as JSON and reports what a reviewer would otherwise
 * have to work out by hand: whether it overlaps something that already exists,
 * where it would sit, what it could plausibly build on, and what the entry is
 * still missing.
 *
 *   node scripts/propose-node.mjs proposal.json
 *   node scripts/propose-node.mjs --template > proposal.json
 *
 * It never writes to the curriculum. The output is a review aid, and a passing
 * report is not an argument for inclusion — the bar is that the core cannot do
 * its job without the node.
 */
import { readFileSync } from "node:fs";

const data = JSON.parse(
  readFileSync(new URL("../data/intelligenceData.json", import.meta.url), "utf8"),
);

const TEMPLATE = {
  id: "cat-short-name",
  categoryId: "one of the existing category ids",
  label: "Human Readable Name",
  tier: 1,
  kind: "competency",
  constructs: ["fluid-reasoning"],
  description:
    "What the construct is, precisely. Specific enough that a reader could tell whether they have it.",
  why: "Why it is worth training, and why the core is worse without it.",
  evidence: {
    constructValidity: "moderate",
    trainability: "moderate",
    transferEvidence: "emerging",
    evidenceConfidence: "moderate",
    evidenceUpdatedAt: new Date().toISOString().slice(0, 10),
    measurementMethod: "How this would actually be measured, including if it cannot be.",
    knownLimitations: "What training this will NOT do. Required.",
    sources: [{ title: "Author (Year), Title", type: "paper" }],
  },
  resources: [{ title: "A good starting point", type: "book" }],
  exercises: [
    {
      id: "cat-short-name-1",
      label: "A concrete task with a checkable success criterion",
      xp: 15,
      cadence: "weekly",
      difficulty: 3,
      evidence: "artifact",
      minutes: 25,
      progression: ["One step harder"],
    },
  ],
  proposedLinks: [
    {
      source: "an-existing-node-id",
      target: "cat-short-name",
      relation: "prerequisite",
      strength: 0.6,
      confidence: "moderate",
      mechanism: "By what mechanism the source moves the target.",
    },
  ],
};

if (process.argv.includes("--template")) {
  console.log(JSON.stringify(TEMPLATE, null, 2));
  process.exit(0);
}

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/propose-node.mjs <proposal.json>");
  console.error("       node scripts/propose-node.mjs --template > proposal.json");
  process.exit(2);
}

const proposal = JSON.parse(readFileSync(file, "utf8"));

// ── Text similarity, for overlap detection ────────────────────────────────
const STOP = new Set(
  "the a an and or of to in for on with is are be as that this it you your from by at into over under not no than then which what how when why".split(
    " ",
  ),
);

function terms(text) {
  return new Set(
    String(text ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !STOP.has(word)),
  );
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const term of a) if (b.has(term)) shared += 1;
  return shared / (a.size + b.size - shared);
}

const proposalTerms = terms(`${proposal.label} ${proposal.description} ${proposal.why}`);

const overlaps = data.nodes
  .map((node) => ({
    node,
    score: jaccard(proposalTerms, terms(`${node.label} ${node.description} ${node.why}`)),
  }))
  .filter((entry) => entry.score > 0.08)
  .sort((a, b) => b.score - a.score)
  .slice(0, 6);

// ── Completeness ──────────────────────────────────────────────────────────
const missing = [];
const required = [
  ["id", proposal.id],
  ["categoryId", proposal.categoryId],
  ["label", proposal.label],
  ["kind", proposal.kind],
  ["description", proposal.description],
  ["why", proposal.why],
];
for (const [field, value] of required) {
  if (!String(value ?? "").trim()) missing.push(field);
}
if (![0, 1, 2].includes(proposal.tier)) missing.push("tier (0, 1 or 2)");
if (!Array.isArray(proposal.constructs)) missing.push("constructs");
if (!proposal.evidence) missing.push("evidence block");
else {
  for (const field of [
    "constructValidity",
    "trainability",
    "transferEvidence",
    "measurementMethod",
    "knownLimitations",
  ]) {
    if (!String(proposal.evidence[field] ?? "").trim()) missing.push(`evidence.${field}`);
  }
  if (!proposal.evidence.sources?.length) missing.push("evidence.sources");
}
if (!proposal.exercises?.length) missing.push("exercises");
if (!proposal.resources?.length) missing.push("resources");

// ── Graph placement ───────────────────────────────────────────────────────
const categoryIds = new Set(data.categories.map((category) => category.id));
const nodeIds = new Set(data.nodes.map((node) => node.id));
const problems = [];

if (nodeIds.has(proposal.id)) problems.push(`id "${proposal.id}" already exists`);
if (proposal.categoryId && !categoryIds.has(proposal.categoryId)) {
  problems.push(`unknown categoryId "${proposal.categoryId}"`);
}

for (const link of proposal.proposedLinks ?? []) {
  const other = link.source === proposal.id ? link.target : link.source;
  if (!nodeIds.has(other)) problems.push(`proposed link references unknown node "${other}"`);
  if (link.source !== proposal.id && link.target !== proposal.id) {
    problems.push(`proposed link ${link.source}->${link.target} does not touch this node`);
  }
  if (!link.mechanism?.trim()) {
    problems.push(`proposed link ${link.source}->${link.target} has no mechanism`);
  }
}

if (!(proposal.proposedLinks ?? []).length) {
  problems.push("no proposed links — an unconnected node floats and cannot be planned around");
}

// Candidate prerequisites: same category, lower tier, overlapping vocabulary.
const candidates = data.nodes
  .filter((node) => node.categoryId === proposal.categoryId && node.tier < (proposal.tier ?? 1))
  .map((node) => ({
    node,
    score: jaccard(proposalTerms, terms(`${node.label} ${node.description}`)),
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 4);

// ── Report ────────────────────────────────────────────────────────────────
const line = (text = "") => console.log(text);

line(`\nProposal: ${proposal.label ?? "(unnamed)"} (${proposal.id ?? "no id"})`);
line("=".repeat(60));

line("\nOverlap with the existing core");
if (overlaps.length === 0) {
  line("  No meaningful overlap found.");
} else {
  for (const { node, score } of overlaps) {
    const flag = score > 0.3 ? "  HIGH" : score > 0.18 ? "  med " : "  low ";
    line(`${flag} ${(score * 100).toFixed(0)}%  ${node.label} (${node.id})`);
  }
  if (overlaps[0].score > 0.3) {
    line(
      "\n  The strongest match is high. Make the case that this is a distinct construct,\n  or propose narrowing the existing node instead of adding a new one.",
    );
  }
}

line("\nCandidate prerequisites in the same cluster");
if (candidates.length === 0) line("  None found — check the category and tier.");
else for (const { node } of candidates) line(`  ${node.label} (${node.id})`);

line("\nCompleteness");
if (missing.length === 0) line("  All required fields present.");
else for (const field of missing) line(`  MISSING  ${field}`);

line("\nGraph problems");
if (problems.length === 0) line("  None.");
else for (const problem of problems) line(`  ERROR  ${problem}`);

const size = data.nodes.length;
line("\nCore size");
line(`  ${size} nodes today; ${size + 1} with this one. The ceiling is 140.`);
if (size + 1 > 140) {
  line("  Over the ceiling. Something has to be merged or removed, or this belongs in a pack.");
}

line("\nThe actual bar");
line(
  "  A clean report is not an argument for inclusion. The question a reviewer asks is\n" +
    "  whether the core is measurably worse at describing general cognitive capability\n" +
    "  without this node. Domain expertise belongs in a skill pack; a narrower framing of\n" +
    "  something that already exists belongs in that node's description.",
);
line();

const failing = missing.length + problems.length;
process.exit(failing > 0 ? 1 : 0);
