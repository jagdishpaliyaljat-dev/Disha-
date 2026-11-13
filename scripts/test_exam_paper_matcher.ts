import {
  normalizeQuestionText,
  convertHindiNumerals,
  extractCrucialEntities,
  compareQuestionsDeterministic,
  matchQuestionAgainstBank,
  calculateCoverageMetrics,
} from "../src/utils/examMatcher";
import { Question, ExtractedQuestionDraft, ExamQuestionMatch } from "../src/types";

console.log("=================================================");
console.log("AI EXAM PAPER SCANNER & MATCHER AUTOMATED TESTS");
console.log("=================================================\n");

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalCount++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`❌ [FAIL] ${testName}`, details || "");
    throw new Error(`Test failed: ${testName}`);
  }
}

// ── TEST 1: Numeral & Unicode Normalization ──
const rawHindi = "Q. 1. वर्ष २०११-१२ में राजस्थान का GSDP विकास दर कितना था?";
const normHindi = normalizeQuestionText(rawHindi);
assert(
  normHindi.includes("2011-12") && !normHindi.includes("q. 1."),
  "Test 1: Normalizes Hindi numerals (२०११-१२ -> 2011-12) and strips question prefix"
);

// ── TEST 2: Exact Match (Identical Content) ──
const qbExact: Question = {
  id: "qb-101",
  topicId: "t1",
  chapterId: "c1",
  text: "राजस्थान में नवीनतम सौर ऊर्जा नीति किस वर्ष जारी की गई थी?",
  options: ["2018", "2019", "2021", "2023"],
  correctIndex: 1,
  explanation: "राजस्थान सौर ऊर्जा नीति वर्ष 2019 में जारी की गई थी।",
};

const examExact: ExtractedQuestionDraft = {
  tempId: "ex-1",
  originalQuestionNumber: 1,
  sourcePageNumber: 1,
  originalText: "Q. 1. राजस्थान में नवीनतम सौर ऊर्जा नीति किस वर्ष जारी की गई थी?",
  extractedOptions: ["2018", "2019", "2021", "2023"],
  ocrStatus: "high",
  isFlaggedForReview: false,
};

const match1 = matchQuestionAgainstBank(examExact, [qbExact]);
assert(
  match1.primaryMatchCategory === "exact" && match1.matchScore === 100,
  "Test 2: Identifies Exact Match with 100% score",
  match1
);

// ── TEST 3: Near-Exact Match (Trivial Punctuation / Minor Word Order) ──
const examNearExact: ExtractedQuestionDraft = {
  tempId: "ex-2",
  originalQuestionNumber: 2,
  sourcePageNumber: 1,
  originalText: "राजस्थान में नवीनतम सौर ऊर्जा नीति किस वर्ष जारी हुई थी?",
  extractedOptions: ["2018", "2019", "2021", "2023"],
  ocrStatus: "high",
  isFlaggedForReview: false,
};

const match2 = matchQuestionAgainstBank(examNearExact, [qbExact]);
assert(
  match2.primaryMatchCategory === "near_exact" || match2.primaryMatchCategory === "similar",
  "Test 3: Identifies Near-Exact / Similar question on slight phrasing variation",
  match2
);

// ── TEST 4: Crucial Date / Year Differences (e.g., 2021-22 vs 2023-24) ──
// Must NOT be classified as Exact or Near-Exact!
const qb2021: Question = {
  id: "qb-202",
  topicId: "t1",
  chapterId: "c1",
  text: "वर्ष 2021-22 में राजस्थान की प्रति व्यक्ति आय प्रचलित मूल्यों पर कितनी थी?",
  options: ["₹1,35,962", "₹1,56,149", "₹1,20,000", "₹1,40,000"],
  correctIndex: 0,
  explanation: "आर्थिक समीक्षा 2021-22 के अनुसार।",
};

const exam2023: ExtractedQuestionDraft = {
  tempId: "ex-3",
  originalQuestionNumber: 3,
  sourcePageNumber: 2,
  originalText: "वर्ष 2023-24 में राजस्थान की प्रति व्यक्ति आय प्रचलित मूल्यों पर कितनी थी?",
  extractedOptions: ["₹1,56,149", "₹1,75,000", "₹1,80,000", "₹1,60,000"],
  ocrStatus: "high",
  isFlaggedForReview: false,
};

const match3 = matchQuestionAgainstBank(exam2023, [qb2021]);
assert(
  match3.primaryMatchCategory === "concept_related",
  "Test 4: Questions testing different financial years (2021-22 vs 2023-24) classified as Concept-Related (NOT Exact/Similar)",
  match3
);
assert(
  Boolean(match3.meaningfulDifferences && match3.meaningfulDifferences.length > 0),
  "Test 4b: Explicitly notes Different reference years in meaningfulDifferences",
  match3.meaningfulDifferences
);

// ── TEST 5: Conceptual Difference: Constitution Adopted vs Commenced ──
const qbAdopted: Question = {
  id: "qb-const-1",
  topicId: "t2",
  chapterId: "c2",
  text: "भारतीय संविधान सभा द्वारा संविधान को कब अंगीकृत (Adopted) किया गया था?",
  options: ["26 जनवरी 1950", "26 नवम्बर 1949", "15 अगस्त 1947", "9 दिसम्बर 1946"],
  correctIndex: 1,
  explanation: "संविधान 26 नवम्बर 1949 को अंगीकृत किया गया।",
};

