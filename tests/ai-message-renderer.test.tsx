import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { AIMessageRenderer } from "../src/components/AIMessageRenderer";

describe("AIMessageRenderer", () => {
  it("renders basic text and bold elements correctly", () => {
    const markdown = "नमस्ते! मैं **दिशा AI साथी (Disha AI Tutor)** हूँ।";
    const html = renderToString(<AIMessageRenderer content={markdown} />);
    
    // Check that strong tag exists and has correct bold text
    expect(html).toContain("<strong");
    expect(html).toContain("दिशा AI साथी (Disha AI Tutor)");
    expect(html).toContain("नमस्ते! मैं ");
    // Ensure raw asterisks are not rendered
    expect(html).not.toContain("**दिशा AI साथी");
  });

  it("renders bulleted lists correctly from asterisks or dashes", () => {
    const listMarkdown = `
बताइए, आज हम किस विषय पर चर्चा करें? आप इनमें से कोई भी विकल्प चुन सकते हैं:

* **विषय की समझ:** किसी कठिन टॉपिक को सरल भाषा में समझना।
* **रणनीति (Strategy):** टाइम-टेबल बनाना या परीक्षा की तैयारी का सही तरीका।
* **महत्वपूर्ण तथ्य:** राजस्थान जीके के 'High-Yield' नोट्स।
`;
    const html = renderToString(<AIMessageRenderer content={listMarkdown} />);
    
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("विषय की समझ:");
    expect(html).toContain("रणनीति (Strategy):");
    expect(html).toContain("महत्वपूर्ण तथ्य:");
    // Ensure raw bullets/asterisks are not output literally
    expect(html).not.toContain("* **विषय की समझ");
  });

  it("renders complex user message with bold, quotes, and italics properly without raw syntax", () => {
    const fullUserMsg = `नमस्ते! मैं **दिशा AI साथी (Disha AI Tutor)** हूँ। आपकी तैयारी को आसान, रोचक और प्रभावी बनाने के लिए मैं यहाँ हूँ। 

चाहे आप **RPSC RAS, REET, CET, UPSC** या किसी भी अन्य प्रतियोगी परीक्षा की तैयारी कर रहे हों, मैं आपकी हर कदम पर मदद करूँगा। 

बताइए, आज हम किस विषय पर चर्चा करें? आप इनमें से कोई भी विकल्प चुन सकते हैं:

*   **विषय की समझ:** किसी कठिन टॉपिक को सरल भाषा में समझना।
*   **रणनीति (Strategy):** टाइम-टेबल बनाना या परीक्षा की तैयारी का सही तरीका।
*   **महत्वपूर्ण तथ्य:** राजस्थान जीके, इतिहास, भूगोल या करंट अफेयर्स के 'High-Yield' नोट्स।
*   **याद रखने की ट्रिक्स:** कठिन तथ्यों को याद रखने के लिए शॉर्ट ट्रिक्स (Mnemonics)।
*   **मोटिवेशन:** पढ़ाई में मन नहीं लग रहा या तनाव महसूस हो रहा है?

**याद रखें:** *"सफलता का कोई शॉर्टकट नहीं होता, लेकिन सही मार्गदर्शन से रास्ता आसान जरूर हो जाता है।"*

आप अपना प्रश्न पूछें, हम मिलकर आपकी तैयारी को एक नई दिशा देंगे!`;

    const html = renderToString(<AIMessageRenderer content={fullUserMsg} />);

    // Must have strong tags for bold sections
    expect(html).toContain("<strong");
    expect(html).toContain("दिशा AI साथी (Disha AI Tutor)");
    expect(html).toContain("RPSC RAS, REET, CET, UPSC");
    expect(html).toContain("याद रखें:");

    // Must have unordered list with li elements
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("विषय की समझ:");
    expect(html).toContain("मोटिवेशन:");

    // Must have italic emphasis tag
    expect(html).toContain("<em");
    expect(html).toContain("सफलता का कोई शॉर्टकट नहीं होता");

    // Raw markdown asterisks must NOT be printed as text
    expect(html).not.toContain("**दिशा AI साथी");
    expect(html).not.toContain("**RPSC RAS");
    expect(html).not.toContain("*   **");
  });

  it("renders math formulas seamlessly via KaTeX", () => {
    const mathContent = "क्षेत्रफल का सूत्र $A = \\pi r^2$ होता है।";
    const html = renderToString(<AIMessageRenderer content={mathContent} />);

    // KaTeX outputs katex class
    expect(html).toContain("katex");
    expect(html).toContain("क्षेत्रफल का सूत्र");
  });
});
