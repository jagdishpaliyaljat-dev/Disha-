import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  doc,
  collection,
} from "firebase/firestore";
import {
  guardedGetDoc,
  guardedGetDocs,
  guardedSetDoc,
  guardedOnSnapshot,
  guardedWriteBatch,
} from "../utils/quotaTracker";
import { db, auth, isFirebaseConfigured } from "../lib/firebase";
import {
  UserProfile,
  ProgressStore,
  AppSettings,
  DailyStudyHistory,
  UserQuestionsStore,
  Question,
  Subject,
  Chapter,
  Topic,
  QuestionProgress,
} from "../types";
import {
  isTestOrMockSubject,
  isTestOrMockChapter,
  isTestOrMockTopic,
} from "../utils/cleanSlate";
import { loadFromCloudWithCache } from "../utils/firebaseSyncService";
import { loadUserQuestionsStore, saveUserQuestionsStore } from "../utils/questionsStorage";
import { getCachedCurriculum, saveCachedCurriculum, getLocalMetadata, getAllCachedBundles } from "../utils/indexedDbCache";
import { getAllCachedQuestions } from "../utils/questionBankCache";
import { checkCurriculumVersionMatch, recordLocalCurriculumVersion, AppVersionMetadata } from "../utils/appVersionService";
import { subscribeSharedListener } from "../services/firestoreDataService";
import { fetchCurriculumAssetCacheFirst, prewarmStaticQuizAssets } from "../utils/quizAssetSwCache";
import { isUserAdmin, loadUserProfile } from "../utils/userProfileStorage";

export function mergeRealtimeProgressDelta(
  localStore: ProgressStore,
  remoteDeltas: Record<string, QuestionProgress>
): { merged: ProgressStore; changedCount: number } {
  let changedCount = 0;
  const merged: ProgressStore = { ...localStore };

  for (const [qId, remoteP] of Object.entries(remoteDeltas)) {
    if (!remoteP || typeof remoteP !== "object") continue;
    const localP = merged[qId];
    if (!localP) {
      merged[qId] = { ...remoteP };
      changedCount++;
      continue;
    }

    const localTs = (localP as any).updatedAt || localP.lastAnsweredAt || "";
    const remoteTs = (remoteP as any).updatedAt || remoteP.lastAnsweredAt || "";
    const remoteIsNewerOrEqual = !localTs || (remoteTs && remoteTs >= localTs);

    const nextBookmarked =
      remoteTs && localTs && remoteTs !== localTs
        ? Boolean(remoteIsNewerOrEqual ? remoteP.bookmarked : localP.bookmarked)
        : Boolean(localP.bookmarked || remoteP.bookmarked);

    const nextTimesAttempted = Math.max(
      localP.timesAttempted || 0,
      remoteP.timesAttempted || 0
    );

    const nextItem: QuestionProgress = {
      ...(remoteIsNewerOrEqual ? { ...localP, ...remoteP } : { ...remoteP, ...localP }),
      bookmarked: nextBookmarked,
      timesAttempted: nextTimesAttempted,
    };

    if (JSON.stringify(localP) !== JSON.stringify(nextItem)) {
      merged[qId] = nextItem;
      changedCount++;
    }
  }

  return { merged, changedCount };
}

export function mergeRealtimeHistoryDelta(
  localHistory: DailyStudyHistory,
  remoteDeltas: DailyStudyHistory
): { merged: DailyStudyHistory; changedCount: number } {
  let changedCount = 0;
  const merged: DailyStudyHistory = { ...localHistory };

  for (const [dateKey, remoteH] of Object.entries(remoteDeltas)) {
    if (!remoteH || typeof remoteH !== "object") continue;
    const localH = merged[dateKey];
    const nextItem = {
      correct: Math.max(localH?.correct || 0, remoteH.correct || 0),
      wrong: Math.max(localH?.wrong || 0, remoteH.wrong || 0),
    };
    if (!localH || localH.correct !== nextItem.correct || localH.wrong !== nextItem.wrong) {
      merged[dateKey] = nextItem;
      changedCount++;
    }
  }

  return { merged, changedCount };
}

function reconcileCloudItems<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const mergedMap = new Map<string, T>();
  (local || []).forEach((item) => {
    if (item && item.id) mergedMap.set(item.id, item);
  });
  (remote || []).forEach((item) => {
    if (item && item.id) {
      const prev = mergedMap.get(item.id) as any;
      const next = { ...item } as any;
      if (prev) {
        if (typeof next.questionCount !== "number" && typeof prev.questionCount === "number") {
          next.questionCount = prev.questionCount;
        }
        if ((!Array.isArray(next.questions) || next.questions.length === 0) && Array.isArray(prev.questions) && prev.questions.length > 0) {
          next.questions = prev.questions;
        }
      }
      mergedMap.set(item.id, next);
    }
  });
  return Array.from(mergedMap.values());
}

