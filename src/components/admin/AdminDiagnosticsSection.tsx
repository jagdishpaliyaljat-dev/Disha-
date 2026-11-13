import * as React from "react";
import { 
  ShieldCheck, 
  Activity, 
  RefreshCw, 
  AlertTriangle, 
  Database, 
  CheckCircle2, 
  Search, 
  Download, 
  FileSearch, 
  FolderTree, 
  Layers, 
  HelpCircle,
  XCircle,
  FileText,
  AlertCircle,
  ShieldAlert,
  Server,
  ListFilter
} from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../../lib/firebase";
import { UserProfile, Subject, Chapter, Topic, Question } from "../../types";
import { isUserAdmin } from "../../utils/userProfileStorage";

interface AdminDiagnosticsSectionProps {
  userProfile?: UserProfile | null;
  subjects?: Subject[];
  chapters?: Chapter[];
}

export interface CollectionCounts {
  subjects: number;
  chapters: number;
  topics: number;
  mcqs: number;
  questions: number;
  totalPhysicalDocs: number;
  uniqueLogicalMcqs: number;
  dualWriteOverlapCount: number;
}

export interface MismatchItem {
  id: string;
  collectionName: "mcqs" | "questions" | "topics" | "chapters";
  type: "topic_title_mismatch" | "chapter_title_mismatch" | "invalid_parent_assignment";
  snippet?: string;
  expectedTitle: string;
  actualEmbeddedText: string;
  parentId: string;
}

export interface OrphanItem {
  id: string;
  collectionName: "mcqs" | "questions" | "topics" | "chapters";
  snippet?: string;
  missingParentType: "subject" | "chapter" | "topic";
  missingParentId?: string;
  reason: string;
}

export interface AnomalyItem {
  id: string;
  collectionName: "mcqs" | "questions";
  snippet: string;
  issue: "missing_text" | "insufficient_options" | "invalid_correct_index";
  details: string;
}

export interface FullDiagnosticScanResult {
  timestamp: string;
  counts: CollectionCounts;
  mismatches: MismatchItem[];
  orphans: OrphanItem[];
  anomalies: AnomalyItem[];
  scanDurationMs: number;
}

const CACHE_REPORT_KEY = "quizpro_admin_diagnostics_last_scan";

