import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Check,
  Save,
  Sparkles,
  AlertCircle,
  BookOpen,
  Layers,
  Tag,
  CheckCircle2,
  Trash2,
  Plus,
  Info,
  Calendar,
  Award,
  Bell,
  RefreshCw
} from "lucide-react";
import type { Question, Subject, Chapter, Topic } from "../../types";
import {
  QuestionReport,
  updateReportStatus,
  notifyStudentOnObjectionAction,
  fetchAuthoritativeQuestion
} from "../../utils/questionReportService";
import {
  editQuestionInStore,
  saveUserQuestionsStore,
  loadUserQuestionsStore
} from "../../utils/questionsStorage";
import { upsertQuestionsToSupabase } from "../../utils/supabaseSyncService";
import { triggerAdminToast } from "../../utils/adminToast";

export interface QuestionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: QuestionReport | null;
  question?: Question | null;
  subjects?: Subject[];
  chapters?: Chapter[];
  onQuestionSaved?: (updatedQuestion: Question) => void;
  onReportResolved?: (reportId: string) => void;
}

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  isOpen,
  onClose,
  report,
  question: initialQuestion,
  subjects = [],
  chapters = [],
  onQuestionSaved,
  onReportResolved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qData, setQData] = useState<Question | null>(null);

  // Form Fields
  const [text, setText] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", "", "अनुत्तरित प्रश्न"]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [explanation, setExplanation] = useState("");
  const [importantFact, setImportantFact] = useState("");
  
  // Hierarchy
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");

  // Metadata
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [examName, setExamName] = useState("");
  const [examYear, setExamYear] = useState("");

  // Objection Resolution Note & Notification
  const [adminNote, setAdminNote] = useState("");
  const [notifyStudent, setNotifyStudent] = useState(true);
  const [formatSuccessMsg, setFormatSuccessMsg] = useState("");

  // Load authoritative question data whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setFormatSuccessMsg("");

    const loadData = async () => {
      try {
        let targetQuestion: Question | null = initialQuestion || null;
        
        if (!targetQuestion && report?.questionId) {
          targetQuestion = await fetchAuthoritativeQuestion(
            report.questionId,
            report,
            initialQuestion ? [initialQuestion] : []
          );
        }

        if (!isMounted) return;

        if (targetQuestion) {
          setQData(targetQuestion);
          setText(targetQuestion.text || (targetQuestion as any).question || "");
          
          let opts = Array.isArray(targetQuestion.options) ? [...targetQuestion.options] : [];
          if (opts.length === 0) {
            opts = ["", "", "", "", "अनुत्तरित प्रश्न"];
          } else if (opts.length === 4) {
            // Keep 4 or allow 5th option
          }
          setOptions(opts);
          setCorrectIndex(typeof targetQuestion.correctIndex === "number" ? targetQuestion.correctIndex : 0);
          setExplanation(targetQuestion.explanation || "");
          setImportantFact(targetQuestion.importantFact || (targetQuestion as any).important_fact || "");

          setSelectedSubjectId(targetQuestion.subjectId || "");
          setSelectedChapterId(targetQuestion.chapterId || "");
          setSelectedTopicId(targetQuestion.topicId || "");

          setDifficulty(targetQuestion.difficulty || "medium");
          setExamName(targetQuestion.exam || (targetQuestion as any).examName || "");
          setExamYear(targetQuestion.year ? String(targetQuestion.year) : "");
        }

        if (report) {
          setAdminNote(`Verified and updated answer key/explanation per official key. Report ID: ${report.id.slice(0, 8)}`);
        }
      } catch (err) {
        console.warn("[QuestionEditorModal] Error loading authoritative question:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, report, initialQuestion]);

  // Derived filtered chapters for selected subject
  const availableChapters = useMemo(() => {
    if (!selectedSubjectId) return chapters;
    return chapters.filter((c) => c.subjectId === selectedSubjectId);
  }, [chapters, selectedSubjectId]);

  // Derived topics for selected chapter
  const availableTopics = useMemo(() => {
    if (!selectedChapterId) return [];
    const ch = chapters.find((c) => c.id === selectedChapterId);
    return ch?.topics || [];
  }, [chapters, selectedChapterId]);

  if (!isOpen) return null;

  // Handle Option change
  const handleOptionChange = (idx: number, val: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  // Toggle 5th Option (Option E)
  const handleToggleOptionE = () => {
    if (options.length >= 5) {
      setOptions((prev) => prev.slice(0, 4));
      if (correctIndex >= 4) setCorrectIndex(0);
    } else {
      setOptions((prev) => [...prev, "अनुत्तरित प्रश्न"]);
    }
  };

  // Quick Clean & Formatting
  const handleCleanText = () => {
    setText((prev) => prev.trim().replace(/[ \t]+/g, " "));
    setExplanation((prev) => prev.trim().replace(/[ \t]+/g, " "));
    setImportantFact((prev) => prev.trim().replace(/[ \t]+/g, " "));
    setOptions((prev) => prev.map((opt) => opt.trim().replace(/[ \t]+/g, " ")));
    setFormatSuccessMsg("✨ Text whitespace and options cleaned successfully!");
    setTimeout(() => setFormatSuccessMsg(""), 3500);
  };

  // Save handler: cloud + local + report update + student notification
  const handleSave = async () => {
    if (!text.trim()) {
      alert("Question text cannot be empty.");
      return;
    }
    const cleanOptions = options.map((o) => o.trim());
    if (cleanOptions.slice(0, 4).some((o) => !o)) {
      alert("Please provide at least Options A, B, C, and D.");
      return;
    }

    setSaving(true);
    try {
      const qId = qData?.id || report?.questionId || `q_custom_${Date.now()}`;
      const nowIso = new Date().toISOString();

      const updatedQuestion: Question = {
        ...(qData || {}),
        id: qId,
        text: text.trim(),
        options: cleanOptions,
        correctIndex,
        explanation: explanation.trim(),
        importantFact: importantFact.trim() || undefined,
        subjectId: selectedSubjectId || undefined,
        chapterId: selectedChapterId || undefined,
        topicId: selectedTopicId || undefined,
        difficulty,
        exam: examName.trim() || undefined,
        year: examYear.trim() || undefined,
        updatedAt: nowIso,
      };

      // 1. Update in Local Storage & Memory
      const currentStore = loadUserQuestionsStore();
      const updatedStore = editQuestionInStore(currentStore, updatedQuestion);
      saveUserQuestionsStore(updatedStore);

      // Cache directly in individual MCQ storage
      try {
        localStorage.setItem(`disha2020_mcq_${qId}`, JSON.stringify(updatedQuestion));
        localStorage.setItem(`quizpro_mcq_${qId}`, JSON.stringify(updatedQuestion));
      } catch (_) {}

      // 2. Cloud Persistence to Supabase
      const cloudResult = await upsertQuestionsToSupabase([updatedQuestion]);

      // 3. Update Objection Report Status if linked
      if (report) {
        const changesSummary = `Updated text & options (A-${String.fromCharCode(64 + cleanOptions.length)}). Correct answer set to Option ${String.fromCharCode(65 + correctIndex)}.`;
        
        await updateReportStatus(report.id, "resolved", adminNote.trim() || undefined, {
          actor: "Admin Desk",
          auditAction: "question_updated",
          changesSummary,
          notifyStudent,
          updatedQuestion,
        });

        if (onReportResolved) {
          onReportResolved(report.id);
        }
      }

      if (onQuestionSaved) {
        onQuestionSaved(updatedQuestion);
      }

      triggerAdminToast(
        "success",
        "Question Updated & Objection Resolved",
        `Question ${qId.slice(0, 8)} saved successfully${cloudResult.cloudSynced ? " to Supabase Cloud" : " locally"}.`,
        { category: "Question Bank", itemName: `QID: ${qId.slice(0, 8)}` }
      );

      onClose();
    } catch (err: any) {
      console.error("[QuestionEditorModal] Save failed:", err);
      alert("Failed to save question: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const optionLetters = ["A", "B", "C", "D", "E"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B132B] w-full max-w-3xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Full Question Editor & Doubt Resolution
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Authoritative Bank
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {report ? `Resolving Student Objection: QID ${report.questionId.slice(0, 8)}` : `Editing Question`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-500" />
              <p className="text-xs font-bold text-slate-500">
                Fetching authentic question details from storage and Supabase...
              </p>
            </div>
          ) : (
            <>
              {/* Student Report Context (if launched from a report) */}
              {report && (
                <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      Reported Issue: {report.issueType.replace("_", " ").toUpperCase()}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      By {report.studentName || "Student"} • {new Date(report.reportedAt).toLocaleDateString("hi-IN")}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-amber-500/10 italic">
                    "{report.studentComment}"
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Question Content (प्रश्न एवं विकल्प)
                </span>
                <button
                  type="button"
                  onClick={handleCleanText}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-slate-700 dark:text-slate-300 hover:text-amber-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Clean Spaces & Formatting</span>
                </button>
              </div>

              {formatSuccessMsg && (
                <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formatSuccessMsg}</span>
                </div>
              )}

              {/* 1. Question Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Question Text (हिंदी / English) *
                </label>
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter authentic question text..."
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 leading-relaxed font-hindi"
                />
              </div>

              {/* 2. Options A - E */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Options (Select radio for Correct Answer Key) *
                  </label>
                  <button
                    type="button"
                    onClick={handleToggleOptionE}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                      options.length >= 5
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {options.length >= 5 ? <Trash2 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    <span>{options.length >= 5 ? "Remove Option E" : "Add Option E (अनुत्तरित प्रश्न)"}</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {options.map((opt, idx) => {
                    const letter = optionLetters[idx] || String.fromCharCode(65 + idx);
                    const isCorrect = correctIndex === idx;

                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl border transition-all ${
                          isCorrect
                            ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-950/20 ring-1 ring-emerald-500"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setCorrectIndex(idx)}
                          className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                            isCorrect
                              ? "bg-emerald-500 text-white shadow-xs"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                          }`}
                          title={`Mark Option ${letter} as Correct`}
                        >
                          {isCorrect ? <Check className="w-4 h-4" /> : letter}
                        </button>

                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Option ${letter} text...`}
                          className="flex-1 bg-transparent border-none text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden font-hindi"
                        />

                        {isCorrect && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shrink-0">
                            Correct Key
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Explanation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Detailed Solution & Explanation (विस्तृत हल व व्याख्या) *
                </label>
                <textarea
                  rows={3}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Comprehensive explanation with references and authentic facts..."
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 leading-relaxed font-hindi"
                />
              </div>

              {/* 4. Important Facts */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  <span>Important Exam Facts (परीक्षा उपयोगी विशेष तथ्य)</span>
                </label>
                <input
                  type="text"
                  value={importantFact}
                  onChange={(e) => setImportantFact(e.target.value)}
                  placeholder="Key summary bullet or highlight fact..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-hindi"
                />
              </div>

              {/* 5. Curriculum Hierarchy Selectors (Subject, Chapter, Topic) */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Curriculum Classification (विषय, अध्याय व टॉपिक)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Subject</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => {
                        setSelectedSubjectId(e.target.value);
                        setSelectedChapterId("");
                        setSelectedTopicId("");
                      }}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                    >
                      <option value="">-- Select Subject --</option>
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.title || sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Chapter</label>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => {
                        setSelectedChapterId(e.target.value);
                        setSelectedTopicId("");
                      }}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                    >
                      <option value="">-- Select Chapter --</option>
                      {availableChapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.title || ch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Topic</label>
                    <select
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                    >
                      <option value="">-- Select Topic --</option>
                      {availableTopics.map((top) => (
                        <option key={top.id} value={top.id}>
                          {top.title || top.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 6. Metadata: Exam, Year, Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Target Exam</label>
                  <input
                    type="text"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="e.g. RAS, CET, Patwar"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Exam Year</label>
                  <input
                    type="text"
                    value={examYear}
                    onChange={(e) => setExamYear(e.target.value)}
                    placeholder="e.g. 2024"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Difficulty Level</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="easy">Easy (सरल)</option>
                    <option value="medium">Medium (मध्यम)</option>
                    <option value="hard">Hard (कठिन)</option>
                  </select>
                </div>
              </div>

              {/* 7. Admin Resolution Note & Student Notification */}
              {report && (
                <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-emerald-800 dark:text-emerald-300">
                      Resolution Note & Student Feedback
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyStudent}
                        onChange={(e) => setNotifyStudent(e.target.checked)}
                        className="rounded-md text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <Bell className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Notify Student ({report.studentName || "Aspirant"})</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Explanation note for student and audit record..."
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/20 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 transition-all"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{report ? "Save Question & Resolve Objection" : "Save Question to Cloud"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
