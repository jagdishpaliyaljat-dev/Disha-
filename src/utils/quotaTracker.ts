import {
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  getCountFromServer,
  disableNetwork,
  enableNetwork,
  increment,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import type {
  DocumentReference,
  Query,
  CollectionReference,
  SetOptions,
  Firestore,
  WriteBatch,
  Transaction,
  DocumentSnapshot,
  QuerySnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { isUserAdmin, loadUserProfile } from "./userProfileStorage";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { sanitizeFirestorePayload } from "./firebaseSyncService";

/**
 * Quota Tracker & Guarded Firestore Wrappers
 * Enforces accurate single-point counting of Firestore billing usage,
 * Pacific Time (America/Los_Angeles) daily reset, circuit breaker protection,
 * idempotency deduplication, durable pending operations recovery queue,
 * and strict separation of attempted vs confirmed vs failed vs pending telemetry.
 */

export type QuotaCategory = "Admin" | "Student" | "QA" | "Health" | "Background";

export const SPARK_DAILY_READ_LIMIT = 50000;
export const SPARK_DAILY_WRITE_LIMIT = 20000;
export const SPARK_DAILY_DELETE_LIMIT = 20000;
export const PROACTIVE_WRITE_BREAKER_THRESHOLD = 19500;
export const MAX_FIRESTORE_BATCH_OPS = 500;

const STORAGE_KEY_PREFIX = "quizpro_quota_tracker_summary_v2_";
const SETTINGS_KEY = "quizpro_quota_tracker_settings_v2";
const DEVICE_ID_KEY = "quizpro_device_id_v1";
const QUOTA_EXHAUSTED_KEY = "quizpro_quota_exhausted_v1";
const QUOTA_EXHAUSTED_DATE_KEY = "quizpro_quota_exhausted_date_v1";
const PENDING_QUEUE_KEY = "quizpro_pending_writes_queue_v1";
const COMMITTED_IDEMPOTENCY_KEY = "quizpro_idempotency_committed_v1";
const MAX_PENDING_QUEUE_SIZE = 500;
const MAX_COMMITTED_KEYS_CACHE = 500;
const SENTINEL_MARKER = "__quizpro_fv__";

// ─────────────────────────────────────────────────────────────────────────────
// TESTABLE FIRESTORE SDK DRIVER (defaults to live firebase/firestore SDK)
// ─────────────────────────────────────────────────────────────────────────────

export interface FirestoreDriver {
  doc: typeof doc;
  getDoc: typeof getDoc;
  getDocs: typeof getDocs;
  onSnapshot: typeof onSnapshot;
  setDoc: typeof setDoc;
  updateDoc: typeof updateDoc;
  deleteDoc: typeof deleteDoc;
  writeBatch: typeof writeBatch;
  runTransaction: typeof runTransaction;
  getCountFromServer: typeof getCountFromServer;
  disableNetwork: typeof disableNetwork;
  enableNetwork: typeof enableNetwork;
  increment: typeof increment;
  serverTimestamp: typeof serverTimestamp;
  deleteField: typeof deleteField;
}

const defaultFirestoreDriver: FirestoreDriver = {
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  getCountFromServer,
  disableNetwork,
  enableNetwork,
  increment,
  serverTimestamp,
  deleteField,
};

let firestoreDriver: FirestoreDriver = { ...defaultFirestoreDriver };
let customDriverActive = false;
let testAuthUserOverride: { uid: string; email?: string | null } | null = null;

export function __setFirestoreDriverForTests(partialDriver: Partial<FirestoreDriver> | null): void {
  if (!partialDriver) {
    firestoreDriver = { ...defaultFirestoreDriver };
    customDriverActive = false;
  } else {
    firestoreDriver = { ...defaultFirestoreDriver, ...partialDriver };
    customDriverActive = true;
  }
}

export function isFirestoreTestDriverActive(): boolean {
  return customDriverActive;
}

export function __setTestAuthUserForTests(user: { uid: string; email?: string | null } | null): void {
  testAuthUserOverride = user;
}

export function getEffectiveAuthUser(): { uid: string; email?: string | null } | null {
  return auth.currentUser || testAuthUserOverride;
}

export function __resetInMemoryStateForTests(): void {
  quotaExhausted = false;
  quotaExhaustedDate = null;
  inMemoryPendingQueue = [];
  inMemoryCommittedKeys = [];
  simulatedDateOverride = null;
  firestoreCache.clear();
  guardedInFlightRequests.clear();
}

export interface QuotaStateSnapshot {
  dateKey: string;
  summaryJson: string | null;
  settingsJson: string | null;
  exhaustedVal: string | null;
  exhaustedDate: string | null;
  pendingQueueJson: string | null;
  committedKeysJson: string | null;
  quotaExhaustedInMem: boolean;
  quotaExhaustedDateInMem: string | null;
  inMemoryPendingQueue: PendingWriteOperation[];
  inMemoryCommittedKeys: string[];
  simulatedDateOverride: string | null;
}

export function snapshotQuotaStateForTests(): QuotaStateSnapshot {
  const dateKey = getCurrentQuotaDate();
  const hasLS = typeof localStorage !== "undefined";
  return {
    dateKey,
    summaryJson: hasLS ? localStorage.getItem(STORAGE_KEY_PREFIX + dateKey) : null,
    settingsJson: hasLS ? localStorage.getItem(SETTINGS_KEY) : null,
    exhaustedVal: hasLS ? localStorage.getItem(QUOTA_EXHAUSTED_KEY) : null,
    exhaustedDate: hasLS ? localStorage.getItem(QUOTA_EXHAUSTED_DATE_KEY) : null,
    pendingQueueJson: hasLS ? localStorage.getItem(PENDING_QUEUE_KEY) : null,
    committedKeysJson: hasLS ? localStorage.getItem(COMMITTED_IDEMPOTENCY_KEY) : null,
    quotaExhaustedInMem: quotaExhausted,
    quotaExhaustedDateInMem: quotaExhaustedDate,
    inMemoryPendingQueue: [...inMemoryPendingQueue],
    inMemoryCommittedKeys: [...inMemoryCommittedKeys],
    simulatedDateOverride,
  };
}

export function restoreQuotaStateForTests(snap: QuotaStateSnapshot): void {
  simulatedDateOverride = snap.simulatedDateOverride;
  quotaExhausted = snap.quotaExhaustedInMem;
  quotaExhaustedDate = snap.quotaExhaustedDateInMem;
  inMemoryPendingQueue = [...snap.inMemoryPendingQueue];
  inMemoryCommittedKeys = [...snap.inMemoryCommittedKeys];
  firestoreCache.clear();
  guardedInFlightRequests.clear();

  if (typeof localStorage !== "undefined") {
    const restoreOrRemove = (k: string, v: string | null) => {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    };
    restoreOrRemove(STORAGE_KEY_PREFIX + snap.dateKey, snap.summaryJson);
    restoreOrRemove(SETTINGS_KEY, snap.settingsJson);
    restoreOrRemove(QUOTA_EXHAUSTED_KEY, snap.exhaustedVal);
    restoreOrRemove(QUOTA_EXHAUSTED_DATE_KEY, snap.exhaustedDate);
    restoreOrRemove(PENDING_QUEUE_KEY, snap.pendingQueueJson);
    restoreOrRemove(COMMITTED_IDEMPOTENCY_KEY, snap.committedKeysJson);
  }
  notifyListeners(getQuotaSummary(snap.dateKey));
}

export interface QuotaActionLog {
  id: string;
  timestamp: number;
  actionName: string;
  category: QuotaCategory;
  collectionName: string;
  reads: number;
  writes: number;
  deletes: number;
  failed: boolean;
  errorCode?: string;
  errorMessage?: string;
  path?: string;
  operation?: "read" | "write" | "delete" | "transaction";
  screen?: string;
  userId?: string;
  userEmail?: string;
  idempotencyKey?: string;
}

export interface QuotaCategorySummary {
  reads: number;
  writes: number;
  deletes: number;
}

export interface QuotaDailySummary {
  date: string; // YYYY-MM-DD in America/Los_Angeles
  reads: number;
  writes: number; // Confirmed total mutations against daily 20k limit (successfulWrites + confirmedDeletes)
  deletes: number;
  attemptedWrites: number;
  successfulWrites: number;
  confirmedDeletes: number;
  pendingWrites: number;
  estimatedTransactionOps: number;
  failedReads: number;
  failedWrites: number;
  qaFailedCount: number;
  byCategory: Record<QuotaCategory, QuotaCategorySummary>;
  byCollection: Record<string, QuotaCategorySummary>;
  topActions: Record<string, { actionName: string; category: QuotaCategory; reads: number; writes: number; deletes: number; count: number; failedCount: number }>;
  logs: QuotaActionLog[];
  cloudSyncEnabled: boolean;
  lastCloudSyncAt: number;
  lastUploadedReads?: number;
  lastUploadedWrites?: number;
  lastUploadedDeletes?: number;
  consoleNumberReads?: number;
  consoleNumberWrites?: number;
  lastUpdatedAt: number;
}

export interface PendingWriteOperation {
  id: string;
  idempotencyKey: string;
  type: "set" | "update" | "delete" | "batch";
  path: string;
  collectionName: string;
  category: QuotaCategory;
  actionName: string;
  screen?: string;
  data?: any;
  options?: SetOptions;
  batchOps?: Array<{
    op: "set" | "update" | "delete";
    path: string;
    data?: any;
    options?: SetOptions;
  }>;
  createdAt: number;
  lastAttemptAt?: number;
  attempts: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  opCount: number;
  deleteCount: number;
}

// Simple Event Emitter for live UI updates without Firestore calls
type QuotaListener = (summary: QuotaDailySummary) => void;
const listeners: Set<QuotaListener> = new Set();

export function subscribeQuota(listener: QuotaListener): () => void {
  listeners.add(listener);
  listener(getQuotaSummary());
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(summary: QuotaDailySummary) {
  listeners.forEach((l) => {
    try {
      l(summary);
    } catch (err) {
      console.error("Quota listener error:", err);
    }
  });
}

// --- Shared Firestore Cache (Senior Architect Optimization) ---
// Reduces reads by serving identical queries from memory within a TTL.

interface CacheEntry {
  data: any;
  timestamp: number;
}

const firestoreCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const guardedInFlightRequests = new Map<string, Promise<any>>();

let activeListenersCount = 0;
let inFlightDeduplicationsCount = 0;
let cacheHitsCount = 0;

export function getActiveListenersCount(): number {
  return activeListenersCount;
}

export function getReadOptimizationStats() {
  return {
    activeListeners: activeListenersCount,
    inFlightDeduplications: inFlightDeduplicationsCount,
    cacheHits: cacheHitsCount,
    cacheSize: firestoreCache.size,
  };
}

function getCacheKey(queryOrRef: any): string {
  try {
    if (queryOrRef.path) return queryOrRef.path;
    if (queryOrRef._query) {
      return JSON.stringify(queryOrRef._query);
    }
  } catch {}
  return String(queryOrRef);
}

export function clearFirestoreCache() {
  firestoreCache.clear();
  guardedInFlightRequests.clear();
}

// Dev-only direct call detector warning
export function warnDirectFirestoreCall(methodName: string) {
  console.warn(`[QuotaTracker Warning] Direct Firestore call '${methodName}' detected outside guarded wrapper!`);
}

// Device ID generation
export function getDeviceId(): string {
  if (typeof localStorage === "undefined") {
    return "device_unknown";
  }
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = "dev_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// Pacific Date Calculation (America/Los_Angeles, DST aware)
export function getPacificDateString(d: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(d);
    let year = "", month = "", day = "";
    for (const part of parts) {
      if (part.type === "year") year = part.value;
      if (part.type === "month") month = part.value;
      if (part.type === "day") day = part.value;
    }
    return `${year}-${month}-${day}`;
  } catch {
    return d.toISOString().split("T")[0];
  }
}

export function getTimeUntilPacificMidnight(): { hours: number; minutes: number; text: string } {
  try {
    const now = new Date();
    const pacificNowStr = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    const pacificNow = new Date(pacificNowStr);

    const pacificMidnight = new Date(pacificNow);
    pacificMidnight.setHours(24, 0, 0, 0);

    const diffMs = Math.max(0, pacificMidnight.getTime() - pacificNow.getTime());
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return {
      hours,
      minutes,
      text: `${hours}h ${minutes}m`,
    };
  } catch {
    return { hours: 12, minutes: 0, text: "12h 0m" };
  }
}

let simulatedDateOverride: string | null = null;

export function setSimulatedPacificDate(dateStr: string | null): void {
  simulatedDateOverride = dateStr;
  // Re-evaluate circuit breaker date rollover immediately on simulated date transitions
  isQuotaExhausted();
  notifyListeners(getQuotaSummary());
}

export function getCurrentQuotaDate(): string {
  return simulatedDateOverride || getPacificDateString();
}

// ─────────────────────────────────────────────────────────────────────────────
// SENTINEL SERIALIZATION & DURABLE PENDING OPERATIONS QUEUE
// ─────────────────────────────────────────────────────────────────────────────

function serializeForPendingQueue(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) {
    return { [SENTINEL_MARKER]: "date", iso: value.toISOString() };
  }
  if (typeof value === "object") {
    const methodName = (value as any)._methodName;
    if (methodName === "serverTimestamp") {
      return { [SENTINEL_MARKER]: "serverTimestamp" };
    }
    if (methodName === "increment" && typeof (value as any)._operand === "number") {
      return { [SENTINEL_MARKER]: "increment", operand: (value as any)._operand };
    }
    if (methodName === "deleteField") {
      return { [SENTINEL_MARKER]: "deleteField" };
    }
    if (typeof (value as any).toDate === "function") {
      try {
        return { [SENTINEL_MARKER]: "date", iso: (value as any).toDate().toISOString() };
      } catch {}
    }
    if (Array.isArray(value)) {
      return value.map(serializeForPendingQueue);
    }
    if (value.constructor && value.constructor !== Object) {
      return value;
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        out[k] = serializeForPendingQueue(v);
      }
    }
    return out;
  }
  return value;
}

function deserializeFromPendingQueue(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(deserializeFromPendingQueue);
  }
  if (typeof value === "object") {
    const marker = (value as any)[SENTINEL_MARKER];
    if (marker === "serverTimestamp") {
      return firestoreDriver.serverTimestamp();
    }
    if (marker === "increment") {
      return firestoreDriver.increment(Number((value as any).operand ?? 1));
    }
    if (marker === "deleteField") {
      return firestoreDriver.deleteField();
    }
    if (marker === "date" && (value as any).iso) {
      return new Date((value as any).iso);
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = deserializeFromPendingQueue(v);
    }
    return out;
  }
  return value;
}

