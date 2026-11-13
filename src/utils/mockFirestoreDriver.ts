import type { FirestoreDriver } from "./quotaTracker";

/**
 * In-Memory Mock Firestore Driver for QA Sandbox & Automated Unit/Integration Tests.
 * Emulates Firestore document CRUD, query filters (==, !=, in, orderBy, limit),
 * WriteBatch (<= 500 ops atomic commit), runTransaction (atomic read/write with rollback),
 * getCountFromServer, and live onSnapshot listeners with ZERO production Firestore calls.
 */

export interface MockFirestoreStats {
  reads: number;
  writes: number;
  deletes: number;
  batchCommits: number;
  txCommits: number;
  snapshotRegistrations: number;
}

export interface MockFirestoreInstance {
  driver: Partial<FirestoreDriver>;
  docs: Map<string, Record<string, any>>;
  stats: MockFirestoreStats;
  clear: () => void;
  seedDoc: (path: string, data: Record<string, any>) => void;
  getRawDoc: (path: string) => Record<string, any> | undefined;
  listCollection: (collectionPath: string) => Array<{ id: string; data: Record<string, any> }>;
  resetStats: () => void;
}

function clonePlain<T>(val: T): T {
  if (val === null || val === undefined || typeof val !== "object") return val;
  if (val instanceof Date) return new Date(val.getTime()) as any;
  if (Array.isArray(val)) return val.map(clonePlain) as any;
  if (typeof (val as any)._methodName === "string") return { ...(val as any) };
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      out[k] = clonePlain(v);
    }
  }
  return out as T;
}

function getFieldValue(obj: any, fieldPath: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = fieldPath.split(".");
  let curr = obj;
  for (const p of parts) {
    if (curr === null || curr === undefined || typeof curr !== "object") return undefined;
    curr = curr[p];
  }
  return curr;
}

function applySentinelUpdate(existing: Record<string, any> | undefined, incoming: Record<string, any>, merge: boolean): Record<string, any> {
  const base: Record<string, any> = merge && existing ? clonePlain(existing) : {};

  const applyNested = (target: Record<string, any>, source: Record<string, any>) => {
    for (const [key, rawVal] of Object.entries(source)) {
      if (rawVal === undefined) continue;
      if (rawVal && typeof rawVal === "object" && typeof (rawVal as any)._methodName === "string") {
        const m = (rawVal as any)._methodName;
        if (m === "deleteField") {
          delete target[key];
        } else if (m === "increment") {
          const prev = typeof target[key] === "number" ? target[key] : 0;
          target[key] = prev + Number((rawVal as any)._operand ?? 1);
        } else if (m === "serverTimestamp") {
          target[key] = new Date().toISOString();
        } else {
          target[key] = clonePlain(rawVal);
        }
      } else if (
        merge &&
        rawVal &&
        typeof rawVal === "object" &&
        !Array.isArray(rawVal) &&
        !(rawVal instanceof Date) &&
        target[key] &&
        typeof target[key] === "object" &&
        !Array.isArray(target[key])
      ) {
        applyNested(target[key], rawVal);
      } else {
        target[key] = clonePlain(rawVal);
      }
    }
  };

  applyNested(base, incoming);
  return base;
}

function extractRefPath(refOrQuery: any): string {
  if (!refOrQuery) return "";
  if (typeof refOrQuery.path === "string") return refOrQuery.path;
  if (refOrQuery._query?.path) {
    if (typeof refOrQuery._query.path.canonicalString === "function") {
      return refOrQuery._query.path.canonicalString();
    }
    if (Array.isArray(refOrQuery._query.path.segments)) {
      return refOrQuery._query.path.segments.join("/");
    }
  }
  if (refOrQuery._path?.segments) {
    return refOrQuery._path.segments.join("/");
  }
  return "";
}

