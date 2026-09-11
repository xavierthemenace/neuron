/**
 * Stamps the service worker with the build's identity.
 *
 * The previous worker used a hand-edited cache name (`neuron-shell-v2`), which
 * meant every release after the one where someone remembered to bump it served
 * the old application shell from cache indefinitely. A stale shell is the worst
 * PWA failure mode available: the app loads, looks fine, and is months old.
 *
 * This derives the cache version from the actual build output, so the worker
 * invalidates exactly when the assets change and never otherwise.
 *
 *   node scripts/build-sw.mjs
 *
 * Runs from `postbuild`, after Next has written .next/ and public/ has been
 * assembled, and writes public/sw.js from public/sw.template.js.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const templateUrl = new URL("../public/sw.template.js", import.meta.url);
const outUrl = new URL("../public/sw.js", import.meta.url);

/** Hashes every emitted static chunk so the version tracks real output. */
function hashBuild() {
  const hash = createHash("sha256");
  const staticDir = join(root, ".next", "static");

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir).sort();
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      const info = statSync(full);
      if (info.isDirectory()) walk(full);
      // Names in .next/static are already content-hashed by the bundler, so
      // hashing the names alone is enough and costs nothing.
      else hash.update(entry);
    }
  };

  walk(staticDir);

  // The curriculum ships as data rather than as a chunk, so it has to be part
  // of the identity too: a curriculum-only change must still bust the cache.
  try {
    hash.update(readFileSync(join(root, "data", "intelligenceData.json")));
  } catch {
    // Absent in some CI orders; the chunk names still carry the build.
  }

  return hash.digest("hex").slice(0, 12);
}

const version = process.env.NEURON_SW_VERSION ?? hashBuild();
const template = readFileSync(templateUrl, "utf8");
const output = template.replace(/__BUILD_ID__/g, version);

if (output.includes("__BUILD_ID__")) {
  throw new Error("sw.template.js placeholder was not replaced");
}

writeFileSync(outUrl, output, "utf8");
console.log(`service worker stamped with build ${version}`);
