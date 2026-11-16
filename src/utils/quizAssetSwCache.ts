import type { AppBanner, Chapter, LiveTest, PYQPaper, Question, Subject, Topic } from '../types';

export const STATIC_QUIZ_DATA_CACHE_NAME = 'static-quiz-data-cache';
export const STATIC_QUIZ_MEDIA_CACHE_NAME = 'static-quiz-media-cache';

const VERSION_CLIENT_TTL_MS = 30 * 1000; // Coalesce/reuse version checks within 30s in the same tab

export interface QuizAssetVersionManifest {
  curriculumVersion: number;
  lastUpdated: string;
  bundleVersions?: Record<string, number>;
  contentDigest?: string;
}

export interface QuizCurriculumAssetPayload {
  version: number;
  subjects: Subject[];
  chapters: Chapter[];
  topics: Topic[];
  banners: AppBanner[];
  examCategories: any[];
  fromSwCache: boolean;
}

let cachedVersionManifest: { data: QuizAssetVersionManifest; expiresAt: number } | null = null;
let versionInFlight: Promise<QuizAssetVersionManifest | null> | null = null;
const assetInFlight = new Map<string, Promise<any>>();

function getCacheStorage(): CacheStorage | null {
  try {
    if (typeof caches !== 'undefined' && caches && typeof caches.open === 'function') {
      return caches;
    }
  } catch {}
  return null;
}

function coalesceAssetRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = assetInFlight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => {
    assetInFlight.delete(key);
  });
  assetInFlight.set(key, promise);
  return promise;
}

