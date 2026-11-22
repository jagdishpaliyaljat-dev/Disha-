import { describe, it, expect } from "vitest";
import { UniversalSmartParser } from "../src/utils/UniversalSmartParser";
import { parseRawMcqText, detectType } from "../src/utils/questionParser";
import { normalizeQuestion, validateQuestion } from "../src/lib/mcqImport";

describe("AI Import Text Format & Question Type Identification", () => {
  it("1. Correctly parses un-prefixed Hindi stem with 1-4 numeric options and Hindi answer", async () => {
    const raw = `राजस्थान का राज्य पक्षी कौनसा है?
1. गोडावण
2. मोर
3. तोता
4. कबूतर
उत्तर- 1`;

    const drafts = await UniversalSmartParser.parse(raw);
    expect(drafts.length).toBe(1);
    expect(drafts[0].type).toBe("single_correct");
    expect(drafts[0].questionType).toBe("single_correct");
    expect(drafts[0].text).toBe("राजस्थान का राज्य पक्षी कौनसा है?");
    expect(drafts[0].options).toEqual(["गोडावण", "मोर", "तोता", "कबूतर"]);
    expect(drafts[0].correctIndex).toBe(0);
    expect(drafts[0].answer).toBe("A");
    expect(drafts[0].isValid).toBe(true);
    expect(drafts[0].reviewCategory).toBe("ready");
    expect(drafts[0].errors).toHaveLength(0);
  });

  it("2. Correctly strips leading question numbers (1., 2.) from stem without falsely classifying as statement_based", async () => {
    const raw = `1. राजस्थान की राजधानी क्या है?
(A) जयपुर
(B) जोधपुर
(C) उदयपुर
(D) कोटा
उत्तर: A
व्याख्या: राजस्थान की राजधानी जयपुर है।`;

    const drafts = await UniversalSmartParser.parse(raw);
    expect(drafts.length).toBe(1);
    expect(drafts[0].type).toBe("single_correct");
    expect(drafts[0].text).toBe("राजस्थान की राजधानी क्या है?");
    expect(drafts[0].options).toEqual(["जयपुर", "जोधपुर", "उदयपुर", "कोटा"]);
    expect(drafts[0].correctIndex).toBe(0);
    expect(drafts[0].isValid).toBe(true);
  });

  it("3. Correctly splits multiple un-numbered questions separated by blank lines", async () => {
    const raw = `राजस्थान की राजधानी क्या है?
(A) जयपुर
(B) जोधपुर
(C) उदयपुर
(D) कोटा
उत्तर: A

राजस्थान का राज्य वृक्ष कौनसा है?
1. खेजड़ी
2. रोहिड़ा
3. बबूल
4. नीम
उत्तर: 1`;

    const drafts = await UniversalSmartParser.parse(raw);
    expect(drafts.length).toBe(2);
    expect(drafts[0].text).toBe("राजस्थान की राजधानी क्या है?");
    expect(drafts[0].isValid).toBe(true);
    expect(drafts[1].text).toBe("राजस्थान का राज्य वृक्ष कौनसा है?");
    expect(drafts[1].isValid).toBe(true);
  });

  it("4. Correctly identifies question types: statement_based, assertion_reason, match_following, math", async () => {
    const statementQ = `कथनों पर विचार कीजिए:
1. तराइन का प्रथम युद्ध 1191 में हुआ था।
2. इसमें पृथ्वीराज चौहान की विजय हुई थी।
उपर्युक्त कथनों में से कौन-सा/से सही है/हैं?
(A) केवल 1
(B) केवल 2
(C) 1 और 2 दोनों
(D) न तो 1 और न ही 2
उत्तर: C`;

    const assertionQ = `अभिकथन (A): 1857 की क्रांति का प्रारंभ नसीराबाद से हुआ था।
कारण (R): 15वीं बंगाल नेटिव इन्फैंट्री ने विद्रोह किया था।
(A) (A) और (R) दोनों सही हैं और (R), (A) का सही स्पष्टीकरण है।
(B) (A) और (R) दोनों सही हैं लेकिन (R), (A) का सही स्पष्टीकरण नहीं है।
(C) (A) सही है लेकिन (R) गलत है।
(D) (A) गलत है लेकिन (R) सही है।
Ans: A`;

    const matchQ = `सूची-I को सूची-II से सुमेलित कीजिए:
| सूची-I | सूची-II |
| हल्दीघाटी | 1576 |
| खानवा | 1527 |
| तराइन | 1191 |
(A) 1-A, 2-B, 3-C
(B) 1-B, 2-A, 3-C
(C) 1-C, 2-B, 3-A
(D) 1-A, 2-C, 3-B
उत्तर: A`;

    const mathQ = `यदि $x + \\frac{1}{x} = 5$ है, तो $x^2 + \\frac{1}{x^2}$ का मान ज्ञात कीजिए:
(A) 23
(B) 25
(C) 27
(D) 20
Ans: A`;

    const resS = await UniversalSmartParser.parse(statementQ);
    expect(resS[0].type).toBe("statement_based");
    expect(resS[0].isValid).toBe(true);
    expect(resS[0].reviewCategory).toBe("ready");

    const resA = await UniversalSmartParser.parse(assertionQ);
    expect(resA[0].type).toBe("assertion_reason");
    expect(resA[0].isValid).toBe(true);
    expect(resA[0].reviewCategory).toBe("ready");

    const resM = await UniversalSmartParser.parse(matchQ);
    expect(resM[0].type).toBe("match_following");
    expect(resM[0].isValid).toBe(true);
    expect(resM[0].reviewCategory).toBe("ready");

    const resMath = await UniversalSmartParser.parse(mathQ);
    expect(resMath[0].type).toBe("math");
    expect(resMath[0].isValid).toBe(true);
    expect(resMath[0].reviewCategory).toBe("ready");
  });

  it("5. Never outputs an 'unsupported' review category or unrecognized question type for valid MCQs", () => {
    const rawLegacy = {
      question: "Which Constitutional Amendment Act gave constitutional status to Panchayati Raj institutions?",
      options: ["42nd", "44th", "73rd", "74th"],
      answer: "C",
      type: "simple", // legacy type
    };

    const normalized = normalizeQuestion(rawLegacy);
    expect(normalized.type).toBe("single_correct");
    const validation = validateQuestion(normalized);
    expect(validation.isValid).toBe(true);
    expect(validation.reviewCategory).toBe("ready");
    expect(validation.errorCategories).not.toContain("Unsupported Question Type");
  });
});
