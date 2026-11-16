/**
 * Route & Component Idle Prefetcher for DISHA 20-20
 * Preloads heavy component chunks into browser/Vite cache during idle CPU time.
 * Never blocks the main thread or user interactions.
 */

let prefetchScheduled = false;

export function prefetchCoreRoutes(): void {
  if (prefetchScheduled || typeof window === "undefined") return;
  prefetchScheduled = true;

  const runPrefetch = () => {
    // Stagger module imports using micro-delays to guarantee zero frame drops
    const tasks: Array<() => Promise<any>> = [
      () => import("../components/TopicsTab"),
      () => import("../components/LiveTestsTab"),
      () => import("../components/PYQVaultTab"),
      () => import("../components/ProfileTab"),
      () => import("../components/MCQSessionModal"),
      () => import("../components/ChapterDetailView"),
      () => import("../components/FullExamModal"),
    ];

    let current = 0;
    const executeNext = () => {
      if (current >= tasks.length) return;
      const fn = tasks[current++];
      fn()
        .catch(() => {
          // Non-blocking catch: failure to prefetch does not affect runtime
        })
        .finally(() => {
          if (typeof window !== "undefined") {
            window.setTimeout(executeNext, 300);
          }
        });
    };

    executeNext();
  };

  // Schedule during browser idle time or fallback after initial render
  if (typeof (window as any).requestIdleCallback === "function") {
    (window as any).requestIdleCallback(runPrefetch, { timeout: 3500 });
  } else {
    setTimeout(runPrefetch, 1800);
  }
}