let inMemoryPendingQueue: PendingWriteOperation[] = [];

export function getPendingWrites(): PendingWriteOperation[] {
  if (typeof localStorage === "undefined") {
    return [...inMemoryPendingQueue];
  }
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [...inMemoryPendingQueue];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      inMemoryPendingQueue = parsed;
      return parsed;
    }
  } catch {}
  return [...inMemoryPendingQueue];
}

export function getPendingWritesCount(): number {
  return getPendingWrites().length;
}

function savePendingWrites(queue: PendingWriteOperation[]): void {
  const capped = queue.length > MAX_PENDING_QUEUE_SIZE
    ? queue.slice(queue.length - MAX_PENDING_QUEUE_SIZE)
    : queue;
  inMemoryPendingQueue = capped;

  if (typeof localStorage !== "undefined") {
    try {
      if (capped.length === 0) {
        localStorage.removeItem(PENDING_QUEUE_KEY);
      } else {
        localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(capped));
      }
    } catch (err) {
      console.warn("[QuotaTracker] Failed to persist pending writes queue:", err);
    }
  }

  // Keep current summary's pendingWrites count synchronized and notify listeners
  const dateKey = getCurrentQuotaDate();
  const summary = getQuotaSummary(dateKey);
  if (summary.pendingWrites !== capped.length) {
    summary.pendingWrites = capped.length;
    saveQuotaSummary(summary);
  }
}

export function clearPendingWrites(): void {
  savePendingWrites([]);
}

