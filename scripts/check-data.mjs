/**
 * Referential-integrity check for the hand-authored curriculum.
 * A dangling link id fails silently at runtime (d3-force throws, or the edge
 * just vanishes), so it is worth catching here instead.
 *
 *   npm run check:data
 */
import { readFileSync } from "node:fs";

const data = JSON.parse(
  readFileSync(new URL("../data/intelligenceData.json", import.meta.url), "utf8"),
);

const errors = [];
const warnings = [];

const categoryIds = new Set();
for (const c of data.categories) {
  if (categoryIds.has(c.id)) errors.push(`duplicate category id: ${c.id}`);
  categoryIds.add(c.id);
  if (typeof c.hue !== "number" || c.hue < 0 || c.hue > 360)
    errors.push(`category ${c.id}: hue must be 0-360, got ${c.hue}`);
}

const nodeIds = new Set();
const exerciseIds = new Set();
for (const n of data.nodes) {
  if (nodeIds.has(n.id)) errors.push(`duplicate node id: ${n.id}`);
  nodeIds.add(n.id);

  if (!categoryIds.has(n.categoryId))
    errors.push(`node ${n.id}: unknown categoryId "${n.categoryId}"`);
  if (![0, 1, 2].includes(n.tier))
    errors.push(`node ${n.id}: tier must be 0, 1 or 2 — got ${n.tier}`);
  if (!n.description?.trim()) errors.push(`node ${n.id}: empty description`);
  if (!n.why?.trim()) errors.push(`node ${n.id}: empty why`);
  if (!n.exercises?.length) errors.push(`node ${n.id}: has no exercises`);

  for (const ex of n.exercises ?? []) {
    if (exerciseIds.has(ex.id))
      errors.push(`duplicate exercise id: ${ex.id} (node ${n.id})`);
    exerciseIds.add(ex.id);
    if (!(ex.xp > 0)) errors.push(`exercise ${ex.id}: xp must be positive`);
    if (!["daily", "weekly", "session"].includes(ex.cadence))
      errors.push(`exercise ${ex.id}: bad cadence "${ex.cadence}"`);
  }

  for (const r of n.resources ?? []) {
    // A missing url is intentional — those entries are citations, not links.
    if (r.url && !/^https:\/\//.test(r.url))
      errors.push(`node ${n.id}: resource "${r.title}" url is not https`);
  }
}

const seenLinks = new Set();
const linked = new Set();
for (const l of data.links) {
  if (!nodeIds.has(l.source)) errors.push(`link: unknown source "${l.source}"`);
  if (!nodeIds.has(l.target)) errors.push(`link: unknown target "${l.target}"`);
  if (l.source === l.target) errors.push(`link: self-loop on "${l.source}"`);
  if (!["prereq", "synergy"].includes(l.type))
    errors.push(`link ${l.source}->${l.target}: bad type "${l.type}"`);

  // Undirected duplicate check — two nodes joined twice render as overlap.
  const key = [l.source, l.target].sort().join("::");
  if (seenLinks.has(key))
    errors.push(`duplicate link between ${l.source} and ${l.target}`);
  seenLinks.add(key);

  linked.add(l.source);
  linked.add(l.target);
}

// An orphan is not fatal, but it floats alone and usually means a typo.
for (const id of nodeIds) {
  if (!linked.has(id)) warnings.push(`node "${id}" has no links — it will float`);
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);

const byCategory = {};
for (const n of data.nodes)
  byCategory[n.categoryId] = (byCategory[n.categoryId] ?? 0) + 1;

console.log(
  `\n${data.nodes.length} nodes · ${data.links.length} links · ${data.categories.length} categories · ${exerciseIds.size} exercises`,
);
console.log(
  Object.entries(byCategory)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n"),
);

if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`\nOK${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
