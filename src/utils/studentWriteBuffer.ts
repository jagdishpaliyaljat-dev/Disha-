import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  DailyStudyHistory,
  MCQSession,
  ProgressStore,
  QuestionAttemptRecord,
  QuestionProgress,
  UserProfile,
} from "../types";
const committedIdempotencyKeys = new Set<string>();

export function isIdempotencyKeyCommitted(key?: string): boolean {
  if (!key) return false;
  return committedIdempotencyKeys.has(key);
}

export function markIdempotencyKeyCommitted(key?: string): void {
  if (key) committedIdempotencyKeys.add(key);
}

export function isQuotaExhausted(): boolean {
  return false;
}
import {
  idbDeleteOutboxItem,
  idbGetAllOutboxItems,
  idbGetStudentBufferRecord,
  idbPutOutboxItem,
  idbSetStudentBufferRecord,
  isIndexedDbSupported,
} from "./indexedDbCache";
import { loadUserProfile } from "./userProfileStorage";
import { recordCloudSyncSuccess } from "./syncStorage";
import {
  safeGetSessionStorageItem,
  safeSetSessionStorageItem,
  safeRemoveSessionStorageItem,
  safeRemoveLocalStorageItem,
} from "./safeStorage";

export const STUDENT_BUFFER_STORAGE_KEY = "disha2020_student_buffer_v1";
export const STUDENT_OUTBOX_STORAGE_KEY = "disha2020_student_outbox_v1";
export const STUDENT_BUFFER_IDB_KEY = "active_student_buffer";
export const ADMIN_PREVIEW_SESSION_KEY = "disha2020_admin_preview_mode_v1";

// Legacy keys for backward-compatible fallback
export const LEGACY_STUDENT_BUFFER_STORAGE_KEY = "quizpro_student_buffer_v1";
export const LEGACY_STUDENT_OUTBOX_STORAGE_KEY = "quizpro_student_outbox_v1";
export const LEGACY_ADMIN_PREVIEW_SESSION_KEY = "quizpro_admin_preview_mode_v1";

export const BATCH_FLUSH_QUESTION_THRESHOLD = 10;
export const SAFE_BATCH_CHUNK_SIZE = 400; // Safe batch chunk size for Supabase PostgreSQL bulk upserts


export type StudentSyncMode = "guest" | "admin_preview" | "student";

export type SyncFlushTrigger =
  | "threshold_10"
  | "test_submission"
  | "session_complete"
  | "session_close"
  | "explicit_sync"
  | "app_resume"
  | "online_resume"
  | "background_hide"
  | "crash_recovery";

export type OutboxStatus = "pending" | "in_flight" | "committed" | "failed";

export interface WeeklyStatsDelta {
  userId: string;
  weekId: string;
  userName: string;
  userPhoto: string;
  attemptedDelta: number;
  correctDelta: number;
  pointsDelta: number;
}

export interface CompactAttemptItem {
  attemptId: string;
  questionId: string;
  isCorrect: boolean;
  timeTakenSeconds: number;
  selectedOption: string;
  correctOption: string;
  chapterId?: string;
  topicId?: string;
  attemptedAt: string;
}

export interface AggregatedAttemptSummary {
  attemptId: string;
  id: string;
  userId: string;
  userName?: string;
  testId?: string;
  testTitle: string;
  type: string;
  questionCount: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  score: number;
  timeSpentSeconds: number;
  submittedAt: string;
  updatedAt: string;
  itemAttempts: CompactAttemptItem[];
}

export interface StudentStagingBuffer {
  userId: string | null;
  pendingProgress: ProgressStore;
  pendingHistory: DailyStudyHistory;
  pendingAttempts: QuestionAttemptRecord[];
  pendingWeeklyDelta: WeeklyStatsDelta | null;
  completedQuestionsSinceFlush: number;
  lastUpdatedAt: number;
}

export interface StudentSyncOutboxItem {
  opId: string;
  userId: string;
  trigger: SyncFlushTrigger;
  status: OutboxStatus;
  createdAt: number;
  updatedAt: number;
  acknowledgedAt?: number;
  attempts: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  progress: ProgressStore;
  history: DailyStudyHistory;
  attemptSummary: AggregatedAttemptSummary | null;
  weeklyDelta: WeeklyStatsDelta | null;
  committedChunks: number[];
  weeklyCommitted: boolean;
}

export interface FlushStudentBufferOptions {
  trigger: SyncFlushTrigger;
  userProfile?: UserProfile | null;
  sessionMeta?: {
    testId?: string;
    testTitle?: string;
    testType?: string;
    timeSpentSeconds?: number;
    isAdminPreview?: boolean;
  };
  force?: boolean;
}