export interface CurriculumListenerDeps {
  isConfigured?: () => boolean;
  subscribeAppVersion?: (
    onNext: (snap: any) => void,
    onError: (err: any) => void
  ) => () => void;
  checkVersionMatch?: typeof checkCurriculumVersionMatch;
  fetchSwAsset?: typeof fetchCurriculumAssetCacheFirst;
  fetchCollectionsFallback?: (forceBypass: boolean) => Promise<{
    subjects: Subject[] | null;
    chapters: Chapter[] | null;
    topics: Topic[] | null;
    questions?: Question[] | null;
  }>;
  getCachedTree?: typeof getCachedCurriculum;
  saveCachedTree?: typeof saveCachedCurriculum;
  recordLocalVersion?: typeof recordLocalCurriculumVersion;
  getLocalVersionMeta?: () => Promise<AppVersionMetadata | null>;
  loadStore?: typeof loadUserQuestionsStore;
  saveStore?: typeof saveUserQuestionsStore;
  prewarmAssets?: typeof prewarmStaticQuizAssets;
  clearCache?: () => Promise<void> | void;
}

const curriculumSubscribers = new Set<(data: Partial<UserQuestionsStore>) => void>();
const metadataSubscribers = new Set<(meta: AppVersionMetadata) => void>();
let activeCurriculumPhysicalUnsub: (() => void) | null = null;
let curriculumSyncInFlight: Promise<void> | null = null;
let memoizedCurriculumUpdates: Partial<UserQuestionsStore> | null = null;
let memoizedCurriculumSignature: string | null = null;
let memoizedRemoteVersion = 0;
let memoizedAppMetadata: AppVersionMetadata | null = null;
let queuedRemoteSnapshotMeta: AppVersionMetadata | null = null;
let activeListenerDeps: CurriculumListenerDeps | undefined;

function computeCurriculumTreeSignature(updates: Partial<UserQuestionsStore>): string {
  const summarize = (items: any[] | undefined) =>
    (items || [])
      .map((item) => {
        const qCount = typeof item?.questionCount === "number" ? item.questionCount : "";
        const qLen = Array.isArray(item?.questions) ? item.questions.length : "";
        const chTopicsCount = Array.isArray(item?.topics)
          ? item.topics.reduce((acc: number, t: any) => acc + (typeof t?.questionCount === "number" ? t.questionCount : (Array.isArray(t?.questions) ? t.questions.length : 0)), 0)
          : "";
        return `${item?.id || ""}:${item?.name || item?.title || ""}:${item?.subjectId || ""}:${item?.chapterId || ""}:${item?.updatedAt || ""}:${item?.order ?? ""}:${qCount}:${qLen}:${chTopicsCount}`;
      })
      .sort()
      .join(",");

  return [
    `S(${updates.customSubjects?.length || 0})[${summarize(updates.customSubjects)}]`,
    `C(${updates.customChapters?.length || 0})[${summarize(updates.customChapters)}]`,
    `T(${updates.customTopics?.length || 0})[${summarize(updates.customTopics)}]`,
    `Q(${updates.cloudCacheQuestions?.length || 0})`,
  ].join("|");
}

function broadcastCurriculumUpdates(updates: Partial<UserQuestionsStore>): void {
  const sig = computeCurriculumTreeSignature(updates);
  if (memoizedCurriculumSignature === sig && memoizedCurriculumUpdates) {
    return;
  }
  memoizedCurriculumUpdates = updates;
  memoizedCurriculumSignature = sig;
  curriculumSubscribers.forEach((cb) => {
    try {
      cb(updates);
    } catch (err) {
      console.warn("[useFirebaseSync] Curriculum subscriber callback error:", err);
    }
  });
}

function broadcastAppMetadata(meta: AppVersionMetadata): void {
  memoizedAppMetadata = meta;
  metadataSubscribers.forEach((cb) => {
    try {
      cb(meta);
    } catch {}
  });
}

export function __resetCurriculumListenerForTests(): void {
  if (activeCurriculumPhysicalUnsub) {
    try {
      activeCurriculumPhysicalUnsub();
    } catch {}
  }
  curriculumSubscribers.clear();
  metadataSubscribers.clear();
  activeCurriculumPhysicalUnsub = null;
  curriculumSyncInFlight = null;
  memoizedCurriculumUpdates = null;
  memoizedCurriculumSignature = null;
  memoizedRemoteVersion = 0;
  memoizedAppMetadata = null;
  queuedRemoteSnapshotMeta = null;
  activeListenerDeps = undefined;
}

/**
 * Single, memoized curriculum tree listener.
 * Replaces independent onSnapshot listeners for 'subjects', 'chapters', and 'topics'
 * with one shared physical listener on 'metadata/app_version' + coalesced tree hydration.
 */
