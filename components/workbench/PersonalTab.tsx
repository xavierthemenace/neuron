"use client";

import { useRef, useState } from "react";
import { nodesById } from "@/lib/curriculum";
import { KIND_BLURB, KIND_LABEL } from "@/lib/evidence";
import {
  BUNDLED_PACKS,
  materialisePack,
  packNodeIds,
  readPackFile,
  type SkillPack,
} from "@/lib/packs";
import { newId } from "@/lib/storage";
import type { NodeKind, PersonalNode } from "@/lib/types";
import { useProgress } from "../ProgressProvider";
import {
  Caveat,
  Chip,
  EmptyState,
  Field,
  Section,
  buttonClass,
  inputClass,
  primaryButtonClass,
} from "../ui";

const KINDS: NodeKind[] = [
  "competency",
  "knowledge",
  "ability",
  "meta",
  "social",
  "augmentation",
  "enabler",
];

const EXAMPLES = [
  "React Server Components",
  "Salary Negotiation",
  "Japanese Kanji",
  "Fourier Transforms",
  "Photography Composition",
  "Docker",
  "Public Speaking at Work",
];

/**
 * Personal nodes.
 *
 * The canonical core is meant to be stable and small; everything specific to
 * one person's life belongs here. Personal nodes go through exactly the same
 * retention, competence and planning machinery as canonical ones — the only
 * difference is that Neuron makes no scientific claim about them, and says so.
 */
