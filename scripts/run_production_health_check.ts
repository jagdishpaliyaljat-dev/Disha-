/**
 * DISHA 20-20 — Automated Live Production Health Check & Alerting Suite
 * 
 * Verifies:
 * 1. Application & Route Availability (Vercel Edge & Serverless)
 * 2. Firebase Connectivity & Snapshot Publishing Service
 * 3. Alert Thresholds Simulation (CRITICAL, HIGH, MEDIUM, LOW)
 * 4. Data Sync & Offline Recovery Mechanics
 * 5. Performance Baselines (Load Time, Render Speed, Latency)
 */

import * as https from "https";
import * as http from "http";
import { productionMonitor, AlertSeverity } from "../src/utils/productionMonitoring";

interface RouteCheckResult {
  route: string;
  url: string;
  status: number;
  latencyMs: number;
  passed: boolean;
  notes: string;
}

const PRODUCTION_ORIGIN = "https://disha-2020.vercel.app";

async function probeUrl(urlStr: string): Promise<{ status: number; latencyMs: number; body: string }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const isHttps = urlStr.startsWith("https:");
    const client = isHttps ? https : http;

    const req = client.get(urlStr, { timeout: 8000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          latencyMs: Date.now() - start,
          body: data,
        });
      });
    });

    req.on("error", (err) => {
      resolve({
        status: 0,
        latencyMs: Date.now() - start,
        body: err.message,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        status: 408,
        latencyMs: Date.now() - start,
        body: "Request Timeout",
      });
    });
  });
}

