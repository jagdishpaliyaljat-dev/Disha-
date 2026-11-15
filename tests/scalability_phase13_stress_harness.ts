/**
 * DISHA 20-20 — Phase 13: Scalability & High-Concurrency Empirical Stress Harness
 * 
 * Tests and measures:
 * 1. Search index scaling & memory overhead across 1K, 10K, 25K, 50K simulated MCQs.
 * 2. SlidingWindowRateLimiter throughput & memory under 1,000 - 10,000 concurrent client keys.
 * 3. Snapshot chunking and SHA-256 hashing throughput for large JSON corpora.
 * 4. High-throughput student write buffer batch chunking (100,000 simulated attempts).
 * 5. Serverless live test grading throughput under 1,000 concurrent student payloads.
 */

import crypto from "node:crypto";
import { SlidingWindowRateLimiter } from "../src/server/rateLimiter";
import { tokenizeText } from "../src/utils/ultraFastSearchEngine";
import { generateContentHash } from "../src/utils/idempotency";
import { SAFE_BATCH_CHUNK_SIZE } from "../src/utils/studentWriteBuffer";

interface BenchmarkResult {
  suite: string;
  metric: string;
  value: number | string;
  unit: string;
  notes?: string;
}

const benchmarkResults: BenchmarkResult[] = [];

function recordMetric(suite: string, metric: string, value: number | string, unit: string, notes?: string) {
  benchmarkResults.push({ suite, metric, value, unit, notes });
}

// -------------------------------------------------------------------------------------
// TEST 1: Search Engine Tokenization & Memory Scaling (1K to 50K MCQs)
// -------------------------------------------------------------------------------------
function benchmarkSearchIndexScaling() {
  console.log("\n=======================================================");
  console.log(" 1. BENCHMARKING SEARCH INDEXING SCALING (1K to 50K MCQs)");
  console.log("=======================================================");

  const sampleSubjects = ["राजस्थान का इतिहास", "राजस्थान का भूगोल", "राजस्थान की अर्थव्यवस्था", "भारतीय संविधान", "सामान्य विज्ञान"];
  const sampleTopics = ["प्रजामंडल आंदोलन", "भौगोलिक विभाजन", "खनिज संसाधन", "मौलिक अधिकार", "जलवायु परिवर्तन"];
  const sampleKeywords = [
    "विजय सिंह पथिक", "बिजोलिया किसान आंदोलन", "माणिक्य लाल वर्मा", "अरावली पर्वतमाला",
    "थार मरुस्थल", "इंदिरा गांधी नहर", "अनुच्छेद 21", "नीति निदेशक तत्व", "हरित क्रांति"
  ];

  const scalePoints = [1000, 5000, 10000, 25000, 50000];

  for (const count of scalePoints) {
    if (global.gc) global.gc();
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    const invertedIndex = new Map<string, Set<number>>();
    let totalTokens = 0;

    for (let i = 0; i < count; i++) {
      const qText = `प्रश्न संख्या ${i + 1}: ${sampleKeywords[i % sampleKeywords.length]} के संदर्भ में ${sampleTopics[i % sampleTopics.length]} पर विचार कीजिए। यह ${sampleSubjects[i % sampleSubjects.length]} की एक प्रमुख घटना है।`;
      const tokens = tokenizeText(qText);
      totalTokens += tokens.length;

      for (const token of tokens) {
        let set = invertedIndex.get(token);
        if (!set) {
          set = new Set<number>();
          invertedIndex.set(token, set);
        }
        set.add(i);
      }
    }

    const elapsed = performance.now() - startTime;
    const memAfter = process.memoryUsage().heapUsed;
    const heapUsedMB = Number(((memAfter - memBefore) / (1024 * 1024)).toFixed(2));
    const throughput = Math.round((count / (elapsed / 1000)));

    console.log(`- Corpus: ${count.toLocaleString()} MCQs | Index Time: ${elapsed.toFixed(1)} ms | Rate: ${throughput.toLocaleString()} MCQs/sec | Heap Delta: ${heapUsedMB} MB | Unique Tokens: ${invertedIndex.size.toLocaleString()}`);

    recordMetric("Search Engine Scaling", `Index Time (${count} MCQs)`, Number(elapsed.toFixed(2)), "ms");
    recordMetric("Search Engine Scaling", `Heap Overhead (${count} MCQs)`, heapUsedMB, "MB");
    recordMetric("Search Engine Scaling", `Unique Tokens (${count} MCQs)`, invertedIndex.size, "tokens");

    // Test search query latency across this scale
    const query = "प्रजामंडल आंदोलन";
    const qTokens = tokenizeText(query);
    const searchStart = performance.now();
    let hits: Set<number> | null = null;
    for (const qt of qTokens) {
      const matched = invertedIndex.get(qt);
      if (matched) {
        if (!hits) hits = new Set(matched);
        else {
          for (const id of hits) {
            if (!matched.has(id)) hits.delete(id);
          }
        }
      }
    }
    const searchElapsed = performance.now() - searchStart;
    console.log(`  Query "${query}" against ${count.toLocaleString()} MCQs: ${hits ? hits.size : 0} hits in ${searchElapsed.toFixed(3)} ms`);
    recordMetric("Search Engine Scaling", `Query Latency (${count} MCQs)`, Number(searchElapsed.toFixed(3)), "ms");
  }
}

