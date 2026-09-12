/**
 * Schema + referential-integrity gate for the hand-authored curriculum.
 *
 * Curriculum entries are treated like code: an incomplete node fails the build
 * rather than shipping a plausible-looking gap. A dangling link id also fails
 * silently at runtime (d3-force throws, or the edge just vanishes), so it is
 * worth catching here instead.
 *
 *   npm run check:data
 */
import { readFileSync } from "node:fs";

const data = JSON.parse(
  readFileSync(new URL("../data/intelligenceData.json", import.meta.url), "utf8"),
);

const errors = [];
const warnings = [];

const err = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

// ── Vocabularies ──────────────────────────────────────────────────────────
const DOMAINS = new Set([
  "gardner",
  "eq",
  "fluid",
  "crystallized",
  "executive",
  "epistemic",
  "generative",
  "strategic",
]);
const KINDS = new Set([
  "ability",
  "meta",
  "competency",
  "knowledge",
  "enabler",
  "social",
  "augmentation",
]);
const CONSTRUCTS = new Set([
  "fluid-reasoning",
  "crystallized-knowledge",
  "visual-processing",
  "auditory-processing",
  "working-memory",
  "processing-speed",
  "learning-retrieval",
  "quantitative",
  "reading-writing",
  "executive-control",
  "psychomotor",
  "socio-emotional",
]);
const CONFIDENCE = ["speculative", "emerging", "moderate", "strong"];
const CONFIDENCE_SET = new Set(CONFIDENCE);
const RETENTION_MODELS = new Set([
  "knowledge",
  "procedural",
  "executive-habit",
  "physical",
  "social",
  "meta",
]);
const RESOURCE_TYPES = new Set([
  "book",
  "course",
  "tool",
  "paper",
  "practice",
  "video",
]);
const CADENCES = new Set(["daily", "weekly", "session"]);
const EVIDENCE_KINDS = new Set(["self-report", "artifact", "scored", "external"]);
const LINK_TYPES = new Set(["prereq", "synergy", "inhibition"]);
const RELATIONS = new Set([
  "prerequisite",
  "enabling",
  "supporting",
  "transfer",
  "synergy",
  "analogical",
  "shared-mechanism",
  "inhibition",
]);
/** Relations whose label alone does not explain the edge. */
const MECHANISM_REQUIRED = new Set([
  "enabling",
  "transfer",
  "analogical",
  "shared-mechanism",
  "inhibition",
]);
/** relation -> the coarse visual bucket it must map to. */
const RELATION_TYPE = {
  prerequisite: "prereq",
  enabling: "prereq",
  supporting: "prereq",
  transfer: "prereq",
  synergy: "synergy",
  analogical: "synergy",
  "shared-mechanism": "synergy",
  inhibition: "inhibition",
};
/** Relations that assert a direction and therefore must not form a cycle. */
const ACYCLIC_RELATIONS = new Set(["prerequisite", "enabling"]);

const rank = (band) => CONFIDENCE.indexOf(band);

function checkResources(list, where) {
  if (!Array.isArray(list) || list.length === 0) {
    err(`${where}: needs at least one resource`);
    return;
  }
  for (const resource of list) {
    if (!resource?.title?.trim()) err(`${where}: resource with an empty title`);
    if (!RESOURCE_TYPES.has(resource?.type)) {
      err(`${where}: resource "${resource?.title}" has bad type "${resource?.type}"`);
    }
    // A missing url is intentional — those entries are citations, not links.
    if (resource?.url && !/^https:\/\//.test(resource.url)) {
      err(`${where}: resource "${resource.title}" url is not https`);
    }
  }
}

// ── Top level ─────────────────────────────────────────────────────────────
if (typeof data.version !== "number") err("top level: version must be a number");
if (!/^\d+\.\d+\.\d+$/.test(data.curriculumVersion ?? "")) {
  err(
    `top level: curriculumVersion must be semver, got ${JSON.stringify(data.curriculumVersion)}`,
  );
}

// ── Categories ────────────────────────────────────────────────────────────
const categoryIds = new Set();
for (const category of data.categories) {
  if (categoryIds.has(category.id)) err(`duplicate category id: ${category.id}`);
  categoryIds.add(category.id);
  if (!DOMAINS.has(category.domain)) {
    err(`category ${category.id}: unknown domain "${category.domain}"`);
  }
  if (typeof category.hue !== "number" || category.hue < 0 || category.hue > 360) {
    err(`category ${category.id}: hue must be 0-360, got ${category.hue}`);
  }
  if (!category.blurb?.trim()) err(`category ${category.id}: empty blurb`);
}