function extractFilters(queryOrRef: any): Array<{ field: string; op: string; value: any }> {
  const filters: Array<{ field: string; op: string; value: any }> = [];
  const rawFilters = queryOrRef?._query?.filters;
  if (!Array.isArray(rawFilters)) return filters;

  for (const f of rawFilters) {
    const fieldSegments = f?.field?.segments;
    const field = Array.isArray(fieldSegments)
      ? fieldSegments.join(".")
      : typeof f?.field?.canonicalString === "function"
      ? f.field.canonicalString()
      : String(f?.field || "");
    const op = String(f?.op || "==");
    const v = f?.value;
    let decodedVal: any = v;
    if (v && typeof v === "object") {
      if ("stringValue" in v) decodedVal = v.stringValue;
      else if ("integerValue" in v) decodedVal = Number(v.integerValue);
      else if ("doubleValue" in v) decodedVal = Number(v.doubleValue);
      else if ("booleanValue" in v) decodedVal = Boolean(v.booleanValue);
      else if ("nullValue" in v) decodedVal = null;
      else if (v.arrayValue && Array.isArray(v.arrayValue.values)) {
        decodedVal = v.arrayValue.values.map((item: any) =>
          "stringValue" in item
            ? item.stringValue
            : "integerValue" in item
            ? Number(item.integerValue)
            : "doubleValue" in item
            ? Number(item.doubleValue)
            : "booleanValue" in item
            ? Boolean(item.booleanValue)
            : item
        );
      }
    }
    if (field) filters.push({ field, op, value: decodedVal });
  }
  return filters;
}

function extractLimit(queryOrRef: any): number | null {
  const lim = queryOrRef?._query?.limit;
  return typeof lim === "number" && lim > 0 ? lim : null;
}

function extractOrderBy(queryOrRef: any): Array<{ field: string; dir: "asc" | "desc" }> {
  const orders: Array<{ field: string; dir: "asc" | "desc" }> = [];
  const rawOrders = queryOrRef?._query?.explicitOrderBy;
  if (!Array.isArray(rawOrders)) return orders;
  for (const o of rawOrders) {
    const field = Array.isArray(o?.field?.segments)
      ? o.field.segments.join(".")
      : typeof o?.field?.canonicalString === "function"
      ? o.field.canonicalString()
      : "";
    const dir = o?.dir === "desc" ? "desc" : "asc";
    if (field && field !== "__name__") {
      orders.push({ field, dir });
    }
  }
  return orders;
}

function matchesFilter(docData: Record<string, any>, filter: { field: string; op: string; value: any }): boolean {
  const actual = getFieldValue(docData, filter.field);
  switch (filter.op) {
    case "==":
      return actual === filter.value;
    case "!=":
      return actual !== filter.value;
    case "in":
      return Array.isArray(filter.value) && filter.value.includes(actual);
    case "not-in":
      return Array.isArray(filter.value) && !filter.value.includes(actual);
    case ">":
      return actual > filter.value;
    case ">=":
      return actual >= filter.value;
    case "<":
      return actual < filter.value;
    case "<=":
      return actual <= filter.value;
    case "array-contains":
      return Array.isArray(actual) && actual.includes(filter.value);
    default:
      return true;
  }
}

export function makeMockDocRef(collectionPath: string, docId: string): any {
  const cleanColl = collectionPath.replace(/^\/+|\/+$/g, "");
  const cleanId = docId.replace(/^\/+|\/+$/g, "");
  return {
    id: cleanId,
    path: cleanId ? `${cleanColl}/${cleanId}` : cleanColl,
    type: "document",
  };
}