export function PersonalTab({ onSelectNode }: { onSelectNode: (id: string) => void }) {
  const { progress, addPersonalNode, updatePersonalNode, deletePersonalNode } = useProgress();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<NodeKind>("competency");
  const [links, setLinks] = useState<string[]>([]);
  const [linkQuery, setLinkQuery] = useState("");

  const candidates = linkQuery.trim()
    ? [...nodesById.values()]
        .filter((node) => node.label.toLowerCase().includes(linkQuery.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  const create = () => {
    if (label.trim().length < 2) return;
    addPersonalNode({
      label: label.trim(),
      description: description.trim(),
      kind,
      linkedNodeIds: links,
      exercises: [
        {
          id: `personal-ex-${newId()}`,
          label: `Deliberate practice on ${label.trim()}, with a specific target`,
          xp: 15,
          cadence: "daily",
          difficulty: 3,
          evidence: "self-report",
          minutes: 25,
        },
        {
          id: `personal-ex-${newId()}`,
          label: `Produce something with ${label.trim()} and keep the artifact`,
          xp: 25,
          cadence: "weekly",
          difficulty: 4,
          evidence: "artifact",
          minutes: 45,
        },
      ],
    });
    setLabel("");
    setDescription("");
    setLinks([]);
  };

  return (
    <div className="space-y-6">
      <Section
        title="Add a capability"
        hint="Anything specific to your work or life. It trains, decays and plans exactly like a core node."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <Chip key={example} onClick={() => setLabel(example)}>
                {example}
              </Chip>
            ))}
          </div>

          <Field label="Name">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className={inputClass}
              placeholder="e.g. Kubernetes operators"
            />
          </Field>

          <Field label="What it is" hint="Specific enough that you would know whether you have it.">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className={`${inputClass} resize-y`}
            />
          </Field>

          <Field label="Kind" hint={KIND_BLURB[kind]}>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as NodeKind)}
              className={inputClass}
            >
              {KINDS.map((value) => (
                <option key={value} value={value}>
                  {KIND_LABEL[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Draws on"
            hint="Linking to core nodes is what lets the planner reason about it — prerequisites, leverage and all."
          >
            <input
              value={linkQuery}
              onChange={(event) => setLinkQuery(event.target.value)}
              className={inputClass}
              placeholder="Search core capabilities…"
            />
          </Field>
          {candidates.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((node) => (
                <Chip
                  key={node.id}
                  tone={links.includes(node.id) ? "active" : "neutral"}
                  onClick={() =>
                    setLinks((current) =>
                      current.includes(node.id)
                        ? current.filter((id) => id !== node.id)
                        : [...current, node.id],
                    )
                  }
                >
                  {node.label}
                </Chip>
              ))}
            </div>
          )}
          {links.length > 0 && (
            <p className="text-[10px] text-neutral-500">
              Linked: {links.map((id) => nodesById.get(id)?.label).join(", ")}
            </p>
          )}

          <button
            type="button"
            onClick={create}
            disabled={label.trim().length < 2}
            className={primaryButtonClass}
          >
            Create capability
          </button>
        </div>
      </Section>

      <PacksSection />

      <Section title={`Your capabilities (${progress.personalNodes.length})`}>
        {progress.personalNodes.length === 0 ? (
          <EmptyState
            title="No personal capabilities yet"
            body="The 139-node core covers general cognitive capability. It deliberately does not cover Docker, kanji, or negotiating with your specific landlord — those belong here."
          />
        ) : (
          <ul className="space-y-2">
            {progress.personalNodes.map((node) => (
              <PersonalCard
                key={node.id}
                node={node}
                onSelect={() => onSelectNode(node.id)}
                onUpdate={(patch) => updatePersonalNode(node.id, patch)}
                onDelete={() => deletePersonalNode(node.id)}
              />
            ))}
          </ul>
        )}
      </Section>

      <Caveat>
        Neuron holds no evidence about your personal nodes and makes no claim that they are
        coherent constructs. Competence estimates for them come entirely from what you record
        against them, and their estimate confidence is capped accordingly.
      </Caveat>
    </div>
  );
}

function PersonalCard({
  node,
  onSelect,
  onUpdate,
  onDelete,
}: {
  node: PersonalNode;
  onSelect: () => void;
  onUpdate: (patch: Partial<PersonalNode>) => void;
  onDelete: () => void;
}) {
  const model = useProgress();
  const estimate = model.estimates[node.id];
  const [notes, setNotes] = useState(node.notes ?? "");

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onSelect}
            className="text-left text-xs font-medium text-neutral-100 hover:text-white"
          >
            {node.label}
          </button>
          <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
            {node.description || "No description."}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip>{KIND_LABEL[node.kind]}</Chip>
            {node.linkedNodeIds.map((id) => (
              <Chip key={id}>{nodesById.get(id)?.label ?? id}</Chip>
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular-nums text-sm text-neutral-200">
            {Math.round((estimate?.competence ?? 0) * 100)}%
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="mt-1 rounded px-1 text-[10px] text-neutral-600 hover:text-rose-300"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <Field label="Notes">
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={inputClass}
            placeholder="Anything worth remembering about this capability"
          />
        </Field>
        <button type="button" onClick={() => onUpdate({ notes })} className={buttonClass}>
          Save
        </button>
      </div>
    </li>
  );
}

/**
 * Skill packs.
 *
 * Installing a pack materialises its nodes as personal nodes, so from every
 * other part of the app they are indistinguishable from capabilities the user
 * added by hand — same training, same retention model, same planner, same
 * export. Uninstalling removes the definitions and leaves the practice history
 * alone, because the logs are a record of work that actually happened.
 */
function PacksSection() {
  const { progress, addPersonalNode, deletePersonalNode, setPackInstalled } = useProgress();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const installed = new Set(progress.installedPacks ?? []);

  const install = (pack: SkillPack) => {
    // Dedupe on (packId, label) rather than on the pack's namespaced id: the
    // store mints its own ids, so the namespaced one never survives the round
    // trip and a re-install would otherwise duplicate every node.
    const existing = new Set(
      progress.personalNodes
        .filter((node) => node.packId === pack.id)
        .map((node) => node.label),
    );
    let added = 0;
    for (const node of materialisePack(pack)) {
      if (existing.has(node.label)) continue;
      const { id: _generated, createdAt: _created, ...rest } = node;
      void _generated;
      void _created;
      addPersonalNode(rest);
      added += 1;
    }
    setPackInstalled(pack.id, true);
    setError(null);
    setNotice(
      `Installed ${pack.label} ${pack.version}: ${added} capabilit${added === 1 ? "y" : "ies"}, anchored into the core graph.`,
    );
  };

  const uninstall = (packId: string) => {
    for (const id of packNodeIds(packId, progress.personalNodes)) {
      deletePersonalNode(id);
    }
    setPackInstalled(packId, false);
    setNotice("Pack removed. Your logged practice against it is untouched and still exports.");
  };

  return (
    <Section
      title="Skill packs"
      hint="Specialised expertise lives in optional packs that anchor into the core. The core itself stays capped at 140 nodes."
    >
      <div className="space-y-2">
        {BUNDLED_PACKS.map((pack) => (
          <div key={pack.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-neutral-100">{pack.label}</span>
                  <Chip>{pack.version}</Chip>
                  <Chip>{pack.nodes.length} capabilities</Chip>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">{pack.blurb}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-neutral-600">{pack.scope}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  installed.has(pack.id) ? uninstall(pack.id) : install(pack)
                }
                className={installed.has(pack.id) ? buttonClass : primaryButtonClass}
              >
                {installed.has(pack.id) ? "Remove" : "Install"}
              </button>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass}>
            Install a pack from a file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void readPackFile(file)
                .then(install)
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : "That pack could not be read."),
                );
            }}
          />
        </div>

        {notice && <p className="text-[11px] text-emerald-200/80">{notice}</p>}
        {error && (
          <pre className="whitespace-pre-wrap rounded-lg border border-rose-300/20 bg-rose-300/[0.05] p-3 text-[10px] leading-relaxed text-rose-100/80">
            {error}
          </pre>
        )}

        <Caveat>
          A pack is third-party content. It is validated against a schema on
          install — every node must state what it trains, what core capability it
          builds on, and what it will not do — but Neuron cannot check whether its
          claims are true.
        </Caveat>
      </div>
    </Section>
  );
}