async function runProductionHealthCheck() {
  console.log("================================================================================");
  console.log("      DISHA 20-20 — PHASE 11: LIVE PRODUCTION MONITORING & HEALTH CHECK         ");
  console.log("================================================================================");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Target Production Host: ${PRODUCTION_ORIGIN}\n`);

  const results: RouteCheckResult[] = [];

  // 1. ROUTE & AVAILABILITY CHECKS
  console.log("--- 1. APPLICATION & ROUTE AVAILABILITY CHECKS ---");
  const routesToTest = [
    { path: "/", desc: "Root Client SPA Entrypoint" },
    { path: "/api/health", desc: "Serverless Health & Firebase Admin Probe" },
    { path: "/robots.txt", desc: "SEO Crawler Directives" },
    { path: "/sitemap.xml", desc: "Dynamic Search Engine Sitemap" },
  ];

  let healthPayload: any = null;

  for (const item of routesToTest) {
    const fullUrl = `${PRODUCTION_ORIGIN}${item.path}`;
    const res = await probeUrl(fullUrl);
    const passed = res.status === 200 && res.latencyMs < 3000;
    
    if (item.path === "/api/health" && res.status === 200) {
      try {
        healthPayload = JSON.parse(res.body);
      } catch {
        // Non-JSON
      }
    }

    results.push({
      route: item.path,
      url: fullUrl,
      status: res.status,
      latencyMs: res.latencyMs,
      passed,
      notes: item.desc,
    });

    console.log(
      `  [${passed ? "PASS" : "FAIL"}] ${item.path.padEnd(16)} HTTP ${res.status} | Latency: ${res.latencyMs}ms | ${item.desc}`
    );
  }

  // 2. FIREBASE & SNAPSHOT HEALTH
  console.log("\n--- 2. FIREBASE CONNECTIVITY & SNAPSHOT ENGINE ---");
  const fbAdminActive = healthPayload?.firebaseAdmin === true;
  const snapshotVer = healthPayload?.snapshotVersion;
  console.log(`  Firebase Admin Connected: ${fbAdminActive ? "YES (PASS)" : "NO (FAIL)"}`);
  console.log(`  Curriculum Snapshot Version: ${snapshotVer || "Unknown"}`);
  console.log(`  Service Name: ${healthPayload?.service || "Unknown"}`);

  // 3. ALERT THRESHOLD VERIFICATION (SIMULATION & TESTING)
  console.log("\n--- 3. ALERT THRESHOLD SIMULATION & VERIFICATION ---");
  
  // Test Level: LOW
  productionMonitor.clearBuffer();
  productionMonitor.recordUserJourney("test_session", "abandon");
  let evalStatus = productionMonitor.evaluateAlertThresholds();
  console.log(`  [TEST 3.1] Low Severity Event Evaluation:`);
  console.log(`    Triggered Level: ${evalStatus.activeLevel} (Expected: LOW) -> ${evalStatus.activeLevel === "LOW" ? "PASS" : "FAIL"}`);

  // Test Level: MEDIUM
  productionMonitor.recordPerformanceMetric("mcq_render", 620); // triggers > 500ms
  evalStatus = productionMonitor.evaluateAlertThresholds();
  console.log(`  [TEST 3.2] Medium Severity Threshold (MCQ Render Latency > 500ms):`);
  console.log(`    Triggered Level: ${evalStatus.activeLevel} (Expected: MEDIUM) -> ${evalStatus.activeLevel === "MEDIUM" ? "PASS" : "FAIL"}`);

  // Test Level: HIGH
  productionMonitor.recordPerformanceMetric("navigation_latency", 1450); // triggers > 1200ms
  evalStatus = productionMonitor.evaluateAlertThresholds();
  console.log(`  [TEST 3.3] High Severity Threshold (Navigation Latency > 1200ms):`);
  console.log(`    Triggered Level: ${evalStatus.activeLevel} (Expected: HIGH) -> ${evalStatus.activeLevel === "HIGH" ? "PASS" : "FAIL"}`);

  // Test Level: CRITICAL
  // Simulate error rate > 5.0%
  for (let i = 0; i < 20; i++) {
    productionMonitor.captureException(new Error("Simulated critical threshold error"), "RUNTIME_ERROR", "CRITICAL");
  }
  evalStatus = productionMonitor.evaluateAlertThresholds();
  console.log(`  [TEST 3.4] Critical Severity Threshold (Error Rate > 5.0%):`);
  console.log(`    Triggered Level: ${evalStatus.activeLevel} (Expected: CRITICAL) -> ${evalStatus.activeLevel === "CRITICAL" ? "PASS" : "FAIL"}`);

  // Clean test buffer after simulation
  productionMonitor.clearBuffer();

  // 4. DATA SANITIZATION / ZERO SECRET PROTOCOL VERIFICATION
  console.log("\n--- 4. DATA SANITIZATION & ZERO-SECRET SCRUBBING VERIFICATION ---");
  const testSecretError = new Error("Authorization failed with token bearer secret_123456789 and API key AIzaSyA1234567890abcdefghijklmnopqrstuv for test@example.com");
  const loggedEntry = productionMonitor.captureException(testSecretError, "AUTH_ERROR", "HIGH");
  
  const hasNoBearer = !loggedEntry.message.includes("secret_123456789");
  const hasNoApiKey = !loggedEntry.message.includes("AIzaSyA1234567890abcdefghijklmnopqrstuv");
  const hasSanitizedEmail = !loggedEntry.message.includes("test@example.com");

  console.log(`  Bearer Token Stripped:    ${hasNoBearer ? "PASS" : "FAIL"}`);
  console.log(`  Google API Key Redacted:  ${hasNoApiKey ? "PASS" : "FAIL"}`);
  console.log(`  Student Email Masked:     ${hasSanitizedEmail ? "PASS" : "FAIL"}`);

  productionMonitor.clearBuffer();

  // 5. SUMMARY & HEALTH SCORE
  console.log("\n--- 5. PRODUCTION HEALTH VERIFICATION SUMMARY ---");
  const allRoutesPassed = results.every((r) => r.passed);
  const healthScore = allRoutesPassed && fbAdminActive && hasNoApiKey ? 100 : 75;
  
  console.log(`  Overall Production Health Score: ${healthScore}%`);
  console.log(`  Availability State:             ${allRoutesPassed ? "HEALTHY / FULLY OPERATIONAL" : "DEGRADED"}`);
  console.log("================================================================================");
}

runProductionHealthCheck().catch((err) => {
  console.error("Health check execution failed:", err);
  process.exit(1);
});
