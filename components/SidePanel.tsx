"use client";

import { useMemo, useState } from "react";
import { PROVENANCE_BLURB } from "@/lib/competence";
import {
  capstonesForNode,
  missionsForNode,
  pathsForNode,
} from "@/lib/curriculum";
import { probesForNode, probeHistory } from "@/lib/diagnostics";
import {
  CHC_CORE,
  CONSTRUCT_LABEL,
  RELATION_BLURB,
  RELATION_LABEL,
  RETENTION_LABEL,
  kindOf,
  retentionModelFor,
} from "@/lib/evidence";
import { neighborsOf, type Neighbor } from "@/lib/graph";
import { nextTier, tierForXp, tierProgress } from "@/lib/mastery";
import type {
  Category,
  ConceptNode,
  IntelligenceData,
  ResourceType,
} from "@/lib/types";
import { HabitChecklist } from "./HabitChecklist";
import { MarkdownJournal } from "./MarkdownJournal";
import { useProgress } from "./ProgressProvider";
import { useDismissable } from "./useDismissable";
import {
  Caveat,
  Chip,
  ConfidenceChip,
  EstimateChip,
  ProvenanceChip,
  KindChip,
  Meter,
  Section,
  Why,
} from "./ui";

const RESOURCE_LABEL: Record<ResourceType, string> = {
  book: "Book",
  course: "Course",
  tool: "Tool",
  paper: "Paper",
  practice: "Practice",
  video: "Video",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const RELATION_SYMBOL: Record<string, string> = {
  prerequisite: "←",
  enabling: "⇠",
  supporting: "·",
  transfer: "⇢",
  synergy: "↔",
  analogical: "≈",
  "shared-mechanism": "≡",
  inhibition: "⊣",
};

function NeighborChip({
  neighbor,
  label,
  onSelect,
}: {
  neighbor: Neighbor;
  label: string;
  onSelect: () => void;
}) {
  const symbol = RELATION_SYMBOL[neighbor.relation] ?? "·";
  const arrow = neighbor.direction === "in" ? symbol : symbol === "←" ? "→" : symbol;
  // Confidence is encoded as opacity rather than colour: the graph already
  // spends colour on category, and an edge nobody is sure about should not look
  // as solid as one that replicates.
  const opacity =
    neighbor.confidence === "strong"
      ? 1
      : neighbor.confidence === "moderate"
        ? 0.82
        : neighbor.confidence === "emerging"
          ? 0.62
          : 0.45;

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ opacity }}
      title={`${RELATION_LABEL[neighbor.relation]} · ${RELATION_BLURB[neighbor.relation]}${
        neighbor.mechanism ? `\n\nMechanism: ${neighbor.mechanism}` : "\n\nNo mechanism recorded."
      }${neighbor.conditional ? `\n\nOnly when: ${neighbor.conditional}` : ""}`}
      className={[
        "rounded-full px-2.5 py-1 text-[11px] transition-colors",
        neighbor.type === "inhibition"
          ? "border border-dashed border-rose-300/30 text-rose-100/80 hover:bg-rose-300/[0.07]"
          : neighbor.type === "prereq"
            ? "border border-white/14 bg-white/[0.035] text-neutral-200 hover:border-white/30 hover:bg-white/[0.07] hover:text-white"
            : "border border-dashed border-white/14 text-neutral-300 hover:border-white/30 hover:bg-white/[0.04] hover:text-white",
      ].join(" ")}
    >
      <span aria-hidden="true" className="mr-1 opacity-60">
        {arrow}
      </span>
      {label}
    </button>
  );
}

