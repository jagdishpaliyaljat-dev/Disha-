import * as React from "react";
import { 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  FileText, 
  Layers, 
  Search, 
  Wrench, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle,
  Sparkles,
  ListFilter,
  Check,
  ShieldCheck,
  Download,
  CheckCheck,
  XCircle,
  AlertCircle,
  Lock,
  Unlock,
  Archive,
  History
} from "lucide-react";
import { AdminCard } from "./AdminCard";
import { collection, doc, query, limit } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../../lib/firebase";
import { guardedGetDocs, guardedSetDoc } from "../../utils/quotaTracker";
import { loadUserQuestionsStore, getCombinedChapters, getCombinedQuestions, saveUserQuestionsStore } from "../../utils/questionsStorage";
import { scanMcqCollectionDuplicates, McqScanResult, DuplicateGroup } from "../../utils/scanMcqDuplicates";
import { runMappingConsistencyDiagnostic, repairMappingConsistency, MappingConsistencyReport } from "../../utils/mappingConsistencyDiagnostic";
import { 
  runGlobalDataIntegrityAudit, 
  GlobalDataIntegrityReport, 
  InFlightOperation, 
  getInterruptedOperation, 
  recoverInterruptedOperation, 
  exportSafetyBackup, 
  executeAdminApprovedCleanup,
  LAST_AUDIT_REPORT_KEY 
} from "../../utils/permanentDataIntegrity";
import { Question, Subject, Chapter, Topic } from "../../types";

export interface CollectionCountItem {
  name: string;
  count: number | null;
  status: "active" | "empty" | "error" | "loading";
  error?: string;
}

export interface OrphanedQuestionItem {
  id: string;
  text: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  topicTitle?: string;
  missingTypes: ("subject" | "chapter" | "topic")[];
  source: string;
}