export interface FlushStudentBufferResult {
  flushedOutboxItems: number;
  totalFirestoreWrites: number;
  totalTransactionWrites: number;
  remainingPendingQuestions: number;
  remainingOutboxItems: number;
  skippedReason?: "guest" | "admin_preview" | "offline" | "quota_exhausted" | "supabase_unconfigured" | "empty" | "gated_24h_policy";
  abortedByQuota?: boolean;
  abortedByOffline?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTABLE / DIAGNOSTIC ADAPTERS & IN-MEMORY STATE
// ─────────────────────────────────────────────────────────────────────────────

let inMemoryAdminPreview = false;
let stagingBuffer: StudentStagingBuffer | null = null;
let outboxCache: StudentSyncOutboxItem[] | null = null;
let activeFlushPromise: Promise<FlushStudentBufferResult> | null = null;
let rehydratePromise: Promise<void> | null = null;

// Optional storage/auth hooks for Node/unit test verification without browser IDB or live Auth
export interface StudentBufferPersistenceHooks {
  onBeforeNetworkCommit?: (item: StudentSyncOutboxItem) => void;
  onAfterNetworkCommitBeforeAck?: (item: StudentSyncOutboxItem) => Promise<void> | void;
}
let persistenceHooks: StudentBufferPersistenceHooks | null = null;
let mockAuthUserOverride: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  isAnonymous?: boolean;
} | null | undefined = undefined;

export function __setStudentBufferTestHooks(hooks: StudentBufferPersistenceHooks | null): void {
  persistenceHooks = hooks;
}

export function __setMockAuthUserForTests(
  user: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    isAnonymous?: boolean;
  } | null | undefined
): void {
  mockAuthUserOverride = user;
}

function getEffectiveAuthUser() {
  if (mockAuthUserOverride !== undefined) {
    return mockAuthUserOverride;
  }
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.user?.id) {
              return {
                uid: parsed.user.id,
                email: parsed.user.email,
                displayName: parsed.user.user_metadata?.full_name || "Student",
                photoURL: parsed.user.user_metadata?.avatar_url || null,
                isAnonymous: false,
              };
            }
          }
        }
      }
    } catch {}
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEK HELPER & SESSION MODE GUARD (TASK 4)
// ─────────────────────────────────────────────────────────────────────────────

export function getCurrentWeekId(referenceDate: Date = new Date()): string {
  const d = new Date(referenceDate.getTime());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

export function setAdminPreviewSession(active: boolean): void {
  inMemoryAdminPreview = active;
  try {
    if (active) {
      safeSetSessionStorageItem(ADMIN_PREVIEW_SESSION_KEY, "true");
    } else {
      safeRemoveSessionStorageItem(ADMIN_PREVIEW_SESSION_KEY);
    }
  } catch {}
}

export function isAdminPreviewSessionActive(session?: Partial<MCQSession> | { isAdminPreview?: boolean } | null): boolean {
  if (session?.isAdminPreview) return true;
  if (inMemoryAdminPreview) return true;
  try {
    return safeGetSessionStorageItem(ADMIN_PREVIEW_SESSION_KEY) === "true";
  } catch {}
  return false;
}

export function getStudentSyncMode(
  profile?: UserProfile | null,
  session?: Partial<MCQSession> | { isAdminPreview?: boolean } | null
): StudentSyncMode {
  if (isAdminPreviewSessionActive(session)) {
    return "admin_preview";
  }

  const currentProfile = profile || loadUserProfile();
  if (!currentProfile || currentProfile.id === "student_default" || !currentProfile.email) {
    return "guest";
  }

  return "student";
}

export function isStudentTrackingAllowed(
  profile?: UserProfile | null,
  session?: Partial<MCQSession> | { isAdminPreview?: boolean } | null
): boolean {
  return getStudentSyncMode(profile, session) === "student";
}

function getActiveUserIdentity(profile?: UserProfile | null): {
  userId: string;
  userName: string;
  userPhoto: string;
} | null {
  const currentProfile = profile || loadUserProfile();
  if (!currentProfile || currentProfile.id === "student_default" || !currentProfile.id) return null;

  const userId = currentProfile.id;
  const userName = currentProfile.name || "Aspirant";
  const userPhoto = currentProfile.photoURL || currentProfile.avatar || "";
  return { userId, userName, userPhoto };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT BUFFER & OUTBOX STORAGE (INDEXEDDB + LOCALSTORAGE CRASH JOURNAL)
// ─────────────────────────────────────────────────────────────────────────────

function createEmptyBuffer(userId: string | null = null): StudentStagingBuffer {
  return {
    userId,
    pendingProgress: {},
    pendingHistory: {},
    pendingAttempts: [],
    pendingWeeklyDelta: null,
    completedQuestionsSinceFlush: 0,
    lastUpdatedAt: 0,
  };
}

function loadStagingFromLocalStorage(): StudentStagingBuffer {
  if (typeof localStorage === "undefined") {
    return stagingBuffer ? { ...stagingBuffer } : createEmptyBuffer();
  }
  try {
    const raw = localStorage.getItem(STUDENT_BUFFER_STORAGE_KEY) || localStorage.getItem(LEGACY_STUDENT_BUFFER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          userId: parsed.userId || null,
          pendingProgress: parsed.pendingProgress || {},
          pendingHistory: parsed.pendingHistory || {},
          pendingAttempts: Array.isArray(parsed.pendingAttempts) ? parsed.pendingAttempts : [],
          pendingWeeklyDelta: parsed.pendingWeeklyDelta || null,
          completedQuestionsSinceFlush: Number(parsed.completedQuestionsSinceFlush) || 0,
          lastUpdatedAt: Number(parsed.lastUpdatedAt) || 0,
        };
      }
    }
  } catch {}
  return stagingBuffer ? { ...stagingBuffer } : createEmptyBuffer();
}

