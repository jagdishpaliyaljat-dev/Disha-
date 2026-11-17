#!/usr/bin/env node
/**
 * Generic Supabase curriculum seeder.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... pnpm seed:supabase
 *   pnpm seed:supabase --file pilots/sample_pilot_import.json --dry-run
 *
 * Without --file it uses supabase/seed_data.json when present, otherwise the
 * pilot payload at pilots/sample_pilot_import.json.
 *
 * Supports both payload shapes:
 *   { subject, chapters, topics, questions }   (pilot)
 *   { subjects, chapters, topics, mcqs }       (legacy full seed)
 */

import fs from 'node:fs';
import path from 'node:path';
import { runSeed } from './lib/seedCurriculum.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileFlag = args.indexOf('--file');
const explicitFile = fileFlag !== -1 ? args[fileFlag + 1] : null;

if (fileFlag !== -1 && !explicitFile) {
  console.error('❌ --file requires a path, e.g. --file pilots/sample_pilot_import.json');
  process.exit(1);
}

const candidates = [
  explicitFile,
  'supabase/seed_data.json',
  'pilots/sample_pilot_import.json',
].filter(Boolean);

const file = candidates.find((candidate) => fs.existsSync(path.resolve(process.cwd(), candidate)));

if (!file) {
  console.error('❌ No seed payload found. Looked for:');
  for (const candidate of candidates) console.error(`   ${candidate}`);
  console.error('Pass one explicitly with --file <path>.');
  process.exit(1);
}

if (!explicitFile) {
  console.log(`ℹ️  Using seed payload: ${file}`);
}

runSeed({ file, dryRun })
  .then(({ ok }) => {
    if (!ok) process.exitCode = 1;
  })
  .catch((err) => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