export function SidePanel({
  data,
  node,
  category,
  nodesById,
  onClose,
  onSelectNode,
  focusMode,
  onFocusModeChange,
  onRunProbe,
  onOpenMission,
  onOpenCapstone,
  onOpenPath,
  researchMode,
  onResearchModeChange,
}: {
  data: IntelligenceData;
  node: ConceptNode | null;
  category: Category | null;
  nodesById: Map<string, ConceptNode>;
  onClose: () => void;
  onSelectNode: (id: string) => void;
  focusMode: boolean;
  onFocusModeChange: (enabled: boolean) => void;
  onRunProbe: (probeId: string) => void;
  onOpenMission: (missionId: string) => void;
  onOpenCapstone: (capstoneId: string) => void;
  onOpenPath: (pathId: string) => void;
  researchMode: boolean;
  onResearchModeChange: (enabled: boolean) => void;
}) {
  const {
    estimates,
    retentionByNodeId,
    rawXpByNodeId,
    xpByNodeId,
    logsByNodeId,
    progress,
    undoLog,
  } = useProgress();
  const [tab, setTab] = useState<"train" | "evidence" | "notes">("train");

  const open = Boolean(node);

  // Non-modal: the panel sits alongside the graph rather than over it, so it
  // takes part in Escape ordering but does not trap focus. Any modal opened
  // afterwards lands above it in the stack and gets Escape first.
  useDismissable({ open, onClose });

  const hue = category?.hue ?? 260;
  const estimate = node ? estimates[node.id] : undefined;
  const retention = node ? retentionByNodeId[node.id] : undefined;
  const rawXp = node ? (rawXpByNodeId[node.id] ?? 0) : 0;
  const xp = node ? (xpByNodeId[node.id] ?? 0) : 0;
  const tier = tierForXp(xp);
  const next = nextTier(xp);
  const fill = tierProgress(xp);
  const logs = node ? (logsByNodeId[node.id] ?? []) : [];

  const neighbors = useMemo(
    () => (node ? neighborsOf(data, node.id) : []),
    [data, node],
  );
  const grouped = useMemo(() => {
    const prerequisites = neighbors.filter(
      (n) => n.type === "prereq" && n.direction === "in",
    );
    const downstream = neighbors.filter(
      (n) => n.type === "prereq" && n.direction === "out",
    );
    const lateral = neighbors.filter((n) => n.type === "synergy");
    const tradeoffs = neighbors.filter((n) => n.type === "inhibition");
    return { prerequisites, downstream, lateral, tradeoffs };
  }, [neighbors]);

  const paths = node ? pathsForNode(node.id) : [];
  const missions = node ? missionsForNode(node.id) : [];
  const capstones = node ? capstonesForNode(node.id) : [];
  const probes = node ? probesForNode(node.id) : [];

  return (
    <aside
      // aria-hidden removes the element from the accessibility tree entirely,
      // so a role-based locator cannot assert on the closed state. The test id
      // gives the browser suite something stable to check in both states.
      data-testid="side-panel"
      data-open={open ? "true" : "false"}
      aria-hidden={!open}
      aria-label={node ? `${node.label} detail` : undefined}
      className={[
        "fixed z-40 flex flex-col border-white/12 bg-[rgb(255_255_255_/_0.96)] shadow-2xl backdrop-blur-2xl",
        "transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0",
        "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t",
        "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[440px] md:rounded-none md:border-l md:border-t-0",
        "xl:w-[496px] 2xl:w-[560px]",
        open
          ? "translate-y-0 md:translate-x-0"
          : "translate-y-full md:translate-y-0 md:translate-x-full",
      ].join(" ")}
    >
      {node && (
        <>
          <header
            className="relative shrink-0 border-b border-white/10 p-5"
            style={{
              background: `linear-gradient(155deg, oklch(0.80 0.10 ${hue} / 0.42), oklch(0.98 0.008 90 / 0.35) 58%, transparent 100%)`,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-lg border border-transparent text-neutral-400 transition-colors hover:border-white/10 hover:bg-white/8 hover:text-white"
            >
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M2 2l10 10M12 2 2 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <div className="flex flex-wrap items-center gap-1.5 pr-12">
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  color: `oklch(0.42 0.13 ${hue})`,
                  background: `oklch(0.74 0.12 ${hue} / 0.22)`,
                }}
              >
                {category?.label ?? "Personal"}
              </span>
              <KindChip kind={kindOf(node)} />
              {retention?.decaying && retention.repetitions > 0 && (
                <Chip tone="warn">review due</Chip>
              )}
            </div>

            <h2 className="mt-2.5 pr-10 text-xl font-semibold leading-tight text-neutral-50">
              {node.label}
            </h2>

            {/* The four numbers, kept apart on purpose. */}
            <div className="mt-4 grid gap-2.5">
              <Meter
                label="Practice"
                value={estimate?.practice ?? 0}
                hue={hue}
                caption={`${rawXp.toLocaleString()} lifetime XP · progression signal, not an ability measure`}
              />
              <Meter
                label="Competence"
                value={estimate?.competence ?? 0}
                hue={hue}
                emphasis
                caption={PROVENANCE_BLURB[estimate?.provenance ?? "prior"]}
              />
              <Meter
                label="Retention"
                value={retention?.retention ?? 1}
                hue={hue}
                caption={`${RETENTION_LABEL[retentionModelFor(node)]} model`}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <ProvenanceChip provenance={estimate?.provenance ?? "prior"} />
              <EstimateChip
                level={estimate?.confidence ?? "none"}
                observations={estimate?.strongObservations}
              />
              {node.evidence && (
                <ConfidenceChip band={node.evidence.evidenceConfidence} prefix="evidence" />
              )}
            </div>
            <Why summary="Why these numbers?">
              <p>{estimate?.confidenceReason}</p>
              {retention && retention.repetitions > 0 && (
                <p className="mt-2">{retention.explanation}</p>
              )}
              <p className="mt-2 text-neutral-500">
                Practice is XP against the {tier.name} scale — it measures what you did.
                Competence is a separate estimate that only moves on scored probes, judged
                artifacts, completed missions and capstones. The two disagreeing is
                informative, not a bug.
              </p>
            </Why>

            <div className="mt-3 flex items-baseline justify-between gap-3 text-[10px] text-neutral-500">
              <span style={{ color: `oklch(0.44 0.13 ${hue})` }}>{tier.name}</span>
              <span className="tabular-nums">
                {next
                  ? `${Math.max(0, next.min - xp)} XP to ${next.name}`
                  : "top of the XP scale"}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.round(fill * 100)}%`, background: `oklch(0.55 0.11 ${hue})` }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-[rgb(25_22_20_/_0.035)] px-3 py-2">
              <div>
                <div className="text-[11px] font-medium text-neutral-200">Focus Mode</div>
                <div className="text-[9px] text-neutral-500">
                  Isolate this faculty and its network
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={focusMode}
                aria-label="Focus Mode"
                onClick={() => onFocusModeChange(!focusMode)}
                className={[
                  "relative h-7 w-12 rounded-full border transition-colors",
                  focusMode
                    ? "border-cyan-300/30 bg-cyan-300/20"
                    : "border-white/12 bg-white/[0.04]",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-1 h-5 w-5 rounded-full bg-neutral-100 shadow transition-transform motion-reduce:transition-none",
                    focusMode ? "translate-x-[24px]" : "translate-x-[4px]",
                  ].join(" ")}
                />
              </button>
            </div>

            <div
              role="tablist"
              aria-label="Faculty sections"
              className="mt-4 flex gap-1 rounded-xl border border-white/8 bg-[rgb(25_22_20_/_0.035)] p-1"
            >
              {(
                [
                  ["train", "Train"],
                  ["evidence", "Evidence"],
                  ["notes", "Notes"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs transition-colors ${
                    tab === id ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            {tab === "train" && (
              <>
                <section>
                  <p className="text-[13px] leading-relaxed text-neutral-200">
                    {node.description}
                  </p>
                  <p
                    className="mt-3 border-l-2 pl-3 text-[13px] italic leading-relaxed text-neutral-400"
                    style={{ borderColor: `oklch(0.56 0.13 ${hue} / 0.55)` }}
                  >
                    {node.why}
                  </p>
                </section>

                <Section
                  title="Training"
                  hint="Difficulty adapts to your track record. Attach a score or an artifact to make a rep count as evidence."
                >
                  <HabitChecklist data={data} node={node} hue={hue} />
                </Section>

                {probes.length > 0 && (
                  <Section
                    title="Diagnostics"
                    hint="Short objective probes. Compared only against your own previous runs."
                  >
                    <div className="space-y-1.5">
                      {probes.map((probe) => {
                        const history = probeHistory(probe.id, progress.diagnostics);
                        return (
                          <button
                            key={probe.id}
                            type="button"
                            onClick={() => onRunProbe(probe.id)}
                            className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-white/25 hover:bg-white/[0.05]"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-medium text-neutral-200">
                                {probe.label}
                              </span>
                              {history.latest && (
                                <span className="shrink-0 tabular-nums text-[11px] text-neutral-400">
                                  {Math.round(history.latest.score * 100)}%
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
                              {history.summary}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {(missions.length > 0 || capstones.length > 0) && (
                  <Section
                    title="Demonstrate it"
                    hint="Multi-node work that produces real evidence of transfer."
                  >
                    <div className="space-y-1.5">
                      {missions.map((mission) => (
                        <button
                          key={mission.id}
                          type="button"
                          onClick={() => onOpenMission(mission.id)}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-white/25 hover:bg-white/[0.05]"
                        >
                          <span className="block text-xs font-medium text-neutral-200">
                            {mission.label}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-neutral-500">
                            Mission · {mission.nodeIds.length} capabilities ·{" "}
                            {mission.estimatedMinutes} min
                          </span>
                        </button>
                      ))}
                      {capstones.map((capstone) => (
                        <button
                          key={capstone.id}
                          type="button"
                          onClick={() => onOpenCapstone(capstone.id)}
                          className="w-full rounded-xl border border-amber-200/15 bg-amber-200/[0.03] px-3 py-2.5 text-left transition-colors hover:border-amber-200/35 hover:bg-amber-200/[0.07]"
                        >
                          <span className="block text-xs font-medium text-amber-50/90">
                            {capstone.label}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-amber-100/50">
                            Capstone · {capstone.clusterLabel}
                          </span>
                        </button>
                      ))}
                    </div>
                  </Section>
                )}

                {paths.length > 0 && (
                  <Section title="On these paths">
                    <div className="flex flex-wrap gap-1.5">
                      {paths.map((path) => (
                        <Chip key={path.id} onClick={() => onOpenPath(path.id)}>
                          {path.label}
                        </Chip>
                      ))}
                    </div>
                  </Section>
                )}

                {neighbors.length > 0 && (
                  <Section
                    title="Connections"
                    hint="Solid = a dependency. Dashed = lateral. Faded = we are less sure."
                  >
                    <div className="space-y-2.5">
                      {(
                        [
                          ["Builds on", grouped.prerequisites],
                          ["Builds toward", grouped.downstream],
                          ["Lateral", grouped.lateral],
                          ["Trade-offs", grouped.tradeoffs],
                        ] as const
                      ).map(([label, list]) =>
                        list.length === 0 ? null : (
                          <div key={label}>
                            <div className="mb-1 text-[9px] uppercase tracking-[0.16em] text-neutral-600">
                              {label}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {list.map((neighbor) => {
                                const target = nodesById.get(neighbor.id);
                                if (!target) return null;
                                return (
                                  <NeighborChip
                                    key={`${label}-${neighbor.id}`}
                                    neighbor={neighbor}
                                    label={target.label}
                                    onSelect={() => onSelectNode(neighbor.id)}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </Section>
                )}

                {node.resources.length > 0 && (
                  <Section title="Resources">
                    <ul className="flex flex-col gap-1.5">
                      {node.resources.map((resource) => {
                        const meta = (
                          <>
                            <span className="shrink-0 rounded bg-white/7 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-neutral-500">
                              {RESOURCE_LABEL[resource.type]}
                            </span>
                            <span className="min-w-0 flex-1">{resource.title}</span>
                          </>
                        );
                        return (
                          <li key={resource.title}>
                            {resource.url ? (
                              <a
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.015] px-2.5 py-2 text-[13px] text-neutral-300 transition-colors hover:border-white/22 hover:bg-white/[0.05] hover:text-white"
                              >
                                {meta}
                                <svg
                                  viewBox="0 0 12 12"
                                  className="h-3 w-3 shrink-0 text-neutral-500"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M4.5 2h5.5v5.5M10 2 2.5 9.5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.3"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </a>
                            ) : (
                              <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-2.5 py-2 text-[13px] text-neutral-400">
                                {meta}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </Section>
                )}
              </>
            )}

            {tab === "evidence" && (
              <EvidenceTab
                node={node}
                researchMode={researchMode}
                onResearchModeChange={onResearchModeChange}
                neighbors={neighbors}
                nodesById={nodesById}
              />
            )}

            {tab === "notes" && (
              <>
                <MarkdownJournal nodeId={node.id} hue={hue} onSelectNode={onSelectNode} />
                {logs.length > 0 && (
                  <Section title="Recent activity">
                    <ul className="flex flex-col gap-1">
                      {logs.slice(0, 15).map((log) => (
                        <li
                          key={log.id}
                          className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-neutral-500 hover:bg-white/[0.035]"
                        >
                          <span
                            className="tabular-nums font-medium"
                            style={{ color: `oklch(0.44 0.13 ${hue})` }}
                          >
                            +{log.xp}
                          </span>
                          {log.evidence && log.evidence !== "self-report" && (
                            <span className="rounded bg-emerald-300/[0.08] px-1 py-0.5 text-[8px] uppercase text-emerald-200/70">
                              {log.evidence}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate">
                            {log.note ?? relativeTime(log.at)}
                          </span>
                          {log.minutes && (
                            <span className="shrink-0 text-neutral-600">{log.minutes}m</span>
                          )}
                          {log.note && (
                            <span className="shrink-0 text-neutral-600">
                              {relativeTime(log.at)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => undoLog(log.id)}
                            className="shrink-0 rounded px-1 text-neutral-600 opacity-0 transition-opacity hover:text-neutral-200 focus:opacity-100 group-hover:opacity-100"
                          >
                            undo
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

/**
 * Research Mode.
 *
 * Everything the curriculum knows about a node, including the parts that
 * undermine it. A system that claims to measure cognition has to be
 * inspectable, and the most useful thing it can show an advanced user is where
 * its own confidence runs out.
 */
function EvidenceTab({
  node,
  researchMode,
  onResearchModeChange,
  neighbors,
  nodesById,
}: {
  node: ConceptNode;
  researchMode: boolean;
  onResearchModeChange: (enabled: boolean) => void;
  neighbors: Neighbor[];
  nodesById: Map<string, ConceptNode>;
}) {
  const evidence = node.evidence;

  if (!evidence) {
    return (
      <Caveat>
        This is a personal node you created. Neuron holds no evidence about it, makes no
        claim that it is a coherent construct, and estimates competence from whatever you
        record against it — nothing more.
      </Caveat>
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title="What is known"
        hint="Three separate claims, because conflating them is how brain training is sold."
      >
        <div className="space-y-2">
          {(
            [
              [
                "Construct validity",
                evidence.constructValidity,
                "Evidence that the thing exists and can be measured as described.",
              ],
              [
                "Trainability",
                evidence.trainability,
                "Evidence that deliberate practice improves performance on it.",
              ],
              [
                "Transfer",
                evidence.transferEvidence,
                "Evidence that improvement generalises beyond the trained task.",
              ],
            ] as const
          ).map(([label, band, blurb]) => (
            <div
              key={label}
              className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-neutral-200">{label}</div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">{blurb}</p>
              </div>
              <ConfidenceChip band={band} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="How it would be measured">
        <p className="text-[12px] leading-relaxed text-neutral-300">
          {evidence.measurementMethod}
        </p>
      </Section>

      <Section title="What this will not do">
        <p className="rounded-lg border border-amber-200/15 bg-amber-200/[0.03] px-3 py-2.5 text-[12px] leading-relaxed text-amber-50/75">
          {evidence.knownLimitations}
        </p>
      </Section>

      <Section
        title="Scientific classification"
        hint="A friendly category and a rigorous one are different things."
      >
        <div className="flex flex-wrap gap-1.5">
          {node.constructs?.length ? (
            node.constructs.map((construct) => (
              <Chip
                key={construct}
                title={
                  CHC_CORE[construct]
                    ? "A CHC broad ability."
                    : "Useful bucket, but outside the CHC broad-ability model — it does not carry the same psychometric backing."
                }
              >
                {CONSTRUCT_LABEL[construct]}
                {!CHC_CORE[construct] && <span className="ml-1 opacity-50">*</span>}
              </Chip>
            ))
          ) : (
            <Caveat>
              This node maps onto no CHC broad ability. That is deliberate — claiming one
              would be worse than admitting none.
            </Caveat>
          )}
        </div>
        {node.constructs?.some((construct) => !CHC_CORE[construct]) && (
          <p className="mt-1.5 text-[9px] text-neutral-600">
            * Outside the CHC broad-ability model.
          </p>
        )}
      </Section>

      <Section title="Sources" hint={`Reviewed ${evidence.evidenceUpdatedAt}.`}>
        <ul className="space-y-1">
          {/* A citation nobody can follow is an assertion wearing a citation's
              clothes. Anything without a link says so on its face. */}
          {evidence.sources.map((source) => (
            <li key={source.title} className="text-[11px] leading-relaxed text-neutral-400">
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted underline-offset-2 hover:text-white"
                >
                  {source.title}
                </a>
              ) : (
                <>
                  {source.title}
                  <span
                    title="No link on file, so this reference has not been checked from inside the app."
                    className="ml-1.5 whitespace-nowrap rounded-full border border-amber-300/35 bg-amber-300/[0.12] px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-amber-100"
                  >
                    unchecked
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[rgb(25_22_20_/_0.035)] px-3 py-2.5">
        <div className="min-w-0 pr-3">
          <div className="text-[11px] font-medium text-neutral-200">Research Mode</div>
          <div className="text-[9px] leading-relaxed text-neutral-500">
            Show edge mechanisms and ranking internals across the whole app
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={researchMode}
          aria-label="Research Mode"
          onClick={() => onResearchModeChange(!researchMode)}
          className={[
            "relative h-7 w-12 shrink-0 rounded-full border transition-colors",
            researchMode
              ? "border-violet-300/30 bg-violet-300/20"
              : "border-white/12 bg-white/[0.04]",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-1 h-5 w-5 rounded-full bg-neutral-100 shadow transition-transform motion-reduce:transition-none",
              researchMode ? "translate-x-[24px]" : "translate-x-[4px]",
            ].join(" ")}
          />
        </button>
      </div>

      {researchMode && (
        <Section
          title="Why these edges exist"
          hint="An edge nobody can explain is an edge nobody should draw."
        >
          <ul className="space-y-2">
            {neighbors.map((neighbor) => {
              const target = nodesById.get(neighbor.id);
              if (!target) return null;
              return (
                <li
                  key={`${neighbor.id}-${neighbor.direction}-${neighbor.relation}`}
                  className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-neutral-200">
                      {neighbor.direction === "in" ? `${target.label} → this` : `this → ${target.label}`}
                    </span>
                    <Chip>{RELATION_LABEL[neighbor.relation]}</Chip>
                    <ConfidenceChip band={neighbor.confidence} />
                    <span className="text-[9px] tabular-nums text-neutral-600">
                      strength {neighbor.strength.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-neutral-400">
                    {neighbor.mechanism ?? (
                      <span className="text-neutral-600">
                        No mechanism recorded for this edge yet. It was inherited from the
                        original hand-drawn curriculum and has not been justified in writing.
                      </span>
                    )}
                  </p>
                  {neighbor.conditional && (
                    <p className="mt-1 text-[10px] italic text-amber-100/55">
                      Only when: {neighbor.conditional}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
