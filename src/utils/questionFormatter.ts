export interface StructuredQuestionItem {
  label: string;
  text: string;
}

export interface StructuredQuestionParts {
  isStructured: boolean;
  intro: string;
  items: StructuredQuestionItem[];
  outro: string;
}

const OUTRO_PATTERNS = [
  /(उपर्युक्त\s+(?:कथनों|कथन|में\s+से)[\s\S]*)$/i,
  /(उपरोक्त\s+(?:कथनों|कथन|में\s+से)[\s\S]*)$/i,
  /(नीचे\s+दिए\s+गए\s+कूट[\s\S]*)$/i,
  /(सही\s+कूट\s+(?:का\s+चयन|चुनिए)[\s\S]*)$/i,
  /(कूट\s+की\s+सहायता\s+से[\s\S]*)$/i,
  /(इनमें\s+से\s+कौन[\s\S]*)$/i,
  /(Which\s+of\s+the\s+(?:statements|above)[\s\S]*)$/i,
  /(Select\s+the\s+correct\s+answer[\s\S]*)$/i,
  /(Choose\s+the\s+correct[\s\S]*)$/i,
];

function extractOutro(text: string): { body: string; outro: string } {
  for (const pat of OUTRO_PATTERNS) {
    const m = text.match(pat);
    if (m && m.index && m.index > 3) {
      return {
        body: text.slice(0, m.index).trim(),
        outro: m[1].trim(),
      };
    }
  }
  return { body: text, outro: "" };
}

function formatSubItemsInline(text: string): string {
  // Put inline sub-markers like (a), (b), (c), (d) or A., B., C., D. or 1., 2., 3., 4. on separate lines
  return text
    .replace(/\s+(\([a-dA-D1-4]\)|[A-D]\.|[1-4]\.)\s+/g, "\n$1 ")
    .trim();
}

/**
 * Splits inline multi-statement, assertion-reason, or match-the-following RPSC questions
 * into readable Intro + Numbered/Labeled Items + Closing Question.
 */
