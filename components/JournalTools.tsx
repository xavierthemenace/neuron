"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllJournals, type JournalRecord } from "@/lib/db";
import {
  TEMPLATES,
  buildBacklinks,
  labelFor,
  suggestNodeForLink,
  summariseJournal,
  type Marker,
} from "@/lib/journal";
import { newId } from "@/lib/storage";
import { useProgress } from "./ProgressProvider";
import { Caveat, Chip, Section, Why, buttonClass } from "./ui";

/**
 * The half of a journal that makes it part of a learning system.
 *
 * Links, backlinks, tags and markers are only worth writing if something acts
 * on them. This panel is that something: it shows who references this node,
 * surfaces the lines the user marked as questions, insights or predictions, and
 * converts them into the objects that actually drive training — a dated
 * prediction with a probability, a personal capability, a practice task.
 *
 * Nothing is converted automatically. A note is a note until the user says
 * otherwise.
 */

const MARKER_LABEL: Record<Marker["kind"], string> = {
  question: "Question",
  insight: "Insight",
  prediction: "Prediction",
  unresolved: "Unresolved",
  quote: "Quote",
};

const MARKER_TONE: Record<Marker["kind"], "neutral" | "active" | "warn"> = {
  question: "neutral",
  insight: "active",
  prediction: "active",
  unresolved: "warn",
  quote: "neutral",
};

