"use client";

import { useMemo, useState } from "react";
import { categoriesById, curriculum } from "@/lib/curriculum";
import { KIND_GLYPH, KIND_LABEL, kindOf } from "@/lib/evidence";
import { neighborsOf } from "@/lib/graph";
import { useProgress } from "../ProgressProvider";
import { Caveat, Chip, EstimateChip, ProvenanceChip, Section, inputClass } from "../ui";
import type { NodeKind } from "@/lib/types";

/**
 * The non-spatial view of the whole graph.
 *
 * This is not a fallback or a degraded mode: it is a complete alternative
 * interface to the map, and everything the map can do — browse, filter, search,
 * inspect prerequisites, open a node — is reachable here with a keyboard and a
 * screen reader. A capability map that can only be used by people who can see
 * and drag a canvas is a capability map for some people.
 */

type SortKey = "category" | "competence" | "practice" | "retention" | "label";

const KINDS: NodeKind[] = [
  "ability",
  "meta",
  "competency",
  "knowledge",
  "enabler",
  "social",
  "augmentation",
];

export function BrowseTab({
  onSelectNode,
  selectedId,
}: {
  onSelectNode: (id: string) => void;
  selectedId: string | null;
}) {
  const model = useProgress();
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<NodeKind | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("category");
  const [openRow, setOpenRow] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return model.nodes
      .filter((node) => {
        if (kindFilter && kindOf(node) !== kindFilter) return false;
        if (categoryFilter && node.categoryId !== categoryFilter) return false;
        if (!needle) return true;
        const category = categoriesById.get(node.categoryId)?.label ?? "";
        return `${node.label} ${node.description} ${category} ${node.why}`
          .toLowerCase()
          .includes(needle);
      })
      .map((node) => ({
        node,
        estimate: model.estimates[node.id],
        retention: model.retentionByNodeId[node.id],
        category: categoriesById.get(node.categoryId),
      }))
      .sort((a, b) => {
        if (sort === "label") return a.node.label.localeCompare(b.node.label);
        if (sort === "competence")
          return (b.estimate?.competence ?? 0) - (a.estimate?.competence ?? 0);
        if (sort === "practice") return (b.estimate?.practice ?? 0) - (a.estimate?.practice ?? 0);
        if (sort === "retention")
          return (a.retention?.retention ?? 1) - (b.retention?.retention ?? 1);
        const categoryOrder = (a.category?.label ?? "").localeCompare(b.category?.label ?? "");
        return categoryOrder !== 0 ? categoryOrder : a.node.tier - b.node.tier;
      });
  }, [model, query, kindFilter, categoryFilter, sort]);

  return (
    <div className="space-y-4">
      <Section
        title="Browse every capability"
        hint="A complete alternative to the map. Everything here works with a keyboard alone."
      >
        <div className="space-y-2.5">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search names, descriptions, categories and rationales…"
            className={inputClass}
            aria-label="Search capabilities"
          />
          <div className="flex flex-wrap gap-1.5">
            <Chip
              tone={kindFilter === null ? "active" : "neutral"}
              pressed={kindFilter === null}
              onClick={() => setKindFilter(null)}
            >
              All kinds
            </Chip>
            {KINDS.map((kind) => (
              <Chip
                key={kind}
                tone={kindFilter === kind ? "active" : "neutral"}
                pressed={kindFilter === kind}
                onClick={() => setKindFilter(kindFilter === kind ? null : kind)}
              >
                {KIND_GLYPH[kind]} {KIND_LABEL[kind]}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              tone={categoryFilter === null ? "active" : "neutral"}
              pressed={categoryFilter === null}
              onClick={() => setCategoryFilter(null)}
            >
              All clusters
            </Chip>
            {curriculum.categories.map((category) => (
              <Chip
                key={category.id}
                tone={categoryFilter === category.id ? "active" : "neutral"}
                pressed={categoryFilter === category.id}
                onClick={() =>
                  setCategoryFilter(categoryFilter === category.id ? null : category.id)
                }
              >
                {category.label}
              </Chip>
            ))}
          </div>
        </div>
      </Section>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <caption className="sr-only">
            All {rows.length} capabilities, with practice, competence and retention.
          </caption>
          <thead>
            <tr className="border-b border-white/10 text-[9px] uppercase tracking-widest text-neutral-500">
              {(
                [
                  ["label", "Capability"],
                  ["category", "Cluster"],
                  ["practice", "Practice"],
                  ["competence", "Competence"],
                  ["retention", "Retention"],
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  scope="col"
                  aria-sort={sort === key ? "descending" : "none"}
                  className="py-2 pr-3 font-semibold"
                >
                  <button
                    type="button"
                    onClick={() => setSort(key)}
                    className={`rounded transition-colors hover:text-neutral-200 ${
                      sort === key ? "text-neutral-200" : ""
                    }`}
                  >
                    {label}
                    {sort === key && <span aria-hidden="true"> ↓</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ node, estimate, retention, category }) => {
              const expanded = openRow === node.id;
              return (
                <tr
                  key={node.id}
                  className={[
                    "border-b border-white/5 align-top transition-colors hover:bg-white/[0.03]",
                    node.id === selectedId ? "bg-cyan-300/[0.05]" : "",
                  ].join(" ")}
                >
                  <th scope="row" className="py-2.5 pr-3 font-normal">
                    <button
                      type="button"
                      onClick={() => onSelectNode(node.id)}
                      className="text-left text-[12px] font-medium text-neutral-200 hover:text-white"
                    >
                      <span aria-hidden="true" className="mr-1.5 text-neutral-600">
                        {KIND_GLYPH[kindOf(node)]}
                      </span>
                      {node.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenRow(expanded ? null : node.id)}
                      aria-expanded={expanded}
                      className="ml-2 rounded text-[10px] text-neutral-600 underline decoration-dotted underline-offset-2 hover:text-neutral-300"
                    >
                      {expanded ? "less" : "more"}
                    </button>
                    {expanded && (
                      <div className="mt-1.5 max-w-md space-y-1.5">
                        <p className="text-[10px] leading-relaxed text-neutral-400">
                          {node.description}
                        </p>
                        <NeighborList nodeId={node.id} onSelectNode={onSelectNode} />
                        {estimate && (
                          <p className="text-[9px] leading-relaxed text-neutral-600">
                            {estimate.confidenceReason}
                          </p>
                        )}
                        {retention && retention.repetitions > 0 && (
                          <p className="text-[9px] leading-relaxed text-neutral-600">
                            {retention.explanation}
                          </p>
                        )}
                      </div>
                    )}
                  </th>
                  <td className="py-2.5 pr-3 text-[11px] text-neutral-500">
                    {category?.label ?? "Personal"}
                  </td>
                  <td className="py-2.5 pr-3 text-[11px] tabular-nums text-neutral-400">
                    {Math.round((estimate?.practice ?? 0) * 100)}%
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] tabular-nums text-neutral-200">
                        {Math.round((estimate?.competence ?? 0) * 100)}%
                      </span>
                      <ProvenanceChip provenance={estimate?.provenance ?? "prior"} />
                      <EstimateChip level={estimate?.confidence ?? "none"} />
                    </div>
                  </td>
                  <td className="py-2.5 text-[11px] tabular-nums text-neutral-400">
                    {retention && retention.repetitions > 0
                      ? `${Math.round(retention.retention * 100)}%`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="py-8 text-center text-xs text-neutral-600">No capabilities match.</p>
      )}

      <Caveat>
        Competence percentages are estimates with stated confidence, not scores. A capability
        you have but never log is indistinguishable here from one you do not have.
      </Caveat>
    </div>
  );
}

function NeighborList({
  nodeId,
  onSelectNode,
}: {
  nodeId: string;
  onSelectNode: (id: string) => void;
}) {
  const model = useProgress();
  const neighbors = useMemo(() => neighborsOf(curriculum, nodeId), [nodeId]);
  const byId = useMemo(
    () => new Map(model.nodes.map((node) => [node.id, node])),
    [model.nodes],
  );

  const prerequisites = neighbors.filter(
    (neighbor) => neighbor.type === "prereq" && neighbor.direction === "in",
  );
  if (prerequisites.length === 0) return null;

  return (
    <p className="text-[10px] text-neutral-500">
      Builds on:{" "}
      {prerequisites.map((neighbor, index) => (
        <span key={neighbor.id}>
          {index > 0 && ", "}
          <button
            type="button"
            onClick={() => onSelectNode(neighbor.id)}
            className="rounded underline decoration-dotted underline-offset-2 hover:text-neutral-200"
          >
            {byId.get(neighbor.id)?.label ?? neighbor.id}
          </button>
        </span>
      ))}
    </p>
  );
}