export const DataIntegrityDiagnosticDashboard: React.FC<{
  subjects?: Subject[];
  chapters?: Chapter[];
}> = ({ subjects = [], chapters = [] }) => {
  // Navigation
  const [activeViewTab, setActiveViewTab] = React.useState<"audit" | "counts" | "consistency" | "orphans" | "duplicates">("audit");

  // Global Integrity Audit state
  const [globalReport, setGlobalReport] = React.useState<GlobalDataIntegrityReport | null>(null);
  const [runningGlobalAudit, setRunningGlobalAudit] = React.useState(false);
  const [interruptedOp, setInterruptedOp] = React.useState<InFlightOperation | null>(null);
  const [recoveringOp, setRecoveringOp] = React.useState(false);
  const [recoveryMessage, setRecoveryMessage] = React.useState<string | null>(null);
  const [topicSearchQuery, setTopicSearchQuery] = React.useState("");

  // Admin Cleanup Modal
  const [showCleanupModal, setShowCleanupModal] = React.useState(false);
  const [isCleaningUp, setIsCleaningUp] = React.useState(false);
  const [cleanupResultMsg, setCleanupResultMsg] = React.useState<string | null>(null);
  const [adminConfirmText, setAdminConfirmText] = React.useState("");
  const [selectedCleanupIds, setSelectedCleanupIds] = React.useState<Set<string>>(new Set());

  // Existing states
  const [loadingCounts, setLoadingCounts] = React.useState(false);
  const [counts, setCounts] = React.useState<Record<string, CollectionCountItem>>({});
  
  const [scanResult, setScanResult] = React.useState<McqScanResult | null>(null);
  const [scanning, setScanning] = React.useState(false);

  const [consistencyReport, setConsistencyReport] = React.useState<MappingConsistencyReport | null>(null);
  const [runningConsistency, setRunningConsistency] = React.useState(false);

  const [orphans, setOrphans] = React.useState<OrphanedQuestionItem[]>([]);
  const [repairingId, setRepairingId] = React.useState<string | null>(null);
  const [repairMessage, setRepairMessage] = React.useState<string | null>(null);

  const [expandedDuplicateIdx, setExpandedDuplicateIdx] = React.useState<number | null>(null);

  // Initialize and run read-only global audit on mount
  React.useEffect(() => {
    // Check cached report first
    try {
      const cached = localStorage.getItem(LAST_AUDIT_REPORT_KEY);
      if (cached) {
        setGlobalReport(JSON.parse(cached));
      }
    } catch {}

    // Check interrupted operations
    const interrupted = getInterruptedOperation();
    if (interrupted) {
      setInterruptedOp(interrupted);
    }

    // Run fresh read-only audit
    handleRunGlobalAudit();
  }, []);

  const handleRunGlobalAudit = async () => {
    setRunningGlobalAudit(true);
    try {
      const rep = await runGlobalDataIntegrityAudit();
      setGlobalReport(rep);
      // Auto populate cleanup candidate IDs from stale move copies
      const staleDocIds: string[] = [];
      rep.duplicateGroups.forEach(grp => {
        if (grp.isStaleMoveCopy) {
          // Add secondary copies (older copies)
          const sorted = [...grp.items].sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          });
          // All except newest are candidates for removal
          sorted.slice(1).forEach(it => staleDocIds.push(it.docId));
        }
      });
      setSelectedCleanupIds(new Set(staleDocIds));
    } catch (err) {
      console.error("Global audit error:", err);
    } finally {
      setRunningGlobalAudit(false);
    }
  };

  const handleRecoverOperation = async () => {
    setRecoveringOp(true);
    try {
      const res = await recoverInterruptedOperation();
      setRecoveryMessage(res.message);
      setInterruptedOp(null);
      handleRunGlobalAudit();
    } catch (err: any) {
      setRecoveryMessage(`Recovery failed: ${err?.message || err}`);
    } finally {
      setRecoveringOp(false);
    }
  };

  const handleExportBackup = () => {
    const res = exportSafetyBackup();
    if (res.success) {
      setRecoveryMessage(`Recoverable backup downloaded: ${res.filename} (${res.count} questions).`);
    } else {
      setRecoveryMessage("Failed to export backup.");
    }
  };

  const handleExecuteCleanup = async () => {
    if (adminConfirmText.trim().toLowerCase() !== "confirm cleanup") {
      alert('Please type "CONFIRM CLEANUP" to authorize this operation.');
      return;
    }
    setIsCleaningUp(true);
    setCleanupResultMsg(null);
    try {
      const ids = Array.from(selectedCleanupIds);
      const res = await executeAdminApprovedCleanup(ids, true);
      setCleanupResultMsg(res.message);
      setShowCleanupModal(false);
      setAdminConfirmText("");
      handleRunGlobalAudit();
    } catch (err: any) {
      setCleanupResultMsg(`Cleanup error: ${err?.message || err}`);
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Fetch Firestore collection document counts
  const fetchCollectionCounts = async () => {
    setLoadingCounts(true);
    const targetCollections = [
      "mcqs",
      "questions",
      "subjects",
      "chapters",
      "topics",
      "users",
      "attempts",
      "pyq_papers",
      "liveTests",
      "banners",
    ];

    const results: Record<string, CollectionCountItem> = {};

    if (!isFirebaseConfigured()) {
      targetCollections.forEach((c) => {
        results[c] = { name: c, count: null, status: "error", error: "Firebase not configured" };
      });
      setCounts(results);
      setLoadingCounts(false);
      return;
    }

    try {
      await Promise.all(
        targetCollections.map(async (collName) => {
          try {
            const collRef = collection(db, collName);
            const q = query(collRef, limit(2000));
            const snap = await guardedGetDocs(q, "Admin", `Integrity Count ${collName}`, undefined, 8000, true);
            const count = snap.docs.length;
            results[collName] = {
              name: collName,
              count,
              status: count > 0 ? "active" : "empty",
            };
          } catch (e: any) {
            results[collName] = {
              name: collName,
              count: null,
              status: "error",
              error: e?.message || "Fetch failed",
            };
          }
        })
      );
    } catch (err) {
      console.warn("Error fetching collection counts:", err);
    } finally {
      setCounts(results);
      setLoadingCounts(false);
    }
  };

  // Run duplicate text scanner
  const runDuplicateScan = async () => {
    setScanning(true);
    try {
      const res = await scanMcqCollectionDuplicates("mcqs", 2000);
      setScanResult(res);
    } catch (err) {
      console.error("Duplicate scan error:", err);
    } finally {
      setScanning(false);
    }
  };

  // Detect orphaned questions
  const detectOrphanedQuestions = () => {
    try {
      const store = loadUserQuestionsStore();
      const allQs = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])];

      const validSubjectIds = new Set((subjects || []).map((s) => s.id.toLowerCase()));
      const validChapterIds = new Set((chapters || []).map((c) => c.id.toLowerCase()));
      const validTopicIds = new Set(
        (chapters || []).flatMap((c) => (c.topics || []).map((t) => t.id.toLowerCase()))
      );

      const foundOrphans: OrphanedQuestionItem[] = [];

      allQs.forEach((q: any) => {
        if (!q || (!q.text && !q.question)) return;
        const missing: ("subject" | "chapter" | "topic")[] = [];

        const subIdNorm = (q.subjectId || "").toLowerCase();
        const chapIdNorm = (q.chapterId || "").toLowerCase();
        const topIdNorm = (q.topicId || "").toLowerCase();

        if (!q.subjectId || (validSubjectIds.size > 0 && !validSubjectIds.has(subIdNorm))) {
          missing.push("subject");
        }
        if (!q.chapterId || (validChapterIds.size > 0 && !validChapterIds.has(chapIdNorm))) {
          missing.push("chapter");
        }
        if (!q.topicId || (validTopicIds.size > 0 && !validTopicIds.has(topIdNorm))) {
          missing.push("topic");
        }

        if (missing.length > 0) {
          foundOrphans.push({
            id: q.id || `doc_${Math.random().toString(36).substr(2, 6)}`,
            text: q.text || q.question || "Untitled Question",
            subjectId: q.subjectId,
            chapterId: q.chapterId,
            topicId: q.topicId,
            topicTitle: q.topicTitle || q.topicName || q.topic,
            missingTypes: missing,
            source: q.isUserAdded ? "Local Custom" : "Firestore Sync",
          });
        }
      });

      setOrphans(foundOrphans);
    } catch (e) {
      console.warn("Error detecting orphans:", e);
    }
  };

  // Run mapping consistency diagnostic (Firestore vs App State)
  const executeConsistencyCheck = async () => {
    setRunningConsistency(true);
    try {
      const rep = await runMappingConsistencyDiagnostic();
      setConsistencyReport(rep);
    } catch (err) {
      console.warn("Consistency check error:", err);
    } finally {
      setRunningConsistency(false);
    }
  };

  // Filtered topics for topic-wise audit table
  const filteredTopicCounts = React.useMemo(() => {
    if (!globalReport?.topicCounts) return [];
    if (!topicSearchQuery.trim()) return globalReport.topicCounts;
    const q = topicSearchQuery.toLowerCase().trim();
    return globalReport.topicCounts.filter(
      (t) =>
        t.topicTitle.toLowerCase().includes(q) ||
        t.chapterTitle.toLowerCase().includes(q) ||
        t.subjectName.toLowerCase().includes(q) ||
        t.topicId.toLowerCase().includes(q)
    );
  }, [globalReport?.topicCounts, topicSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Interrupted Bulk Operation Recovery Banner */}
      {interruptedOp && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase tracking-wide">
                Interrupted {interruptedOp.type.toUpperCase()} Operation Detected
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                Operation started at {new Date(interruptedOp.startedAt).toLocaleTimeString()} ({interruptedOp.completedIds.length}/{interruptedOp.questionIds.length} items processed). You can safely reconcile the state without duplicating questions.
              </p>
            </div>
          </div>
          <button
            onClick={handleRecoverOperation}
            disabled={recoveringOp}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recoveringOp ? "animate-spin" : ""}`} />
            <span>{recoveringOp ? "Reconciling..." : "Safe Reconcile"}</span>
          </button>
        </div>
      )}

      {recoveryMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <span>{recoveryMessage}</span>
          <button onClick={() => setRecoveryMessage(null)} className="text-emerald-600 font-black cursor-pointer">×</button>
        </div>
      )}

      {cleanupResultMsg && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-800 dark:text-blue-200 flex items-center justify-between">
          <span>{cleanupResultMsg}</span>
          <button onClick={() => setCleanupResultMsg(null)} className="text-blue-600 font-black cursor-pointer">×</button>
        </div>
      )}

      {/* Main Container Card */}
      <AdminCard
        title="Permanent Data Integrity Protection & Global Audit"
        subtitle="Authoritative audit of all database records, topic-wise counts, parent-child synchronization, duplicate prevention, and recoverable backups."
        icon={ShieldCheck}
        headerAction={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBackup}
              title="Download full JSON backup of all questions and curriculum"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Backup</span>
            </button>
            <button
              onClick={() => {
                handleRunGlobalAudit();
                fetchCollectionCounts();
                runDuplicateScan();
                detectOrphanedQuestions();
                executeConsistencyCheck();
              }}
              disabled={runningGlobalAudit || loadingCounts}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${runningGlobalAudit ? "animate-spin" : ""}`} />
              <span>{runningGlobalAudit ? "Auditing..." : "Run Global Audit"}</span>
            </button>
          </div>
        }
      >
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
          <button
            onClick={() => setActiveViewTab("audit")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeViewTab === "audit"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Global Integrity Report</span>
          </button>

          <button
            onClick={() => setActiveViewTab("counts")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeViewTab === "counts"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Collection Counts</span>
          </button>

          <button
            onClick={() => setActiveViewTab("consistency")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeViewTab === "consistency"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mapping Consistency</span>
          </button>

          <button
            onClick={() => setActiveViewTab("orphans")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeViewTab === "orphans"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Orphaned Records ({globalReport?.orphanedRecordsCount || orphans.length})</span>
          </button>

          <button
            onClick={() => setActiveViewTab("duplicates")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeViewTab === "duplicates"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Duplicates ({globalReport?.totalDuplicateRecords || 0})</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: GLOBAL INTEGRITY AUDIT (PRIMARY)                                  */}
        {/* ========================================================================= */}
        {activeViewTab === "audit" && (
          <div className="space-y-6 pt-3">
            {/* Top Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60">
                <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                  Total DB Records
                </span>
                <span className="text-xl font-black text-blue-950 dark:text-white mt-1 block">
                  {globalReport ? globalReport.totalDatabaseRecords : "..."}
                </span>
                <span className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold block mt-0.5">
                  Firestore mcqs & questions
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60">
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                  Unique Questions
                </span>
                <span className="text-xl font-black text-emerald-950 dark:text-white mt-1 block">
                  {globalReport ? globalReport.totalUniqueQuestions : "..."}
                </span>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                  Distinct content signatures
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/60">
                <span className="text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider block">
                  Duplicate Records
                </span>
                <span className="text-xl font-black text-purple-950 dark:text-white mt-1 block">
                  {globalReport ? globalReport.totalDuplicateRecords : "..."}
                </span>
                <span className="text-[9px] text-purple-600 dark:text-purple-400 font-semibold block mt-0.5">
                  {globalReport?.staleMoveDuplicateCount || 0} move + {globalReport?.contentDuplicateCount || 0} content
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60">
                <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                  Orphaned Records
                </span>
                <span className="text-xl font-black text-amber-950 dark:text-white mt-1 block">
                  {globalReport ? globalReport.orphanedRecordsCount : "..."}
                </span>
                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold block mt-0.5">
                  Missing parent hierarchy
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900/60">
                <span className="text-[10px] font-black text-teal-700 dark:text-teal-300 uppercase tracking-wider block">
                  Parent-Child Sync
                </span>
                <span className="text-xl font-black text-teal-950 dark:text-white mt-1 block">
                  {globalReport?.parentChildMismatchCount === 0 ? "100%" : `${globalReport?.parentChildMismatchCount} diff`}
                </span>
                <span className="text-[9px] text-teal-600 dark:text-teal-400 font-semibold block mt-0.5">
                  Parent = Child = Select All
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  Last Audit Time
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1.5 block truncate">
                  {globalReport?.auditTimestamp ? new Date(globalReport.auditTimestamp).toLocaleTimeString() : "Never"}
                </span>
                <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                  Strict Read-Only
                </span>
              </div>
            </div>

            {/* Health Status Callout */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-3 ${
              globalReport?.isHealthy 
                ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60"
                : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60"
            }`}>
              <div className="flex items-center gap-3">
                {globalReport?.isHealthy ? (
                  <CheckCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {globalReport?.isHealthy ? "Global Data Integrity Healthy" : "Integrity Attention Required"}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                    {globalReport?.summaryMessage || "Audit loaded."}
                  </p>
                </div>
              </div>

              {globalReport && globalReport.totalDuplicateRecords > 0 && (
                <button
                  onClick={() => setShowCleanupModal(true)}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Review & Clean Duplicate Records</span>
                </button>
              )}
            </div>

            {/* Topic-Wise Reconciled Question Counts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Topic-Wise Reconciled Counts ({filteredTopicCounts.length} topics)
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Strict comparison between Parent View count, Child View questions, and Select All count.
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={topicSearchQuery}
                    onChange={(e) => setTopicSearchQuery(e.target.value)}
                    placeholder="Filter by subject, chapter or topic..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Subject / Chapter</th>
                      <th className="py-2.5 px-3">Topic</th>
                      <th className="py-2.5 px-3 text-center">Parent Count</th>
                      <th className="py-2.5 px-3 text-center">Child Count</th>
                      <th className="py-2.5 px-3 text-center">Select All</th>
                      <th className="py-2.5 px-3 text-center">Custom</th>
                      <th className="py-2.5 px-3 text-right">Sync Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                    {filteredTopicCounts.map((t) => (
                      <tr
                        key={t.topicId}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${
                          !t.isSynchronized ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[180px]">
                            {t.subjectName}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                            {t.chapterTitle}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="font-black text-slate-900 dark:text-white block">
                            {t.topicTitle}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono block">
                            ID: {t.topicId}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                          {t.parentCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                          {t.childCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                          {t.selectCount}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500">
                          {t.customCount}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {t.isSynchronized ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg">
                              <Check className="w-3 h-3" />
                              <span>100% Synced</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Diff: {t.diff}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredTopicCounts.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                          No topics matched search filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Existing Tab Views (Collection Counts, Mapping Consistency, Orphans, Duplicates) */}
        {activeViewTab === "counts" && (
          <div className="space-y-4 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Firestore Collections Document Count
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Direct live snapshot of Firestore database collections.
                </p>
              </div>
              <button
                onClick={fetchCollectionCounts}
                disabled={loadingCounts}
                className="flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-bold"
              >
                <RefreshCw className={`w-3 h-3 ${loadingCounts ? "animate-spin" : ""}`} />
                <span>Refresh Counts</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(counts).map(([name, item]) => (
                <div
                  key={name}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {name}
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white mt-1 block">
                    {item.count !== null ? item.count : "..."}
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium block">
                    {item.status === "active" ? "✓ Active Collection" : item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeViewTab === "consistency" && (
          <div className="space-y-4 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Firestore vs Application State Consistency
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Compares Firestore documents with active merged curriculum state.
                </p>
              </div>
              <button
                onClick={executeConsistencyCheck}
                disabled={runningConsistency}
                className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold"
              >
                <RefreshCw className={`w-3 h-3 ${runningConsistency ? "animate-spin" : ""}`} />
                <span>Check Consistency</span>
              </button>
            </div>

            {consistencyReport && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {consistencyReport.summaryMessage}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeViewTab === "orphans" && (
          <div className="space-y-4 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Orphaned & Unmapped Questions ({globalReport?.orphanedRecordsCount || orphans.length})
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Questions missing a registered topicId or chapterId.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {(globalReport?.orphanedRecords || []).map((orp, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {orp.text}
                    </span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium block">
                      Doc ID: {orp.id} | Reason: {orp.reason}
                    </span>
                  </div>
                </div>
              ))}
              {(globalReport?.orphanedRecords || []).length === 0 && (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-black text-slate-900 dark:text-white mt-1">
                    Zero Orphaned Questions Detected
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    100% of questions belong to valid subjects, chapters, and topics.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeViewTab === "duplicates" && (
          <div className="space-y-4 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Duplicate Content & Stale Move Audit ({globalReport?.duplicateGroups.length || 0} groups)
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Exact normalized text & options comparison across all questions.
                </p>
              </div>
              {globalReport && globalReport.totalDuplicateRecords > 0 && (
                <button
                  onClick={() => setShowCleanupModal(true)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Clean Stale Duplicates
                </button>
              )}
            </div>

            <div className="space-y-2">
              {(globalReport?.duplicateGroups || []).map((grp, gIdx) => (
                <div
                  key={gIdx}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white block max-w-xl truncate">
                      {grp.previewText}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                      grp.isStaleMoveCopy 
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    }`}>
                      {grp.isStaleMoveCopy ? "Stale Move Copy" : "Content Duplicate"} ({grp.count} docs)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                    {grp.items.map((it, itIdx) => (
                      <div key={itIdx} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">
                          ID: {it.docId}
                        </span>
                        <span>Topic: {it.topicId}</span>
                        {it.updatedAt && <span className="block text-[9px] text-slate-400">Updated: {new Date(it.updatedAt).toLocaleTimeString()}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(globalReport?.duplicateGroups || []).length === 0 && (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-black text-slate-900 dark:text-white mt-1">
                    Zero Duplicate Groups Detected
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    All question records have unique content signatures.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </AdminCard>

      {/* Admin Cleanup Confirmation Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Admin Authorization Required: Clean Stale Duplicates
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Strict Protection: An automatic downloadable backup will be generated first.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold">Safety Guarantee:</p>
              <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                <li>Selected records: {selectedCleanupIds.size} stale move duplicate copies.</li>
                <li>Canonical destination records in target topics are strictly preserved.</li>
                <li>Questions are NEVER deleted based solely on matching text.</li>
              </ul>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                Type "CONFIRM CLEANUP" to authorize:
              </label>
              <input
                type="text"
                value={adminConfirmText}
                onChange={(e) => setAdminConfirmText(e.target.value)}
                placeholder="CONFIRM CLEANUP"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowCleanupModal(false);
                  setAdminConfirmText("");
                }}
                disabled={isCleaningUp}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteCleanup}
                disabled={isCleaningUp || adminConfirmText.trim().toLowerCase() !== "confirm cleanup"}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-xs"
              >
                {isCleaningUp ? "Cleaning..." : "Authorize Safe Cleanup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
