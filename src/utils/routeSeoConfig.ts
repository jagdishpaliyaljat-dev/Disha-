import { ActiveTab } from "../types";
import { SITE_CONFIG } from "../config/siteConfig";
import { SEOOptions, buildFAQSchema } from "./seoHelper";

export const LEGAL_INFO_TABS: ReadonlySet<ActiveTab> = new Set([
  "about",
  "privacy-policy",
  "terms-of-service",
  "contact",
  "disclaimer",
]);

export const PUBLIC_WEB_SEO_TABS: ReadonlySet<ActiveTab> = new Set([
  "home",
  "topics",
  "pyq_vault",
  "live_tests",
  "test_series",
  "news",
  "about",
  "privacy-policy",
  "terms-of-service",
  "contact",
  "disclaimer",
  "not_found",
]);

export const PRIVATE_NOINDEX_TABS: ReadonlySet<ActiveTab> = new Set([
  "admin",
  "admin_news",
  "profile",
  "wrong",
  "analytics",
  "notifications",
  "analyzer",
  "not_found",
]);

export function isLegalInfoTab(tab: ActiveTab): boolean {
  return LEGAL_INFO_TABS.has(tab);
}

export function isPublicWebSEOTab(tab: ActiveTab): boolean {
  return PUBLIC_WEB_SEO_TABS.has(tab);
}

export interface RouteSEOContext {
  subjectName?: string | null;
  chapterTitle?: string | null;
  articleSlug?: string | null;
}

/**
 * Computes canonical metadata, page title, description, robots directive,
 * and Breadcrumb/WebPage structured data for every route in the app.
 */
