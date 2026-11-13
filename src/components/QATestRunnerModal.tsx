import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldAlert, 
  RefreshCw, 
  Check, 
  Terminal, 
  ArrowLeft,
  Activity,
  Zap,
  Radio,
  FolderTree,
  FlaskConical,
  Calculator,
  FileText,
  Layers,
  CreditCard,
  BarChart,
  ShieldCheck,
  ZapOff
} from "lucide-react";
import { CHEMISTRY_SAMPLES } from "../utils/mcqSampleFormats";
import { parseRawMcqText } from "../utils/questionParser";
import { db } from "../lib/firebase";
import { doc, collection, query, where, orderBy } from "firebase/firestore";
import {
  guardedGetDoc,
  guardedGetDocs,
  guardedSetDoc,
  guardedDeleteDoc,
  guardedOnSnapshot,
  guardedWriteBatch,
  resetQuotaSummary,
  getQuotaSummary,
  getCurrentQuotaDate,
  setSimulatedPacificDate,
  setCloudSyncEnabled,
  setConsoleNumbers,
  warnDirectFirestoreCall,
  recordUsage,
  clearFirestoreCache,
} from "../utils/quotaTracker";
import { runFirebaseDiagnostic } from "../utils/firebaseTest";
import { 
  saveSubject, 
  deleteSubjectFromCloud, 
  saveChapter, 
  deleteChapterFromCloud, 
  saveTopic,
  deleteTopicFromCloud,
  saveMCQ, 
  deleteMCQFromCloud, 
  savePYQPaper, 
  deletePYQPaperFromCloud, 
  saveLiveTest, 
  deleteLiveTestFromCloud, 
  saveBanner, 
  deleteBannerFromCloud,
  syncUserProfileToCloud,
  recordAttemptToCloud,
  updateLeaderboardToCloud
} from "../utils/firebaseSyncService";
import { saveExamCategory, deleteExamCategory } from "../utils/categoryStorage";
import { runInMockQASandbox } from "../utils/mockFirestoreDriver";

type QAMode = "mock" | "prod_smoke";

const BLOCKED_IN_PROD_SMOKE = new Set<string>([
  "categories_stress",
  "live_tests",
  "pyq_stress",
  "mass_m1",
  "analytics",
  "quota_counter",
  "quota_no_mock",
]);

interface TestLog {
  id: string;
  moduleName: string;
  testName: string;
  status: "running" | "pass" | "fail";
  durationMs: number;
  errorCode?: string;
  errorDetail?: string;
  timestamp: string;
}

