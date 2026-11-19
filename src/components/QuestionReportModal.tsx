import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Flag,
  AlertTriangle,
  CheckCircle2,
  X,
  Send,
  HelpCircle,
  FileText,
  Sparkles,
  BookOpen,
  Info,
  Check,
  ChevronRight,
} from "lucide-react";
import type { Question, UserProfile } from "../types";
import {
  submitQuestionReport,
  hasStudentReportedQuestion,
  QuestionIssueType,
  ISSUE_TYPE_LABELS,
} from "../utils/questionReportService";
import { triggerHaptic, playClickSound, playCorrectSound } from "../utils/audioFeedback";
import { ParsedQuestion } from "./ParsedQuestion";

export interface QuestionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null;
  userProfile?: UserProfile | null;
  subjectName?: string;
  chapterName?: string;
  topicName?: string;
  onReportSubmitted?: (questionId: string) => void;
}

export const QuestionReportModal: React.FC<QuestionReportModalProps> = ({
  isOpen,
  onClose,
  question,
  userProfile,
  subjectName,
  chapterName,
  topicName,
  onReportSubmitted,
}) => {
  const [selectedIssue, setSelectedIssue] = useState<QuestionIssueType>("wrong_answer");
  const [comment, setComment] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize form state when question changes or modal opens
  useEffect(() => {
    if (isOpen && question) {
      setSelectedIssue("wrong_answer");
      setComment("");
      setErrorMsg(null);
      setSubmitted(false);
      setSubmitting(false);

      if (userProfile) {
        setStudentName(userProfile.displayName || userProfile.name || "");
        setStudentEmail(userProfile.email || "");
      }

      setAlreadyReported(hasStudentReportedQuestion(question.id));
    }
  }, [isOpen, question, userProfile]);

  if (!isOpen || !question) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question) return;

    if (!selectedIssue) {
      setErrorMsg("Please select the type of issue");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    triggerHaptic("warning");

    try {
      const result = await submitQuestionReport({
        questionId: question.id,
        questionText: question.text,
        subjectName: subjectName || question.subjectId,
        chapterName: chapterName || question.chapterId,
        topicName: topicName || question.topicId,
        studentName: studentName || userProfile?.displayName || "Aspirant",
        studentEmail: studentEmail || userProfile?.email || "",
        studentUid: userProfile?.id,
        issueType: selectedIssue,
        studentComment: comment || ISSUE_TYPE_LABELS[selectedIssue].description,
        sourceExam: question.exam || "",
        question,
      });

      if (result.success) {
        setSubmitted(true);
        setAlreadyReported(true);
        playCorrectSound();
        triggerHaptic("success");
        if (onReportSubmitted) {
          onReportSubmitted(question.id);
        }
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setErrorMsg(result.error || "Could not submit report. Please try again.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Network or internal error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const issueOptions: QuestionIssueType[] = [
    "wrong_answer",
    "typo",
    "incomplete_options",
    "wrong_explanation",
    "ambiguous",
    "outdated",
    "other",
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-[#111A2E] w-full max-w-lg rounded-3xl sm:rounded-[32px] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-transparent shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Flag className="w-5 h-5 fill-current" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight truncate">
                  Report Question &amp; Answer Key
                </h3>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                  Report Discrepancy, Typo or Objection
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                playClickSound();
                onClose();
              }}
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-10 text-center space-y-3"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border-2 border-emerald-500/40">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white">
                  Objection Submitted Successfully!
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Thank you! Our subject expert team will review this question and verify the answer key or explanation promptly.
                </p>
              </motion.div>
            ) : (
              <>
                {alreadyReported && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Note:</span>
                      An objection has already been logged for this question. If you have additional facts or references, feel free to add them below.
                    </div>
                  </div>
                )}

                {/* Question Preview Box */}
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                    <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-[#800020]/10 text-[#800020] dark:bg-[#F47B20]/15 dark:text-[#F47B20]">
                      QID: {question.id.slice(0, 8)}
                    </span>
                    {(question.exam || question.year) && (
                      <span className="text-slate-400 font-bold">
                        {question.exam} {question.year}
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-hindi font-bold text-slate-800 dark:text-slate-200 line-clamp-3 leading-relaxed">
                    <ParsedQuestion text={question.text} fontSizeClass="text-xs sm:text-sm" question={question} />
                  </div>
                </div>

                {/* Objection Category Picker */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                    Select Type of Issue / Objection:
                  </label>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {issueOptions.map((type) => {
                      const meta = ISSUE_TYPE_LABELS[type];
                      const isChosen = selectedIssue === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            playClickSound();
                            setSelectedIssue(type);
                          }}
                          className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                            isChosen
                              ? "bg-amber-500/10 border-amber-500 text-amber-950 dark:text-amber-100 ring-2 ring-amber-500/20 shadow-xs"
                              : "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-300 dark:hover:border-amber-700/60"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                              isChosen
                                ? "border-amber-600 bg-amber-600 text-white"
                                : "border-slate-300 dark:border-slate-600"
                            }`}
                          >
                            {isChosen && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black leading-tight flex items-center gap-1.5">
                              <span>{meta.en}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                              {meta.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Student Comment / Explanation */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Your Remarks / Authentic Source (Optional but helpful):
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="e.g. Option (B) should be correct according to Rajasthan Board / Hindi Granth Academy textbook..."
                    rows={3}
                    maxLength={1000}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 placeholder:text-slate-400 resize-none"
                  />
                  <div className="text-right text-[10px] text-slate-400 mt-1">
                    {comment.length}/1000 chars
                  </div>
                </div>

                {/* Optional Student Info */}
                {!userProfile && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Your Name (Optional)"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        placeholder="Email (for resolution notice)"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          {!submitted && (
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  onClose();
                }}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-black text-xs shadow-md shadow-amber-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
export default QuestionReportModal;