export function getSEOForRoute(tab: ActiveTab, context: RouteSEOContext = {}): SEOOptions {
  const domain = SITE_CONFIG.domain;

  if (PRIVATE_NOINDEX_TABS.has(tab)) {
    const labelMap: Partial<Record<ActiveTab, { title: string; path: string; desc: string }>> = {
      admin: {
        title: "Admin Control Panel — Disha PYQ",
        path: "/admin",
        desc: "Administrative dashboard for Disha PYQ question bank and platform operations.",
      },
      admin_news: {
        title: "Editorial News Manager — Disha PYQ",
        path: "/admin/news",
        desc: "Editorial publishing and SEO management console for Disha PYQ.",
      },
      profile: {
        title: "Student Profile & Settings — Disha PYQ",
        path: "/profile",
        desc: "Manage your Disha PYQ account, exam preferences, and cloud sync.",
      },
      wrong: {
        title: "Mistake Bank & Smart Bookmarks — Disha PYQ",
        path: "/wrong",
        desc: "Review bookmarked MCQs and practice your incorrect questions.",
      },
      analytics: {
        title: "Performance Analytics & AI Weakness Report — Disha PYQ",
        path: "/analytics",
        desc: "Detailed exam readiness score, accuracy trends, and AI weakness diagnosis.",
      },
      notifications: {
        title: "Notifications & Alerts — Disha PYQ",
        path: "/notifications",
        desc: "Latest exam reminders and platform notifications.",
      },
      analyzer: {
        title: "Exam Paper Analyzer — Disha PYQ",
        path: "/analyzer",
        desc: "Analyze question papers and extract practice MCQs.",
      },
      not_found: {
        title: "404 Page Not Found — Disha PYQ",
        path: "/404",
        desc: "The requested page could not be found on Disha PYQ.",
      },
    };

    const meta = labelMap[tab] || labelMap.not_found!;
    return {
      title: meta.title,
      description: meta.desc,
      canonicalUrl: `${domain}${meta.path}`,
      noindex: true,
    };
  }

  switch (tab) {
    case "topics": {
      const scope = context.chapterTitle || context.subjectName;
      return {
        title: scope
          ? `${scope} — Topic-wise MCQ Practice | Disha PYQ`
          : "Topic-wise MCQ Practice & Syllabus — RPSC, REET, CET, Patwar | Disha PYQ",
        description: scope
          ? `Practice ${scope} bilingual MCQs and previous year questions with detailed explanations and 1/3rd negative marking simulation on Disha PYQ.`
          : "Explore subject-wise and chapter-wise bilingual MCQs for RPSC RAS, REET, CET, Patwar, Police SI, UPSC, and SSC exams on Disha PYQ.",
        canonicalUrl: `${domain}/topics`,
        keywords: [
          "Topic-wise MCQ practice",
          "Rajasthan GK MCQ",
          "RPSC syllabus quiz",
          "REET CET practice questions",
          scope || "Disha PYQ syllabus",
        ],
        jsonLdSchemas: [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${domain}/` },
              { "@type": "ListItem", position: 2, name: "Topics & Syllabus", item: `${domain}/topics` },
            ],
          },
        ],
      };
    }

    case "pyq_vault":
      return {
        title: "Official PYQ Vault — RPSC RAS, REET, CET, Patwar Previous Year Papers | Disha PYQ",
        description:
          "Attempt authentic official Previous Year Question Papers (PYQs) for RPSC RAS, REET, CET, Patwar, and Police exams with official answer keys and explanations.",
        canonicalUrl: `${domain}/pyq-vault`,
        keywords: [
          "Official PYQ Vault",
          "RAS previous year paper",
          "REET old question papers",
          "CET Rajasthan PYQ",
          "RPSC PYQ MCQ",
        ],
        jsonLdSchemas: [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${domain}/` },
              { "@type": "ListItem", position: 2, name: "Official PYQ Vault", item: `${domain}/pyq-vault` },
            ],
          },
        ],
      };

    case "live_tests":
      return {
        title: "Live Mock Tests & All-Rajasthan Merit Rank | Disha PYQ",
        description:
          "Join real-time Live Mock Tests with 5th Option (E) OMR simulation, 1/3rd negative marking, and instant state rank analysis on Disha PYQ.",
        canonicalUrl: `${domain}/live-tests`,
        keywords: [
          "Live mock test RPSC",
          "Rajasthan online test series",
          "5th option OMR mock test",
          "Disha PYQ live tests",
        ],
        jsonLdSchemas: [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${domain}/` },
              { "@type": "ListItem", position: 2, name: "Live Mock Tests", item: `${domain}/live-tests` },
            ],
          },
        ],
      };

    case "test_series":
      return {
        title: "Structured Competitive Exam Test Series — Disha PYQ",
        description:
          "Practice curated coaching and exam-specific MCQ test series for RAS, CET, REET, Patwar, and SSC on Disha PYQ.",
        canonicalUrl: `${domain}/test-series`,
        keywords: ["Exam Test Series", "RAS Test Series", "REET Mock Series", "Disha PYQ"],
      };

    case "news":
      return {
        title: "Exam News, Economic Survey 2024-25 & Study Guides — Disha PYQ",
        description:
          "Latest Rajasthan & Indian competitive exam updates, Economic Survey 2024-25 notes, admit card alerts, and topper study strategies.",
        canonicalUrl: `${domain}/news`,
        keywords: ["RPSC exam news", "Rajasthan CET 2026", "Economic Survey notes", "Disha PYQ news"],
      };

    case "about":
      return {
        title: "About Disha PYQ — Mission, Exam Coverage & Features",
        description:
          "Learn how Disha PYQ empowers competitive exam aspirants with authentic Previous Year Questions, AI weakness diagnosis, and spaced repetition.",
        canonicalUrl: `${domain}/about`,
        jsonLdSchemas: [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${domain}/` },
              { "@type": "ListItem", position: 2, name: "About Us", item: `${domain}/about` },
            ],
          },
          buildFAQSchema([
            {
              question: "दिशा 20-20 का मुख्य उद्देश्य क्या है?",
              answer: "हमारा उद्देश्य प्रत्येक प्रतियोगी छात्र को पिछले 20 वर्षों के प्रामाणिक प्रश्नों का विषयवार और टॉपिकवार अभ्यास उपलब्ध कराना है।",
            },
            {
              question: "क्या यह ऐप ऑफलाइन काम करती है?",
              answer: "हाँ, दिशा 20-20 एक प्रोग्रेसिव वेब ऐप (PWA) है जो IndexedDB ऑफलाइन कैशे के साथ बिना इंटरनेट भी अभ्यास करने की सुविधा देती है।",
            },
          ]),
        ],
      };

    case "contact":
      return {
        title: "Contact Us & Support — Disha PYQ",
        description:
          "Reach the Disha PYQ support team for exam content feedback, account help, or partnership inquiries.",
        canonicalUrl: `${domain}/contact`,
      };

    case "privacy-policy":
      return {
        title: "Privacy Policy — Disha PYQ",
        description:
          "Read Disha PYQ's Privacy Policy covering Google authentication, encrypted cloud progress sync, and student data protection.",
        canonicalUrl: `${domain}/privacy-policy`,
      };

    case "terms-of-service":
      return {
        title: "Terms of Service — Disha PYQ",
        description:
          "Review the Terms of Service for using Disha PYQ practice tests, PYQ vault, and premium study features.",
        canonicalUrl: `${domain}/terms-of-service`,
      };

    case "disclaimer":
      return {
        title: "Disclaimer & Official Answer Key Notice — Disha PYQ",
        description:
          "Important educational disclaimer regarding competitive exam notifications and official board answer keys on Disha PYQ.",
        canonicalUrl: `${domain}/disclaimer`,
      };

    case "home":
    default:
      return {
        title: "Disha PYQ — Previous Year Questions & Competitive Exam Preparation",
        description:
          "Disha PYQ is a premier competitive-exam MCQ practice platform for Official Previous Year Questions (PYQs), Live Mock Tests, 5th Option OMR simulation, and AI analytics.",
        canonicalUrl: `${domain}/`,
        keywords: [
          "Disha PYQ",
          "Disha 20-20",
          "Previous Year Questions",
          "Rajasthan competitive exams",
          "RAS PYQ",
          "REET MCQs",
          "Patwar mock tests",
        ],
        jsonLdSchemas: [
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": `${domain}/#website`,
            url: `${domain}/`,
            name: "Disha PYQ",
            alternateName: "दिशा PYQ",
            inLanguage: "hi-IN",
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${domain}/?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          },
          buildFAQSchema([
            {
              question: "दिशा 20-20 (Disha PYQ) क्या है?",
              answer: "दिशा 20-20 राजस्थान की सभी प्रतियोगी परीक्षाओं जैसे RPSC RAS, REET, CET, Patwar, Police SI के पिछले वर्षों के प्रश्नों (PYQs) और लाइव टेस्ट का डिजिटल अभ्यास मंच है।",
            },
            {
              question: "क्या दिशा 20-20 पर PYQs का अभ्यास निशुल्क है?",
              answer: "हाँ, दिशा 20-20 पर हजारों पूर्व परीक्षा प्रश्न, विषयवार टेस्ट और विस्तृत हिंदी व्याख्या निशुल्क उपलब्ध हैं।",
            },
            {
              question: "क्या प्रश्नों के साथ 5वां विकल्प (अनुत्तरित प्रश्न) OMR नियम लागू है?",
              answer: "हाँ, RPSC और RSMSSB के नवीनतम नियमों के अनुसार 5वें विकल्प (E) और 1/3 नेगेटिव मार्किंग की सटीक सिमुलेशन प्रदान की जाती है।",
            },
          ]),
        ],
      };
  }
}
