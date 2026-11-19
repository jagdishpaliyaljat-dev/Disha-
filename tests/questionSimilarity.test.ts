import { describe, it, expect } from "vitest";
import {
  cleanQuestionText,
  computeBigramDiceSimilarity,
  calculateQuestionSimilarity,
  scanQuestionsForFuzzyDuplicates,
  checkBatchForFuzzyDuplicates,
} from "../src/utils/questionSimilarity";

describe("Question Similarity & 90%+ Duplicate Detection Engine", () => {
  it("cleans and normalizes question text removing numbers and exam fillers", () => {
    const raw = "प्र. 1. निम्न में से राजस्थान का राज्य पशु कौन सा है?";
    const cleaned = cleanQuestionText(raw);
    expect(cleaned).toBe("राजस्थान का राज्य पशु कौन सा है");
  });

  it("detects exact match as 100% duplicate", () => {
    const q1 = { text: "राजस्थान का राज्य वृक्ष कौन सा है?" };
    const q2 = { text: "राजस्थान का राज्य वृक्ष कौन सा है?" };
    const res = calculateQuestionSimilarity(q1, q2);
    expect(res.percentage).toBe(100);
    expect(res.isDuplicate).toBe(true);
    expect(res.isExactMatch).toBe(true);
  });

  it("detects >90% similarity when minor punctuation or filler words differ", () => {
    const q1 = {
      text: "राजस्थान का राज्य पशु कौन सा है?",
      options: ["चिंकारा", "बाघ", "शेर", "हाथी"],
      correctIndex: 0,
    };
    const q2 = {
      text: "निम्न में से राजस्थान का राज्य पशु कौन-सा है?",
      options: ["चिंकारा", "बाघ", "शेर", "हाथी"],
      correctIndex: 0,
    };
    const res = calculateQuestionSimilarity(q1, q2, 0.90);
    expect(res.percentage).toBeGreaterThanOrEqual(90);
    expect(res.isDuplicate).toBe(true);
  });

  it("distinguishes completely different questions with low similarity", () => {
    const q1 = { text: "राजस्थान का राज्य पशु कौन सा है?" };
    const q2 = { text: "राजस्थान की राजधानी कौन सी है?" };
    const res = calculateQuestionSimilarity(q1, q2);
    expect(res.percentage).toBeLessThan(75);
    expect(res.isDuplicate).toBe(false);
  });

  it("clusters duplicate questions in a bank", () => {
    const bank: any[] = [
      { id: "q1", text: "हवा महल का निर्माण किसने करवाया था?", options: ["सवाई प्रताप सिंह", "मानसिंह", "जयसिंह"], createdAt: "2024-01-01" },
      { id: "q2", text: "हवामहल का निर्माण किसने करवाया था", options: ["सवाई प्रताप सिंह", "मानसिंह", "जयसिंह"], createdAt: "2024-01-02" },
      { id: "q3", text: "राजस्थान में कुल कितने संभाग हैं?", options: ["7", "10", "5"], createdAt: "2024-01-03" },
    ];
    const report = scanQuestionsForFuzzyDuplicates(bank, 0.90);
    expect(report.duplicateGroupCount).toBe(1);
    expect(report.groups[0].canonicalQuestion.id).toBe("q1");
    expect(report.groups[0].duplicates[0].question.id).toBe("q2");
    expect(report.groups[0].highestSimilarity).toBeGreaterThanOrEqual(90);
  });

  it("identifies duplicates in incoming batch", () => {
    const drafts: any[] = [
      { tempId: "t1", text: "हवा महल कहाँ स्थित है?" },
      { tempId: "t2", text: "हवामहल कहाँ स्थित है" },
    ];
    const existing: any[] = [
      { id: "e1", text: "राजस्थान का क्षेत्रफल कितना है?" }
    ];
    const result = checkBatchForFuzzyDuplicates(drafts, existing, 0.90);
    expect(result.has("t2")).toBe(true);
    expect(result.get("t2")?.isBatchInternal).toBe(true);
  });

  it("handles spelling / matra variations above 90% (e.g. टॉड vs टाड)", () => {
    const q1 = { text: "राजस्थान के इतिहास के पितामह कर्नल जेम्स टॉड हैं।" };
    const q2 = { text: "राजस्थान के इतिहास के पितामह कर्नल जेम्स टाड हैं" };
    const res = calculateQuestionSimilarity(q1, q2);
    expect(res.percentage).toBeGreaterThanOrEqual(92);
    expect(res.isDuplicate).toBe(true);
  });

  it("handles English competitive exam questions above 90%", () => {
    const q1 = {
      text: "Which of the following is the highest peak in Rajasthan?",
      options: ["Guru Shikhar", "Ser", "Dilwara", "Taragarh"],
      correctIndex: 0,
    };
    const q2 = {
      text: "Which is the highest peak in the state of Rajasthan?",
      options: ["Guru Shikhar", "Ser", "Dilwara", "Taragarh"],
      correctIndex: 0,
    };
    const res = calculateQuestionSimilarity(q1, q2, 0.90);
    expect(res.percentage).toBeGreaterThanOrEqual(90);
    expect(res.isDuplicate).toBe(true);
  });
});
