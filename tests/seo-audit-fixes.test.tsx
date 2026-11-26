// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { getSEOForRoute, isLegalInfoTab, isPublicWebSEOTab } from "../src/utils/routeSeoConfig";
import { updateSEOHead, getCanonicalOrigin } from "../src/utils/seoHelper";
import { getCoreStaticEntries } from "../src/utils/sitemapGenerator";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("Website & Web App SEO Audit Fixes", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
  });

  describe("Static index.html, robots.txt, sitemap.xml & og-preview.png", () => {
    it("unifies canonical, OG, Twitter, and JSON-LD URLs to https://disha2020.in without vercel.app leaks", () => {
      const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
      expect(html).not.toContain("disha-2020.vercel.app");
      expect(html).toContain('<link rel="canonical" href="https://disha2020.in/"');
      expect(html).toContain('property="og:url" content="https://disha2020.in/"');
      expect(html).toContain('property="og:image" content="https://disha2020.in/og-preview.png"');
      expect(html).toContain('property="og:image:width" content="1200"');
      expect(html).toContain('property="og:image:height" content="630"');
      expect(html).toContain('https://disha2020.in/pwa-512x512.png');
      expect(html).toContain('https://t.me/disha2020_official');
      expect(html).not.toContain('<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>');
    });

    it("provides a real 1200x630 public/og-preview.png asset", () => {
      const ogPath = path.join(ROOT, "public/og-preview.png");
      expect(fs.existsSync(ogPath)).toBe(true);
      const stat = fs.statSync(ogPath);
      expect(stat.size).toBeGreaterThan(10_000);
    });

    it("configures robots.txt to block private routes and expose canonical sitemap", () => {
      const robots = fs.readFileSync(path.join(ROOT, "public/robots.txt"), "utf8");
      expect(robots).toContain("Disallow: /admin");
      expect(robots).toContain("Disallow: /profile");
      expect(robots).toContain("Disallow: /wrong");
      expect(robots).toContain("Disallow: /analytics");
      expect(robots).toContain("Sitemap: https://disha2020.in/sitemap.xml");
    });

    it("uses canonical kebab-case URLs in public/sitemap.xml and sitemapGenerator", () => {
      const xml = fs.readFileSync(path.join(ROOT, "public/sitemap.xml"), "utf8");
      expect(xml).toContain("https://disha2020.in/pyq-vault");
      expect(xml).toContain("https://disha2020.in/live-tests");
      expect(xml).toContain("https://disha2020.in/test-series");
      expect(xml).not.toContain("pyq_vault");
      expect(xml).not.toContain("live_tests");

      const coreLocs = getCoreStaticEntries().map((e) => e.loc);
      expect(coreLocs).toContain("https://disha2020.in/pyq-vault");
      expect(coreLocs).toContain("https://disha2020.in/live-tests");
      expect(coreLocs).not.toContain("https://disha2020.in/pyq_vault");
    });
  });

  describe("Route Crawlability & Private Auth Boundaries", () => {
    it("allows legal/info tabs universally and public SEO tabs on Web", () => {
      expect(isLegalInfoTab("terms-of-service")).toBe(true);
      expect(isLegalInfoTab("privacy-policy")).toBe(true);
      expect(isLegalInfoTab("about")).toBe(true);
      expect(isLegalInfoTab("home")).toBe(false);

      expect(isPublicWebSEOTab("home")).toBe(true);
      expect(isPublicWebSEOTab("topics")).toBe(true);
      expect(isPublicWebSEOTab("pyq_vault")).toBe(true);
      expect(isPublicWebSEOTab("live_tests")).toBe(true);
      expect(isPublicWebSEOTab("news")).toBe(true);

      // Private user/admin routes remain gated
      expect(isPublicWebSEOTab("admin")).toBe(false);
      expect(isPublicWebSEOTab("profile")).toBe(false);
      expect(isPublicWebSEOTab("wrong")).toBe(false);
      expect(isPublicWebSEOTab("analytics")).toBe(false);
    });
  });

  describe("Dynamic Route SEO Metadata & DOM Injection", () => {
    it("marks private routes and 404 as noindex while enriching public routes with titles & schemas", () => {
      const topicsMeta = getSEOForRoute("topics", { subjectName: "Rajasthan Geography" });
      expect(topicsMeta.title).toContain("Rajasthan Geography");
      expect(topicsMeta.canonicalUrl).toBe("https://disha2020.in/topics");
      expect(topicsMeta.noindex).toBeFalsy();
      expect(topicsMeta.jsonLdSchemas?.length).toBe(1);

      const pyqMeta = getSEOForRoute("pyq_vault");
      expect(pyqMeta.canonicalUrl).toBe("https://disha2020.in/pyq-vault");
      expect(pyqMeta.noindex).toBeFalsy();

      expect(getSEOForRoute("admin").noindex).toBe(true);
      expect(getSEOForRoute("profile").noindex).toBe(true);
      expect(getSEOForRoute("wrong").noindex).toBe(true);
      expect(getSEOForRoute("analytics").noindex).toBe(true);
      expect(getSEOForRoute("not_found").noindex).toBe(true);
    });

    it("updates document.title, canonical, robots, and enforces https://disha2020.in even on vercel.app previews", () => {
      // jsdom defaults to localhost:3000 for local development
      expect(getCanonicalOrigin()).toBe("http://localhost:3000");

      // Simulate preview/production origin (disha-2020.vercel.app) — must normalize to disha2020.in
      const origLocation = window.location;
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...origLocation, hostname: "disha-2020.vercel.app", origin: "https://disha-2020.vercel.app", pathname: "/pyq-vault" },
      });

      try {
        expect(getCanonicalOrigin()).toBe("https://disha2020.in");

        updateSEOHead(getSEOForRoute("pyq_vault"));
        expect(document.title).toContain("Official PYQ Vault");
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
          "https://disha2020.in/pyq-vault"
        );
        expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("index, follow");
        expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
          "https://disha2020.in/og-preview.png"
        );
        expect(document.querySelector('meta[property="og:image:width"]')?.getAttribute("content")).toBe("1200");
        expect(document.querySelector('meta[property="og:image:height"]')?.getAttribute("content")).toBe("630");
        // Duplicate identical hi/en hreflang tags must not be emitted
        expect(document.querySelector('link[rel="alternate"][hreflang="hi"]')).toBeNull();
        expect(document.querySelector('link[rel="alternate"][hreflang="en"]')).toBeNull();

        // Now switch to a private route and ensure noindex applies
        updateSEOHead(getSEOForRoute("profile"));
        expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
        expect(document.querySelector('meta[name="googlebot"]')?.getAttribute("content")).toBe("noindex, nofollow");
      } finally {
        Object.defineProperty(window, "location", {
          configurable: true,
          value: origLocation,
        });
      }
    });
  });
});
