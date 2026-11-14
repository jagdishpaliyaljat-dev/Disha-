import * as React from "react";

interface RawHtmlArticleViewerProps {
  htmlContent: string;
  className?: string;
}

/**
 * RawHtmlArticleViewer
 * 100% Raw HTML/CSS Article Renderer.
 * Preserves custom CSS, <style> tags, inline styles, <iframe>, <table>,
 * fonts, classes, IDs, and embeds exactly as pasted without any stripping or alteration.
 */
export const RawHtmlArticleViewer: React.FC<RawHtmlArticleViewerProps> = ({
  htmlContent,
  className = "",
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Execute any inline or dynamic scripts safely if included in pasted HTML
  React.useEffect(() => {
    if (!containerRef.current) return;
    const scripts = containerRef.current.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });

    // Ensure headings have anchor IDs matching Table of Contents navigation
    const headings = containerRef.current.querySelectorAll("h2, h3");
    headings.forEach((h, idx) => {
      if (!h.id) {
        h.id = `heading-anchor-${idx}`;
      }
    });
  }, [htmlContent]);

  return (
    <div className={`blogger-article-wrapper w-full ${className}`}>
      {/* Universal Base Styles for Blogger Content to ensure responsive tables, images and embeds */}
      <style>{`
        .blogger-raw-html-content {
          font-family: inherit;
          line-height: 1.8;
          color: inherit;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .blogger-raw-html-content img {
          max-width: 100% !important;
          height: auto !important;
          border-radius: 12px;
          display: inline-block;
          margin: 12px 0;
        }
        .blogger-raw-html-content table {
          width: 100% !important;
          max-width: 100% !important;
          border-collapse: collapse !important;
          margin: 16px 0 !important;
          display: table;
        }
        .blogger-raw-html-content .table-responsive,
        .blogger-raw-html-content table {
          overflow-x: auto;
        }
        .blogger-raw-html-content th,
        .blogger-raw-html-content td {
          padding: 10px 14px;
          border: 1px solid rgba(128, 128, 128, 0.25);
        }
        .blogger-raw-html-content th {
          background-color: rgba(128, 0, 32, 0.08);
          font-weight: 700;
        }
        .blogger-raw-html-content iframe {
          max-width: 100% !important;
          border-radius: 12px;
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
        }
        .blogger-raw-html-content a {
          color: #800020;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .blogger-raw-html-content a:hover {
          color: #a00028;
        }
        .dark .blogger-raw-html-content a {
          color: #f47b20;
        }
        .dark .blogger-raw-html-content th {
          background-color: rgba(244, 123, 32, 0.12);
        }
      `}</style>

      {/* Render 100% Raw Unescaped HTML/CSS */}
      <div
        ref={containerRef}
        className="blogger-raw-html-content w-full"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
};
