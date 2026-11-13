import { parseRawMcqText } from '../questionParser';
import { MCQ_TEST_SAMPLES } from './mcqParserTestSamples';
import { MATH_FIXTURES } from './mcqMathTestSamples';
import { MCQ_PHYSICS_TEST_SAMPLES } from './mcqPhysicsTestSamples';
import { MCQ_CHEMISTRY_TEST_SAMPLES } from './mcqChemistryTestSamples';

console.log('===============================================================');
console.log(' RUNNING FULL REGRESSION SUITE (MATH, PHYSICS, CHEMISTRY)');
console.log('===============================================================\n');

let totalPassed = 0;
let totalFailed = 0;

console.log('--- PART 1: ORIGINAL REGRESSION SUITE (38 TESTS) ---');
console.log('| ID | Description | Result |');
console.log('|---|---|---|');

MCQ_TEST_SAMPLES.forEach((sample) => {
  const res = parseRawMcqText(sample.rawText);
  if (res.questions.length === 0) {
    console.log(`| \`${sample.id}\` | ${sample.name} | ❌ FAIL (0 questions) |`);
    totalFailed++;
    return;
  }
  const q = res.questions[0];
  const typeMatch = q.type === sample.expectedType;
  const ansMatch = q.correctIndex === sample.expectedCorrectIndex;
  const customVerify = sample.verifyFn ? sample.verifyFn(q) : true;

  if (typeMatch && ansMatch && customVerify) {
    console.log(`| \`${sample.id}\` | ${sample.name} | ✅ PASS |`);
    totalPassed++;
  } else {
    console.log(`| \`${sample.id}\` | ${sample.name} | ❌ FAIL (type=${q.type}, ans=${q.correctIndex}) |`);
    totalFailed++;
  }
});

console.log('\n--- PART 2: MATH & EDGE CASE FIXTURES (29 TESTS) ---');
console.log('| ID | MathType | Description | Opts | Ans | Result |');
console.log('|---|---|---|---|---|---|');

MATH_FIXTURES.forEach((sample) => {
  const res = parseRawMcqText(sample.rawText);
  const count = res.questions.length;

  if (count === 0) {
    console.log(`| \`${sample.id}\` | ${sample.mathType} | ${sample.description} | 0 | -1 | ❌ FAIL |`);
    totalFailed++;
    return;
  }

  const q = res.questions[0];
  const optCount = q.options.length;
  const ansMatch = q.correctIndex === sample.expectedCorrectIndex;
  const mathTypeMatch = q.meta?.mathType === sample.mathType;

  if (optCount === 4 && ansMatch && mathTypeMatch) {
    console.log(`| \`${sample.id}\` | ${sample.mathType} | ${sample.description} | ${optCount} | ${q.correctIndex} | ✅ PASS |`);
    totalPassed++;
  } else {
    console.log(`| \`${sample.id}\` | ${sample.mathType} | ${sample.description} | ${optCount} | ${q.correctIndex} | ❌ FAIL (type=${q.meta?.mathType}) |`);
    totalFailed++;
  }
});

console.log('\n--- PART 3: PHYSICS SPECIALIZED FIXTURES (25 TESTS) ---');
console.log('| ID | PhysicsTopic | Description | Result |');
console.log('|---|---|---|---|');

MCQ_PHYSICS_TEST_SAMPLES.forEach((sample) => {
  const res = parseRawMcqText(sample.rawText);
  const count = res.questions.length;

  if (count === 0) {
    console.log(`| \`${sample.id}\` | ${sample.physicsTopic} | ${sample.description} | ❌ FAIL (0 q) |`);
    totalFailed++;
    return;
  }

  const q = res.questions[0];
  const optCount = q.options.length;
  const ansMatch = q.correctIndex === sample.correctIndex;
  const topicMatch = q.meta?.physicsTopic === sample.physicsTopic;

  if (optCount === 4 && ansMatch && topicMatch) {
    console.log(`| \`${sample.id}\` | ${sample.physicsTopic} | ${sample.description} | ✅ PASS |`);
    totalPassed++;
  } else {
    console.log(`| \`${sample.id}\` | ${sample.physicsTopic} | ${sample.description} | ❌ FAIL (topic=${q.meta?.physicsTopic}) |`);
    totalFailed++;
  }
});

console.log('\n--- PART 4: CHEMISTRY SPECIALIZED FIXTURES (30 TESTS) ---');
console.log('| ID | ChemTopic | Description | Formula | Result |');
console.log('|---|---|---|---|---|');

MCQ_CHEMISTRY_TEST_SAMPLES.forEach((sample) => {
  const res = parseRawMcqText(sample.rawText);
  const count = res.questions.length;

  if (count === 0) {
    console.log(`| \`${sample.id}\` | ${sample.chemTopic} | ${sample.description} | - | ❌ FAIL (0 q) |`);
    totalFailed++;
    return;
  }

  const q = res.questions[0];
  const optCount = q.options.length;
  const ansMatch = q.correctIndex === sample.correctIndex;
  const hasFormula = Boolean(q.meta?.hasFormula);
  const chemTopicMatch = q.meta?.chemTopic === sample.chemTopic;
  const mathTypeMatch = q.meta?.mathType === 'chemistry';

  const formulaMatch = hasFormula === sample.hasFormula;
  const isPass = optCount === 4 && ansMatch && chemTopicMatch && mathTypeMatch && formulaMatch;

  if (isPass) {
    console.log(`| \`${sample.id}\` | ${sample.chemTopic} | ${sample.description} | ${hasFormula} | ✅ PASS |`);
    totalPassed++;
  } else {
    let failReason = "";
    if (optCount !== 4) failReason += `opts=${optCount} `;
    if (!ansMatch) failReason += `ans=${q.correctIndex}(exp=${sample.correctIndex}) `;
    if (!mathTypeMatch) failReason += `type=${q.meta?.mathType} `;
    if (!chemTopicMatch) failReason += `topic=${q.meta?.chemTopic}(exp=${sample.chemTopic}) `;
    if (!formulaMatch) failReason += `formula=${hasFormula} `;
    
    console.log(`| \`${sample.id}\` | ${sample.chemTopic} | ${sample.description} | ${hasFormula} | ❌ FAIL (${failReason.trim()}) |`);
    totalFailed++;
  }
});

console.log('\n===============================================================');
console.log(` SUITE SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED (TOTAL ${totalPassed + totalFailed})`);
console.log('===============================================================\n');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
