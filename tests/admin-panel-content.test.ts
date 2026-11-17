// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { UserQuestionsStore } from "../src/types";
import {
  isUserAdmin,
  loadUserProfile,
  saveUserProfile,
  clearUserProfile,
} from "../src/utils/userProfileStorage";
import {
  getLocalBanners,
  saveBanner,
  deleteBanner,
  getDeletedBannerIds,
  clearDeletedBannerIds,
  normalizeBanner,
} from "../src/utils/bannerStorage";
import {
  normalizeArticle,
  getLocalArticles,
  saveLocalArticles,
  saveArticleAdmin,
  fetchAllArticlesAdmin,
  fetchArticleByIdAdmin,
  deleteArticleAdmin,
  getDeletedArticleIds,
  addDeletedArticleId,
  clearDeletedArticleIds,
  saveArticleCategory,
  fetchArticleCategories,
  deleteArticleCategory,
  injectInternalLinks,
} from "../src/utils/articleStorage";
import {
  loadNotifications,
  saveNotifications,
  loadNotificationSettings,
  saveNotificationSettings,
  defaultNotificationSettings,
} from "../src/utils/notificationsStorage";
import { generateSlug } from "../src/utils/seoHelper";
import {
  escapeXml,
  formatW3CDate,
  isValidSlug,
  buildSitemapXml,
  getCoreStaticEntries,
  validateSitemap,
} from "../src/utils/sitemapGenerator";
import { ADMIN_EMAILS } from "../src/utils/userProfileStorage";
import fs from "node:fs";
import path from "node:path";

beforeEach(() => {
  localStorage.clear();
  clearUserProfile();
});

afterEach(() => {
  localStorage.clear();
});

