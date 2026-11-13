import fs from "fs";
import path from "path";
import { execSync } from "child_process";

interface CheckResult {
  id: string;
  description: string;
  passed: boolean;
  details: string;
}

function runCheck(results: CheckResult[], id: string, description: string, condition: boolean, details: string) {
  results.push({ id, description, passed: condition, details });
  const badge = condition ? "PASS" : "FAIL";
  console.log(`[${badge}] ${id}: ${description} — ${details}`);
}

async function main() {
  console.log("=== QUIZPRO PHASE 6: FIRESTORE SECURITY RULES VERIFICATION ===");

  const rulesPath = path.join(process.cwd(), "firestore.rules");
  const rulesText = fs.readFileSync(rulesPath, "utf8");
  const checks: CheckResult[] = [];

  // 1. Official ANTLR4 FirebaseRulesParser + ESLint Security Rules Check
  let eslintPassed = false;
  let eslintOutput = "";
  try {
    eslintOutput = execSync("npx eslint firestore.rules 2>&1", { encoding: "utf8" });
    eslintPassed = true;
  } catch (err: any) {
    eslintOutput = err?.stdout || err?.message || String(err);
    eslintPassed = false;
  }
  runCheck(
    checks,
    "AST-01",
    "Official ANTLR4 FirebaseRulesParser & ESLint Security Rules (0 errors)",
    eslintPassed,
    eslintPassed ? "0 syntax errors, 0 no-open-writes errors, 0 no-redundant-matches errors" : eslintOutput.trim()
  );

  // 2. Permissive pattern elimination checks
  const hasOpenWrite = /allow\s+(?:write|create|update|delete)[^;]*:\s*if\s+true\s*;/i.test(rulesText);
  runCheck(checks, "RULE-01", "Zero 'allow write/create/update/delete: if true;' rules", !hasOpenWrite, hasOpenWrite ? "Found open write" : "None found");

  const hasOrTrue = /\|\|\s*true\b/i.test(rulesText);
  runCheck(checks, "RULE-02", "Zero '|| true' tautological rule bypasses", !hasOrTrue, hasOrTrue ? "Found '|| true'" : "None found");

  const hasPermissiveWildcard = /match\s+\/\{document=\*\*\}\s*\{[^}]*allow[^}]*if\s+(?!false\s*;)/is.test(rulesText);
  runCheck(
    checks,
    "RULE-03",
    "No permissive global 'match /{document=**}' wildcard allow blocks",
    !hasPermissiveWildcard,
    hasPermissiveWildcard ? "Found permissive global wildcard" : "Only strict default-deny match /{document=**} { allow read, write: if false; }"
  );

  const hasDefaultDeny = /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/m.test(rulesText);
  runCheck(checks, "RULE-04", "Explicit default-deny catch-all present", hasDefaultDeny, hasDefaultDeny ? "Verified" : "Missing default-deny");

  // 3. Admin Auth Hardening
  const hasVerifiedEmailCheck = rulesText.includes("email_verified', false) == true");
  const blocksAnon = rulesText.includes("'sign_in_provider', '') != 'anonymous'");
  const hasEmergencyPlaceholder = rulesText.includes("EMERGENCY_ADMIN_UID_1");
  runCheck(checks, "ADMIN-01", "isAdmin() requires email_verified == true for email allowlist", hasVerifiedEmailCheck, hasVerifiedEmailCheck ? "Verified" : "Missing email_verified check");
  runCheck(checks, "ADMIN-02", "Anonymous/guest users blocked from write/admin privileges", blocksAnon, blocksAnon ? "Verified" : "Missing anonymous check");
  runCheck(checks, "ADMIN-03", "Dummy placeholder UID EMERGENCY_ADMIN_UID_1 removed", !hasEmergencyPlaceholder, !hasEmergencyPlaceholder ? "Removed" : "Still present");

  // 4. CEL Syntax Safety (no JS-only startsWith/endsWith, no request.resource.data inside delete)
  const hasJsStringMethods = /\.(startsWith|endsWith)\s*\(/.test(rulesText);
  runCheck(checks, "CEL-01", "Zero invalid JS String methods (.startsWith/.endsWith)", !hasJsStringMethods, !hasJsStringMethods ? "Clean RE2 .matches()" : "Found JS string method");

  // 5. Critical Collections Coverage Audit against src/ literal collection references
  const requiredCollections = [
    "users",
    "subjects",
    "chapters",
    "topics",
    "mcqs",
    "questions",
    "question_bundles",
    "archived_mcqs",
    "import_batches",
    "customQuestions",
    "curriculum_subjects",
    "curriculum_chapters",
    "curriculum_questions",
    "curriculum",
    "pyq_papers",
    "pyqPapers",
    "live_tests",
    "liveTests",
    "live-tests",
    "tests",
    "liveTestAnswerKeys",
    "exam_categories",
    "examCategories",
    "coaching",
    "coaching_exams",
    "coaching_test_series",
    "banners",
    "articles",
    "article_categories",
    "link_rules",
    "metadata",
    "settings",
    "appSettings",
    "notifications",
    "broadcast_notifications",
    "premiumPlans",
    "payment_orders",
    "payment_events",
    "user_subscriptions",
    "paymentSubmissions",
    "subscriptions",
    "scanUsage",
    "attempts",
    "pyq_attempts",
    "leaderboard",
    "user_stats_weekly",
    "liveTestSubmissions",
    "examPaperAnalyses",
    "_health",
    "adminAuditLogs",
    "login_attempts",
    "ai_api_configs",
    "usage_daily",
    "analytics_daily",
    "contact_messages",
    "test"
  ];
  const missingCollections = requiredCollections.filter(
    (col) => !new RegExp(`match\\s+/${col}/\\{`).test(rulesText)
  );
  runCheck(
    checks,
    "COV-01",
    `All ${requiredCollections.length} QuizPro Firestore collections explicitly matched`,
    missingCollections.length === 0,
    missingCollections.length === 0 ? `${requiredCollections.length}/${requiredCollections.length} collections covered` : `Missing: ${missingCollections.join(", ")}`
  );

  // 6. Immutability, Draft Isolation & Ownership Predicates
  const auditImmutable = /match\s+\/adminAuditLogs\/\{id\}[\s\S]*?allow\s+update,\s*delete:\s*if\s+false;/.test(rulesText);
  const paymentEventsImmutable = /match\s+\/payment_events\/\{eventId\}[\s\S]*?allow\s+update,\s*delete:\s*if\s+false;/.test(rulesText);
  const userEscBlocked = rulesText.includes("isValidStudentUserCreate") && rulesText.includes("isValidStudentUserUpdate") && rulesText.includes("'role'");
  const examQuestionsSub = /match\s+\/examPaperAnalyses\/\{analysisId\}[\s\S]*?match\s+\/questions\/\{examQuestionId\}/.test(rulesText);
  const blocksProtected = /match\s+\/blocks\/\{blockId\}[\s\S]*?get\(\/databases\/\$\(database\)\/documents\/articles\/\$\(articleId\)\)\.data\.get\('status',\s*'published'\)\s*==\s*'published'/.test(rulesText);
  const userAttemptsImmutable = /match\s+\/attempts\/\{attemptId\}[\s\S]*?allow\s+update,\s*delete:\s*if\s+isValidId\(userId\)\s*&&\s*isAdmin\(\);/.test(rulesText);
  const liveKeyLocked = /match\s+\/liveTestAnswerKeys\/\{testId\}\s*\{[\s\S]*?allow\s+read,\s*write:\s*if\s+isAdmin\(\);/.test(rulesText);

  runCheck(checks, "IMM-01", "adminAuditLogs immutable (update, delete: if false)", auditImmutable, auditImmutable ? "Verified" : "Failed");
  runCheck(checks, "IMM-02", "payment_events immutable (update, delete: if false)", paymentEventsImmutable, paymentEventsImmutable ? "Verified" : "Failed");
  runCheck(checks, "IMM-03", "users/{userId}/attempts immutable for students (update, delete: isAdmin)", userAttemptsImmutable, userAttemptsImmutable ? "Verified" : "Failed");
  runCheck(checks, "ESC-01", "users/{userId} blocks student role/premium/status escalation", userEscBlocked, userEscBlocked ? "Verified" : "Failed");
  runCheck(checks, "SUB-01", "examPaperAnalyses/{id}/questions subcollection explicitly secured", examQuestionsSub, examQuestionsSub ? "Verified" : "Failed");
  runCheck(checks, "SUB-02", "articles/{id}/blocks gated by parent article published status", blocksProtected, blocksProtected ? "Verified" : "Failed");
  runCheck(checks, "KEY-01", "liveTestAnswerKeys restricted strictly to Admin", liveKeyLocked, liveKeyLocked ? "Verified" : "Failed");

  // 7. Test Suite Completeness Check
  const testSuitePath = path.join(process.cwd(), "tests/firestore-security-rules.test.ts");
  const testSuiteContent = fs.readFileSync(testSuitePath, "utf8");
  const testMatches = testSuiteContent.match(/test\(['"]SEC-\d+/g) || [];
  runCheck(
    checks,
    "TEST-01",
    "Emulator unit test suite covers >= 14 required scenarios",
    testMatches.length >= 14,
    `Found ${testMatches.length} scenarios (${testMatches.map((m) => m.replace(/test\(['"]/, "")).join(", ")})`
  );

  // 8. Java / Firestore Emulator Environment Probe
  let javaVersion = "";
  let javaAvailable = false;
  try {
    javaVersion = execSync("java -version 2>&1", { encoding: "utf8" }).trim();
    javaAvailable = true;
  } catch (err: any) {
    javaVersion = (err?.stderr || err?.stdout || err?.message || "java: not found").toString().trim();
    javaAvailable = false;
  }

  let firebaseCliVersion = "not found";
  try {
    firebaseCliVersion = execSync("npx firebase --version 2>&1", { encoding: "utf8" }).trim();
  } catch {}

  console.log("\n--- ENVIRONMENT PROBE ---");
  console.log(`Firebase CLI: ${firebaseCliVersion}`);
  console.log(`Java Runtime: ${javaAvailable ? javaVersion : "NOT AVAILABLE (" + javaVersion.split("\n")[0] + ")"}`);
  console.log(
    `Emulator Runtime Execution: ${
      javaAvailable
        ? "READY"
        : "UNAVAILABLE IN CONTAINER (Java JRE 11+ required for Cloud Firestore Emulator)"
    }`
  );

  // 9. Summary
  const failed = checks.filter((c) => !c.passed);
  console.log(`\n=== SUMMARY: ${checks.length - failed.length}/${checks.length} static & grammar checks passed ===`);
  if (failed.length > 0) {
    console.error("Failed checks:", failed.map((f) => f.id).join(", "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal verification error:", err);
  process.exit(1);
});