export function createMockFirestoreDriver(options?: {
  onBeforeCommit?: (ops: Array<{ op: string; path: string }>) => void;
  failOnPaths?: Set<string> | string[];
  denyCollections?: Set<string> | string[];
}): MockFirestoreInstance {
  const denySet =
    options?.denyCollections instanceof Set
      ? options.denyCollections
      : new Set(options?.denyCollections ?? []);
  const failSet =
    options?.failOnPaths instanceof Set
      ? options.failOnPaths
      : new Set(options?.failOnPaths ?? []);
  const docs = new Map<string, Record<string, any>>();
  const stats: MockFirestoreStats = {
    reads: 0,
    writes: 0,
    deletes: 0,
    batchCommits: 0,
    txCommits: 0,
    snapshotRegistrations: 0,
  };
  let autoIdSeq = 0;

  type SnapshotSub = {
    queryOrRef: any;
    onNext: (snap: any) => void;
  };
  const subscribers = new Set<SnapshotSub>();

  const makeDocSnapshot = (path: string, data: Record<string, any> | undefined) => {
    const id = path.split("/").pop() || "";
    const cloned = data ? clonePlain(data) : undefined;
    return {
      id,
      ref: makeMockDocRef(path.split("/").slice(0, -1).join("/"), id),
      exists: () => cloned !== undefined,
      data: () => (cloned ? clonePlain(cloned) : undefined),
      metadata: { fromCache: false, hasPendingWrites: false },
    };
  };

  const evaluateQuery = (queryOrRef: any) => {
    const collPath = extractRefPath(queryOrRef);
    const filters = extractFilters(queryOrRef);
    const orders = extractOrderBy(queryOrRef);
    const lim = extractLimit(queryOrRef);
    const prefix = collPath ? `${collPath}/` : "";
    const depth = collPath ? collPath.split("/").length + 1 : 2;

    let matched: Array<{ path: string; id: string; data: Record<string, any> }> = [];
    for (const [path, data] of docs.entries()) {
      if (!path.startsWith(prefix)) continue;
      if (path.split("/").length !== depth) continue;
      if (filters.length > 0 && !filters.every((f) => matchesFilter(data, f))) continue;
      matched.push({ path, id: path.split("/").pop() || "", data: clonePlain(data) });
    }

    if (orders.length > 0) {
      matched.sort((a, b) => {
        for (const o of orders) {
          const av = getFieldValue(a.data, o.field);
          const bv = getFieldValue(b.data, o.field);
          if (av === bv) continue;
          const cmp = av < bv ? -1 : 1;
          return o.dir === "desc" ? -cmp : cmp;
        }
        return 0;
      });
    }

    if (lim !== null) {
      matched = matched.slice(0, lim);
    }

    const docSnaps = matched.map((m) => makeDocSnapshot(m.path, m.data));
    return {
      empty: docSnaps.length === 0,
      size: docSnaps.length,
      docs: docSnaps,
      forEach: (cb: (d: any) => void) => docSnaps.forEach(cb),
      docChanges: () => docSnaps.map((d, idx) => ({ type: "added", doc: d, oldIndex: -1, newIndex: idx })),
      metadata: { fromCache: false, hasPendingWrites: false },
    };
  };

  const notifySubscribers = (touchedPaths: string[]) => {
    for (const sub of subscribers) {
      const targetPath = extractRefPath(sub.queryOrRef);
      const isDocSub = sub.queryOrRef?.type === "document" || docs.has(targetPath) || touchedPaths.includes(targetPath);
      const isRelevant = touchedPaths.some((p) => p === targetPath || p.startsWith(`${targetPath}/`));
      if (!isRelevant) continue;

      if (sub.queryOrRef?.type === "document" || (targetPath.split("/").length % 2 === 0 && isDocSub && touchedPaths.includes(targetPath))) {
        sub.onNext(makeDocSnapshot(targetPath, docs.get(targetPath)));
      } else {
        sub.onNext(evaluateQuery(sub.queryOrRef));
      }
    }
  };

  const assertAllowed = (pathOrColl: string, op: string) => {
    const coll = pathOrColl.split("/")[0];
    if (denySet.has(coll)) {
      const err: any = new Error(`Missing or insufficient permissions for ${op} on ${pathOrColl}`);
      err.code = "permission-denied";
      throw err;
    }
    if (failSet.has(pathOrColl)) {
      const err: any = new Error(`Simulated failure for ${op} on ${pathOrColl}`);
      err.code = "unavailable";
      throw err;
    }
  };

  const driver: Partial<FirestoreDriver> = {
    doc: ((colOrFs: any, ...segments: string[]) => {
      if (segments.length === 0 && colOrFs?.path) {
        autoIdSeq++;
        return makeMockDocRef(colOrFs.path, `mock_${Date.now()}_${autoIdSeq}`);
      }
      if (segments.length === 1 && typeof colOrFs?.path === "string") {
        return makeMockDocRef(colOrFs.path, segments[0]);
      }
      const joined = segments.join("/");
      const parts = joined.split("/").filter(Boolean);
      const id = parts.pop() || `mock_${++autoIdSeq}`;
      return makeMockDocRef(parts.join("/"), id);
    }) as any,

    getDoc: (async (docRef: any) => {
      const path = extractRefPath(docRef);
      assertAllowed(path, "getDoc");
      stats.reads++;
      return makeDocSnapshot(path, docs.get(path));
    }) as any,

    getDocs: (async (queryOrRef: any) => {
      const path = extractRefPath(queryOrRef);
      assertAllowed(path, "getDocs");
      const snap = evaluateQuery(queryOrRef);
      stats.reads += Math.max(1, snap.size);
      return snap;
    }) as any,

    getCountFromServer: (async (queryOrRef: any) => {
      const path = extractRefPath(queryOrRef);
      assertAllowed(path, "getCountFromServer");
      const snap = evaluateQuery(queryOrRef);
      stats.reads += Math.max(1, Math.ceil(snap.size / 1000));
      return { data: () => ({ count: snap.size }) };
    }) as any,

    onSnapshot: ((queryOrRef: any, onNext: (snap: any) => void, onError?: (err: any) => void) => {
      stats.snapshotRegistrations++;
      const path = extractRefPath(queryOrRef);
      try {
        assertAllowed(path, "onSnapshot");
      } catch (err) {
        if (onError) onError(err);
        return () => {};
      }
      const sub: SnapshotSub = { queryOrRef, onNext };
      subscribers.add(sub);

      const isDocRef = queryOrRef?.type === "document" || path.split("/").length % 2 === 0;
      const initialSnap = isDocRef ? makeDocSnapshot(path, docs.get(path)) : evaluateQuery(queryOrRef);
      stats.reads += isDocRef ? 1 : Math.max(1, (initialSnap as { size: number }).size);
      setTimeout(() => {
        if (subscribers.has(sub)) onNext(initialSnap);
      }, 0);

      return () => {
        subscribers.delete(sub);
      };
    }) as any,

    setDoc: (async (docRef: any, data: any, setOpts?: { merge?: boolean }) => {
      const path = extractRefPath(docRef);
      assertAllowed(path, "setDoc");
      options?.onBeforeCommit?.([{ op: "set", path }]);
      const merged = applySentinelUpdate(docs.get(path), data || {}, Boolean(setOpts?.merge));
      docs.set(path, merged);
      stats.writes++;
      notifySubscribers([path]);
    }) as any,

    updateDoc: (async (docRef: any, data: any) => {
      const path = extractRefPath(docRef);
      assertAllowed(path, "updateDoc");
      options?.onBeforeCommit?.([{ op: "update", path }]);
      const current = docs.get(path);
      if (!current) {
        const err: any = new Error(`No document to update: ${path}`);
        err.code = "not-found";
        throw err;
      }
      docs.set(path, applySentinelUpdate(current, data || {}, true));
      stats.writes++;
      notifySubscribers([path]);
    }) as any,

    deleteDoc: (async (docRef: any) => {
      const path = extractRefPath(docRef);
      assertAllowed(path, "deleteDoc");
      options?.onBeforeCommit?.([{ op: "delete", path }]);
      docs.delete(path);
      stats.deletes++;
      notifySubscribers([path]);
    }) as any,

    writeBatch: (() => {
      const ops: Array<{ op: "set" | "update" | "delete"; path: string; data?: any; merge?: boolean }> = [];
      return {
        set(docRef: any, data: any, setOpts?: { merge?: boolean }) {
          ops.push({ op: "set", path: extractRefPath(docRef), data: clonePlain(data), merge: Boolean(setOpts?.merge) });
          return this;
        },
        update(docRef: any, data: any) {
          ops.push({ op: "update", path: extractRefPath(docRef), data: clonePlain(data) });
          return this;
        },
        delete(docRef: any) {
          ops.push({ op: "delete", path: extractRefPath(docRef) });
          return this;
        },
        async commit() {
          if (ops.length > 500) {
            const err: any = new Error(`Batch limit exceeded: ${ops.length}`);
            err.code = "invalid-argument";
            throw err;
          }
          for (const item of ops) {
            assertAllowed(item.path, `batch.${item.op}`);
            if (item.op === "update" && !docs.has(item.path)) {
              const err: any = new Error(`No document to update in batch: ${item.path}`);
              err.code = "not-found";
              throw err;
            }
          }
          options?.onBeforeCommit?.(ops.map((o) => ({ op: o.op, path: o.path })));
          const touched: string[] = [];
          for (const item of ops) {
            if (item.op === "delete") {
              docs.delete(item.path);
              stats.deletes++;
            } else if (item.op === "update") {
              docs.set(item.path, applySentinelUpdate(docs.get(item.path), item.data || {}, true));
              stats.writes++;
            } else {
              docs.set(item.path, applySentinelUpdate(docs.get(item.path), item.data || {}, Boolean(item.merge)));
              stats.writes++;
            }
            touched.push(item.path);
          }
          stats.batchCommits++;
          notifySubscribers(touched);
        },
      };
    }) as any,

    runTransaction: (async (_fs: any, fn: (tx: any) => Promise<any>) => {
      const stagedOps: Array<{ op: "set" | "update" | "delete"; path: string; data?: any; merge?: boolean }> = [];
      const txObj = {
        get: async (docRef: any) => {
          const path = extractRefPath(docRef);
          assertAllowed(path, "tx.get");
          stats.reads++;
          return makeDocSnapshot(path, docs.get(path));
        },
        set: (docRef: any, data: any, setOpts?: { merge?: boolean }) => {
          stagedOps.push({ op: "set", path: extractRefPath(docRef), data: clonePlain(data), merge: Boolean(setOpts?.merge) });
          return txObj;
        },
        update: (docRef: any, data: any) => {
          stagedOps.push({ op: "update", path: extractRefPath(docRef), data: clonePlain(data) });
          return txObj;
        },
        delete: (docRef: any) => {
          stagedOps.push({ op: "delete", path: extractRefPath(docRef) });
          return txObj;
        },
      };

      const result = await fn(txObj);
      for (const item of stagedOps) {
        assertAllowed(item.path, `tx.${item.op}`);
        if (item.op === "update" && !docs.has(item.path)) {
          const err: any = new Error(`No document to update in tx: ${item.path}`);
          err.code = "not-found";
          throw err;
        }
      }
      options?.onBeforeCommit?.(stagedOps.map((o) => ({ op: o.op, path: o.path })));
      const touched: string[] = [];
      for (const item of stagedOps) {
        if (item.op === "delete") {
          docs.delete(item.path);
          stats.deletes++;
        } else if (item.op === "update") {
          docs.set(item.path, applySentinelUpdate(docs.get(item.path), item.data || {}, true));
          stats.writes++;
        } else {
          docs.set(item.path, applySentinelUpdate(docs.get(item.path), item.data || {}, Boolean(item.merge)));
          stats.writes++;
        }
        touched.push(item.path);
      }
      stats.txCommits++;
      notifySubscribers(touched);
      return result;
    }) as any,

    disableNetwork: (async () => {}) as any,
    enableNetwork: (async () => {}) as any,
  };

  return {
    driver,
    docs,
    stats,
    clear: () => {
      docs.clear();
    },
    seedDoc: (path: string, data: Record<string, any>) => {
      docs.set(path.replace(/^\/+|\/+$/g, ""), clonePlain(data));
    },
    getRawDoc: (path: string) => {
      const found = docs.get(path.replace(/^\/+|\/+$/g, ""));
      return found ? clonePlain(found) : undefined;
    },
    listCollection: (collectionPath: string) => {
      const clean = collectionPath.replace(/^\/+|\/+$/g, "");
      const prefix = `${clean}/`;
      const depth = clean.split("/").length + 1;
      const out: Array<{ id: string; data: Record<string, any> }> = [];
      for (const [p, d] of docs.entries()) {
        if (p.startsWith(prefix) && p.split("/").length === depth) {
          out.push({ id: p.split("/").pop() || "", data: clonePlain(d) });
        }
      }
      return out;
    },
    resetStats: () => {
      stats.reads = 0;
      stats.writes = 0;
      stats.deletes = 0;
      stats.batchCommits = 0;
      stats.txCommits = 0;
      stats.snapshotRegistrations = 0;
    },
  };
}

export async function runInMockQASandbox<T>(
  fn: (mock: MockFirestoreInstance) => Promise<T>,
  options?: {
    denyCollections?: Set<string> | string[];
    adminUser?: { uid: string; email?: string | null };
  }
): Promise<{ result: T; mockStats: MockFirestoreStats }> {
  const {
    __setFirestoreDriverForTests,
    __setTestAuthUserForTests,
    snapshotQuotaStateForTests,
    restoreQuotaStateForTests,
  } = await import("./quotaTracker");

  const snap = snapshotQuotaStateForTests();
  const mock = createMockFirestoreDriver({
    denyCollections: options?.denyCollections ?? ["_unauthorized_protected_collection"],
  });

  __setFirestoreDriverForTests(mock.driver);
  __setTestAuthUserForTests(
    options?.adminUser ?? { uid: "qa_sandbox_admin", email: "zdpaliyal@gmail.com" }
  );

  try {
    const result = await fn(mock);
    return {
      result,
      mockStats: { ...mock.stats },
    };
  } finally {
    __setTestAuthUserForTests(null);
    __setFirestoreDriverForTests(null);
    restoreQuotaStateForTests(snap);
  }
}