export function JournalTools({
  nodeId,
  markdown,
  onInsert,
  onSelectNode,
}: {
  nodeId: string;
  markdown: string;
  onInsert: (text: string) => void;
  onSelectNode: (id: string) => void;
}) {
  const { progress, nowMs, addPrediction, addPersonalNode } = useProgress();
  const [journals, setJournals] = useState<JournalRecord[]>([]);
  const [converted, setConverted] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void getAllJournals()
      .then((records) => {
        if (!cancelled) setJournals(records);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [nodeId, markdown]);

  const personalLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of progress.personalNodes) {
      map.set(node.label.toLowerCase().replace(/[^a-z0-9]+/g, ""), node.id);
    }
    return map;
  }, [progress.personalNodes]);

  const summary = useMemo(
    () => summariseJournal(markdown, personalLabels),
    [markdown, personalLabels],
  );
  const backlinks = useMemo(
    () => buildBacklinks(journals, personalLabels).get(nodeId) ?? [],
    [journals, personalLabels, nodeId],
  );

  const markKey = (marker: Marker) => `${marker.kind}:${marker.line}:${marker.text.slice(0, 24)}`;

  const toPrediction = (marker: Marker) => {
    addPrediction({
      claim: marker.text,
      probability: 0.6,
      resolveBy: new Date(nowMs + 30 * 864e5).toISOString(),
      nodeIds: [nodeId, "dec-calibration"],
      note: `From the ${labelFor(nodeId)} journal.`,
    });
    setConverted((current) => ({ ...current, [markKey(marker)]: "Recorded as a prediction" }));
  };

  const toPersonalNode = (marker: Marker) => {
    addPersonalNode({
      label: marker.text.slice(0, 60),
      description: `Raised in the ${labelFor(nodeId)} journal and promoted to a capability worth training.`,
      kind: "competency",
      linkedNodeIds: [nodeId],
      exercises: [
        {
          id: `personal-ex-${newId()}`,
          label: `Work on: ${marker.text.slice(0, 90)}`,
          xp: 18,
          cadence: "weekly",
          difficulty: 3,
          evidence: "artifact",
          minutes: 30,
        },
      ],
    });
    setConverted((current) => ({ ...current, [markKey(marker)]: "Created a personal capability" }));
  };

  return (
    <div className="space-y-5">
      <Section
        title="Templates"
        hint="Structures that make a note convertible later rather than a paragraph you will not reread."
      >
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((template) => (
            <Chip key={template.id} onClick={() => onInsert(template.body)}>
              {template.label}
            </Chip>
          ))}
        </div>
        <Why summary="What are the markers?">
          <p>
            Five line prefixes, deliberately not a syntax to learn:{" "}
            <code className="text-neutral-300">?</code> a question,{" "}
            <code className="text-neutral-300">!</code> an insight,{" "}
            <code className="text-neutral-300">~</code> a prediction,{" "}
            <code className="text-neutral-300">TODO:</code> something unresolved, and{" "}
            <code className="text-neutral-300">&gt;</code> a quote. Anything marked can be
            converted below. <code className="text-neutral-300">[[Double brackets]]</code> link
            to another capability and create a backlink from it.
          </p>
        </Why>
      </Section>

      {(summary.markers.length > 0 || summary.unresolvedLinks.length > 0) && (
        <Section
          title="Convert to training"
          hint="Nothing here happens automatically. A note stays a note until you say otherwise."
        >
          <ul className="space-y-1.5">
            {summary.markers.map((marker) => {
              const key = markKey(marker);
              const done = converted[key];
              return (
                <li
                  key={key}
                  className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tone={MARKER_TONE[marker.kind]}>{MARKER_LABEL[marker.kind]}</Chip>
                    <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-neutral-300">
                      {marker.text}
                    </span>
                  </div>
                  {done ? (
                    <p className="mt-1.5 text-[10px] text-emerald-300/75">{done}</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(marker.kind === "prediction" || marker.kind === "question") && (
                        <button
                          type="button"
                          onClick={() => toPrediction(marker)}
                          className={buttonClass}
                        >
                          Make it a dated prediction
                        </button>
                      )}
                      {(marker.kind === "unresolved" || marker.kind === "insight") && (
                        <button
                          type="button"
                          onClick={() => toPersonalNode(marker)}
                          className={buttonClass}
                        >
                          Make it a capability
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}

            {summary.unresolvedLinks.map((link) => {
              const suggestion = suggestNodeForLink(link.raw);
              return (
                <li
                  key={`unresolved-${link.start}`}
                  className="rounded-xl border border-amber-200/15 bg-amber-200/[0.03] px-3 py-2.5"
                >
                  <p className="text-[11px] text-amber-50/85">
                    <code>[[{link.raw}]]</code> does not match any capability.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestion.nearest && (
                      <button
                        type="button"
                        onClick={() => onSelectNode(suggestion.nearest!)}
                        className={buttonClass}
                      >
                        Did you mean {labelFor(suggestion.nearest)}?
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        addPersonalNode({
                          label: link.raw,
                          description: `Created from an unresolved link in the ${labelFor(nodeId)} journal.`,
                          kind: "knowledge",
                          linkedNodeIds: [nodeId],
                          exercises: [
                            {
                              id: `personal-ex-${newId()}`,
                              label: `Study and produce something using ${link.raw}`,
                              xp: 18,
                              cadence: "weekly",
                              difficulty: 3,
                              evidence: "artifact",
                              minutes: 30,
                            },
                          ],
                        })
                      }
                      className={buttonClass}
                    >
                      Create it as a personal capability
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {summary.links.length > 0 && (
        <Section title="Links out">
          <div className="flex flex-wrap gap-1.5">
            {summary.links
              .filter((link) => link.nodeId)
              .map((link) => (
                <Chip key={`${link.start}`} onClick={() => onSelectNode(link.nodeId!)}>
                  {labelFor(link.nodeId!)}
                </Chip>
              ))}
          </div>
        </Section>
      )}

      {backlinks.length > 0 && (
        <Section
          title={`Referenced from ${backlinks.length} other note${backlinks.length === 1 ? "" : "s"}`}
          hint="The half that makes links worth writing: a note filed elsewhere becomes visible here."
        >
          <ul className="space-y-1.5">
            {backlinks.map((backlink) => (
              <li
                key={`${backlink.fromNodeId}-${backlink.line}`}
                className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => onSelectNode(backlink.fromNodeId)}
                  className="text-[10px] font-medium text-neutral-300 hover:text-white"
                >
                  {labelFor(backlink.fromNodeId)}
                </button>
                <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">
                  {backlink.excerpt}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.tags.length > 0 && (
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {summary.tags.map((tag) => (
              <Chip key={tag}>#{tag}</Chip>
            ))}
          </div>
        </Section>
      )}

      <Caveat>
        Journals stay on this device and are plain Markdown, so an export opens in any editor
        or Obsidian vault with nothing lost. Nothing here is sent anywhere unless you
        explicitly hand a passage to the AI coach.
      </Caveat>
    </div>
  );
}