async function evictStaleVersionedUrls(prefixPath: string, activeUrl: string): Promise<void> {
  const cs = getCacheStorage();
  if (!cs) return;
  try {
    const cache = await cs.open(STATIC_QUIZ_DATA_CACHE_NAME);
    const keys = await cache.keys();
    for (const req of keys) {
      try {
        const parsed = new URL(req.url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        if (parsed.pathname === prefixPath && parsed.pathname + parsed.search !== activeUrl) {
          await cache.delete(req);
        }
      } catch {}
    }
  } catch {}
}

/**
 * Cache-First fetch helper backed by Service Worker CacheStorage ('static-quiz-data-cache').
 * - Step 1: Check CacheStorage directly for an instant 0-network, 0-Firestore hit.
 * - Step 2: Otherwise perform standard fetch() which the active Service Worker also intercepts
 *   with a Workbox CacheFirst strategy and stores into CacheStorage.
 * - Step 3: Ensure successful HTTP 200 JSON responses are persisted into CacheStorage even before
 *   the Service Worker claims the initial first-visit page.
 */
async function cacheFirstJsonFetch<T>(
  url: string,
  staleEvictPath?: string,
  options?: { bypassCache?: boolean; fetchImpl?: typeof fetch }
): Promise<{ data: T; fromSwCache: boolean } | null> {
  const fetcher = options?.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const cs = getCacheStorage();

  if (!options?.bypassCache && cs) {
    try {
      const cache = await cs.open(STATIC_QUIZ_DATA_CACHE_NAME);
      const cachedResp = await cache.match(url);
      if (cachedResp && cachedResp.ok) {
        const json = (await cachedResp.json()) as T;
        return { data: json, fromSwCache: true };
      }
    } catch {}
  }

  if (!fetcher) return null;
  if (typeof window === 'undefined' && !options?.fetchImpl) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  try {
    const res = await fetcher(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const cloneForCache = res.clone();
    const json = (await res.json()) as T;

    if (cs) {
      try {
        const cache = await cs.open(STATIC_QUIZ_DATA_CACHE_NAME);
        await cache.put(url, cloneForCache);
        if (staleEvictPath) {
          await evictStaleVersionedUrls(staleEvictPath, url);
        }
      } catch {}
    }

    return { data: json, fromSwCache: false };
  } catch {
    return null;
  }
}

export function __resetQuizAssetClientCacheForTests(): void {
  cachedVersionManifest = null;
  versionInFlight = null;
  assetInFlight.clear();
}

/**
 * Fetches lightweight version manifest from /api/quiz-assets/version.
 * Coalesces concurrent callers and caches in-tab for 30s so repeated checks cost 0 extra calls.
 */
export async function fetchQuizAssetVersion(
  forceRefresh = false,
  fetchImpl?: typeof fetch
): Promise<QuizAssetVersionManifest | null> {
  if (!forceRefresh && cachedVersionManifest && Date.now() < cachedVersionManifest.expiresAt) {
    return cachedVersionManifest.data;
  }

  if (versionInFlight && !forceRefresh) {
    return versionInFlight;
  }

  const fetcher = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetcher || (typeof window === 'undefined' && !fetchImpl)) return cachedVersionManifest?.data || null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return cachedVersionManifest?.data || null;
  }

  const run = async (): Promise<QuizAssetVersionManifest | null> => {
    try {
      const url = forceRefresh ? '/api/quiz-assets/version?refresh=1' : '/api/quiz-assets/version';
      const res = await fetcher(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return cachedVersionManifest?.data || null;
      const json = (await res.json()) as any;
      if (!json || typeof json.curriculumVersion !== 'number') {
        return cachedVersionManifest?.data || null;
      }
      const manifest: QuizAssetVersionManifest = {
        curriculumVersion: Number(json.curriculumVersion) || 1,
        lastUpdated: typeof json.lastUpdated === 'string' ? json.lastUpdated : new Date().toISOString(),
        bundleVersions:
          json.bundleVersions && typeof json.bundleVersions === 'object' ? json.bundleVersions : {},
        ...(typeof json.contentDigest === 'string' ? { contentDigest: json.contentDigest } : {}),
      };
      cachedVersionManifest = {
        data: manifest,
        expiresAt: Date.now() + VERSION_CLIENT_TTL_MS,
      };
      return manifest;
    } catch {
      return cachedVersionManifest?.data || null;
    } finally {
      versionInFlight = null;
    }
  };

  versionInFlight = run();
  return versionInFlight;
}

/**
 * Fetch static curriculum tree (subjects, chapters, topics, banners, examCategories)
 * using Service Worker Cache-First strategy keyed by curriculumVersion.
 */
export async function fetchCurriculumAssetCacheFirst(
  version: number,
  options?: { bypassCache?: boolean; fetchImpl?: typeof fetch }
): Promise<QuizCurriculumAssetPayload | null> {
  const v = Math.max(1, Number(version) || 1);
  const path = '/api/quiz-assets/curriculum';
  const url = `${path}?v=${v}`;

  return coalesceAssetRequest(url, async () => {
    const res = await cacheFirstJsonFetch<any>(url, path, options);
    if (!res || !res.data || !res.data.success) return null;
    return {
      version: Number(res.data.version) || v,
      subjects: Array.isArray(res.data.subjects) ? res.data.subjects : [],
      chapters: Array.isArray(res.data.chapters) ? res.data.chapters : [],
      topics: Array.isArray(res.data.topics) ? res.data.topics : [],
      banners: Array.isArray(res.data.banners) ? res.data.banners : [],
      examCategories: Array.isArray(res.data.examCategories) ? res.data.examCategories : [],
      fromSwCache: res.fromSwCache,
    };
  });
}

/**
 * Fetch a topic's Question Bundle using Service Worker Cache-First strategy keyed by bundle version.
 */
export async function fetchTopicBundleAssetCacheFirst(
  topicId: string,
  bundleVersion?: number,
  options?: { bypassCache?: boolean; fetchImpl?: typeof fetch }
): Promise<{ questions: Question[]; version: number; updatedAt: string; contentHash?: string; fromSwCache: boolean } | null> {
  if (!topicId) return null;
  const resolvedVersion =
    Number(bundleVersion) ||
    Number(cachedVersionManifest?.data?.bundleVersions?.[topicId]) ||
    Number(cachedVersionManifest?.data?.curriculumVersion) ||
    1;
  const path = `/api/quiz-assets/bundle/${encodeURIComponent(topicId)}`;
  const url = `${path}?v=${resolvedVersion}`;

  return coalesceAssetRequest(url, async () => {
    const res = await cacheFirstJsonFetch<any>(url, path, options);
    if (!res || !res.data || !res.data.success || !res.data.bundle) return null;
    const bundle = res.data.bundle;
    const questions = Array.isArray(bundle.questions) ? bundle.questions : [];
    return {
      questions,
      version: Number(bundle.version) || resolvedVersion,
      updatedAt: typeof bundle.updatedAt === 'string' ? bundle.updatedAt : new Date().toISOString(),
      ...(typeof bundle.contentHash === 'string' ? { contentHash: bundle.contentHash } : {}),
      fromSwCache: res.fromSwCache,
    };
  });
}

/**
 * Fetch published PYQ Papers using Service Worker Cache-First strategy.
 */
export async function fetchPyqPapersAssetCacheFirst(
  version: number,
  options?: { bypassCache?: boolean; fetchImpl?: typeof fetch }
): Promise<{ papers: PYQPaper[]; fromSwCache: boolean } | null> {
  const v = Math.max(1, Number(version) || 1);
  const path = '/api/quiz-assets/pyq-papers';
  const url = `${path}?v=${v}`;

  return coalesceAssetRequest(url, async () => {
    const res = await cacheFirstJsonFetch<any>(url, path, options);
    if (!res || !res.data || !res.data.success) return null;
    return {
      papers: Array.isArray(res.data.papers) ? res.data.papers : [],
      fromSwCache: res.fromSwCache,
    };
  });
}

/**
 * Fetch sanitized public Live Tests using Service Worker Cache-First strategy.
 */
export async function fetchLiveTestsAssetCacheFirst(
  version: number,
  options?: { bypassCache?: boolean; fetchImpl?: typeof fetch }
): Promise<{ tests: LiveTest[]; fromSwCache: boolean } | null> {
  const v = Math.max(1, Number(version) || 1);
  const path = '/api/quiz-assets/live-tests';
  const url = `${path}?v=${v}`;

  return coalesceAssetRequest(url, async () => {
    const res = await cacheFirstJsonFetch<any>(url, path, options);
    if (!res || !res.data || !res.data.success) return null;
    return {
      tests: Array.isArray(res.data.tests) ? res.data.tests : [],
      fromSwCache: res.fromSwCache,
    };
  });
}

/**
 * Prewarm static quiz assets in background so repeated visits and tab switches hit SW CacheStorage (0 Firestore reads).
 */
export async function prewarmStaticQuizAssets(versionMeta?: QuizAssetVersionManifest | null): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const v = Number(versionMeta?.curriculumVersion || cachedVersionManifest?.data?.curriculumVersion || 0);
  if (!v || v <= 0) return;
  try {
    await Promise.allSettled([
      fetchCurriculumAssetCacheFirst(v),
      fetchPyqPapersAssetCacheFirst(v),
      fetchLiveTestsAssetCacheFirst(v),
    ]);
  } catch {}
}

