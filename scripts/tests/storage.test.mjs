import assert from "node:assert/strict";
import test from "node:test";

/**
 * Crash-recovery persistence.
 *
 * Saves to IndexedDB are debounced, so a change made in the last fraction of a
 * second before a reload was only ever written by the unload handler — and an
 * IndexedDB transaction opened there is abandoned as the page is torn down.
 * The result was total, silent loss of the change. The synchronous localStorage
 * snapshot is the fix, and these tests pin the two properties that matter:
 * the snapshot is written synchronously, and a load prefers it over anything
 * older.
 *
 * `indexedDB` is deliberately absent here, which is also the real behaviour
 * when a browser blocks storage: `loadProgress` must still recover the user's
 * work rather than handing back an empty profile.
 */

/** Minimal synchronous localStorage stand-in. */
function makeLocalStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    has: (key) => map.has(key),
  };
}

globalThis.window = { localStorage: makeLocalStorage() };

const { PENDING_KEY, STORAGE_KEY, emptyProgress, flushProgressSync, loadProgress } =
  await import("../../lib/storage.ts");

function progressWithOneRep(note) {
  return {
    ...emptyProgress(),
    logs: [
      {
        id: "log-1",
        nodeId: "gc-retrieval-practice",
        exerciseId: "gc-retrieval-practice-1",
        xp: 15,
        at: "2026-03-02T09:00:00.000Z",
        note,
      },
    ],
  };
}

/** Swaps in a clean storage for each test. */
function resetStorage(initial = {}) {
  globalThis.window.localStorage = makeLocalStorage(initial);
  return globalThis.window.localStorage;
}

test("flushProgressSync writes without awaiting anything", () => {
  const store = resetStorage();
  const result = flushProgressSync(progressWithOneRep("logged just before reload"));

  // An unload handler is not given time to await: the write must already be
  // durable by the time the call returns.
  assert.equal(result, undefined);
  assert.ok(store.has(PENDING_KEY));
});

test("a reload inside the debounce window recovers the rep", async () => {
  resetStorage();
  flushProgressSync(progressWithOneRep("logged just before reload"));

  const recovered = await loadProgress();
  assert.equal(recovered.logs.length, 1);
  assert.equal(recovered.logs[0].note, "logged just before reload");
  assert.equal(recovered.logs[0].xp, 15);
});

test("an empty profile is only returned when there is genuinely nothing", async () => {
  resetStorage();
  const loaded = await loadProgress();
  assert.deepEqual(loaded.logs, []);
});

test("the recovery snapshot wins over an older legacy payload", async () => {
  resetStorage({
    [STORAGE_KEY]: JSON.stringify(progressWithOneRep("stale v1 copy")),
  });
  flushProgressSync(progressWithOneRep("newer unload snapshot"));

  const recovered = await loadProgress();
  assert.equal(recovered.logs[0].note, "newer unload snapshot");
});

test("a corrupt snapshot falls back instead of throwing", async () => {
  resetStorage({ [PENDING_KEY]: "{ not json" });
  const loaded = await loadProgress();

  // There is nothing to recover from a truncated write, but the load must
  // still succeed rather than propagating a parse error to the boot path.
  assert.deepEqual(loaded.logs, []);
});