export function subscribeToMemoizedCurriculumTree(
  onUpdate: (data: Partial<UserQuestionsStore>) => void,
  onMetadataUpdate?: (meta: AppVersionMetadata) => void,
  customDeps?: CurriculumListenerDeps
): () => void {
  const resolvedDeps: CurriculumListenerDeps = customDeps || activeListenerDeps || {};
  activeListenerDeps = resolvedDeps;

  const isConfiguredFn = resolvedDeps.isConfigured || isFirebaseConfigured;
  if (!isConfiguredFn()) return () => {};

  curriculumSubscribers.add(onUpdate);
  if (onMetadataUpdate) {
    metadataSubscribers.add(onMetadataUpdate);
  }

  // Deliver memoized curriculum state immediately to new/re-mounted subscribers with 0 extra reads
  if (memoizedCurriculumUpdates) {
    try {
      onUpdate(memoizedCurriculumUpdates);
    } catch {}
  }
  if (memoizedAppMetadata && onMetadataUpdate) {
    try {
      onMetadataUpdate(memoizedAppMetadata);
    } catch {}
  }

  const getStore = resolvedDeps.loadStore || loadUserQuestionsStore;
  const persistStore = resolvedDeps.saveStore || saveUserQuestionsStore;
  const getIdbTree = resolvedDeps.getCachedTree || getCachedCurriculum;
  const saveIdbTree = resolvedDeps.saveCachedTree || saveCachedCurriculum;
  const saveVersionMeta = resolvedDeps.recordLocalVersion || recordLocalCurriculumVersion;
  const loadLocalVersionMeta =
    resolvedDeps.getLocalVersionMeta ||
    (() => getLocalMetadata<AppVersionMetadata>("curriculum_version_meta"));
  const checkVersion = resolvedDeps.checkVersionMatch || checkCurriculumVersionMatch;
  const fetchSwCurriculum = resolvedDeps.fetchSwAsset || fetchCurriculumAssetCacheFirst;
  const warmAssets = resolvedDeps.prewarmAssets || prewarmStaticQuizAssets;
  const clearCacheFn =
    resolvedDeps.clearCache ||
    (async () => {
      const { clearFirestoreCache } = await import("../utils/quotaTracker");
      clearFirestoreCache();
    });

  const enrichTreeWithBundleCounts = (
    chapters: Chapter[] | null,
    topics: Topic[] | null,
    bundles: Array<{ id?: string; topicId?: string; questionCount?: number; questions?: Question[] }>
  ) => {
    if (!bundles || bundles.length === 0) return { chapters, topics, bundleQuestions: [] as Question[] };
    const countMap = new Map<string, number>();
    const qMap = new Map<string, Question>();

    for (const b of bundles) {
      if (!b) continue;
      const rawTopicId = String(
        b.topicId || (typeof b.id === "string" && b.id.startsWith("topic_") ? b.id.slice(6) : b.id) || ""
      ).trim();
      const qArr = Array.isArray(b.questions) ? b.questions : [];
      const qCount = Math.max(qArr.length, Number(b.questionCount) || 0);
      if (rawTopicId && qCount > 0) {
        countMap.set(rawTopicId, Math.max(countMap.get(rawTopicId) || 0, qCount));
      }
      for (const q of qArr) {
        if (q && q.id) {
          qMap.set(q.id, rawTopicId && !q.topicId ? { ...q, topicId: rawTopicId } : q);
        }
      }
    }

    const enrichedTopics = Array.isArray(topics)
      ? topics.map((t) => {
          const bCount = countMap.get(t.id) || 0;
          const embCount = Array.isArray(t.questions) ? t.questions.length : 0;
          const curCount = typeof t.questionCount === "number" ? t.questionCount : 0;
          const bestCount = Math.max(bCount, embCount, curCount);
          return bestCount > 0 ? { ...t, questionCount: bestCount } : t;
        })
      : topics;

    const enrichedChapters = Array.isArray(chapters)
      ? chapters.map((ch) => {
          const chTopics = Array.isArray(ch.topics)
            ? ch.topics.map((t) => {
                const bCount = countMap.get(t.id) || 0;
                const embCount = Array.isArray(t.questions) ? t.questions.length : 0;
                const curCount = typeof t.questionCount === "number" ? t.questionCount : 0;
                const bestCount = Math.max(bCount, embCount, curCount);
                return bestCount > 0 ? { ...t, questionCount: bestCount } : t;
              })
            : ch.topics;
          return { ...ch, topics: chTopics };
        })
      : chapters;

    return {
      chapters: enrichedChapters,
      topics: enrichedTopics,
      bundleQuestions: Array.from(qMap.values()),
    };
  };

  const fetchCollections =
    resolvedDeps.fetchCollectionsFallback ||
    (async (forceBypass: boolean) => {
      const [subsSnap, chsSnap, topsSnap, bundlesSnap] = await Promise.all([
        guardedGetDocs(collection(db, "subjects"), "Background", "Eager Load Subjects", undefined, 45000, forceBypass).catch(() => null),
        guardedGetDocs(collection(db, "chapters"), "Background", "Eager Load Chapters", undefined, 45000, forceBypass).catch(() => null),
        guardedGetDocs(collection(db, "topics"), "Background", "Eager Load Topics", undefined, 45000, forceBypass).catch(() => null),
        guardedGetDocs(collection(db, "question_bundles"), "Background", "Eager Load Topic Bundles", undefined, 45000, forceBypass).catch(() => null),
      ]);
      const rawSubjects = subsSnap ? subsSnap.docs.map((d: any) => ({ ...d.data(), id: d.id } as Subject)) : null;
      const rawChapters = chsSnap ? chsSnap.docs.map((d: any) => ({ ...d.data(), id: d.id } as Chapter)) : null;
      const rawTopics = topsSnap ? topsSnap.docs.map((d: any) => ({ ...d.data(), id: d.id } as Topic)) : null;
      const rawBundles = bundlesSnap ? bundlesSnap.docs.map((d: any) => ({ ...d.data(), id: d.id })) : [];

      const enriched = enrichTreeWithBundleCounts(rawChapters, rawTopics, rawBundles);
      return {
        subjects: rawSubjects,
        chapters: enriched.chapters,
        topics: enriched.topics,
        questions: enriched.bundleQuestions.length > 0 ? enriched.bundleQuestions : null,
      };
    });

  const commitCurriculumTree = async (
    rawSubjects: Subject[] | null,
    rawChapters: Chapter[] | null,
    rawTopics: Topic[] | null,
    remoteMetadata?: AppVersionMetadata | null,
    banners?: any[],
    rawQuestions?: Question[] | null
  ) => {
    const currentStore = getStore();
    const updates: Partial<UserQuestionsStore> = {};

    if (Array.isArray(rawSubjects)) {
      const remoteSubjects = rawSubjects.filter((s: Subject) => !isTestOrMockSubject(s));
      const currentLocal = (currentStore.customSubjects || []).filter((s: Subject) => !isTestOrMockSubject(s));
      updates.customSubjects = reconcileCloudItems(remoteSubjects, currentLocal);
    }
    if (Array.isArray(rawChapters)) {
      const remoteChapters = rawChapters.filter((c: Chapter) => !isTestOrMockChapter(c));
      const currentLocal = (currentStore.customChapters || []).filter((c: Chapter) => !isTestOrMockChapter(c));
      updates.customChapters = reconcileCloudItems(remoteChapters, currentLocal);
    }
    if (Array.isArray(rawTopics)) {
      const remoteTopics = rawTopics.filter((t: Topic) => !isTestOrMockTopic(t));
      const currentLocal = (currentStore.customTopics || []).filter((t: Topic) => !isTestOrMockTopic(t));
      updates.customTopics = reconcileCloudItems(remoteTopics, currentLocal);
    }
    if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
      updates.cloudCacheQuestions = reconcileCloudItems(rawQuestions, currentStore.cloudCacheQuestions || []);
    }

    if (Object.keys(updates).length === 0) return;

    const updatedStore = { ...currentStore, ...updates };
    persistStore(updatedStore);
    broadcastCurriculumUpdates(updates);

    if (Array.isArray(banners) && banners.length > 0 && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("quizpro_banners_v2", JSON.stringify(banners));
      } catch {}
    }

    await saveIdbTree(
      updatedStore.customSubjects || [],
      updatedStore.customChapters || [],
      updatedStore.customTopics || [],
      updatedStore.cloudCacheQuestions || [],
      updatedStore.customQuestions || []
    ).catch(() => {});

    const allThreeSucceeded = Boolean(rawSubjects && rawChapters && rawTopics);
    if (remoteMetadata && allThreeSucceeded) {
      await saveVersionMeta(remoteMetadata).catch(() => {});
    }
  };

  const runCurriculumSync = async (opts?: { forceRemote?: boolean; knownRemoteMeta?: AppVersionMetadata | null }) => {
    try {
      const initialStore = getStore();
      let hasLoadedFromLocal = Boolean(
        (initialStore.customSubjects && initialStore.customSubjects.length > 0) &&
        (initialStore.customChapters && initialStore.customChapters.length > 0) &&
        (initialStore.cloudCacheQuestions && initialStore.cloudCacheQuestions.length > 0)
      );

      // 0. Instant Zero-Read Boot from IndexedDB (curriculum_cache + question_bundles + localforage questionBankCache)
      if (!opts?.forceRemote) {
        try {
          const [cached, cachedBundles, cachedBankQs] = await Promise.all([
            getIdbTree().catch(() => null),
            getAllCachedBundles().catch(() => []),
            getAllCachedQuestions().catch(() => []),
          ]);
          const currentStore = getStore();
          const baseSubs = cached?.subjects?.length
            ? reconcileCloudItems(cached.subjects, currentStore.customSubjects || [])
            : (currentStore.customSubjects || []);
          const baseChaps = cached?.chapters?.length
            ? reconcileCloudItems(cached.chapters, currentStore.customChapters || [])
            : (currentStore.customChapters || []);
          const baseTops = cached?.topics?.length
            ? reconcileCloudItems(cached.topics, currentStore.customTopics || [])
            : (currentStore.customTopics || []);

          const enrichedLocal = enrichTreeWithBundleCounts(baseChaps, baseTops, cachedBundles || []);
          const nextSubs = baseSubs;
          const nextChaps = enrichedLocal.chapters || baseChaps;
          const nextTops = enrichedLocal.topics || baseTops;

          const mergedQsMap = new Map<string, Question>();
          (currentStore.cloudCacheQuestions || []).forEach((q: Question) => {
            if (q && q.id) mergedQsMap.set(q.id, q);
          });
          (cached?.questions || []).forEach((q: Question) => {
            if (q && q.id) mergedQsMap.set(q.id, q);
          });
          (cachedBankQs || []).forEach((q: Question) => {
            if (q && q.id) mergedQsMap.set(q.id, q);
          });
          enrichedLocal.bundleQuestions.forEach((q: Question) => {
            if (q && q.id) mergedQsMap.set(q.id, q);
          });
          const nextQs = Array.from(mergedQsMap.values());

          if (nextSubs.length || nextChaps.length || nextTops.length || nextQs.length) {
            const idbUpdates: Partial<UserQuestionsStore> = {
              customSubjects: nextSubs,
              customChapters: nextChaps,
              customTopics: nextTops,
              cloudCacheQuestions: nextQs,
            };
            persistStore({ ...currentStore, ...idbUpdates });
            broadcastCurriculumUpdates(idbUpdates);
            if (nextSubs.length > 0 && nextQs.length > 0) {
              hasLoadedFromLocal = true;
            }
          }
        } catch {}
      }

      // 1. Version resolution (use knownRemoteMeta from snapshot when available to avoid extra getDoc)
      let isUpToDate = false;
      let remoteVersion = 1;
      let remoteMetadata: AppVersionMetadata | null = opts?.knownRemoteMeta || null;

      if (remoteMetadata) {
        remoteVersion = Number(remoteMetadata.curriculumVersion || 1);
        const localMeta = await loadLocalVersionMeta().catch(() => null);
        const localVersion = Number(localMeta?.curriculumVersion || 0);
        isUpToDate = localVersion >= remoteVersion && localVersion > 0;
        broadcastAppMetadata(remoteMetadata);
      } else {
        const versionCheck = await checkVersion();
        isUpToDate = versionCheck.isUpToDate;
        remoteVersion = versionCheck.remoteVersion;
        remoteMetadata = versionCheck.remoteMetadata;
        if (remoteMetadata) {
          broadcastAppMetadata(remoteMetadata);
        }
      }

      const currentStoreCheck = getStore();
      const existingCount =
        (currentStoreCheck.cloudCacheQuestions?.length || 0) +
        (currentStoreCheck.customQuestions?.length || 0);
      const hasSubjects = (currentStoreCheck.customSubjects?.length || 0) > 0;

      // Purge stale per-topic localStorage caches if remote version updated
      if (!isUpToDate && typeof localStorage !== "undefined") {
        try {
          const staleKeys: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith("quizpro_mcqs_")) {
              staleKeys.push(k);
            }
          }
          staleKeys.forEach((k) => localStorage.removeItem(k));
        } catch {}
      }

      const shouldBypass = Boolean(opts?.forceRemote || !hasSubjects || !isUpToDate);
      if (!shouldBypass && isUpToDate && hasLoadedFromLocal && hasSubjects) {
        memoizedRemoteVersion = Math.max(memoizedRemoteVersion, remoteVersion);
        console.log(`[useFirebaseSync] Curriculum up-to-date (v${remoteVersion}). Local cache: ${existingCount} MCQs. 0 Firestore reads used.`);
        warmAssets(remoteMetadata).catch(() => {});
        return;
      }

      // 1.5. Service Worker Cache-First Static Quiz Asset Fetch (0 Client Firestore Reads)
      const swAsset = await fetchSwCurriculum(remoteVersion || 1, {
        bypassCache: Boolean(opts?.forceRemote),
      }).catch(() => null);

      if (swAsset && (swAsset.subjects.length > 0 || swAsset.chapters.length > 0 || swAsset.topics.length > 0)) {
        await commitCurriculumTree(swAsset.subjects, swAsset.chapters, swAsset.topics, remoteMetadata, swAsset.banners);
        memoizedRemoteVersion = Math.max(memoizedRemoteVersion, remoteVersion);
        warmAssets(remoteMetadata).catch(() => {});
        console.log(
          `[useFirebaseSync] Curriculum loaded via Service Worker ${swAsset.fromSwCache ? "CacheFirst HIT" : "Static Asset"} (v${swAsset.version}) with 0 client Firestore reads.`
        );
        return;
      }

      // 2. Fallback: Fetch consolidated curriculum tree once
      const tree = await fetchCollections(shouldBypass);
      await commitCurriculumTree(tree.subjects, tree.chapters, tree.topics, remoteMetadata, undefined, tree.questions);
      if (tree.subjects && tree.chapters && tree.topics) {
        memoizedRemoteVersion = Math.max(memoizedRemoteVersion, remoteVersion);
      }
    } catch (e) {
      console.warn("[Curriculum Initial Fetch]", e);
    }
  };

  const triggerSync = (opts?: { forceRemote?: boolean; knownRemoteMeta?: AppVersionMetadata | null }) => {
    if (curriculumSyncInFlight && !opts?.forceRemote) {
      return curriculumSyncInFlight;
    }
    const run = runCurriculumSync(opts).finally(() => {
      if (curriculumSyncInFlight === run) {
        curriculumSyncInFlight = null;
        const queued = queuedRemoteSnapshotMeta;
        queuedRemoteSnapshotMeta = null;
        if (queued && Number(queued.curriculumVersion || 0) > memoizedRemoteVersion) {
          Promise.resolve(clearCacheFn())
            .catch(() => {})
            .finally(() => {
              triggerSync({ forceRemote: true, knownRemoteMeta: queued });
            });
        }
      }
    });
    curriculumSyncInFlight = run;
    return run;
  };

  const isAdminUser = isUserAdmin(loadUserProfile());

  // Strict 24-Hour Offline-First Policy:
  // For students, never attach routine real-time listeners on metadata/app_version and never poll Firestore.
  // The central SyncCoordinator handles scheduled 24h sync cycles.
  if (!isAdminUser && !resolvedDeps.subscribeAppVersion) {
    // Deliver instant local tree from IndexedDB to callback immediately
    getIdbTree()
      .then(async (cached) => {
        if (!cached) return;
        const currentStore = getStore();
        const nextSubs = cached.subjects?.length ? cached.subjects : (currentStore.customSubjects || []);
        const nextChaps = cached.chapters?.length ? cached.chapters : (currentStore.customChapters || []);
        const nextTops = cached.topics?.length ? cached.topics : (currentStore.customTopics || []);
        const nextQs = cached.questions?.length ? cached.questions : (currentStore.cloudCacheQuestions || []);
        const updates: Partial<UserQuestionsStore> = {
          customSubjects: nextSubs,
          customChapters: nextChaps,
          customTopics: nextTops,
          cloudCacheQuestions: nextQs,
        };
        broadcastCurriculumUpdates(updates);
      })
      .catch(() => {});

    loadLocalVersionMeta()
      .then((meta) => {
        if (meta && onMetadataUpdate) onMetadataUpdate(meta);
      })
      .catch(() => {});

    return () => {
      curriculumSubscribers.delete(onUpdate);
      if (onMetadataUpdate) {
        metadataSubscribers.delete(onMetadataUpdate);
      }
      if (curriculumSubscribers.size === 0 && activeCurriculumPhysicalUnsub) {
        try {
          activeCurriculumPhysicalUnsub();
        } catch {}
        activeCurriculumPhysicalUnsub = null;
        activeListenerDeps = undefined;
      }
    };
  }

  // Attach ONE physical listener for the entire curriculum tree if none is active yet (Admin only)
  if (!activeCurriculumPhysicalUnsub) {
    const attachListener =
      resolvedDeps.subscribeAppVersion ||
      ((onNext: (snap: any) => void, onError: (err: any) => void) =>
        subscribeSharedListener(
          doc(db, "metadata", "app_version"),
          "Background",
          "1-Read Curriculum Tree Listener",
          onNext,
          onError,
          "Curriculum Sync"
        ));

    triggerSync();

    activeCurriculumPhysicalUnsub = attachListener(
      (snap: any) => {
        if (!snap || !snap.exists || !snap.exists()) return;
        const snapData = snap.data() as (AppVersionMetadata & {
          curriculumTree?: { subjects?: Subject[]; chapters?: Chapter[]; topics?: Topic[] };
          subjects?: Subject[];
          chapters?: Chapter[];
          topics?: Topic[];
        }) | undefined;
        if (!snapData) return;

        const remoteVersion = Number(snapData.curriculumVersion || 1);
        broadcastAppMetadata(snapData);

        // Fast path: if the single snapshot carries an embedded curriculum tree, sync directly with 0 extra reads
        const embeddedSubjects = snapData.curriculumTree?.subjects || snapData.subjects;
        const embeddedChapters = snapData.curriculumTree?.chapters || snapData.chapters;
        const embeddedTopics = snapData.curriculumTree?.topics || snapData.topics;

        if (
          Array.isArray(embeddedSubjects) &&
          Array.isArray(embeddedChapters) &&
          Array.isArray(embeddedTopics)
        ) {
          memoizedRemoteVersion = Math.max(memoizedRemoteVersion, remoteVersion);
          commitCurriculumTree(embeddedSubjects, embeddedChapters, embeddedTopics, snapData).catch(() => {});
          return;
        }

        const currentStore = getStore();
        const hasSubjects = (currentStore.customSubjects?.length || 0) > 0;

        if (curriculumSyncInFlight) {
          if (remoteVersion > memoizedRemoteVersion) {
            queuedRemoteSnapshotMeta = snapData;
          }
          return;
        }
        if (memoizedRemoteVersion >= remoteVersion && hasSubjects) return;

        loadLocalVersionMeta()
          .then((localMeta) => {
            const localVersion = Number(localMeta?.curriculumVersion || 0);
            const isUpToDate = localVersion >= remoteVersion && localVersion > 0 && hasSubjects;
            if (!isUpToDate && !curriculumSyncInFlight) {
              console.log(`[useFirebaseSync] Remote curriculum version v${remoteVersion} detected. Synchronizing curriculum tree...`);
              Promise.resolve(clearCacheFn())
                .catch(() => {})
                .finally(() => {
                  triggerSync({ forceRemote: true, knownRemoteMeta: snapData });
                });
            } else if (isUpToDate) {
              memoizedRemoteVersion = Math.max(memoizedRemoteVersion, remoteVersion);
            }
          })
          .catch(() => {});
      },
      (err: any) => {
        if (err?.code === "permission-denied") {
          console.warn("[Firestore Rule Alert] Ensure 'metadata/app_version' has 'allow read: if true;' in your Firebase Console Rules.");
        } else {
          console.warn("[Firestore] 'app_version' listener notice:", err?.message || err);
        }
      }
    );
  }

  return () => {
    curriculumSubscribers.delete(onUpdate);
    if (onMetadataUpdate) {
      metadataSubscribers.delete(onMetadataUpdate);
    }
    if (curriculumSubscribers.size === 0 && activeCurriculumPhysicalUnsub) {
      try {
        activeCurriculumPhysicalUnsub();
      } catch {}
      activeCurriculumPhysicalUnsub = null;
      activeListenerDeps = undefined;
    }
  };
}

