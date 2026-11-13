import {
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  limit,
  startAfter,
  orderBy,
  where,
  DocumentReference,
  Query,
  CollectionReference,
  DocumentSnapshot,
  QuerySnapshot,
  Unsubscribe,
  QueryConstraint,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";
import { recordUsage, QuotaCategory, guardedGetDocs } from "../utils/quotaTracker";
import { resolveMcqCollection } from "../utils/mcqCollectionAdapter";

/**
 * QuizPro - Centralized Firestore Data Service & Shared Repository
 * 
 * Provides:
 * 1. Single-point Firestore access for all reads, queries, and listeners.
 * 2. In-flight Request Deduplication: Merges concurrent identical queries into one network call.
 * 3. Multi-tier Cache: Fast in-memory TTL cache + IndexedDB persistent cache + Firestore SDK offline cache.
 * 4. Shared Listener Manager: Reference-counted listeners so multiple UI components share 1 physical Firestore connection.
 * 5. Cursor-based MCQ Pagination: Efficient chunk loading with limit & startAfter.
 * 6. Read Health & Telemetry Engine: Measures server fetches, cache hit rate, deduplicated calls, and reads by screen/collection.
 */


// --- TELEMETRY & MONITORING TYPES ---

export interface ReadTelemetryMetrics {
  totalAppRequests: number;
  serverFetches: number;
  memoryCacheHits: number;
  persistentCacheHits: number;
  deduplicatedInFlightRequests: number;
  cacheHitRatePercent: number;
  activePhysicalListeners: number;
  totalActiveSubscribers: number;
  docsReturnedTotal: number;
  avgDocsPerServerFetch: number;
  readsByScreen: Record<string, number>;
  readsByCollection: Record<string, number>;
  lastServerFetchTimestamp: number | null;
  lastServerFetchPath: string | null;
}

// In-memory telemetry state
const telemetry: ReadTelemetryMetrics = {
  totalAppRequests: 0,
  serverFetches: 0,
  memoryCacheHits: 0,
  persistentCacheHits: 0,
  deduplicatedInFlightRequests: 0,
  cacheHitRatePercent: 100,
  activePhysicalListeners: 0,
  totalActiveSubscribers: 0,
  docsReturnedTotal: 0,
  avgDocsPerServerFetch: 0,
  readsByScreen: {},
  readsByCollection: {},
  lastServerFetchTimestamp: null,
  lastServerFetchPath: null,
};

type TelemetryListener = (metrics: ReadTelemetryMetrics) => void;
const telemetryListeners = new Set<TelemetryListener>();

function notifyTelemetry() {
  const totalQueries = telemetry.serverFetches + telemetry.memoryCacheHits + telemetry.persistentCacheHits + telemetry.deduplicatedInFlightRequests;
  const hits = telemetry.memoryCacheHits + telemetry.persistentCacheHits + telemetry.deduplicatedInFlightRequests;
  telemetry.totalAppRequests = totalQueries;
  telemetry.cacheHitRatePercent = totalQueries > 0 ? Math.round((hits / totalQueries) * 1000) / 10 : 100;
  telemetry.avgDocsPerServerFetch = telemetry.serverFetches > 0 ? Math.round((telemetry.docsReturnedTotal / telemetry.serverFetches) * 10) / 10 : 0;

  telemetryListeners.forEach((fn) => {
    try {
      fn({ ...telemetry });
    } catch {}
  });
}

export function subscribeReadTelemetry(callback: TelemetryListener): () => void {
  telemetryListeners.add(callback);
  callback({ ...telemetry });
  return () => {
    telemetryListeners.delete(callback);
  };
}

export function getReadTelemetryMetrics(): ReadTelemetryMetrics {
  return { ...telemetry };
}

// --- IN-FLIGHT REQUEST DEDUPLICATION ---
// If multiple callers request the same doc or query simultaneously, return the exact same in-flight Promise.
const inFlightRequests = new Map<string, Promise<any>>();

// --- MEMORY CACHE ---
interface MemoryCacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}
const memoryCache = new Map<string, MemoryCacheItem<any>>();
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearDataServiceMemoryCache(): void {
  memoryCache.clear();
}

export const clearAllMemoryCache = clearDataServiceMemoryCache;

export function invalidateMemoryCache(keyPattern: string): void {
  for (const k of memoryCache.keys()) {
    if (k.includes(keyPattern)) {
      memoryCache.delete(k);
    }
  }
}