// ── Nodes ─────────────────────────────────────────────────────────────────
const nodeIds = new Set();
const exerciseIds = new Set();
const missingRubric = [];
let producedEvidenceCount = 0;
const nodesById = new Map();

for (const node of data.nodes) {
  const where = `node ${node.id}`;
  if (nodeIds.has(node.id)) err(`duplicate node id: ${node.id}`);
  nodeIds.add(node.id);
  nodesById.set(node.id, node);

  if (!categoryIds.has(node.categoryId)) {
    err(`${where}: unknown categoryId "${node.categoryId}"`);
  }
  if (![0, 1, 2].includes(node.tier)) {
    err(`${where}: tier must be 0, 1 or 2 — got ${node.tier}`);
  }
  if (!node.label?.trim()) err(`${where}: empty label`);
  if (!node.description?.trim()) err(`${where}: empty description`);
  if (!node.why?.trim()) err(`${where}: empty why (rationale for inclusion)`);

  if (!KINDS.has(node.kind)) err(`${where}: invalid or missing kind "${node.kind}"`);
  if (node.retentionModel && !RETENTION_MODELS.has(node.retentionModel)) {
    err(`${where}: invalid retentionModel "${node.retentionModel}"`);
  }

  if (!Array.isArray(node.constructs)) {
    err(`${where}: missing scientific classification (constructs)`);
  } else {
    // An empty list is legitimate: some nodes genuinely map onto no CHC broad
    // ability, and claiming one would be worse than admitting none.
    for (const construct of node.constructs) {
      if (!CONSTRUCTS.has(construct)) {
        err(`${where}: unknown construct "${construct}"`);
      }
    }
    if (new Set(node.constructs).size !== node.constructs.length) {
      err(`${where}: duplicate entries in constructs`);
    }
  }

  const evidence = node.evidence;
  if (!evidence) {
    err(`${where}: missing evidence block`);
  } else {
    for (const field of [
      "constructValidity",
      "trainability",
      "transferEvidence",
      "evidenceConfidence",
    ]) {
      if (!CONFIDENCE_SET.has(evidence[field])) {
        err(`${where}: evidence.${field} is not a supported band ("${evidence[field]}")`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.evidenceUpdatedAt ?? "")) {
      err(`${where}: evidence.evidenceUpdatedAt must be an ISO date`);
    }
    if (!evidence.measurementMethod?.trim()) {
      err(`${where}: evidence.measurementMethod is required`);
    }
    if (!evidence.knownLimitations?.trim()) {
      err(`${where}: evidence.knownLimitations is required — every node has limits`);
    }
    if (!Array.isArray(evidence.sources) || evidence.sources.length === 0) {
      err(`${where}: evidence.sources needs at least one reference`);
    } else {
      checkResources(evidence.sources, `${where} evidence.sources`);
      /**
       * Every citation has to be followable.
       *
       * A title and a year is an assertion that a paper exists saying what the
       * node claims, and for six entries in curriculum 2.0.0 that assertion
       * was wrong — conflated titles, invented author lists, a chapter
       * attributed to the wrong person. Those were removed. Requiring a link
       * is what stops the next one going in: a reference nobody can open is
       * not evidence, it is decoration.
       */
      for (const source of evidence.sources) {
        if (!source?.url) {
          err(
            `${where} evidence.sources: "${source?.title}" has no url — a citation nobody can follow is not a citation`,
          );
        }
      }
    }
    // The overall band must not outrun what supports it.
    const cap = Math.min(
      Math.min(rank(evidence.constructValidity), rank(evidence.trainability)),
      rank(evidence.transferEvidence) + 1,
    );
    if (rank(evidence.evidenceConfidence) > cap) {
      err(
        `${where}: evidenceConfidence "${evidence.evidenceConfidence}" is stronger than its pillars allow (max "${CONFIDENCE[Math.max(0, cap)]}")`,
      );
    }
  }

  checkResources(node.resources, where);

  if (!node.exercises?.length) err(`${where}: has no exercises`);
  for (const exercise of node.exercises ?? []) {
    const exWhere = `exercise ${exercise.id} (${node.id})`;
    if (exerciseIds.has(exercise.id)) err(`duplicate exercise id: ${exercise.id}`);
    exerciseIds.add(exercise.id);
    if (!exercise.label?.trim()) err(`${exWhere}: empty label`);
    if (!(exercise.xp > 0)) err(`${exWhere}: xp must be positive`);
    if (!CADENCES.has(exercise.cadence)) {
      err(`${exWhere}: bad cadence "${exercise.cadence}"`);
    }
    if (![1, 2, 3, 4, 5].includes(exercise.difficulty)) {
      err(`${exWhere}: difficulty must be 1-5, got ${exercise.difficulty}`);
    }
    if (!EVIDENCE_KINDS.has(exercise.evidence)) {
      err(`${exWhere}: bad evidence kind "${exercise.evidence}"`);
    }
    if (exercise.minutes !== undefined && !(exercise.minutes > 0)) {
      err(`${exWhere}: minutes must be positive when present`);
    }
    if (exercise.progression !== undefined) {
      if (!Array.isArray(exercise.progression) || exercise.progression.length === 0) {
        err(`${exWhere}: progression must be a non-empty array when present`);
      } else if (exercise.progression.some((step) => !step?.trim())) {
        err(`${exWhere}: progression contains an empty step`);
      }
    }

    if (exercise.rubric !== undefined) {
      if (!Array.isArray(exercise.rubric) || exercise.rubric.length < 2) {
        err(`${exWhere}: rubric must be an array of at least two checks when present`);
      } else if (exercise.rubric.some((check) => !check?.trim())) {
        err(`${exWhere}: rubric contains an empty check`);
      } else if (exercise.rubric.length > 4) {
        err(`${exWhere}: rubric has ${exercise.rubric.length} checks; four is the ceiling`);
      }
    }

    // Only evidence-producing work needs a standard. A self-reported tick is
    // already labelled as barely evidence and a checklist would not change it.
    const producesEvidence =
      exercise.evidence === "artifact" || exercise.evidence === "scored";
    if (producesEvidence) {
      producedEvidenceCount += 1;
      if (!exercise.rubric) missingRubric.push(exercise.id);
    }
  }
}

/**
 * Exercises that produce evidence but state no standard for it.
 *
 * A long answer and a two-line answer weigh the same to the competence model,
 * so without a checklist the only standard is how generous the person is
 * feeling. Tracked as a budget for the same reason the edges are.
 */
const RUBRIC_DEBT_BUDGET = 151;

if (missingRubric.length > RUBRIC_DEBT_BUDGET) {
  err(
    `${missingRubric.length} evidence-producing exercises have no rubric, over the budget of ${RUBRIC_DEBT_BUDGET}. A new artifact or scored exercise has to say what a complete answer contains.`,
  );
} else if (missingRubric.length < RUBRIC_DEBT_BUDGET) {
  err(
    `${missingRubric.length} evidence-producing exercises have no rubric, under the budget of ${RUBRIC_DEBT_BUDGET}. Lower RUBRIC_DEBT_BUDGET in scripts/check-data.mjs to ${missingRubric.length}.`,
  );
} else if (missingRubric.length > 0) {
  warn(
    `${missingRubric.length} of ${producedEvidenceCount} evidence-producing exercises have no rubric; work logged against them is judged against nothing.`,
  );
}

// ── Links ─────────────────────────────────────────────────────────────────
const seenLinks = new Set();
const linked = new Set();
/**
 * Edges inherited from curriculum 1.0.0 predate the mechanism field. That is a
 * real backlog and it is reported as one line rather than as one warning per
 * edge, so the number is visible without drowning everything else in CI.
 */
const missingMechanism = [];
const directed = new Map(); // acyclic-relation adjacency

for (const link of data.links) {
  const where = `link ${link.source}->${link.target}`;
  if (!nodeIds.has(link.source)) err(`${where}: unknown source`);
  if (!nodeIds.has(link.target)) err(`${where}: unknown target`);
  if (link.source === link.target) err(`${where}: self-loop`);
  if (!LINK_TYPES.has(link.type)) err(`${where}: bad type "${link.type}"`);

  if (!RELATIONS.has(link.relation)) {
    err(`${where}: invalid or missing relation "${link.relation}"`);
  } else if (RELATION_TYPE[link.relation] !== link.type) {
    err(
      `${where}: relation "${link.relation}" must use type "${RELATION_TYPE[link.relation]}", got "${link.type}"`,
    );
  }

  if (typeof link.strength !== "number" || link.strength <= 0 || link.strength > 1) {
    err(`${where}: strength must be in (0,1], got ${link.strength}`);
  }
  if (!CONFIDENCE_SET.has(link.confidence)) {
    err(`${where}: confidence "${link.confidence}" is not a supported band`);
  }
  if (MECHANISM_REQUIRED.has(link.relation) && !link.mechanism?.trim()) {
    err(`${where}: relation "${link.relation}" requires a mechanism`);
  }
  if (!link.mechanism?.trim()) missingMechanism.push(where);

  // Undirected duplicate check — two nodes joined twice render as overlap.
  const key = [link.source, link.target].sort().join("::");
  if (seenLinks.has(key)) err(`duplicate link between ${link.source} and ${link.target}`);
  seenLinks.add(key);

  linked.add(link.source);
  linked.add(link.target);

  if (ACYCLIC_RELATIONS.has(link.relation)) {
    const list = directed.get(link.source) ?? [];
    list.push(link.target);
    directed.set(link.source, list);
  }
}

/*
 * Prerequisite and enabling edges assert "train this first". A cycle among them
 * is unsatisfiable: the workout planner would recommend each node as a
 * precondition of the other forever. Synergy, transfer and shared-mechanism
 * edges are allowed to cycle — they make no ordering claim.
 */
{
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map();
  const stack = [];

  const visit = (id) => {
    colour.set(id, GREY);
    stack.push(id);
    for (const next of directed.get(id) ?? []) {
      const state = colour.get(next) ?? WHITE;
      if (state === GREY) {
        const from = stack.indexOf(next);
        err(
          `prerequisite cycle: ${[...stack.slice(from), next].join(" -> ")}`,
        );
      } else if (state === WHITE) {
        visit(next);
      }
    }
    stack.pop();
    colour.set(id, BLACK);
  };

  for (const id of nodeIds) {
    if ((colour.get(id) ?? WHITE) === WHITE) visit(id);
  }
}

/**
 * The unexplained-edge ratchet.
 *
 * 188 edges inherited from curriculum 1.0.0 have no recorded mechanism. A
 * warning alone let that number sit still for as long as anyone cared to
 * ignore it, and nothing stopped it growing. The budget below is the debt as
 * it stood when this check was written: the build fails if the count goes up,
 * and the budget has to be lowered by hand whenever it goes down, so the
 * number can only travel in one direction.
 *
 * Lowering it by deleting an edge nobody can justify counts. Deleting is
 * usually the more honest of the two options.
 */
const UNEXPLAINED_EDGE_BUDGET = 188;

if (missingMechanism.length > UNEXPLAINED_EDGE_BUDGET) {
  err(
    `${missingMechanism.length} edges have no recorded mechanism, over the budget of ${UNEXPLAINED_EDGE_BUDGET}. A new edge has to state why it exists. New: ${missingMechanism
      .slice(UNEXPLAINED_EDGE_BUDGET)
      .slice(0, 3)
      .join(", ")}`,
  );
} else if (missingMechanism.length < UNEXPLAINED_EDGE_BUDGET) {
  err(
    `${missingMechanism.length} edges have no recorded mechanism, under the budget of ${UNEXPLAINED_EDGE_BUDGET}. Lower UNEXPLAINED_EDGE_BUDGET in scripts/check-data.mjs to ${missingMechanism.length} so the debt cannot creep back.`,
  );
} else if (missingMechanism.length > 0) {
  warn(
    `${missingMechanism.length} edge(s) have no recorded mechanism and are shown as unexplained. First: ${missingMechanism.slice(0, 3).join(", ")}`,
  );
}

// An orphan is not fatal, but it floats alone and usually means a typo.
for (const id of nodeIds) {
  if (!linked.has(id)) warn(`node "${id}" has no links — it will float`);
}

// ── Ontology size guardrail ───────────────────────────────────────────────
/*
 * The canonical core is meant to be stable at roughly 128-140 nodes. Growth
 * past that should go into a Skill Pack, not into the core, so the ceiling is
 * enforced rather than merely documented.
 */
if (data.nodes.length > 140) {
  err(
    `canonical core has ${data.nodes.length} nodes; the ceiling is 140 — new specialised capabilities belong in a skill pack`,
  );
} else if (data.nodes.length < 128) {
  warn(`canonical core has ${data.nodes.length} nodes; the floor is 128`);
}

// ── Baked layout ──────────────────────────────────────────────────────────
/*
 * Layout positions are baked ahead of time, and lib/graph.ts falls back to
 * {x:0,y:0} for anything missing. That fallback is silent: a node added here
 * without re-baking would render stacked at the map origin with no error
 * anywhere. Since this script gates the build, make the drift loud.
 */
let layout;
try {
  layout = JSON.parse(
    readFileSync(new URL("../data/layout.json", import.meta.url), "utf8"),
  );
} catch (cause) {
  err(`could not read data/layout.json (${cause.message}) — run: npm run bake:layout`);
}

if (layout) {
  const baked = new Set(Object.keys(layout));
  for (const id of nodeIds) {
    if (!baked.has(id)) {
      err(`node "${id}" has no baked position — run: npm run bake:layout`);
    }
  }
  // Stale keys are harmless at runtime but mean the file is out of date.
  for (const id of baked) {
    if (!nodeIds.has(id)) {
      warn(`layout.json has a stale position for removed node "${id}"`);
    }
  }
  for (const [id, point] of Object.entries(layout)) {
    if (
      !point ||
      typeof point.x !== "number" ||
      typeof point.y !== "number" ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y)
    ) {
      err(`layout.json position for "${id}" is not a finite {x,y}`);
    }
  }
}

