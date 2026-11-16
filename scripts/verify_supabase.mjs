import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local
let envConfig = {};
try {
  const content = fs.readFileSync('.env.local', 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        envConfig[key] = val;
      }
    }
  });
} catch (e) {
  console.error('Error reading .env.local:', e.message);
}

const SUPABASE_URL = envConfig.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envConfig.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('--- SUPABASE CONFIGURATION ---');
console.log('URL:', SUPABASE_URL);
console.log('Key length:', SUPABASE_ANON_KEY?.length);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL or SUPABASE_ANON_KEY is missing!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectProject() {
  console.log('\n--- 1. VERIFYING REST API & OPENAPI SCHEMA ---');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_ANON_KEY}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    console.log('REST Endpoint Status:', res.status, res.statusText);
    if (res.ok) {
      const openapi = await res.json();
      const definitions = openapi.definitions || {};
      const paths = openapi.paths || {};
      console.log('Discovered OpenAPI Tables/Entities count:', Object.keys(definitions).length);
      console.log('Tables in OpenAPI:');
      for (const [name, def] of Object.entries(definitions)) {
        console.log(`  - Table: ${name} (Columns: ${Object.keys(def.properties || {}).join(', ')})`);
      }
    } else {
      console.log('OpenAPI fetch returned error text:', await res.text());
    }
  } catch (err) {
    console.error('Error fetching OpenAPI schema:', err.message);
  }

  console.log('\n--- 2. VERIFYING AUTH SETTINGS ---');
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    console.log('Auth Settings Status:', res.status, res.statusText);
    if (res.ok) {
      const authSettings = await res.json();
      console.log('Auth Providers:', authSettings.external || 'None specified');
      console.log('Email Sign-in Enabled:', authSettings.disable_signup === false);
    }
  } catch (err) {
    console.error('Error fetching auth settings:', err.message);
  }

  console.log('\n--- 3. VERIFYING STORAGE BUCKETS ---');
  try {
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.log('Storage Buckets Error:', bucketError.message);
    } else {
      console.log('Storage Buckets found:', buckets?.length || 0);
      buckets?.forEach(b => console.log(`  - Bucket: ${b.name} (id: ${b.id}, public: ${b.public})`));
    }
  } catch (err) {
    console.error('Error checking buckets:', err.message);
  }

  console.log('\n--- 4. QUERYING CORE APPLICATION TABLES ---');
  const candidateTables = [
    'subjects',
    'chapters',
    'topics',
    'questions',
    'pyq_papers',
    'live_tests',
    'test_series',
    'user_profiles',
    'test_results',
    'bookmarks',
    'banners',
    'notifications',
    'news_articles',
    'user_progress',
    'audit_logs',
    'exam_categories',
    'coaching_hierarchies'
  ];

  for (const table of candidateTables) {
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`Table [${table}]: ERROR - ${error.message} (code: ${error.code})`);
      } else {
        console.log(`Table [${table}]: EXISTS, Count: ${count ?? 0}`);
      }
    } catch (e) {
      console.log(`Table [${table}]: Exception - ${e.message}`);
    }
  }
}

inspectProject();
