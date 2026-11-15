// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { parseSmartHtml } from "../src/utils/smartArticleImporter";

describe("Smart HTML Article Import & Presentation", () => {
  const sampleRxHtml = `
<style>
.rx{font-family:"Noto Sans Devanagari","Segoe UI",system-ui,sans-serif;color:#1e293b;line-height:1.85;font-size:17px;max-width:860px;margin:0 auto}
.rx *{box-sizing:border-box}
.rx p{margin:0 0 1.1em}
.rx strong{color:#0b2a63}
.rx .lead{font-size:1.08em;padding:18px 22px;background:linear-gradient(135deg,#f4f7ff,#fff);border-left:5px solid #0b2a63;border-radius:0 12px 12px 0}
.rx h2{font-size:1.4em;color:#0b2a63;margin:2.2em 0 .7em;padding-bottom:.35em;border-bottom:2px solid #e2e8f0;position:relative}
.rx h2::after{content:"";position:absolute;left:0;bottom:-2px;width:70px;height:2px;background:#c8962e}
.rx h3{font-size:1.1em;color:#1e3a8a;margin:1.4em 0 .5em}
.rx ul{padding-left:0;list-style:none;margin:0 0 1.2em}
.rx li{position:relative;padding:8px 0 8px 30px;border-bottom:1px dashed #e2e8f0}
.rx li::before{content:"";position:absolute;left:6px;top:17px;width:9px;height:9px;background:#c8962e;border-radius:50%}
.rx .card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px 22px;margin:1.2em 0;box-shadow:0 4px 16px rgba(11,42,99,.06)}
.rx .note{background:#fffaf0;border:1px solid #f1d9a3;border-radius:12px;padding:14px 20px;margin:1.2em 0}
.rx .scroll{overflow-x:auto;margin:1.2em 0;border-radius:12px;border:1px solid #e2e8f0}
.rx table{border-collapse:collapse;width:100%;min-width:520px}
.rx th{background:#0b2a63;color:#fff;text-align:left;padding:12px 14px;font-weight:600}
.rx td{padding:11px 14px;border-top:1px solid #e2e8f0}
.rx tr:nth-child(even) td{background:#f8fafc}
.rx .tags{margin-top:1em}
.rx .tags span{display:inline-block;background:#eef2ff;color:#0b2a63;border:1px solid #d6defc;border-radius:999px;padding:3px 13px;margin:4px 4px 0 0;font-size:.82em}
</style>

<div class="rx">

<p class="lead">राजस्थान की सरकारी भर्ती परीक्षाओं की तैयारी में सबसे बड़ी चुनौती सही संसाधन चुनना है। <strong>RSMSSB CET 2026</strong>, <strong>Rajasthan GK PYQ</strong>, <strong>Rajasthan Current Affairs 2026</strong>, <strong>Rajasthan Economic Survey 2025-26</strong> और <strong>Rajasthan Budget 2026-27</strong> की तैयारी के लिए यह गाइड आपको एक स्पष्ट और व्यवस्थित रोडमैप देती है।</p>

<div class="note"><strong>इस गाइड में:</strong> Disha Online Classes और Disha Publication की जानकारी, Rajasthan PYQ बुक्स की तुलना, CET Graduation Level सिलेबस व मॉडल पेपर, करंट अफेयर्स के स्रोत, और आर्थिक समीक्षा व बजट की तैयारी।</div>

<h2>Disha Online Classes और Disha Publication</h2>
<p><strong>Disha Online Classes</strong> विद्यार्थियों के बीच एक लोकप्रिय प्लेटफॉर्म है।</p>

<div class="scroll">
<table>
  <thead>
    <tr>
      <th>पुस्तक / स्रोत</th>
      <th>कवर किया गया सिलेबस</th>
      <th>विशेषता</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>दिशा 20-20 राजस्थान ज्ञान</td>
      <td>इतिहास, कला-संस्कृति, भूगोल</td>
      <td>अध्यायवार हल प्रश्न (PYQ)</td>
    </tr>
    <tr>
      <td>राजस्थान आर्थिक समीक्षा 2025-26</td>
      <td>कृषि, उद्योग, ऊर्जा, योजनाएं</td>
      <td>नवीनतम सरकारी आंकड़े</td>
    </tr>
  </tbody>
</table>
</div>

<h2>अक्सर पूछे जाने वाले प्रश्न (FAQ)</h2>

<div class="card">
<strong>प्र. राजस्थान CET 2026 की तैयारी के लिए सबसे अच्छी गाइड कौन सी है?</strong>
<br>उ. राजस्थान CET 2026 के लिए Disha Online Classes के व्याख्यान और Disha 20-20 Rajasthan GK PYQ पुस्तक का संयोजन सर्वश्रेष्ठ माना जाता है।
</div>

<div class="card">
<strong>प्र. Rajasthan Current Affairs 2026 के लिए कौन से महीने सबसे महत्वपूर्ण हैं?</strong>
<br>उ. परीक्षा तिथि से पिछले 10 से 12 महीनों के करंट अफेयर्स सबसे ज्यादा महत्वपूर्ण होते हैं।
</div>

<div class="tags">
<span>#RajasthanCET2026</span>
<span>#RajasthanGK</span>
<span>#Disha2020</span>
</div>

</div>
`;

  it("successfully parses sample .rx HTML preserving raw content and custom styles", () => {
    const result = parseSmartHtml(sampleRxHtml);
    expect(result).toBeDefined();
    expect(result.article).toBeDefined();

    // Content should preserve HTML tags and styling
    expect(result.article.content).toContain("<style>");
    expect(result.article.content).toContain('class="rx"');
    expect(result.article.content).toContain("<table");

    // Title should be extracted intelligently
    expect(result.article.title).toBeTruthy();

    // Excerpt should capture the lead paragraph
    expect(result.article.excerpt).toContain("राजस्थान की सरकारी भर्ती परीक्षाओं");

    // Table should be counted and parsed into blocks
    expect(result.detectedMeta.tablesCount).toBeGreaterThanOrEqual(1);

    // FAQs should be extracted into article faqs array for Schema.org JSON-LD
    expect(result.article.faqs).toBeDefined();
    expect(result.article.faqs?.length).toBe(2);
    expect(result.article.faqs?.[0].question).toContain("राजस्थान CET 2026");
    expect(result.article.faqs?.[0].answer).toContain("Disha Online Classes");
    expect(result.article.faqs?.[1].question).toContain("Rajasthan Current Affairs 2026");

    // JSON-LD schema should be generated with FAQPage
    expect(result.jsonLdSchema).toBeDefined();

    // No auto-injected unwanted CTA block polluting the content
    const ctaBlocks = result.article.blocks?.filter((b) => b.type === "cta") || [];
    expect(ctaBlocks.length).toBe(0);
  });
});