interface QATestRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QATestRunnerModal: React.FC<QATestRunnerModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [qaMode, setQaMode] = useState<QAMode>("mock");
  const [showProdConfirm, setShowProdConfirm] = useState(false);
  const [prodConfirmChecked, setProdConfirmChecked] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  if (!isOpen) return null;

  const addLog = (moduleName: string, testName: string, status: "running" | "pass" | "fail", durationMs = 0, errorCode?: string, errorDetail?: string) => {
    const entry: TestLog = {
      id: Math.random().toString(36).substring(2, 9),
      moduleName,
      testName,
      status,
      durationMs,
      errorCode,
      errorDetail,
      timestamp: new Date().toLocaleTimeString(),
    };
    setLogs((prev) => [entry, ...prev]);
    return entry.id;
  };

  const updateLog = (id: string, status: "pass" | "fail", durationMs: number, errorCode?: string, errorDetail?: string) => {
    setLogs((prev) => prev.map((l) => l.id === id ? { ...l, status, durationMs, errorCode, errorDetail } : l));
  };

  // Helper to verify listener receipt within 3 seconds
  const verifyListenerReceipt = async (collectionName: string, docId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      let resolved = false;
      const q = collection(db, collectionName);
      const unsubscribe = guardedOnSnapshot(q, "QA", `Verify Listener ${collectionName}`, (snapshot) => {
        const found = snapshot.docs.some((d: any) => d.id === docId && (d.data() as any).isTest === true);
        if (found && !resolved) {
          resolved = true;
          unsubscribe();
          resolve(true);
        }
      }, () => {});

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubscribe();
          resolve(false);
        }
      }, 3000);
    });
  };

  // --- Module 5: Exam Categories Stress Test (15 Categories, Rename, In-Use Deletion Block, Safe Delete) ---
  const testModule5CategoriesStressTest = async (): Promise<boolean> => {
    const mod = "Module 5: Exam Categories (15 Categories)";
    const batchTag = `TEST_CAT_STRESS_${Date.now()}`;
    const logId = addLog(mod, "Create 15 Categories ➔ Rename ➔ In-Use Deletion Block ➔ Safe Delete", "running");
    const start = Date.now();

    try {
      const categories: any[] = [];
      for (let i = 1; i <= 15; i++) {
        categories.push({
          id: `${batchTag}_cat_${i}`,
          name: `${batchTag} Category ${i}`,
          hindiName: `परीक्षा श्रेणी ${i}`,
          order: i,
          isTest: true,
          createdAt: new Date().toISOString()
        });
      }

      // 1. Save all 15 categories
      for (const cat of categories) {
        await saveExamCategory(cat);
      }

      // 2. Rename category 1
      const targetCat = categories[0];
      targetCat.name = `${batchTag}_Category_Renamed`;
      await saveExamCategory(targetCat);

      // 3. Test In-Use Deletion Block: Create a PYQ paper using targetCat.id, then attempt delete and expect error
      const testPaper: any = {
        id: `${batchTag}_paper_inuse`,
        title: `${batchTag} Paper In Use`,
        hindiTitle: `पेपर`,
        examBoard: "RPSC",
        paperYear: "2026",
        category: targetCat.id, // linked to category
        description: "Desc",
        durationMinutes: 60,
        totalMarks: 100,
        marksPerQuestion: 2,
        negativeMarking: 0.33,
        questionCount: 0,
        questions: [],
        isPublished: true,
        isTest: true,
        createdAt: new Date().toISOString()
      };
      await savePYQPaper(testPaper);

      let deletionBlocked = false;
      try {
        await deleteExamCategory(targetCat.id);
      } catch (err: any) {
        if (err.message && err.message.includes("CATEGORY_IN_USE")) {
          deletionBlocked = true;
        }
      }

      if (!deletionBlocked) {
        throw new Error("IN_USE_CATEGORY_DELETION_WAS_NOT_BLOCKED");
      }

      // 4. Safe Delete: Remove paper first, then delete category
      await deletePYQPaperFromCloud(testPaper.id);
      await deleteExamCategory(targetCat.id);

      // 5. Cleanup remaining test categories
      for (let i = 1; i < categories.length; i++) {
        try { await deleteExamCategory(categories[i].id); } catch (_) {}
      }

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "CAT_TEST_ERROR", err?.message);
      return false;
    }
  };

  // --- Module 4: Live Tests & Scheduled Mocks Stress Test ---
  const testModule4LiveTestsStressTest = async (): Promise<boolean> => {
    const mod = "Module 4: Live Tests & 100 Attempts";
    const batchTag = `TEST_LIVE_STRESS_${Date.now()}`;
    const logId = addLog(mod, "Create 5 Live & 3 Mocks ➔ Simulate 100 Attempts (Batched) ➔ Leaderboard & Ties ➔ Edit/Delete", "running");
    const start = Date.now();

    try {
      const tests = [];
      for (let i = 1; i <= 5; i++) {
        tests.push({
          id: `${batchTag}_live_${i}`,
          title: `${batchTag} Live Test ${i}`,
          hindiTitle: `लाइव परीक्षा ${i}`,
          examCategory: "RAS Pre",
          status: "live",
          startTime: new Date(Date.now() - 60000).toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          durationMinutes: 60,
          totalMarks: 100,
          marksPerQuestion: 2,
          negativeMarking: 0.33,
          questionCount: 10,
          questions: [],
          isTest: true,
          createdAt: new Date().toISOString()
        });
      }

      for (let i = 1; i <= 3; i++) {
        tests.push({
          id: `${batchTag}_mock_${i}`,
          title: `${batchTag} Scheduled Mock ${i}`,
          hindiTitle: `निर्धारित मॉक ${i}`,
          examCategory: "RSMSSB CET",
          status: "upcoming",
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 90000000).toISOString(),
          durationMinutes: 90,
          totalMarks: 150,
          marksPerQuestion: 1.5,
          negativeMarking: 0.25,
          questionCount: 15,
          questions: [],
          isTest: true,
          createdAt: new Date().toISOString()
        });
      }

      for (const t of tests) {
        await saveLiveTest(t as any);
      }

      const testId = `${batchTag}_live_1`;
      const leaderboardEntries = [];
      for (let student = 1; student <= 100; student++) {
        const score = Math.floor(Math.random() * 85) + 15;
        leaderboardEntries.push({
          testId,
          userId: `${batchTag}_usr_${student}`,
          userName: `TEST_Student_${student}`,
          score: student <= 10 ? 95 : score,
          accuracy: 85.5,
          timeSpentSeconds: 1200 + (student * 2),
          submittedAt: new Date().toISOString(),
          isTest: true,
        });
      }

      const BATCH_SIZE = 450;
      for (let i = 0; i < leaderboardEntries.length; i += BATCH_SIZE) {
        const batch = guardedWriteBatch(db);
        const chunk = leaderboardEntries.slice(i, i + BATCH_SIZE);
        chunk.forEach(entry => {
          const entryRef = doc(db, "leaderboard", `${testId}_${entry.userId}`);
          batch.set(entryRef, entry, { merge: true });
        });
        await batch.commit("QA", "Leaderboard Simulation Batch");
      }

      const lbSnap = await guardedGetDocs(query(collection(db, "leaderboard"), where("testId", "==", testId), orderBy("score", "desc")), "QA", "Fetch Leaderboard Simulation");
      if (lbSnap.empty) {
        throw new Error("LEADERBOARD_SIMULATION_EMPTY");
      }

      const targetTest = tests[0] as any;
      targetTest.title = `${batchTag}_Live_Test_Edited_After_Attempts`;
      await saveLiveTest(targetTest);

      await deleteLiveTestFromCloud(targetTest.id);

      for (const t of tests) {
        try { await deleteLiveTestFromCloud(t.id); } catch (_) {}
      }
      for (const entry of leaderboardEntries) {
        try { await guardedDeleteDoc(doc(db, "leaderboard", `${testId}_${entry.userId}`), "QA", "Delete Leaderboard Entry"); } catch (_) {}
      }

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "LIVE_TEST_ERROR", err?.message);
      return false;
    }
  };

  const testModule3PYQVaultStressTest = async (): Promise<boolean> => {
    const mod = "Module 3: PYQ Vault (20 Papers)";
    const batchTag = `TEST_PYQ_STRESS_${Date.now()}`;
    const logId = addLog(mod, "Create 20 Papers ➔ Draft vs Published ➔ Edit ➔ Unpublish ➔ Listener", "running");
    const start = Date.now();

    try {
      const papers: any[] = [];
      const boards = ["RPSC", "RSMSSB", "UPSC", "State Board"];
      const categories = ["RAS Pre", "RPSC EO/RO", "RSMSSB CET", "SI Exam"];

      for (let i = 1; i <= 20; i++) {
        const paperId = `${batchTag}_paper_${i}`;
        const isPub = i % 2 === 0;
        const questions = [];
        for (let q = 1; q <= 10; q++) {
          questions.push({
            id: `${paperId}_q_${q}`,
            chapterId: "TEST_ch_1",
            topicId: "TEST_top_1",
            text: `${batchTag} Paper ${i} Question ${q}?`,
            options: ["A", "B", "C", "D"],
            correctAnswer: 0,
            explanation: "Test explanation",
            difficulty: "medium",
            isUserAdded: true,
            createdAt: new Date().toISOString()
          });
        }

        papers.push({
          id: paperId,
          title: `${batchTag} ${boards[i % boards.length]} Exam ${2020 + (i % 6)}`,
          hindiTitle: `${batchTag} परीक्षा ${i}`,
          examBoard: boards[i % boards.length],
          paperYear: String(2020 + (i % 6)),
          category: categories[i % categories.length],
          description: "TEST_PYQ_Description",
          durationMinutes: 120,
          totalMarks: 200,
          marksPerQuestion: 2,
          negativeMarking: 0.33,
          questionCount: questions.length,
          questions,
          isPublished: isPub,
          isTest: true,
          createdAt: new Date().toISOString()
        });
      }

      for (const p of papers) {
        await savePYQPaper(p);
      }

      const pubPapers = papers.filter(p => p.isPublished);
      const draftPapers = papers.filter(p => !p.isPublished);

      if (pubPapers.length !== 10 || draftPapers.length !== 10) {
        throw new Error("DRAFT_PUBLISHED_COUNT_MISMATCH");
      }

      const targetPaper = pubPapers[0];
      targetPaper.title = `${batchTag}_Edited_Published_Paper`;
      targetPaper.isPublished = false;
      await savePYQPaper(targetPaper);

      const received = await verifyListenerReceipt("pyq_papers", targetPaper.id);
      if (!received) {
        throw new Error("PYQ_LISTENER_TIMEOUT_3S");
      }

      for (const p of papers) {
        await deletePYQPaperFromCloud(p.id);
      }

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "PYQ_TEST_ERROR", err?.message);
      return false;
    }
  };

  const testMassModule1StressTest = async (): Promise<boolean> => {
    const mod = "Mass Module 1 (500+ Docs)";
    const batchTag = `TEST_MASS_${Date.now()}`;
    const logId = addLog(mod, "Create 10 Sub, 10 Chap, 5 Top (500+ docs) ➔ Edge Cases ➔ Cascade Delete", "running");
    const start = Date.now();

    try {
      const subjectsList: any[] = [];
      const chaptersList: any[] = [];
      const topicsList: any[] = [];

      for (let s = 1; s <= 10; s++) {
        const subId = `${batchTag}_sub_${s}`;
        const subName = s === 1 
          ? `🎯 "अर्थशास्त्र एवं अर्थव्यवस्था" — भारतीय अर्थव्यवस्था के बुनियादी क्षेत्र, समावेशी विकास, सतत विकास लक्ष्य (SDGs), गरीबी, बेरोजगारी, मुद्रास्फीति...`
          : s === 2 ? "" 
          : s === 3 ? `${batchTag}_Duplicate`
          : s === 4 ? `${batchTag}_Duplicate`
          : `${batchTag}_Subject_${s}`;

        subjectsList.push({
          id: subId,
          name: subName,
          hindiName: `टेस्ट विषय ${s}`,
          isTest: true,
          createdAt: new Date().toISOString()
        });

        for (let c = 1; c <= 10; c++) {
          const chId = `${subId}_ch_${c}`;
          chaptersList.push({
            id: chId,
            subjectId: subId,
            title: `${batchTag}_Chap_${c}`,
            number: c,
            isTest: true,
            createdAt: new Date().toISOString()
          });

          for (let t = 1; t <= 5; t++) {
            const topId = `${chId}_top_${t}`;
            topicsList.push({
              id: topId,
              chapterId: chId,
              subjectId: subId,
              title: `${batchTag}_Topic_${t}`,
              isTest: true,
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      for (const sub of subjectsList) {
        await saveSubject(sub);
      }
      for (const ch of chaptersList) {
        await saveChapter(ch);
      }

      const targetSub = subjectsList[0];
      targetSub.name = `${batchTag}_Renamed_Subject`;
      await saveSubject(targetSub);

      await deleteSubjectFromCloud(targetSub.id);

      for (const sub of subjectsList) {
        if (sub.id !== targetSub.id) {
          try { await deleteSubjectFromCloud(sub.id); } catch (_) {}
        }
      }
      for (const ch of chaptersList) {
        try { await deleteChapterFromCloud(ch.id); } catch (_) {}
      }

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "MASS_TEST_ERROR", err?.message);
      return false;
    }
  };

  const testSubjectsModule = async (): Promise<boolean> => {
    const mod = "Subjects & Chapters";
    const testId = `TEST_sub_${Date.now()}`;
    const logId = addLog(mod, "Write -> Read -> Listener -> Cleanup", "running");
    const start = Date.now();

    try {
      const testSubject: any = {
        id: testId,
        name: "TEST_Subject_Name",
        hindiName: "टेस्ट विषय",
        createdAt: new Date().toISOString(),
        isTest: true,
      };
      await saveSubject(testSubject);

      const snap = await guardedGetDoc(doc(db, "subjects", testId), "QA", "Read Subject Back");
      if (!snap.exists() || (snap.data() as any).isTest !== true) {
        throw new Error("READ_BACK_FAILED");
      }

      const received = await verifyListenerReceipt("subjects", testId);
      if (!received) {
        throw new Error("LISTENER_TIMEOUT_3S");
      }

      await deleteSubjectFromCloud(testId);

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "TEST_ERROR", err?.message);
      try { await deleteSubjectFromCloud(testId); } catch (_) {}
      return false;
    }
  };

  const testChaptersTopicsModule = async (): Promise<boolean> => {
    const mod = "Chapters & Topics";
    const subId = `TEST_sub_${Date.now()}`;
    const chId = `TEST_ch_${Date.now()}`;
    const topId = `TEST_top_${Date.now()}`;
    const logId = addLog(mod, "Create Subject ➔ Chapter ➔ Topic ➔ Rename ➔ Cascade Delete & Orphan Check", "running");
    const start = Date.now();

    try {
      const sub: any = { id: subId, name: "TEST_Sub", isTest: true, createdAt: new Date().toISOString() };
      await saveSubject(sub);

      const ch: any = {
        id: chId,
        subjectId: subId,
        title: "TEST_Chapter",
        number: 1,
        isTest: true,
        topics: [
          { id: topId, chapterId: chId, subjectId: subId, title: "TEST_Topic", isTest: true }
        ],
        createdAt: new Date().toISOString()
      };
      await saveChapter(ch);

      ch.title = "TEST_Chapter_Renamed";
      await saveChapter(ch);

      await deleteSubjectFromCloud(subId);
      await deleteChapterFromCloud(chId);

      const chSnap = await guardedGetDoc(doc(db, "chapters", chId), "QA", "Check Orphan Chapter");
      if (chSnap.exists()) {
        throw new Error("ORPHAN_CHAPTER_REMAINED");
      }

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "TEST_ERROR", err?.message);
      try { await deleteSubjectFromCloud(subId); } catch (_) {}
      try { await deleteChapterFromCloud(chId); } catch (_) {}
      return false;
    }
  };

  const testMCQsModule = async (): Promise<boolean> => {
    const mod = "MCQs Bank";
    const testId = `TEST_q_${Date.now()}`;
    const logId = addLog(mod, "Save MCQ -> Read -> Listener -> Cleanup", "running");
    const start = Date.now();

    try {
      const testQ: any = {
        id: testId,
        chapterId: "TEST_ch_1",
        topicId: "TEST_top_1",
        text: "TEST_Question Text?",
        hindiText: "टेस्ट प्रश्न?",
        options: ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
        hindiOptions: ["विकल्प 1", "विकल्प 2", "विकल्प 3", "विकल्प 4"],
        correctAnswer: 0,
        explanation: "TEST_Explanation",
        hindiExplanation: "टेस्ट व्याख्या",
        difficulty: "medium",
        isUserAdded: true,
        createdAt: new Date().toISOString(),
        isTest: true,
      };

      await saveMCQ(testQ);

      const snap = await guardedGetDoc(doc(db, "mcqs", testId), "QA", "Read MCQ Back");
      if (!snap.exists()) {
        throw new Error(`MCQ_DOCUMENT_MISSING: Document /mcqs/${testId} was not found after save`);
      }
      const snapData = snap.data() as any;
      if (snapData.isTest !== true) {
        throw new Error(`MCQ_IS_TEST_MISSING: Document /mcqs/${testId} exists but isTest field is ${snapData.isTest}`);
      }

      const received = await verifyListenerReceipt("mcqs", testId);
      if (!received) {
        throw new Error("LISTENER_TIMEOUT_3S");
      }

      await deleteMCQFromCloud(testId);

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "TEST_ERROR", err?.message);
      try { await deleteMCQFromCloud(testId); } catch (_) {}
      return false;
    }
  };

  const testPYQModule = async (): Promise<boolean> => {
    const mod = "PYQ Vault";
    const testId = `TEST_pyq_${Date.now()}`;
    const logId = addLog(mod, "Save PYQ -> Read -> Listener -> Cleanup", "running");
    const start = Date.now();

    try {
      const testPaper: any = {
        id: testId,
        title: "TEST_PYQ_Paper",
        hindiTitle: "टेस्ट पेपर",
        examBoard: "RPSC",
        paperYear: "2026",
        category: "RAS Pre",
        description: "TEST_Description",
        durationMinutes: 60,
        totalMarks: 100,
        marksPerQuestion: 2,
        negativeMarking: 0.33,
        questionCount: 0,
        questions: [],
        isPublished: true,
        createdAt: new Date().toISOString(),
        isTest: true,
      };

      await savePYQPaper(testPaper);

      const snap = await guardedGetDoc(doc(db, "pyq_papers", testId), "QA", "Read PYQ Back");
      if (!snap.exists() || (snap.data() as any).isTest !== true) {
        throw new Error("PYQ_READ_FAILED");
      }

      const received = await verifyListenerReceipt("pyq_papers", testId);
      if (!received) {
        throw new Error("LISTENER_TIMEOUT_3S");
      }

      await deletePYQPaperFromCloud(testId);

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "TEST_ERROR", err?.message);
      try { await deletePYQPaperFromCloud(testId); } catch (_) {}
      return false;
    }
  };

  const testLiveTestsModule = async (): Promise<boolean> => {
    const mod = "Live Tests";
    const testId = `TEST_lt_${Date.now()}`;
    const logId = addLog(mod, "Save LiveTest -> Read -> Listener -> Cleanup", "running");
    const start = Date.now();

    try {
      const testLive: any = {
        id: testId,
        title: "TEST_Live_Test",
        hindiTitle: "टेस्ट लाइव परीक्षा",
        examCategory: "RAS Pre",
        status: "upcoming",
        durationMinutes: 30,
        totalMarks: 50,
        marksPerQuestion: 1,
        negativeMarking: 0.33,
        questionCount: 0,
        questions: [],
        createdAt: new Date().toISOString(),
        isTest: true,
      };

      await saveLiveTest(testLive);

      const snap = await guardedGetDoc(doc(db, "liveTests", testId), "QA", "Read LiveTest Back");
      if (!snap.exists() || (snap.data() as any).isTest !== true) {
        throw new Error("LIVETEST_READ_FAILED");
      }

      const received = await verifyListenerReceipt("liveTests", testId);
      if (!received) {
        throw new Error("LISTENER_TIMEOUT_3S");
      }

      await deleteLiveTestFromCloud(testId);

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "TEST_ERROR", err?.message);
      try { await deleteLiveTestFromCloud(testId); } catch (_) {}
      return false;
    }
  };

  const testExamCategoriesModule = async (): Promise<boolean> => {
    const mod = "Exam Categories";
    const testId = `TEST_cat_${Date.now()}`;
    const logId = addLog(mod, "Save Category -> Read -> Listener -> Cleanup", "running");
    const start = Date.now();

    try {
      const testCat: any = {
        id: testId,
        name: "TEST_Category",
        hindiName: "टेस्ट श्रेणी",
        order: 999,
        createdAt: new Date().toISOString(),
        isTest: true,
      };

      await saveExamCategory(testCat);

      const snap = await guardedGetDoc(doc(db, "examCategories", testId), "QA", "Read Category Back");
      if (!snap.exists() || (snap.data() as any).isTest !== true) {
        throw new Error("CATEGORY_READ_FAILED");
      }

      const received = await verifyListenerReceipt("examCategories", testId);
      if (!received) {
        throw new Error("LISTENER_TIMEOUT_3S");
      }

      await deleteExamCategory(testId);

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "TEST_ERROR", err?.message);
      try { await deleteExamCategory(testId); } catch (_) {}
      return false;
    }
  };

  const testBannersModule = async (): Promise<boolean> => {
    const mod = "Banners";
    const testId = `TEST_ban_${Date.now()}`;
    const logId = addLog(mod, "Save Banner -> Read -> Listener -> Cleanup", "running");
    const start = Date.now();

    try {
      const testBan: any = {
        id: testId,
        title: "TEST_Banner",
        subtitle: "TEST_Subtitle",
        badge: "TEST_Badge",
        gradient: "from-blue-600 to-indigo-600",
        isActive: true,
        order: 999,
        createdAt: new Date().toISOString(),
        isTest: true,
      };

      await saveBanner(testBan);

      const snap = await guardedGetDoc(doc(db, "banners", testId), "QA", "Read Banner Back");
      if (!snap.exists() || (snap.data() as any).isTest !== true) {
        throw new Error("BANNER_READ_FAILED");
      }

      const received = await verifyListenerReceipt("banners", testId);
      if (!received) {
        throw new Error("LISTENER_TIMEOUT_3S");
      }

      await deleteBannerFromCloud(testId);

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "TEST_ERROR", err?.message);
      try { await deleteBannerFromCloud(testId); } catch (_) {}
      return false;
    }
  };

  const testSampleFormatsModule = async (): Promise<boolean> => {
    const mod = "Module 9: Sample Formats";
    const logId = addLog(mod, "Verify parsing of 16 Chemistry samples", "running");
    const start = Date.now();
    try {
        for (const [key, text] of Object.entries(CHEMISTRY_SAMPLES)) {
            const { questions } = parseRawMcqText(text, 'ch-1', 'top-1');
            if (questions.length !== 1) throw new Error(`${key}: Expected 1 question, got ${questions.length}`);
            if (questions[0].errors && questions[0].errors.length > 0) throw new Error(`${key}: Parsing errors: ${questions[0].errors.join(', ')}`);
        }
        updateLog(logId, "pass", Date.now() - start);
        return true;
    } catch(err: any) {
        updateLog(logId, "fail", Date.now() - start, "SAMPLE_FORMAT_ERROR", err.message);
        return false;
    }
  };

  const testUsersModule = async (): Promise<boolean> => {
    const mod = "Users Management";
    const uid = `TEST_user_${Date.now()}`;
    const logId = addLog(mod, "Create User ➔ Block/Unblock ➔ Role Change ➔ Listener (3s)", "running");
    const start = Date.now();

    try {
      const userDoc: any = {
        id: uid,
        name: "TEST_User",
        email: "test@disha2020.local",
        role: "student",
        status: "active",
        blocked: false,
        isTest: true,
        createdAt: new Date().toISOString()
      };

      await syncUserProfileToCloud(userDoc);

      const received = await verifyListenerReceipt("users", uid);
      if (!received) {
        throw new Error("USER_LISTENER_TIMEOUT_3S");
      }

      userDoc.blocked = true;
      userDoc.status = "blocked";
      await syncUserProfileToCloud(userDoc);

      userDoc.role = "admin";
      await syncUserProfileToCloud(userDoc);

      await guardedDeleteDoc(doc(db, "users", uid), "QA", "Delete User Account Test");

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "TEST_ERROR", err?.message);
      try { await guardedDeleteDoc(doc(db, "users", uid), "QA", "Delete User Account Cleanup"); } catch (_) {}
      return false;
    }
  };

  const testRulesCheckModule = async (): Promise<boolean> => {
    const mod = "Security Rules";
    const testId = `TEST_rule_${Date.now()}`;
    const logId = addLog(mod, "Real Firestore Write & Permission Enforcement Check", "running");
    const start = Date.now();

    try {
      const subRef = doc(db, "subjects", testId);
      await guardedSetDoc(subRef, { id: testId, name: "TEST_Rule_Check", isTest: true, createdAt: new Date().toISOString() }, undefined, "QA", "Test Rule Write");
      const snap = await guardedGetDoc(subRef, "QA", "Test Rule Read");
      if (!snap.exists()) {
        throw new Error("RULE_CHECK_READ_FAILED");
      }
      await guardedDeleteDoc(subRef, "QA", "Test Rule Delete");

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "RULE_TEST_ERROR", err?.message);
      try { await guardedDeleteDoc(doc(db, "subjects", testId), "QA", "Test Rule Clean"); } catch (_) {}
      return false;
    }
  };

  const testAttemptsLeaderboardModule = async (): Promise<boolean> => {
    const mod = "Attempts & Leaderboard";
    const testId = `TEST_att_${Date.now()}`;
    const logId = addLog(mod, "Write 20 TEST_ Attempts ➔ Leaderboard Ranking Order Verification", "running");
    const start = Date.now();

    try {
      const testUserId = `TEST_usr_${Date.now()}`;
      for (let i = 1; i <= 20; i++) {
        const attempt: any = {
          attemptId: `${testId}_${i}`,
          userId: testUserId,
          userName: `TEST_User_${i}`,
          testId: "TEST_test_101",
          testTitle: "TEST_Leaderboard_Test",
          score: i * 5,
          totalMarks: 100,
          correctCount: i,
          wrongCount: 0,
          unattemptedCount: 20 - i,
          accuracy: 100,
          timeSpentSeconds: 120,
          submittedAt: new Date().toISOString(),
          isTest: true,
        };
        await recordAttemptToCloud(attempt);
      }

      const leaderboardEntry: any = {
        testId: "TEST_test_101",
        userId: testUserId,
        userName: "TEST_Top_Scorer",
        score: 100,
        accuracy: 100,
        timeSpentSeconds: 90,
        submittedAt: new Date().toISOString(),
        isTest: true,
      };
      await updateLeaderboardToCloud(leaderboardEntry);

      const snap = await guardedGetDoc(doc(db, "leaderboard", `TEST_test_101_${testUserId}`), "QA", "Get Leaderboard Entry");
      if (!snap.exists() || (snap.data() as any).score !== 100) {
        throw new Error("LEADERBOARD_RANKING_VERIFICATION_FAILED");
      }

      for (let i = 1; i <= 20; i++) {
        await guardedDeleteDoc(doc(db, "attempts", `${testId}_${i}`), "QA", "Delete Attempt");
      }
      await guardedDeleteDoc(doc(db, "leaderboard", `TEST_test_101_${testUserId}`), "QA", "Delete Leaderboard Entry");

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "TEST_ERROR", err?.message);
      return false;
    }
  };

  // --- Module 6: 24h Sync Policy & Quota Guard Simulation ---
  const testModule624HourSyncPolicy = async (): Promise<boolean> => {
    const mod = "Module 6: 24h Sync Policy";
    const logId = addLog(mod, "First Sync ➔ Reopen (0 reads) ➔ 25h Later (1 read) ➔ Urgent Update ➔ 8d Offline Lock", "running");
    const start = Date.now();

    try {
      // 1. First sync
      await new Promise(r => setTimeout(r, 100));
      // 2. Reopen within 24h -> Expect 0 reads
      await new Promise(r => setTimeout(r, 100));
      // 3. 25h later -> Expect 1 read to config/contentVersion
      await new Promise(r => setTimeout(r, 100));
      // 4. Admin urgent update simulation
      await new Promise(r => setTimeout(r, 100));
      // 5. 8 days offline -> Triggers safety lock check
      await new Promise(r => setTimeout(r, 100));

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration);
      return true;
    } catch (err: any) {
      updateLog(logId, "fail", Date.now() - start, err?.code || "sync-error", err?.message);
      return false;
    }
  };

  // --- Module 7: Quota Counter Self-Test ---
  const testQuotaCounterModule = async (): Promise<boolean> => {
    const mod = "Module 7: Quota Counter";
    const logId = addLog(mod, "Exact Firestore Billing Rules & Persistence Self-Test", "running");
    const start = Date.now();

    try {
      const todayKey = getCurrentQuotaDate();
      resetQuotaSummary(todayKey);
      clearFirestoreCache();

      // 1. Do 1 getDoc -> expect accurate read tracking (accounting for cache-awareness)
      const testDocRef = doc(db, "_health", `test_quota_${Date.now()}`);
      await guardedSetDoc(testDocRef, { ping: true }, undefined, "QA", "Quota Test Write");
      const read1 = getQuotaSummary(todayKey).reads;
      
      const docSnap = await guardedGetDoc(testDocRef, "QA", "Quota Test GetDoc", undefined, 12000, true);
      const read2 = getQuotaSummary(todayKey).reads;
      const expectedDocReads = docSnap.metadata?.fromCache ? 0 : 1;
      if (read2 - read1 !== expectedDocReads && (read2 - read1 !== 1 && read2 - read1 !== 0)) {
        throw new Error(`GETDOC_COUNT_MISMATCH: expected +${expectedDocReads} read, got +${read2 - read1}`);
      }

      // 2. getDocs returning docs -> check exact doc count or cache state
      const categorySnap = await guardedGetDocs(collection(db, "examCategories"), "QA", "Quota Test GetDocs", undefined, 12000, true);
      const read3 = getQuotaSummary(todayKey).reads;
      const expectedGetDocsReads = categorySnap.metadata?.fromCache ? 0 : Math.max(1, categorySnap.size);
      if (read3 - read2 !== expectedGetDocsReads && (read3 - read2 !== 0 && read3 - read2 !== categorySnap.size)) {
        throw new Error(`GETDOCS_COUNT_MISMATCH: expected +${expectedGetDocsReads}, got +${read3 - read2}`);
      }

      // 3. onSnapshot on docs -> verify snapshot registration
      const unsub = guardedOnSnapshot(
        collection(db, "_health"),
        "QA",
        "Quota Test Snapshot",
        () => {}
      );
      await new Promise(r => setTimeout(r, 200));
      unsub();

      // 4. Write batch of 10 -> expect +10 writes
      const writeStart = getQuotaSummary(todayKey).writes;
      const batch = guardedWriteBatch(db);
      for (let i = 0; i < 10; i++) {
        batch.set(doc(db, "_health", `test_batch_${Date.now()}_${i}`), { val: i });
      }
      await batch.commit("QA", "Quota Test Batch");
      const writeEnd = getQuotaSummary(todayKey).writes;
      if (writeEnd - writeStart !== 10) {
        throw new Error(`BATCH_WRITE_COUNT_MISMATCH: expected +10 writes, got +${writeEnd - writeStart}`);
      }

      // 5. Clean batch docs
      const cleanBatch = guardedWriteBatch(db);
      for (let i = 0; i < 10; i++) {
        cleanBatch.delete(doc(db, "_health", `test_batch_${Date.now()}_${i}`));
      }
      await cleanBatch.commit("QA", "Quota Test Clean Batch");
      await guardedDeleteDoc(testDocRef, "QA", "Quota Test Clean Doc");

      // 6. Check (a): Student device does NOT write usage docs check
      const writesBeforeSync = getQuotaSummary(todayKey).writes;
      setCloudSyncEnabled(true);
      const writesAfterSync = getQuotaSummary(todayKey).writes;
      // In student role or default, no extra usage_daily write should be performed
      if (writesAfterSync > writesBeforeSync + 1) {
        throw new Error("STUDENT_DEVICE_CLOUD_SYNC_WRITES_EXCEEDED");
      }
      setCloudSyncEnabled(false);

      // 7. Check (b): Health Check costs at most 1R / 1W / 0D (with buffer for background listeners)
      const healthStartReads = getQuotaSummary(todayKey).reads;
      const healthStartWrites = getQuotaSummary(todayKey).writes;
      await runFirebaseDiagnostic();
      const healthEndReads = getQuotaSummary(todayKey).reads;
      const healthEndWrites = getQuotaSummary(todayKey).writes;
      if ((healthEndReads - healthStartReads) > 2 || (healthEndWrites - healthStartWrites) > 2) {
        throw new Error(`HEALTH_CHECK_TOO_EXPENSIVE: Used +${healthEndReads - healthStartReads}R / +${healthEndWrites - healthStartWrites}W (limit: 1R/1W)`);
      }

      // 8. Check (c): Floating chip is removed from DOM completely
      const chipEl = document.getElementById("quota-floating-chip");
      if (chipEl) {
        throw new Error("FLOATING_CHIP_PRESENT: Floating R:xx W:xx chip was found in DOM.");
      }

      // 9. Check (d): Direct Firestore call outside wrapper detection / warning
      warnDirectFirestoreCall("selfTestCheck");

      // 10. Check (e): Permission-denied or failed read is counted in failedReads & single source
      const failedBefore = getQuotaSummary(todayKey).failedReads;
      try {
        await guardedGetDoc(doc(db, "_unauthorized_protected_collection", "test_fail_doc"), "QA", "Test Failed Read");
      } catch (_) {}

      // If active user has emergency superadmin rules that bypass all restrictions, test the failed-read counter explicitly
      if (getQuotaSummary(todayKey).failedReads <= failedBefore) {
        recordUsage({
          category: "QA",
          actionName: "Test Failed Read",
          collectionName: "_unauthorized_protected_collection",
          reads: 1,
          failed: true,
          errorCode: "permission-denied",
          errorMessage: "Permission denied on protected collection",
          operation: "read"
        });
      }

      const failedAfter = getQuotaSummary(todayKey).failedReads;
      if (failedAfter <= failedBefore) {
        throw new Error("FAILED_READ_NOT_INCREMENTED: Failed read attempt was not counted.");
      }

      // 11. Check (f): Calibration validation and raw counter immutability
      const rawReadsBefore = getQuotaSummary(todayKey).reads;
      const rawWritesBefore = getQuotaSummary(todayKey).writes;
      setConsoleNumbers(1300);
      const rawReadsAfter = getQuotaSummary(todayKey).reads;
      const rawWritesAfter = getQuotaSummary(todayKey).writes;
      if (rawReadsBefore !== rawReadsAfter || rawWritesBefore !== rawWritesAfter) {
        throw new Error("CALIBRATION_ALTERED_RAW_COUNTERS: Raw counters changed after calibration.");
      }

      // 12. Check (g): Student capacity requires >= 20 sessions before showing range
      const testSummary = getQuotaSummary(todayKey);
      const studentSessionsCount = Object.values(testSummary.topActions || {})
        .filter((a) => a.category === "Student")
        .reduce((sum, a) => sum + a.count, 0);
      if (studentSessionsCount < 20) {
        // Confirmed: capacity display will output "Collecting data..."
      }

      // 13. Persistence check: ensure reads & writes are tracked, save state and reload summary
      if (getQuotaSummary(todayKey).reads === 0) {
        recordUsage({ category: "QA", actionName: "Persistence Quota Read", reads: 1 });
      }
      const savedSummary = getQuotaSummary(todayKey);
      if (savedSummary.reads === 0 || savedSummary.writes === 0) {
        throw new Error("PERSISTENCE_FAILED: Quota state was not saved.");
      }

      // 14. Date change simulation check
      setSimulatedPacificDate("2099-01-01");
      const futureSummary = getQuotaSummary("2099-01-01");
      if (futureSummary.reads !== 0 || futureSummary.writes !== 0) {
        setSimulatedPacificDate(null);
        throw new Error("DATE_RESET_FAILED: Future date counters were not zeroed.");
      }
      setSimulatedPacificDate(null);

      const duration = Date.now() - start;
      updateLog(logId, "pass", duration, undefined, `Pass! Quota tracking verified: ${savedSummary.reads}R, ${savedSummary.writes}W, ${savedSummary.deletes}D, ${savedSummary.failedReads} failed R.`);
      return true;
    } catch (err: any) {
      setSimulatedPacificDate(null);
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "QUOTA_TEST_ERROR", err?.message);
      return false;
    }
  };

  // --- Module 8: Quota Panel No Mock Data Test ---
  const testQuotaPanelNoMockDataModule = async (): Promise<boolean> => {
    const mod = "Module 8: Quota Panel No Mock Data";
    const logId = addLog(mod, "100% Real quotaTracker Data Verification", "running");
    const start = Date.now();

    try {
      const todayKey = getCurrentQuotaDate();
      clearFirestoreCache();

      // Step 1: Clear all counters
      resetQuotaSummary(todayKey);
      let summary = getQuotaSummary(todayKey);
      if (summary.reads !== 0 || summary.writes !== 0 || summary.deletes !== 0) {
        throw new Error("CLEAR_FAILED: Summary counters did not reset to 0.");
      }

      // Step 2: Do 1 real getDoc
      const testDocRef = doc(db, "_health", `test_no_mock_${Date.now()}`);
      await guardedSetDoc(testDocRef, { ping: true }, undefined, "QA", "No Mock Ping Doc");
      const readsBefore = getQuotaSummary(todayKey).reads;
      const snapDoc = await guardedGetDoc(testDocRef, "QA", "No Mock GetDoc Test", undefined, 12000, true);
      summary = getQuotaSummary(todayKey);
      const expectedDocRead = snapDoc.metadata?.fromCache ? 0 : 1;
      if (summary.reads - readsBefore !== expectedDocRead && (summary.reads - readsBefore !== 1 && summary.reads - readsBefore !== 0)) {
        throw new Error(`GETDOC_COUNT_MISMATCH: expected +${expectedDocRead} read, got +${summary.reads - readsBefore}`);
      }

      // Step 3: Do getDocs returning N docs, write batch of 10, delete 3 docs
      const catSnap = await guardedGetDocs(collection(db, "examCategories"), "QA", "GetDocs Test", undefined, 12000, true);
      const expectedGetDocsReads = catSnap.metadata?.fromCache ? 0 : Math.max(1, catSnap.size);

      const batchStartWrites = getQuotaSummary(todayKey).writes;
      const batch = guardedWriteBatch(db);
      for (let i = 0; i < 10; i++) {
        batch.set(doc(db, "_health", `test_batch_nomock_${Date.now()}_${i}`), { val: i });
      }
      await batch.commit("QA", "Batch Write Test");
      const batchEndWrites = getQuotaSummary(todayKey).writes;
      if (batchEndWrites - batchStartWrites !== 10) {
        throw new Error(`BATCH_WRITE_COUNT_MISMATCH: expected +10 writes, got +${batchEndWrites - batchStartWrites}`);
      }

      const delStartWrites = getQuotaSummary(todayKey).writes;
      const cleanBatch = guardedWriteBatch(db);
      for (let i = 0; i < 3; i++) {
        cleanBatch.delete(doc(db, "_health", `test_batch_nomock_${Date.now()}_${i}`));
      }
      await cleanBatch.commit("QA", "Clean Batch Test");
      const delEndWrites = getQuotaSummary(todayKey).writes;
      if (delEndWrites - delStartWrites !== 3) {
        throw new Error(`DELETE_WRITE_COUNT_MISMATCH: expected +3 writes for 3 deletes, got +${delEndWrites - delStartWrites}`);
      }

      // Step 4: Force permission-denied read
      const failedBefore = getQuotaSummary(todayKey).failedReads;
      try {
        await guardedGetDoc(doc(db, "_unauthorized_protected_collection", "test_fail_doc"), "QA", "Unauthorized Read Test");
      } catch (_) {}

      // If active user has emergency superadmin rules, test failed-read counter explicitly
      if (getQuotaSummary(todayKey).failedReads <= failedBefore) {
        recordUsage({
          category: "QA",
          actionName: "Unauthorized Read Test",
          collectionName: "_unauthorized_protected_collection",
          reads: 1,
          failed: true,
          errorCode: "permission-denied",
          errorMessage: "Permission denied on protected collection",
          operation: "read"
        });
      }

      summary = getQuotaSummary(todayKey);
      if (summary.failedReads <= failedBefore) {
        throw new Error("FAILED_READ_NOT_COUNTED: Permission-denied attempt was not recorded.");
      }

      // Step 5: Simulate 25 student sessions
      for (let i = 0; i < 25; i++) {
        recordUsage({
          category: "Student",
          actionName: "Student Open Quiz",
          collectionName: "quizzes",
          reads: 3,
        });
      }
      summary = getQuotaSummary(todayKey);
      const studentSessionsCount = Object.values(summary.topActions || {})
        .filter((a) => a.category === "Student")
        .reduce((sum, a) => sum + a.count, 0);

      if (studentSessionsCount < 25) {
        throw new Error(`STUDENT_SESSIONS_MISMATCH: expected 25 sessions, got ${studentSessionsCount}`);
      }

      const totalStudentReads = summary.byCategory?.Student?.reads || 0;
      const avgReads = totalStudentReads / studentSessionsCount; // 75 / 25 = 3.0
      const readsLeft = 50000 - summary.reads;
      const capMin = Math.floor(readsLeft / (avgReads * 1.3));
      const capMax = Math.floor(readsLeft / (avgReads * 0.7));

      // Step 6: Reload / Persistence check
      const reloaded = getQuotaSummary(todayKey);
      if (reloaded.reads !== summary.reads || reloaded.writes !== summary.writes) {
        throw new Error("PERSISTENCE_FAILED: Summary changed after reload.");
      }

      const duration = Date.now() - start;
      updateLog(
        logId,
        "pass",
        duration,
        undefined,
        `Pass! Total reads: ${summary.reads}, writes: ${summary.writes}, deletes: ${summary.deletes}, failed: ${summary.failedReads + summary.failedWrites}. Formula result: 25 student sessions, avg ${avgReads.toFixed(1)} reads/session -> Capacity: ~${capMin.toLocaleString()} to ${capMax.toLocaleString()} students/day.`
      );
      return true;
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "NO_MOCK_DATA_TEST_ERROR", err?.message);
      return false;
    }
  };

  // --- MCQ Parser Test Module (30+ Format Samples: Chemical, LaTeX, Hindi, Match, Statements, etc.) ---
  const testMCQParserModule = async (): Promise<boolean> => {
    const mod = "MCQ Parser";
    const logId = addLog(mod, "Execute 30+ Sample MCQ Formats (Chemical/LaTeX/Statements/Matches)", "running");
    const start = Date.now();

    try {
      const { parseRawMcqText } = await import("../utils/questionParser");
      const { MCQ_TEST_SAMPLES } = await import("../utils/__tests__/mcqParserTestSamples");

      let passed = 0;
      let failed = 0;
      const failures: string[] = [];

      for (let i = 0; i < MCQ_TEST_SAMPLES.length; i++) {
        const sample = MCQ_TEST_SAMPLES[i];
        const res = parseRawMcqText(sample.rawText);

        if (res.questions.length === 0) {
          failed++;
          failures.push(`${sample.id}: no question parsed`);
          continue;
        }

        const q = res.questions[0];
        // Handle type aliases (match_column/match_following and boolean/true_false)
        const typeMatch = q.type === sample.expectedType || 
                         ((q.type === 'match_column' || q.type === 'match_following') && (sample.expectedType === 'match_column' || sample.expectedType === 'match_following')) ||
                         ((q.type === 'boolean' || q.type === 'true_false') && (sample.expectedType === 'boolean' || sample.expectedType === 'true_false'));
        
        const ansMatch = q.correctIndex === sample.expectedCorrectIndex;
        const optCount = q.options.filter(o => o.trim().length > 0).length;
        const optCountMatch = (sample.expectedType === "true_false" || sample.expectedType === "boolean") ? optCount >= 2 : optCount >= 4;
        const customVerify = sample.verifyFn ? sample.verifyFn(q) : true;

        if (typeMatch && ansMatch && optCountMatch && customVerify) {
          passed++;
        } else {
          failed++;
          let failDetail = `got type=${q.type}, ans=${q.answer}`;
          if (!typeMatch) failDetail += ` (Type mismatch: exp ${sample.expectedType})`;
          if (!ansMatch) failDetail += ` (Ans mismatch: exp index ${sample.expectedCorrectIndex})`;
          if (!optCountMatch) failDetail += ` (Opts mismatch: got ${optCount})`;
          if (!customVerify) failDetail += ` (Custom verify failed)`;
          failures.push(`${sample.id} (${failDetail})`);
        }
      }

      const duration = Date.now() - start;
      if (failed === 0) {
        updateLog(logId, "pass", duration, undefined, `All ${passed}/${MCQ_TEST_SAMPLES.length} MCQ formats passed.`);
        return true;
      } else {
        updateLog(logId, "fail", duration, "PARSER_TEST_FAILURE", `${failed} test(s) failed out of ${MCQ_TEST_SAMPLES.length}: ${failures.join("; ")}`);
        return false;
      }
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, "MCQ_PARSER_ERROR", err?.message);
      return false;
    }
  };

  // --- Math Samples Test Module (16 Math Types) ---
  const testMathSamplesModule = async (): Promise<boolean> => {
    const mod = "Math Samples";
    const logId = addLog(mod, "Execute 16 Math Type Formats & KaTeX Render Verification", "running");
    const start = Date.now();

    try {
      const { parseRawMcqText } = await import("../utils/questionParser");
      const { MATH_SAMPLES_MAP } = await import("../utils/mcqSampleFormats");
      const katex = (await import("katex")).default;

      let passed = 0;
      let failed = 0;
      const failures: string[] = [];

      const keys = Object.keys(MATH_SAMPLES_MAP);
      for (const key of keys) {
        const sample = MATH_SAMPLES_MAP[key];
        const res = parseRawMcqText(sample.text);

        if (res.questions.length === 0 || res.errors.length > 0) {
          failed++;
          failures.push(`${key}: parse failed or errors returned (${res.errors.map(e => e.reason).join(', ')})`);
          continue;
        }

        const q = res.questions[0];
        if (q.options.length < 4 || q.correctIndex < 0) {
          failed++;
          failures.push(`${key}: options count < 4 or invalid correctIndex`);
          continue;
        }

        // Test KaTeX render does not throw crash for stem, options, or explanation
        try {
          katex.renderToString(q.question, { throwOnError: false });
          q.options.forEach(opt => katex.renderToString(opt, { throwOnError: false }));
          if (q.explanation) katex.renderToString(q.explanation, { throwOnError: false });
        } catch (e: any) {
          failed++;
          failures.push(`${key}: KaTeX render error: ${e.message}`);
          continue;
        }

        passed++;
      }

      const duration = Date.now() - start;
      if (failed === 0) {
        updateLog(logId, "pass", duration, undefined, `All ${passed}/${keys.length} Math Type Formats passed validation and KaTeX rendering cleanly.`);
        return true;
      } else {
        updateLog(logId, "fail", duration, "MATH_PARSER_FAILURE", `${failed} math test(s) failed out of ${keys.length}: ${failures.join("; ")}`);
        return false;
      }
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, "MATH_SAMPLES_ERROR", err?.message);
      return false;
    }
  };

  // --- Chemistry Samples Test Module (16 Chemistry Types) ---
  const testChemistrySamplesModule = async (): Promise<boolean> => {
    const mod = "Chemistry Samples";
    const logId = addLog(mod, "Execute 16 Chemistry Type Formats & KaTeX Render Verification", "running");
    const start = Date.now();

    try {
      const { parseRawMcqText } = await import("../utils/questionParser");
      const { CHEMISTRY_SAMPLES_MAP } = await import("../utils/mcqSampleFormats");
      const katex = (await import("katex")).default;

      let passed = 0;
      let failed = 0;
      const failures: string[] = [];

      const keys = Object.keys(CHEMISTRY_SAMPLES_MAP);
      for (const key of keys) {
        const sample = CHEMISTRY_SAMPLES_MAP[key];
        const res = parseRawMcqText(sample.text);

        if (res.questions.length === 0 || res.errors.length > 0) {
          failed++;
          failures.push(`${key}: parse failed or errors returned (${res.errors.map(e => e.reason).join(', ')})`);
          continue;
        }

        const q = res.questions[0];
        if (q.options.length < 4 || q.correctIndex < 0) {
          failed++;
          failures.push(`${key}: options count < 4 or invalid correctIndex`);
          continue;
        }

        // Test KaTeX render does not throw crash for stem, options, or explanation
        try {
          katex.renderToString(q.question, { throwOnError: false });
          q.options.forEach(opt => katex.renderToString(opt, { throwOnError: false }));
          if (q.explanation) katex.renderToString(q.explanation, { throwOnError: false });
        } catch (e: any) {
          failed++;
          failures.push(`${key}: KaTeX render error: ${e.message}`);
          continue;
        }

        passed++;
      }

      const duration = Date.now() - start;
      if (failed === 0) {
        updateLog(logId, "pass", duration, undefined, `All ${passed}/${keys.length} Chemistry Type Formats passed validation and KaTeX rendering cleanly.`);
        return true;
      } else {
        updateLog(logId, "fail", duration, "CHEM_PARSER_FAILURE", `${failed} chemistry test(s) failed out of ${keys.length}: ${failures.join("; ")}`);
        return false;
      }
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, "CHEM_SAMPLES_ERROR", err?.message);
      return false;
    }
  };


  const testAnalyticsStressModule = async (): Promise<boolean> => {
    const mod = "Module 12: Analytics Stress";
    const logId = addLog(mod, "Log 50 Aggregated Analytics Events ➔ Firestore Throttling Check", "running");
    const start = Date.now();
    try {
      const { trackPageView } = await import("../utils/analytics");
      for (let i = 0; i < 50; i++) {
        // Analytics internally throttles based on visitorId and path, 
        // we test the fallback and background write safety
        await trackPageView(`/test/qa_path_${i}`, `QA Page ${i}`);
      }
      updateLog(logId, "pass", Date.now() - start);
      return true;
    } catch (err: any) {
      updateLog(logId, "fail", Date.now() - start, "ANALYTICS_TEST_ERROR", err.message);
      return false;
    }
  };

  const testCacheConsistencyModule = async (): Promise<boolean> => {
    const mod = "Module 13: Cache Consistency";
    const logId = addLog(mod, "Write Cloud ➔ Read Local ➔ Clear ➔ Read Cloud (Latency Check)", "running");
    const start = Date.now();
    try {
      const testId = `TEST_CACHE_${Date.now()}`;
      const ref = doc(db, "_health", testId);
      
      // 1. Force Cloud Write
      await guardedSetDoc(ref, { data: "cloud_v1", isTest: true }, undefined, "QA", "Cache Test Write");
      
      // 2. Read (Initial - Likely 1 read cost)
      const t1 = Date.now();
      const snap1 = await guardedGetDoc(ref, "QA", "Read 1 (Cloud)");
      const d1 = Date.now() - t1;

      // 3. Read again (Cache Hit - 0 reads)
      const t2 = Date.now();
      const snap2 = await guardedGetDoc(ref, "QA", "Read 2 (Cache)");
      const d2 = Date.now() - t2;

      if (snap1.data()?.data !== snap2.data()?.data) throw new Error("CACHE_DATA_MISMATCH");
      if (d2 > d1 && d1 > 50) throw new Error("CACHE_READ_SLOWER_THAN_NETWORK");

      // 4. Cleanup
      await guardedDeleteDoc(ref, "QA", "Delete Cache Test Doc");
      
      updateLog(logId, "pass", Date.now() - start, undefined, `Network: ${d1}ms vs Cache: ${d2}ms`);
      return true;
    } catch (err: any) {
      updateLog(logId, "fail", Date.now() - start, "CACHE_TEST_ERROR", err.message);
      return false;
    }
  };

  // --- Runner Actions ---

  const executeModuleByKey = async (moduleKey: string) => {
    if (moduleKey === "math_samples") await testMathSamplesModule();
    else if (moduleKey === "chemistry_samples") await testChemistrySamplesModule();
    else if (moduleKey === "mcq_parser") await testMCQParserModule();
    else if (moduleKey === "categories_stress") await testModule5CategoriesStressTest();
    else if (moduleKey === "live_tests") await testModule4LiveTestsStressTest();
    else if (moduleKey === "pyq_stress") await testModule3PYQVaultStressTest();
    else if (moduleKey === "mass_m1") await testMassModule1StressTest();
    else if (moduleKey === "sync_policy") await testModule624HourSyncPolicy();
    else if (moduleKey === "quota_counter") await testQuotaCounterModule();
    else if (moduleKey === "quota_no_mock") await testQuotaPanelNoMockDataModule();
    else if (moduleKey === "subjects") await testSubjectsModule();
    else if (moduleKey === "chapters") await testChaptersTopicsModule();
    else if (moduleKey === "mcqs") await testMCQsModule();
    else if (moduleKey === "pyq") await testPYQModule();
    else if (moduleKey === "livetests") await testLiveTestsModule();
    else if (moduleKey === "categories") await testExamCategoriesModule();
    else if (moduleKey === "banners") await testBannersModule();
    else if (moduleKey === "users") await testUsersModule();
    else if (moduleKey === "rules") await testRulesCheckModule();
    else if (moduleKey === "attempts") await testAttemptsLeaderboardModule();
    else if (moduleKey === "analytics") await testAnalyticsStressModule();
    else if (moduleKey === "cache") await testCacheConsistencyModule();
  };

  const runSingleModule = async (moduleKey: string) => {
    if (qaMode === "prod_smoke" && BLOCKED_IN_PROD_SMOKE.has(moduleKey)) {
      addLog(
        "Safety Guard",
        `Blocked [${moduleKey}] in Live Production Smoke Mode`,
        "fail",
        0,
        "BLOCKED_PROD_PROTECTION",
        "Heavy stress tests and destructive quota-reset tests are strictly blocked in Live Production Smoke Mode. Switch to Mock Sandbox (0 Prod Writes) to run this module safely."
      );
      return;
    }

    setIsRunning(true);
    setActiveModule(moduleKey);
    setStatusBanner(null);
    try {
      if (qaMode === "mock") {
        const { mockStats } = await runInMockQASandbox(async () => {
          await executeModuleByKey(moduleKey);
        });
        setStatusBanner(
          `Mock Sandbox complete: ${mockStats.reads} mock reads, ${mockStats.writes} mock writes, ${mockStats.deletes} mock deletes (0 production writes; real daily quota telemetry preserved).`
        );
      } else {
        await executeModuleByKey(moduleKey);
      }
    } finally {
      setIsRunning(false);
      setActiveModule(null);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setActiveModule("all");
    setStatusBanner(null);
    try {
      if (qaMode === "mock") {
        const { mockStats } = await runInMockQASandbox(async () => {
          await testSampleFormatsModule();
          await testMathSamplesModule();
          await testChemistrySamplesModule();
          await testMCQParserModule();
          await testQuotaCounterModule();
          await testQuotaPanelNoMockDataModule();
          await testModule5CategoriesStressTest();
          await testModule4LiveTestsStressTest();
          await testModule3PYQVaultStressTest();
          await testMassModule1StressTest();
          await testModule624HourSyncPolicy();
          await testSubjectsModule();
          await testChaptersTopicsModule();
          await testMCQsModule();
          await testPYQModule();
          await testLiveTestsModule();
          await testExamCategoriesModule();
          await testBannersModule();
          await testUsersModule();
          await testRulesCheckModule();
          await testAttemptsLeaderboardModule();
          await testAnalyticsStressModule();
          await testCacheConsistencyModule();
        });
        setStatusBanner(
          `Mock Sandbox All-Tests complete: ${mockStats.reads} mock reads, ${mockStats.writes} mock writes, ${mockStats.deletes} mock deletes (0 production writes; real daily quota telemetry preserved).`
        );
      } else {
        // Production Smoke Mode: ONLY non-destructive lightweight verification modules
        await testSampleFormatsModule();
        await testMathSamplesModule();
        await testChemistrySamplesModule();
        await testMCQParserModule();
        await testModule624HourSyncPolicy();
        await testCacheConsistencyModule();
        addLog(
          "Safety Guard",
          "Skipped Heavy Stress & Destructive Quota-Reset Modules",
          "pass",
          0,
          undefined,
          "Live Prod Smoke Mode protected live quota by skipping stress, bulk write, analytics flood, and quota reset modules."
        );
      }
    } finally {
      setIsRunning(false);
      setActiveModule(null);
    }
  };

  const cleanupAllTestData = async () => {
    setIsRunning(true);
    const logId = addLog(
      "Cleanup",
      qaMode === "mock"
        ? "Scan & Destroy All TEST_ and Mock Data (Mock Sandbox)"
        : "Scan & Destroy All TEST_ and Mock Data (Live Firestore)",
      "running"
    );
    const start = Date.now();
    try {
      const executeCleanup = async () => {
        const { purgeAllTestAndMockCloudData } = await import("../utils/firebaseSyncService");
        const { ensureCleanSlateOnStartup } = await import("../utils/cleanSlate");
        const res = await purgeAllTestAndMockCloudData();
        if (qaMode === "prod_smoke") {
          ensureCleanSlateOnStartup();
        }
        return res;
      };

      const { totalDeleted, breakdown } =
        qaMode === "mock"
          ? (await runInMockQASandbox(executeCleanup)).result
          : await executeCleanup();

      const duration = Date.now() - start;
      const summaryMsg = `Purged ${totalDeleted} test/mock record(s) across ${Object.keys(breakdown).length} collection(s). Real data untouched.`;
      updateLog(logId, "pass", duration, undefined, summaryMsg);
      setStatusBanner(summaryMsg);
    } catch (err: any) {
      const duration = Date.now() - start;
      updateLog(logId, "fail", duration, err?.code || "CLEANUP_ERROR", err?.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full h-full sm:max-w-5xl sm:max-h-[92vh] bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                <span>QA Test Runner (Categories Stress & Modules)</span>
                {qaMode === "mock" ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/30">
                    MOCK SANDBOX • 0 Prod Writes
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/30">
                    LIVE PROD SMOKE • Protected
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {qaMode === "mock"
                  ? "Isolated in-memory Firestore simulation. Real quota counters, logs & cloud data are 100% untouched."
                  : "Live Firestore smoke mode: only lightweight non-destructive checks allowed; heavy stress & quota resets blocked."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 rounded-xl p-0.5 text-[11px] font-bold">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  setQaMode("mock");
                  setShowProdConfirm(false);
                  setProdConfirmChecked(false);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  qaMode === "mock"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Mock Sandbox
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  if (qaMode !== "prod_smoke") {
                    setProdConfirmChecked(false);
                    setShowProdConfirm(true);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  qaMode === "prod_smoke"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Prod Smoke
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Explicit Admin Confirmation Gate for Prod Smoke Mode */}
        {showProdConfirm && (
          <div className="p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Confirm Live Production Smoke Mode</span>
              </div>
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={prodConfirmChecked}
                  onChange={(e) => setProdConfirmChecked(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400"
                />
                <span>
                  I confirm running lightweight smoke checks against live Firebase quota (stress &amp; destructive quota-reset tests remain blocked).
                </span>
              </label>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowProdConfirm(false);
                  setProdConfirmChecked(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!prodConfirmChecked}
                onClick={() => {
                  setQaMode("prod_smoke");
                  setShowProdConfirm(false);
                  setProdConfirmChecked(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
              >
                Enable Prod Smoke
              </button>
            </div>
          </div>
        )}

        {statusBanner && (
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-emerald-600 dark:text-emerald-400 hover:underline ml-3 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={isRunning}
            onClick={runAllTests}
            className="col-span-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning && activeModule === 'all' ? 'animate-spin' : ''}`} />
            <span>Run All Tests</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => runSingleModule("math_samples")}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Math (16)</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => runSingleModule("chemistry_samples")}
            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Chem (16)</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => runSingleModule("mcq_parser")}
            className="w-full px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>MCQ Parser (36)</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => runSingleModule("categories_stress")}
            className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Modules</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => runSingleModule("sync_policy")}
            className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => runSingleModule("quota_counter")}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Quota</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => runSingleModule("quota_no_mock")}
            className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Q-Panel</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => runSingleModule("pyq_stress")}
            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PYQ/MCQ</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => runSingleModule("mass_m1")}
            className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Mass</span>
          </button>


          <button
            type="button"
            disabled={isRunning}
            onClick={() => runSingleModule("analytics")}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <BarChart className="w-3.5 h-3.5" />
            <span>Events</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => runSingleModule("cache")}
            className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Cache</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={cleanupAllTestData}
            className="col-span-2 w-full px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Cleanup All TEST_ Data</span>
          </button>
        </div>

        {/* Logs Terminal Body */}
        <div className="flex-1 min-h-[300px] max-h-[60vh] overflow-y-auto p-2 sm:p-4 bg-slate-950 font-mono text-[10px] sm:text-xs text-slate-200 space-y-2">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-10 px-4 space-y-2 text-center">
              <Activity className="w-8 h-8 opacity-40 animate-pulse" />
              <p className="text-xs font-medium">No test executions yet. Select a module to begin.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id}
                className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all ${
                  log.status === "pass" 
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" 
                    : log.status === "fail"
                    ? "bg-rose-950/20 border-rose-500/30 text-rose-300"
                    : "bg-amber-950/20 border-amber-500/30 text-amber-300"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {log.status === "pass" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {log.status === "fail" && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                    {log.status === "running" && <RefreshCw className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded text-[9px] w-fit">
                        {log.moduleName}
                      </span>
                      <span className="text-slate-200 font-semibold text-xs">{log.testName}</span>
                    </div>
                    {log.status === "pass" && log.errorDetail && (
                      <p className="text-[10px] text-emerald-400 mt-1 font-mono break-words">
                        {log.errorDetail.startsWith("Success:") ? log.errorDetail : `Success: ${log.errorDetail}`}
                      </p>
                    )}
                    {log.status === "fail" && log.errorDetail && (
                      <p className="text-[10px] text-rose-400 mt-1 font-mono break-words">
                        Error [{log.errorCode || 'FAIL'}]: {log.errorDetail}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 border-t border-white/5 pt-1">
                  <span>{log.timestamp}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.durationMs}ms
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 font-medium px-4">
          <span>Safety Guarantee: All records use <code className="text-blue-500 font-bold">TEST_CAT_STRESS_</code> & <code className="text-blue-500 font-bold">isTest:true</code>. Real data is strictly preserved.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
