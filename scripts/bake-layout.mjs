/**
 * Precomputes node positions into data/layout.json.
 *
 * The force simulation costs ~500ms for 100 nodes — mostly forceCollide, which
 * iterates internally on every tick. That is far too much to spend blocking the
 * main thread on each page load for a result that never changes, so it runs
 * here instead and ships as data.
 *
 * Re-run after editing nodes or links in intelligenceData.json:
 *   npm run bake:layout
 *
 * Imports lib/layout.ts directly via Node's native type stripping, so the
 * algorithm is defined exactly once.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { computeLayout } from "../lib/layout.ts";

const dataUrl = new URL("../data/intelligenceData.json", import.meta.url);
const outUrl = new URL("../data/layout.json", import.meta.url);

const data = JSON.parse(readFileSync(dataUrl, "utf8"));

const started = performance.now();
const positions = computeLayout(data);
const elapsed = performance.now() - started;

// Sorted so the committed file has a stable diff when unrelated nodes change.
const baked = Object.fromEntries(
  [...positions.entries()].sort(([a], [b]) => a.localeCompare(b)),
);

writeFileSync(outUrl, `${JSON.stringify(baked, null, 0)}\n`);

const xs = Object.values(baked).map((p) => p.x);
const ys = Object.values(baked).map((p) => p.y);
console.log(
  `baked ${Object.keys(baked).length} positions in ${elapsed.toFixed(0)}ms`,
);
console.log(
  `extent: x ${Math.min(...xs)}..${Math.max(...xs)}  y ${Math.min(...ys)}..${Math.max(...ys)}`,
);