// Helper to generate a deterministic cache key from a DocumentReference or Query
export function generateQueryKey(refOrQuery: any): string {
  try {
    if (!refOrQuery) return "unknown";
    if (refOrQuery.path) return `doc:${refOrQuery.path}`;
    if (refOrQuery._query) {
      const q = refOrQuery._query;
      const path = q.path ? (q.path.segments ? q.path.segments.join("/") : q.path) : "coll";
      const filters = q.filters ? JSON.stringify(q.filters) : "";
      const orders = q.explicitOrderBy ? JSON.stringify(q.explicitOrderBy) : "";
      const limitVal = q.limit ? String(q.limit) : "";
      return `query:${path}|f:${filters}|o:${orders}|l:${limitVal}`;
    }
  } catch {}
  return `ref:${String(refOrQuery)}`;
}

function extractCollectionFromRef(refOrQuery: any): string {
  try {
    if (refOrQuery?.path) {
      return refOrQuery.path.split("/")[0] || "general";
    }
    if (refOrQuery?._query?.path) {
      const segs = refOrQuery._query.path.segments || [];
      return segs[0] || "general";
    }
  } catch {}
  return "general";
}

// --- CENTRALIZED READ SERVICE OPTIONS ---
export interface ReadOptions {
  category?: QuotaCategory;
  actionName?: string;
  screen?: string;
  ttlMs?: number;
  bypassCache?: boolean;
  timeoutMs?: number;
}

/**
 * 1. Centralized Get Document (with Deduplication & Cache)
 */