function enqueuePendingWrite(
  op: Omit<PendingWriteOperation, "id" | "createdAt" | "attempts">
): PendingWriteOperation {
  const queue = getPendingWrites();
  const existingIdx = queue.findIndex((item) => item.idempotencyKey === op.idempotencyKey);

  const serializedOp: PendingWriteOperation = {
    ...op,
    id: existingIdx >= 0 ? queue[existingIdx].id : `pw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    createdAt: existingIdx >= 0 ? queue[existingIdx].createdAt : Date.now(),
    lastAttemptAt: Date.now(),
    attempts: existingIdx >= 0 ? queue[existingIdx].attempts + 1 : 1,
    data: op.data !== undefined ? serializeForPendingQueue(op.data) : undefined,
    batchOps: op.batchOps
      ? op.batchOps.map((b) => ({
          ...b,
          data: b.data !== undefined ? serializeForPendingQueue(b.data) : undefined,
        }))
      : undefined,
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = serializedOp;
  } else {
    queue.push(serializedOp);
  }

  savePendingWrites(queue);
  return serializedOp;
}

function removePendingWriteById(id: string): void {
  const queue = getPendingWrites().filter((item) => item.id !== id);
  savePendingWrites(queue);
}

// ─────────────────────────────────────────────────────────────────────────────
// IDEMPOTENCY KEY REGISTRY (PREVENTS DUPLICATE COMMITS ACROSS RETRIES/REPLAYS)
// ─────────────────────────────────────────────────────────────────────────────

let inMemoryCommittedKeys: string[] = [];

function getCommittedIdempotencyKeys(): string[] {
  if (typeof localStorage === "undefined") return inMemoryCommittedKeys;
  try {
    const raw = localStorage.getItem(COMMITTED_IDEMPOTENCY_KEY);
    if (!raw) return inMemoryCommittedKeys;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      inMemoryCommittedKeys = parsed;
      return parsed;
    }
  } catch {}
  return inMemoryCommittedKeys;
}

export function isIdempotencyKeyCommitted(key?: string): boolean {
  if (!key) return false;
  return getCommittedIdempotencyKeys().includes(key);
}

export function markIdempotencyKeyCommitted(key?: string): void {
  if (!key) return;
  const keys = getCommittedIdempotencyKeys();
  if (keys.includes(key)) return;
  const next = [...keys, key];
  const capped = next.length > MAX_COMMITTED_KEYS_CACHE
    ? next.slice(next.length - MAX_COMMITTED_KEYS_CACHE)
    : next;
  inMemoryCommittedKeys = capped;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(COMMITTED_IDEMPOTENCY_KEY, JSON.stringify(capped));
    } catch {}
  }
}

export function clearCommittedIdempotencyKeys(): void {
  inMemoryCommittedKeys = [];
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(COMMITTED_IDEMPOTENCY_KEY);
    } catch {}
  }
}

function buildOperationIdempotencyKey(
  opType: string,
  path: string,
  explicitKey?: string
): string {
  if (explicitKey) return explicitKey;
  return `idem_${opType}_${path}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Initial Empty Summary Factory
function createEmptySummary(dateStr: string): QuotaDailySummary {
  const pendingCount = getPendingWrites().length;
  return {
    date: dateStr,
    reads: 0,
    writes: 0,
    deletes: 0,
    attemptedWrites: 0,
    successfulWrites: 0,
    confirmedDeletes: 0,
    pendingWrites: pendingCount,
    estimatedTransactionOps: 0,
    failedReads: 0,
    failedWrites: 0,
    qaFailedCount: 0,
    byCategory: {
      Admin: { reads: 0, writes: 0, deletes: 0 },
      Student: { reads: 0, writes: 0, deletes: 0 },
      QA: { reads: 0, writes: 0, deletes: 0 },
      Health: { reads: 0, writes: 0, deletes: 0 },
      Background: { reads: 0, writes: 0, deletes: 0 },
    },
    byCollection: {},
    topActions: {},
    logs: [],
    cloudSyncEnabled: false,
    lastCloudSyncAt: 0,
    lastUpdatedAt: Date.now(),
  };
}

// Storage Helpers
export function getQuotaSummary(dateStr?: string): QuotaDailySummary {
  const dateKey = dateStr || getCurrentQuotaDate();
  const storageKey = STORAGE_KEY_PREFIX + dateKey;
  const pendingCount = getPendingWrites().length;

  if (typeof localStorage === "undefined") {
    return createEmptySummary(dateKey);
  }

  try {
    const raw = localStorage.getItem(storageKey);
    let summary: QuotaDailySummary;
    if (raw) {
      summary = JSON.parse(raw);
      summary.reads = typeof summary.reads === "number" && !isNaN(summary.reads) ? summary.reads : 0;
      summary.writes = typeof summary.writes === "number" && !isNaN(summary.writes) ? summary.writes : 0;
      summary.deletes = typeof summary.deletes === "number" && !isNaN(summary.deletes) ? summary.deletes : 0;
      summary.failedReads = typeof summary.failedReads === "number" && !isNaN(summary.failedReads) ? summary.failedReads : 0;
      summary.failedWrites = typeof summary.failedWrites === "number" && !isNaN(summary.failedWrites) ? summary.failedWrites : 0;
      summary.confirmedDeletes = typeof summary.confirmedDeletes === "number" && !isNaN(summary.confirmedDeletes) ? summary.confirmedDeletes : summary.deletes;
      summary.successfulWrites = typeof summary.successfulWrites === "number" && !isNaN(summary.successfulWrites) ? summary.successfulWrites : Math.max(0, summary.writes - summary.deletes);
      summary.attemptedWrites = typeof summary.attemptedWrites === "number" && !isNaN(summary.attemptedWrites) ? summary.attemptedWrites : (summary.writes + summary.failedWrites);
      summary.estimatedTransactionOps = typeof summary.estimatedTransactionOps === "number" && !isNaN(summary.estimatedTransactionOps) ? summary.estimatedTransactionOps : 0;
      summary.pendingWrites = pendingCount;

      if (!summary.byCategory) {
        summary.byCategory = {
          Admin: { reads: 0, writes: 0, deletes: 0 },
          Student: { reads: 0, writes: 0, deletes: 0 },
          QA: { reads: 0, writes: 0, deletes: 0 },
          Health: { reads: 0, writes: 0, deletes: 0 },
          Background: { reads: 0, writes: 0, deletes: 0 },
        };
      }
      if (!Array.isArray(summary.logs)) {
        summary.logs = [];
      }
      if (summary.qaFailedCount === undefined) {
        summary.qaFailedCount = summary.logs ? summary.logs.filter((l) => l.failed && l.category === "QA").length : 0;
      }
    } else {
      summary = createEmptySummary(dateKey);
    }

    const settingsRaw = localStorage.getItem(SETTINGS_KEY);
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      summary.cloudSyncEnabled = settings.cloudSyncEnabled ?? false;
      summary.consoleNumberReads = settings.consoleNumberReads;
      summary.consoleNumberWrites = settings.consoleNumberWrites;
    }

    return summary;
  } catch {
    return createEmptySummary(dateKey);
  }
}

export function clearFailedQuotaLogs() {
  const dateKey = getCurrentQuotaDate();
  const summary = getQuotaSummary(dateKey);
  summary.logs = summary.logs.filter((log) => !log.failed);
  summary.failedReads = 0;
  summary.failedWrites = 0;
  summary.qaFailedCount = 0;
  saveQuotaSummary(summary);
}

export function saveQuotaSummary(summary: QuotaDailySummary): void {
  if (typeof localStorage === "undefined") return;
  try {
    const storageKey = STORAGE_KEY_PREFIX + summary.date;
    summary.lastUpdatedAt = Date.now();
    summary.pendingWrites = getPendingWrites().length;
    localStorage.setItem(storageKey, JSON.stringify(summary));

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        cloudSyncEnabled: summary.cloudSyncEnabled,
        consoleNumberReads: summary.consoleNumberReads,
        consoleNumberWrites: summary.consoleNumberWrites,
      })
    );

    notifyListeners(summary);
  } catch (err) {
    console.warn("Error saving quota summary:", err);
  }
}

export function resetQuotaSummary(dateStr?: string): void {
  const targetDate = dateStr || getCurrentQuotaDate();
  const empty = createEmptySummary(targetDate);
  saveQuotaSummary(empty);
}

// Record Usage (accurate separation of Attempted vs Successful vs Failed vs Pending vs Deletes vs Transaction Ops)
export function recordUsage(params: {
  category: QuotaCategory;
  actionName: string;
  collectionName?: string;
  reads?: number;
  writes?: number;
  deletes?: number;
  attemptedWrites?: number;
  estimatedTransactionOps?: number;
  failed?: boolean;
  skipAttemptCount?: boolean;
  errorCode?: string;
  errorMessage?: string;
  path?: string;
  operation?: "read" | "write" | "delete" | "transaction";
  screen?: string;
  idempotencyKey?: string;
}): void {
  const dateKey = getCurrentQuotaDate();
  const summary = getQuotaSummary(dateKey);

  const reads = params.reads || 0;
  const writes = params.writes || 0;
  const deletes = params.deletes || 0;
  const opUnits = params.attemptedWrites !== undefined
    ? params.attemptedWrites
    : Math.max(writes, deletes);
  const coll = params.collectionName || "general";
  const cat = params.category || "Background";
  const op: "read" | "write" | "delete" | "transaction" =
    params.operation ||
    (deletes > 0 && (!writes || writes === deletes)
      ? "delete"
      : writes > 0
      ? "write"
      : "read");
  const screen = params.screen || params.actionName;

  if (!params.skipAttemptCount && opUnits > 0 && op !== "read") {
    summary.attemptedWrites = (summary.attemptedWrites || 0) + opUnits;
  }

  if (params.estimatedTransactionOps && params.estimatedTransactionOps > 0) {
    summary.estimatedTransactionOps = (summary.estimatedTransactionOps || 0) + params.estimatedTransactionOps;
  }

  if (params.failed) {
    if (cat === "QA") {
      summary.qaFailedCount = (summary.qaFailedCount || 0) + 1;
    }
    if (reads > 0) summary.failedReads += reads;
    if (opUnits > 0) summary.failedWrites += opUnits;
  } else {
    summary.reads += reads;
    summary.writes += writes;
    summary.deletes += deletes;
    summary.confirmedDeletes = (summary.confirmedDeletes || 0) + deletes;
    summary.successfulWrites = (summary.successfulWrites || 0) + Math.max(0, writes - deletes);

    if (!summary.byCategory[cat]) {
      summary.byCategory[cat] = { reads: 0, writes: 0, deletes: 0 };
    }
    summary.byCategory[cat].reads += reads;
    summary.byCategory[cat].writes += writes;
    summary.byCategory[cat].deletes += deletes;

    if (!summary.byCollection[coll]) {
      summary.byCollection[coll] = { reads: 0, writes: 0, deletes: 0 };
    }
    summary.byCollection[coll].reads += reads;
    summary.byCollection[coll].writes += writes;
    summary.byCollection[coll].deletes += deletes;
  }

  // Top Actions (track both successful and failed attempts)
  const actionKey = `${cat}:${params.actionName}`;
  if (!summary.topActions[actionKey]) {
    summary.topActions[actionKey] = {
      actionName: params.actionName,
      category: cat,
      reads: 0,
      writes: 0,
      deletes: 0,
      count: 0,
      failedCount: 0,
    };
  }
  if (!params.failed) {
    summary.topActions[actionKey].reads += reads;
    summary.topActions[actionKey].writes += writes;
    summary.topActions[actionKey].deletes += deletes;
    summary.topActions[actionKey].count += 1;
  } else {
    summary.topActions[actionKey].failedCount = (summary.topActions[actionKey].failedCount || 0) + 1;
  }

  let userId: string | undefined = auth.currentUser?.uid || undefined;
  let userEmail: string | undefined = auth.currentUser?.email || undefined;

  if (!userId || !userEmail) {
    try {
      const p = loadUserProfile();
      if (p) {
        if (!auth.currentUser) {
          userId = userId || p.id || undefined;
          userEmail = userEmail || p.email || undefined;
        } else if (auth.currentUser.isAnonymous) {
          userEmail = `(Guest) ${p.email || "No Email"}`;
        }
      }
    } catch {}
  }

  const newLog: QuotaActionLog = {
    id: "log_" + Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    actionName: params.actionName,
    category: cat,
    collectionName: coll,
    operation: op,
    screen,
    reads,
    writes: params.failed ? 0 : writes,
    deletes: params.failed ? 0 : deletes,
    failed: !!params.failed,
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    path: params.path,
    userId,
    userEmail,
    idempotencyKey: params.idempotencyKey,
  };
  summary.logs.unshift(newLog);
  summary.logs = summary.logs.slice(0, 300);

  saveQuotaSummary(summary);
  checkAutoCloudSync(summary);
}

