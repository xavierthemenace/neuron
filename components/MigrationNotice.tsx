"use client";

import { useState } from "react";
import { useProgress } from "./ProgressProvider";

/**
 * Tells the user when the ontology moved under their feet.
 *
 * A curriculum migration that silently reattributes two years of practice is
 * indistinguishable, from the outside, from a bug that lost it. Every applied
 * migration is reported once, in plain language, with the policy that was
 * applied and any history that could not be placed.
 */
export function MigrationNotice() {
  const { migration } = useProgress();
  const [dismissed, setDismissed] = useState(false);

  if (!migration || dismissed) return null;

  return (
    <div className="pointer-events-auto fixed bottom-4 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-violet-300/20 bg-[oklch(0.15_0.03_295_/_0.97)] p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold text-violet-50">
            The curriculum changed
            {migration.from ? ` (${migration.from} → ${migration.to})` : ` (now ${migration.to})`}
          </h2>

          {migration.applied.length > 0 && (
            <ul className="mt-2 space-y-1">
              {migration.applied.map((entry) => (
                <li key={entry.version} className="text-[11px] leading-relaxed text-neutral-300">
                  {entry.summary}
                </li>
              ))}
            </ul>
          )}

          {migration.rewrittenLogs > 0 && (
            <p className="mt-2 text-[11px] text-neutral-400">
              {migration.rewrittenLogs} log entr
              {migration.rewrittenLogs === 1 ? "y was" : "ies were"} moved to their new node.
              Nothing was deleted.
            </p>
          )}

          {migration.notes.map((note) => (
            <p key={note} className="mt-2 text-[11px] leading-relaxed text-neutral-400">
              {note}
            </p>
          ))}

          {migration.orphanedNodeIds.length > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-100/75">
              {migration.orphanedNodeIds.length} node id
              {migration.orphanedNodeIds.length === 1 ? "" : "s"} in your history no longer
              exist in the curriculum ({migration.orphanedNodeIds.slice(0, 3).join(", ")}
              {migration.orphanedNodeIds.length > 3 ? ", …" : ""}). Those logs are kept and
              still export, they just have nowhere to display.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss curriculum change notice"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-white/7 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}
