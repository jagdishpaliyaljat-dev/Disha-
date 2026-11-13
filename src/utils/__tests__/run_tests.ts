import { parseRawMcqText } from '../questionParser';
import { MCQ_TEST_SAMPLES } from './mcqParserTestSamples';

console.log('Running MCQ Parser Regression Test Suite...\n');
let passed = 0;
let failed = 0;
const results: { id: string; name: string; status: 'PASS' | 'FAIL'; reason?: string }[] = [];

for (const sample of MCQ_TEST_SAMPLES) {
  try {
    const res = parseRawMcqText(sample.rawText);
    const q = res.questions[0];
    let ok = true;
    let failReasons: string[] = [];

    if (!q) {
      ok = false;
      failReasons.push('No question parsed');
    } else {
      if (q.type !== sample.expectedType && 
          !((q.type === 'match_column' || q.type === 'match_following') && (sample.expectedType === 'match_column' || sample.expectedType === 'match_following')) &&
          !((q.type === 'boolean' || q.type === 'true_false') && (sample.expectedType === 'boolean' || sample.expectedType === 'true_false'))) {
        ok = false;
        failReasons.push(`Type mismatch (exp: ${sample.expectedType}, got: ${q.type})`);
      }
      if (q.correctIndex !== sample.expectedCorrectIndex) {
        ok = false;
        failReasons.push(`CorrectIndex mismatch (exp: ${sample.expectedCorrectIndex}, got: ${q.correctIndex})`);
      }
      if (q.options?.length !== sample.expectedOptionCount) {
        ok = false;
        failReasons.push(`OptionCount mismatch (exp: ${sample.expectedOptionCount}, got: ${q.options?.length})`);
      }
      if (sample.verifyFn && !sample.verifyFn(q)) {
        ok = false;
        failReasons.push(`Custom verification failed`);
      }
    }

    if (ok) {
      passed++;
      results.push({ id: sample.id, name: sample.name, status: 'PASS' });
    } else {
      failed++;
      results.push({ id: sample.id, name: sample.name, status: 'FAIL', reason: failReasons.join(' | ') });
    }
  } catch (e: any) {
    failed++;
    results.push({ id: sample.id, name: sample.name, status: 'FAIL', reason: e.message });
  }
}

console.log('| Test ID | Test Name | Status | Fail Reason |');
console.log('|---|---|---|---|');
for (const r of results) {
  console.log(`| ${r.id} | ${r.name} | ${r.status} | ${r.reason || '-'} |`);
}
console.log(`\nSummary: ${passed} PASSED / ${failed} FAILED out of ${MCQ_TEST_SAMPLES.length} total samples.`);
