import React, { useState, useEffect } from "react";
import { PYQPaper, Question, ExamCategory, Chapter, Subject } from "../types";
import {
  fetchPYQPapers,
  savePYQPaper,
  deletePYQPaper
} from "../utils/pyqStorage";
import { fetchExamCategories } from "../utils/categoryStorage";
import { loadUserQuestionsStore, deduplicateQuestions } from "../utils/questionsStorage";
import { AIImportModal } from "./AIImportModal";
import { HTMLImportMCQModal } from "./admin/HTMLImportMCQModal";
import {
  X,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  FileText,
  Sparkles,
  Save,
  HelpCircle,
  Eye,
  EyeOff,
  Cloud,
  Check,
  AlertCircle,
  RefreshCw,
  FileCode,
} from "lucide-react";

interface ManagePYQVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPYQUpdated?: () => void;
  chapters?: Chapter[];
  subjects?: Subject[];
}

export const ManagePYQVaultModal: React.FC<ManagePYQVaultModalProps> = ({
  isOpen,
  onClose,
  onPYQUpdated,
  chapters = [],
  subjects = [],
}) => {
  const [papers, setPapers] = useState<PYQPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);

  // Edit / Create Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
  const [showAIImportModal, setShowAIImportModal] = useState(false);
  const [showHTMLImportModal, setShowHTMLImportModal] = useState(false);

  // Form Fields
  const [title, setTitle] = useState("");
  const [hindiTitle, setHindiTitle] = useState("");
  const [examBoard, setExamBoard] = useState("RPSC");
  const [paperYear, setPaperYear] = useState("2024");
  const [examDate, setExamDate] = useState("");
  const [category, setCategory] = useState("General Studies");
  const [description, setDescription] = useState("");
  const [hindiDescription, setHindiDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [totalMarks, setTotalMarks] = useState(200);
  const [marksPerQuestion, setMarksPerQuestion] = useState(1.33);
  const [negativeMarking, setNegativeMarking] = useState(0.44);
  const [isPublished, setIsPublished] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<ExamCategory[]>([]);

  // Question editing sub-form
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [qText, setQText] = useState("");
  const [qOptA, setQOptA] = useState("");
  const [qOptB, setQOptB] = useState("");
  const [qOptC, setQOptC] = useState("");
  const [qOptD, setQOptD] = useState("");
  const [qCorrect, setQCorrect] = useState(0);
  const [qExplanation, setQExplanation] = useState("");
  const [qConcept, setQConcept] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPapers();
      loadCategories();
    }
  }, [isOpen]);

  const loadPapers = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchPYQPapers();
      setPapers(data);
    } catch (e: any) {
      console.error("Failed loading PYQ papers in admin:", e);
      setLoadError(e?.message || "Failed to load papers. Please retry.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await fetchExamCategories();
      setCategories(cats);
      if (cats.length > 0 && !category) {
        setCategory(cats[0].name);
      }
    } catch (e) {
      console.warn("Failed loading categories in PYQ modal:", e);
    }
  };

  if (!isOpen) return null;

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingPaperId(null);
    setTitle("");
    setHindiTitle("");
    setExamBoard("RPSC");
    setPaperYear("2024");
    setExamDate(new Date().toISOString().split("T")[0]);
    setCategory("General Studies");
    setDescription("");
    setHindiDescription("");
    setDurationMinutes(180);
    setTotalMarks(200);
    setMarksPerQuestion(1.33);
    setNegativeMarking(0.44);
    setIsPublished(true);
    setQuestions([]);
    setIsFormOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (paper: PYQPaper) => {
    setEditingPaperId(paper.id);
    setTitle(paper.title);
    setHindiTitle(paper.hindiTitle || "");
    setExamBoard(paper.examBoard || "RPSC");
    setPaperYear(paper.paperYear || "2024");
    setExamDate(paper.examDate || "");
    setCategory(paper.category || "General Studies");
    setDescription(paper.description || "");
    setHindiDescription(paper.hindiDescription || "");
    setDurationMinutes(paper.durationMinutes || 180);
    setTotalMarks(paper.totalMarks || 200);
    setMarksPerQuestion(paper.marksPerQuestion || 1.33);
    setNegativeMarking(paper.negativeMarking || 0.44);
    setIsPublished(paper.isPublished !== false);
    setQuestions(paper.questions || []);
    setIsFormOpen(true);
  };

  // Add Question to Form List
  const handleAddQuestionToPaper = () => {
    if (!qText.trim()) {
      alert("Please enter question text.");
      return;
    }
    if (!qOptA.trim() || !qOptB.trim()) {
      alert("Please enter at least Option A and Option B.");
      return;
    }

    const newQ: Question = {
      id: `pyq-q-${Date.now()}-${questions.length + 1}`,
      topicId: "pyq-topic",
      chapterId: "pyq-chapter",
      subjectId: "economics",
      text: qText.trim(),
      options: [
        qOptA.trim(),
        qOptB.trim(),
        qOptC.trim() || "Option C",
        qOptD.trim() || "Option D",
      ],
      correctIndex: qCorrect,
      explanation: qExplanation.trim(),
      conceptName: qConcept.trim() || "Official PYQ Concept",
      difficulty: "medium",
    };

    setQuestions([...questions, newQ]);
    // Reset question inputs
    setQText("");
    setQOptA("");
    setQOptB("");
    setQOptC("");
    setQOptD("");
    setQCorrect(0);
    setQExplanation("");
    setQConcept("");
    setShowQuestionForm(false);
  };

  // Delete Question from Paper Form
  const handleDeleteQuestionFromPaper = (qId: string) => {
    setQuestions(questions.filter((q) => q.id !== qId));
  };

  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Save Paper
  const handleSavePaper = async () => {
    if (!title.trim()) {
      setToastMessage({ type: "error", msg: "Please enter a paper title." });
      return;
    }

    setIsSaving(true);
    setToastMessage(null);
    try {
      const paperToSave: PYQPaper = {
        id: editingPaperId || `pyq-${examBoard.toLowerCase()}-${paperYear}-${Date.now()}`,
        title: title.trim(),
        hindiTitle: hindiTitle.trim() || title.trim(),
        examBoard: examBoard.trim(),
        paperYear: paperYear.trim(),
        examDate: examDate || new Date().toISOString().split("T")[0],
        category: category.trim(),
        description: description.trim() || `${title} Question Paper`,
        hindiDescription: hindiDescription.trim(),
        durationMinutes: Number(durationMinutes) || 180,
        totalMarks: Number(totalMarks) || 200,
        marksPerQuestion: Number(marksPerQuestion) || 1,
        negativeMarking: Number(negativeMarking) || 0,
        questionCount: questions.length,
        questions: questions,
        officialKeyReleased: true,
        isPublished: isPublished,
        createdAt: new Date().toISOString(),
      };

      const updatedList = await savePYQPaper(paperToSave);
      setPapers(updatedList);
      setIsFormOpen(false);
      if (onPYQUpdated) onPYQUpdated();
      setToastMessage({ type: "success", msg: "Saved successfully to Firebase Firestore!" });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error("Failed to save paper:", err);
      setToastMessage({ type: "error", msg: "Failed to save to Firebase: " + (err?.message || "Check network/permissions") });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Paper
  const handleDeletePaper = async (paperId: string) => {
    if (deletingPaperId) return; // Block duplicate clicks
    if (!confirm("Are you sure you want to delete this PYQ paper from the vault?")) return;

    setDeletingPaperId(paperId);
    setToastMessage(null);
    const previousPapers = [...papers];
    // Optimistic removal: remove immediately from UI
    setPapers((prev) => prev.filter((p) => p.id !== paperId));

    try {
      await deletePYQPaper(paperId);
      if (onPYQUpdated) onPYQUpdated();
      setToastMessage({ type: "success", msg: "PYQ Paper deleted successfully from Firebase Firestore!" });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error("Delete failed:", err);
      // Rollback on failure
      setPapers(previousPapers);
      let errorMsg = err?.message || "Please check connection";
      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed.error) errorMsg = parsed.error;
      } catch {}
      setToastMessage({ type: "error", msg: `Failed to delete paper: ${errorMsg}` });
    } finally {
      setDeletingPaperId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight font-display">
                Admin: PYQ Vault Manager
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                Create, edit & publish official past year examination papers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isFormOpen && (
              <button
                onClick={handleOpenCreate}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline">+ Add PYQ Paper</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className={`mx-6 mt-4 p-3 rounded-2xl flex items-center justify-between text-xs font-bold border transition-all ${
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

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {!isFormOpen ? (
            /* LIST VIEW */
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Vault Papers ({papers.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHTMLImportModal(true)}
                    className="px-3.5 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <FileCode className="w-4 h-4 text-amber-200" />
                    <span>HTML Import MCQ</span>
                  </button>
                  <button
                    onClick={handleOpenCreate}
                    className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New PYQ Paper</span>
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center text-xs font-bold text-slate-400 py-8 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                  <span>Loading papers...</span>
                </div>
              ) : loadError ? (
                <div className="p-6 text-center bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800 space-y-2">
                  <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300">{loadError}</p>
                  <button
                    onClick={loadPapers}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              ) : papers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    No PYQ papers in vault yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {papers.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            {p.examBoard} {p.paperYear}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              p.isPublished !== false
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {p.isPublished !== false ? "Published" : "Draft"}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {p.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {p.questionCount || (p.questions ? p.questions.length : 0)} Questions • {p.durationMinutes} Mins • {p.totalMarks} Marks
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-2 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-xl transition-all cursor-pointer"
                          title="Edit Paper"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePaper(p.id)}
                          disabled={deletingPaperId === p.id}
                          className={`p-2 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-xl transition-all cursor-pointer ${
                            deletingPaperId === p.id ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                          title="Delete Paper"
                        >
                          {deletingPaperId === p.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* CREATE / EDIT FORM VIEW */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {editingPaperId ? "Edit PYQ Paper" : "Create New Official PYQ Paper"}
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                >
                  ← Back to Paper List
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-bold">
                    English Paper Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. RAS Pre Examination 2023"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-bold">
                    Hindi Paper Title
                  </label>
                  <input
                    type="text"
                    value={hindiTitle}
                    onChange={(e) => setHindiTitle(e.target.value)}
                    placeholder="e.g. RAS Preliminary Exam 2023"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-bold">
                    Exam Board / Body
                  </label>
                  <select
                    value={examBoard}
                    onChange={(e) => setExamBoard(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="RPSC">RPSC (Rajasthan Public Service Commission)</option>
                    <option value="RSMSSB">RSMSSB / RSSB (Subordinate Board)</option>
                    <option value="UPSC">UPSC</option>
                    <option value="State Board">State Board / Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-bold">
                    Paper Year
                  </label>
                  <input
                    type="text"
                    value={paperYear}
                    onChange={(e) => setPaperYear(e.target.value)}
                    placeholder="2024"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-bold">
                    Exam Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  >
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name} {cat.hindiName ? `(${cat.hindiName})` : ""}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="General Studies">General Studies</option>
                        <option value="RAS Pre">RAS Pre</option>
                        <option value="RPSC EO/RO">RPSC EO/RO</option>
                        <option value="RSMSSB CET">RSMSSB CET</option>
                        <option value="SI Exam">SI Exam</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-bold">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-bold">
                    Total Marks
                  </label>
                  <input
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-bold">
                    Marks per Question
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={marksPerQuestion}
                    onChange={(e) => setMarksPerQuestion(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-bold">
                    Negative Marking (e.g. 0.33, 0.44)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={negativeMarking}
                    onChange={(e) => setNegativeMarking(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Publish Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="publish-toggle"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="publish-toggle" className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Publish to Students immediately (visible in student PYQ Vault)
                </label>
              </div>

              {/* Questions Section */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                    Questions in this Paper ({questions.length})
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
                      className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-xs font-bold hover:opacity-90 cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>AI / Smart MCQ Import</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQuestionForm(!showQuestionForm)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Question</span>
                    </button>
                  </div>
                </div>

                {/* Sub Question Creation Form */}
                {showQuestionForm && (
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-900 space-y-2 text-xs">
                    <span className="font-bold text-blue-600 dark:text-blue-400 block">
                      + Add Question to Paper
                    </span>
                    <textarea
                      rows={2}
                      value={qText}
                      onChange={(e) => setQText(e.target.value)}
                      placeholder="Question Text in Hindi or English..."
                      className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded-lg font-hindi"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Option A"
                        value={qOptA}
                        onChange={(e) => setQOptA(e.target.value)}
                        className="p-2 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Option B"
                        value={qOptB}
                        onChange={(e) => setQOptB(e.target.value)}
                        className="p-2 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Option C"
                        value={qOptC}
                        onChange={(e) => setQOptC(e.target.value)}
                        className="p-2 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Option D"
                        value={qOptD}
                        onChange={(e) => setQOptD(e.target.value)}
                        className="p-2 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold">Correct Option:</span>
                      <select
                        value={qCorrect}
                        onChange={(e) => setQCorrect(Number(e.target.value))}
                        className="p-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                      >
                        <option value={0}>Option A</option>
                        <option value={1}>Option B</option>
                        <option value={2}>Option C</option>
                        <option value={3}>Option D</option>
                      </select>
                    </div>

                    <input
                      type="text"
                      placeholder="Explanation & Key Notes..."
                      value={qExplanation}
                      onChange={(e) => setQExplanation(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded-lg"
                    />

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowQuestionForm(false)}
                        className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddQuestionToPaper}
                        className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg"
                      >
                        Add to Paper
                      </button>
                    </div>
                  </div>
                )}

                {/* Question List Preview */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between text-xs gap-2"
                    >
                      <div>
                        <span className="font-bold text-blue-600 mr-1">Q{idx + 1}.</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-hindi">
                          {q.text}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestionFromPaper(q.id)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePaper}
                  disabled={isSaving}
                  className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? "Saving..." : "Save PYQ Paper"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAIImportModal && (
        <AIImportModal
          isOpen={showAIImportModal}
          onClose={() => setShowAIImportModal(false)}
          questionsStore={loadUserQuestionsStore()}
          chapters={chapters}
          subjects={subjects}
          onImportQuestions={(newQs) => {
            setQuestions((prev) => deduplicateQuestions([...prev, ...newQs]));
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
          initialTargetType="pyq_paper"
          initialPaperId={editingPaperId || (isFormOpen ? "current_form" : undefined)}
          onImportQuestions={(newQs) => {
            setQuestions((prev) => deduplicateQuestions([...prev, ...newQs]));
          }}
          onImportToPYQPaper={(newQs) => {
            setQuestions((prev) => deduplicateQuestions([...prev, ...newQs]));
            onPYQUpdated?.();
            loadPapers();
          }}
        />
      )}
    </div>
  );
};