/**
 * Invalidate local CacheStorage entries and (if an authenticated Admin is signed in)
 * notify the server to clear its in-memory quiz asset cache.
 */
export async function invalidateQuizAssetsClientAndServer(topicIds?: string[]): Promise<void> {
  cachedVersionManifest = null;
  versionInFlight = null;
  assetInFlight.clear();

  const cs = getCacheStorage();
  if (cs) {
    try {
      const cache = await cs.open(STATIC_QUIZ_DATA_CACHE_NAME);
      const keys = await cache.keys();
      const targetTopicPaths = Array.isArray(topicIds) && topicIds.length > 0
        ? new Set(
            topicIds.flatMap((id) => [
              `/api/quiz-assets/bundle/${encodeURIComponent(id)}`,
              `/api/quiz-assets/bundle/${encodeURIComponent(id.replace(/^topic_/, ''))}`,
            ])
          )
        : null;

      for (const req of keys) {
        try {
          const pathname = new URL(req.url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').pathname;
          if (
            pathname === '/api/quiz-assets/curriculum' ||
            pathname === '/api/quiz-assets/pyq-papers' ||
            pathname === '/api/quiz-assets/live-tests' ||
            pathname === '/api/quiz-assets/version' ||
            (pathname.startsWith('/api/quiz-assets/bundle/') && (!targetTopicPaths || targetTopicPaths.has(pathname)))
          ) {
            await cache.delete(req);
          }
        } catch {}
      }
    } catch {}
  }

  try {
    const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
    if (isSupabaseConfigured() && typeof fetch === 'function') {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        await fetch('/api/quiz-assets/invalidate', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(topicIds ? { topicIds } : {}),
        });
      }
    }
  } catch {}
}

/**
 * Diagnostic stats for Service Worker CacheStorage quiz asset caches.
 */
export async function getQuizAssetCacheStats(): Promise<{
  supported: boolean;
  dataEntries: number;
  mediaEntries: number;
}> {
  const cs = getCacheStorage();
  if (!cs) {
    return { supported: false, dataEntries: 0, mediaEntries: 0 };
  }
  try {
    const [dataCache, mediaCache] = await Promise.all([
      cs.open(STATIC_QUIZ_DATA_CACHE_NAME),
      cs.open(STATIC_QUIZ_MEDIA_CACHE_NAME),
    ]);
    const [dataKeys, mediaKeys] = await Promise.all([dataCache.keys(), mediaCache.keys()]);
    return {
      supported: true,
      dataEntries: dataKeys.length,
      mediaEntries: mediaKeys.length,
    };
  } catch {
    return { supported: false, dataEntries: 0, mediaEntries: 0 };
  }
}
