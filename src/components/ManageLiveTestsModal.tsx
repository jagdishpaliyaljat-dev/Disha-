import React, { useState, useEffect } from "react";
import { LiveTest, LiveTestSubmission, Question, Chapter, ExamCategory, Subject } from "../types";
import {
  fetchLiveTests,
  saveLiveTest,
  deleteLiveTest,
  fetchLiveTestSubmissions,
  hydrateLiveTestForAdmin
} from "../utils/liveTestStorage";
import { fetchExamCategories } from "../utils/categoryStorage";
import { loadUserQuestionsStore, deduplicateQuestions } from "../utils/questionsStorage";
import { triggerDatabaseSavedToast, triggerAdminToast } from "../utils/adminToast";
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Radio,
  Zap,
  Users,
  Clock,
  Award,
  AlertTriangle,
  Play,
  CheckCircle2,
  HelpCircle,
  FileText,
  Search,
  Filter,
  Layers,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Trophy,
  Sparkles,
  FileCode,
} from "lucide-react";
import { AIImportModal } from "./AIImportModal";
import { AddQuestionsModal } from "./AddQuestionsModal";
import { HTMLImportMCQModal } from "./admin/HTMLImportMCQModal";

interface ManageLiveTestsModalProps {
  chapters?: Chapter[];
  subjects?: Subject[];
  onClose: () => void;
  onImportQuestions?: (newQuestions: Question[]) => void;
}