// ── Companion data files ──────────────────────────────────────────────────
function loadOptional(name) {
  try {
    return JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
  } catch {
    return null;
  }
}

const paths = loadOptional("paths.json");
if (paths) {
  const pathIds = new Set();
  for (const path of paths.paths ?? []) {
    if (pathIds.has(path.id)) err(`duplicate path id: ${path.id}`);
    pathIds.add(path.id);
    if (!path.label?.trim()) err(`path ${path.id}: empty label`);
    if (!path.outcome?.trim()) err(`path ${path.id}: empty outcome`);
    if (!path.nodeIds?.length) err(`path ${path.id}: has no nodes`);
    for (const id of path.nodeIds ?? []) {
      if (!nodeIds.has(id)) err(`path ${path.id}: unknown node "${id}"`);
    }
    if (new Set(path.nodeIds).size !== path.nodeIds.length) {
      err(`path ${path.id}: duplicate node ids`);
    }
  }
}

const missions = loadOptional("missions.json");
if (missions) {
  const missionIds = new Set();
  for (const mission of missions.missions ?? []) {
    if (missionIds.has(mission.id)) err(`duplicate mission id: ${mission.id}`);
    missionIds.add(mission.id);
    if (!mission.steps?.length) err(`mission ${mission.id}: has no steps`);
    for (const id of mission.nodeIds ?? []) {
      if (!nodeIds.has(id)) err(`mission ${mission.id}: unknown node "${id}"`);
    }
    const stepIds = new Set();
    for (const step of mission.steps ?? []) {
      if (stepIds.has(step.id)) err(`mission ${mission.id}: duplicate step "${step.id}"`);
      stepIds.add(step.id);
      if (!step.prompt?.trim()) err(`mission ${mission.id}: step "${step.id}" has no prompt`);
    }
  }
}