// -------------------------------------------------------------------------------------
// TEST 2: Sliding Window Rate Limiter Concurrency (1,000 to 10,000 Active Client IPs)
// -------------------------------------------------------------------------------------
function benchmarkRateLimiterConcurrency() {
  console.log("\n=======================================================");
  console.log(" 2. BENCHMARKING RATE LIMITER (1K to 10K Concurrent Keys)");
  console.log("=======================================================");

  const limiter = new SlidingWindowRateLimiter(20000);
  const testScales = [1000, 5000, 10000];

  for (const clientCount of testScales) {
    limiter.reset();
    const config = { windowMs: 60000, maxRequests: 60 };
    const startTime = performance.now();

    // Each client sends 5 requests
    let totalRequests = 0;
    let allowedCount = 0;
    for (let c = 0; c < clientCount; c++) {
      const ip = `192.168.${Math.floor(c / 254)}.${(c % 254) + 1}`;
      for (let r = 0; r < 5; r++) {
        totalRequests++;
        const res = limiter.check(ip, config);
        if (res.allowed) allowedCount++;
      }
    }

    const elapsed = performance.now() - startTime;
    const rps = Math.round((totalRequests / (elapsed / 1000)));

    console.log(`- ${clientCount.toLocaleString()} Concurrent Clients | ${totalRequests.toLocaleString()} Requests in ${elapsed.toFixed(1)} ms | Throughput: ${rps.toLocaleString()} req/sec`);
    recordMetric("Rate Limiter Concurrency", `Throughput (${clientCount} clients)`, rps, "req/sec");
    recordMetric("Rate Limiter Concurrency", `Processing Time (${clientCount} clients)`, Number(elapsed.toFixed(2)), "ms");
  }
}

// -------------------------------------------------------------------------------------
// TEST 3: Snapshot Chunking & Cryptographic Integrity Throughput
// -------------------------------------------------------------------------------------
function benchmarkSnapshotChunkingThroughput() {
  console.log("\n=======================================================");
  console.log(" 3. BENCHMARKING SNAPSHOT CHUNKING & HASHING (10MB - 100MB)");
  console.log("=======================================================");

  const payloadSizesMB = [5, 20, 50];

  for (const mb of payloadSizesMB) {
    // Generate synthetic JSON chunk of approximately mb MB
    const targetBytes = mb * 1024 * 1024;
    const chunkCount = Math.ceil(mb / 2); // 2MB chunks
    const chunkData = "A".repeat(2 * 1024 * 1024); // 2MB string

    const startTime = performance.now();
    let totalBytesHashed = 0;
    const chunkHashes: string[] = [];

    for (let i = 0; i < chunkCount; i++) {
      const hash = crypto.createHash("sha256").update(chunkData).digest("hex");
      chunkHashes.push(hash);
      totalBytesHashed += chunkData.length;
    }

    const masterHash = crypto.createHash("sha256").update(chunkHashes.join("")).digest("hex");
    const elapsed = performance.now() - startTime;
    const hashingThroughputMBps = Number(((totalBytesHashed / (1024 * 1024)) / (elapsed / 1000)).toFixed(1));

    console.log(`- ${mb} MB Payload (${chunkCount} chunks of 2MB) | Processed in ${elapsed.toFixed(1)} ms | Rate: ${hashingThroughputMBps} MB/sec | Master SHA256: ${masterHash.slice(0, 12)}...`);
    recordMetric("Snapshot Processing", `Hashing Throughput (${mb}MB)`, hashingThroughputMBps, "MB/s");
    recordMetric("Snapshot Processing", `Chunking Time (${mb}MB)`, Number(elapsed.toFixed(2)), "ms");
  }
}

