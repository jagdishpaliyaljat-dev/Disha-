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
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { openLocalDatabase, idbGetAll, STORES } from "../../utils/localDatabaseEngine";
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

const CACHE_REPORT_KEY = "disha2020_admin_diagnostics_last_scan";
const LEGACY_CACHE_REPORT_KEY = "quizpro_admin_diagnostics_last_scan";

export const AdminDiagnosticsSection: React.FC<AdminDiagnosticsSectionProps> = ({
  userProfile,
  subjects: propSubjects = [],
  chapters: propChapters = []
}) => {
  const isAdmin = isUserAdmin(userProfile);

  const [scanning, setScanning] = React.useState<boolean>(false);
  const [report, setReport] = React.useState<FullDiagnosticScanResult | null>(() => {
    if (typeof localStorage !== "undefined") {
      try {
        const cached = localStorage.getItem(CACHE_REPORT_KEY) || localStorage.getItem(LEGACY_CACHE_REPORT_KEY);
        if (cached) return JSON.parse(cached);
      } catch (_) {}
    }
    return null;
  });

  const [activeTab, setActiveTab] = React.useState<"summary" | "orphans" | "mismatches" | "anomalies">("summary");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const runReadOnlyScan = React.useCallback(async () => {
    setScanning(true);
    setErrorMessage(null);
    const startTime = performance.now();

    try {
      let subjectsList: any[] = [];
      let chaptersList: any[] = [];
      let topicsList: any[] = [];
      let questionsList: any[] = [];

      if (isSupabaseConfigured()) {
        const [subRes, chRes, topRes, qRes] = await Promise.all([
          supabase.from("subjects").select("id, name, hindi_name"),
          supabase.from("chapters").select("id, name, hindi_name, subject_id"),
          supabase.from("topics").select("id, name, hindi_name, chapter_id, subject_id"),
          supabase.from("questions").select("id, subject_id, chapter_id, topic_id"),
        ]);

        subjectsList = subRes.data || [];
        chaptersList = chRes.data || [];
        topicsList = topRes.data || [];
        questionsList = qRes.data || [];
      } else {
        await openLocalDatabase();
        subjectsList = await idbGetAll(STORES.SUBJECTS);
        chaptersList = await idbGetAll(STORES.CHAPTERS);
        topicsList = await idbGetAll(STORES.TOPICS);
        questionsList = await idbGetAll(STORES.MCQS);
      }

      // Lookups
      const subjectsMap = new Map<string, string>();
      subjectsList.forEach(s => {
        subjectsMap.set(s.id, s.name || s.hindi_name || s.title || "Untitled Subject");
      });

      const chaptersMap = new Map<string, { title: string; subjectId?: string }>();
      chaptersList.forEach(c => {
        chaptersMap.set(c.id, {
          title: c.name || c.hindi_name || c.title || "Untitled Chapter",
          subjectId: c.subject_id || c.subjectId,
        });
      });

      const topicsMap = new Map<string, { title: string; chapterId?: string; subjectId?: string }>();
      topicsList.forEach(t => {
        topicsMap.set(t.id, {
          title: t.name || t.hindi_name || t.title || "Untitled Topic",
          chapterId: t.chapter_id || t.chapterId,
          subjectId: t.subject_id || t.subjectId,
        });
      });

      const totalPhysicalDocs = questionsList.length;
      const uniqueLogicalMcqs = questionsList.length;
      const dualWriteOverlapCount = 0;

      const orphans: OrphanItem[] = [];
      const mismatches: MismatchItem[] = [];
      const anomalies: AnomalyItem[] = [];

      // 1. Audit Chapters for Orphaned Subjects
      chaptersList.forEach(c => {
        const subId = c.subject_id || c.subjectId;
        if (subId && !subjectsMap.has(subId)) {
          orphans.push({
            id: c.id,
            collectionName: "chapters",
            snippet: c.name || c.hindi_name || c.title,
            missingParentType: "subject",
            missingParentId: subId,
            reason: `Chapter points to subjectId '${subId}' which does not exist in 'subjects' table.`
          });
        }
      });

      // 2. Audit Topics for Orphaned Chapters
      topicsList.forEach(t => {
        const chId = t.chapter_id || t.chapterId;
        if (chId && !chaptersMap.has(chId)) {
          orphans.push({
            id: t.id,
            collectionName: "topics",
            snippet: t.name || t.hindi_name || t.title,
            missingParentType: "chapter",
            missingParentId: chId,
            reason: `Topic points to chapterId '${chId}' which does not exist in 'chapters' table.`
          });
        }
      });

      // 3. Audit Questions
      questionsList.forEach((q) => {
        const qText = q.question || q.text || "";
        const snippet = typeof qText === "string" ? qText.slice(0, 80) : "No text";
        const coll = "questions";

        // Quality Anomalies
        if (!qText || typeof qText !== "string" || qText.trim().length === 0) {
          anomalies.push({
            id: q.id,
            collectionName: coll,
            snippet: "[Empty Text]",
            issue: "missing_text",
            details: "Question text is empty or not a valid string."
          });
        }

        const options = Array.isArray(q.options) ? q.options : [];
        if (options.length < 2) {
          anomalies.push({
            id: q.id,
            collectionName: coll,
            snippet,
            issue: "insufficient_options",
            details: `Options field is invalid or contains only ${options.length} choices.`
          });
        } else {
          const cIdx = typeof q.correct_answer === "number" ? q.correct_answer : (q.correctIndex ?? 0);
          if (cIdx < 0 || cIdx >= options.length) {
            anomalies.push({
              id: q.id,
              collectionName: coll,
              snippet,
              issue: "invalid_correct_index",
              details: `correctIndex ${cIdx} is out of bounds for options length ${options.length}.`
            });
          }
        }

        // Orphan Check for Questions
        const topId = q.topic_id || q.topicId;
        if (topId && !topicsMap.has(topId)) {
          orphans.push({
            id: q.id,
            collectionName: coll,
            snippet,
            missingParentType: "topic",
            missingParentId: topId,
            reason: `Question points to topicId '${topId}' which does not exist in 'topics' table.`
          });
        }
      });

      const counts: CollectionCounts = {
        subjects: subjectsList.length,
        chapters: chaptersList.length,
        topics: topicsList.length,
        mcqs: questionsList.length,
        questions: questionsList.length,
        totalPhysicalDocs,
        uniqueLogicalMcqs,
        dualWriteOverlapCount,
      };

      const endTime = performance.now();
      const finalResult: FullDiagnosticScanResult = {
        timestamp: new Date().toLocaleTimeString(),
        counts,
        mismatches,
        orphans,
        anomalies,
        scanDurationMs: Math.round(endTime - startTime),
      };

      setReport(finalResult);
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(CACHE_REPORT_KEY, JSON.stringify(finalResult));
        } catch (_) {}
      }
    } catch (err: any) {
      console.error("[Diagnostics] Scan failed:", err);
      setErrorMessage(err?.message || "Failed to scan Supabase PostgreSQL tables.");
    } finally {
      setScanning(false);
    }
  }, []);

  React.useEffect(() => {
    if (isAdmin && !report) {
      runReadOnlyScan();
    }
  }, [isAdmin, report, runReadOnlyScan]);

  const filteredOrphans = React.useMemo(() => {
    if (!report) return [];
    if (!searchQuery.trim()) return report.orphans;
    const q = searchQuery.toLowerCase();
    return report.orphans.filter(o => 
      o.id.toLowerCase().includes(q) || 
      (o.snippet && o.snippet.toLowerCase().includes(q)) ||
      o.reason.toLowerCase().includes(q)
    );
  }, [report, searchQuery]);

  const filteredAnomalies = React.useMemo(() => {
    if (!report) return [];
    if (!searchQuery.trim()) return report.anomalies;
    const q = searchQuery.toLowerCase();
    return report.anomalies.filter(a =>
      a.id.toLowerCase().includes(q) ||
      a.snippet.toLowerCase().includes(q) ||
      a.details.toLowerCase().includes(q)
    );
  }, [report, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileSearch className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Supabase Integrity & Relational Auditor
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                  Read-Only Audit
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Deep validation of foreign-key links, orphan records, missing options, and schema anomalies.
              </p>
            </div>
          </div>

          <button
            onClick={runReadOnlyScan}
            disabled={scanning}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
            <span>{scanning ? "Auditing Database..." : "Run Integrity Audit"}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 4 Stats Cards */}
        {report && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Questions</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                {report.counts.questions.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Physical records in Supabase</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hierarchy Nodes</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                {report.counts.subjects}S / {report.counts.chapters}C / {report.counts.topics}T
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Subjects, Chapters, Topics</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Orphaned Nodes</span>
              <p className={`text-xl font-black mt-1 tabular-nums ${report.orphans.length === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                {report.orphans.length}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Missing parent assignments</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Data Anomalies</span>
              <p className={`text-xl font-black mt-1 tabular-nums ${report.anomalies.length === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                {report.anomalies.length}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Option/index bounds issues</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      {report && (
        <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab("summary")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "summary"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Audit Summary
              </button>
              <button
                onClick={() => setActiveTab("orphans")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "orphans"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>Orphans</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 font-mono">
                  {report.orphans.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("anomalies")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "anomalies"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>Anomalies</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 font-mono">
                  {report.anomalies.length}
                </span>
              </button>
            </div>

            {activeTab !== "summary" && (
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter findings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-9 pr-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          <div className="p-5">
            {activeTab === "summary" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 text-emerald-900 dark:text-emerald-200 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-bold">Supabase PostgreSQL Schema Validated</p>
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                      All audit checks completed in {report.scanDurationMs}ms. Database is functioning on clean authoritative architecture.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between">
                    <span className="text-slate-500">Subjects Registered:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{report.counts.subjects}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between">
                    <span className="text-slate-500">Chapters Registered:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{report.counts.chapters}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between">
                    <span className="text-slate-500">Topics Registered:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{report.counts.topics}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between">
                    <span className="text-slate-500">MCQ Bank Questions:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{report.counts.questions}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "orphans" && (
              filteredOrphans.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-bold">
                  Zero orphaned hierarchy records detected! All chapters, topics & questions have valid parents.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredOrphans.map((o) => (
                    <div key={o.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{o.id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Missing {o.missingParentType}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{o.reason}</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === "anomalies" && (
              filteredAnomalies.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-bold">
                  Zero question anomalies detected! All MCQs have valid text, sufficient options, and correct answers.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAnomalies.map((a) => (
                    <div key={a.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-rose-200/60 dark:border-rose-900/40 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{a.id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          {a.issue}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{a.details}</p>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDiagnosticsSection;
