import { describe, it, expect } from "vitest";
import { extractExamsFromText, detectQuestionExams } from "../src/lib/mcqImport/examDetector";

describe("Exam & Year Provenance Tags — Detection & Formatting", () => {
  it("detects trailing bracketed exam and year at end of question line", () => {
    const raw = "राजस्थान की सबसे लंबी नदी कौन सी है? [RPSC RAS Pre 2021]";
    const res = extractExamsFromText(raw);
    expect(res.exams.length).toBe(1);
    expect(res.exams[0].examName).toBe("RPSC RAS Pre");
    expect(res.exams[0].year).toBe(2021);
    expect(res.cleanText).toBe("राजस्थान की सबसे लंबी नदी कौन सी है?");
  });

  it("detects Hindi devanagari trailing bracketed exam and year", () => {
    const raw = "प्रजामंडल आंदोलन का नेतृत्व किसने किया था? (पटवार भर्ती परीक्षा २०२१)";
    const res = extractExamsFromText(raw);
    expect(res.exams.length).toBe(1);
    expect(res.exams[0].examName).toContain("पटवार");
    expect(res.exams[0].year).toBe(2021);
    expect(res.cleanText).toBe("प्रजामंडल आंदोलन का नेतृत्व किसने किया था?");
  });

  it("detects multi-exam repeated occurrences accurately", () => {
    const questionObj = {
      text: "हवामहल का निर्माण किसने करवाया था?",
      examHistory: [
        { examName: "RPSC RAS Pre", year: 2018 },
        { examName: "RSMSSB Patwar", year: 2021 },
        { examName: "Rajasthan Police Constable", year: 2022 },
      ],
    };
    const detection = detectQuestionExams(questionObj);
    expect(detection.isPYQ).toBe(true);
    expect(detection.examHistory.length).toBe(3);
    expect(detection.examHistory.map(e => e.examName)).toEqual([
      "RPSC RAS Pre",
      "RSMSSB Patwar",
      "Rajasthan Police Constable",
    ]);
  });
});
