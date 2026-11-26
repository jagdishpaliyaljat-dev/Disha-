import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { generateQuizSchema, generateFAQSchema } from "../src/utils/seo";
import { getCoreStaticEntries, CANONICAL_SITE_URL } from "../src/utils/sitemapGenerator";

describe("Google Search Master SEO Improvements Suite", () => {
  describe("Task 1: Structured Data (Quiz & FAQPage JSON-LD)", () => {
    it("generates valid Schema.org Quiz markup with multiple choice questions", () => {
      const quiz = generateQuizSchema({
        name: "राजस्थान सामान्य ज्ञान महत्वपूर्ण PYQ",
        description: "राजस्थान प्रतियोगी परीक्षाओं के पूर्व वर्ष प्रश्न",
        questions: [
          {
            questionText: "कालीबंगा सभ्यता किस नदी के किनारे स्थित है?",
            options: ["घग्घर", "लूणी", "बनास", "चम्बल"],
            correctAnswer: "घग्घर",
          },
        ],
      });

      expect(quiz["@context"]).toBe("https://schema.org");
      expect(quiz["@type"]).toBe("Quiz");
      expect(quiz.name).toBe("राजस्थान सामान्य ज्ञान महत्वपूर्ण PYQ");
      expect(Array.isArray(quiz.hasPart)).toBe(true);
      expect(quiz.hasPart[0]["@type"]).toBe("Question");
      expect(quiz.hasPart[0].eduQuestionType).toBe("Multiple choice");
      expect(quiz.hasPart[0].acceptedAnswer.text).toBe("घग्घर");
    });

    it("generates valid Schema.org FAQPage markup", () => {
      const faq = generateFAQSchema([
        {
          question: "क्या दिशा 20-20 पर REET के PYQ उपलब्ध हैं?",
          answer: "हाँ, दिशा 20-20 पर REET, RAS, CET के 20,000+ PYQ उपलब्ध हैं।",
        },
      ]);

      expect(faq["@context"]).toBe("https://schema.org");
      expect(faq["@type"]).toBe("FAQPage");
      expect(Array.isArray(faq.mainEntity)).toBe(true);
      expect(faq.mainEntity[0]["@type"]).toBe("Question");
      expect(faq.mainEntity[0].name).toBe("क्या दिशा 20-20 पर REET के PYQ उपलब्ध हैं?");
      expect(faq.mainEntity[0].acceptedAnswer.text).toBe("हाँ, दिशा 20-20 पर REET, RAS, CET के 20,000+ PYQ उपलब्ध हैं।");
    });

    it("verifies index.html embeds Quiz and FAQPage JSON-LD schemas", () => {
      const htmlPath = path.resolve(__dirname, "../index.html");
      const htmlContent = fs.readFileSync(htmlPath, "utf-8");

      expect(htmlContent).toContain('"@type": "Quiz"');
      expect(htmlContent).toContain('"@type": "FAQPage"');
      expect(htmlContent).toContain("EducationalOrganization");
    });
  });

  describe("Task 2: High-Intent Bilingual Meta Tags & Headers", () => {
    it("verifies index.html has bilingual title and high-intent meta tags", () => {
      const htmlPath = path.resolve(__dirname, "../index.html");
      const htmlContent = fs.readFileSync(htmlPath, "utf-8");

      expect(htmlContent).toMatch(/<title>.*दिशा 20-20.*Disha.*<\/title>/);
      expect(htmlContent).toContain("REET");
      expect(htmlContent).toContain("RAS");
      expect(htmlContent).toContain("CET");
      expect(htmlContent).toContain("राजस्थान");
    });
  });

  describe("Task 3: Deep Sitemap URLs for Exams & Topics", () => {
    it("verifies sitemap generator includes deep exam and curriculum paths", () => {
      const entries = getCoreStaticEntries();
      const urls = entries.map((e) => e.loc);

      expect(urls).toContain(`${CANONICAL_SITE_URL}/exam/reet`);
      expect(urls).toContain(`${CANONICAL_SITE_URL}/exam/ras`);
      expect(urls).toContain(`${CANONICAL_SITE_URL}/exam/cet`);
      expect(urls).toContain(`${CANONICAL_SITE_URL}/topics/rajasthan-history`);
      expect(urls).toContain(`${CANONICAL_SITE_URL}/topics/rajasthan-geography`);
      expect(urls).toContain(`${CANONICAL_SITE_URL}/topics/rajasthan-art-culture`);
    });

    it("verifies public/sitemap.xml contains deep exam and subject URLs", () => {
      const sitemapPath = path.resolve(__dirname, "../public/sitemap.xml");
      const sitemapContent = fs.readFileSync(sitemapPath, "utf-8");

      expect(sitemapContent).toContain("https://disha2020.in/exam/reet");
      expect(sitemapContent).toContain("https://disha2020.in/exam/ras");
      expect(sitemapContent).toContain("https://disha2020.in/exam/cet");
      expect(sitemapContent).toContain("https://disha2020.in/topics/rajasthan-history");
    });
  });

  describe("Task 4: Googlebot noscript Crawlable Fallback", () => {
    it("verifies index.html contains comprehensive noscript content for search bots", () => {
      const htmlPath = path.resolve(__dirname, "../index.html");
      const htmlContent = fs.readFileSync(htmlPath, "utf-8");

      expect(htmlContent).toContain("<noscript>");
      expect(htmlContent).toContain("राजस्थान सामान्य ज्ञान");
      expect(htmlContent).toContain("REET");
      expect(htmlContent).toContain("20,000+");
    });
  });
});