// Admin-Only, 60-min Cloud Usage Sync (MUST respect circuit breaker and track write usage honestly)
let isCloudSyncing = false;
async function checkAutoCloudSync(summary: QuotaDailySummary) {
  if (customDriverActive) return;
  if (isCloudSyncing || !summary.cloudSyncEnabled) return;
  if (isQuotaExhausted()) return;

  const currentProfile = loadUserProfile();
  if (!isUserAdmin(currentProfile)) {
    return;
  }

  const now = Date.now();
  if (now - (summary.lastCloudSyncAt || 0) < 3600000) return;

  if (
    summary.lastUploadedReads === summary.reads &&
    summary.lastUploadedWrites === summary.writes &&
    summary.lastUploadedDeletes === summary.deletes
  ) {
    return;
  }

  try {
    isCloudSyncing = true;
    const deviceId = getDeviceId();
    const docRef = firestoreDriver.doc(db, "usage_daily", summary.date, "devices", deviceId);
    const payload = {
      deviceId,
      date: summary.date,
      reads: summary.reads,
      writes: summary.writes,
      deletes: summary.deletes,
      lastUpdatedAt: now,
    };

    await withTimeout(firestoreDriver.setDoc(docRef, payload, { merge: true }), 15000, "Cloud Usage Sync");

    const updated = getQuotaSummary(summary.date);
    updated.lastCloudSyncAt = now;
    updated.lastUploadedReads = summary.reads;
    updated.lastUploadedWrites = summary.writes;
    updated.lastUploadedDeletes = summary.deletes;
    saveQuotaSummary(updated);

    recordUsage({
      category: "Background",
      actionName: "Cloud Usage Sync",
      collectionName: "usage_daily",
      writes: 1,
      path: docRef?.path || `usage_daily/${summary.date}/devices/${deviceId}`,
      operation: "write",
    });
  } catch (err: any) {
    const info = classifyFirestoreError(err);
    if (info.isQuotaError) {
      setQuotaExhausted(true);
    }
    recordUsage({
      category: "Background",
      actionName: "Cloud Usage Sync",
      collectionName: "usage_daily",
      writes: 1,
      failed: true,
      errorCode: info.code,
      errorMessage: info.message,
      operation: "write",
    });
    console.warn("Cloud usage sync failed:", err);
  } finally {
    isCloudSyncing = false;
  }
}

export function setCloudSyncEnabled(enabled: boolean): void {
  const currentProfile = loadUserProfile();
  if (enabled && !isUserAdmin(currentProfile)) {
    console.warn("[QuotaTracker] Cloud Sync can only be enabled by an Administrator.");
    return;
  }
  const summary = getQuotaSummary();
  summary.cloudSyncEnabled = enabled;
  saveQuotaSummary(summary);
  if (enabled) {
    checkAutoCloudSync(summary);
  }
}

export function setConsoleNumbers(reads?: number, writes?: number): void {
  const summary = getQuotaSummary();
  summary.consoleNumberReads = reads;
  summary.consoleNumberWrites = writes;
  saveQuotaSummary(summary);
}