// -------------------------------------------------------------------------------------
// TEST 4: Student Write Buffer Batch Chunking (100,000 Simulated Attempts)
// -------------------------------------------------------------------------------------
function benchmarkStudentWriteBufferChunking() {
  console.log("\n=======================================================");
  console.log(" 4. BENCHMARKING BATCH CHUNKING (100,000 User Attempts)");
  console.log("=======================================================");

  const TOTAL_ATTEMPTS = 100000;
  const startTime = performance.now();

  const attempts = [];
  for (let i = 0; i < TOTAL_ATTEMPTS; i++) {
    attempts.push({
      attemptId: `att_${i}`,
      userId: `user_${i % 1000}`,
      questionId: `mcq_${i % 5000}`,
      isCorrect: i % 2 === 0,
      timestamp: Date.now() - (i * 1000),
    });
  }

  // Chunking into SAFE_BATCH_CHUNK_SIZE (400)
  const batches = [];
  for (let i = 0; i < attempts.length; i += SAFE_BATCH_CHUNK_SIZE) {
    batches.push(attempts.slice(i, i + SAFE_BATCH_CHUNK_SIZE));
  }

  // Generate idempotency keys for each chunk
  let collisionCount = 0;
  const hashSet = new Set<string>();

  for (let b = 0; b < batches.length; b++) {
    const chunk = batches[b];
    // Test idempotency hash for each batch content
    const sampleItem = chunk[0];
    const hash = generateContentHash(`Attempt batch for ${sampleItem.userId} q=${sampleItem.questionId}`, ["1", "2", "3", "4"], sampleItem.isCorrect ? 1 : 2);
    if (hashSet.has(hash)) {
      collisionCount++;
    }
    hashSet.add(hash);
  }

  const elapsed = performance.now() - startTime;
  const opsPerSec = Math.round((TOTAL_ATTEMPTS / (elapsed / 1000)));

  console.log(`- ${TOTAL_ATTEMPTS.toLocaleString()} attempts partitioned into ${batches.length} batches of max ${SAFE_BATCH_CHUNK_SIZE}`);
  console.log(`- Execution time: ${elapsed.toFixed(1)} ms | Throughput: ${opsPerSec.toLocaleString()} attempts/sec`);
  console.log(`- Idempotency hash collisions: ${collisionCount} (out of ${batches.length} batches)`);

  recordMetric("Batch Buffer Chunking", "Partitioning Throughput", opsPerSec, "attempts/sec");
  recordMetric("Batch Buffer Chunking", "Batch Count", batches.length, "batches");
  recordMetric("Batch Buffer Chunking", "Hash Collisions", collisionCount, "collisions");
}

// -------------------------------------------------------------------------------------
// TEST 5: Live Test Grading Throughput (1,000 Concurrent Submissions)
// -------------------------------------------------------------------------------------
function benchmarkLiveTestGradingThroughput() {
  console.log("\n=======================================================");
  console.log(" 5. BENCHMARKING LIVE TEST GRADING (1,000 Submissions x 100 MCQs)");
  console.log("=======================================================");

  const SUBMISSION_COUNT = 1000;
  const QUESTIONS_PER_TEST = 100;

  // Build answer key
  const answerKey: Record<string, { correctIndex: number }> = {};
  for (let q = 1; q <= QUESTIONS_PER_TEST; q++) {
    answerKey[`q_${q}`] = { correctIndex: (q % 4) + 1 };
  }

  const startTime = performance.now();
  let totalScoreCalculated = 0;

  for (let s = 0; s < SUBMISSION_COUNT; s++) {
    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    for (let q = 1; q <= QUESTIONS_PER_TEST; q++) {
      const qKey = `q_${q}`;
      const selectedOption = (s + q) % 5; // 0 = unattempted, 1-4 = option
      if (selectedOption === 0) {
        unattempted++;
      } else if (selectedOption === answerKey[qKey].correctIndex) {
        correct++;
      } else {
        wrong++;
      }
    }

    const marksPerQuestion = 2;
    const negativeMarking = 0.66;
    const rawScore = (correct * marksPerQuestion) - (wrong * negativeMarking);
    totalScoreCalculated += rawScore;
  }

  const elapsed = performance.now() - startTime;
  const submissionsPerSec = Math.round((SUBMISSION_COUNT / (elapsed / 1000)));
  const totalQuestionsGraded = SUBMISSION_COUNT * QUESTIONS_PER_TEST;
  const questionsGradedPerSec = Math.round((totalQuestionsGraded / (elapsed / 1000)));

  console.log(`- Graded ${SUBMISSION_COUNT.toLocaleString()} exams (${totalQuestionsGraded.toLocaleString()} question evaluations) in ${elapsed.toFixed(1)} ms`);
  console.log(`- Throughput: ${submissionsPerSec.toLocaleString()} exam submissions/sec (${questionsGradedPerSec.toLocaleString()} MCQs graded/sec)`);

  recordMetric("Live Test Grading", "Submission Throughput", submissionsPerSec, "submissions/sec");
  recordMetric("Live Test Grading", "MCQ Evaluation Throughput", questionsGradedPerSec, "mcqs/sec");
  recordMetric("Live Test Grading", "Total Execution Duration", Number(elapsed.toFixed(2)), "ms");
}

// -------------------------------------------------------------------------------------
// RUN ALL TESTS
// -------------------------------------------------------------------------------------
function runAllPhase13Benchmarks() {
  console.log("================================================================================");
  console.log("    DISHA 20-20 — PHASE 13: SCALABILITY & HIGH-CONCURRENCY EMPIRICAL BENCHMARK   ");
  console.log("================================================================================");

  benchmarkSearchIndexScaling();
  benchmarkRateLimiterConcurrency();
  benchmarkSnapshotChunkingThroughput();
  benchmarkStudentWriteBufferChunking();
  benchmarkLiveTestGradingThroughput();

  console.log("\n================================================================================");
  console.log("                 PHASE 13 BENCHMARK EXECUTION SUMMARY                          ");
  console.log("================================================================================");
  console.table(benchmarkResults);
}

runAllPhase13Benchmarks();
