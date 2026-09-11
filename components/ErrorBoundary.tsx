"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { getStoredProgress } from "@/lib/db";

/**
 * A rendering failure must not cost anyone their data.
 *
 * The graph is the most complex thing in the app and the most likely to throw;
 * the journal and the practice log are the things that would actually hurt to
 * lose. This boundary keeps a crash from taking the page down with it, and —
 * more importantly — gives the user a way to export everything before touching
 * anything else. Offering "reset" without offering "export first" is how
 * support advice destroys people's records.
 */

interface State {
  error: Error | null;
  exported: boolean;
  exportError: string | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, exported: false, exportError: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console only: nothing here is sent anywhere. This is a local-first app and
    // a stack trace can contain the user's own text.
    console.error("Neuron render error", error, info.componentStack);
  }

  private exportRaw = async () => {
    try {
      const stored = await getStoredProgress();
      const journals = await import("@/lib/db").then((module) => module.getAllJournals());
      const blob = new Blob(
        [JSON.stringify({ progress: stored ?? null, journals }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `neuron-recovery-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      this.setState({ exported: true, exportError: null });
    } catch (cause) {
      this.setState({
        exportError:
          cause instanceof Error ? cause.message : "Could not read the local database.",
      });
    }
  };

  render() {
    const { error, exported, exportError } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--surface)] p-6">
        <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/12 bg-[var(--card)] p-6 shadow-2xl">
          <h1 className="text-lg font-semibold text-neutral-50">Neuron hit a rendering error</h1>
          <p className="text-[12px] leading-relaxed text-neutral-400">
            Your practice log, journals and attachments are stored separately from the view
            that failed, so they are almost certainly intact. Export a raw copy before doing
            anything else — then reload.
          </p>

          <pre className="max-h-32 overflow-auto rounded-lg border border-white/8 bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-rose-200/70">
            {error.message}
          </pre>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void this.exportRaw()}
              className="rounded-lg border border-cyan-300/30 bg-cyan-300/15 px-3 py-2 text-xs font-medium text-cyan-50 transition-colors hover:bg-cyan-300/25"
            >
              {exported ? "Exported ✓" : "Export raw backup"}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-neutral-200 transition-colors hover:bg-white/[0.09]"
            >
              Reload
            </button>
          </div>

          {exportError && (
            <p className="text-[11px] text-rose-300/80">
              The backup could not be written: {exportError}. Do not reset anything — the data
              is still in IndexedDB under <code>neuron.local.v2</code> and can be recovered
              from browser devtools.
            </p>
          )}

          <p className="text-[10px] leading-relaxed text-neutral-600">
            Nothing has been sent anywhere. The error above was logged to your browser console
            only.
          </p>
        </div>
      </div>
    );
  }
}
