import { parseRawMcqText } from '../questionParser';
import { MCQ_TEST_SAMPLES } from './mcqParserTestSamples';

console.log('================================================================');
console.log('  REGRESSION SUITE: "rajasthan_energy_4q" ASSERTIONS EVALUATION  ');
console.log('================================================================\n');

const fixture = MCQ_TEST_SAMPLES.find(s => s.id === 'rajasthan_energy_4q');

if (!fixture) {
  console.error('Fixture rajasthan_energy_4q not found!');
  process.exit(1);
}

const parseResult = parseRawMcqText(fixture.rawText);
const questions = parseResult.questions || [];
const errors = parseResult.errors || [];

const testRows: { assertion: string; question: string; status: 'PASS' | 'FAIL'; expected: string; got: string }[] = [];

// Assertion 1: Total questions = 4, errors = []
{
  const totalOk = questions.length === 4;
  const errsOk = errors.length === 0;
  testRows.push({
    assertion: 'Total questions count === 4',
    question: 'Global Batch',
    status: totalOk ? 'PASS' : 'FAIL',
    expected: '4',
    got: `${questions.length}`
  });
  testRows.push({
    assertion: 'Parser errors === []',
    question: 'Global Batch',
    status: errsOk ? 'PASS' : 'FAIL',
    expected: '0 errors',
    got: `${errors.length} errors (${errors.map((e: any) => e.reason).join(', ')})`
  });
}

// For each question Q1 to Q4
questions.forEach((q: any, idx: number) => {
  const qLabel = `Q${idx + 1}`;

  // Assertion 2: type = statement_based
  testRows.push({
    assertion: 'type === "statement_based"',
    question: qLabel,
    status: q.type === 'statement_based' ? 'PASS' : 'FAIL',
    expected: 'statement_based',
    got: `${q.type}`
  });

  // Assertion 3: statements.length = 3, label order 1, 2, 3 (without '.' or ':')
  const stmts = q.statements || [];
  const stmtsCountOk = stmts.length === 3;
  const stmtsOrderOk = stmtsCountOk && /^1\s/.test(stmts[0]) && /^2\s/.test(stmts[1]) && /^3\s/.test(stmts[2]);
  testRows.push({
    assertion: 'statements.length === 3 with number labels 1, 2, 3 (no . or :)',
    question: qLabel,
    status: (stmtsCountOk && stmtsOrderOk) ? 'PASS' : 'FAIL',
    expected: '3 statements (labels "1", "2", "3")',
    got: `${stmts.length} statements (${stmts.map((s: string) => s.slice(0, 10)).join(' | ')})`
  });

  // Assertion 4: askLine normalized check (starts with "उपर्युक्त", ends with "?", not in stem)
  const askLineText = (q.askLine || '').trim();
  const askLineOk = typeof q.askLine === 'string' && askLineText.startsWith('उपर्युक्त') && askLineText.endsWith('?');
  const askLineNotInStem = typeof q.question === 'string' && !q.question.includes('उपर्युक्त');
  testRows.push({
    assertion: 'askLine separate from stem & starts with "उपर्युक्त" & ends with "?"',
    question: qLabel,
    status: (askLineOk && askLineNotInStem) ? 'PASS' : 'FAIL',
    expected: 'askLine startsWith("उपर्युक्त") && endsWith("?") & removed from stem',
    got: askLineOk ? (askLineNotInStem ? 'Extracted cleanly' : 'Still in stem') : `Got askLine: "${q.askLine || ''}"`
  });

  // Assertion 5: options 4: A "केवल 1 और 2", B "केवल 2 और 3", C "केवल 1 और 3", D "1, 2 और 3"
  const expectedOpts = ['केवल 1 और 2', 'केवल 2 और 3', 'केवल 1 और 3', '1, 2 और 3'];
  const opts = q.options || [];
  const optsMatch = opts.length === 4 && expectedOpts.every((opt, i) => (opts[i] || '').trim() === opt);
  testRows.push({
    assertion: 'options match exact A, B, C, D choices',
    question: qLabel,
    status: optsMatch ? 'PASS' : 'FAIL',
    expected: expectedOpts.join(' | '),
    got: opts.join(' | ')
  });

  // Assertion 6: correctIndex = 3
  testRows.push({
    assertion: 'correctIndex === 3 (Option D)',
    question: qLabel,
    status: q.correctIndex === 3 ? 'PASS' : 'FAIL',
    expected: '3',
    got: `${q.correctIndex}`
  });

  // Assertion 7: explanation does not contain PAGE, Questions Generated, Progress, Type NEXT
  const exp = q.explanation || '';
  const expFooterClean = !/PAGE|Questions Generated|Progress|Type NEXT/i.test(exp);
  testRows.push({
    assertion: 'explanation stripped of PAGE / generator footers',
    question: qLabel,
    status: expFooterClean ? 'PASS' : 'FAIL',
    expected: 'Clean explanation text without footer',
    got: expFooterClean ? 'Clean' : `Footer found in: "${exp}"`
  });

  // Assertion 8: stem does not contain "— Page 1 —"
  const stem = q.question || '';
  const stemPageClean = !stem.includes('— Page 1 —') && !stem.includes('Page 1');
  testRows.push({
    assertion: 'stem does not contain page markers ("— Page 1 —")',
    question: qLabel,
    status: stemPageClean ? 'PASS' : 'FAIL',
    expected: 'Stem free of page markers',
    got: stemPageClean ? 'Clean' : `Page marker in stem: "${stem.slice(0, 30)}"`
  });

  // Assertion 9: stem does NOT contain "*" and does NOT contain statement body text
  const stemNoAsterisk = !stem.includes('*');
  const stemNoStmtText = stmts.length > 0 && stmts.every((s: string) => {
    const textOnly = s.replace(/^\d+\s*/, '').trim();
    return textOnly.length === 0 || !stem.includes(textOnly);
  });
  testRows.push({
    assertion: 'stem contains NO "*" and NO statement body text',
    question: qLabel,
    status: (stemNoAsterisk && stemNoStmtText) ? 'PASS' : 'FAIL',
    expected: 'Stem contains intro line only (no bullets or statement body)',
    got: (stemNoAsterisk && stemNoStmtText) ? 'Clean Intro Only' : `Asterisk: ${!stemNoAsterisk}, Stmt text in stem: ${!stemNoStmtText}`
  });
});

console.log('| Assertion Description | Question | Status | Expected | Got |');
console.log('|---|---|---|---|---|');
testRows.forEach(row => {
  console.log(`| ${row.assertion} | ${row.question} | ${row.status} | ${row.expected} | ${row.got} |`);
});

const passCount = testRows.filter(r => r.status === 'PASS').length;
const failCount = testRows.filter(r => r.status === 'FAIL').length;
console.log(`\nFinal Result: ${passCount} PASSED / ${failCount} FAILED out of ${testRows.length} assertions.`);
