import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local
let env = {};
try {
  const content = fs.readFileSync('.env.local', 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  });
} catch (e) {
  console.error('Error reading .env.local:', e.message);
}

const SUPABASE_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  return { p50, p95, p99, min, max, avg };
}

async function runConcurrencyTier(tierName, totalRequests, concurrency) {
  console.log(`\n============================================================`);
  console.log(`RUNNING TIER: ${tierName} (${totalRequests} total requests, ${concurrency} concurrency)`);
  console.log(`============================================================`);

  const latencies = [];
  let successfulRequests = 0;
  let failedRequests = 0;
  let totalBytesTransferred = 0;
  const startTime = performance.now();

  let currentIndex = 0;

  async function worker() {
    while (currentIndex < totalRequests) {
      const idx = currentIndex++;
      const reqStart = performance.now();
      try {
        // Realistic mixed workload:
        // 50% Question/Curriculum lookups, 30% Head count checks, 20% Mock attempt validation simulation
        const mod = idx % 10;
        let res;
        if (mod < 5) {
          res = await supabase.from('subjects').select('id, name, order_index').limit(10);
        } else if (mod < 8) {
          res = await supabase.from('questions').select('id', { count: 'exact', head: true });
        } else {
          res = await supabase.from('questions').select('id, question, options').limit(5);
        }

        const duration = performance.now() - reqStart;
        latencies.push(duration);

        if (res.error) {
          failedRequests++;
        } else {
          successfulRequests++;
          // Estimate byte transfer
          const byteLen = JSON.stringify(res.data || {}).length + 200; // headers estimation
          totalBytesTransferred += byteLen;
        }
      } catch (err) {
        const duration = performance.now() - reqStart;
        latencies.push(duration);
        failedRequests++;
      }
    }
  }

  // Spawn concurrency workers
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalTimeSeconds = (performance.now() - startTime) / 1000;
  const stats = calculatePercentiles(latencies);
  const throughput = Math.round(successfulRequests / totalTimeSeconds);
  const failureRate = ((failedRequests / totalRequests) * 100).toFixed(2);

  console.log(`Total Completed:      ${successfulRequests + failedRequests} / ${totalRequests}`);
  console.log(`Success Count:        ${successfulRequests}`);
  console.log(`Failure Count:        ${failedRequests} (${failureRate}%)`);
  console.log(`Total Wall Clock:     ${totalTimeSeconds.toFixed(2)}s`);
  console.log(`Throughput:           ${throughput} req/sec`);
  console.log(`Estimated Egress:     ${(totalBytesTransferred / 1024).toFixed(2)} KB`);
  console.log(`Latency (p50):        ${Math.round(stats.p50)} ms`);
  console.log(`Latency (p95):        ${Math.round(stats.p95)} ms`);
  console.log(`Latency (p99):        ${Math.round(stats.p99)} ms`);
  console.log(`Latency (avg):        ${stats.avg} ms`);
  console.log(`Latency (min - max):  ${Math.round(stats.min)} ms - ${Math.round(stats.max)} ms`);

  return {
    tierName,
    totalRequests,
    concurrency,
    successfulRequests,
    failedRequests,
    failureRate: `${failureRate}%`,
    totalTimeSeconds: Number(totalTimeSeconds.toFixed(2)),
    throughputReqSec: throughput,
    egressKb: Number((totalBytesTransferred / 1024).toFixed(2)),
    stats
  };
}

async function runFullLoadTest() {
  console.log('############################################################');
  console.log('DISHA 20-20 — PRODUCTION LOAD & CONCURRENCY BENCHMARK');
  console.log('Target Endpoint:', SUPABASE_URL);
  console.log('Timestamp:', new Date().toISOString());
  console.log('############################################################');

  // Tier 1: 100 concurrent requests
  const tier1 = await runConcurrencyTier('Tier 1: 100 Concurrent Requests', 100, 100);

  // Tier 2: 500 requests at 50 concurrency
  const tier2 = await runConcurrencyTier('Tier 2: 500 Requests (50 Concurrency)', 500, 50);

  // Tier 3: 1,000 requests at 100 concurrency
  const tier3 = await runConcurrencyTier('Tier 3: 1,000 Requests (100 Concurrency)', 1000, 100);

  console.log('\n============================================================');
  console.log('SUMMARY OF ALL CONCURRENCY TIERS');
  console.log('============================================================');
  console.table([
    {
      Tier: '100 Concurrent',
      Reqs: tier1.totalRequests,
      P50: `${Math.round(tier1.stats.p50)}ms`,
      P95: `${Math.round(tier1.stats.p95)}ms`,
      P99: `${Math.round(tier1.stats.p99)}ms`,
      Throughput: `${tier1.throughputReqSec} r/s`,
      FailRate: tier1.failureRate
    },
    {
      Tier: '500 Requests',
      Reqs: tier2.totalRequests,
      P50: `${Math.round(tier2.stats.p50)}ms`,
      P95: `${Math.round(tier2.stats.p95)}ms`,
      P99: `${Math.round(tier2.stats.p99)}ms`,
      Throughput: `${tier2.throughputReqSec} r/s`,
      FailRate: tier2.failureRate
    },
    {
      Tier: '1000 Requests',
      Reqs: tier3.totalRequests,
      P50: `${Math.round(tier3.stats.p50)}ms`,
      P95: `${Math.round(tier3.stats.p95)}ms`,
      P99: `${Math.round(tier3.stats.p99)}ms`,
      Throughput: `${tier3.throughputReqSec} r/s`,
      FailRate: tier3.failureRate
    }
  ]);

  // Write results to JSON artifact for reporting
  fs.writeFileSync(
    'reports/load_test_results.json',
    JSON.stringify({ timestamp: new Date().toISOString(), tiers: [tier1, tier2, tier3] }, null, 2)
  );
  console.log('\nLoad test benchmark results recorded to reports/load_test_results.json');
}

runFullLoadTest().catch(console.error);