export const ManageLiveTestsModal: React.FC<ManageLiveTestsModalProps> = ({
  chapters = [],
  subjects = [],
  onClose,
  onImportQuestions,
}) => {
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAIImportModal, setShowAIImportModal] = useState(false);
  const [showHTMLImportModal, setShowHTMLImportModal] = useState(false);
  const [importMethod, setImportMethod] = useState<"paste" | "manual">("paste");
  const [tests, setTests] = useState<LiveTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
  const [editingTest, setEditingTest] = useState<LiveTest | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [categories, setCategories] = useState<ExamCategory[]>([]);

  // Submissions Modal
  const [viewingSubmissionsTest, setViewingSubmissionsTest] = useState<LiveTest | null>(null);
  const [testSubmissions, setTestSubmissions] = useState<LiveTestSubmission[]>([]);

  // Form State
  const [title, setTitle] = useState("");
  const [hindiTitle, setHindiTitle] = useState("");
  const [examCategory, setExamCategory] = useState("RAS Pre");
  const [status, setStatus] = useState<"live" | "upcoming" | "ended" | "draft">("live");
  const [durationMinutes, setDurationMinutes] = useState<number>(180);
  const [totalMarks, setTotalMarks] = useState<number>(200);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(2);
  const [negativeMarking, setNegativeMarking] = useState<number>(0.66);
  const [instructions, setInstructions] = useState("");
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);

  // Question Selector Modal
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  useEffect(() => {
    loadTests();
    loadCategories();
  }, []);

  const loadTests = () => {
    setIsLoading(true);
    setLoadError(null);
    fetchLiveTests()
      .then((data) => setTests(data))
      .catch((err: any) => {
        console.error("Failed to load live tests:", err);
        setLoadError(err?.message || "Failed to load live tests.");
      })
      .finally(() => setIsLoading(false));
  };

  const loadCategories = async () => {
    const cats = await fetchExamCategories();
    setCategories(cats);
    if (cats.length > 0 && !examCategory) {
      setExamCategory(cats[0].name);
    }
  };

  // Open Form to Create
  const handleOpenCreate = () => {
    setEditingTest(null);
    setTitle("");
    setHindiTitle("");
    setExamCategory("RAS Pre");
    setStatus("live");
    setDurationMinutes(180);
    setTotalMarks(200);
    setMarksPerQuestion(2);
    setNegativeMarking(0.66);
    setInstructions("Official Live Exam Test. Complete all questions within the time limit.");
    
    // Auto select questions from chapters if available
    const allQuestions: Question[] = [];
    chapters.forEach((ch) => (ch.topics || []).forEach((t) => allQuestions.push(...(t.questions || []))));
    setSelectedQuestions(deduplicateQuestions(allQuestions).slice(0, 10));

    setIsCreating(true);
  };

  // Open Form to Edit
  const handleOpenEdit = (test: LiveTest) => {
    setEditingTest(test);
    setTitle(test.title);
    setHindiTitle(test.hindiTitle || "");
    setExamCategory(test.examCategory);
    setStatus(test.status);
    setDurationMinutes(test.durationMinutes);
    setTotalMarks(test.totalMarks);
    setMarksPerQuestion(test.marksPerQuestion);
    setNegativeMarking(test.negativeMarking);
    setInstructions(test.instructions || "");
    setSelectedQuestions(test.questions || []);
    setIsCreating(true);
    hydrateLiveTestForAdmin(test).then((hydrated) => {
      if (hydrated?.questions) {
        setSelectedQuestions(hydrated.questions);
      }
    }).catch(() => {});
  };

  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Save Test
  const handleSave = async () => {
    if (!title.trim()) {
      setToastMessage({ type: "error", msg: "Please enter a Live Test Title" });
      return;
    }

    setToastMessage(null);
    try {
      const testToSave: LiveTest = {
        id: editingTest ? editingTest.id : `live-test-${Date.now()}`,
        title: title.trim(),
        hindiTitle: hindiTitle.trim() || title.trim(),
        examCategory: examCategory,
        status: status,
        durationMinutes: Number(durationMinutes) || 120,
        totalMarks: Number(totalMarks) || 200,
        marksPerQuestion: Number(marksPerQuestion) || 2,
        negativeMarking: Number(negativeMarking) || 0,
        questionCount: deduplicateQuestions(selectedQuestions).length,
        questions: deduplicateQuestions(selectedQuestions),
        instructions: instructions.trim(),
        createdAt: editingTest ? editingTest.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        participantCount: editingTest ? editingTest.participantCount : 0,
      };

      const updated = await saveLiveTest(testToSave);
      setTests(updated);
      setIsCreating(false);
      setEditingTest(null);
      setToastMessage({ type: "success", msg: "Live Test saved successfully!" });
      triggerDatabaseSavedToast({
        type: "add",
        title: "लाइव टेस्ट Supabase में लाइव हुआ!",
        message: `लाइव टेस्ट "${testToSave.title}" Supabase में सुरक्षित पब्लिश हो गया है और यूजर ऐप में लाइव उपलब्ध है।`,
        itemName: testToSave.title,
      });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error("Save live test failed:", err);
      setToastMessage({ type: "error", msg: "Failed to save Live Test: " + (err?.message || "Check network/permissions") });
    }
  };

  // Delete Test
  const handleDelete = async (testId: string) => {
    if (deletingTestId) return; // Block duplicate clicks
    if (!confirm("Are you sure you want to delete this live test?")) return;

    setDeletingTestId(testId);
    setToastMessage(null);
    const previous = [...tests];
    // Immediate optimistic removal from UI
    setTests((prev) => prev.filter((t) => t.id !== testId));

    try {
      await deleteLiveTest(testId);
      setToastMessage({ type: "success", msg: "Live Test deleted successfully!" });
      triggerAdminToast(
        "delete",
        "लाइव टेस्ट Supabase से हटाया गया",
        "लाइव टेस्ट को Supabase डेटाबेस से हटा दिया गया है और यूजर ऐप से तुरंत रिमूव हो चुका है।"
      );
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error("Delete live test failed:", err);
      // Rollback on failure
      setTests(previous);
      let errorMsg = err?.message || "Please check connection";
      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed.error) errorMsg = parsed.error;
      } catch {}
      setToastMessage({ type: "error", msg: `Failed to delete live test: ${errorMsg}` });
    } finally {
      setDeletingTestId(null);
    }
  };

  // View Submissions / Results
  const handleViewSubmissions = async (test: LiveTest) => {
    setViewingSubmissionsTest(test);
    const subs = await fetchLiveTestSubmissions(test.id);
    setTestSubmissions(subs);
  };

  // All available questions for picker
  const availableQuestionsList = React.useMemo(() => {
    const list: Question[] = [];
    chapters.forEach((ch) => {
      (ch.topics || []).forEach((t) => {
        if (t && Array.isArray(t.questions)) {
          list.push(...t.questions);
        }
      });
    });
    return deduplicateQuestions(list);
  }, [chapters]);

  const filteredPickerQuestions = React.useMemo(() => {
    if (!pickerSearch.trim()) return availableQuestionsList;
    const q = pickerSearch.toLowerCase();
    return availableQuestionsList.filter((item) => (item.text || "").toLowerCase().includes(q));
  }, [availableQuestionsList, pickerSearch]);

  const toggleSelectQuestionInPicker = (q: Question) => {
    setSelectedQuestions((prev) => {
      const isSelected = prev.some((sq) => sq.id === q.id);
      if (isSelected) {
        return prev.filter((sq) => sq.id !== q.id);
      } else {
        return deduplicateQuestions([...prev, q]);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-[#111A2E] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[32px] sm:rounded-3xl w-full max-w-3xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden mb-0">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            <div>
              <h2 className="text-base font-black font-display">Manage Live Tests (Admin Panel)</h2>
              <p className="text-[11px] text-slate-400 font-bold">Control active, scheduled & past live tests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCreating && (
              <button
                onClick={handleOpenCreate}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">+ Add Live Test</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className={`mx-5 mt-3 p-3 rounded-2xl flex items-center justify-between text-xs font-bold border transition-all ${
            toastMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}>
            <span>{toastMessage.msg}</span>
            <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-70">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {isCreating ? (
            /* CREATE / EDIT FORM */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {editingTest ? "Edit Live Test" : "Create New Live Test"}
                </h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Live Test Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. RAS Pre Official Live Mock Test 2024"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Exam Category
                  </label>
                  <select
                    value={examCategory}
                    onChange={(e) => setExamCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name} {cat.hindiName ? `(${cat.hindiName})` : ""}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="RAS Pre">RAS Pre</option>
                        <option value="RPSC EO/RO">RPSC EO/RO</option>
                        <option value="RSMSSB CET">RSMSSB CET</option>
                        <option value="RPSC Assistant Professor">RPSC Assistant Professor</option>
                        <option value="SI Exam">SI Exam</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Live Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="live">● Live Now (Active for students)</option>
                    <option value="upcoming">Upcoming (Scheduled)</option>
                    <option value="ended">Ended (Archive)</option>
                    <option value="draft">Draft (Admin Only)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Total Marks
                  </label>
                  <input
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Marks per Question
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={marksPerQuestion}
                    onChange={(e) => setMarksPerQuestion(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Negative Marking Rule (e.g. 0.33, 0.66, 0)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={negativeMarking}
                    onChange={(e) => setNegativeMarking(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Instructions & Description
                  </label>
                  <textarea
                    rows={2}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Questions Selection Bar */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Selected Questions ({selectedQuestions.length})
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowHTMLImportModal(true)}
                      className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <FileCode className="w-3.5 h-3.5 text-amber-200" />
                      <span>HTML Import MCQ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAIImportModal(true)}
                      className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>AI / Smart MCQ Import</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportMethod("manual");
                        setShowBulkImport(true);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Single MCQ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportMethod("paste");
                        setShowBulkImport(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Bulk MCQ Import</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQuestionPicker(true)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Select From Bank</span>
                    </button>
                  </div>
                </div>

                {selectedQuestions.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {selectedQuestions.map((q, idx) => (
                      <div
                        key={`${q.id}-${idx}`}
                        className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2"
                      >
                        <span className="truncate">Q{idx + 1}. {q.text}</span>
                        <button
                          onClick={() => setSelectedQuestions(selectedQuestions.filter((sq) => sq.id !== q.id))}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No questions selected yet.</p>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
                >
                  Save Live Test
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* LIST OF LIVE TESTS */
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  Live Tests ({tests.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHTMLImportModal(true)}
                    className="px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:opacity-90 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5 text-amber-200" />
                    <span>HTML Import MCQ</span>
                  </button>
                  <button
                    onClick={handleOpenCreate}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Live Test</span>
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-xs font-bold text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-red-500 animate-spin" />
                  <span>Loading live tests...</span>
                </div>
              ) : loadError ? (
                <div className="p-6 text-center bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800 space-y-2">
                  <AlertTriangle className="w-6 h-6 text-rose-500 mx-auto" />
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300">{loadError}</p>
                  <button
                    onClick={loadTests}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              ) : tests.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl text-xs font-bold text-slate-500">
                  No live tests created yet. Click &ldquo;Create Live Test&rdquo; above.
                </div>
              ) : (
                <div className="space-y-3">
                  {tests.map((test) => (
                    <div
                      key={test.id}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              test.status === "live"
                                ? "bg-red-600 text-white animate-pulse"
                                : test.status === "upcoming"
                                ? "bg-amber-500 text-white"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {test.status}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            {test.examCategory}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewSubmissions(test)}
                            className="px-2.5 py-1 bg-amber-500 text-slate-950 rounded-lg text-xs font-black hover:bg-amber-400 cursor-pointer flex items-center gap-1"
                            title="View student ranks & scores"
                          >
                            <Trophy className="w-3.5 h-3.5" />
                            <span>Results</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(test)}
                            className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(test.id)}
                            disabled={deletingTestId === test.id}
                            className={`p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-rose-500 hover:text-rose-700 cursor-pointer ${
                              deletingTestId === test.id ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          >
                            {deletingTestId === test.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {test.title}
                      </h3>

                      <div className="text-[11px] font-bold text-slate-500 flex items-center gap-3">
                        <span>{test.questionCount} Questions</span>
                        <span>{test.durationMinutes} Mins</span>
                        <span>{test.totalMarks} Marks</span>
                        <span>{test.participantCount || 0} Attempts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* QUESTION PICKER MODAL */}
      {showQuestionPicker && (
        <div className="fixed inset-0 z-[220] bg-slate-900/80 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-[#111A2E] rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Pick Questions for Live Test
              </h3>
              <button
                onClick={() => setShowQuestionPicker(false)}
                className="text-xs font-bold text-slate-500 cursor-pointer"
              >
                Done
              </button>
            </div>

            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search question text..."
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold"
            />

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredPickerQuestions.map((q, idx) => {
                const isSelected = selectedQuestions.some((sq) => sq.id === q.id);

                return (
                  <div
                    key={`${q.id}-${idx}`}
                    onClick={() => toggleSelectQuestionInPicker(q)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start gap-2 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-900 dark:text-blue-100 font-bold"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="mt-0.5 rounded text-blue-600"
                    />
                    <span className="flex-1 leading-snug">{q.text}</span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowQuestionPicker(false)}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Add Selected Questions ({selectedQuestions.length})
            </button>
          </div>
        </div>
      )}

      {/* SUBMISSIONS MODAL */}
      {viewingSubmissionsTest && (
        <div className="fixed inset-0 z-[220] bg-slate-900/80 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-[#111A2E] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Live Test Results & Leaderboard
                </h3>
                <p className="text-[11px] text-slate-400 font-bold">{viewingSubmissionsTest.title}</p>
              </div>
              <button
                onClick={() => setViewingSubmissionsTest(null)}
                className="text-xs font-bold text-slate-500 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {testSubmissions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 font-bold">
                  No submissions yet for this test.
                </p>
              ) : (
                testSubmissions.map((sub, idx) => (
                  <div
                    key={sub.submissionId}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-black text-amber-500 mr-2">#{idx + 1}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{sub.userName || "Student"}</span>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-emerald-600 block">{sub.score} / {sub.totalMarks} Marks</span>
                      <span className="text-[10px] text-slate-400">{sub.accuracy.toFixed(0)}% Acc</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* BULK IMPORT MODAL */}
      {showBulkImport && (
        <AddQuestionsModal
          chapters={chapters}
          subjects={subjects}
          initialMethod={importMethod}
          onClose={() => setShowBulkImport(false)}
          onImportQuestions={(newQs) => {
            // 1. Add to the test's selected questions (deduplicated)
            setSelectedQuestions((prev) => deduplicateQuestions([...prev, ...newQs]));
            // 2. Call the parent onImportQuestions to save to curriculum/global store
            onImportQuestions?.(newQs);
          }}
        />
      )}

      {/* AI SMART IMPORT MODAL */}
      {showAIImportModal && (
        <AIImportModal
          isOpen={showAIImportModal}
          onClose={() => setShowAIImportModal(false)}
          questionsStore={loadUserQuestionsStore()}
          chapters={chapters}
          onImportQuestions={(newQs) => {
            setSelectedQuestions((prev) => deduplicateQuestions([...prev, ...newQs]));
            onImportQuestions?.(newQs);
          }}
        />
      )}

      {/* HTML IMPORT MCQ MODAL */}
      {showHTMLImportModal && (
        <HTMLImportMCQModal
          isOpen={showHTMLImportModal}
          onClose={() => setShowHTMLImportModal(false)}
          questionsStore={loadUserQuestionsStore()}
          chapters={chapters}
          subjects={subjects}
          initialTargetType="live_test"
          initialLiveTestId={editingTest?.id || (isCreating ? "current_form" : undefined)}
          onImportQuestions={(newQs) => {
            setSelectedQuestions((prev) => deduplicateQuestions([...prev, ...newQs]));
            onImportQuestions?.(newQs);
          }}
          onImportToLiveTest={(newQs) => {
            setSelectedQuestions((prev) => deduplicateQuestions([...prev, ...newQs]));
            onImportQuestions?.(newQs);
            loadTests();
          }}
        />
      )}
    </div>
  );
};
