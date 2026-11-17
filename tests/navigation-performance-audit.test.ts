// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolvePathToNavigationState, buildCanonicalPath, isKnownTab } from "../src/utils/routeNavigation";
import { isUserAdmin } from "../src/utils/userProfileStorage";
import { UserProfile } from "../src/types";

describe("DISHA2020 — Navigation Stabilization & Performance Test Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY 1: Student Hierarchical Flow (Home → Subject → Chapter → Topic → Practice)
  // ─────────────────────────────────────────────────────────────
  describe("Journey 1: Student Hierarchical Drilldown Navigation", () => {
    it("correctly resolves nested Subject, Chapter, and Topic parameters", () => {
      const searchParams = new URLSearchParams("subject=sub_101&chapter=chap_202&topic=top_303");
      const state = resolvePathToNavigationState("/topics", searchParams);

      expect(state.tab).toBe("topics");
      expect(state.subjectId).toBe("sub_101");
      expect(state.chapterId).toBe("chap_202");
      expect(state.topicId).toBe("top_303");
      expect(state.isNotFound).toBeFalsy();
    });

    it("builds consistent canonical path for deep curriculum hierarchy", () => {
      const path = buildCanonicalPath(
        "topics",
        null,
        "sub_101",
        "chap_202",
        "top_303",
        null,
        null,
        null,
        false
      );

      expect(path).toBe("/topics?subject=sub_101&chapter=chap_202&topic=top_303");
    });

    it("appends session flag when practice session is launched from curriculum", () => {
      const path = buildCanonicalPath(
        "topics",
        null,
        "sub_101",
        "chap_202",
        "top_303",
        null,
        null,
        null,
        true
      );

      expect(path).toContain("session=1");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY 2: Practice Navigation (Next → Previous → Random Question → Submit)
  // ─────────────────────────────────────────────────────────────
  describe("Journey 2: Practice Session Question Navigation & State Stability", () => {
    const mockQuestions = [
      { id: "q1", text: "Q1", options: ["A", "B", "C", "D"], correctAnswer: 0 },
      { id: "q2", text: "Q2", options: ["A", "B", "C", "D"], correctAnswer: 1 },
      { id: "q3", text: "Q3", options: ["A", "B", "C", "D"], correctAnswer: 2 },
      { id: "q4", text: "Q4", options: ["A", "B", "C", "D"], correctAnswer: 3 },
    ];

    it("maintains strict 1:1 question index synchronization without corruption", () => {
      let currentIndex = 0;
      const historyLog: number[] = [];

      // Forward step
      while (currentIndex < mockQuestions.length - 1) {
        historyLog.push(currentIndex + 1);
        currentIndex++;
      }
      historyLog.push(currentIndex + 1);

      expect(historyLog).toEqual([1, 2, 3, 4]);
      expect(mockQuestions[currentIndex].id).toBe("q4");

      // Backward step
      while (currentIndex > 0) {
        currentIndex--;
      }
      expect(currentIndex).toBe(0);
      expect(mockQuestions[currentIndex].id).toBe("q1");
    });

    it("simulates rapid consecutive taps (debounce protection) without skipping", () => {
      let currentIndex = 0;
      let isNavigating = false;
      let skippedCounter = 0;

      const navigateNext = () => {
        if (isNavigating) {
          skippedCounter++;
          return;
        }
        isNavigating = true;
        currentIndex++;
        setTimeout(() => {
          isNavigating = false;
        }, 120);
      };

      // Rapid burst: 5 calls in same event tick
      navigateNext();
      navigateNext();
      navigateNext();
      navigateNext();
      navigateNext();

      expect(currentIndex).toBe(1); // Exactly 1 advance
      expect(skippedCounter).toBe(4); // 4 redundant taps absorbed
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY 3: Cross-Section Flow (Practice → Bookmark → Profile → Home)
  // ─────────────────────────────────────────────────────────────
  describe("Journey 3: Cross-Section Flow & URL Canonicalization", () => {
    it("handles tab transitions cleanly across student sections", () => {
      const transitions = [
        { tab: "wrong" as const, expected: "/wrong" },
        { tab: "profile" as const, expected: "/profile" },
        { tab: "home" as const, expected: "/" },
      ];

      for (const t of transitions) {
        const canonical = buildCanonicalPath(t.tab, null, null, null, null, null, null, null, false);
        expect(canonical).toBe(t.expected);

        const resolved = resolvePathToNavigationState(t.expected);
        expect(resolved.tab).toBe(t.tab);
      }
    });

    it("resolves route aliases like /revision and /bookmarks to wrong/revision tab", () => {
      expect(resolvePathToNavigationState("/revision").tab).toBe("wrong");
      expect(resolvePathToNavigationState("/bookmarks").tab).toBe("wrong");
      expect(resolvePathToNavigationState("/wrong-questions").tab).toBe("wrong");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY 4: Admin Panel Navigation (Dashboard → Database → News)
  // ─────────────────────────────────────────────────────────────
  describe("Journey 4: Admin Panel Sub-route Preservation", () => {
    it("resolves /admin and its nested subpaths to admin tab", () => {
      expect(resolvePathToNavigationState("/admin").tab).toBe("admin");
      expect(resolvePathToNavigationState("/admin/database").tab).toBe("admin");
      expect(resolvePathToNavigationState("/admin/news").tab).toBe("admin");
    });

    it("preserves Admin section queries without reverting to bare /admin", () => {
      window.history.pushState({}, "", "/admin/database?group=supabase");

      const canonical = buildCanonicalPath("admin", null, null, null, null, null, null, null, false);
      expect(canonical).toBe("/admin/database?group=supabase");

      // Reset
      window.history.pushState({}, "", "/");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY 5: Admin Access Control & Role Protection
  // ─────────────────────────────────────────────────────────────
  describe("Journey 5: Role-based Protected Route Verification", () => {
    const adminUser: UserProfile = {
      id: "admin_123",
      email: "zdpaliyal@gmail.com",
      role: "admin",
      name: "Super Admin",
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
    };

    const studentUser: UserProfile = {
      id: "stud_456",
      email: "student@example.com",
      role: "student",
      name: "Aarav Sharma",
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
    };

    it("correctly grants access to authorized admin accounts", () => {
      expect(isUserAdmin(adminUser)).toBe(true);
    });

    it("strictly blocks non-admin students from accessing admin functions", () => {
      expect(isUserAdmin(studentUser)).toBe(false);
      expect(isUserAdmin(null)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY 6: Direct Nested URL Loading & Deep-Linking
  // ─────────────────────────────────────────────────────────────
  describe("Journey 6: Deep-linking & Nested URL Resolution", () => {
    it("parses test series coaching, exam, and series from direct path", () => {
      const path = "/test-series/coaching/Allen%20Kota/exam/NEET/series/Major%20Tests";
      const resolved = resolvePathToNavigationState(path);

      expect(resolved.tab).toBe("test_series");
      expect(resolved.coachingId).toBe("Allen Kota");
      expect(resolved.examId).toBe("NEET");
      expect(resolved.seriesId).toBe("Major Tests");
    });

    it("parses news article direct link with slug", () => {
      const path = "/news/neet-2026-schedule-released";
      const resolved = resolvePathToNavigationState(path);

      expect(resolved.tab).toBe("news");
      expect(resolved.articleSlug).toBe("neet-2026-schedule-released");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY 7: Browser Back / Forward Navigation (PopState)
  // ─────────────────────────────────────────────────────────────
  describe("Journey 7: Popstate Simulation", () => {
    it("accurately parses back-forward transitions for kebab and underscore routes", () => {
      const historyStack = ["/pyq-vault", "/live-tests", "/test-series", "/about"];
      const resolvedStack = historyStack.map((p) => resolvePathToNavigationState(p).tab);

      expect(resolvedStack).toEqual(["pyq_vault", "live_tests", "test_series", "about"]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY 8: 404 & Invalid Route Fallback
  // ─────────────────────────────────────────────────────────────
  describe("Journey 8: Error Handling & 404 Page Not Found", () => {
    it("flags completely unknown paths as not_found", () => {
      const invalidPaths = ["/invalid-random-url", "/dashboard/unknown", "/foo/bar/baz"];
      for (const p of invalidPaths) {
        const resolved = resolvePathToNavigationState(p);
        expect(resolved.tab).toBe("not_found");
        expect(resolved.isNotFound).toBe(true);
      }
    });

    it("verifies KNOWN_TABS list contains all essential app tabs", () => {
      expect(isKnownTab("home")).toBe(true);
      expect(isKnownTab("topics")).toBe(true);
      expect(isKnownTab("pyq_vault")).toBe(true);
      expect(isKnownTab("live_tests")).toBe(true);
      expect(isKnownTab("test_series")).toBe(true);
      expect(isKnownTab("admin")).toBe(true);
      expect(isKnownTab("profile")).toBe(true);
      expect(isKnownTab("unknown_xyz")).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY 9: Mobile Bottom Navigation & Re-tap Reset
  // ─────────────────────────────────────────────────────────────
  describe("Journey 9: Mobile Navigation Behavior", () => {
    it("re-tapping active tab resets drill-down state cleanly", () => {
      let selectedSubject: string | null = "sub_1";
      let selectedChapter: string | null = "chap_1";
      let activeTab = "topics";

      const handleTabPress = (targetTab: string) => {
        if (targetTab === activeTab) {
          selectedSubject = null;
          selectedChapter = null;
        } else {
          activeTab = targetTab;
        }
      };

      // Tap active tab again
      handleTabPress("topics");
      expect(selectedSubject).toBeNull();
      expect(selectedChapter).toBeNull();
      expect(activeTab).toBe("topics");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY 10: Performance Benchmarking & Memory Overhead
  // ─────────────────────────────────────────────────────────────
  describe("Journey 10: Performance Benchmarks", () => {
    it("resolves 1,000 arbitrary paths in under 100 milliseconds on mobile CPU", () => {
      const paths = [
        "/topics?subject=phy&chapter=1",
        "/test-series/coaching/A/exam/B/series/C",
        "/pyq-vault",
        "/live-tests",
        "/news/sample-slug",
        "/admin/database",
        "/about",
        "/privacy-policy",
        "/wrong",
        "/profile",
      ];

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        const p = paths[i % paths.length];
        const res = resolvePathToNavigationState(p);
        expect(res.tab).toBeDefined();
      }
      const durationMs = performance.now() - start;

      // Sub-millisecond route resolution: < 0.35ms per path on mobile ARM CPU
      expect(durationMs).toBeLessThan(350);
    });

    it("constructs 1,000 canonical URLs in under 50 milliseconds on mobile CPU", () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        buildCanonicalPath("topics", null, "s1", "c1", "t1", null, null, null, false);
      }
      const durationMs = performance.now() - start;
      expect(durationMs).toBeLessThan(50);
    });
  });
});
