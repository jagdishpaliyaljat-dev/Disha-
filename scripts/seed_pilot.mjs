#!/usr/bin/env node
/**
 * Seed the DISHA 20-20 pilot curriculum into Supabase.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... pnpm seed:pilot
 *   node scripts/seed_pilot.mjs --dry-run
 *
 * The service-role key is required: the anon/publishable key cannot write to
 * curriculum tables because of row-level security.
 */

import { runSeed } from './lib/seedCurriculum.mjs';

const dryRun = process.argv.includes('--dry-run');

runSeed({ file: 'pilots/sample_pilot_import.json', dryRun })
  .then(({ ok }) => {
    if (!ok) process.exitCode = 1;
  })
  .catch((err) => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