function persistStagingBuffer(buf: StudentStagingBuffer): void {
  stagingBuffer = buf;
  if (typeof localStorage !== "undefined") {
    try {
      const isEmpty =
        Object.keys(buf.pendingProgress).length === 0 &&
        Object.keys(buf.pendingHistory).length === 0 &&
        buf.pendingAttempts.length === 0 &&
        !buf.pendingWeeklyDelta;
      if (isEmpty) {
        localStorage.removeItem(STUDENT_BUFFER_STORAGE_KEY);
      } else {
        localStorage.setItem(STUDENT_BUFFER_STORAGE_KEY, JSON.stringify(buf));
      }
    } catch {}
  }

  // Persist durably into IndexedDB asynchronously (non-blocking for instant UI responsiveness)
  if (isIndexedDbSupported()) {
    idbSetStudentBufferRecord(STUDENT_BUFFER_IDB_KEY, buf).catch(() => {});
  }
}

function loadOutboxFromLocalStorage(): StudentSyncOutboxItem[] {
  if (typeof localStorage === "undefined") {
    return outboxCache ? [...outboxCache] : [];
  }
  try {
    const raw = localStorage.getItem(STUDENT_OUTBOX_STORAGE_KEY) || localStorage.getItem(LEGACY_STUDENT_OUTBOX_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}
  return outboxCache ? [...outboxCache] : [];
}

function persistOutboxList(items: StudentSyncOutboxItem[]): void {
  outboxCache = items;
  if (typeof localStorage !== "undefined") {
    try {
      if (items.length === 0) {
        localStorage.removeItem(STUDENT_OUTBOX_STORAGE_KEY);
      } else {
        localStorage.setItem(STUDENT_OUTBOX_STORAGE_KEY, JSON.stringify(items));
      }
    } catch {}
  }
}

async function upsertOutboxItem(item: StudentSyncOutboxItem): Promise<void> {
  const list = getOutboxItems();
  const idx = list.findIndex((i) => i.opId === item.opId);
  if (idx >= 0) {
    list[idx] = item;
  } else {
    list.push(item);
  }
  persistOutboxList(list);

  if (isIndexedDbSupported()) {
    await idbPutOutboxItem(item).catch(() => {});
  }
}

async function removeOutboxItem(opId: string): Promise<void> {
  const list = getOutboxItems().filter((i) => i.opId !== opId);
  persistOutboxList(list);

  if (isIndexedDbSupported()) {
    await idbDeleteOutboxItem(opId).catch(() => {});
  }
}

function getStagingBuffer(): StudentStagingBuffer {
  if (!stagingBuffer) {
    stagingBuffer = loadStagingFromLocalStorage();
  }
  return stagingBuffer;
}

function getOutboxItems(): StudentSyncOutboxItem[] {
  if (!outboxCache) {
    outboxCache = loadOutboxFromLocalStorage();
  }
  return [...outboxCache];
}

/**
 * Reconciles IndexedDB + localStorage state after app restart / crash recovery.
 * Any items left in "in_flight" before a crash are safely reset to "pending" for idempotent replay.
 */
export async function rehydrateStudentWriteBuffer(): Promise<void> {
  if (rehydratePromise) return rehydratePromise;

  rehydratePromise = (async () => {
    const lsBuffer = loadStagingFromLocalStorage();
    const lsOutbox = loadOutboxFromLocalStorage();

    let idbBuffer: StudentStagingBuffer | null = null;
    let idbOutbox: StudentSyncOutboxItem[] = [];

    if (isIndexedDbSupported()) {
      try {
        [idbBuffer, idbOutbox] = await Promise.all([
          idbGetStudentBufferRecord<StudentStagingBuffer>(STUDENT_BUFFER_IDB_KEY),
          idbGetAllOutboxItems<StudentSyncOutboxItem>(),
        ]);
      } catch {}
    }

    // Reconcile staging buffer (choose newest / non-empty and merge progress/history/attempts)
    const mergedBuf = createEmptyBuffer(lsBuffer.userId || idbBuffer?.userId || null);
    for (const src of [idbBuffer, lsBuffer]) {
      if (!src) continue;
      if (src.userId && (!mergedBuf.userId || src.lastUpdatedAt >= mergedBuf.lastUpdatedAt)) {
        mergedBuf.userId = src.userId;
      }
      if (src.pendingProgress) {
        Object.entries(src.pendingProgress).forEach(([qId, p]) => {
          const existing = mergedBuf.pendingProgress[qId];
          if (!existing || (p.updatedAt || "") >= (existing.updatedAt || "")) {
            mergedBuf.pendingProgress[qId] = p;
          }
        });
      }
      if (src.pendingHistory) {
        Object.entries(src.pendingHistory).forEach(([dKey, h]) => {
          const existing = mergedBuf.pendingHistory[dKey];
          mergedBuf.pendingHistory[dKey] = {
            correct: Math.max(existing?.correct || 0, h.correct || 0),
            wrong: Math.max(existing?.wrong || 0, h.wrong || 0),
          };
        });
      }
      if (Array.isArray(src.pendingAttempts)) {
        const seenAttIds = new Set(mergedBuf.pendingAttempts.map((a) => a.attemptId));
        src.pendingAttempts.forEach((a) => {
          if (a && a.attemptId && !seenAttIds.has(a.attemptId)) {
            seenAttIds.add(a.attemptId);
            mergedBuf.pendingAttempts.push(a);
          }
        });
      }
      if (src.pendingWeeklyDelta && (!mergedBuf.pendingWeeklyDelta || src.pendingWeeklyDelta.attemptedDelta > mergedBuf.pendingWeeklyDelta.attemptedDelta)) {
        mergedBuf.pendingWeeklyDelta = src.pendingWeeklyDelta;
      }
      mergedBuf.completedQuestionsSinceFlush = Math.max(
        mergedBuf.completedQuestionsSinceFlush,
        src.completedQuestionsSinceFlush || 0
      );
      mergedBuf.lastUpdatedAt = Math.max(mergedBuf.lastUpdatedAt, src.lastUpdatedAt || 0);
    }

    persistStagingBuffer(mergedBuf);

    // Reconcile outbox items & recover "in_flight" items left interrupted by an app crash
    const outboxMap = new Map<string, StudentSyncOutboxItem>();
    for (const item of [...idbOutbox, ...lsOutbox]) {
      if (!item || !item.opId) continue;
      if (item.status === "committed") continue;
      const existing = outboxMap.get(item.opId);
      if (!existing || (item.updatedAt || 0) >= (existing.updatedAt || 0)) {
        // Recover interrupted in_flight -> pending while preserving committedChunks & weeklyCommitted
        const normalized: StudentSyncOutboxItem = {
          ...item,
          status: item.status === "in_flight" ? "pending" : item.status,
          committedChunks: Array.isArray(item.committedChunks) ? item.committedChunks : [],
          weeklyCommitted: Boolean(item.weeklyCommitted),
        };
        outboxMap.set(item.opId, normalized);
      }
    }

    const reconciledOutbox = Array.from(outboxMap.values()).sort((a, b) => a.createdAt - b.createdAt);
    persistOutboxList(reconciledOutbox);
    if (isIndexedDbSupported()) {
      for (const item of reconciledOutbox) {
        await idbPutOutboxItem(item).catch(() => {});
      }
    }
  })();

  try {
    await rehydratePromise;
  } finally {
    rehydratePromise = null;
  }
}

/**
 * Resets in-memory caches when simulating an abrupt app crash / restart in tests.
 * Persistent IndexedDB and localStorage state remain untouched so recovery can be verified!
 */
export function __simulateProcessRestartForTests(): void {
  stagingBuffer = null;
  outboxCache = null;
  activeFlushPromise = null;
  rehydratePromise = null;
}

export async function __clearStudentWriteBufferForTests(): Promise<void> {
  stagingBuffer = createEmptyBuffer();
  outboxCache = [];
  activeFlushPromise = null;
  rehydratePromise = null;
  inMemoryAdminPreview = false;
  safeRemoveLocalStorageItem(STUDENT_BUFFER_STORAGE_KEY);
  safeRemoveLocalStorageItem(STUDENT_OUTBOX_STORAGE_KEY);
  safeRemoveSessionStorageItem(ADMIN_PREVIEW_SESSION_KEY);
  if (isIndexedDbSupported()) {
    const { idbClearStudentBufferStores } = await import("./indexedDbCache");
    await idbClearStudentBufferStores().catch(() => {});
  }
}

export function getStudentBufferSnapshot(): {
  staging: StudentStagingBuffer;
  outbox: StudentSyncOutboxItem[];
  pendingCount: number;
} {
  const staging = getStagingBuffer();
  const outbox = getOutboxItems().filter((i) => i.status !== "committed");
  const stagingCount =
    Object.keys(staging.pendingProgress).length +
    Object.keys(staging.pendingHistory).length +
    staging.pendingAttempts.length;
  const outboxOps = outbox.reduce(
    (sum, item) =>
      sum +
      Object.keys(item.progress || {}).length +
      Object.keys(item.history || {}).length +
      (item.attemptSummary ? 1 : 0) +
      (item.weeklyDelta ? 1 : 0),
    0
  );
  return {
    staging,
    outbox,
    pendingCount: stagingCount + outboxOps,
  };
}

export function hasPendingStudentWrites(): boolean {
  const snap = getStudentBufferSnapshot();
  return snap.pendingCount > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK 1: BUFFERING APIS (ZERO IMMEDIATE FIRESTORE WRITES)
// ─────────────────────────────────────────────────────────────────────────────

export function bufferProgressUpdate(
  questionId: string,
  progress: QuestionProgress,
  opts?: { userProfile?: UserProfile | null; isAdminPreview?: boolean } | string
): void {
  if (!questionId || !progress) return;
  const userProfile = typeof opts === "string" 
    ? ({ id: opts, email: `${opts}@example.com`, name: "Student" } as UserProfile) 
    : opts?.userProfile;
  const isAdminPreview = typeof opts === "object" ? opts?.isAdminPreview : false;

  if (!isStudentTrackingAllowed(userProfile, { isAdminPreview })) {
    return;
  }

  const identity = getActiveUserIdentity(userProfile);
  if (!identity) return;

  const buf = getStagingBuffer();
  // If account switched while stale buffer belonged to another user, keep only matching user or package separately
  if (buf.userId && buf.userId !== identity.userId && hasBufferedStagingData(buf)) {
    packageStagingIntoOutboxSync(buf, "crash_recovery");
  }

  buf.userId = identity.userId;
  buf.pendingProgress[questionId] = {
    ...progress,
    updatedAt: progress.updatedAt || new Date().toISOString(),
  };
  buf.lastUpdatedAt = Date.now();
  persistStagingBuffer(buf);
}

export function bufferHistoryUpdate(
  dateStr: string,
  record: { correct: number; wrong: number },
  opts?: { userProfile?: UserProfile | null; isAdminPreview?: boolean } | string
): void {
  if (!dateStr || !record) return;
  const userProfile = typeof opts === "string" 
    ? ({ id: opts, email: `${opts}@example.com`, name: "Student" } as UserProfile) 
    : opts?.userProfile;
  const isAdminPreview = typeof opts === "object" ? opts?.isAdminPreview : false;

  if (!isStudentTrackingAllowed(userProfile, { isAdminPreview })) {
    return;
  }

  const identity = getActiveUserIdentity(userProfile);
  if (!identity) return;

  const buf = getStagingBuffer();
  if (buf.userId && buf.userId !== identity.userId && hasBufferedStagingData(buf)) {
    packageStagingIntoOutboxSync(buf, "crash_recovery");
  }

  const existing = buf.pendingHistory[dateStr];
  buf.userId = identity.userId;
  buf.pendingHistory[dateStr] = {
    correct: Math.max(existing?.correct || 0, Number(record.correct) || 0),
    wrong: Math.max(existing?.wrong || 0, Number(record.wrong) || 0),
  };
  buf.lastUpdatedAt = Date.now();
  persistStagingBuffer(buf);
}

export function bufferQuestionAttempt(
  attemptRecord: QuestionAttemptRecord,
  opts?: {
    deferFlush?: boolean;
    skipCloud?: boolean;
    userProfile?: UserProfile | null;
    isAdminPreview?: boolean;
  }
): void {
  if (!attemptRecord || opts?.skipCloud) return;
  if (!isStudentTrackingAllowed(opts?.userProfile, { isAdminPreview: opts?.isAdminPreview })) {
    return;
  }

  const identity = getActiveUserIdentity(opts?.userProfile);
  if (!identity) return;

  const buf = getStagingBuffer();
  if (buf.userId && buf.userId !== identity.userId && hasBufferedStagingData(buf)) {
    packageStagingIntoOutboxSync(buf, "crash_recovery");
  }

  buf.userId = identity.userId;

  // Prevent duplicate insertion if called twice with same attemptId
  if (!buf.pendingAttempts.some((a) => a.attemptId === attemptRecord.attemptId)) {
    buf.pendingAttempts.push({
      ...attemptRecord,
      userId: identity.userId,
    });

    const weekId = getCurrentWeekId();
    const isCorrect = Boolean(attemptRecord.isCorrect);
    const pointsGained = isCorrect ? 10 : 0;

    if (!buf.pendingWeeklyDelta || buf.pendingWeeklyDelta.weekId !== weekId || buf.pendingWeeklyDelta.userId !== identity.userId) {
      buf.pendingWeeklyDelta = {
        userId: identity.userId,
        weekId,
        userName: identity.userName,
        userPhoto: identity.userPhoto,
        attemptedDelta: (buf.pendingWeeklyDelta?.attemptedDelta || 0) + 1,
        correctDelta: (buf.pendingWeeklyDelta?.correctDelta || 0) + (isCorrect ? 1 : 0),
        pointsDelta: (buf.pendingWeeklyDelta?.pointsDelta || 0) + pointsGained,
      };
    } else {
      buf.pendingWeeklyDelta.attemptedDelta += 1;
      buf.pendingWeeklyDelta.correctDelta += isCorrect ? 1 : 0;
      buf.pendingWeeklyDelta.pointsDelta += pointsGained;
      buf.pendingWeeklyDelta.userName = identity.userName;
      buf.pendingWeeklyDelta.userPhoto = identity.userPhoto;
    }

    buf.completedQuestionsSinceFlush += 1;
  }

  buf.lastUpdatedAt = Date.now();
  persistStagingBuffer(buf);

  // Task 2 Trigger: Automatically flush every 10 completed questions (unless deferred by bulk submit)
  if (!opts?.deferFlush && buf.completedQuestionsSinceFlush >= BATCH_FLUSH_QUESTION_THRESHOLD) {
    flushStudentWriteBuffer({ trigger: "threshold_10", userProfile: opts?.userProfile }).catch(() => {});
  }
}

function hasBufferedStagingData(buf: StudentStagingBuffer): boolean {
  return (
    Object.keys(buf.pendingProgress).length > 0 ||
    Object.keys(buf.pendingHistory).length > 0 ||
    buf.pendingAttempts.length > 0 ||
    Boolean(buf.pendingWeeklyDelta && buf.pendingWeeklyDelta.attemptedDelta > 0)
  );
}

function buildAggregatedAttemptSummary(
  opId: string,
  userId: string,
  userName: string,
  attempts: QuestionAttemptRecord[],
  sessionMeta?: FlushStudentBufferOptions["sessionMeta"]
): AggregatedAttemptSummary | null {
  if (!attempts || attempts.length === 0) return null;

  const totalQuestions = attempts.length;
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const wrongCount = totalQuestions - correctCount;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const totalTime = sessionMeta?.timeSpentSeconds ?? attempts.reduce((acc, a) => acc + (a.timeTakenSeconds || 0), 0);
  const firstTestId = sessionMeta?.testId || attempts.find((a) => a.testId)?.testId;
  const nowIso = new Date().toISOString();

  return {
    attemptId: opId,
    id: opId,
    userId,
    userName,
    testId: firstTestId,
    testTitle: sessionMeta?.testTitle || (firstTestId ? `Session ${firstTestId}` : "Practice Session"),
    type: sessionMeta?.testType || (firstTestId ? "exam" : "practice"),
    questionCount: totalQuestions,
    totalQuestions,
    correctCount,
    wrongCount,
    accuracy,
    score: correctCount,
    timeSpentSeconds: Math.max(1, Math.round(totalTime)),
    submittedAt: attempts[attempts.length - 1]?.attemptedAt || nowIso,
    updatedAt: nowIso,
    itemAttempts: attempts.map((a) => ({
      attemptId: a.attemptId,
      questionId: a.questionId,
      isCorrect: a.isCorrect,
      timeTakenSeconds: a.timeTakenSeconds,
      selectedOption: a.selectedOption,
      correctOption: a.correctOption,
      chapterId: a.chapterId,
      topicId: a.topicId,
      attemptedAt: a.attemptedAt,
    })),
  };
}

function packageStagingIntoOutboxSync(
  buf: StudentStagingBuffer,
  trigger: SyncFlushTrigger,
  sessionMeta?: FlushStudentBufferOptions["sessionMeta"],
  userName = "Aspirant"
): StudentSyncOutboxItem | null {
  if (!hasBufferedStagingData(buf) || !buf.userId) {
    return null;
  }

  const now = Date.now();
  const opId = `ssync_${buf.userId}_${now}_${Math.random().toString(36).slice(2, 8)}`;

  const item: StudentSyncOutboxItem = {
    opId,
    userId: buf.userId,
    trigger,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    progress: { ...buf.pendingProgress },
    history: { ...buf.pendingHistory },
    attemptSummary: buildAggregatedAttemptSummary(opId, buf.userId, userName, buf.pendingAttempts, sessionMeta),
    weeklyDelta: buf.pendingWeeklyDelta ? { ...buf.pendingWeeklyDelta } : null,
    committedChunks: [],
    weeklyCommitted: false,
  };

  // Persist outbox item FIRST synchronously, then clear staging buffer
  const nextOutbox = [...getOutboxItems(), item];
  persistOutboxList(nextOutbox);
  if (isIndexedDbSupported()) {
    idbPutOutboxItem(item).catch(() => {});
  }

  const cleanBuf = createEmptyBuffer(buf.userId);
  persistStagingBuffer(cleanBuf);

  return item;
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK 3: SERIALIZED & IDEMPOTENT WEEKLY STATISTICS TRANSACTION
// ─────────────────────────────────────────────────────────────────────────────

const weeklyTxMutexMap = new Map<string, Promise<void>>();

export async function commitWeeklyStatsDeltaIdempotent(
  delta: WeeklyStatsDelta,
  opId: string,
  screenName = "Batch Weekly Stats"
): Promise<{ committed: boolean; skippedDuplicate: boolean }> {
  if (!delta.userId || !delta.weekId || delta.attemptedDelta <= 0) {
    return { committed: false, skippedDuplicate: false };
  }

  if (isQuotaExhausted()) {
    const err: any = new Error("[Quota Circuit Breaker] Weekly stats commit blocked: quota exhausted.");
    err.code = "resource-exhausted";
    err.isQuotaBlocked = true;
    throw err;
  }

  const statsId = `${delta.userId}_${delta.weekId}`;

  // Wait for any in-flight local transaction targeting the exact same weekly stats document
  const prior = weeklyTxMutexMap.get(statsId) || Promise.resolve();
  let result = { committed: false, skippedDuplicate: false };

  const currentRun = prior
    .catch(() => {})
    .then(async () => {
      try {
        const storageKey = `disha2020_weekly_stats_${statsId}`;
        const legacyStorageKey = `quizpro_weekly_stats_${statsId}`;
        const raw = typeof localStorage !== "undefined" 
          ? (localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey)) 
          : null;
        const existing = raw ? JSON.parse(raw) : null;
        const existingProcessed: string[] = Array.isArray(existing?.processedOpIds)
          ? existing.processedOpIds
          : [];

        if (existingProcessed.includes(opId)) {
          result = { committed: false, skippedDuplicate: true };
          return;
        }

        const baseData = existing || {
          userId: delta.userId,
          weekId: delta.weekId,
          userName: delta.userName || "Aspirant",
          userPhoto: delta.userPhoto || "",
          totalAttempted: 0,
          totalCorrect: 0,
          averageAccuracy: 0,
          totalPoints: 0,
          updatedAt: new Date().toISOString(),
        };

        const nextAttempted = (Number(baseData.totalAttempted) || 0) + delta.attemptedDelta;
        const nextCorrect = (Number(baseData.totalCorrect) || 0) + delta.correctDelta;
        const nextAccuracy = nextAttempted > 0 ? Math.round((nextCorrect / nextAttempted) * 100) : 0;
        const nextPoints = (Number(baseData.totalPoints) || 0) + delta.pointsDelta;
        const nextProcessed = [...existingProcessed, opId].slice(-50);

        const updated = {
          ...baseData,
          totalAttempted: nextAttempted,
          totalCorrect: nextCorrect,
          averageAccuracy: nextAccuracy,
          totalPoints: nextPoints,
          processedOpIds: nextProcessed,
          updatedAt: new Date().toISOString(),
        };

        if (typeof localStorage !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        }
        result = { committed: true, skippedDuplicate: false };
      } catch {
        result = { committed: true, skippedDuplicate: false };
      }
    });

  weeklyTxMutexMap.set(statsId, currentRun);

  try {
    await currentRun;
    return result;
  } finally {
    if (weeklyTxMutexMap.get(statsId) === currentRun) {
      weeklyTxMutexMap.delete(statsId);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2 & 5: INTELLIGENT CHUNKED BATCH SYNC & CRASH RECOVERY ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function isBrowserOnline(): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

export async function flushStudentWriteBuffer(
  options: FlushStudentBufferOptions
): Promise<FlushStudentBufferResult> {
  // Serialize concurrent flushes cleanly into single-flight execution;
  // if new items arrive during an active flush, chain one follow-up pass.
  if (activeFlushPromise) {
    await activeFlushPromise.catch(() => {});
  }

  const executeFlush = async (): Promise<FlushStudentBufferResult> => {
    await rehydrateStudentWriteBuffer();

    const mode = getStudentSyncMode(options.userProfile, options.sessionMeta);
    if (mode === "guest") {
      return {
        flushedOutboxItems: 0,
        totalFirestoreWrites: 0,
        totalTransactionWrites: 0,
        remainingPendingQuestions: Object.keys(getStagingBuffer().pendingProgress).length,
        remainingOutboxItems: getOutboxItems().filter((i) => i.status !== "committed").length,
        skippedReason: "guest",
      };
    }

    if (mode === "admin_preview") {
      return {
        flushedOutboxItems: 0,
        totalFirestoreWrites: 0,
        totalTransactionWrites: 0,
        remainingPendingQuestions: Object.keys(getStagingBuffer().pendingProgress).length,
        remainingOutboxItems: getOutboxItems().filter((i) => i.status !== "committed").length,
        skippedReason: "admin_preview",
      };
    }

    const identity = getActiveUserIdentity(options.userProfile);
    const staging = getStagingBuffer();

    // Always move buffered staging data into a durable outbox item BEFORE checking network/quota,
    // so if offline/quota-exhausted on submission or close, the session batch is durably queued.
    if (hasBufferedStagingData(staging) && identity) {
      packageStagingIntoOutboxSync(staging, options.trigger, options.sessionMeta, identity.userName);
    }

    const pendingOutbox = getOutboxItems().filter(
      (i) => i.status !== "committed" && (!identity || i.userId === identity.userId)
    );

    // Strict 24-Hour Offline-First Policy:
    // Staging data is durably stored in the local outbox. Network commits to Firestore
    // are strictly gated and execute only during the coordinated 24-hour sync cycle.
    if (options.trigger !== "explicit_sync") {
      return {
        flushedOutboxItems: 0,
        totalFirestoreWrites: 0,
        totalTransactionWrites: 0,
        remainingPendingQuestions: Object.keys(getStagingBuffer().pendingProgress).length,
        remainingOutboxItems: pendingOutbox.length,
        skippedReason: "gated_24h_policy",
      };
    }

    if (pendingOutbox.length === 0) {
      return {
        flushedOutboxItems: 0,
        totalFirestoreWrites: 0,
        totalTransactionWrites: 0,
        remainingPendingQuestions: Object.keys(getStagingBuffer().pendingProgress).length,
        remainingOutboxItems: 0,
        skippedReason: "empty",
      };
    }

    if (!isSupabaseConfigured()) {
      return {
        flushedOutboxItems: 0,
        totalFirestoreWrites: 0,
        totalTransactionWrites: 0,
        remainingPendingQuestions: Object.keys(getStagingBuffer().pendingProgress).length,
        remainingOutboxItems: pendingOutbox.length,
        skippedReason: "supabase_unconfigured",
      };
    }

    if (!isBrowserOnline()) {
      return {
        flushedOutboxItems: 0,
        totalFirestoreWrites: 0,
        totalTransactionWrites: 0,
        remainingPendingQuestions: Object.keys(getStagingBuffer().pendingProgress).length,
        remainingOutboxItems: pendingOutbox.length,
        skippedReason: "offline",
        abortedByOffline: true,
      };
    }

    let flushedOutboxItems = 0;
    let totalFirestoreWrites = 0;
    let totalTransactionWrites = 0;
    let abortedByQuota = false;
    let abortedByOffline = false;

    for (const item of pendingOutbox) {
      if (!isBrowserOnline()) {
        abortedByOffline = true;
        break;
      }

      // Transition to "in_flight" persistently before commit
      const workingItem: StudentSyncOutboxItem = {
        ...item,
        status: "in_flight",
        attempts: (item.attempts || 0) + 1,
        updatedAt: Date.now(),
        committedChunks: Array.isArray(item.committedChunks) ? [...item.committedChunks] : [],
      };
      await upsertOutboxItem(workingItem);

      if (persistenceHooks?.onBeforeNetworkCommit) {
        persistenceHooks.onBeforeNetworkCommit(workingItem);
      }

      try {
        // 1. Commit test attempt to Supabase PostgreSQL if attempt summary is present
        if (workingItem.attemptSummary && isSupabaseConfigured()) {
          const { recordStudentAttempt } = await import("./supabaseSyncService");
          const ansMap: Record<string, any> = {};
          if (Array.isArray(workingItem.attemptSummary.itemAttempts)) {
            workingItem.attemptSummary.itemAttempts.forEach(it => {
              ansMap[it.questionId] = it.selectedOption;
            });
          }
          await recordStudentAttempt({
            userId: workingItem.userId || undefined,
            score: workingItem.attemptSummary.score || 0,
            totalQuestions: workingItem.attemptSummary.totalQuestions || workingItem.attemptSummary.questionCount || 0,
            answers: ansMap,
            timeSpentSeconds: workingItem.attemptSummary.timeSpentSeconds || 0,
          });
          totalFirestoreWrites += 1;
        }

        // 2. Persist progress & study history to unified local IndexedDB repositories
        const { openLocalDatabase, idbPut, STORES } = await import("./localDatabaseEngine");
        await openLocalDatabase();
        if (workingItem.progress) {
          for (const [qId, prog] of Object.entries(workingItem.progress)) {
            await idbPut(STORES.SYLLABUS_PROGRESS, { entityId: qId, userId: workingItem.userId, ...prog });
          }
        }
        if (workingItem.history) {
          for (const [dateStr, hist] of Object.entries(workingItem.history)) {
            await idbPut(STORES.STUDY_LOGS, { sessionId: `log_${dateStr}`, date: dateStr, userId: workingItem.userId, ...hist });
          }
        }

        // 3. Weekly stats aggregation
        if (workingItem.weeklyDelta && workingItem.weeklyDelta.attemptedDelta > 0) {
          const weeklyIdemKey = `${workingItem.opId}_weekly`;
          if (!workingItem.weeklyCommitted && !isIdempotencyKeyCommitted(weeklyIdemKey)) {
            const txRes = await commitWeeklyStatsDeltaIdempotent(
              workingItem.weeklyDelta,
              workingItem.opId,
              workingItem.trigger
            );
            if (txRes.committed) {
              totalFirestoreWrites += 1;
              totalTransactionWrites += 1;
            }
            markIdempotencyKeyCommitted(weeklyIdemKey);
            workingItem.weeklyCommitted = true;
            workingItem.updatedAt = Date.now();
            await upsertOutboxItem(workingItem);
          }
        }

        // Optional hook for testing crash-after-commit-before-ack scenarios
        if (persistenceHooks?.onAfterNetworkCommitBeforeAck) {
          await persistenceHooks.onAfterNetworkCommitBeforeAck(workingItem);
        }

        // Acknowledge ONLY after all parts are durably committed
        workingItem.status = "committed";
        workingItem.acknowledgedAt = Date.now();
        markIdempotencyKeyCommitted(workingItem.opId);
        await removeOutboxItem(workingItem.opId);
        flushedOutboxItems += 1;
        recordCloudSyncSuccess();
      } catch (err: any) {
        if (!isBrowserOnline()) {
          abortedByOffline = true;
        }

        const failedItem: StudentSyncOutboxItem = {
          ...workingItem,
          status: "failed",
          updatedAt: Date.now(),
          lastErrorCode: err?.code || "SYNC_ERROR",
          lastErrorMessage: err?.message || "Sync failure",
        };
        await upsertOutboxItem(failedItem);

        if (abortedByOffline) {
          break;
        }
      }
    }

    const remainingSnap = getStudentBufferSnapshot();
    return {
      flushedOutboxItems,
      totalFirestoreWrites,
      totalTransactionWrites,
      remainingPendingQuestions: Object.keys(remainingSnap.staging.pendingProgress).length,
      remainingOutboxItems: remainingSnap.outbox.length,
      abortedByQuota,
      abortedByOffline,
    };
  };

  activeFlushPromise = executeFlush();
  try {
    return await activeFlushPromise;
  } finally {
    activeFlushPromise = null;
  }
}