// Export Log as CSV
export function exportUsageLogCSV(): string {
  const summary = getQuotaSummary();
  const headers = ["ID", "Timestamp", "ISO Time", "Category", "Action", "Collection", "Path", "Reads", "Writes", "Deletes", "Failed", "ErrorCode", "ErrorMessage"];
  const rows = summary.logs.map((l) => [
    l.id,
    l.timestamp,
    new Date(l.timestamp).toISOString(),
    l.category,
    `"${(l.actionName || "").replace(/"/g, '""')}"`,
    l.collectionName,
    `"${(l.path || "").replace(/"/g, '""')}"`,
    l.reads,
    l.writes,
    l.deletes,
    l.failed ? "YES" : "NO",
    l.errorCode || "",
    `"${(l.errorMessage || "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

// Collection Name & Path Extractor Helpers
function extractCollectionName(refOrQuery: any): string {
  try {
    if (!refOrQuery) return "general";
    if (refOrQuery.path) {
      const parts = refOrQuery.path.split("/");
      return parts[0] || "general";
    }
    if (refOrQuery._query && refOrQuery._query.path) {
      const parts = refOrQuery._query.path.segments || [];
      return parts[0] || "general";
    }
  } catch {}
  return "general";
}

function extractPath(refOrQuery: any): string {
  try {
    if (!refOrQuery) return "";
    if (refOrQuery.path) return refOrQuery.path;
    if (refOrQuery._query && refOrQuery._query.path && refOrQuery._query.path.segments) {
      return refOrQuery._query.path.segments.join("/");
    }
  } catch {}
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTA CIRCUIT BREAKER STATE (NO ADMIN OR METADATA BYPASSES)
// ─────────────────────────────────────────────────────────────────────────────

let quotaExhausted = false;
let quotaExhaustedDate: string | null = null;

function createQuotaBlockedError(actionName: string, queued = false): Error {
  const err: any = new Error(
    queued
      ? `[Quota Circuit Breaker] '${actionName}' blocked: daily Firestore write quota exhausted. Operation saved in pending recovery queue.`
      : `[Quota Circuit Breaker] '${actionName}' blocked: daily Firestore write quota exhausted.`
  );
  err.code = "resource-exhausted";
  err.isQuotaBlocked = true;
  err.queued = queued;
  return err;
}

export function classifyFirestoreError(error: any): {
  isQuotaError: boolean;
  isTimeout: boolean;
  isPermanent: boolean;
  isRetryable: boolean;
  code: string;
  message: string;
} {
  const code = String(error?.code || "");
  const message = error instanceof Error ? error.message : String(error || "");
  const isQuotaError =
    code === "resource-exhausted" ||
    Boolean(error?.isQuotaBlocked) ||
    message.includes("Quota limit exceeded") ||
    message.includes("resource-exhausted");
  const isTimeout = code === "deadline-exceeded" || message.startsWith("Timeout:");
  const isPermanent =
    !isQuotaError &&
    !isTimeout &&
    (code === "permission-denied" ||
      code === "invalid-argument" ||
      code === "failed-precondition" ||
      code === "not-found" ||
      code === "already-exists" ||
      code === "unauthenticated" ||
      code === "out-of-range" ||
      code === "data-loss" ||
      message.includes("PERMANENT") ||
      message.includes("permissions") ||
      message.includes("too large") ||
      message.includes("exceeds the maximum allowed size") ||
      message.includes("Batch operation limit exceeded"));
  const isRetryable = !isQuotaError && !isTimeout && !isPermanent;
  return {
    isQuotaError,
    isTimeout,
    isPermanent,
    isRetryable,
    code: code || (isTimeout ? "deadline-exceeded" : isQuotaError ? "resource-exhausted" : "unknown"),
    message,
  };
}

export function isQuotaExhausted(): boolean {
  const today = getCurrentQuotaDate();

  // 1. Check latched in-memory state first, respecting Pacific midnight rollover
  if (quotaExhausted) {
    if (quotaExhaustedDate && quotaExhaustedDate !== today) {
      // Pacific midnight rolled over while session remained open -> reset latch cleanly
      setQuotaExhausted(false);
    } else {
      return true;
    }
  }

  try {
    if (typeof localStorage !== "undefined") {
      const val = localStorage.getItem(QUOTA_EXHAUSTED_KEY);
      const dateVal = localStorage.getItem(QUOTA_EXHAUSTED_DATE_KEY);

      if (val === "true") {
        if (!dateVal || dateVal === today) {
          // Stay latched across page reloads for the same Pacific quota period
          quotaExhausted = true;
          quotaExhaustedDate = today;
          if (!dateVal) {
            localStorage.setItem(QUOTA_EXHAUSTED_DATE_KEY, today);
          }
          return true;
        } else {
          // Rolled into a new Pacific day -> clear stale flag cleanly
          localStorage.removeItem(QUOTA_EXHAUSTED_KEY);
          localStorage.removeItem(QUOTA_EXHAUSTED_DATE_KEY);
          firestoreDriver.enableNetwork(db).catch(() => {});
        }
      } else if (dateVal && dateVal !== today) {
        localStorage.removeItem(QUOTA_EXHAUSTED_DATE_KEY);
      }

      // Proactive threshold protection: latch persistently before hitting 20,000 hard failure
      const summary = getQuotaSummary(today);
      if (
        summary.writes >= PROACTIVE_WRITE_BREAKER_THRESHOLD ||
        summary.deletes >= PROACTIVE_WRITE_BREAKER_THRESHOLD
      ) {
        setQuotaExhausted(true);
        return true;
      }
    }
  } catch {}
  return false;
}

export function setQuotaExhausted(exhausted: boolean): void {
  const today = getCurrentQuotaDate();
  const changed = quotaExhausted !== exhausted || (exhausted && quotaExhaustedDate !== today);

  quotaExhausted = exhausted;
  quotaExhaustedDate = exhausted ? today : null;

  try {
    if (typeof localStorage !== "undefined") {
      if (exhausted) {
        localStorage.setItem(QUOTA_EXHAUSTED_KEY, "true");
        localStorage.setItem(QUOTA_EXHAUSTED_DATE_KEY, today);
        firestoreDriver.disableNetwork(db).catch(() => {});
      } else {
        localStorage.removeItem(QUOTA_EXHAUSTED_KEY);
        localStorage.removeItem(QUOTA_EXHAUSTED_DATE_KEY);
        firestoreDriver.enableNetwork(db).catch(() => {});
      }
    }
  } catch {}

  if (changed) {
    notifyListeners(getQuotaSummary(today));
  }
}

if (typeof window !== "undefined" && isQuotaExhausted()) {
  firestoreDriver.disableNetwork(db).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMEOUT PROTECTION & GUARDED FIRESTORE SDK WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────

export function withTimeout<T>(
  promise: Promise<T>,
  ms = 30000,
  operationName = "Firestore operation"
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const err: any = new Error(`Timeout: ${operationName} took longer than ${ms / 1000}s.`);
      err.code = "deadline-exceeded";
      reject(err);
    }, ms);
  });

  return Promise.race([
    promise
      .then((res) => {
        clearTimeout(timer);
        return res;
      })
      .catch((err) => {
        clearTimeout(timer);
        throw err;
      }),
    timeoutPromise,
  ]);
}

export async function guardedGetDoc<T = any>(
  docRef: DocumentReference<T>,
  category: QuotaCategory = "Student",
  actionName = "Get Document",
  screen?: string,
  timeoutMs = 12000,
  bypassCache = false
): Promise<DocumentSnapshot<T>> {
  const collectionName = extractCollectionName(docRef);
  const path = docRef?.path || extractPath(docRef);
  const cacheKey = `doc:${path}`;

  if (isQuotaExhausted()) {
    const cached = firestoreCache.get(cacheKey);
    if (cached) return cached.data;
    timeoutMs = Math.min(timeoutMs, 5000);
  }

  if (!bypassCache) {
    const cached = firestoreCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      cacheHitsCount++;
      recordUsage({ category, actionName: `${actionName} (Cache Hit)`, collectionName, reads: 0, path, operation: "read", screen });
      return cached.data;
    }
  }

  if (guardedInFlightRequests.has(cacheKey)) {
    inFlightDeduplicationsCount++;
    return guardedInFlightRequests.get(cacheKey)!;
  }

  const execPromise = (async () => {
    let attempts = 0;
    const maxAttempts = 2;

    try {
      while (attempts < maxAttempts) {
        try {
          attempts++;
          const snap = await withTimeout(firestoreDriver.getDoc(docRef), timeoutMs, actionName);
          const reads = snap.metadata?.fromCache ? 0 : 1;
          recordUsage({ category, actionName, collectionName, reads, path, operation: "read", screen });

          firestoreCache.set(cacheKey, { data: snap, timestamp: Date.now() });
          return snap;
        } catch (error: any) {
          const info = classifyFirestoreError(error);
          const isUnavailable =
            error?.code === "unavailable" ||
            (error instanceof Error && (error.message.includes("the client is offline") || error.message.includes("unavailable")));

          if (info.isQuotaError) {
            setQuotaExhausted(true);
          }

          if (info.isTimeout && attempts < maxAttempts) {
            continue;
          }

          const cached = firestoreCache.get(cacheKey);
          if (cached) return cached.data;

          if (isUnavailable) {
            try {
              const { getDocFromCache } = await import("firebase/firestore");
              const cacheSnap = await getDocFromCache(docRef);
              if (cacheSnap) {
                firestoreCache.set(cacheKey, { data: cacheSnap, timestamp: Date.now() });
                return cacheSnap;
              }
            } catch {}
          }

          recordUsage({
            category,
            actionName,
            collectionName,
            reads: 1,
            failed: true,
            errorCode: error?.code || "read_error",
            errorMessage: error?.message || String(error),
            path,
            operation: "read",
            screen,
          });
          throw error;
        }
      }
      throw new Error(`${actionName} failed after ${maxAttempts} attempts`);
    } finally {
      guardedInFlightRequests.delete(cacheKey);
    }
  })();

  guardedInFlightRequests.set(cacheKey, execPromise);
  return execPromise;
}

export async function guardedGetDocs<T = any>(
  queryOrRef: Query<T> | CollectionReference<T>,
  category: QuotaCategory = "Student",
  actionName = "Get Documents",
  screen?: string,
  timeoutMs = 12000,
  bypassCache = false
): Promise<QuerySnapshot<T>> {
  const collectionName = extractCollectionName(queryOrRef);
  const path = extractPath(queryOrRef) || collectionName;
  const cacheKey = `query:${getCacheKey(queryOrRef)}`;

  if (isQuotaExhausted()) {
    const cached = firestoreCache.get(cacheKey);
    if (cached) return cached.data;
    timeoutMs = Math.min(timeoutMs, 5000);
  }

  if (!bypassCache) {
    const cached = firestoreCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      cacheHitsCount++;
      recordUsage({ category, actionName: `${actionName} (Cache Hit)`, collectionName, reads: 0, path, operation: "read", screen });
      return cached.data;
    }
  }

  if (guardedInFlightRequests.has(cacheKey)) {
    inFlightDeduplicationsCount++;
    return guardedInFlightRequests.get(cacheKey)!;
  }

  const execPromise = (async () => {
    let attempts = 0;
    const maxAttempts = 2;

    try {
      while (attempts < maxAttempts) {
        try {
          attempts++;
          const snap = await withTimeout(firestoreDriver.getDocs(queryOrRef), timeoutMs, actionName);
          const reads = snap.metadata?.fromCache ? 0 : Math.max(1, snap.size);
          recordUsage({ category, actionName, collectionName, reads, path, operation: "read", screen });

          firestoreCache.set(cacheKey, { data: snap, timestamp: Date.now() });
          return snap;
        } catch (error: any) {
          const info = classifyFirestoreError(error);
          const isUnavailable =
            error?.code === "unavailable" ||
            (error instanceof Error && (error.message.includes("the client is offline") || error.message.includes("unavailable")));

          if (info.isQuotaError) {
            setQuotaExhausted(true);
          }

          if (info.isTimeout && attempts < maxAttempts) {
            continue;
          }

          const cached = firestoreCache.get(cacheKey);
          if (cached) return cached.data;

          if (isUnavailable) {
            try {
              const { getDocsFromCache } = await import("firebase/firestore");
              const cacheSnap = await getDocsFromCache(queryOrRef);
              if (cacheSnap) {
                firestoreCache.set(cacheKey, { data: cacheSnap, timestamp: Date.now() });
                return cacheSnap;
              }
            } catch {}
          }

          recordUsage({
            category,
            actionName,
            collectionName,
            reads: 1,
            failed: true,
            errorCode: error?.code || "query_error",
            errorMessage: error?.message || String(error),
            path,
            operation: "read",
            screen,
          });
          throw error;
        }
      }
      throw new Error(`${actionName} failed after ${maxAttempts} attempts`);
    } finally {
      guardedInFlightRequests.delete(cacheKey);
    }
  })();

  guardedInFlightRequests.set(cacheKey, execPromise);
  return execPromise;
}

export function guardedOnSnapshot<T = any>(
  queryOrRef: Query<T> | CollectionReference<T> | DocumentReference<T>,
  category: QuotaCategory,
  actionName: string,
  onNext: (snapshot: any) => void,
  onError?: (error: any, unsubscribe: () => void) => void,
  screen?: string
): Unsubscribe {
  const collectionName = extractCollectionName(queryOrRef);
  const path = extractPath(queryOrRef) || collectionName;
  let isInitial = true;

  activeListenersCount++;

  const unsub = firestoreDriver.onSnapshot(
    queryOrRef as any,
    (snap: any) => {
      if (snap.metadata?.fromCache) {
        recordUsage({ category, actionName, collectionName, reads: 0, path, operation: "read", screen });
      } else if (isInitial) {
        const reads = snap.size !== undefined ? Math.max(1, snap.size) : 1;
        recordUsage({ category, actionName, collectionName, reads, path, operation: "read", screen });
        isInitial = false;
      } else {
        const changes = snap.docChanges ? snap.docChanges() : [];
        const reads = changes.length;
        if (reads > 0) {
          recordUsage({ category, actionName, collectionName, reads, path, operation: "read", screen });
        }
      }
      onNext(snap);
    },
    (error: any) => {
      const info = classifyFirestoreError(error);
      if (info.isQuotaError) {
        setQuotaExhausted(true);
      }

      if (error?.code === "unavailable" || String(error?.message).includes("Could not reach Cloud Firestore")) {
        console.warn(`[Firestore Offline Mode] ${actionName} listener operating in offline mode.`);
        return;
      }
      recordUsage({
        category,
        actionName,
        collectionName,
        reads: 1,
        failed: true,
        errorCode: error?.code || "snapshot_error",
        errorMessage: error?.message || String(error),
        path,
        operation: "read",
        screen,
      });
      if (onError) onError(error, () => {});
    }
  );

  return () => {
    activeListenersCount = Math.max(0, activeListenersCount - 1);
    unsub();
  };
}

function getLocalFallbackCount(collectionName: string): number {
  try {
    if (typeof localStorage !== "undefined") {
      if (collectionName === "subjects" || collectionName === "curriculum_subjects") {
        const raw = localStorage.getItem("economic_survey_user_questions_v2");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.customSubjects)) return parsed.customSubjects.length;
        }
        return 0;
      }
      if (collectionName === "pyq_papers" || collectionName === "pyqPapers") {
        const raw = localStorage.getItem("quizpro_local_pyq_papers_v1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.length;
        }
        return 0;
      }
      if (collectionName === "mcqs" || collectionName === "questions" || collectionName === "curriculum_questions") {
        const raw = localStorage.getItem("economic_survey_user_questions_v2");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.customQuestions)) return parsed.customQuestions.length;
        }
        return 0;
      }
    }
  } catch {}
  return 0;
}

export async function guardedGetCountFromServer(
  queryOrRef: Query<any> | CollectionReference<any>,
  category: QuotaCategory = "Student",
  actionName = "Count Query",
  screen?: string,
  timeoutMs = 6000
): Promise<any> {
  const collectionName = extractCollectionName(queryOrRef);
  const path = extractPath(queryOrRef) || collectionName;

  if (isQuotaExhausted()) {
    const fallbackCount = getLocalFallbackCount(collectionName);
    return { data: () => ({ count: fallbackCount }), fromFallback: true };
  }

  try {
    const snap = await withTimeout(firestoreDriver.getCountFromServer(queryOrRef), timeoutMs, actionName);
    const count = snap.data().count;
    const reads = Math.max(1, Math.ceil(count / 1000));
    recordUsage({ category, actionName, collectionName, reads, path, operation: "read", screen });
    return snap;
  } catch (error: any) {
    const info = classifyFirestoreError(error);
    if (info.isQuotaError) setQuotaExhausted(true);

    recordUsage({
      category,
      actionName,
      collectionName,
      reads: 0,
      failed: true,
      errorCode: error?.code || "count_error",
      errorMessage: error?.message || String(error),
      path,
      operation: "read",
      screen,
    });

    const fallbackCount = getLocalFallbackCount(collectionName);
    console.warn(`[QuotaTracker] ${actionName} failed or timed out: ${error?.message || error}. Using fallback count (${fallbackCount}).`);
    return { data: () => ({ count: fallbackCount }), fromFallback: true, error };
  }
}

export async function guardedSetDoc<T = any>(
  docRef: DocumentReference<T>,
  data: any,
  options?: SetOptions,
  category: QuotaCategory = "Student",
  actionName = "Set Document",
  screen?: string,
  timeoutMs = 30000,
  idempotencyKey?: string
): Promise<void> {
  const collectionName = extractCollectionName(docRef);
  const path = docRef?.path || extractPath(docRef);
  const safeData = sanitizeFirestorePayload(data);
  const opKey = buildOperationIdempotencyKey("set", path, idempotencyKey);

  // Deduplicate already committed idempotent writes
  if (idempotencyKey && isIdempotencyKeyCommitted(idempotencyKey)) {
    return;
  }

  // Strictly enforce circuit breaker for ALL categories & collections (including Admin & metadata)
  if (isQuotaExhausted()) {
    enqueuePendingWrite({
      idempotencyKey: opKey,
      type: "set",
      path,
      collectionName,
      category,
      actionName,
      screen,
      data: safeData,
      options,
      lastErrorCode: "resource-exhausted",
      lastErrorMessage: "Circuit breaker active — queued safely for recovery",
      opCount: 1,
      deleteCount: 0,
    });
    recordUsage({
      category,
      actionName: `${actionName} (Blocked & Queued)`,
      collectionName,
      writes: 1,
      failed: true,
      errorCode: "resource-exhausted",
      errorMessage: "Circuit breaker active — write preserved in pending queue",
      path,
      operation: "write",
      screen,
      idempotencyKey: opKey,
    });
    throw createQuotaBlockedError(actionName, true);
  }

  try {
    if (options) {
      await withTimeout(firestoreDriver.setDoc(docRef, safeData, options), timeoutMs, actionName);
    } else {
      await withTimeout(firestoreDriver.setDoc(docRef, safeData), timeoutMs, actionName);
    }
    markIdempotencyKeyCommitted(opKey);
    recordUsage({ category, actionName, collectionName, writes: 1, path, operation: "write", screen, idempotencyKey: opKey });
  } catch (error: any) {
    const info = classifyFirestoreError(error);
    if (info.isQuotaError) {
      setQuotaExhausted(true);
    }

    // Queue recoverable / ambiguous writes (never discard queued work; skip only clearly invalid/permission permanent errors)
    const shouldQueue = info.isQuotaError || info.isTimeout || info.isRetryable;
    if (shouldQueue) {
      enqueuePendingWrite({
        idempotencyKey: opKey,
        type: "set",
        path,
        collectionName,
        category,
        actionName,
        screen,
        data: safeData,
        options,
        lastErrorCode: info.code,
        lastErrorMessage: info.message,
        opCount: 1,
        deleteCount: 0,
      });
    }

    recordUsage({
      category,
      actionName: info.isTimeout ? `${actionName} (Timeout/Queued)` : actionName,
      collectionName,
      writes: 1,
      failed: true,
      errorCode: info.code,
      errorMessage: info.message,
      path,
      operation: "write",
      screen,
      idempotencyKey: opKey,
    });

    if (info.code === "permission-denied" || info.message.includes("permissions")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    throw error;
  }
}

export async function guardedUpdateDoc<T = any>(
  docRef: DocumentReference<T>,
  data: any,
  category: QuotaCategory = "Student",
  actionName = "Update Document",
  screen?: string,
  timeoutMs = 30000,
  idempotencyKey?: string
): Promise<void> {
  const collectionName = extractCollectionName(docRef);
  const path = docRef?.path || extractPath(docRef);
  const safeData = sanitizeFirestorePayload(data);
  const opKey = buildOperationIdempotencyKey("update", path, idempotencyKey);

  if (idempotencyKey && isIdempotencyKeyCommitted(idempotencyKey)) {
    return;
  }

  if (isQuotaExhausted()) {
    enqueuePendingWrite({
      idempotencyKey: opKey,
      type: "update",
      path,
      collectionName,
      category,
      actionName,
      screen,
      data: safeData,
      lastErrorCode: "resource-exhausted",
      lastErrorMessage: "Circuit breaker active — queued safely for recovery",
      opCount: 1,
      deleteCount: 0,
    });
    recordUsage({
      category,
      actionName: `${actionName} (Blocked & Queued)`,
      collectionName,
      writes: 1,
      failed: true,
      errorCode: "resource-exhausted",
      errorMessage: "Circuit breaker active — update preserved in pending queue",
      path,
      operation: "write",
      screen,
      idempotencyKey: opKey,
    });
    throw createQuotaBlockedError(actionName, true);
  }

  try {
    await withTimeout(firestoreDriver.updateDoc(docRef, safeData), timeoutMs, actionName);
    markIdempotencyKeyCommitted(opKey);
    recordUsage({ category, actionName, collectionName, writes: 1, path, operation: "write", screen, idempotencyKey: opKey });
  } catch (error: any) {
    const info = classifyFirestoreError(error);
    if (info.isQuotaError) {
      setQuotaExhausted(true);
    }

    const shouldQueue = info.isQuotaError || info.isTimeout || info.isRetryable;
    if (shouldQueue) {
      enqueuePendingWrite({
        idempotencyKey: opKey,
        type: "update",
        path,
        collectionName,
        category,
        actionName,
        screen,
        data: safeData,
        lastErrorCode: info.code,
        lastErrorMessage: info.message,
        opCount: 1,
        deleteCount: 0,
      });
    }

    recordUsage({
      category,
      actionName: info.isTimeout ? `${actionName} (Timeout/Queued)` : actionName,
      collectionName,
      writes: 1,
      failed: true,
      errorCode: info.code,
      errorMessage: info.message,
      path,
      operation: "write",
      screen,
      idempotencyKey: opKey,
    });

    if (info.code === "permission-denied" || info.message.includes("permissions")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    throw error;
  }
}

export async function guardedDeleteDoc<T = any>(
  docRef: DocumentReference<T>,
  category: QuotaCategory = "Student",
  actionName = "Delete Document",
  screen?: string,
  timeoutMs = 12000,
  idempotencyKey?: string
): Promise<void> {
  const collectionName = extractCollectionName(docRef);
  const path = docRef?.path || extractPath(docRef);
  const opKey = buildOperationIdempotencyKey("delete", path, idempotencyKey);

  if (idempotencyKey && isIdempotencyKeyCommitted(idempotencyKey)) {
    return;
  }

  if (isQuotaExhausted()) {
    enqueuePendingWrite({
      idempotencyKey: opKey,
      type: "delete",
      path,
      collectionName,
      category,
      actionName,
      screen,
      lastErrorCode: "resource-exhausted",
      lastErrorMessage: "Circuit breaker active — delete queued safely for recovery",
      opCount: 1,
      deleteCount: 1,
    });
    recordUsage({
      category,
      actionName: `${actionName} (Blocked & Queued)`,
      collectionName,
      writes: 1,
      deletes: 1,
      failed: true,
      errorCode: "resource-exhausted",
      errorMessage: "Circuit breaker active — delete preserved in pending queue",
      path,
      operation: "delete",
      screen,
      idempotencyKey: opKey,
    });
    throw createQuotaBlockedError(actionName, true);
  }

  try {
    await withTimeout(firestoreDriver.deleteDoc(docRef), timeoutMs, actionName);
    markIdempotencyKeyCommitted(opKey);
    recordUsage({ category, actionName, collectionName, writes: 1, deletes: 1, path, operation: "delete", screen, idempotencyKey: opKey });
  } catch (error: any) {
    const info = classifyFirestoreError(error);
    if (info.isQuotaError) {
      setQuotaExhausted(true);
    }

    const shouldQueue = info.isQuotaError || info.isTimeout || info.isRetryable;
    if (shouldQueue) {
      enqueuePendingWrite({
        idempotencyKey: opKey,
        type: "delete",
        path,
        collectionName,
        category,
        actionName,
        screen,
        lastErrorCode: info.code,
        lastErrorMessage: info.message,
        opCount: 1,
        deleteCount: 1,
      });
    }

    recordUsage({
      category,
      actionName: info.isTimeout ? `${actionName} (Timeout/Queued)` : actionName,
      collectionName,
      writes: 1,
      deletes: 1,
      failed: true,
      errorCode: info.code,
      errorMessage: info.message,
      path,
      operation: "delete",
      screen,
      idempotencyKey: opKey,
    });

    if (info.code === "permission-denied" || info.message.includes("permissions")) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    throw error;
  }
}

/**
 * Guarded addDoc: pre-generates a deterministic DocumentReference ID once so
 * queued/retried executions are idempotent and can never create duplicate docs.
 */
export async function guardedAddDoc<T = any>(
  collectionRef: CollectionReference<T>,
  data: any,
  category: QuotaCategory = "Student",
  actionName = "Add Document",
  screen?: string,
  timeoutMs = 30000,
  idempotencyKey?: string
): Promise<DocumentReference<T>> {
  const newDocRef = firestoreDriver.doc(collectionRef);
  const path = newDocRef?.path || `${extractPath(collectionRef)}/generated`;
  const opKey = idempotencyKey || `idem_add_${path}`;
  await guardedSetDoc(newDocRef, data, undefined, category, actionName, screen, timeoutMs, opKey);
  return newDocRef;
}

export interface GuardedWriteBatch {
  set: (docRef: DocumentReference<any>, data: any, options?: SetOptions) => GuardedWriteBatch;
  update: (docRef: DocumentReference<any>, data: any) => GuardedWriteBatch;
  delete: (docRef: DocumentReference<any>) => GuardedWriteBatch;
  commit: (
    category?: QuotaCategory,
    actionName?: string,
    screen?: string,
    timeoutMs?: number,
    idempotencyKey?: string
  ) => Promise<void>;
}

export function guardedWriteBatch(firestore: Firestore = db): GuardedWriteBatch {
  const batch: WriteBatch = firestoreDriver.writeBatch(firestore);
  const ops: Array<{ op: "set" | "update" | "delete"; path: string; data?: any; options?: SetOptions }> = [];
  let opCount = 0;
  let delCount = 0;
  let primaryColl = "general";
  let samplePath = "";

  const assertBatchLimit = () => {
    if (opCount >= MAX_FIRESTORE_BATCH_OPS) {
      const err: any = new Error(
        `Batch operation limit exceeded: Firestore allows at most ${MAX_FIRESTORE_BATCH_OPS} operations per WriteBatch.`
      );
      err.code = "invalid-argument";
      throw err;
    }
  };

  return {
    set(docRef, data, options) {
      assertBatchLimit();
      primaryColl = extractCollectionName(docRef);
      samplePath = docRef?.path || "";
      opCount++;
      const safeData = sanitizeFirestorePayload(data);
      ops.push({ op: "set", path: samplePath, data: safeData, options });
      if (options) {
        batch.set(docRef, safeData, options);
      } else {
        batch.set(docRef, safeData);
      }
      return this;
    },
    update(docRef, data) {
      assertBatchLimit();
      primaryColl = extractCollectionName(docRef);
      samplePath = docRef?.path || "";
      opCount++;
      const safeData = sanitizeFirestorePayload(data);
      ops.push({ op: "update", path: samplePath, data: safeData });
      batch.update(docRef, safeData);
      return this;
    },
    delete(docRef) {
      assertBatchLimit();
      primaryColl = extractCollectionName(docRef);
      samplePath = docRef?.path || "";
      opCount++;
      delCount++;
      ops.push({ op: "delete", path: samplePath });
      batch.delete(docRef);
      return this;
    },
    async commit(
      category: QuotaCategory = "Student",
      actionName = "Batch Commit",
      screen?: string,
      timeoutMs = 30000,
      idempotencyKey?: string
    ) {
      if (opCount === 0) return;

      const opType = delCount > 0 && delCount === opCount ? "delete" : "write";
      const opKey = buildOperationIdempotencyKey("batch", samplePath || primaryColl, idempotencyKey);

      if (idempotencyKey && isIdempotencyKeyCommitted(idempotencyKey)) {
        return;
      }

      if (opCount > MAX_FIRESTORE_BATCH_OPS) {
        const err: any = new Error(
          `Batch operation limit exceeded: attempted ${opCount} ops (max ${MAX_FIRESTORE_BATCH_OPS}).`
        );
        err.code = "invalid-argument";
        throw err;
      }

      if (isQuotaExhausted()) {
        enqueuePendingWrite({
          idempotencyKey: opKey,
          type: "batch",
          path: samplePath || primaryColl,
          collectionName: primaryColl,
          category,
          actionName,
          screen,
          batchOps: ops,
          lastErrorCode: "resource-exhausted",
          lastErrorMessage: "Circuit breaker active — batch queued safely for recovery",
          opCount,
          deleteCount: delCount,
        });
        recordUsage({
          category,
          actionName: `${actionName} (Blocked & Queued)`,
          collectionName: primaryColl,
          writes: opCount,
          deletes: delCount,
          path: samplePath || primaryColl,
          operation: opType,
          screen,
          failed: true,
          errorCode: "resource-exhausted",
          errorMessage: "Daily write quota limit reached — batch preserved in pending queue",
          idempotencyKey: opKey,
        });
        throw createQuotaBlockedError(actionName, true);
      }

      // Execute batch commit ONCE — NEVER blindly retry ambiguous timeouts or resource-exhausted errors
      try {
        await withTimeout(batch.commit(), timeoutMs, actionName);
        markIdempotencyKeyCommitted(opKey);
        recordUsage({
          category,
          actionName,
          collectionName: primaryColl,
          writes: opCount,
          deletes: delCount,
          path: samplePath || primaryColl,
          operation: opType,
          screen,
          idempotencyKey: opKey,
        });
      } catch (error: any) {
        const info = classifyFirestoreError(error);
        if (info.isQuotaError) {
          setQuotaExhausted(true);
        }

        const shouldQueue = info.isQuotaError || info.isTimeout || info.isRetryable;
        if (shouldQueue) {
          enqueuePendingWrite({
            idempotencyKey: opKey,
            type: "batch",
            path: samplePath || primaryColl,
            collectionName: primaryColl,
            category,
            actionName,
            screen,
            batchOps: ops,
            lastErrorCode: info.code,
            lastErrorMessage: info.message,
            opCount,
            deleteCount: delCount,
          });
        }

        recordUsage({
          category,
          actionName: info.isTimeout ? `${actionName} (Timeout/Queued)` : actionName,
          collectionName: primaryColl,
          writes: opCount,
          deletes: delCount,
          path: samplePath || primaryColl,
          operation: opType,
          screen,
          failed: true,
          errorCode: info.code,
          errorMessage: info.message,
          idempotencyKey: opKey,
        });

        if (info.code === "permission-denied" || info.message.includes("permissions")) {
          handleFirestoreError(error, OperationType.WRITE, samplePath || primaryColl);
        }
        throw error;
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARDED TRANSACTION WRAPPER (PRESERVES FIRESTORE CONTENTION SEMANTICS)
// ─────────────────────────────────────────────────────────────────────────────

export interface GuardedTransaction {
  get: <T = any>(docRef: DocumentReference<T>) => Promise<DocumentSnapshot<T>>;
  set: <T = any>(docRef: DocumentReference<T>, data: any, options?: SetOptions) => GuardedTransaction;
  update: <T = any>(docRef: DocumentReference<T>, data: any) => GuardedTransaction;
  delete: (docRef: DocumentReference<any>) => GuardedTransaction;
}

export async function guardedRunTransaction<T = any>(
  firestore: Firestore = db,
  updateFunction: (transaction: GuardedTransaction) => Promise<T>,
  category: QuotaCategory = "Student",
  actionName = "Transaction",
  screen?: string,
  timeoutMs = 30000
): Promise<T> {
  if (isQuotaExhausted()) {
    recordUsage({
      category,
      actionName: `${actionName} (Blocked)`,
      collectionName: "transaction",
      writes: 1,
      estimatedTransactionOps: 0,
      failed: true,
      errorCode: "resource-exhausted",
      errorMessage: "Circuit breaker active — transaction blocked before execution",
      operation: "transaction",
      screen,
    });
    throw createQuotaBlockedError(actionName, false);
  }

  let totalAttemptReads = 0;
  let totalAttemptWrites = 0;
  let finalAttemptReads = 0;
  let finalAttemptWrites = 0;
  let finalAttemptDeletes = 0;
  let primaryColl = "general";
  let primaryPath = "";

  try {
    const result = await withTimeout(
      firestoreDriver.runTransaction(firestore, async (tx: Transaction) => {
        if (isQuotaExhausted()) {
          throw createQuotaBlockedError(actionName, false);
        }

        // Reset per-attempt counters for each Firestore contention attempt so final commit reflects exact writes
        finalAttemptReads = 0;
        finalAttemptWrites = 0;
        finalAttemptDeletes = 0;

        const wrappedTx: GuardedTransaction = {
          async get<U = any>(docRef: DocumentReference<U>): Promise<DocumentSnapshot<U>> {
            primaryColl = primaryColl === "general" ? extractCollectionName(docRef) : primaryColl;
            primaryPath = primaryPath || docRef?.path || "";
            finalAttemptReads++;
            totalAttemptReads++;
            return tx.get(docRef);
          },
          set<U = any>(docRef: DocumentReference<U>, data: any, options?: SetOptions): GuardedTransaction {
            primaryColl = extractCollectionName(docRef);
            primaryPath = docRef?.path || primaryPath;
            finalAttemptWrites++;
            totalAttemptWrites++;
            const safeData = sanitizeFirestorePayload(data);
            if (options) {
              tx.set(docRef, safeData, options);
            } else {
              tx.set(docRef, safeData);
            }
            return wrappedTx;
          },
          update<U = any>(docRef: DocumentReference<U>, data: any): GuardedTransaction {
            primaryColl = extractCollectionName(docRef);
            primaryPath = docRef?.path || primaryPath;
            finalAttemptWrites++;
            totalAttemptWrites++;
            const safeData = sanitizeFirestorePayload(data);
            tx.update(docRef, safeData);
            return wrappedTx;
          },
          delete(docRef: DocumentReference<any>): GuardedTransaction {
            primaryColl = extractCollectionName(docRef);
            primaryPath = docRef?.path || primaryPath;
            finalAttemptWrites++;
            finalAttemptDeletes++;
            totalAttemptWrites++;
            tx.delete(docRef);
            return wrappedTx;
          },
        };

        return updateFunction(wrappedTx);
      }),
      timeoutMs,
      actionName
    );

    // Transaction committed atomically: record final reads/writes ONCE plus estimated total ops across contention retries
    recordUsage({
      category,
      actionName,
      collectionName: primaryColl,
      reads: finalAttemptReads,
      writes: finalAttemptWrites,
      deletes: finalAttemptDeletes,
      estimatedTransactionOps: totalAttemptReads + totalAttemptWrites,
      path: primaryPath || primaryColl,
      operation: "transaction",
      screen,
    });

    return result;
  } catch (error: any) {
    const info = classifyFirestoreError(error);
    if (info.isQuotaError) {
      setQuotaExhausted(true);
    }

    const failedWriteUnits = Math.max(1, finalAttemptWrites);
    recordUsage({
      category,
      actionName,
      collectionName: primaryColl,
      reads: finalAttemptReads,
      writes: failedWriteUnits,
      deletes: finalAttemptDeletes,
      estimatedTransactionOps: totalAttemptReads + totalAttemptWrites,
      failed: true,
      errorCode: info.code,
      errorMessage: info.message,
      path: primaryPath || primaryColl,
      operation: "transaction",
      screen,
    });

    if (info.code === "permission-denied" || info.message.includes("permissions")) {
      handleFirestoreError(error, OperationType.WRITE, primaryPath || primaryColl);
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PENDING QUEUE RECOVERY FLUSH (SAFE, IDEMPOTENT, QUOTA-GATED)
// ─────────────────────────────────────────────────────────────────────────────

function docRefFromPath(firestore: Firestore, fullPath: string): DocumentReference<any> {
  const segments = fullPath.split("/").filter(Boolean);
  return (firestoreDriver.doc as any)(firestore, ...segments);
}

export interface FlushPendingWritesResult {
  flushed: number;
  remaining: number;
  skippedAlreadyCommitted: number;
  abortedByQuota: boolean;
  failedPermanent: number;
}

export async function flushPendingWrites(firestore: Firestore = db): Promise<FlushPendingWritesResult> {
  const queue = getPendingWrites();
  if (queue.length === 0) {
    return { flushed: 0, remaining: 0, skippedAlreadyCommitted: 0, abortedByQuota: false, failedPermanent: 0 };
  }

  if (isQuotaExhausted()) {
    return {
      flushed: 0,
      remaining: queue.length,
      skippedAlreadyCommitted: 0,
      abortedByQuota: true,
      failedPermanent: 0,
    };
  }

  let flushed = 0;
  let skippedAlreadyCommitted = 0;
  let failedPermanent = 0;
  let abortedByQuota = false;

  for (const item of queue) {
    if (isQuotaExhausted()) {
      abortedByQuota = true;
      break;
    }

    if (isIdempotencyKeyCommitted(item.idempotencyKey)) {
      removePendingWriteById(item.id);
      skippedAlreadyCommitted++;
      continue;
    }

    try {
      if (item.type === "set") {
        const ref = docRefFromPath(firestore, item.path);
        const payload = deserializeFromPendingQueue(item.data);
        await guardedSetDoc(ref, payload, item.options, item.category, `${item.actionName} (Recovery)`, item.screen, 30000, item.idempotencyKey);
      } else if (item.type === "update") {
        const ref = docRefFromPath(firestore, item.path);
        const payload = deserializeFromPendingQueue(item.data);
        await guardedUpdateDoc(ref, payload, item.category, `${item.actionName} (Recovery)`, item.screen, 30000, item.idempotencyKey);
      } else if (item.type === "delete") {
        const ref = docRefFromPath(firestore, item.path);
        await guardedDeleteDoc(ref, item.category, `${item.actionName} (Recovery)`, item.screen, 15000, item.idempotencyKey);
      } else if (item.type === "batch" && Array.isArray(item.batchOps)) {
        const batch = guardedWriteBatch(firestore);
        for (const sub of item.batchOps) {
          const ref = docRefFromPath(firestore, sub.path);
          if (sub.op === "delete") {
            batch.delete(ref);
          } else if (sub.op === "update") {
            batch.update(ref, deserializeFromPendingQueue(sub.data));
          } else {
            batch.set(ref, deserializeFromPendingQueue(sub.data), sub.options);
          }
        }
        await batch.commit(item.category, `${item.actionName} (Recovery)`, item.screen, 30000, item.idempotencyKey);
      }

      removePendingWriteById(item.id);
      flushed++;
    } catch (err: any) {
      const info = classifyFirestoreError(err);
      if (info.isQuotaError) {
        abortedByQuota = true;
        break;
      }
      // Preserve item in queue with updated error metadata — NEVER silently discard queued work
      enqueuePendingWrite({
        idempotencyKey: item.idempotencyKey,
        type: item.type,
        path: item.path,
        collectionName: item.collectionName,
        category: item.category,
        actionName: item.actionName,
        screen: item.screen,
        data: item.data,
        options: item.options,
        batchOps: item.batchOps,
        lastErrorCode: info.code,
        lastErrorMessage: info.message,
        opCount: item.opCount,
        deleteCount: item.deleteCount,
      });
      if (info.isPermanent) {
        failedPermanent++;
      }
    }
  }

  return {
    flushed,
    remaining: getPendingWritesCount(),
    skippedAlreadyCommitted,
    abortedByQuota,
    failedPermanent,
  };
}
