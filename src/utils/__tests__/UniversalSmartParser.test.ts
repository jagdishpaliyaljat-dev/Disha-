import { UniversalSmartParser } from "../UniversalSmartParser.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("ASSERTION FAILED:", message);
    process.exit(1);
  }
}

const testStandardMCQ = `Q1. What is the capital of France?
A. London
B. Paris
C. Berlin
D. Madrid`;

const results = await UniversalSmartParser.parse(testStandardMCQ);

assert(results.length === 1, "Should parse 1 question");
assert(results[0].text === "What is the capital of France?", "Question text mismatch");
assert(results[0].options.length === 4, "Should have 4 options");
assert(results[0].options[1] === "Paris", "Option B should be Paris");

console.log("All tests passed!");