export function useFirebaseSync(
  isAuthenticated: boolean,
  userProfile: UserProfile | null
) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [appMetadata, setAppMetadata] = useState<AppVersionMetadata | null>(() => memoizedAppMetadata);
  const syncLock = useRef(false);
  const lastSyncedProgressRef = useRef<Record<string, string>>({});
  const lastSyncedHistoryRef = useRef<Record<string, string>>({});

  const isWriteAllowed = () => {
    return isFirebaseConfigured();
  };

  const flushBufferedWrites = useCallback(async (trigger: "online_resume" | "app_resume" | "explicit_sync" = "explicit_sync") => {
    if (!auth.currentUser || auth.currentUser.isAnonymous || !isWriteAllowed()) return null;
    try {
      const { flushStudentWriteBuffer } = await import("../utils/studentWriteBuffer");
      const res = await flushStudentWriteBuffer({ trigger, userProfile });
      if (res.flushedOutboxItems > 0) {
        setLastSyncedAt(new Date());
      }
      return res;
    } catch (e) {
      handleSyncError("Buffered Batch Sync", e);
      return null;
    }
  }, [userProfile]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncError(null);
      flushBufferedWrites("online_resume").catch(() => {});
      import("../utils/quotaTracker").then(({ flushPendingWrites }) => {
        flushPendingWrites().catch(() => {});
      }).catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushBufferedWrites]);



  // Auto-migrate local guest data when user logs in with a registered account
  useEffect(() => {
    if (isAuthenticated && auth.currentUser && !auth.currentUser.isAnonymous) {
      import("../utils/guestManager").then(({ migrateGuestDataToCloudOnAuth }) => {
        migrateGuestDataToCloudOnAuth(auth.currentUser!.uid).then(res => {
          if (res.migratedAttempts > 0 || res.migratedProgress > 0) {
            console.log(`[Guest Migration Engine] Successfully transferred ${res.migratedAttempts} attempts and ${res.migratedProgress} progress records to Cloud account.`);
          }
        }).catch(() => {});
      }).catch(() => {});
    }
  }, [isAuthenticated]);

  const handleSyncError = (action: string, error: any) => {
    const isQuotaExceeded =
      error?.code === "resource-exhausted" ||
      error?.message?.includes("Quota limit exceeded") ||
      String(error).includes("resource-exhausted");

    if (isQuotaExceeded) {
      console.warn(`[Firestore Quota Protection] ${action} sync paused (Daily Firestore write quota limit reached). All progress saved locally.`);
      setSyncError("Daily Cloud Quota Limit Reached: All practice progress and data are saved locally on your device!");
      return;
    }

    const isUnavailable =
      error?.code === "unavailable" ||
      (error instanceof Error && (error.message.includes("client is offline") || error.message.includes("unavailable")));

    if (isUnavailable) {
      console.info(`[FirebaseSync] ${action}: Operating offline. Changes preserved in local device cache.`);
      return;
    }

    console.error(`${action} sync failed`, error);
    setSyncError(`Sync failed: ${action}. ${error?.message || "Please check your connection."}`);
  };

  // --- Sync Wrapper with Concurrency Lock ---
  const runWithLock = async (action: () => Promise<void>) => {
    if (syncLock.current) return;
    syncLock.current = true;
    setIsSyncing(true);
    try {
      await action();
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  };

  // --- Real-Time Listeners ---

  const subscribeToCurriculum = useCallback((onUpdate: (data: Partial<UserQuestionsStore>) => void) => {
    return subscribeToMemoizedCurriculumTree(onUpdate, setAppMetadata);
  }, []);


  // --- User Data Sync ---
  const syncSettings = async (settings: AppSettings) => {
    try {
      const { enqueueSyncEvent } = await import("../utils/localDatabaseEngine");
      const uid = auth.currentUser?.uid || "guest";
      await enqueueSyncEvent({
        userId: uid,
        eventType: "settings",
        entityId: "settings",
        operation: "upsert",
        payload: settings,
      });
      setLastSyncedAt(new Date());
    } catch {}
  };

  const syncProgressBatch = async (items: Record<string, any>) => {
    const entries = Object.entries(items || {});
    if (entries.length === 0) return;
    try {
      const { enqueueSyncEvent } = await import("../utils/localDatabaseEngine");
      const uid = auth.currentUser?.uid || "guest";
      for (const [questionId, progress] of entries) {
        await enqueueSyncEvent({
          userId: uid,
          eventType: "attempt",
          entityId: questionId,
          operation: "upsert",
          payload: progress,
        });
      }
      setLastSyncedAt(new Date());
    } catch {}
  };

  const syncHistoryItem = async (date: string, record: any) => {
    try {
      const { enqueueSyncEvent } = await import("../utils/localDatabaseEngine");
      const uid = auth.currentUser?.uid || "guest";
      await enqueueSyncEvent({
        userId: uid,
        eventType: "study_log",
        entityId: date,
        operation: "upsert",
        payload: record,
      });
      setLastSyncedAt(new Date());
    } catch {}
  };

  const loadUserData = async () => {
    if (!auth.currentUser || auth.currentUser.isAnonymous || !isFirebaseConfigured()) return null;
    
    const cacheKey = `quizpro_user_cache_${auth.currentUser.uid}`;
    let cachedResult: any = null;
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        cachedResult = JSON.parse(cachedRaw);
      }
    } catch {}

    if (!navigator.onLine) {
      return cachedResult;
    }

    let result: any = cachedResult;
    console.log(`[DataSync] loadUserData: Local cache progress items: ${Object.keys(cachedResult?.progress || {}).length}`);
    await runWithLock(async () => {
      try {
        const userUid = auth.currentUser!.uid;
        
        // 1. Load Settings (Direct doc fetch with memory cache support)
        const userDoc = await guardedGetDoc(doc(db, "users", userUid), "Student", "Load User Settings").catch(() => null);
        const settings = userDoc && userDoc.exists() ? userDoc.data()?.settings : null;

        // 2. Load Progress and History with Persistent Cache preference
        const [progressDocs, historyDocs] = await Promise.all([
          loadFromCloudWithCache("users/" + userUid + "/progress"),
          loadFromCloudWithCache("users/" + userUid + "/history")
        ]);

        const progress: ProgressStore = {};
        progressDocs.forEach((item: any) => {
          progress[item.id] = item;
          lastSyncedProgressRef.current[item.id] = JSON.stringify(item);
        });
        
        const history: DailyStudyHistory = {};
        historyDocs.forEach((item: any) => {
          history[item.id] = item;
          lastSyncedHistoryRef.current[item.id] = JSON.stringify(item);
        });

        console.log(`[DataSync] loadUserData: Cloud progress items loaded: ${progressDocs.length}`);

        // Preserve any locally buffered uncommitted progress/history from an interrupted session (staging + outbox)
        try {
          const { rehydrateStudentWriteBuffer, getStudentBufferSnapshot, hasPendingStudentWrites } = await import("../utils/studentWriteBuffer");
          await rehydrateStudentWriteBuffer();
          const bufSnap = getStudentBufferSnapshot();
          for (const outItem of bufSnap.outbox || []) {
            Object.entries(outItem.progress || {}).forEach(([qId, localP]) => {
              progress[qId] = progress[qId] ? { ...progress[qId], ...localP } : localP;
            });
            Object.entries(outItem.history || {}).forEach(([dKey, localH]) => {
              history[dKey] = {
                correct: Math.max(history[dKey]?.correct || 0, localH.correct || 0),
                wrong: Math.max(history[dKey]?.wrong || 0, localH.wrong || 0),
              };
            });
          }
          Object.entries(bufSnap.staging.pendingProgress || {}).forEach(([qId, localP]) => {
            progress[qId] = progress[qId] ? { ...progress[qId], ...localP } : localP;
          });
          Object.entries(bufSnap.staging.pendingHistory || {}).forEach(([dKey, localH]) => {
            history[dKey] = {
              correct: Math.max(history[dKey]?.correct || 0, localH.correct || 0),
              wrong: Math.max(history[dKey]?.wrong || 0, localH.wrong || 0),
            };
          });
          if (hasPendingStudentWrites()) {
            flushBufferedWrites("app_resume").catch(() => {});
          }
        } catch {}

        result = { settings, progress, history };
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {}
        setLastSyncedAt(new Date());
      } catch (e: any) {
        console.warn("[Load User Data warning]", e?.message || e);
      }
    });
    return result || cachedResult;
  };

  /**
   * Safe real-time listener for users/{uid}/progress and users/{uid}/history.
   * - Attaches ONLY when an authenticated, non-anonymous user is active.
   * - Processes only `docChanges()` delta events (`added` / `modified`), ignoring `removed` so revision history is never wiped.
   * - Skips local optimistic writes (`doc.metadata.hasPendingWrites === true`) to prevent echo loops.
   * - Updates `lastSyncedProgressRef` and `lastSyncedHistoryRef` signatures BEFORE invoking state callbacks so incoming remote changes never trigger duplicate write-backs.
   */
  const subscribeToUserProgressAndHistory = useCallback(
    (
      _onProgressDelta: (deltas: Record<string, QuestionProgress>) => void,
      _onHistoryDelta: (deltas: DailyStudyHistory) => void
    ) => {
      // 24-Hour Offline-First Policy: Continuous Firestore onSnapshot listeners are disabled.
      // Progress and study history operate 100% locally in IndexedDB and synchronize strictly once per 24 hours.
      return () => {};
    },
    []
  );

  const syncCurriculumStore = async (store: UserQuestionsStore) => {
    const { executeBulkSync } = await import("../utils/bulkSyncService");
    const result = await executeBulkSync(store);
    return result;
  };

  const syncProgressItem = async (questionId: string, progress: any) => {
    try {
      const { enqueueSyncEvent } = await import("../utils/localDatabaseEngine");
      const uid = auth.currentUser?.uid || "guest";
      await enqueueSyncEvent({
        userId: uid,
        eventType: "attempt",
        entityId: questionId,
        operation: "upsert",
        payload: progress,
      });
      setLastSyncedAt(new Date());
    } catch {}
  };

  const syncUserProfile = async (profile: UserProfile) => {
    const { syncUserProfileToCloud } = await import("../utils/firebaseSyncService");
    await syncUserProfileToCloud(profile);
  };

  return {
    isSyncing,
    syncError,
    isOnline,
    lastSyncedAt,
    syncSettings,
    syncProgressItem,
    syncProgressBatch,
    syncHistoryItem,
    syncCurriculumStore,
    syncUserProfile,
    loadUserData,
    flushBufferedWrites,
    subscribeToCurriculum,
    subscribeToUserProgressAndHistory,
    appMetadata
  };
}
