import { parseRawMcqText } from "./src/utils/questionParser";
import { parseJSONQuestions, parseCSVQuestions } from "./src/utils/questionsParser";

const TEXT_TEMPLATE_SIMPLE = `Q1. Question text here?
A. Option A
B. Option B
C. Option C
D. Option D
Answer: A
Explanation: Explanation here.`;

const JSON_TEMPLATE_SIMPLE = JSON.stringify({
  text: "Question text here?",
  options: ["Option A", "Option B", "Option C", "Option D"],
  correctIndex: 0,
  explanation: "Explanation here.",
  questionType: "factual"
});

const CSV_TEMPLATE_SIMPLE = `text,optionA,optionB,optionC,optionD,correctIndex,explanation
Question text here?,Option A,Option B,Option C,Option D,0,Explanation here.`;

async function validate() {
  console.log("Validating Simple MCQ...");
  try {
    const textRes = parseRawMcqText(TEXT_TEMPLATE_SIMPLE, "ch1", "top1");
    // ParseMcqResult is likely an object, not an array.
    console.log("Text Parsed:", textRes);
  } catch (e) {
    console.error("Runtime Error in validation:", e);
  }
}

validate();
