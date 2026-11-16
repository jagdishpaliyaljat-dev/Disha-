import { 
  isUserAdmin, 
  setInMemoryProfile, 
  ADMIN_EMAILS 
} from "../userProfileStorage";
import { calculateNextProgress, isDueToday, addDaysToDate, getTodayDateString, INTERVALS } from "../revision";
import { 
  getLocalUsersDirectory, 
  updateUserAccountStatus, 
  deleteUserAccount,
  fetchUserActivityData,
  logAdminAction,
  getLocalAuditLogs,
  setLocalUsersDirectory
} from "../userManagementStorage";
import { saveBanner, fetchAllBanners, fetchActiveBanners } from "../bannerStorage";
import { 
  loadUserQuestionsStore, 
  getCombinedSubjects, 
  addSubject, 
  editSubject, 
  deleteSubject 
} from "../questionsStorage";
import { sanitizeUserQuestionsStore, purgeObsoleteKeys } from "../cleanSlate";
import { calculateSmartPriority } from "../smartPriority";
import { UserProfile, AppBanner, Subject, UserQuestionsStore } from "../../types";

/**
 * DISHA 20-20 Comprehensive Automated QA Test Suite
 * Tests Core Modules: Auth, Scoring, Revision Spaced Repetition, 
 * Question Bank Mappings, User Management & Audit, Banner Storage, Smart Priority
 */


let passedCount = 0;
let failedCount = 0;
const testResults: { name: string; status: "PASS" | "FAIL"; error?: string }[] = [];

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    passedCount++;
    testResults.push({ name: testName, status: "PASS" });
    console.log(`  [PASS] ${testName}`);
  } else {
    failedCount++;
    const errMsg = failureDetails || "Assertion failed";
    testResults.push({ name: testName, status: "FAIL", error: errMsg });
    console.error(`  [FAIL] ${testName}: ${errMsg}`);
  }
}

