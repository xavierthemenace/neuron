import { getAllJournals } from "./db.ts";
import { neighborsOf } from "./graph.ts";
import type { IntelligenceData } from "./types.ts";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function exportAnkiCsv(data: IntelligenceData) {
  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const rows: string[][] = [["Front", "Back", "Tags"]];

  for (const node of data.nodes) {
    const category = categories.get(node.categoryId);
    const tag = `neuron::${(category?.label ?? "faculty").replaceAll(" ", "_")}`;
    rows.push([
      node.label,
      `${node.description}\n\nWhy it matters: ${node.why}`,
      `${tag} neuron::definition`,
    ]);
    for (const exercise of node.exercises) {
      rows.push([
        `${node.label}: ${exercise.label}`,
        `Practice task · ${exercise.cadence} · ${exercise.xp} base XP`,
        `${tag} neuron::exercise`,
      ]);
    }
  }

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  download(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `neuron-anki-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "Untitled";
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function push16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function push32(target: number[], value: number) {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function dosDateTime(date: Date): { date: number; time: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

function zipStored(files: Array<{ name: string; content: string }>): Blob {
  const encoder = new TextEncoder();
  const local: number[] = [];
  const central: number[] = [];
  const stamp = dosDateTime(new Date());
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const body = encoder.encode(file.content);
    const crc = crc32(body);
    const header: number[] = [];
    push32(header, 0x04034b50);
    push16(header, 20);
    push16(header, 0x0800);
    push16(header, 0);
    push16(header, stamp.time);
    push16(header, stamp.date);
    push32(header, crc);
    push32(header, body.length);
    push32(header, body.length);
    push16(header, name.length);
    push16(header, 0);
    header.push(...name, ...body);
    local.push(...header);

    const directory: number[] = [];
    push32(directory, 0x02014b50);
    push16(directory, 20);
    push16(directory, 20);
    push16(directory, 0x0800);
    push16(directory, 0);
    push16(directory, stamp.time);
    push16(directory, stamp.date);
    push32(directory, crc);
    push32(directory, body.length);
    push32(directory, body.length);
    push16(directory, name.length);
    push16(directory, 0);
    push16(directory, 0);
    push16(directory, 0);
    push16(directory, 0);
    push32(directory, 0);
    push32(directory, offset);
    directory.push(...name);
    central.push(...directory);
    offset += header.length;
  }

  const end: number[] = [];
  push32(end, 0x06054b50);
  push16(end, 0);
  push16(end, 0);
  push16(end, files.length);
  push16(end, files.length);
  push32(end, central.length);
  push32(end, local.length);
  push16(end, 0);

  return new Blob(
    [new Uint8Array(local), new Uint8Array(central), new Uint8Array(end)],
    { type: "application/zip" },
  );
}

export async function exportObsidianVault(data: IntelligenceData) {
  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const nodes = new Map(data.nodes.map((node) => [node.id, node]));
  const journals = new Map((await getAllJournals()).map((record) => [record.nodeId, record]));

  const files = data.nodes.map((node) => {
    const category = categories.get(node.categoryId);
    const connections = neighborsOf(data, node.id)
      .map((connection) => nodes.get(connection.id))
      .filter((value) => value !== undefined)
      .map((connected) => `[[${safeName(connected.label)}]]`);
    const resources = node.resources
      .map((resource) => `- ${resource.url ? `[${resource.title}](${resource.url})` : resource.title} _(${resource.type})_`)
      .join("\n");
    const exercises = node.exercises
      .map((exercise) => `- [ ] ${exercise.label} — ${exercise.xp} XP, ${exercise.cadence}`)
      .join("\n");
    const journal = journals.get(node.id)?.markdown.trim();

    const content = [
      "---",
      `neuron_id: ${node.id}`,
      `category: "${category?.label ?? ""}"`,
      `domain: ${category?.domain ?? ""}`,
      `tier: ${node.tier}`,
      "tags:",
      "  - neuron",
      `  - neuron/${node.categoryId}`,
      "---",
      "",
      `# ${node.label}`,
      "",
      node.description,
      "",
      `> ${node.why}`,
      "",
      "## Training",
      exercises || "No exercises.",
      "",
      "## Pathways",
      connections.length ? connections.map((link) => `- ${link}`).join("\n") : "No direct connections.",
      "",
      "## Resources",
      resources || "No resources.",
      "",
      "## Journal",
      journal || "_No personal notes yet._",
      "",
    ].join("\n");

    return { name: `${safeName(node.label)}.md`, content };
  });

  files.push({
    name: "README.md",
    content: `# Neuron Vault\n\nExported ${new Date().toLocaleString()}.\n\nOpen any faculty note and follow its [[wikilinks]] to traverse the cognitive graph.\n`,
  });

  download(
    zipStored(files),
    `neuron-obsidian-${new Date().toISOString().slice(0, 10)}.zip`,
  );
}
