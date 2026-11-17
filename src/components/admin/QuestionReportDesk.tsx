import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  BookOpen,
  Edit3,
  Check,
  ChevronDown,
  Trash2,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import { Question, Subject, Chapter } from "../../types";

export interface QuestionReport {
  id: string;
  questionId: string;
  questionText: string;
  subjectName?: string;
  chapterName?: string;
  studentName?: string;
  studentEmail?: string;
  studentUid?: string;
  issueType: "wrong_answer" | "typo" | "ambiguous" | "outdated" | "other";
  studentComment: string;
  reportedAt: string;
  status: "pending" | "resolved" | "dismissed";
  adminNotes?: string;
}

interface QuestionReportDeskProps {
  questions?: Question[];
  subjects?: Subject[];
  chapters?: Chapter[];
  onUpdateQuestion?: (updatedQuestion: Question) => void;
}

const REPORTS_STORAGE_KEY = "disha2020_question_reports_v1";
const LEGACY_REPORTS_STORAGE_KEY = "quizpro_question_reports_v1";

export const QuestionReportDesk: React.FC<QuestionReportDeskProps> = ({
  questions = [],
  subjects = [],
  chapters = [],
  onUpdateQuestion
}) => {
  const [reports, setReports] = React.useState<QuestionReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterStatus, setFilterStatus] = React.useState<"all" | "pending" | "resolved" | "dismissed">("pending");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [editingReport, setEditingReport] = React.useState<QuestionReport | null>(null);
  
  // Quick fix modal state
  const [fixQuestion, setFixQuestion] = React.useState<Question | null>(null);
  const [fixCorrectIndex, setFixCorrectIndex] = React.useState<number>(0);
  const [fixExplanation, setFixExplanation] = React.useState<string>("");
  const [isSavingFix, setIsSavingFix] = React.useState(false);

  // Initial seed mock reports if none exist in database
  const fetchReports = async () => {
    setLoading(true);
    try {
      const raw = localStorage.getItem(REPORTS_STORAGE_KEY) || localStorage.getItem(LEGACY_REPORTS_STORAGE_KEY);
      if (raw) {
        const loaded = JSON.parse(raw);
        if (Array.isArray(loaded) && loaded.length > 0) {
          setReports(loaded);
          setLoading(false);
          return;
        }
      }

      // Fallback / seed initial realistic doubts
      const sampleReports: QuestionReport[] = [
        {
          id: "rep-1",
          questionId: questions[0]?.id || "q-101",
          questionText: questions[0]?.text || "राजस्थान के किस दुर्ग को 'यूनेस्को विश्व धरोहर' में शामिल किया गया है?",
          subjectName: "राजस्थान का इतिहास व संस्कृति",
          chapterName: "दुर्ग एवं स्थापत्य",
          studentName: "राकेश शर्मा (Aspirant)",
          studentEmail: "rakesh.sharma@gmail.com",
          issueType: "wrong_answer",
          studentComment: "सर ऑप्शन में आमेर दुर्ग दिया है, लेकिन व्याख्या में वर्ष 2013 की जगह 2010 लिखा आ रहा है। कृपया वर्ष चेक करें।",
          reportedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
          status: "pending"
        },
        {
          id: "rep-2",
          questionId: questions[1]?.id || "q-102",
          questionText: questions[1]?.text || "राजस्थान में 1857 की क्रांति का प्रारंभ सर्वप्रथम कहाँ हुआ था?",
          subjectName: "राजस्थान का इतिहास",
          chapterName: "1857 की क्रांति",
          studentName: "सुरेश बिश्नोई",
          studentEmail: "suresh.b@gmail.com",
          issueType: "typo",
          studentComment: "नसीराबाद छावनी की तारीख 28 मई 1857 होनी चाहिए, टाइपिंग में 28 मार्च लिखा हुआ है।",
          reportedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
          status: "pending"
        }
      ];
      setReports(sampleReports);
      try {
        localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(sampleReports));
      } catch {}
    } catch (e) {
      console.warn("Using local report buffer", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReports();
  }, []);

  const handleUpdateStatus = async (reportId: string, status: "resolved" | "dismissed") => {
    setReports(prev => {
      const updated = prev.map(r => r.id === reportId ? { ...r, status } : r);
      try {
        localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleOpenFixModal = (report: QuestionReport) => {
    setEditingReport(report);
    const targetQ = questions.find(q => q.id === report.questionId) || {
      id: report.questionId,
      text: report.questionText,
      options: ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D", "अनुत्तरित प्रश्न"],
      correctIndex: 0,
      explanation: "विस्तृत व्याख्या...",
      chapterId: "",
      topicId: ""
    } as Question;

    setFixQuestion(targetQ);
    setFixCorrectIndex(targetQ.correctIndex ?? 0);
    setFixExplanation(targetQ.explanation || "");
  };

  const handleSaveFix = async () => {
    if (!fixQuestion || !editingReport) return;
    setIsSavingFix(true);
    try {
      const updated: Question = {
        ...fixQuestion,
        correctIndex: fixCorrectIndex,
        explanation: fixExplanation,
        updatedAt: new Date().toISOString()
      };

      if (onUpdateQuestion) {
        onUpdateQuestion(updated);
      }

      await handleUpdateStatus(editingReport.id, "resolved");
      setEditingReport(null);
      setFixQuestion(null);
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setIsSavingFix(false);
    }
  };

  const filteredReports = reports.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        r.questionText.toLowerCase().includes(term) ||
        r.studentComment.toLowerCase().includes(term) ||
        (r.studentName && r.studentName.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const pendingCount = reports.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/20 rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Student Objection & Doubt Desk (आपत्ति केंद्र)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                {pendingCount} Pending
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Review and resolve student error reports on questions, answer keys, and explanations with 1-click in-place editing.
            </p>
          </div>
        </div>

        <button
          onClick={fetchReports}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Objections</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by question text, student comment, or name..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
          {(["all", "pending", "resolved", "dismissed"] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                filterStatus === st 
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" 
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* List of Reports */}
      {filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 text-center text-slate-400">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-60" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Objections Found</h4>
          <p className="text-xs text-slate-400 mt-1">
            {filterStatus === "pending" ? "Great job! All student doubts and reports are currently resolved." : "No reports match your filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map(report => (
            <div
              key={report.id}
              className={`bg-white dark:bg-[#111A2E] rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
                report.status === "pending"
                  ? "border-amber-200 dark:border-amber-900/50 hover:border-amber-400"
                  : "border-slate-200/80 dark:border-slate-800 opacity-80"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    report.issueType === "wrong_answer"
                      ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                      : report.issueType === "typo"
                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                  }`}>
                    {report.issueType.replace("_", " ")}
                  </span>
                  {report.subjectName && (
                    <span className="text-slate-500 font-bold flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> {report.subjectName}
                    </span>
                  )}
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3" /> {new Date(report.reportedAt).toLocaleDateString("hi-IN")}
                  </span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {report.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleOpenFixModal(report)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Fix Answer / Expl.</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(report.id, "dismissed")}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                        title="Dismiss (Valid Question)"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {report.status === "resolved" && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" /> Resolved
                    </span>
                  )}
                  {report.status === "dismissed" && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                      <XCircle className="w-4 h-4" /> Dismissed
                    </span>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <div className="mt-3">
                <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                  Q: {report.questionText}
                </p>
              </div>

              {/* Student Comment Box */}
              <div className="mt-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5">
                <MessageSquare className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-amber-900 dark:text-amber-200">
                    {report.studentName || "Student"} Feedback:
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                    "{report.studentComment}"
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Fix Modal */}
      {editingReport && fixQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#0B1220] w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                <span>Quick Fix Question & Resolve Doubt</span>
              </h3>
              <button onClick={() => setEditingReport(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Question</label>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200">
                {fixQuestion.text}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                Correct Option (सही उत्तर चुनें)
              </label>
              <div className="space-y-1.5">
                {fixQuestion.options.map((opt, idx) => (
                  <label
                    key={idx}
                    onClick={() => setFixCorrectIndex(idx)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      fixCorrectIndex === idx
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="correctOption"
                      checked={fixCorrectIndex === idx}
                      onChange={() => setFixCorrectIndex(idx)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{String.fromCharCode(65 + idx)}: {opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Detailed Explanation (व्याख्या सुधारें)
              </label>
              <textarea
                value={fixExplanation}
                onChange={(e) => setFixExplanation(e.target.value)}
                rows={4}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEditingReport(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFix}
                disabled={isSavingFix}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Save Question & Resolve</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
