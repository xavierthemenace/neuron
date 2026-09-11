import { curriculum, nodesById } from "./curriculum.ts";
import type { JournalRecord } from "./db.ts";

/**
 * The journal as a thinking system rather than a text box.
 *
 * A per-node notes field is where insight goes to be forgotten. What makes a
 * journal part of a learning system is that its contents can be addressed
 * ([[links]]), found from the other end (backlinks), classified (tags and
 * markers), and converted into the objects that actually drive training —
 * flashcards, predictions, questions and personal capabilities.
 *
 * All of it is pure text parsing over Markdown the user owns. Nothing here
 * invents a proprietary format: a Neuron journal is a Markdown file that an
 * Obsidian vault or a plain editor reads without losing anything.
 */

export interface WikiLink {
  /** The text inside the brackets. */
  raw: string;
  /** Resolved canonical node id, when the text matches one. */
  nodeId: string | null;
  start: number;
  end: number;
}

const LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** Case- and punctuation-insensitive label index, built once. */
const LABEL_INDEX = new Map<string, string>();
for (const node of curriculum.nodes) {
  LABEL_INDEX.set(normalise(node.label), node.id);
  LABEL_INDEX.set(normalise(node.id), node.id);
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Resolves `[[Bayesian Updating]]` to a node id, by label or by id. */
export function resolveLink(text: string, personalLabels?: Map<string, string>): string | null {
  const key = normalise(text);
  return LABEL_INDEX.get(key) ?? personalLabels?.get(key) ?? null;
}

export function parseLinks(
  markdown: string,
  personalLabels?: Map<string, string>,
): WikiLink[] {
  const links: WikiLink[] = [];
  LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_PATTERN.exec(markdown)) !== null) {
    const raw = match[1].trim();
    links.push({
      raw,
      nodeId: resolveLink(raw, personalLabels),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return links;
}

/** `#tags`, excluding Markdown headings. */
export function parseTags(markdown: string): string[] {
  const tags = new Set<string>();
  for (const line of markdown.split("\n")) {
    // A heading is "# " at the start of a line; a tag is never followed by a space.
    for (const match of line.matchAll(/(?:^|\s)#([a-z0-9][a-z0-9/_-]{1,40})\b/gi)) {
      tags.add(match[1].toLowerCase());
    }
  }
  return [...tags].sort();
}

/**
 * Line-level markers.
 *
 * Deliberately a tiny vocabulary of prefixes rather than a syntax to learn.
 * Each one maps to something the rest of the app can act on, which is the
 * difference between a note-taking convention and an input to a learning
 * system.
 */
export type MarkerKind = "question" | "insight" | "prediction" | "unresolved" | "quote";

export interface Marker {
  kind: MarkerKind;
  text: string;
  line: number;
}

const MARKERS: { kind: MarkerKind; pattern: RegExp }[] = [
  { kind: "question", pattern: /^\s*(?:\?|Q:)\s*(.+)$/i },
  { kind: "insight", pattern: /^\s*(?:!|Insight:)\s*(.+)$/i },
  { kind: "prediction", pattern: /^\s*(?:~|Prediction:)\s*(.+)$/i },
  { kind: "unresolved", pattern: /^\s*(?:TODO|Unresolved):\s*(.+)$/i },
  { kind: "quote", pattern: /^\s*>\s?(.+)$/ },
];

export function parseMarkers(markdown: string): Marker[] {
  const markers: Marker[] = [];
  markdown.split("\n").forEach((line, index) => {
    for (const { kind, pattern } of MARKERS) {
      const match = line.match(pattern);
      if (!match) continue;
      markers.push({ kind, text: match[1].trim(), line: index });
      break;
    }
  });
  return markers;
}

export interface Backlink {
  /** The node whose journal contains the reference. */
  fromNodeId: string;
  /** The line it appears on, for context. */
  excerpt: string;
  line: number;
}

/**
 * Every reference *to* a node, from every journal.
 *
 * This is the half that makes links worth writing: a note filed under one
 * capability becomes visible from the capability it mentions, which is where
 * you will be standing when it becomes relevant.
 */
export function buildBacklinks(
  journals: JournalRecord[],
  personalLabels?: Map<string, string>,
): Map<string, Backlink[]> {
  const index = new Map<string, Backlink[]>();

  for (const journal of journals) {
    const lines = journal.markdown.split("\n");
    lines.forEach((line, lineNumber) => {
      for (const link of parseLinks(line, personalLabels)) {
        if (!link.nodeId || link.nodeId === journal.nodeId) continue;
        const list = index.get(link.nodeId) ?? [];
        list.push({
          fromNodeId: journal.nodeId,
          excerpt: line.trim().slice(0, 240),
          line: lineNumber,
        });
        index.set(link.nodeId, list);
      }
    });
  }

  return index;
}

/** Journal templates, offered rather than imposed. */
export const TEMPLATES: { id: string; label: string; body: string }[] = [
  {
    id: "decision",
    label: "Decision",
    body: `## Decision\n\n**What I am deciding:** \n\n**Options I am actually considering:** \n\n**What each one displaces:** \n\n~ I expect  — confidence %\n\n? What would tell me this was wrong: \n\n**Review on:** `,
  },
  {
    id: "reading",
    label: "Reading note",
    body: `## Source\n\n**What it claims:** \n\n**What it measured:** \n\n**How much it should move me, and why:** \n\n> \n\n! \n\n? `,
  },
  {
    id: "session",
    label: "Practice session",
    body: `## Session\n\n**Target difficulty:** \n\n**What I got wrong, and which kind of error it was:** \n\n**What I will change next time:** \n\n! `,
  },
  {
    id: "postmortem",
    label: "Post-mortem",
    body: `## What happened\n\n**What I expected at the time:** \n\n**What actually happened:** \n\n**The earliest point I could have known:** \n\n**The checklist item that would have caught it:** \n\n! `,
  },
];

export interface JournalSummary {
  words: number;
  links: WikiLink[];
  unresolvedLinks: WikiLink[];
  tags: string[];
  markers: Marker[];
}

export function summariseJournal(
  markdown: string,
  personalLabels?: Map<string, string>,
): JournalSummary {
  const links = parseLinks(markdown, personalLabels);
  return {
    words: markdown.trim() ? markdown.trim().split(/\s+/).length : 0,
    links,
    unresolvedLinks: links.filter((link) => link.nodeId === null),
    tags: parseTags(markdown),
    markers: parseMarkers(markdown),
  };
}

/** Label for an unresolved `[[link]]`, used when offering to create a node. */
export function suggestNodeForLink(raw: string): { label: string; nearest: string | null } {
  const key = normalise(raw);
  let nearest: string | null = null;
  let best = 0;
  for (const node of curriculum.nodes) {
    const candidate = normalise(node.label);
    // Cheap containment score: good enough to catch a near-miss spelling
    // without pulling in a string-distance dependency for one hint.
    const score = candidate.includes(key) || key.includes(candidate) ? key.length : 0;
    if (score > best) {
      best = score;
      nearest = node.id;
    }
  }
  return { label: raw.trim(), nearest };
}

export function labelFor(nodeId: string): string {
  return nodesById.get(nodeId)?.label ?? nodeId;
}
