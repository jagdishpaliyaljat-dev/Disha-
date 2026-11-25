import * as React from "react";
import DOMPurify from "dompurify";

interface RawHtmlArticleViewerProps {
  htmlContent: string;
  className?: string;
}

/**
 * RawHtmlArticleViewer
 * 100% Raw HTML/CSS Article Renderer with Editorial Quality Enhancements:
 * - Full fidelity `.rx` styles (Lead, Note, Golden Underline H2, Bullets, Cards, Responsive Tables, Tags)
 * - Seamless Light & Dark mode support
 * - Automatic Touch-Friendly Table Wrapper with horizontal scroll indicator on mobile
 * - Interactive Collapsible FAQ Accordions with Q badges and animated chevrons
 * - Dynamic Schema.org FAQPage JSON-LD injection for instant search engine indexing
 * - Anchor IDs for smooth Table of Contents synchronization
 * - Rigorous DOMPurify Sanitization against XSS
 */
export const RawHtmlArticleViewer: React.FC<RawHtmlArticleViewerProps> = ({
  htmlContent,
  className = "",
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Strictly sanitize untrusted HTML input to prevent Stored XSS
  const sanitizedHtml = React.useMemo(() => {
    if (!htmlContent) return "";
    try {
      const purify = (DOMPurify as any)?.sanitize
        ? DOMPurify
        : (DOMPurify as any)?.default?.sanitize
        ? (DOMPurify as any).default
        : typeof DOMPurify === "function" && typeof window !== "undefined"
        ? (DOMPurify as any)(window)
        : null;

      if (purify && typeof purify.sanitize === "function") {
        return purify.sanitize(htmlContent, {
          ADD_TAGS: ["style"],
          ADD_ATTR: ["target", "rel", "id", "class"],
          FORBID_TAGS: ["script", "iframe", "object", "embed"],
        });
      }
    } catch (e) {
      console.warn("DOMPurify sanitize fallback in RawHtmlArticleViewer:", e);
      return "";
    }
    return "";
  }, [htmlContent]);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const root = containerRef.current;

    // 1. Ensure headings have anchor IDs matching Table of Contents navigation
    const headings = root.querySelectorAll("h2, h3");
    headings.forEach((h, idx) => {
      if (!h.id) {
        h.id = `heading-anchor-${idx}`;
      }
    });


    // 3. Wrap tables into smooth touch-scrolling responsive containers with right-edge fade indicators
    const cleanups: (() => void)[] = [];
    const tables = root.querySelectorAll("table");
    tables.forEach((table) => {
      let scrollContainer: HTMLElement | null = null;
      let fadeIndicator: HTMLElement | null = null;

      const parent = table.parentElement;
      if (parent && parent.classList.contains("scroll")) {
        // Table is inside user's .scroll wrapper
        parent.style.position = "relative";
        scrollContainer = parent;

        let existingFade = parent.querySelector(".rx-table-fade-indicator") as HTMLElement | null;
        if (!existingFade) {
          fadeIndicator = document.createElement("div");
          fadeIndicator.className = "rx-table-fade-indicator";
          parent.appendChild(fadeIndicator);
        } else {
          fadeIndicator = existingFade;
        }
      } else {
        const isAlreadyWrapped =
          parent &&
          (parent.classList.contains("rx-table-scroll-container") ||
            parent.classList.contains("rx-table-inner-scroll") ||
            parent.classList.contains("table-responsive"));

        if (!isAlreadyWrapped) {
          const wrapper = document.createElement("div");
          wrapper.className = "rx-table-scroll-container";

          const hint = document.createElement("div");
          hint.className = "rx-table-scroll-hint";
          hint.innerHTML = `<span>↔</span> Swipe table horizontally`;

          const inner = document.createElement("div");
          inner.className = "rx-table-inner-scroll";

          fadeIndicator = document.createElement("div");
          fadeIndicator.className = "rx-table-fade-indicator";

          table.parentNode?.insertBefore(wrapper, table);
          wrapper.appendChild(hint);
          wrapper.appendChild(inner);
          inner.appendChild(table);
          wrapper.appendChild(fadeIndicator);

          scrollContainer = inner;
        } else if (parent && parent.classList.contains("rx-table-inner-scroll")) {
          scrollContainer = parent;
          const grandParent = parent.parentElement;
          if (grandParent) {
            let existingFade = grandParent.querySelector(".rx-table-fade-indicator") as HTMLElement | null;
            if (!existingFade) {
              fadeIndicator = document.createElement("div");
              fadeIndicator.className = "rx-table-fade-indicator";
              grandParent.appendChild(fadeIndicator);
            } else {
              fadeIndicator = existingFade;
            }
          }
        }
      }

      if (scrollContainer && fadeIndicator) {
        const targetScroll = scrollContainer;
        const targetFade = fadeIndicator;

        const updateFade = () => {
          const isScrollable = targetScroll.scrollWidth > targetScroll.clientWidth;
          const isAtEnd = targetScroll.scrollLeft + targetScroll.clientWidth >= targetScroll.scrollWidth - 6;
          if (!isScrollable || isAtEnd) {
            targetFade.classList.add("is-end");
          } else {
            targetFade.classList.remove("is-end");
          }
        };

        // Initial check
        updateFade();
        targetScroll.addEventListener("scroll", updateFade, { passive: true });
        window.addEventListener("resize", updateFade, { passive: true });

        cleanups.push(() => {
          targetScroll.removeEventListener("scroll", updateFade);
          window.removeEventListener("resize", updateFade);
        });
      }
    });

    // 4. Interactive FAQ Transformation & Schema.org FAQPage Generation
    const extractedFaqs: { question: string; answer: string }[] = [];
    const faqPattern = /faq|अक्सर पूछे|सवाल-जवाब|प्रश्न-उत्तर|प्रश्नोत्तर|frequently asked/i;

    headings.forEach((heading) => {
      const headingText = heading.textContent || "";
      if (faqPattern.test(headingText)) {
        // Collect following sibling cards until next heading or end
        let sibling = heading.nextElementSibling;
        let faqIndex = 0;

        while (sibling && !["H1", "H2", "H3", "H4"].includes(sibling.tagName)) {
          const current = sibling;
          sibling = sibling.nextElementSibling;

          // Check if this node is an FAQ card or contains strong/q pattern
          const isCard = current.classList.contains("card");
          const strongEl = current.querySelector("strong, b");
          const hasQPattern =
            strongEl &&
            /^[प्रQ][\.\:\s]|प्रश्न|सवाल|\?/i.test(strongEl.textContent || "");

          if (isCard || hasQPattern) {
            faqIndex++;
            let question = "";
            let answerHtml = "";

            if (strongEl) {
              question = (strongEl.textContent || "")
                .trim()
                .replace(/^[प्रQ]\.\s*|^\d+[\.\)]\s*/i, "");

              // Get remaining content as answer
              const clone = current.cloneNode(true) as HTMLElement;
              const cloneStrong = clone.querySelector("strong, b");
              if (cloneStrong) cloneStrong.remove();
              // Remove leading <br> or "उ."
              let rawHtmlAnswer = clone.innerHTML.trim();
              rawHtmlAnswer = rawHtmlAnswer
                .replace(/^(<br\s*\/?>|\s|&nbsp;)+/gi, "")
                .replace(/^[उA]\.\s*|^\:+\s*/i, "")
                .trim();
              answerHtml = rawHtmlAnswer;
            } else {
              question = `Question ${faqIndex}`;
              answerHtml = current.innerHTML;
            }

            if (question) {
              extractedFaqs.push({
                question,
                answer: current.textContent?.replace(question, "").replace(/^[उA]\.\s*/i, "").trim() || "",
              });

              // Replace card with interactive accordion element
              current.classList.add("rx-faq-accordion");
              if (faqIndex === 1) {
                current.classList.add("is-open");
              }

              current.innerHTML = `
                <button type="button" class="rx-faq-header" aria-expanded="${faqIndex === 1 ? "true" : "false"}">
                  <span class="rx-faq-header-left">
                    <span class="rx-faq-badge">Q${faqIndex}</span>
                    <span class="rx-faq-q-text">${question}</span>
                  </span>
                  <svg class="rx-faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                <div class="rx-faq-body">
                  ${answerHtml}
                </div>
              `;

              const headerBtn = current.querySelector(".rx-faq-header");
              headerBtn?.addEventListener("click", () => {
                const isOpen = current.classList.toggle("is-open");
                headerBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
              });
            }
          }
        }
      }
    });

    // 5. Interactive Inline MCQ Transformation & Instant Feedback
    const mcqs = root.querySelectorAll(".rx-quiz, .rx-mcq, .mcq-card, [data-quiz]");
    mcqs.forEach((mcq) => {
      const options = mcq.querySelectorAll("li, .option, [data-opt]");
      const expEl = mcq.querySelector(".explanation, .exp, .mcq-exp") as HTMLElement | null;
      const correctVal = (mcq.getAttribute("data-correct") || "").trim().toUpperCase();

      let isAnswered = false;
      options.forEach((opt, idx) => {
        const optLetter = String.fromCharCode(65 + idx); // A, B, C, D, E
        const optEl = opt as HTMLElement;
        optEl.style.cursor = "pointer";

        const handleOptClick = () => {
          if (isAnswered) return;
          isAnswered = true;

          const isMatch =
            correctVal === optLetter ||
            optEl.classList.contains("is-correct") ||
            optEl.getAttribute("data-correct") === "true";

          if (isMatch) {
            optEl.classList.add("mcq-option-correct");
          } else {
            optEl.classList.add("mcq-option-wrong");
            // Highlight the correct option
            options.forEach((o, oIdx) => {
              const l = String.fromCharCode(65 + oIdx);
              if (
                l === correctVal ||
                o.classList.contains("is-correct") ||
                o.getAttribute("data-correct") === "true"
              ) {
                o.classList.add("mcq-option-correct");
              }
            });
          }

          if (expEl) {
            expEl.style.display = "block";
          }
        };

        optEl.addEventListener("click", handleOptClick);
        cleanups.push(() => optEl.removeEventListener("click", handleOptClick));
      });
    });

    // 6. Inject Schema.org FAQPage if FAQs are present
    const SCRIPT_ID = "disha-dynamic-faq-schema";
    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript) existingScript.remove();

    if (extractedFaqs.length > 0) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: extractedFaqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: f.answer,
          },
        })),
      };

      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.type = "application/ld+json";
      script.text = JSON.stringify(faqSchema);
      document.head.appendChild(script);
    }

    return () => {
      cleanups.forEach((c) => c());
      const el = document.getElementById(SCRIPT_ID);
      if (el) el.remove();
    };
  }, [htmlContent]);

  return (
    <div className={`blogger-article-wrapper w-full max-w-full overflow-hidden ${className}`}>
      {/* Universal Responsive & Dark-Mode Styles for HTML Articles */}
      <style>{`
        /* ───────────── BASE RESET & RESPONSIVENESS ───────────── */
        .blogger-raw-html-content {
          font-family: inherit;
          line-height: 1.85;
          color: inherit;
          word-break: break-word;
          overflow-wrap: break-word;
          box-sizing: border-box;
          width: 100%;
          max-width: 100%;
        }
        .blogger-raw-html-content * {
          box-sizing: border-box;
        }
        .blogger-raw-html-content img {
          max-width: 100% !important;
          height: auto !important;
          border-radius: 14px;
          display: inline-block;
          margin: 16px 0;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
        }
        .blogger-raw-html-content iframe {
          max-width: 100% !important;
          border-radius: 14px;
          margin: 16px 0;
        }
        .blogger-raw-html-content pre,
        .blogger-raw-html-content code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          background: rgba(128, 128, 128, 0.1);
          border-radius: 8px;
        }
        .blogger-raw-html-content pre {
          padding: 14px;
          overflow-x: auto;
          max-width: 100%;
        }
        .blogger-raw-html-content a {
          color: #7045D8;
          text-decoration: underline;
          text-underline-offset: 3px;
          font-weight: 600;
        }
        .blogger-raw-html-content a:hover {
          color: #a00028;
        }
        .dark .blogger-raw-html-content a {
          color: #f47b20;
        }

        /* ───────────── FULL-FIDELITY .rx ARTICLE SYSTEM ───────────── */
        .rx {
          font-family: "Noto Sans Devanagari", "Segoe UI", system-ui, -apple-system, sans-serif;
          color: #1e293b;
          line-height: 1.92;
          font-size: 17px;
          letter-spacing: 0.005em;
          max-width: 860px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        .rx p {
          margin: 0 0 1.35em;
          line-height: 1.92;
        }
        .rx strong {
          color: #0b2a63;
          font-weight: 700;
        }
        .rx .lead {
          font-size: 1.08em;
          padding: 18px 22px;
          background: linear-gradient(135deg, #f4f7ff 0%, #ffffff 100%);
          border-left: 5px solid #0b2a63;
          border-radius: 0 14px 14px 0;
          margin: 1.2em 0 1.6em;
          box-shadow: 0 2px 10px rgba(11, 42, 99, 0.04);
          line-height: 1.92;
        }
        .rx h2 {
          font-size: 1.35em;
          color: #0b2a63;
          margin: 2.2em 0 0.8em;
          padding-bottom: 0.4em;
          border-bottom: 2px solid #e2e8f0;
          position: relative;
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .rx h2::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -2px;
          width: 70px;
          height: 2px;
          background: #c8962e;
        }
        .rx h3 {
          font-size: 1.15em;
          color: #1e3a8a;
          margin: 1.6em 0 0.6em;
          font-weight: 700;
        }
        .rx ul {
          padding-left: 0;
          list-style: none;
          margin: 0 0 1.4em;
        }
        .rx li {
          position: relative;
          padding: 10px 0 10px 30px;
          border-bottom: 1px dashed #e2e8f0;
          line-height: 1.85;
        }
        .rx li::before {
          content: "";
          position: absolute;
          left: 6px;
          top: 18px;
          width: 8px;
          height: 8px;
          background: #c8962e;
          border-radius: 50%;
        }
        .rx .card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 18px 22px;
          margin: 1.2em 0;
          box-shadow: 0 4px 16px rgba(11, 42, 99, 0.05);
        }
        .rx .note {
          background: #fffaf0;
          border: 1px solid #f1d9a3;
          border-left: 5px solid #d97706;
          border-radius: 12px;
          padding: 14px 20px;
          margin: 1.2em 0;
          color: #78350f;
          font-size: 0.95em;
          line-height: 1.85;
        }

        /* ───────────── SPECIALIZED EDITORIAL CALLOUT BOXES ───────────── */
        .rx .warning,
        .rx .alert,
        .rx-alert-warning {
          background: #fff8f6;
          border: 1.5px solid #fecdd3;
          border-left: 5px solid #e11d48;
          border-radius: 12px;
          padding: 14px 20px;
          margin: 1.3em 0;
          color: #9f1239;
          font-size: 0.95em;
          line-height: 1.85;
          box-shadow: 0 2px 10px rgba(225, 29, 72, 0.05);
        }
        .rx .warning strong,
        .rx .alert strong,
        .rx-alert-warning strong {
          color: #be123c !important;
        }

        .rx .tip,
        .rx .strategy,
        .rx-alert-tip {
          background: #f0fdf4;
          border: 1.5px solid #bbf7d0;
          border-left: 5px solid #16a34a;
          border-radius: 12px;
          padding: 14px 20px;
          margin: 1.3em 0;
          color: #14532d;
          font-size: 0.95em;
          line-height: 1.85;
          box-shadow: 0 2px 10px rgba(22, 163, 74, 0.05);
        }
        .rx .tip strong,
        .rx .strategy strong,
        .rx-alert-tip strong {
          color: #15803d !important;
        }

        .rx .dates,
        .rx .timeline,
        .rx-alert-dates {
          background: #fefce8;
          border: 1.5px solid #fef08a;
          border-left: 5px solid #ca8a04;
          border-radius: 12px;
          padding: 14px 20px;
          margin: 1.3em 0;
          color: #713f12;
          font-size: 0.95em;
          line-height: 1.85;
          box-shadow: 0 2px 10px rgba(202, 138, 4, 0.05);
        }
        .rx .dates strong,
        .rx .timeline strong,
        .rx-alert-dates strong {
          color: #854d0e !important;
        }

        /* ───────────── AT-A-GLANCE QUICK FACTS BOX ───────────── */
        .rx .quick-facts,
        .rx-quick-facts,
        .rx .summary-box {
          background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
          border: 1.5px solid #cbd5e1;
          border-left: 5px solid #102f65;
          border-radius: 14px;
          padding: 18px 22px;
          margin: 1.5em 0;
          box-shadow: 0 4px 16px rgba(16, 47, 101, 0.06);
        }
        .rx .quick-facts-title {
          font-size: 1.05em;
          font-weight: 800;
          color: #102f65;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .rx .quick-facts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px;
        }
        .rx .quick-facts-item {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 14px;
        }
        .rx .quick-facts-label {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }
        .rx .quick-facts-value {
          font-size: 13.5px;
          font-weight: 800;
          color: #102f65;
          margin-top: 2px;
        }

        /* ───────────── OFFICIAL PDF DOWNLOAD CARD ───────────── */
        .rx .pdf-box,
        .rx .download-box,
        .rx-pdf-download {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px 20px;
          margin: 1.5em 0;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
        }
        @media (min-width: 640px) {
          .rx .pdf-box,
          .rx .download-box,
          .rx-pdf-download {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }
        .rx-pdf-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .rx-pdf-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(128, 0, 32, 0.08);
          color: #7045D8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }
        .rx-pdf-title {
          font-size: 14.5px;
          font-weight: 700;
          color: #1e293b;
        }
        .rx-pdf-meta {
          font-size: 11.5px;
          color: #64748b;
        }
        .rx-pdf-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: #7045D8;
          color: #ffffff !important;
          font-weight: 600;
          font-size: 12.5px;
          padding: 9px 18px;
          border-radius: 10px;
          text-decoration: none !important;
          transition: all 180ms ease;
          box-shadow: 0 2px 6px rgba(128, 0, 32, 0.2);
          white-space: nowrap;
          cursor: pointer;
        }
        .rx-pdf-btn:hover {
          background: #5e0017;
          transform: translateY(-1px);
        }

        /* ───────────── INLINE INTERACTIVE MCQ PRACTICE ───────────── */
        .rx-quiz,
        .rx-mcq,
        .mcq-card {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          padding: 20px 22px;
          margin: 1.6em 0;
          box-shadow: 0 4px 14px rgba(11, 42, 99, 0.05);
        }
        .rx-quiz-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 999px;
          background: rgba(128, 0, 32, 0.08);
          color: #7045D8;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        .rx-quiz-q {
          font-size: 15.5px;
          font-weight: 700;
          color: #0b2a63;
          margin-bottom: 14px;
          line-height: 1.6;
        }
        .rx-quiz ul,
        .rx-mcq ul {
          list-style: none !important;
          padding-left: 0 !important;
          margin: 0 !important;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .rx-quiz li,
        .rx-mcq li {
          position: relative;
          padding: 10px 14px 10px 14px !important;
          border: 1.5px solid #e2e8f0 !important;
          border-radius: 10px !important;
          background: #f8fafc;
          font-size: 14.5px;
          color: #334155;
          cursor: pointer;
          transition: all 180ms ease;
          user-select: none;
        }
        .rx-quiz li:hover,
        .rx-mcq li:hover {
          background: #f1f5f9;
          border-color: #cbd5e1 !important;
        }
        .rx-quiz li::before,
        .rx-mcq li::before {
          display: none !important;
        }
        .rx-quiz li.mcq-option-correct,
        .rx-mcq li.mcq-option-correct {
          background: #ecfdf5 !important;
          border-color: #10b981 !important;
          color: #065f46 !important;
          font-weight: 700;
        }
        .rx-quiz li.mcq-option-wrong,
        .rx-mcq li.mcq-option-wrong {
          background: #fff1f2 !important;
          border-color: #f43f5e !important;
          color: #9f1239 !important;
        }
        .rx-quiz .explanation,
        .rx-mcq .explanation {
          display: none;
          margin-top: 14px;
          padding: 12px 16px;
          border-radius: 10px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          font-size: 13.5px;
          color: #14532d;
          line-height: 1.7;
        }

        /* ───────────── RESPONSIVE TABLES & MOBILE TOUCH SCROLL ───────────── */
        .rx .scroll,
        .rx-table-scroll-container {
          position: relative;
          overflow: hidden;
          margin: 1.4em 0;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
          max-width: 100%;
        }
        .rx-table-inner-scroll,
        .rx .scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          width: 100%;
        }
        .rx-table-fade-indicator {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 28px;
          background: linear-gradient(to right, rgba(255, 255, 255, 0), rgba(16, 47, 101, 0.16));
          pointer-events: none;
          opacity: 1;
          transition: opacity 0.2s ease;
          z-index: 5;
          border-top-right-radius: 14px;
          border-bottom-right-radius: 14px;
        }
        .rx-table-fade-indicator.is-end {
          opacity: 0;
        }
        .rx-table-inner-scroll::-webkit-scrollbar,
        .rx .scroll::-webkit-scrollbar {
          height: 5px;
        }
        .rx-table-inner-scroll::-webkit-scrollbar-track,
        .rx .scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .rx-table-inner-scroll::-webkit-scrollbar-thumb,
        .rx .scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .rx-table-inner-scroll::-webkit-scrollbar-thumb:hover,
        .rx .scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .rx-table-scroll-hint {
          display: none;
          padding: 6px 14px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-align: right;
        }
        @media (max-width: 640px) {
          .rx-table-scroll-hint {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 5px;
          }
        }
        .rx table {
          border-collapse: collapse !important;
          width: 100%;
          min-width: 480px;
          margin: 0 !important;
          display: table;
        }
        .rx th {
          background: #102F65 !important;
          color: #ffffff !important;
          text-align: left;
          padding: 13px 16px;
          font-weight: 700;
          border-bottom: 2px solid #c8962e;
          font-size: 0.92em;
          white-space: nowrap;
        }
        .rx td {
          padding: 12px 16px;
          border-top: 1px solid #e2e8f0;
          font-size: 0.92em;
          vertical-align: top;
          color: #334155;
          word-break: normal;
          overflow-wrap: break-word;
          line-height: 1.6;
        }
        .rx th:first-child,
        .rx td:first-child {
          font-weight: 600;
        }
        .rx tr:nth-child(even) td {
          background: #f8fafc;
        }
        .rx tr:hover td {
          background: #f1f5f9;
        }

        /* ───────────── TAGS ───────────── */
        .rx .tags {
          margin-top: 1.4em;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .rx .tags span {
          display: inline-block;
          background: #eef2ff;
          color: #0b2a63;
          border: 1px solid #d6defc;
          border-radius: 999px;
          padding: 4px 14px;
          font-size: 0.82em;
          font-weight: 600;
        }

        /* ───────────── INTERACTIVE FAQ ACCORDION ───────────── */
        .rx-faq-accordion {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          margin: 12px 0;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(11, 42, 99, 0.04);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .rx-faq-accordion:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 14px rgba(11, 42, 99, 0.07);
        }
        .rx-faq-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 20px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          line-height: 1.5;
        }
        .rx-faq-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }
        .rx-faq-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(11, 42, 99, 0.08);
          color: #0b2a63;
          font-size: 11.5px;
          font-weight: 800;
          flex-shrink: 0;
        }
        .rx-faq-q-text {
          font-size: 15.5px;
          font-weight: 700;
          color: #0b2a63;
        }
        .rx-faq-chevron {
          width: 18px;
          height: 18px;
          color: #64748b;
          transition: transform 0.25s ease;
          flex-shrink: 0;
        }
        .rx-faq-accordion.is-open .rx-faq-chevron {
          transform: rotate(180deg);
          color: #c8962e;
        }
        .rx-faq-body {
          display: none;
          padding: 0 20px 18px 20px;
          font-size: 15px;
          color: #334155;
          line-height: 1.8;
          border-top: 1px dashed rgba(226, 232, 240, 0.8);
          margin-top: 2px;
          padding-top: 14px;
        }
        .rx-faq-accordion.is-open .rx-faq-body {
          display: block;
        }

        /* ───────────── DARK MODE OVERRIDES ───────────── */
        .dark .rx {
          color: #cbd5e1;
        }
        .dark .rx strong {
          color: #93c5fd;
        }
        .dark .rx .lead {
          background: linear-gradient(135deg, #172033 0%, #111723 100%);
          border-left: 5px solid #3b82f6;
          color: #e2e8f0;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
        }
        .dark .rx h2 {
          color: #f8fafc;
          border-bottom: 2px solid #334155;
        }
        .dark .rx h2::after {
          background: #f59e0b;
        }
        .dark .rx h3 {
          color: #93c5fd;
        }
        .dark .rx li {
          border-bottom: 1px dashed #334155;
          color: #cbd5e1;
        }
        .dark .rx li::before {
          background: #f59e0b;
        }
        .dark .rx .card {
          background: #161e2e;
          border-color: #27354f;
          color: #e2e8f0;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }
        .dark .rx .note {
          background: #262015;
          border-color: #574116;
          color: #fef3c7;
        }
        .dark .rx .scroll,
        .dark .rx-table-scroll-container {
          border-color: #27354f;
          background: #121722;
        }
        .dark .rx-table-fade-indicator {
          background: linear-gradient(to right, rgba(18, 23, 34, 0), rgba(0, 0, 0, 0.45));
        }
        .dark .rx-table-inner-scroll::-webkit-scrollbar-track,
        .dark .rx .scroll::-webkit-scrollbar-track {
          background: #161e2e;
        }
        .dark .rx-table-inner-scroll::-webkit-scrollbar-thumb,
        .dark .rx .scroll::-webkit-scrollbar-thumb {
          background: #334155;
        }
        .dark .rx-table-scroll-hint {
          background: #161e2e;
          border-bottom-color: #27354f;
          color: #94a3b8;
        }
        .dark .rx table {
          background: #121722;
        }
        .dark .rx th {
          background: #102F65 !important;
          color: #ffffff !important;
          border-bottom: 2px solid #c8962e;
        }
        .dark .rx td {
          border-top-color: #27354f;
          color: #cbd5e1;
        }
        .dark .rx tr:nth-child(even) td {
          background: #161d2a;
        }
        .dark .rx tr:hover td {
          background: #1b2434;
        }
        .dark .rx .tags span {
          background: #1e293b;
          color: #93c5fd;
          border-color: #334155;
        }
        .dark .rx-faq-accordion {
          background: #161e2e;
          border-color: #27354f;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        }
        .dark .rx-faq-accordion:hover {
          border-color: #3b4a6b;
        }
        .dark .rx-faq-header {
          color: #f1f5f9;
        }
        .dark .rx-faq-badge {
          background: rgba(147, 197, 253, 0.12);
          color: #93c5fd;
        }
        .dark .rx-faq-q-text {
          color: #f1f5f9;
        }
        .dark .rx-faq-chevron {
          color: #94a3b8;
        }
        .dark .rx-faq-accordion.is-open .rx-faq-chevron {
          color: #f59e0b;
        }
        .dark .rx-faq-body {
          color: #cbd5e1;
          border-top-color: #27354f;
        }
        .dark .rx .warning,
        .dark .rx .alert,
        .dark .rx-alert-warning {
          background: #271215;
          border-color: #5c1d24;
          border-left-color: #f43f5e;
          color: #fecdd3;
        }
        .dark .rx .warning strong,
        .dark .rx .alert strong,
        .dark .rx-alert-warning strong {
          color: #fda4af !important;
        }
        .dark .rx .tip,
        .dark .rx .strategy,
        .dark .rx-alert-tip {
          background: #0d2616;
          border-color: #154e27;
          border-left-color: #22c55e;
          color: #bbf7d0;
        }
        .dark .rx .tip strong,
        .dark .rx .strategy strong,
        .dark .rx-alert-tip strong {
          color: #86efac !important;
        }
        .dark .rx .dates,
        .dark .rx .timeline,
        .dark .rx-alert-dates {
          background: #231d09;
          border-color: #57440b;
          border-left-color: #eab308;
          color: #fef08a;
        }
        .dark .rx .dates strong,
        .dark .rx .timeline strong,
        .dark .rx-alert-dates strong {
          color: #fde047 !important;
        }
        .dark .rx .quick-facts,
        .dark .rx-quick-facts,
        .dark .rx .summary-box {
          background: linear-gradient(135deg, #161e2e 0%, #121722 100%);
          border-color: #27354f;
          border-left-color: #3b82f6;
        }
        .dark .rx .quick-facts-title {
          color: #93c5fd;
        }
        .dark .rx .quick-facts-item {
          background: #1a2234;
          border-color: #27354f;
        }
        .dark .rx .quick-facts-value {
          color: #f1f5f9;
        }
        .dark .rx .pdf-box,
        .dark .rx .download-box,
        .dark .rx-pdf-download {
          background: #161e2e;
          border-color: #27354f;
        }
        .dark .rx-pdf-title {
          color: #f8fafc;
        }
        .dark .rx-pdf-meta {
          color: #94a3b8;
        }
        .dark .rx-quiz,
        .dark .rx-mcq,
        .dark .mcq-card {
          background: #161e2e;
          border-color: #27354f;
        }
        .dark .rx-quiz-q {
          color: #f1f5f9;
        }
        .dark .rx-quiz li,
        .dark .rx-mcq li {
          background: #1a2234;
          border-color: #27354f !important;
          color: #cbd5e1;
        }
        .dark .rx-quiz li:hover,
        .dark .rx-mcq li:hover {
          background: #222c42;
        }
        .dark .rx-quiz li.mcq-option-correct,
        .dark .rx-mcq li.mcq-option-correct {
          background: #064e3b !important;
          border-color: #10b981 !important;
          color: #a7f3d0 !important;
        }
        .dark .rx-quiz li.mcq-option-wrong,
        .dark .rx-mcq li.mcq-option-wrong {
          background: #4c0519 !important;
          border-color: #f43f5e !important;
          color: #fecdd3 !important;
        }
        .dark .rx-quiz .explanation,
        .dark .rx-mcq .explanation {
          background: #064e3b;
          border-color: #047857;
          color: #d1fae5;
        }
      `}</style>

      {/* Render HTML with preserved styles and dynamic DOM enhancements */}
      <div
        ref={containerRef}
        className="blogger-raw-html-content w-full max-w-full overflow-hidden"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />

    </div>
  );
};