const capstones = loadOptional("capstones.json");
if (capstones) {
  const capstoneIds = new Set();
  for (const capstone of capstones.capstones ?? []) {
    if (capstoneIds.has(capstone.id)) err(`duplicate capstone id: ${capstone.id}`);
    capstoneIds.add(capstone.id);
    if (!capstone.rubric?.length) err(`capstone ${capstone.id}: has no rubric`);
    for (const id of capstone.nodeIds ?? []) {
      if (!nodeIds.has(id)) err(`capstone ${capstone.id}: unknown node "${id}"`);
    }
  }
}

const diagnostics = loadOptional("diagnostics.json");
if (diagnostics) {
  const probeIds = new Set();
  for (const probe of diagnostics.probes ?? []) {
    if (probeIds.has(probe.id)) err(`duplicate probe id: ${probe.id}`);
    probeIds.add(probe.id);
    if (!probe.items?.length) err(`probe ${probe.id}: has no items`);
    for (const id of probe.nodeIds ?? []) {
      if (!nodeIds.has(id)) err(`probe ${probe.id}: unknown node "${id}"`);
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────
for (const message of warnings) console.warn(`warn  ${message}`);
for (const message of errors) console.error(`error ${message}`);

const byCategory = {};
const byKind = {};
for (const node of data.nodes) {
  byCategory[node.categoryId] = (byCategory[node.categoryId] ?? 0) + 1;
  byKind[node.kind] = (byKind[node.kind] ?? 0) + 1;
}
const byRelation = {};
for (const link of data.links) {
  byRelation[link.relation] = (byRelation[link.relation] ?? 0) + 1;
}

console.log(
  `\ncurriculum ${data.curriculumVersion} · ${data.nodes.length} nodes · ${data.links.length} links · ${data.categories.length} categories · ${exerciseIds.size} exercises`,
);
console.log(
  `\nby kind:\n${Object.entries(byKind)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n")}`,
);
console.log(
  `\nby relation:\n${Object.entries(byRelation)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n")}`,
);

if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`\nOK${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
