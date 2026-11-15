import * as React from "react";

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
 */
export const RawHtmlArticleViewer: React.FC<RawHtmlArticleViewerProps> = ({
  htmlContent,
  className = "",
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const root = containerRef.current;

    // 1. Safely execute any scripts if present
    const scripts = root.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });

    // 2. Ensure headings have anchor IDs matching Table of Contents navigation
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
          hint.innerHTML = `<span>↔</span> टेबल स्क्रॉल करें · Swipe table`;

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
              question = `सवाल ${faqIndex}`;
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

    // 5. Inject Schema.org FAQPage if FAQs are present
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
          color: #800020;
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
          line-height: 1.85;
          font-size: 16.5px;
          max-width: 860px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        .rx p {
          margin: 0 0 1.25em;
          line-height: 1.85;
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
          line-height: 1.85;
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
          line-height: 1.75;
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
          border-radius: 12px;
          padding: 14px 20px;
          margin: 1.2em 0;
          color: #78350f;
          font-size: 0.95em;
          line-height: 1.8;
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
      `}</style>

      {/* Render HTML with preserved styles and dynamic DOM enhancements */}
      <div
        ref={containerRef}
        className="blogger-raw-html-content w-full max-w-full overflow-hidden"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
};