export const AdminDiagnosticsSection: React.FC<AdminDiagnosticsSectionProps> = ({
  userProfile,
  subjects: propSubjects = [],
  chapters: propChapters = []
}) => {
  const isAdmin = isUserAdmin(userProfile) || userProfile?.role === "admin";

  const [scanning, setScanning] = React.useState<boolean>(false);
  const [report, setReport] = React.useState<FullDiagnosticScanResult | null>(() => {
    if (typeof localStorage !== "undefined") {
      try {
        const cached = localStorage.getItem(CACHE_REPORT_KEY);
        if (cached) return JSON.parse(cached);
      } catch (_) {}
    }
    return null;
  });

  const [activeTab, setActiveTab] = React.useState<"summary" | "orphans" | "mismatches" | "anomalies">("summary");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const runReadOnlyScan = React.useCallback(async () => {
    if (!isFirebaseConfigured()) {
      setErrorMessage("Firebase is not configured in this environment.");
      return;
    }

    setScanning(true);
    setErrorMessage(null);
    const startTime = performance.now();

    try {
      // READ-ONLY execution of all 5 core collections
      const [subjectsSnap, chaptersSnap, topicsSnap, mcqsSnap, questionsSnap] = await Promise.all([
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "chapters")),
        getDocs(collection(db, "topics")),
        getDocs(collection(db, "mcqs")),
        getDocs(collection(db, "questions")),
      ]);

      const subjectsList = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const chaptersList = chaptersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const topicsList = topicsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const mcqsList = mcqsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const questionsList = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Lookups
      const subjectsMap = new Map<string, string>();
      subjectsList.forEach(s => {
        subjectsMap.set(s.id, (s as any).name || (s as any).title || (s as any).hindiName || "Untitled Subject");
      });

      const chaptersMap = new Map<string, { title: string; subjectId?: string }>();
      chaptersList.forEach(c => {
        chaptersMap.set(c.id, {
          title: (c as any).title || (c as any).name || (c as any).hindiTitle || "Untitled Chapter",
          subjectId: (c as any).subjectId,
        });
      });

      const topicsMap = new Map<string, { title: string; chapterId?: string; subjectId?: string }>();
      topicsList.forEach(t => {
        topicsMap.set(t.id, {
          title: (t as any).title || (t as any).name || (t as any).hindiTitle || "Untitled Topic",
          chapterId: (t as any).chapterId,
          subjectId: (t as any).subjectId,
        });
      });

      // Deduplication & Overlap Math
      const allUniqueQuestionsMap = new Map<string, any>();
      const dualWriteSet = new Set<string>();

      mcqsList.forEach(q => allUniqueQuestionsMap.set(q.id, { ...q, sourceColl: "mcqs" }));
      questionsList.forEach(q => {
        if (allUniqueQuestionsMap.has(q.id)) {
          dualWriteSet.add(q.id);
        } else {
          allUniqueQuestionsMap.set(q.id, { ...q, sourceColl: "questions" });
        }
      });

      const totalPhysicalDocs = mcqsList.length + questionsList.length;
      const uniqueLogicalMcqs = allUniqueQuestionsMap.size;
      const dualWriteOverlapCount = dualWriteSet.size;

      const orphans: OrphanItem[] = [];
      const mismatches: MismatchItem[] = [];
      const anomalies: AnomalyItem[] = [];

      // 1. Audit Chapters for Orphaned Subjects
      chaptersList.forEach(c => {
        const subId = (c as any).subjectId;
        if (subId && !subjectsMap.has(subId)) {
          orphans.push({
            id: c.id,
            collectionName: "chapters",
            snippet: (c as any).title || (c as any).name,
            missingParentType: "subject",
            missingParentId: subId,
            reason: `Chapter points to subjectId '${subId}' which does not exist in 'subjects' collection.`
          });
        }
      });

      // 2. Audit Topics for Orphaned Chapters
      topicsList.forEach(t => {
        const chId = (t as any).chapterId;
        if (chId && !chaptersMap.has(chId)) {
          orphans.push({
            id: t.id,
            collectionName: "topics",
            snippet: (t as any).title || (t as any).name,
            missingParentType: "chapter",
            missingParentId: chId,
            reason: `Topic points to chapterId '${chId}' which does not exist in 'chapters' collection.`
          });
        }
      });

      // 3. Audit Questions / MCQs
      allUniqueQuestionsMap.forEach((q, id) => {
        const qText = q.text || q.question || "";
        const snippet = typeof qText === "string" ? qText.slice(0, 80) : "No text";
        const coll = q.sourceColl as "mcqs" | "questions";

        // Quality Anomalies
        if (!qText || typeof qText !== "string" || qText.trim().length === 0) {
          anomalies.push({
            id,
            collectionName: coll,
            snippet: "[Empty Text]",
            issue: "missing_text",
            details: "Question text is empty or not a valid string."
          });
        }

        if (!Array.isArray(q.options) || q.options.length < 2) {
          anomalies.push({
            id,
            collectionName: coll,
            snippet,
            issue: "insufficient_options",
            details: `Options field is invalid or contains only ${Array.isArray(q.options) ? q.options.length : 0} choices.`
          });
        } else {
          const cIdx = q.correctIndex !== undefined ? q.correctIndex : q.correctAnswer;
          if (typeof cIdx === "number" && (cIdx < 0 || cIdx >= q.options.length)) {
            anomalies.push({
              id,
              collectionName: coll,
              snippet,
              issue: "invalid_correct_index",
              details: `correctIndex ${cIdx} is out of bounds for options length ${q.options.length}.`
            });
          }
        }

        // Parent Reference Verification (Orphans)
        if (q.topicId && !topicsMap.has(q.topicId)) {
          orphans.push({
            id,
            collectionName: coll,
            snippet,
            missingParentType: "topic",
            missingParentId: q.topicId,
            reason: `Question specifies topicId '${q.topicId}' which does not exist in 'topics' collection.`
          });
        }

        if (q.chapterId && !chaptersMap.has(q.chapterId)) {
          orphans.push({
            id,
            collectionName: coll,
            snippet,
            missingParentType: "chapter",
            missingParentId: q.chapterId,
            reason: `Question specifies chapterId '${q.chapterId}' which does not exist in 'chapters' collection.`
          });
        }

        if (q.subjectId && !subjectsMap.has(q.subjectId)) {
          orphans.push({
            id,
            collectionName: coll,
            snippet,
            missingParentType: "subject",
            missingParentId: q.subjectId,
            reason: `Question specifies subjectId '${q.subjectId}' which does not exist in 'subjects' collection.`
          });
        }

        // Title / Name Assignment Mismatches
        if (q.topicId && topicsMap.has(q.topicId)) {
          const parentTopic = topicsMap.get(q.topicId)!;
          if (q.topic && typeof q.topic === "string" && q.topic.trim().length > 0) {
            if (q.topic.trim() !== parentTopic.title.trim()) {
              mismatches.push({
                id,
                collectionName: coll,
                type: "topic_title_mismatch",
                snippet,
                expectedTitle: parentTopic.title,
                actualEmbeddedText: q.topic,
                parentId: q.topicId
              });
            }
          }
        }

        if (q.chapterId && chaptersMap.has(q.chapterId)) {
          const parentChapter = chaptersMap.get(q.chapterId)!;
          if (q.chapter && typeof q.chapter === "string" && q.chapter.trim().length > 0) {
            if (q.chapter.trim() !== parentChapter.title.trim()) {
              mismatches.push({
                id,
                collectionName: coll,
                type: "chapter_title_mismatch",
                snippet,
                expectedTitle: parentChapter.title,
                actualEmbeddedText: q.chapter,
                parentId: q.chapterId
              });
            }
          }
        }
      });

      const endTime = performance.now();
      const scanResult: FullDiagnosticScanResult = {
        timestamp: new Date().toLocaleString(),
        counts: {
          subjects: subjectsList.length,
          chapters: chaptersList.length,
          topics: topicsList.length,
          mcqs: mcqsList.length,
          questions: questionsList.length,
          totalPhysicalDocs,
          uniqueLogicalMcqs,
          dualWriteOverlapCount
        },
        mismatches,
        orphans,
        anomalies,
        scanDurationMs: Math.round(endTime - startTime)
      };

      setReport(scanResult);
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(CACHE_REPORT_KEY, JSON.stringify(scanResult));
        } catch (_) {}
      }
    } catch (err: any) {
      console.error("Error running read-only diagnostic scan:", err);
      setErrorMessage(err?.message || "Failed to execute read-only scan.");
    } finally {
      setScanning(false);
    }
  }, []);

  // Run automatically on first mount if no report is cached
  React.useEffect(() => {
    if (!report && isAdmin) {
      runReadOnlyScan();
    }
  }, [report, isAdmin, runReadOnlyScan]);

  const downloadReportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disha2020_read_only_diagnostic_report_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <div className="p-8 bg-rose-50 dark:bg-rose-950/20 rounded-3xl border border-rose-200 dark:border-rose-800 text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-black text-rose-900 dark:text-rose-200">Admin Access Required</h2>
        <p className="text-xs text-rose-700 dark:text-rose-300 font-medium max-w-md mx-auto">
          The Data Diagnostics Scanner is restricted to authenticated Administrators to ensure system governance and safety.
        </p>
      </div>
    );
  }

  // Search filtering
  const filteredOrphans = (report?.orphans || []).filter(item => 
    item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.snippet && item.snippet.toLowerCase().includes(searchQuery.toLowerCase())) ||
    item.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMismatches = (report?.mismatches || []).filter(item =>
    item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.snippet && item.snippet.toLowerCase().includes(searchQuery.toLowerCase())) ||
    item.expectedTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.actualEmbeddedText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAnomalies = (report?.anomalies || []).filter(item =>
    item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white dark:bg-[#111A2E] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Firestore Read-Only Diagnostics</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                100% Read-Only Safety
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Live collection scan for document counts, topic mismatches, and orphan references without writing data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {report && (
            <button
              onClick={downloadReportJson}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export JSON</span>
            </button>
          )}

          <button
            onClick={runReadOnlyScan}
            disabled={scanning}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
            <span>{scanning ? "Scanning Collections..." : "Run Read-Only Scan"}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Metric Cards */}
      {report ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Subjects</span>
            <div className="text-xl font-black text-slate-900 dark:text-white">{report.counts.subjects}</div>
            <span className="text-[10px] font-bold text-slate-500">Firestore Docs</span>
          </div>

          <div className="p-4 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Chapters</span>
            <div className="text-xl font-black text-slate-900 dark:text-white">{report.counts.chapters}</div>
            <span className="text-[10px] font-bold text-slate-500">Firestore Docs</span>
          </div>

          <div className="p-4 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Topics</span>
            <div className="text-xl font-black text-slate-900 dark:text-white">{report.counts.topics}</div>
            <span className="text-[10px] font-bold text-slate-500">Firestore Docs</span>
          </div>

          <div className="p-4 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">`mcqs` Coll</span>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{report.counts.mcqs}</div>
            <span className="text-[10px] font-bold text-slate-500">Primary Store</span>
          </div>

          <div className="p-4 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">`questions` Coll</span>
            <div className="text-xl font-black text-purple-600 dark:text-purple-400">{report.counts.questions}</div>
            <span className="text-[10px] font-bold text-slate-500">Secondary Store</span>
          </div>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/80 dark:border-emerald-800 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Dashboard MCQs</span>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">{report.counts.uniqueLogicalMcqs}</div>
            <span className="text-[10px] font-bold text-emerald-600/80">Unique Logical</span>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Executing read-only scan across all 5 Firestore collections...</p>
        </div>
      )}

      {/* Sub-tab Navigation */}
      {report && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: "summary", label: "Overview & Physical Math", count: null, icon: Database },
                { id: "orphans", label: "Orphaned References", count: report.orphans.length, icon: AlertTriangle, color: "text-amber-500" },
                { id: "mismatches", label: "Topic Title Mismatches", count: report.mismatches.length, icon: FolderTree, color: "text-blue-500" },
                { id: "anomalies", label: "Quality Anomalies", count: report.anomalies.length, icon: XCircle, color: "text-rose-500" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <tab.icon className={`w-3.5 h-3.5 ${tab.color || ""}`} />
                  <span>{tab.label}</span>
                  {tab.count !== null && tab.count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search Input for Lists */}
            {activeTab !== "summary" && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter diagnostic items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* VIEW TAB 1: SUMMARY & RECONCILIATION MATH */}
          {activeTab === "summary" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-[#111A2E] p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-indigo-500" />
                    <span>Physical vs. Logical Storage Math</span>
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">Scan duration: {report.scanDurationMs}ms</span>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-500">`mcqs` Collection Documents</span>
                    <span className="font-bold text-slate-900 dark:text-white">{report.counts.mcqs}</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-500">`questions` Collection Documents</span>
                    <span className="font-bold text-slate-900 dark:text-white">{report.counts.questions}</span>
                  </div>

                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-200">Combined Physical Documents</span>
                    <span className="text-slate-900 dark:text-white">{report.counts.totalPhysicalDocs}</span>
                  </div>

                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl flex items-center justify-between text-xs font-bold border border-indigo-100 dark:border-indigo-900/50">
                    <span className="text-indigo-900 dark:text-indigo-200">Dual-Write Overlapping IDs</span>
                    <span className="text-indigo-600 dark:text-indigo-400">-{report.counts.dualWriteOverlapCount}</span>
                  </div>

                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-between text-xs font-black border border-emerald-200 dark:border-emerald-800">
                    <span className="text-emerald-900 dark:text-emerald-200">Admin Dashboard Unique MCQs</span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm">{report.counts.uniqueLogicalMcqs}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#111A2E] p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Data Integrity Summary Status</span>
                </h3>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Orphaned Parent References</div>
                      <div className="text-[11px] text-slate-500">Documents missing valid subject, chapter, or topic parent IDs</div>
                    </div>
                    {report.orphans.length === 0 ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase">0 Orphans</span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase">{report.orphans.length} Detected</span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Topic / Chapter String Mismatches</div>
                      <div className="text-[11px] text-slate-500">Embedded title string differs from parent entity's true title</div>
                    </div>
                    {report.mismatches.length === 0 ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase">0 Mismatches</span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-black uppercase">{report.mismatches.length} Detected</span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Content Quality Anomalies</div>
                      <div className="text-[11px] text-slate-500">Blank text, options array mismatch, or invalid correct option index</div>
                    </div>
                    {report.anomalies.length === 0 ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase">0 Issues</span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-black uppercase">{report.anomalies.length} Detected</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 text-right">
                  <span className="text-[10px] font-bold text-slate-400">Last scan performed: {report.timestamp}</span>
                </div>
              </div>
            </div>
          )}

          {/* VIEW TAB 2: ORPHANED DOCUMENTS */}
          {activeTab === "orphans" && (
            <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Orphaned Documents ({filteredOrphans.length})</h3>
                  <p className="text-xs text-slate-500">Documents whose parent IDs do not match any existing record in Firestore.</p>
                </div>
              </div>

              {filteredOrphans.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No orphaned documents found!</p>
                  <p className="text-[11px] text-slate-500">All questions, topics, and chapters properly reference existing parents.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                  {filteredOrphans.map((item, idx) => (
                    <div key={`${item.id}-${item.missingParentType}-${item.missingParentId || idx}-${idx}`} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{item.id}</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold text-[10px] uppercase">
                          Missing {item.missingParentType}: {item.missingParentId || "None"}
                        </span>
                      </div>
                      {item.snippet && <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{item.snippet}</p>}
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">{item.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW TAB 3: TOPIC / CHAPTER MISMATCHES */}
          {activeTab === "mismatches" && (
            <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Topic / Chapter Title Mismatches ({filteredMismatches.length})</h3>
                  <p className="text-xs text-slate-500">Questions where embedded string text contradicts parent entity's title.</p>
                </div>
              </div>

              {filteredMismatches.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Zero title mismatches detected!</p>
                  <p className="text-[11px] text-slate-500">Embedded topic and chapter strings align perfectly with parent records.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                  {filteredMismatches.map((item, idx) => (
                    <div key={`${item.id}-${item.type}-${idx}`} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{item.id}</span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-bold text-[10px] uppercase">
                          {item.type}
                        </span>
                      </div>
                      {item.snippet && <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{item.snippet}</p>}
                      <div className="grid grid-cols-2 gap-3 text-[11px] bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl">
                        <div>
                          <span className="text-slate-400 block font-bold">Parent True Title:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{item.expectedTitle}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-bold">Embedded Question Text:</span>
                          <span className="text-rose-600 dark:text-rose-400 font-bold">{item.actualEmbeddedText}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW TAB 4: QUALITY ANOMALIES */}
          {activeTab === "anomalies" && (
            <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Content Quality Anomalies ({filteredAnomalies.length})</h3>
                  <p className="text-xs text-slate-500 font-medium">MCQs with blank question text, option count issues, or bad correct option indices.</p>
                </div>
              </div>

              {filteredAnomalies.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">All questions pass quality standards!</p>
                  <p className="text-[11px] text-slate-500">All MCQs have valid text, 4 options, and correct answer indices.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                  {filteredAnomalies.map((item, idx) => (
                    <div key={`${item.id}-${item.issue}-${idx}`} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{item.id}</span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 font-bold text-[10px] uppercase">
                          {item.issue}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{item.snippet}</p>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">{item.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDiagnosticsSection;
