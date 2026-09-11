/**
 * Module resolution hooks for the Node test runner.
 *
 * The app imports curriculum JSON through the `@/` alias that Next and
 * TypeScript both understand and Node does not. Rather than duplicating the
 * data access layer for tests — which would let the tested code drift from the
 * shipped code — this teaches Node the same alias, and supplies the JSON import
 * attribute that Node requires and bundlers do not.
 */
const root = new URL("../../", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const url = new URL(specifier.slice(2), root).href;
  if (url.endsWith(".json")) {
    return { url, shortCircuit: true, format: "json", importAttributes: { type: "json" } };
  }
  return nextResolve(url, context);
}
