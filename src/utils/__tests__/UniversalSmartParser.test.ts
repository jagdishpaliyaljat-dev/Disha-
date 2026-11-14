import { describe, it, expect } from "vitest";
import { UniversalSmartParser } from "../UniversalSmartParser.js";

describe("UniversalSmartParser", () => {
  it("should parse standard MCQ correctly", async () => {
    const testStandardMCQ = `Q1. What is the capital of France?
A. London
B. Paris
C. Berlin
D. Madrid`;

    const results = await UniversalSmartParser.parse(testStandardMCQ);

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("What is the capital of France?");
    expect(results[0].options).toHaveLength(4);
    expect(results[0].options[1]).toBe("Paris");
  });
});

