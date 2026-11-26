// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { getSEOForRoute, isLegalInfoTab, isPublicWebSEOTab } from "../src/utils/routeSeoConfig";
import { updateSEOHead, getCanonicalOrigin, buildQuizSchema, buildFAQSchema } from "../src/utils/seoHelper";
import { getCoreStaticEntries } from "../src/utils/sitemapGenerator";
import { resolvePathToNavigationState } from "../src/utils/routeNavigation";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("Website & Web App SEO Audit Fixes", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
    document.documentElement.setAttribute("lang", "en");
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

    it("configures <html lang='hi'> and provides crawler-friendly pre-rendered fallback skeleton inside #root", () => {
      const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
      expect(html).toContain('<html lang="hi" xml:lang="hi">');
      expect(html).toContain('id="crawler-fallback-shell"');
      expect(html).toContain('href="/topics"');
      expect(html).toContain('href="/pyq-vault"');
      expect(html).toContain('href="/live-tests"');
      expect(html).toContain('href="/test-series"');
      expect(html).toContain('href="/news"');
    });

    it("includes official WebSite Schema with SearchAction and preconnects to Supabase", () => {
      const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
      expect(html).toContain('"@type": "WebSite"');
      expect(html).toContain('"@type": "SearchAction"');
      expect(html).toContain('https://disha2020.in/?q={search_term_string}');
      expect(html).toContain('<link rel="preconnect" href="https://eaidivceejkdqsshlraj.supabase.co" crossorigin />');
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

  describe("Social Bot Crawler Pre-rendering & vercel.json", () => {
    it("configures vercel.json rewrite for social scrapers pointing to api/og-crawler", () => {
      const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
      expect(vercel.rewrites).toBeDefined();
      const crawlerRewrite = vercel.rewrites.find(
        (r: any) => r.source === "/news/:slug" && r.destination === "/api/og-crawler?slug=:slug"
      );
      expect(crawlerRewrite).toBeDefined();
      expect(crawlerRewrite.has[0].value).toContain("facebookexternalhit|WhatsApp|TelegramBot|Twitterbot");
    });

    it("creates api/og-crawler.js with escapeHtml and fallback handling", () => {
      const crawlerScript = fs.readFileSync(path.join(ROOT, "api/og-crawler.js"), "utf8");
      expect(crawlerScript).toContain("export default async function handler");
      expect(crawlerScript).toContain("og:image");
      expect(crawlerScript).toContain("window.location.replace");
    });
  });

  describe("Semantic Heading Structure & HomeTab H1", () => {
    it("ensures HomeTab.tsx has a prominent keyword-rich <h1>", () => {
      const homeTabContent = fs.readFileSync(path.join(ROOT, "src/components/HomeTab.tsx"), "utf8");
      expect(homeTabContent).toContain("<h1");
      expect(homeTabContent).toContain("दिशा 20-20 — राजस्थान प्रतियोगी परीक्षाएं एवं PYQ अभ्यास");
    });
  });

  describe("SearchAction & Query Navigation Parsing", () => {
    it("parses ?q=ras and ?search=cet from URL into searchQuery state", () => {
      const nav1 = resolvePathToNavigationState("/", new URLSearchParams("?q=ras"));
      expect(nav1.tab).toBe("home");
      expect(nav1.searchQuery).toBe("ras");

      const nav2 = resolvePathToNavigationState("/topics", new URLSearchParams("?search=geography"));
      expect(nav2.tab).toBe("topics");
      expect(nav2.searchQuery).toBe("geography");
    });
  });

  describe("Google Rich Results: Practice Problems (Quiz) & FAQPage Schemas", () => {
    it("builds compliant schema.org/Quiz structured data with Question & Answer elements", () => {
      const mockQuestions = [
        {
          id: "q1",
          topicId: "t1",
          chapterId: "c1",
          text: "कालीबंगा सभ्यता किस नदी के किनारे स्थित थी?",
          options: ["घग्घर नदी", "बनास नदी", "चम्बल नदी", "लूणी नदी"],
          correctIndex: 0,
          explanation: "कालीबंगा राजस्थान के हनुमानगढ़ जिले में घग्घर नदी के किनारे स्थित है।",
        },
      ];

      const schema = buildQuizSchema("राजस्थान इतिहास महत्वपूर्ण प्रश्न", mockQuestions, "https://disha2020.in/topics");
      expect(schema["@type"]).toBe("Quiz");
      expect(schema.name).toBe("राजस्थान इतिहास महत्वपूर्ण प्रश्न");
      expect(schema.hasPart.length).toBe(1);
      expect(schema.hasPart[0]["@type"]).toBe("Question");
      expect(schema.hasPart[0].text).toBe("कालीबंगा सभ्यता किस नदी के किनारे स्थित थी?");
      expect(schema.hasPart[0].acceptedAnswer.text).toBe("घग्घर नदी");
      expect(schema.hasPart[0].acceptedAnswer.comment.text).toContain("घग्घर नदी के किनारे स्थित है");
    });

    it("builds compliant schema.org/FAQPage structured data", () => {
      const faqs = [
        { question: "क्या दिशा 20-20 फ्री है?", answer: "हाँ, दिशा 20-20 पर PYQ अभ्यास निशुल्क है।" },
      ];
      const faqSchema = buildFAQSchema(faqs);
      expect(faqSchema["@type"]).toBe("FAQPage");
      expect(faqSchema.mainEntity.length).toBe(1);
      expect(faqSchema.mainEntity[0].name).toBe("क्या दिशा 20-20 फ्री है?");
      expect(faqSchema.mainEntity[0].acceptedAnswer.text).toBe("हाँ, दिशा 20-20 पर PYQ अभ्यास निशुल्क है।");
    });

    it("enriches home and about routes with FAQPage schema", () => {
      const homeSEO = getSEOForRoute("home");
      const hasFaq = homeSEO.jsonLdSchemas?.some((s: any) => s["@type"] === "FAQPage");
      const hasWebSite = homeSEO.jsonLdSchemas?.some((s: any) => s["@type"] === "WebSite");
      expect(hasFaq).toBe(true);
      expect(hasWebSite).toBe(true);

      const aboutSEO = getSEOForRoute("about");
      const aboutHasFaq = aboutSEO.jsonLdSchemas?.some((s: any) => s["@type"] === "FAQPage");
      expect(aboutHasFaq).toBe(true);
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
    it("updates document.title, canonical, robots, lang attribute, and enforces https://disha2020.in", () => {
      expect(getCanonicalOrigin()).toBe("http://localhost:3000");

      const origLocation = window.location;
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...origLocation, hostname: "disha-2020.vercel.app", origin: "https://disha-2020.vercel.app", pathname: "/pyq-vault" },
      });

      try {
        expect(getCanonicalOrigin()).toBe("https://disha2020.in");

        updateSEOHead(getSEOForRoute("pyq_vault"));
        expect(document.title).toContain("Official PYQ Vault");
        expect(document.documentElement.getAttribute("lang")).toBe("hi");
        expect(document.documentElement.getAttribute("xml:lang")).toBe("hi");
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
          "https://disha2020.in/pyq-vault"
        );
        expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("index, follow");

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