const examCommenced: ExtractedQuestionDraft = {
  tempId: "ex-const-2",
  originalQuestionNumber: 4,
  sourcePageNumber: 2,
  originalText: "भारतीय संविधान कब लागू (Came into force / Commenced) हुआ था?",
  extractedOptions: ["26 जनवरी 1950", "26 नवम्बर 1949", "15 अगस्त 1947", "30 जनवरी 1950"],
  ocrStatus: "high",
  isFlaggedForReview: false,
};

const match5 = matchQuestionAgainstBank(examCommenced, [qbAdopted]);
assert(
  match5.primaryMatchCategory === "concept_related",
  "Test 5: Preserves critical distinction between Constitution Adoption and Commencement as Concept-Related",
  match5
);

// ── TEST 6: Negation Inversion (True vs NOT True) ──
const qbPositive: Question = {
  id: "qb-pos-1",
  topicId: "t3",
  chapterId: "c3",
  text: "निम्नलिखित में से कौन सा कथन सही है?",
  options: ["कथन A", "कथन B", "कथन C", "कथन D"],
  correctIndex: 0,
  explanation: "कथन A सही है।",
};

const examNegative: ExtractedQuestionDraft = {
  tempId: "ex-neg-1",
  originalQuestionNumber: 5,
  sourcePageNumber: 3,
  originalText: "निम्नलिखित में से कौन सा कथन सही नहीं है (NOT correct)?",
  extractedOptions: ["कथन A", "कथन B", "कथन C", "कथन D"],
  ocrStatus: "high",
  isFlaggedForReview: false,
};

const match6 = matchQuestionAgainstBank(examNegative, [qbPositive]);
assert(
  match6.primaryMatchCategory !== "exact" && match6.primaryMatchCategory !== "near_exact",
  "Test 6: Negation difference (सही vs सही नहीं) prevents False Exact/Near-Exact classification",
  match6
);

// ── TEST 7: Unmatched Question ──
const examUnrelated: ExtractedQuestionDraft = {
  tempId: "ex-unrelated",
  originalQuestionNumber: 6,
  sourcePageNumber: 3,
  originalText: "क्वांटम उलझाव (Quantum Entanglement) और बेल असमानता का सत्यापन किसने किया?",
  extractedOptions: ["आइंस्टीन", "नील्स बोर", "एलेन आस्पेक्ट", "मैक्स प्लांक"],
  ocrStatus: "high",
  isFlaggedForReview: false,
};

const match7 = matchQuestionAgainstBank(examUnrelated, [qbExact, qb2021, qbAdopted]);
assert(
  match7.primaryMatchCategory === "unmatched",
  "Test 7: Unrelated question correctly categorized as Unmatched (No Reliable Match)",
  match7
);

// ── TEST 8: Empty Question Bank Handling ──
const matchEmpty = matchQuestionAgainstBank(examExact, []);
assert(
  matchEmpty.primaryMatchCategory === "unmatched" && matchEmpty.matchScore === 0,
  "Test 8: Gracefully handles empty question bank without error",
  matchEmpty
);

// ── TEST 9: Strict Mutually Exclusive Coverage Calculations ──
const sampleQuestionMatches: ExamQuestionMatch[] = [
  { ...match1, primaryMatchCategory: "exact" }, // 1
  { ...match1, examQuestionId: "q2", primaryMatchCategory: "exact" }, // 2
  { ...match2, examQuestionId: "q3", primaryMatchCategory: "near_exact" }, // 3
  { ...match2, examQuestionId: "q4", primaryMatchCategory: "similar" }, // 4
  { ...match3, examQuestionId: "q5", primaryMatchCategory: "concept_related" }, // 5
  { ...match7, examQuestionId: "q6", primaryMatchCategory: "unmatched" }, // 6
  { ...match7, examQuestionId: "q7", primaryMatchCategory: "unmatched" }, // 7
  { ...match7, examQuestionId: "q8", primaryMatchCategory: "unmatched" }, // 8
  { ...match7, examQuestionId: "q9", primaryMatchCategory: "unmatched" }, // 9
  { ...match7, examQuestionId: "q10", primaryMatchCategory: "unmatched" }, // 10
];

const coverageResult = calculateCoverageMetrics(sampleQuestionMatches);

assert(coverageResult.total === 10, "Test 9a: Total question count = 10");
assert(coverageResult.exact === 2, "Test 9b: Exact match count = 2");
assert(coverageResult.nearExact === 1, "Test 9c: Near-exact match count = 1");
assert(coverageResult.similar === 1, "Test 9d: Similar match count = 1");
assert(coverageResult.concept === 1, "Test 9e: Concept match count = 1");
assert(coverageResult.unmatched === 5, "Test 9f: Unmatched count = 5");

// Exact coverage = (2 / 10) * 100 = 20%
assert(
  coverageResult.exactCoverage === 20.0,
  "Test 9g: Exact Coverage = 20.0% (Exact / Total * 100)"
);

// Near-exact coverage = ((2 + 1) / 10) * 100 = 30%
assert(
  coverageResult.nearExactCoverage === 30.0,
  "Test 9h: Near-Exact Coverage = 30.0% ((Exact + NearExact) / Total * 100)"
);

// Related coverage = ((2 + 1 + 1 + 1) / 10) * 100 = 50%
assert(
  coverageResult.relatedCoverage === 50.0,
  "Test 9i: Related Question Coverage = 50.0% ((Exact + NearExact + Similar + Concept) / Total * 100)"
);

console.log("\n=================================================");
console.log(`ALL TESTS PASSED: ${passedCount}/${totalCount} tests succeeded with 100% precision!`);
console.log("=================================================");
