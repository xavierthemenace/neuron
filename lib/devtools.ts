/**
 * Development-only observability.
 *
 * The two bugs that have actually hurt this project were a hidden render loop
 * and a stale-state desync — both invisible until the app was already broken.
 * These counters make the invisible part visible while developing, and compile
 * to nothing in production: every call site is behind `DEV`, which is a
 * constant folded away by the bundler, so the counters and their Maps never
 * ship.
 *
 * Enable in the browser console with:
 *   localStorage.setItem("neuron.debug", "1")
 * then reload. Read with `__neuron.report()`.
 */

export const DEV = process.env.NODE_ENV !== "production";

interface Counters {
  nodeBuilds: Map<string, number>;
  edgeBuilds: Map<string, number>;
  events: { at: number; label: string; detail?: string }[];
  timings: Map<string, number[]>;
}

const counters: Counters = {
  nodeBuilds: new Map(),
  edgeBuilds: new Map(),
  events: [],
  timings: new Map(),
};

function enabled(): boolean {
  if (!DEV || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("neuron.debug") === "1";
  } catch {
    return false;
  }
}

export function countNodeBuild(nodeId: string): void {
  if (!enabled()) return;
  counters.nodeBuilds.set(nodeId, (counters.nodeBuilds.get(nodeId) ?? 0) + 1);
}

export function countEdgeBuild(edgeId: string): void {
  if (!enabled()) return;
  counters.edgeBuilds.set(edgeId, (counters.edgeBuilds.get(edgeId) ?? 0) + 1);
}

export function note(label: string, detail?: string): void {
  if (!enabled()) return;
  counters.events.push({ at: Date.now(), label, detail });
  // Bounded: a render loop would otherwise fill memory with its own evidence.
  if (counters.events.length > 500) counters.events.splice(0, 250);
}

/** Times a synchronous block and records the result under `label`. */
export function measure<T>(label: string, run: () => T): T {
  if (!enabled()) return run();
  const started = performance.now();
  const result = run();
  const elapsed = performance.now() - started;
  const list = counters.timings.get(label) ?? [];
  list.push(elapsed);
  if (list.length > 100) list.shift();
  counters.timings.set(label, list);
  return result;
}

export interface DevReport {
  totalNodeBuilds: number;
  totalEdgeBuilds: number;
  /** Nodes rebuilt most often — a flat distribution means cache misses. */
  hottestNodes: [string, number][];
  timings: Record<string, { count: number; mean: number; max: number }>;
  recentEvents: { at: number; label: string; detail?: string }[];
}

export function report(): DevReport {
  const timings: DevReport["timings"] = {};
  for (const [label, samples] of counters.timings) {
    timings[label] = {
      count: samples.length,
      mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
      max: Math.max(...samples),
    };
  }

  return {
    totalNodeBuilds: [...counters.nodeBuilds.values()].reduce((a, b) => a + b, 0),
    totalEdgeBuilds: [...counters.edgeBuilds.values()].reduce((a, b) => a + b, 0),
    hottestNodes: [...counters.nodeBuilds.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    timings,
    recentEvents: counters.events.slice(-40),
  };
}

export function reset(): void {
  counters.nodeBuilds.clear();
  counters.edgeBuilds.clear();
  counters.timings.clear();
  counters.events.length = 0;
}

/** Attaches the console handle. Called once, from the graph, in development. */
export function installDevTools(): void {
  if (!DEV || typeof window === "undefined") return;
  const handle = window as unknown as Record<string, unknown>;
  if (handle.__neuron) return;
  handle.__neuron = {
    report,
    reset,
    enable: () => {
      window.localStorage.setItem("neuron.debug", "1");
      return "Neuron diagnostics on. Reload, then call __neuron.report().";
    },
    disable: () => {
      window.localStorage.removeItem("neuron.debug");
      return "Neuron diagnostics off.";
    },
  };
}