describe("Admin Panel — Content, SEO & Wiring", () => {
  describe("1. Banners", () => {
    it("ADM-BAN-01 saveBanner creates with defaults and lists", async () => {
      const id = await saveBanner({ title: "Audit Banner", subtitle: "sub" } as any);
      expect(id).toBeTruthy();
      const list = getLocalBanners();
      expect(list.some((b) => b.id === id)).toBe(true);
      const b = list.find((x) => x.id === id)!;
      expect(b.isActive).toBe(true);
      expect(typeof b.order).toBe("number");
    });

    it("ADM-BAN-02 saveBanner updates existing banner preserving createdAt", async () => {
      const id = await saveBanner({ title: "Original" } as any);
      const original = getLocalBanners().find((b) => b.id === id)!;
      await saveBanner({ id, title: "Updated" } as any);
      const updated = getLocalBanners().find((b) => b.id === id)!;
      expect(updated.title).toBe("Updated");
      expect(updated.createdAt).toBe(original.createdAt);
    });

    it("ADM-BAN-03 deleteBanner removes and records tombstone", async () => {
      const id = await saveBanner({ title: "ToDelete" } as any);
      await deleteBanner(id);
      expect(getLocalBanners().some((b) => b.id === id)).toBe(false);
      expect(getDeletedBannerIds()).toContain(id);
    });

    it("ADM-BAN-04 clearDeletedBannerIds clears tombstones", () => {
      clearDeletedBannerIds();
      expect(getDeletedBannerIds()).toHaveLength(0);
    });

    it("ADM-BAN-05 normalizeBanner upgrades legacy records", () => {
      const legacy = { id: "legacy", priority: 7, actionData: "dashboard", isActive: undefined } as any;
      const n = normalizeBanner(legacy, 2);
      expect(n.order).toBe(7);
      expect(n.actionTab).toBe("dashboard");
      expect(n.isActive).toBe(true);
    });

    it("ADM-BAN-06 toggle active via saveBanner", async () => {
      const id = await saveBanner({ title: "Toggle", isActive: true } as any);
      await saveBanner({ id, isActive: false } as any);
      const b = getLocalBanners().find((x) => x.id === id)!;
      expect(b.isActive).toBe(false);
    });
  });

  describe("2. Articles", () => {
    it("ADM-ART-01 normalizeArticle upgrades legacy blocks", () => {
      const raw = {
        id: "art_legacy",
        title: "Legacy Article",
        blocks: [{ type: "h3", text: "Heading" }, { type: "keytakeaways", takeaways: ["a", "b"] }],
      };
      const art = normalizeArticle(raw);
      expect(art.blocks).toHaveLength(2);
      expect(art.blocks![0].type).toBe("heading");
      expect(art.blocks![0].level).toBe(3);
      expect(art.blocks![1].type).toBe("key_points");
      expect(art.blocks![1].listItems).toEqual(["a", "b"]);
    });

    it("ADM-ART-02 normalizeArticle drops unknown block types to paragraph", () => {
      const art = normalizeArticle({ id: "a", title: "T", blocks: [{ type: "weird", text: "x" }] });
      expect(art.blocks![0].type).toBe("paragraph");
    });

    it("ADM-ART-03 saveArticleAdmin requires admin privilege", async () => {
      clearUserProfile();
      saveUserProfile({ id: "stu", name: "Stu", email: "student@example.com", role: "student" } as any);
      await expect(saveArticleAdmin({ title: "X" } as any)).rejects.toThrow(/Unauthorized/i);
    });

    it("ADM-ART-04 saveArticleAdmin creates article with slug + seo", async () => {
      saveUserProfile({ id: "admin1", name: "Admin", email: ADMIN_EMAILS[0], role: "student" } as any);
      const art = await saveArticleAdmin({ title: "Rajasthan History Guide", content: "<p>Hello world</p>" } as any);
      expect(art.id).toBeTruthy();
      expect(art.slug).toBeTruthy();
      expect(art.seoTitle).toBe("Rajasthan History Guide");
      expect(art.seoDescription).toContain("Hello world");
      expect(getLocalArticles().some((a) => a.id === art.id)).toBe(true);
    });

    it("ADM-ART-05 saveArticleAdmin enforces unique slug", async () => {
      saveUserProfile({ id: "admin1", name: "Admin", email: ADMIN_EMAILS[0], role: "student" } as any);
      const a1 = await saveArticleAdmin({ title: "Same Title", slug: "same-title" } as any);
      const a2 = await saveArticleAdmin({ title: "Same Title", slug: "same-title" } as any);
      expect(a1.slug).toBe("same-title");
      expect(a2.slug).not.toBe("same-title");
    });

    it("ADM-ART-06 fetchAllArticlesAdmin/fetchArticleByIdAdmin require admin", async () => {
      clearUserProfile();
      saveUserProfile({ id: "stu", name: "Stu", email: "student@example.com", role: "student" } as any);
      await expect(fetchAllArticlesAdmin()).rejects.toThrow(/Unauthorized/i);
      await expect(fetchArticleByIdAdmin("x")).rejects.toThrow(/Unauthorized/i);
    });

    it("ADM-ART-07 deleteArticleAdmin removes and records tombstone", async () => {
      saveUserProfile({ id: "admin1", name: "Admin", email: ADMIN_EMAILS[0], role: "student" } as any);
      const art = await saveArticleAdmin({ title: "ToDelete Article" } as any);
      await deleteArticleAdmin(art.id);
      expect(getLocalArticles().some((a) => a.id === art.id)).toBe(false);
      expect(getDeletedArticleIds()).toContain(art.id);
    });

    it("ADM-ART-08 clearDeletedArticleIds clears", () => {
      addDeletedArticleId("x");
      expect(getDeletedArticleIds()).toContain("x");
      clearDeletedArticleIds();
      expect(getDeletedArticleIds()).not.toContain("x");
    });

    it("ADM-ART-09 article categories add/delete dedupe", async () => {
      saveUserProfile({ id: "admin1", name: "Admin", email: ADMIN_EMAILS[0], role: "student" } as any);
      const c1 = await saveArticleCategory("Exam Notification");
      expect(c1).toContain("Exam Notification");
      const c2 = await saveArticleCategory("Exam Notification");
      expect(c2.filter((c) => c === "Exam Notification")).toHaveLength(1);
      const c3 = await deleteArticleCategory("Exam Notification");
      expect(c3).not.toContain("Exam Notification");
    });

    it("ADM-ART-10 injectInternalLinks adds links for known terms", () => {
      const out = injectInternalLinks("Read about Rajasthan history and RAS exam.");
      expect(typeof out).toBe("string");
    });
  });

  describe("3. SEO & Sitemap", () => {
    it("ADM-SEO-01 generateSlug normalizes title", () => {
      expect(generateSlug("Rajasthan History: 2024!!")).toBe("rajasthan-history-2024");
    });

    it("ADM-SEO-02 escapeXml escapes special chars", () => {
      expect(escapeXml("<a>&b")).toBe("&lt;a&gt;&amp;b");
    });

    it("ADM-SEO-03 formatW3CDate returns ISO date", () => {
      expect(formatW3CDate("2024-01-15T10:00:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("ADM-SEO-04 isValidSlug validates", () => {
      expect(isValidSlug("rajasthan-history")).toBe(true);
      expect(isValidSlug("Bad Slug!")).toBe(false);
      expect(isValidSlug("")).toBe(false);
    });

    it("ADM-SEO-05 buildSitemapXml produces valid XML with urls", () => {
      const xml = buildSitemapXml([
        { loc: "https://disha2020.in/", lastmod: "2024-01-01", changefreq: "daily", priority: 1 },
      ]);
      expect(xml).toContain("<urlset");
      expect(xml).toContain("<loc>https://disha2020.in/</loc>");
    });

    it("ADM-SEO-06 validateSitemap accepts generated xml", () => {
      const xml = buildSitemapXml(getCoreStaticEntries().slice(0, 3));
      const res = validateSitemap(xml);
      expect(res.valid).toBe(true);
      expect(res.urlCount).toBeGreaterThan(0);
    });

    it("ADM-SEO-07 getCoreStaticEntries returns non-empty", () => {
      expect(getCoreStaticEntries().length).toBeGreaterThan(0);
    });
  });

  describe("4. Notifications", () => {
    it("ADM-NOTIF-01 loadNotifications defaults to empty", () => {
      expect(loadNotifications()).toEqual([]);
    });

    it("ADM-NOTIF-02 save/load roundtrip", () => {
      const n = [{ id: "n1", title: "T", message: "M", category: "exam", priority: "normal", timestamp: new Date().toISOString(), read: false }] as any;
      saveNotifications(n);
      expect(loadNotifications()).toHaveLength(1);
    });

    it("ADM-NOTIF-03 settings defaults + roundtrip", () => {
      expect(loadNotificationSettings()).toEqual(defaultNotificationSettings);
      saveNotificationSettings({ ...defaultNotificationSettings, studyReminders: false, reminderTime: "09:00" });
      const s = loadNotificationSettings();
      expect(s.studyReminders).toBe(false);
      expect(s.reminderTime).toBe("09:00");
    });
  });

  describe("5. Admin Wiring Audit", () => {
    it("ADM-WIRE-01 every adminSafeLazy module exports its declared symbol", () => {
      const adminDir = path.resolve(process.cwd(), "src/components/admin");
      const src = fs.readFileSync(path.resolve(process.cwd(), "src/components/AdminTab.tsx"), "utf8");
      const re = /adminSafeLazy<any>\(\(\) => import\("\.\/admin\/([^"]+)"\),\s*"([^"]+)"\)/g;
      const matches = [...src.matchAll(re)];
      expect(matches.length).toBeGreaterThan(20);
      for (const m of matches) {
        const file = m[1];
        const symbol = m[2];
        const full = path.join(adminDir, `${file}.tsx`);
        expect(fs.existsSync(full), `missing file ${file}`).toBe(true);
        const content = fs.readFileSync(full, "utf8");
        const hasExport = new RegExp(`export (const|function) ${symbol}\\b`).test(content) ||
          new RegExp(`export \\{[^}]*\\b${symbol}\\b[^}]*\\}`).test(content);
        expect(hasExport, `${file} does not export ${symbol}`).toBe(true);
      }
    });

    it("ADM-WIRE-02 every AdminGroupSection id has a render branch", () => {
      const src = fs.readFileSync(path.resolve(process.cwd(), "src/components/AdminTab.tsx"), "utf8");
      const ids = ["dashboard", "syllabus", "questions", "tests", "content", "users", "supabase", "integrations", "backup", "settings", "diagnostics"];
      for (const id of ids) {
        expect(src.includes(`activeGroup === "${id}"`), `no render branch for ${id}`).toBe(true);
      }
    });

    it("ADM-WIRE-03 QATestRunnerModal and AdminErrorBoundary files exist", () => {
      expect(fs.existsSync(path.resolve(process.cwd(), "src/components/QATestRunnerModal.tsx"))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), "src/components/admin/AdminErrorBoundary.tsx"))).toBe(true);
    });
  });
});
