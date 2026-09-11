import type { Progress } from "./types.ts";

export const DB_NAME = "neuron.local.v2";
export const DB_VERSION = 1;

const STORES = {
  progress: "progress",
  journals: "journals",
  attachments: "attachments",
  settings: "settings",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

export interface JournalRecord {
  nodeId: string;
  markdown: string;
  updatedAt: string;
}

export interface AttachmentRecord {
  id: string;
  nodeId: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  blob: Blob;
}

export interface CoachSettings {
  provider: "ollama" | "openai-compatible";
  endpoint: string;
  model: string;
  apiKey?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function openNeuronDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this browser"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.progress)) {
        db.createObjectStore(STORES.progress);
      }
      if (!db.objectStoreNames.contains(STORES.journals)) {
        db.createObjectStore(STORES.journals, { keyPath: "nodeId" });
      }
      if (!db.objectStoreNames.contains(STORES.attachments)) {
        const attachments = db.createObjectStore(STORES.attachments, { keyPath: "id" });
        attachments.createIndex("nodeId", "nodeId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("Could not open Neuron IndexedDB"));
    };
    request.onblocked = () => {
      console.warn("Neuron database upgrade is blocked by another tab.");
    };
  });

  return dbPromise;
}

async function getValue<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openNeuronDb();
  const transaction = db.transaction(storeName, "readonly");
  return requestResult(transaction.objectStore(storeName).get(key)) as Promise<T | undefined>;
}

async function putValue<T>(storeName: StoreName, value: T, key?: IDBValidKey): Promise<void> {
  const db = await openNeuronDb();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  if (key === undefined) store.put(value);
  else store.put(value, key);
  await transactionDone(transaction);
}

async function deleteValue(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openNeuronDb();
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
}

async function getAllValues<T>(storeName: StoreName): Promise<T[]> {
  const db = await openNeuronDb();
  const transaction = db.transaction(storeName, "readonly");
  return requestResult(transaction.objectStore(storeName).getAll()) as Promise<T[]>;
}

export const PROGRESS_KEY = "current";

export function getStoredProgress(): Promise<Progress | undefined> {
  return getValue<Progress>(STORES.progress, PROGRESS_KEY);
}

export function putStoredProgress(progress: Progress): Promise<void> {
  return putValue(STORES.progress, progress, PROGRESS_KEY);
}

export function getJournal(nodeId: string): Promise<JournalRecord | undefined> {
  return getValue<JournalRecord>(STORES.journals, nodeId);
}

export function putJournal(record: JournalRecord): Promise<void> {
  return putValue(STORES.journals, record);
}

export function getAllJournals(): Promise<JournalRecord[]> {
  return getAllValues<JournalRecord>(STORES.journals);
}

export async function addAttachment(record: AttachmentRecord): Promise<void> {
  await putValue(STORES.attachments, record);
}

export async function getAttachments(nodeId: string): Promise<AttachmentRecord[]> {
  const db = await openNeuronDb();
  const transaction = db.transaction(STORES.attachments, "readonly");
  const index = transaction.objectStore(STORES.attachments).index("nodeId");
  return requestResult(index.getAll(nodeId)) as Promise<AttachmentRecord[]>;
}

export function deleteAttachment(id: string): Promise<void> {
  return deleteValue(STORES.attachments, id);
}

export function putSetting<T>(key: string, value: T): Promise<void> {
  return putValue(STORES.settings, value, key);
}

export function getSetting<T>(key: string): Promise<T | undefined> {
  return getValue<T>(STORES.settings, key);
}

export async function clearNeuronDatabase(): Promise<void> {
  const db = await openNeuronDb();
  const transaction = db.transaction(Object.values(STORES), "readwrite");
  for (const storeName of Object.values(STORES)) {
    transaction.objectStore(storeName).clear();
  }
  await transactionDone(transaction);
}
