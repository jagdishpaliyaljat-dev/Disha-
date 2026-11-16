import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Read environment variables from .env or .env.local if present
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...vals] = trimmed.split('=');
        if (key && !process.env[key.trim()]) {
          let val = vals.join('=').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key.trim()] = val;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Missing Supabase credentials!");
  console.error("Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) are set in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function runSeed() {
  console.log("🚀 Starting Supabase Database Seed for DISHA 20-20...");
  console.log(`📡 Connecting to: ${supabaseUrl}`);

  const seedFilePath = path.resolve(process.cwd(), 'supabase/seed_data.json');
  if (!fs.existsSync(seedFilePath)) {
    console.error("❌ Seed file not found at: supabase/seed_data.json");
    process.exit(1);
  }

  const rawData = fs.readFileSync(seedFilePath, 'utf8');
  const seed = JSON.parse(rawData);

  // 1. Upsert Subjects
  console.log(`\n📚 Upserting ${seed.subjects.length} Subjects...`);
  const subjectsToInsert = seed.subjects.map(s => ({
    id: s.id,
    name: s.name,
    hindi_name: s.hindiName || s.name,
    description: s.description || '',
    icon: s.icon || 'book',
    color: s.color || '#8B1E3F',
    order_index: s.order || 0
  }));

  const { error: subjErr } = await supabase
    .from('subjects')
    .upsert(subjectsToInsert, { onConflict: 'id' });

  if (subjErr) {
    console.error("❌ Error upserting subjects:", subjErr.message);
    process.exit(1);
  }
  console.log("✅ Subjects upserted successfully.");

  // 2. Upsert Chapters
  console.log(`\n📖 Upserting ${seed.chapters.length} Chapters...`);
  const chaptersToInsert = seed.chapters.map(c => ({
    id: c.id,
    subject_id: c.subjectId,
    name: c.title,
    hindi_name: c.hindiTitle || c.title,
    order_index: c.number || 0
  }));

  const { error: chErr } = await supabase
    .from('chapters')
    .upsert(chaptersToInsert, { onConflict: 'id' });

  if (chErr) {
    console.error("❌ Error upserting chapters:", chErr.message);
    process.exit(1);
  }
  console.log("✅ Chapters upserted successfully.");

  // 3. Upsert Topics
  console.log(`\n📑 Upserting ${seed.topics.length} Topics...`);
  const topicsToInsert = seed.topics.map(t => ({
    id: t.id,
    chapter_id: t.chapterId,
    subject_id: t.subjectId,
    name: t.title,
    hindi_name: t.hindiTitle || t.title,
    order_index: t.number || 0
  }));

  const { error: topErr } = await supabase
    .from('topics')
    .upsert(topicsToInsert, { onConflict: 'id' });

  if (topErr) {
    console.error("❌ Error upserting topics:", topErr.message);
    process.exit(1);
  }
  console.log("✅ Topics upserted successfully.");

  // 4. Upsert Questions in Batches
  const mcqs = seed.mcqs || [];
  console.log(`\n❓ Upserting ${mcqs.length} Questions (in batches of 100)...`);
  const batchSize = 100;
  let insertedCount = 0;

  for (let i = 0; i < mcqs.length; i += batchSize) {
    const chunk = mcqs.slice(i, i + batchSize);
    const questionsBatch = chunk.map(q => {
      const qText = q.text || q.data?.text || 'Untitled Question';
      const qOpts = q.options || q.data?.options || [];
      const qCorrect = typeof q.correctIndex === 'number' ? q.correctIndex : (q.data?.correctIndex ?? 0);
      const qExp = q.explanation || q.data?.explanation || '';
      const qExam = q.exam || q.data?.exam || 'RPSC / RSMSSB';
      const qYear = String(q.year || q.data?.year || '2024');
      const qLevel = q.difficulty || q.level || 'medium';

      return {
        id: q.id,
        subject_id: q.subjectId || null,
        chapter_id: q.chapterId || null,
        topic_id: q.topicId || null,
        question: qText,
        options: qOpts,
        correct_answer: qCorrect,
        explanation: qExp,
        exam: qExam,
        year: qYear,
        level: qLevel,
        verified: true
      };
    });

    const { error: qErr } = await supabase
      .from('questions')
      .upsert(questionsBatch, { onConflict: 'id' });

    if (qErr) {
      console.error(`❌ Error in batch ${i / batchSize + 1}:`, qErr.message);
    } else {
      insertedCount += questionsBatch.length;
      process.stdout.write(`  -> Uploaded ${insertedCount} / ${mcqs.length} MCQs...\r`);
    }
  }

  console.log(`\n\n🎉 Seed Completed!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Total Subjects:  ${seed.subjects.length}`);
  console.log(`✅ Total Chapters:  ${seed.chapters.length}`);
  console.log(`✅ Total Topics:    ${seed.topics.length}`);
  console.log(`✅ Total Questions: ${insertedCount}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

runSeed().catch(err => {
  console.error("Unhandled error during seed:", err);
  process.exit(1);
});
