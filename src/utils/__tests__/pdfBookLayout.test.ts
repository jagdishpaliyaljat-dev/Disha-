import { describe, it, expect } from "vitest";
import {
  parseExamQuestion,
  renderParsedQuestionHTML,
  chunkQuestionsIntoPages,
  generateDisha2020PDFHTML,
} from "../pdfGenerator";
import { Question } from "../../types";

describe("PDF Book Layout & Question Bank Optimization", () => {
  it("correctly parses Assertion & Reason questions from text", () => {
    const rawText =
      "कथन (A): भारत का राष्ट्रपति कार्यपालिका का संवैधानिक प्रमुख होता है।\n" +
      "कारण (R): संविधान के अनुच्छेद 53(1) के अनुसार संघ की कार्यपालिका शक्ति राष्ट्रपति में निहित है।\n" +
      "नीचे दिए गए कूट से सही उत्तर चुनिए:";

    const parsed = parseExamQuestion(rawText);
    expect(parsed.assertion).toBeDefined();
    expect(parsed.assertion?.body).toContain("संवैधानिक प्रमुख");
    expect(parsed.reason).toBeDefined();
    expect(parsed.reason?.body).toContain("अनुच्छेद 53(1)");
    expect(parsed.instruction).toContain("नीचे दिए गए कूट");

    const html = renderParsedQuestionHTML(rawText, "normal", undefined, 1);
    expect(html).toContain("book-ar-box");
    expect(html).toContain("कथन (A):");
    expect(html).toContain("कारण (R):");
    expect(html).toContain('class="q-num-inline">1.</span>');
  });

  it("correctly parses Match the Following questions into 2-column table", () => {
    const rawText =
      "सूची-I (सभ्यता) को सूची-II (जिला) से सुमेलित कीजिए:\n" +
      "सूची-I\n" +
      "A. कालीबंगा\n" +
      "B. आहड़\n" +
      "C. गणेश्वर\n" +
      "D. बैराठ\n" +
      "सूची-II\n" +
      "1. हनुमानगढ़\n" +
      "2. उदयपुर\n" +
      "3. नीम का थाना\n" +
      "4. कोटपूतली-बहरोड़\n" +
      "कूट:";

    const parsed = parseExamQuestion(rawText);
    expect(parsed.matchPairs.length).toBe(4);
    expect(parsed.matchPairs[0].left).toContain("कालीबंगा");
    expect(parsed.matchPairs[0].right).toContain("हनुमानगढ़");

    const html = renderParsedQuestionHTML(rawText, "normal", undefined, 5);
    expect(html).toContain("book-match-table");
    expect(html).toContain("कालीबंगा");
    expect(html).toContain("हनुमानगढ़");
    expect(html).toContain('class="q-num-inline">5.</span>');
  });

  it("formats short options as opts-inline-four and medium options as opts-two-by-two", () => {
    const qShort: Question = {
      id: "q1",
      text: "राजस्थान का राज्य पशु कौन सा है?",
      options: ["चिंकारा", "बाघ", "ऊंट", "भालू"],
      correctIndex: 0,
    };

    const qMedium: Question = {
      id: "q2",
      text: "हड़प्पा सभ्यता का प्रमुख स्थल कालीबंगा किस नदी के किनारे स्थित है?",
      options: [
        "घग्घर नदी के किनारे",
        "रावी नदी के तट पर",
        "भोगवा नदी के मुहाने पर",
        "सतलज नदी के किनारे",
      ],
      correctIndex: 0,
    };

    const html = generateDisha2020PDFHTML([qShort, qMedium], {
      subjectTitle: "राजस्थान सामान्य ज्ञान",
      filterType: "all",
      format: "question_paper",
      layout: "compact",
      fontSize: "normal",
      includeCoverPage: false,
      showPageNumbers: true,
      showHeaderFooter: true,
      includeTestInstructions: true,
      includeSubjectTopicNames: true,
      includeBlankAnswerSheet: false,
    });

    expect(html).toContain("opts-inline-four");
    expect(html).toContain("opts-two-by-two");
    expect(html).toContain("first-page-exam-strip");
  });

  it("densely packs questions into pages saving 60-70% pages", () => {
    const sampleQuestions: Question[] = Array.from({ length: 50 }, (_, i) => ({
      id: `q_${i + 1}`,
      text: `प्रश्न संख्या ${i + 1}: राजस्थान के भौतिक प्रदेशों के संदर्भ में निम्नलिखित पर विचार करें।`,
      options: ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
      correctIndex: i % 4,
    }));

    const pages = chunkQuestionsIntoPages(sampleQuestions, false, true, "normal");
    // With 50 short questions in 2-column mode, it should fit in only 2-3 pages instead of 8-10 pages!
    expect(pages.length).toBeLessThanOrEqual(3);
  });

  it("generates 5-column answer key fitting 100 questions on a single page", () => {
    const sampleQuestions: Question[] = Array.from({ length: 100 }, (_, i) => ({
      id: `q_${i + 1}`,
      text: `प्रश्न ${i + 1}`,
      options: ["A", "B", "C", "D"],
      correctIndex: i % 4,
    }));

    const html = generateDisha2020PDFHTML(sampleQuestions, {
      subjectTitle: "उत्तरमाला टेस्ट",
      filterType: "all",
      format: "answer_key",
      layout: "compact",
      fontSize: "normal",
      includeCoverPage: false,
      showPageNumbers: true,
      showHeaderFooter: true,
      includeTestInstructions: false,
      includeSubjectTopicNames: true,
      includeBlankAnswerSheet: false,
    });

    expect(html).toContain("ans-key-grid-5");
    expect(html).toContain("OFFICIAL ANSWER KEY (उत्तरमाला)");
    // Should have only 1 page for 100 questions answer key!
    const pageCountMatch = html.match(/class="a4-page answer-key-page"/g);
    expect(pageCountMatch?.length).toBe(1);
  });
});