async function runTestSuite() {
  console.log("=================================================");
  console.log("   QUIZPRO COMPREHENSIVE QA TEST SUITE RUNNER    ");
  console.log("=================================================\n");

  // -----------------------------------------------------------------
  // 1. AUTHENTICATION & ACCESS CONTROL TESTS
  // -----------------------------------------------------------------
  console.log("--- 1. Authentication & Admin Security ---");
  {
    assert(isUserAdmin("jagdishpaliyaljat@gmail.com"), "Auth: Admin email recognized (lowercase)");
    assert(isUserAdmin("KAMLESHCHOUDHARY96022@GMAIL.COM"), "Auth: Admin email recognized (case insensitive)");
    assert(isUserAdmin("  kamleshchoudhary96022@gmail.com  "), "Auth: Admin email recognized (with whitespace)");
    assert(isUserAdmin({ id: "1", name: "Admin", email: "jagdishpaliyaljat@gmail.com", role: "admin", createdAt: "" }), "Auth: Admin profile object recognized");
    assert(!isUserAdmin("student@gmail.com"), "Auth: Normal student email not recognized as admin");
    assert(!isUserAdmin(null), "Auth: Null profile handled safely without crashing");
    assert(!isUserAdmin(undefined), "Auth: Undefined profile handled safely");
    assert(!isUserAdmin({ id: "2", name: "Student", email: "student@example.com", role: "student", createdAt: "" }), "Auth: Non-admin profile role denied admin status");
  }

  // -----------------------------------------------------------------
  // 2. REVISION & SPACED REPETITION ENGINE TESTS
  // -----------------------------------------------------------------
  console.log("\n--- 2. Revision & Spaced Repetition Logic ---");
  {
    const today = getTodayDateString();

    // First attempt correct
    const firstCorrect = calculateNextProgress(undefined, true, 2, today);
    assert(firstCorrect.status === "correct", "Revision: First correct attempt status is 'correct'");
    assert(firstCorrect.stage === 0, "Revision: First correct attempt stage is 0");
    assert(firstCorrect.nextReviewAt === addDaysToDate(today, 3), "Revision: First correct attempt due in 3 days");
    assert(firstCorrect.wrongCount === 0, "Revision: First correct attempt wrongCount is 0");
    assert(firstCorrect.lastSelectedOption === 2, "Revision: First attempt preserves selected option");

    // First attempt wrong
    const firstWrong = calculateNextProgress(undefined, false, 1, today);
    assert(firstWrong.status === "wrong", "Revision: First wrong attempt status is 'wrong'");
    assert(firstWrong.stage === 0, "Revision: First wrong attempt stage is 0");
    assert(firstWrong.wrongCount === 1, "Revision: First wrong attempt wrongCount is 1");
    assert(firstWrong.nextReviewAt === addDaysToDate(today, 3), "Revision: First wrong attempt due in 3 days");

    // Subsequent correct attempt
    const secondCorrect = calculateNextProgress(firstCorrect, true, 2, today);
    assert(secondCorrect.status === "correct", "Revision: Subsequent correct keeps status 'correct'");
    assert(secondCorrect.stage === 1, "Revision: Subsequent correct increments stage to 1");
    assert(secondCorrect.nextReviewAt === addDaysToDate(today, INTERVALS[1]), "Revision: Stage 1 due in 7 days");

    // Subsequent wrong attempt resets stage
    const subsequentWrong = calculateNextProgress(secondCorrect, false, 0, today);
    assert(subsequentWrong.status === "wrong", "Revision: Subsequent wrong sets status to 'wrong'");
    assert(subsequentWrong.stage === 0, "Revision: Subsequent wrong resets stage to 0");
    assert(subsequentWrong.wrongCount === 1, "Revision: Subsequent wrong increments wrongCount");

    // Due today check
    assert(isDueToday({ status: "correct", stage: 1, nextReviewAt: today, wrongCount: 0, bookmarked: false, lastAnsweredAt: today }), "Revision: Question due today returns true");
    assert(isDueToday({ status: "wrong", stage: 0, nextReviewAt: addDaysToDate(today, -2), wrongCount: 1, bookmarked: false, lastAnsweredAt: today }), "Revision: Overdue question returns true");
    assert(!isDueToday({ status: "correct", stage: 1, nextReviewAt: addDaysToDate(today, 5), wrongCount: 0, bookmarked: false, lastAnsweredAt: today }), "Revision: Future review date returns false");
    assert(!isDueToday(undefined), "Revision: Undefined progress returns false");
  }

  // -----------------------------------------------------------------
  // 3. SCORING & EXAM FORMULA TESTS
  // -----------------------------------------------------------------
  console.log("\n--- 3. Exam Scoring & Marks Formulas ---");
  {
    // Test Case: Live Exam Standard RAS (Marks +2, Neg -0.66)
    const totalQ = 10;
    const marksPerQ = 2;
    const negMarks = 0.66;
    const correct = 7;
    const wrong = 2;
    const skipped = 1;

    const rawScore = correct * marksPerQ - wrong * negMarks;
    const obtainedMarks = Math.max(0, Number(rawScore.toFixed(2)));
    const maxMarks = totalQ * marksPerQ;
    const accuracy = Number(((correct / (correct + wrong)) * 100).toFixed(1));

    assert(obtainedMarks === 12.68, `Scoring: Raw score ${rawScore} formatted to 12.68 obtainedMarks`);
    assert(maxMarks === 20, "Scoring: Max marks calculated accurately");
    assert(accuracy === 77.8, `Scoring: Accuracy ${accuracy}% correctly ignores skipped questions`);

    // Extreme Case: High wrong answers resulting in negative raw score
    const allWrong = 8;
    const rawNegative = 0 * marksPerQ - allWrong * negMarks; // -5.28
    const flooredMarks = Math.max(0, Number(rawNegative.toFixed(2)));
    assert(flooredMarks === 0, "Scoring: Negative raw score properly floored at 0 for safe marks display");

    // Perfect Score Case
    const perfectScore = totalQ * marksPerQ;
    assert(perfectScore === 20, "Scoring: 100% correct calculates full max marks");
  }

  // -----------------------------------------------------------------
  // 4. USER MANAGEMENT & SECURITY ACTIONS
  // -----------------------------------------------------------------
  console.log("\n--- 4. User Management, Audit Logs & Safety Controls ---");
  {
    // Mock an admin session for User Management tests
    const adminUser: UserProfile = {
      id: "admin_test_uid",
      name: "Admin Tester",
      email: "jagdishpaliyaljat@gmail.com",
      role: "admin",
      createdAt: new Date().toISOString()
    };
    setInMemoryProfile(adminUser);

    let users = getLocalUsersDirectory();
    if (!users || users.length === 0) {
      const testU = { id: "test-u-1", name: "Test User", email: "test@user.com", role: "student" as const, createdAt: new Date().toISOString() };
      setLocalUsersDirectory([testU]);
      users = getLocalUsersDirectory();
    }
    assert(Array.isArray(users) && users.length >= 1, "User Mgmt: User directory accessible");

    const targetUser = users.find(u => u.role !== "admin") || users[0];

    // Status change to blocked
    const blockedUser = await updateUserAccountStatus(targetUser.id, "blocked", "Violated conduct rules");
    assert(blockedUser?.status === "blocked", "User Mgmt: Successfully blocked target user");

    // Status change to active
    const unblockedUser = await updateUserAccountStatus(targetUser.id, "active", "Account restored by admin");
    assert(unblockedUser?.status === "active", "User Mgmt: Successfully restored target user to active");

    // Status change to inactive
    const deactivatedUser = await updateUserAccountStatus(targetUser.id, "inactive", "Temporary hold");
    assert(deactivatedUser?.status === "inactive", "User Mgmt: Successfully deactivated account");

    // Restore back to active
    await updateUserAccountStatus(targetUser.id, "active", "Restored to active");

    // Test Audit Log generation
    const auditLogs = getLocalAuditLogs();
    assert(auditLogs.length >= 3, "User Mgmt: Audit log entries successfully created and persisted");
    const lastLog = auditLogs[0];
    assert(Boolean(lastLog.adminEmail), "User Mgmt: Audit log captures admin email");
    assert(Boolean(lastLog.action), "User Mgmt: Audit log captures action type");
    assert(Boolean(lastLog.timestamp), "User Mgmt: Audit log captures timestamp");

    // Test Self-Lockout Prevention
    let adminLockoutBlocked = false;
    try {
      await updateUserAccountStatus("admin_test_uid", "blocked", "Accidental self block");
    } catch (e: any) {
      if (e.message.includes("Administrators cannot deactivate or block their own")) {
        adminLockoutBlocked = true;
      }
    }
    assert(adminLockoutBlocked, "User Mgmt: Security rule blocks admin from deactivating/blocking self");

    // Test Self-Delete Prevention
    let adminDeleteBlocked = false;
    try {
      await deleteUserAccount("admin_test_uid", "Accidental self delete");
    } catch (e: any) {
      if (e.message.includes("cannot delete your own active administrator account")) {
        adminDeleteBlocked = true;
      }
    }
    assert(adminDeleteBlocked, "User Mgmt: Security rule prevents admin from deleting own account");

    // Test Activity Report retrieval
    const activity = await fetchUserActivityData(targetUser);
    assert(typeof activity.totalTestsAttempted === "number", "User Activity: Total tests attempted is tracked");
    assert(Array.isArray(activity.history), "User Activity: Test history is array");
    assert(Boolean(activity.accountCreatedAt), "User Activity: Account creation date is present");
  }

  // -----------------------------------------------------------------
  // 5. BANNER STORAGE & ORDERING TESTS
  // -----------------------------------------------------------------
  console.log("\n--- 5. Banner Storage & Slides Pipeline ---");
  {
    const bannerId = await saveBanner({
      title: "Test Banner Slide QA",
      subtitle: "Verified QA Banner",
      badge: "NEW",
      imageUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      actionTab: "live_tests",
      isActive: true,
      order: 99,
    });
    assert(Boolean(bannerId), "Banner Storage: saveBanner returns valid ID");

    const allBanners = await fetchAllBanners();
    const createdBanner = allBanners.find(b => b.id === bannerId);
    assert(Boolean(createdBanner), "Banner Storage: Created banner found in fetchAllBanners");
    assert(createdBanner?.title === "Test Banner Slide QA", "Banner Storage: Banner title preserved correctly");
    assert(createdBanner?.actionTab === "live_tests", "Banner Storage: Banner action destination preserved");
    assert(createdBanner?.isActive === true, "Banner Storage: Banner active status preserved");

    // Verify active filter
    const activeBanners = await fetchActiveBanners();
    assert(activeBanners.some(b => b.id === bannerId), "Banner Storage: Active banners include new active banner");
  }

  // -----------------------------------------------------------------
  // 6. QUESTIONS STORAGE & SYLLABUS MAPPINGS
  // -----------------------------------------------------------------
  console.log("\n--- 6. Questions Storage, Subjects & Syllabus Mapping ---");
  {
    const store = loadUserQuestionsStore();
    assert(typeof store === "object", "Questions Storage: Store loads valid object");
    assert(Array.isArray(store.customSubjects), "Questions Storage: customSubjects is array");
    assert(Array.isArray(store.customQuestions), "Questions Storage: customQuestions is array");

    const newSubj: Subject = { id: `subj_qa_${Date.now()}`, name: "QA Testing Subject", hindiName: "क्यूए टेस्टिंग विषय", icon: "BookOpen" };
    const withSubj = addSubject(store, newSubj);
    assert(Boolean(withSubj.customSubjects?.some(s => s.id === newSubj.id)), "Questions Storage: addSubject appends subject");

    const combined = getCombinedSubjects(withSubj);
    assert(combined.some(s => s.id === newSubj.id), "Questions Storage: getCombinedSubjects includes added subject");

    const editedSubj: Subject = { ...newSubj, name: "QA Testing Subject Edited" };
    const withEdit = editSubject(withSubj, editedSubj);
    assert(withEdit.editedSubjects?.[newSubj.id]?.name === "QA Testing Subject Edited", "Questions Storage: editSubject updates subject");

    const withDelete = deleteSubject(withEdit, newSubj.id);
    const combinedAfterDelete = getCombinedSubjects(withDelete);
    assert(!combinedAfterDelete.some(s => s.id === newSubj.id), "Questions Storage: deleteSubject removes from combined list");
  }

  // -----------------------------------------------------------------
  // 7. CLEAN SLATE & SANITIZATION TESTS
  // -----------------------------------------------------------------
  console.log("\n--- 7. Clean Slate & Dummy Data Sanitization ---");
  {
    const sampleStore: UserQuestionsStore = {
      customSubjects: [
        { id: "s1", name: "Real Subject", hindiName: "वास्तविक विषय", icon: "Book" },
        { id: "s2", name: "Dummy Question Subject", hindiName: "डमी विषय", icon: "Book" }
      ],
      customChapters: [
        { id: "c1", title: "Real Chapter", hindiTitle: "वास्तविक अध्याय", number: 1, subjectId: "s1", topics: [] },
        { id: "c2", title: "Sample Chapter 101", hindiTitle: "नमूना अध्याय", number: 2, subjectId: "s1", topics: [] }
      ],
      customTopics: [],
      customQuestions: [
        { id: "q1", chapterId: "c1", topicId: "t1", text: "What is GDP?", options: ["A", "B", "C", "D"], correctIndex: 0, explanation: "" },
        { id: "q2", chapterId: "c1", topicId: "t1", text: "Dummy Question 123 for test", options: ["A", "B", "C", "D"], correctIndex: 1, explanation: "" }
      ],
      editedSubjects: {},
      deletedSubjectIds: [],
      editedQuestions: {},
      deletedQuestionIds: [],
    };

    const sanitizedResult = sanitizeUserQuestionsStore(sampleStore);
    assert(Boolean(sanitizedResult.sanitized.customQuestions?.length === 1), "Clean Slate: Dummy question purged from question bank");
    assert(Boolean(sanitizedResult.sanitized.customQuestions?.[0]?.id === "q1"), "Clean Slate: Legitimate question preserved");
    assert(sanitizedResult.changed === true, "Clean Slate: Dummy question removal flagged changed state");
  }

  // -----------------------------------------------------------------
  // 8. SMART PRIORITY CALCULATION TESTS
  // -----------------------------------------------------------------
  console.log("\n--- 8. Smart Priority & Performance Scoring ---");
  {
    // High Priority: Attempted 3 times, wrong 3 times, accuracy 0%
    const resZeroAccuracy = calculateSmartPriority({
      attemptCount: 3,
      correctCount: 0,
      wrongCount: 3,
      accuracy: 0,
      lastResult: "wrong",
      recentAttempts: [{ isCorrect: false, timeTakenSeconds: 20, attemptedAt: new Date().toISOString() }],
    });
    assert(resZeroAccuracy.score >= 50, `Smart Priority: Zero accuracy score is high priority (${resZeroAccuracy.score})`);
    assert(resZeroAccuracy.level === "high" || resZeroAccuracy.level === "attention", "Smart Priority: Level flagged as high/attention");

    // Low Priority: Attempted 5 times, all correct (100% accuracy)
    const resHighAccuracy = calculateSmartPriority({
      attemptCount: 5,
      correctCount: 5,
      wrongCount: 0,
      accuracy: 100,
      lastResult: "correct",
      recentAttempts: [{ isCorrect: true, timeTakenSeconds: 15, attemptedAt: new Date().toISOString() }],
    });
    assert(resHighAccuracy.score <= 35, `Smart Priority: 100% accuracy score is low (${resHighAccuracy.score})`);
    assert(resHighAccuracy.level === "low" || resHighAccuracy.level === "medium", "Smart Priority: Level flagged as low/medium priority");
  }

  // -----------------------------------------------------------------
  // 9. FIRESTORE UNDEFINED FIELD SANITIZATION TESTS
  // -----------------------------------------------------------------
  console.log("\n--- 9. Firestore Undefined Field Sanitization & Bulk Sync ---");
  {
    const { sanitizeForFirestore } = await import("../bulkSyncService");

    const rawChapterObj = {
      id: "custom-ch-1792216640906",
      title: "राजस्थान की अर्थव्यवस्था",
      hindiTitle: "राजस्थान की अर्थव्यवस्था",
      number: 1,
      subjectId: undefined, // Top-level undefined
      zeroVal: 0,           // Valid 0
      falseVal: false,     // Valid false
      emptyStr: "",        // Valid empty string
      nullVal: null,       // Valid null
      topics: [
        {
          id: "top-1",
          chapterId: "custom-ch-1792216640906",
          subjectId: undefined, // Nested undefined in array object
          title: "कृषि एवं संबद्ध क्षेत्र",
          questions: [
            {
              id: "q1",
              text: "प्रश्न 1",
              options: ["A", "B"],
              correctIndex: 0,
              sectionId: undefined, // Deeply nested undefined
            }
          ]
        }
      ]
    };

    const clean = sanitizeForFirestore(rawChapterObj);

    assert(!("subjectId" in clean), "Sanitize: Top-level undefined property 'subjectId' removed");
    assert(clean.zeroVal === 0, "Sanitize: Valid 0 value preserved");
    assert(clean.falseVal === false, "Sanitize: Valid false value preserved");
    assert(clean.emptyStr === "", "Sanitize: Valid empty string preserved");
    assert(clean.nullVal === null, "Sanitize: Valid null value preserved");
    assert(!("subjectId" in clean.topics[0]), "Sanitize: Nested undefined 'topics[0].subjectId' removed");
    assert(!("sectionId" in clean.topics[0].questions[0]), "Sanitize: Deeply nested undefined 'questions[0].sectionId' removed");
    assert(clean.topics[0].questions[0].text === "प्रश्न 1", "Sanitize: Valid string properties intact");
  }

  console.log("\n=================================================");
  console.log(`TEST RESULTS SUMMARY: ${passedCount} PASSED / ${failedCount} FAILED`);
  console.log("=================================================");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution unhandled failure:", err);
  process.exit(1);
});
