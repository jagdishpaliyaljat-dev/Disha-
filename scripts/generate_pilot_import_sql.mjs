import fs from 'fs';
import path from 'path';

const pilotPath = path.resolve('pilots/sample_pilot_import.json');
const pilotData = JSON.parse(fs.readFileSync(pilotPath, 'utf8'));

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

let sql = `-- Pilot Curriculum Import Script
BEGIN;

-- 1. Insert Subject
INSERT INTO public.subjects (id, name, hindi_name, description, icon, color, order_index)
VALUES (
  ${escapeSql(pilotData.subject.id)},
  ${escapeSql(pilotData.subject.name)},
  ${escapeSql(pilotData.subject.hindi_name)},
  ${escapeSql(pilotData.subject.description)},
  ${escapeSql(pilotData.subject.icon)},
  ${escapeSql(pilotData.subject.color)},
  ${pilotData.subject.order_index}
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  hindi_name = EXCLUDED.hindi_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  order_index = EXCLUDED.order_index,
  updated_at = NOW();

-- 2. Insert Chapters
`;

for (const chap of pilotData.chapters) {
  sql += `INSERT INTO public.chapters (id, subject_id, name, hindi_name, order_index)
VALUES (
  ${escapeSql(chap.id)},
  ${escapeSql(chap.subject_id)},
  ${escapeSql(chap.name)},
  ${escapeSql(chap.hindi_name)},
  ${chap.order_index}
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  name = EXCLUDED.name,
  hindi_name = EXCLUDED.hindi_name,
  order_index = EXCLUDED.order_index,
  updated_at = NOW();
`;
}

sql += `\n-- 3. Insert Topics\n`;

for (const top of pilotData.topics) {
  sql += `INSERT INTO public.topics (id, subject_id, chapter_id, name, hindi_name, order_index)
VALUES (
  ${escapeSql(top.id)},
  ${escapeSql(top.subject_id)},
  ${escapeSql(top.chapter_id)},
  ${escapeSql(top.name)},
  ${escapeSql(top.hindi_name)},
  ${top.order_index}
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  name = EXCLUDED.name,
  hindi_name = EXCLUDED.hindi_name,
  order_index = EXCLUDED.order_index,
  updated_at = NOW();
`;
}

sql += `\n-- 4. Insert Questions\n`;

for (const q of pilotData.questions) {
  const optionsJson = JSON.stringify(q.options);
  sql += `INSERT INTO public.questions (id, subject_id, chapter_id, topic_id, question, options, correct_answer, explanation, exam, year, level, verified)
VALUES (
  ${escapeSql(q.id)},
  ${escapeSql(q.subject_id)},
  ${escapeSql(q.chapter_id)},
  ${escapeSql(q.topic_id)},
  ${escapeSql(q.question)},
  ${escapeSql(optionsJson)}::jsonb,
  ${q.correct_answer},
  ${escapeSql(q.explanation)},
  ${escapeSql(q.exam)},
  ${escapeSql(q.year)},
  ${escapeSql(q.level)},
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  topic_id = EXCLUDED.topic_id,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  exam = EXCLUDED.exam,
  year = EXCLUDED.year,
  level = EXCLUDED.level,
  verified = EXCLUDED.verified,
  updated_at = NOW();
`;
}

sql += `\nCOMMIT;\n`;

const outPath = path.resolve('pilots/import_pilot.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Generated ${outPath} successfully (${sql.length} bytes).`);