export async function getDocument<T = any>(
  docRef: DocumentReference<T>,
  options: ReadOptions = {}
): Promise<DocumentSnapshot<T>> {
  const {
    category = "Student",
    actionName = "Get Document",
    screen = "General",
    ttlMs = DEFAULT_CACHE_TTL_MS,
    bypassCache = false,
    timeoutMs = 12000,
  } = options;

  const key = `doc:${docRef.path}`;
  const collectionName = extractCollectionFromRef(docRef);

  // 1. Memory Cache Hit check
  if (!bypassCache) {
    const cached = memoryCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      telemetry.memoryCacheHits++;
      recordUsage({
        category,
        actionName: `${actionName} (Memory Hit)`,
        collectionName,
        reads: 0,
        path: docRef.path,
        operation: "read",
        screen,
      });
      notifyTelemetry();
      return cached.data;
    }
  }

  // 2. In-flight Request Deduplication
  if (inFlightRequests.has(key)) {
    telemetry.deduplicatedInFlightRequests++;
    notifyTelemetry();
    return inFlightRequests.get(key)!;
  }

  // 3. Initiate Single Network/Firestore SDK Request
  const requestPromise = (async () => {
    try {
      const snap = await getDoc(docRef);
      const isFromLocal = snap.metadata.fromCache;
      const billedReads = isFromLocal ? 0 : 1;

      if (isFromLocal) {
        telemetry.persistentCacheHits++;
      } else {
        telemetry.serverFetches++;
        telemetry.docsReturnedTotal += 1;
        telemetry.lastServerFetchTimestamp = Date.now();
        telemetry.lastServerFetchPath = docRef.path;
      }

      telemetry.readsByScreen[screen] = (telemetry.readsByScreen[screen] || 0) + billedReads;
      telemetry.readsByCollection[collectionName] = (telemetry.readsByCollection[collectionName] || 0) + billedReads;

      recordUsage({
        category,
        actionName,
        collectionName,
        reads: billedReads,
        path: docRef.path,
        operation: "read",
        screen,
      });

      // Populate memory cache
      memoryCache.set(key, {
        data: snap,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttlMs,
      });

      notifyTelemetry();
      return snap;
    } catch (err: any) {
      if (err?.code === "unavailable" || (err instanceof Error && err.message.includes("client is offline"))) {
        try {
          const { getDocFromCache } = await import("firebase/firestore");
          const cachedSnap = await getDocFromCache(docRef);
          if (cachedSnap) {
            memoryCache.set(key, {
              data: cachedSnap,
              timestamp: Date.now(),
              expiresAt: Date.now() + ttlMs,
            });
            telemetry.persistentCacheHits++;
            notifyTelemetry();
            return cachedSnap;
          }
        } catch {}
      }
      throw err;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, requestPromise);
  return requestPromise;
}

/**
 * 2. Centralized Get Documents / Query (with Deduplication & Cache)
 */
export async function getDocuments<T = any>(
  queryOrRef: Query<T> | CollectionReference<T>,
  options: ReadOptions = {}
): Promise<QuerySnapshot<T>> {
  const {
    category = "Student",
    actionName = "Get Documents",
    screen = "General",
    ttlMs = DEFAULT_CACHE_TTL_MS,
    bypassCache = false,
  } = options;

  const key = generateQueryKey(queryOrRef);
  const collectionName = extractCollectionFromRef(queryOrRef);

  // 1. Memory Cache Hit check
  if (!bypassCache) {
    const cached = memoryCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      telemetry.memoryCacheHits++;
      recordUsage({
        category,
        actionName: `${actionName} (Memory Hit)`,
        collectionName,
        reads: 0,
        operation: "read",
        screen,
      });
      notifyTelemetry();
      return cached.data;
    }
  }

  // 2. In-flight Request Deduplication
  if (inFlightRequests.has(key)) {
    telemetry.deduplicatedInFlightRequests++;
    notifyTelemetry();
    return inFlightRequests.get(key)!;
  }

  // 3. Initiate Single Network/Firestore SDK Request
  const requestPromise = (async () => {
    try {
      const snap = await guardedGetDocs(queryOrRef, category, actionName, screen, ttlMs);
      const isFromLocal = snap.metadata.fromCache;
      const docCount = snap.size;
      const billedReads = isFromLocal ? 0 : Math.max(1, docCount);

      if (isFromLocal) {
        telemetry.persistentCacheHits++;
      } else {
        telemetry.serverFetches++;
        telemetry.docsReturnedTotal += docCount;
        telemetry.lastServerFetchTimestamp = Date.now();
        telemetry.lastServerFetchPath = key;
      }

      telemetry.readsByScreen[screen] = (telemetry.readsByScreen[screen] || 0) + billedReads;
      telemetry.readsByCollection[collectionName] = (telemetry.readsByCollection[collectionName] || 0) + billedReads;

      recordUsage({
        category,
        actionName,
        collectionName,
        reads: billedReads,
        operation: "read",
        screen,
      });

      // Populate memory cache
      memoryCache.set(key, {
        data: snap,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttlMs,
      });

      notifyTelemetry();
      return snap;
    } catch (err: any) {
      if (err?.code === "unavailable" || (err instanceof Error && err.message.includes("client is offline"))) {
        try {
          const { getDocsFromCache } = await import("firebase/firestore");
          const cachedSnap = await getDocsFromCache(queryOrRef);
          if (cachedSnap) {
            memoryCache.set(key, {
              data: cachedSnap,
              timestamp: Date.now(),
              expiresAt: Date.now() + ttlMs,
            });
            telemetry.persistentCacheHits++;
            notifyTelemetry();
            return cachedSnap;
          }
        } catch {}
      }
      throw err;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, requestPromise);
  return requestPromise;
}

/**
 * 3. Cursor-Based MCQ Pagination Repository
 * Fetches questions in small controlled windows (e.g. 25-50) using limit & startAfter.
 */
export interface PaginatedResult<T> {
  docs: T[];
  lastVisibleDoc: any | null;
  hasMore: boolean;
  totalLoaded: number;
}

export async function getPaginatedMCQs<T = any>(params: {
  collectionName?: "questions" | "mcqs";
  topicId?: string;
  chapterId?: string;
  pageSize?: number;
  lastVisible?: any;
  screen?: string;
}): Promise<PaginatedResult<T>> {
  const {
    collectionName: rawCollectionName = "mcqs",
    topicId,
    chapterId,
    pageSize = 30,
    lastVisible = null,
    screen = "MCQ Practice",
  } = params;

  const collectionName = resolveMcqCollection(rawCollectionName);

  if (!isFirebaseConfigured()) {
    return { docs: [], lastVisibleDoc: null, hasMore: false, totalLoaded: 0 };
  }

  const { collection: firestoreCollection } = await import("firebase/firestore");
  const collRef = firestoreCollection(db, collectionName);

  const constraints: QueryConstraint[] = [];
  if (topicId) {
    constraints.push(where("topicId", "==", topicId));
  } else if (chapterId) {
    constraints.push(where("chapterId", "==", chapterId));
  }

  // Request pageSize + 1 to detect hasMore efficiently
  constraints.push(limit(pageSize + 1));
  if (lastVisible) {
    constraints.push(startAfter(lastVisible));
  }

  const paginatedQuery = query(collRef, ...constraints);
  const snap = await getDocuments(paginatedQuery, {
    category: "Student",
    actionName: `Paginated Fetch (${collectionName})`,
    screen,
    ttlMs: 10 * 60 * 1000, // 10 min TTL for paginated chunks
  });

  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const lastVisibleDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

  const results: T[] = pageDocs.map((d: any) => ({ ...d.data(), id: d.id } as T));

  return {
    docs: results,
    lastVisibleDoc,
    hasMore,
    totalLoaded: results.length,
  };
}

// --- 4. SHARED LISTENER MANAGEMENT (REF-COUNTED) ---
// Ensures multiple components listening to the same query share 1 physical Firestore connection.

interface SharedListenerRecord {
  unsubscribePhysical: Unsubscribe;
  subscribers: Set<(snapshot: any) => void>;
  errorHandlers: Set<(error: any) => void>;
  lastSnapshot: any | null;
}

const sharedListeners = new Map<string, SharedListenerRecord>();

export function subscribeSharedListener(
  queryOrRef: Query | CollectionReference | DocumentReference,
  category: QuotaCategory,
  actionName: string,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void,
  screen?: string
): () => void {
  const key = generateQueryKey(queryOrRef);
  const collectionName = extractCollectionFromRef(queryOrRef);

  let existing = sharedListeners.get(key);

  if (!existing) {
    // Create new shared physical listener
    const subscribers = new Set<(snapshot: any) => void>();
    const errorHandlers = new Set<(error: any) => void>();

    let isInitial = true;
    const unsub = onSnapshot(
      queryOrRef as any,
      (snap: any) => {
        const record = sharedListeners.get(key);
        if (record) {
          record.lastSnapshot = snap;
        }

        const fromCache = snap.metadata?.fromCache;
        const reads = fromCache ? 0 : (snap.size !== undefined ? Math.max(1, snap.size) : 1);

        if (isInitial) {
          isInitial = false;
          if (!fromCache) {
            telemetry.serverFetches++;
            telemetry.docsReturnedTotal += reads;
          } else {
            telemetry.persistentCacheHits++;
          }
        }

        recordUsage({
          category,
          actionName: `${actionName} (Shared Listener)`,
          collectionName,
          reads: fromCache ? 0 : reads,
          operation: "read",
          screen,
        });

        notifyTelemetry();

        subscribers.forEach((fn) => {
          try {
            fn(snap);
          } catch (err) {
            console.error("Shared subscriber callback error:", err);
          }
        });
      },
      (err: any) => {
        if (err?.code === "unavailable" || (err instanceof Error && err.message.includes("client is offline"))) {
          // Normal offline operation
          return;
        }
        errorHandlers.forEach((errFn) => {
          try {
            errFn(err);
          } catch {}
        });
      }
    );

    existing = {
      unsubscribePhysical: unsub,
      subscribers,
      errorHandlers,
      lastSnapshot: null,
    };
    sharedListeners.set(key, existing);
    telemetry.activePhysicalListeners = sharedListeners.size;
  }

  // Register subscriber
  existing.subscribers.add(onNext);
  if (onError) existing.errorHandlers.add(onError);
  telemetry.totalActiveSubscribers++;
  notifyTelemetry();

  // If we already have a cached snapshot from the physical listener, deliver it immediately to new subscriber!
  if (existing.lastSnapshot) {
    try {
      onNext(existing.lastSnapshot);
    } catch {}
  }

  // Return unregister callback
  return () => {
    const current = sharedListeners.get(key);
    if (!current) return;

    current.subscribers.delete(onNext);
    if (onError) current.errorHandlers.delete(onError);
    telemetry.totalActiveSubscribers = Math.max(0, telemetry.totalActiveSubscribers - 1);

    // If zero subscribers remain, tear down the physical Firestore connection!
    if (current.subscribers.size === 0) {
      current.unsubscribePhysical();
      sharedListeners.delete(key);
      telemetry.activePhysicalListeners = sharedListeners.size;
    }
    notifyTelemetry();
  };
}

export function resetReadTelemetry(): void {
  telemetry.totalAppRequests = 0;
  telemetry.serverFetches = 0;
  telemetry.memoryCacheHits = 0;
  telemetry.persistentCacheHits = 0;
  telemetry.deduplicatedInFlightRequests = 0;
  telemetry.cacheHitRatePercent = 100;
  telemetry.docsReturnedTotal = 0;
  telemetry.avgDocsPerServerFetch = 0;
  telemetry.readsByScreen = {};
  telemetry.readsByCollection = {};
  telemetry.lastServerFetchTimestamp = null;
  telemetry.lastServerFetchPath = null;
  notifyTelemetry();
}

export const firestoreDataService = {
  getDocument,
  getDocuments,
  getPaginatedMCQs,
  subscribeSharedListener,
  invalidateMemoryCache,
  clearAllMemoryCache,
  getReadTelemetryMetrics,
  subscribeReadTelemetry,
  resetReadTelemetry,
};

