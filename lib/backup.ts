import {
  getAllJournals,
  getAttachments,
  getSetting,
  putJournal,
  putSetting,
  addAttachment,
  type AttachmentRecord,
  type JournalRecord,
} from "./db.ts";
import { CURRICULUM_VERSION } from "./curriculum.ts";
import { newId, parseProgress } from "./storage.ts";
import type { Progress } from "./types.ts";

/**
 * Whole-system backup.
 *
 * A local-first app with no account has exactly one guarantee to offer: you can
 * take everything with you. That means everything — progress, journals,
 * attachments, personal nodes, goals, predictions, experiments and settings —
 * in one versioned file that this same module can read back.
 *
 * Attachments are base64-encoded inline rather than zipped. It is less
 * efficient and it means the file is a single JSON document that stays
 * readable and re-importable without any tooling, which matters more for a
 * format people are meant to trust with years of records.
 */

export const BACKUP_FORMAT = "neuron.backup";
export const BACKUP_VERSION = 1;

export interface BackupAttachment {
  id: string;
  nodeId: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  /** base64, without a data: prefix. */
  data: string;
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  curriculumVersion: string;
  progress: Progress;
  journals: JournalRecord[];
  attachments: BackupAttachment[];
  settings: Record<string, unknown>;
}

/** Settings worth carrying across devices. Credentials are never included. */
const PORTABLE_SETTINGS = ["onboarding-complete-v2", "coach-context-consent"];

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Chunked: String.fromCharCode(...bytes) blows the argument limit on anything
  // larger than a small image.
  const CHUNK = 0x8000;
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}

function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}

export async function buildBackup(progress: Progress): Promise<Backup> {
  const journals = await getAllJournals().catch(() => [] as JournalRecord[]);

  const attachments: BackupAttachment[] = [];
  const nodeIds = new Set(journals.map((journal) => journal.nodeId));
  for (const log of progress.logs) nodeIds.add(log.nodeId);
  for (const capstone of progress.capstones) {
    for (const id of capstone.nodeIds) nodeIds.add(id);
  }

  for (const nodeId of nodeIds) {
    const records = await getAttachments(nodeId).catch(() => [] as AttachmentRecord[]);
    for (const record of records) {
      attachments.push({
        id: record.id,
        nodeId: record.nodeId,
        name: record.name,
        type: record.type,
        size: record.size,
        createdAt: record.createdAt,
        data: await blobToBase64(record.blob),
      });
    }
  }

  const settings: Record<string, unknown> = {};
  for (const key of PORTABLE_SETTINGS) {
    const value = await getSetting<unknown>(key).catch(() => undefined);
    if (value !== undefined) settings[key] = value;
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    curriculumVersion: CURRICULUM_VERSION,
    progress,
    journals,
    attachments,
    settings,
  };
}

export async function exportBackup(progress: Progress): Promise<void> {
  const backup = await buildBackup(progress);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `neuron-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  progress: Progress;
  journals: number;
  attachments: number;
  summary: string;
}

/**
 * Reads a backup, or a bare progress file from any earlier version.
 *
 * Accepting the older shapes is not politeness: a format that refuses last
 * year's export is a format nobody can rely on, and the whole value of
 * local-first storage is that the file keeps working.
 */
export async function importBackup(file: File): Promise<ImportResult> {
  const raw = JSON.parse(await file.text()) as Record<string, unknown>;

  // A bare progress export (v1 or v2) rather than a full backup.
  if (raw.format !== BACKUP_FORMAT) {
    const progress = parseProgress(raw);
    if (!progress) throw new Error("Not a valid Neuron backup or progress file.");
    return {
      progress,
      journals: 0,
      attachments: 0,
      summary: `Imported ${progress.logs.length} practice logs from a progress-only file. Journals and attachments were not in this format.`,
    };
  }

  const backup = raw as unknown as Backup;
  const progress = parseProgress(backup.progress);
  if (!progress) throw new Error("The backup's progress section could not be read.");

  let journals = 0;
  for (const journal of backup.journals ?? []) {
    if (typeof journal?.nodeId !== "string" || typeof journal?.markdown !== "string") continue;
    await putJournal({
      nodeId: journal.nodeId,
      markdown: journal.markdown,
      updatedAt: journal.updatedAt ?? new Date().toISOString(),
    }).catch(() => undefined);
    journals += 1;
  }

  let attachments = 0;
  for (const attachment of backup.attachments ?? []) {
    if (!attachment?.data || typeof attachment.nodeId !== "string") continue;
    try {
      await addAttachment({
        // A fresh id avoids colliding with an attachment already in this
        // browser under the same id from a different device.
        id: newId(),
        nodeId: attachment.nodeId,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        createdAt: attachment.createdAt,
        blob: base64ToBlob(attachment.data, attachment.type),
      });
      attachments += 1;
    } catch {
      // A single unreadable attachment must not abort the whole import.
    }
  }

  for (const [key, value] of Object.entries(backup.settings ?? {})) {
    if (!PORTABLE_SETTINGS.includes(key)) continue;
    await putSetting(key, value).catch(() => undefined);
  }

  const parts = [
    `${progress.logs.length} practice logs`,
    `${progress.personalNodes.length} personal nodes`,
    `${progress.predictions.length} predictions`,
    `${journals} journals`,
    `${attachments} attachments`,
  ];

  return {
    progress,
    journals,
    attachments,
    summary: `Imported ${parts.join(", ")}. Backup was taken ${
      backup.exportedAt ? new Date(backup.exportedAt).toLocaleDateString() : "at an unknown date"
    } against curriculum ${backup.curriculumVersion ?? "unknown"}.`,
  };
}
