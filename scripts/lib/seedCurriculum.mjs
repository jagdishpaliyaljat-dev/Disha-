/**
 * Shared Supabase curriculum seeding logic.
 *
 * Supports two payload shapes:
 *   1. Pilot shape:  { subject, chapters, topics, questions }  (already column-shaped)
 *   2. Legacy shape: { subjects, chapters, topics, mcqs }      (camelCase fields)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

export function loadEnv(root = process.cwd()) {
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) continue;
    for (const line of fs.readFileSync(fullPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

const toSubject = (s) => ({
  id: s.id,
  name: s.name || s.title || 'Untitled Subject',
  hindi_name: s.hindi_name || s.hindiName || s.name || s.title || '',
  description: s.description || '',
  icon: s.icon || 'book',
  color: s.color || '#8B1E3F',
  order_index: s.order_index ?? s.order ?? 0,
});

const toChapter = (c) => ({
  id: c.id,
  subject_id: c.subject_id || c.subjectId,
  name: c.name || c.title || 'Untitled Chapter',
  hindi_name: c.hindi_name || c.hindiTitle || c.title || c.name || '',
  order_index: c.order_index ?? c.number ?? 0,
});

const toTopic = (t) => ({
  id: t.id,
  subject_id: t.subject_id || t.subjectId,
  chapter_id: t.chapter_id || t.chapterId,
  name: t.name || t.title || 'Untitled Topic',
  hindi_name: t.hindi_name || t.hindiTitle || t.title || t.name || '',
  order_index: t.order_index ?? t.number ?? 0,
});

const toQuestion = (q) => {
  const data = q.data || {};
  return {
    id: q.id,
    subject_id: q.subject_id || q.subjectId || null,
    chapter_id: q.chapter_id || q.chapterId || null,
    topic_id: q.topic_id || q.topicId || null,
    question: q.question || q.text || data.text || 'Untitled Question',
    options: q.options || data.options || [],
    correct_answer:
      typeof q.correct_answer === 'number'
        ? q.correct_answer
        : typeof q.correctIndex === 'number'
          ? q.correctIndex
          : (data.correctIndex ?? 0),
    explanation: q.explanation || data.explanation || '',
    exam: q.exam || data.exam || 'RPSC / RSMSSB',
    year: String(q.year || data.year || '2024'),
    level: q.level || q.difficulty || data.level || 'medium',
  };
};

/** Normalize either supported payload shape into upsert order. */
export function normalizePayload(payload) {
  const pilot = Boolean(payload.subject) || Array.isArray(payload.questions);
  const subjects = pilot
    ? payload.subject
      ? [payload.subject]
      : []
    : payload.subjects || [];
  const questions = pilot ? payload.questions || [] : payload.mcqs || [];

  return [
    ['subjects', subjects.map(toSubject)],
    ['chapters', (payload.chapters || []).map(toChapter)],
    ['topics', (payload.topics || []).map(toTopic)],
    ['questions', questions.map(toQuestion)],
  ];
}

export function readPayload(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Seed payload not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

/**
 * Seed a payload file into Supabase.
 * The service-role key is required because curriculum tables are RLS-protected.
 */
export async function runSeed({ file, dryRun = false, root = process.cwd() } = {}) {
  loadEnv(root);

  if (!file) throw new Error('No seed file provided');
  const payload = readPayload(path.resolve(root, file));
  const plan = normalizePayload(payload);
  const totalRows = plan.reduce((sum, [, rows]) => sum + rows.length, 0);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      'Missing SUPABASE_URL (or VITE_SUPABASE_URL) in the environment or .env.local',
    );
  }

  if (dryRun) {
    console.log('🧪 Dry run — no writes will be made.');
    console.log(`📡 Target: ${supabaseUrl}`);
    for (const [table, rows] of plan) {
      console.log(`   ${table.padEnd(10)} ${String(rows.length).padStart(3)} row(s)`);
      if (rows[0]) console.log(`      e.g. ${rows[0].id}`);
    }
    console.log(`   ${'TOTAL'.padEnd(10)} ${String(totalRows).padStart(3)} row(s)`);
    return { ok: true, plan, totalRows };
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      [
        'Missing SUPABASE_SERVICE_ROLE_KEY.',
        '',
        'The publishable/anon key cannot write to curriculum tables (RLS blocks it).',
        'Get the service-role key from:',
        '  Supabase Dashboard → Project Settings → API → service_role secret',
        'Then run:',
        '  SUPABASE_SERVICE_ROLE_KEY=eyJ... pnpm seed:pilot',
        '',
        'To preview without writing anything:',
        '  node scripts/seed_pilot.mjs --dry-run',
      ].join('\n'),
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('🚀 Seeding DISHA 20-20 curriculum');
  console.log(`📡 Target: ${supabaseUrl}`);
  console.log('');

  for (const [table, rows] of plan) {
    if (!rows.length) {
      console.log(`⏭️  ${table}: nothing to seed`);
      continue;
    }
    const clean = rows.map((row) => {
      const out = {};
      for (const [key, value] of Object.entries(row)) {
        if (!isMissing(value)) out[key] = value;
      }
      return out;
    });
    const { error } = await supabase.from(table).upsert(clean, { onConflict: 'id' });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
    console.log(`✅ ${table}: ${rows.length} row(s) upserted`);
  }

  console.log('');
  let ok = true;
  for (const [table, rows] of plan) {
    if (!rows.length) continue;
    const ids = rows.map((row) => row.id);
    const { data, error, count } = await supabase
      .from(table)
      .select('id', { count: 'exact' })
      .in('id', ids);
    if (error) {
      console.error(`⚠️  Verification failed for ${table}: ${error.message}`);
      ok = false;
      continue;
    }
    const found = data?.length ?? 0;
    if (found < ids.length) {
      console.error(`⚠️  ${table}: expected ${ids.length} seeded rows, found ${found}`);
      ok = false;
    } else {
      console.log(`🔎 ${table}: ${found}/${ids.length} present (table total: ${count ?? '?'})`);
    }
  }

  console.log('');
  if (ok) {
    console.log('🎉 Seed complete.');
  } else {
    console.error('⚠️  Seed ran but verification found missing rows. Check RLS and rerun.');
  }
  return { ok, plan, totalRows };
}
