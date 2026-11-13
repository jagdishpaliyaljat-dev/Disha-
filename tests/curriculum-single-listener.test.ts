import { describe, test, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  subscribeToMemoizedCurriculumTree,
  __resetCurriculumListenerForTests,
  CurriculumListenerDeps,
} from '../src/hooks/useFirebaseSync';

describe('useFirebaseSync Single Memoized Curriculum Tree Listener', () => {
  beforeEach(() => {
    __resetCurriculumListenerForTests();
  });

  test('Multiple subscribers share a single physical connection, deliver memoized state, and clean up only when last unsubscribes', async () => {
    let listenerAttachments = 0;
    let listenerCleanups = 0;
    let versionCheckCalls = 0;
    let swAssetCalls = 0;
    let fallbackCollectionCalls = 0;
    let emitSnapshot: ((snap: any) => void) | null = null;

    let storeState: any = {
      customSubjects: [],
      customChapters: [],
      customTopics: [],
      cloudCacheQuestions: [],
      customQuestions: [],
    };
    let localMeta: any = null;

    const deps: CurriculumListenerDeps = {
      isConfigured: () => true,
      subscribeAppVersion: (onNext) => {
        listenerAttachments++;
        emitSnapshot = onNext;
        return () => {
          listenerCleanups++;
          emitSnapshot = null;
        };
      },
      getCachedTree: async () => null,
      saveCachedTree: async () => {},
      loadStore: () => storeState,
      saveStore: (next) => {
        storeState = next;
      },
      getLocalVersionMeta: async () => localMeta,
      recordLocalVersion: async (meta) => {
        localMeta = meta;
      },
      checkVersionMatch: async () => {
        versionCheckCalls++;
        return {
          isUpToDate: false,
          remoteVersion: 1,
          localVersion: 0,
          remoteMetadata: { curriculumVersion: 1, lastUpdated: '2026-11-13T00:00:00.000Z' },
        };
      },
      fetchSwAsset: async (v) => {
        swAssetCalls++;
        return {
          version: v,
          subjects: [{ id: 'sub_1', name: `Polity v${v}`, icon: 'Book', color: '#000', chapters: [] } as any],
          chapters: [{ id: 'ch_1', subjectId: 'sub_1', title: `Constitution v${v}`, questions: [] } as any],
          topics: [{ id: 'top_1', chapterId: 'ch_1', subjectId: 'sub_1', title: `Preamble v${v}` } as any],
          banners: [],
          examCategories: [],
          fromSwCache: false,
        };
      },
      fetchCollectionsFallback: async () => {
        fallbackCollectionCalls++;
        return { subjects: [], chapters: [], topics: [] };
      },
      prewarmAssets: async () => {},
      clearCache: () => {},
    };

    const sub1Updates: any[] = [];
    const sub2Updates: any[] = [];
    const metaUpdates: any[] = [];

    const unsub1 = subscribeToMemoizedCurriculumTree((u) => sub1Updates.push(u), (m) => metaUpdates.push(m), deps);
    const unsub2 = subscribeToMemoizedCurriculumTree((u) => sub2Updates.push(u));

    // Wait for async initial tree sync to settle
    await new Promise((r) => setTimeout(r, 30));

    expect(listenerAttachments).toBe(1);
    expect(versionCheckCalls).toBe(1);
    expect(swAssetCalls).toBe(1);
    expect(fallbackCollectionCalls).toBe(0);
    expect(sub1Updates).toHaveLength(1);
    expect(sub2Updates).toHaveLength(1);
    expect(sub1Updates[0].customSubjects[0].name).toBe('Polity v1');
    expect(sub1Updates[0].customChapters[0].title).toBe('Constitution v1');
    expect(sub1Updates[0].customTopics[0].title).toBe('Preamble v1');

    // Late-joining subscriber receives memoized curriculum tree immediately with 0 extra network/listener calls
    const sub3Updates: any[] = [];
    const unsub3 = subscribeToMemoizedCurriculumTree((u) => sub3Updates.push(u));
    expect(listenerAttachments).toBe(1);
    expect(swAssetCalls).toBe(1);
    expect(sub3Updates).toHaveLength(1);
    expect(sub3Updates[0].customTopics[0].id).toBe('top_1');

    // Duplicate v1 snapshot on the single connection is a complete no-op
    emitSnapshot?.({
      exists: () => true,
      data: () => ({ curriculumVersion: 1, lastUpdated: '2026-11-13T00:00:00.000Z' }),
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(swAssetCalls).toBe(1);
    expect(sub1Updates).toHaveLength(1);

    // Embedded curriculumTree snapshot v2 updates all 3 tiers atomically in 0 extra reads
    emitSnapshot?.({
      exists: () => true,
      data: () => ({
        curriculumVersion: 2,
        lastUpdated: '2026-11-13T01:00:00.000Z',
        curriculumTree: {
          subjects: [{ id: 'sub_1', name: 'Polity v2', icon: 'Book', color: '#000', chapters: [] }],
          chapters: [{ id: 'ch_1', subjectId: 'sub_1', title: 'Constitution v2', questions: [] }],
          topics: [{ id: 'top_1', chapterId: 'ch_1', subjectId: 'sub_1', title: 'Preamble v2' }],
        },
      }),
    });
    await new Promise((r) => setTimeout(r, 20));

    expect(swAssetCalls).toBe(1);
    expect(fallbackCollectionCalls).toBe(0);
    expect(sub1Updates).toHaveLength(2);
    expect(sub2Updates).toHaveLength(2);
    expect(sub3Updates).toHaveLength(2);
    expect(sub3Updates[1].customSubjects[0].name).toBe('Polity v2');

    // Version bump v3 without embedded tree syncs once across all subscribers
    emitSnapshot?.({
      exists: () => true,
      data: () => ({ curriculumVersion: 3, lastUpdated: '2026-11-13T02:00:00.000Z' }),
    });
    await new Promise((r) => setTimeout(r, 30));

    expect(swAssetCalls).toBe(2);
    expect(sub1Updates).toHaveLength(3);
    expect(sub1Updates[2].customSubjects[0].name).toBe('Polity v3');
    expect(metaUpdates.some((m) => m.curriculumVersion === 3)).toBe(true);

    // Physical listener remains open until ALL subscribers unsubscribe
    unsub1();
    unsub2();
    expect(listenerCleanups).toBe(0);
    unsub3();
    expect(listenerCleanups).toBe(1);
  });

  test('useFirebaseSync memoizes subscribeToCurriculum with empty deps and uses no collection onSnapshot for curriculum tiers', () => {
    const filePath = path.resolve(process.cwd(), 'src/hooks/useFirebaseSync.ts');
    const src = fs.readFileSync(filePath, 'utf-8');

    // subscribeToCurriculum must be memoized with empty deps [] (never [userProfile])
    expect(src).toMatch(/const subscribeToCurriculum = useCallback\([\s\S]*?\}, \[\]\);/);
    // No separate onSnapshot listeners for subjects, chapters, or topics collections
    expect(src).not.toMatch(/guardedOnSnapshot\(\s*collection\(db,\s*["'](?:subjects|chapters|topics)["']/);
  });
});