export function formatStructuredQuestion(rawText: string): StructuredQuestionParts {
  const clean = (rawText || "").trim();
  if (!clean) {
    return { isStructured: false, intro: "", items: [], outro: "" };
  }

  // 1. Check Assertion (A) + Reason (R)
  const arMatch = clean.match(
    /^([\s\S]*?)((?:अभिकथन|कथन|Assertion)\s*\(?\s*A\s*\)?\s*[:\-–]\s*[\s\S]*?)((?:कारण|Reason)\s*\(?\s*R\s*\)?\s*[:\-–]\s*[\s\S]*)$/i
  );
  if (arMatch) {
    const intro = arMatch[1].trim();
    const assertionRaw = arMatch[2].trim();
    const { body: reasonRaw, outro } = extractOutro(arMatch[3].trim());

    const aText = assertionRaw.replace(/^(?:अभिकथन|कथन|Assertion)\s*\(?\s*A\s*\)?\s*[:\-–]\s*/i, "").trim();
    const rText = reasonRaw.replace(/^(?:कारण|Reason)\s*\(?\s*R\s*\)?\s*[:\-–]\s*/i, "").trim();

    if (aText && rText) {
      return {
        isStructured: true,
        intro,
        items: [
          { label: "कथन (A)", text: aText },
          { label: "कारण (R)", text: rText },
        ],
        outro,
      };
    }
  }

  // 2. Check Match-the-Following: सूची-I ... सूची-II ... (or List-I ... List-II ...)
  const listMatch = clean.match(
    /^([\s\S]*?)((?:सूची|List)\s*[-–]?\s*(?:I|1)\b[\s\S]*?)((?:सूची|List)\s*[-–]?\s*(?:II|2)\b[\s\S]*)$/i
  );
  if (listMatch) {
    const intro = listMatch[1].trim();
    const list1Raw = listMatch[2]
      .replace(/^(?:सूची|List)\s*[-–]?\s*(?:I|1)\b\s*[:\-–]?\s*/i, "")
      .trim();
    const { body: list2Body, outro } = extractOutro(
      listMatch[3]
        .replace(/^(?:सूची|List)\s*[-–]?\s*(?:II|2)\b\s*[:\-–]?\s*/i, "")
        .trim()
    );

    if (list1Raw && list2Body) {
      return {
        isStructured: true,
        intro,
        items: [
          { label: "सूची-I", text: formatSubItemsInline(list1Raw) },
          { label: "सूची-II", text: formatSubItemsInline(list2Body) },
        ],
        outro,
      };
    }
  }

  // 3. Check inline numbered statements: "1. ... 2. ... 3. ..."
  const markerRegex = /(?:^|\s)([1-9]\.)\s+/g;
  const markers: { label: string; index: number; endIndex: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = markerRegex.exec(clean)) !== null) {
    const num = parseInt(match[1], 10);
    if (markers.length === 0 && num === 1) {
      markers.push({
        label: match[1],
        index: match.index + (match[0].startsWith(" ") || match[0].startsWith("\n") ? 1 : 0),
        endIndex: match.index + match[0].length,
      });
    } else if (markers.length > 0 && num === markers.length + 1) {
      markers.push({
        label: match[1],
        index: match.index + (match[0].startsWith(" ") || match[0].startsWith("\n") ? 1 : 0),
        endIndex: match.index + match[0].length,
      });
    }
  }

  if (markers.length >= 2) {
    const intro = clean.slice(0, markers[0].index).trim();
    const items: StructuredQuestionItem[] = [];

    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].endIndex;
      const end = i + 1 < markers.length ? markers[i + 1].index : clean.length;
      items.push({ label: markers[i].label, text: clean.slice(start, end).trim() });
    }

    const lastIdx = items.length - 1;
    const { body, outro } = extractOutro(items[lastIdx].text);
    items[lastIdx].text = body;

    return {
      isStructured: true,
      intro,
      items: items.filter((it) => it.text.length > 0),
      outro,
    };
  }

  // 4. Check inline lettered pairs: "(a) ... (b) ... (c) ... (d) ..." or "A. ... B. ... C. ..."
  const letterRegex = /(?:^|\s)(\([a-d]\)|[A-D]\.)\s+/g;
  const letterMarkers: { label: string; index: number; endIndex: number }[] = [];
  const expectedLower = ["(a)", "(b)", "(c)", "(d)"];
  const expectedUpper = ["A.", "B.", "C.", "D."];

  while ((match = letterRegex.exec(clean)) !== null) {
    const tok = match[1];
    const nextIdx = letterMarkers.length;
    if (nextIdx < 4 && (tok === expectedLower[nextIdx] || tok === expectedUpper[nextIdx])) {
      letterMarkers.push({
        label: tok,
        index: match.index + (match[0].startsWith(" ") || match[0].startsWith("\n") ? 1 : 0),
        endIndex: match.index + match[0].length,
      });
    }
  }

  if (letterMarkers.length >= 2) {
    const intro = clean.slice(0, letterMarkers[0].index).trim();
    const items: StructuredQuestionItem[] = [];

    for (let i = 0; i < letterMarkers.length; i++) {
      const start = letterMarkers[i].endIndex;
      const end = i + 1 < letterMarkers.length ? letterMarkers[i + 1].index : clean.length;
      items.push({ label: letterMarkers[i].label, text: clean.slice(start, end).trim() });
    }

    const lastIdx = items.length - 1;
    const { body, outro } = extractOutro(items[lastIdx].text);
    items[lastIdx].text = body;

    return {
      isStructured: true,
      intro,
      items: items.filter((it) => it.text.length > 0),
      outro,
    };
  }

  return { isStructured: false, intro: clean, items: [], outro: "" };
}
