import * as React from "react";
import {
  RotateCcw,
  Trash2,
  X,
  AlertTriangle,
  Search,
  CheckSquare,
  Square,
  Filter,
  Layers,
  ChevronDown,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ArchiveRestore,
  Calendar,
  Sparkles,
  Cloud,
} from "lucide-react";
import { Chapter, Question, Subject, UserQuestionsStore } from "../../types";
import { getChapterDisplayName, getTopicDisplayName } from "../../utils/curriculumUtils";
import { triggerAdminToast } from "../../utils/adminToast";
import {
  restoreQuestionsFromRecycleBin,
  permanentDeleteQuestionsFromRecycleBin,
  emptyRecycleBin,
  saveUserQuestionsStore,
  loadUserQuestionsStore,
  getRecycleBinQuestions,
  dispatchStoreUpdated,
} from "../../utils/questionsStorage";
import { isSupabaseConfigured } from "../../lib/supabase";
import { InlineSpinner } from "../ui/LoadingScreen";

interface QuestionRecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects?: Subject[];
  chapters?: Chapter[];
  questionsStore: UserQuestionsStore;
  onStoreUpdated?: (updatedStore: UserQuestionsStore) => void;
}

export const QuestionRecycleBinModal: React.FC<QuestionRecycleBinModalProps> = ({
  isOpen,
  onClose,
  subjects = [],
  chapters = [],
  questionsStore,
  onStoreUpdated,
}) => {
  // Local store state synced with prop
  const [store, setStore] = React.useState<UserQuestionsStore>(questionsStore || loadUserQuestionsStore());

  React.useEffect(() => {
    if (questionsStore) {
      setStore(questionsStore);
    }
  }, [questionsStore]);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("ALL");
  const [selectedChapterId, setSelectedChapterId] = React.useState<string>("ALL");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Confirm modals
  const [confirmAction, setConfirmAction] = React.useState<"restore" | "permanent_delete" | "empty_all" | null>(null);
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [isFetchingCloud, setIsFetchingCloud] = React.useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const itemsPerPage = 15;

  const recycleBinQuestions = React.useMemo(() => {
    return getRecycleBinQuestions(store);
  }, [store]);

  // Fetch soft-deleted questions from Supabase
  const handleFetchCloudRecycleBin = async () => {
    if (!isSupabaseConfigured() || isFetchingCloud) return;
    setIsFetchingCloud(true);
    try {
      const { fetchRecycleBinQuestionsFromSupabase } = await import("../../utils/supabaseSyncService");
      const cloudDeleted = await fetchRecycleBinQuestionsFromSupabase();
      if (cloudDeleted.length > 0) {
        const currentIds = new Set((store.recycleBinQuestions || []).map((q) => q.id));
        const newItems = cloudDeleted.filter((q) => !currentIds.has(q.id));
        if (newItems.length > 0) {
          const nextStore: UserQuestionsStore = {
            ...store,
            recycleBinQuestions: [...(store.recycleBinQuestions || []), ...newItems],
            deletedQuestionIds: Array.from(new Set([...(store.deletedQuestionIds || []), ...newItems.map((q) => q.id)])),
          };
          saveUserQuestionsStore(nextStore);
          setStore(nextStore);
          dispatchStoreUpdated({ store: nextStore });
          if (onStoreUpdated) onStoreUpdated(nextStore);
          triggerAdminToast(
            "success",
            "Cloud Sync Complete",
            `${newItems.length} soft-deleted question(s) retrieved from Supabase!`
          );
        } else {
          triggerAdminToast("info", "Cloud Sync", "Recycle bin is already up to date with Supabase.");
        }
      } else {
        triggerAdminToast("info", "Cloud Sync", "No soft-deleted questions found in Supabase.");
      }
    } catch (err: any) {
      triggerAdminToast("error", "Sync Error", err?.message || "Failed to fetch cloud recycle bin");
    } finally {
      setIsFetchingCloud(false);
    }
  };

  // Filtered list
  const filteredQuestions = React.useMemo(() => {
    let result = recycleBinQuestions;

    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase().trim();
      result = result.filter(
        (q) =>
          (q.text && q.text.toLowerCase().includes(qLower)) ||
          (q.id && q.id.toLowerCase().includes(qLower)) ||
          (q.explanation && q.explanation.toLowerCase().includes(qLower)) ||
          (q.options && q.options.some((opt) => opt.toLowerCase().includes(qLower)))
      );
    }

    if (selectedSubjectId !== "ALL") {
      result = result.filter((q) => q.subjectId === selectedSubjectId);
    }

    if (selectedChapterId !== "ALL") {
      result = result.filter((q) => q.chapterId === selectedChapterId);
    }

    return result;
  }, [recycleBinQuestions, searchQuery, selectedSubjectId, selectedChapterId]);

  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage) || 1;
  const paginatedQuestions = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredQuestions.slice(start, start + itemsPerPage);
  }, [filteredQuestions, currentPage]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAllPage = () => {
    const allPageSelected = paginatedQuestions.every((q) => selectedIds.has(q.id));
    const next = new Set(selectedIds);
    if (allPageSelected) {
      paginatedQuestions.forEach((q) => next.delete(q.id));
    } else {
      paginatedQuestions.forEach((q) => next.add(q.id));
    }
    setSelectedIds(next);
  };

  const handleRestoreSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      const idsArray = Array.from(selectedIds);
      const { nextStore, restoredQuestions } = restoreQuestionsFromRecycleBin(store, idsArray);
      saveUserQuestionsStore(nextStore);
      setStore(nextStore);
      dispatchStoreUpdated({ store: nextStore });
      if (onStoreUpdated) onStoreUpdated(nextStore);

      // Cloud restore sync
      if (isSupabaseConfigured()) {
        try {
          const { restoreQuestionsBulkFromSupabase } = await import("../../utils/supabaseSyncService");
          await restoreQuestionsBulkFromSupabase(idsArray);
        } catch (cloudErr) {
          console.warn("[RecycleBin] Cloud restore sync note:", cloudErr);
        }
      }

      triggerAdminToast(
        "success",
        "प्रश्न रीस्टोर किए गए",
        `सफलतापूर्वक ${restoredQuestions.length} प्रश्न रीस्टोर कर दिए गए!`
      );
      setSelectedIds(new Set());
      setConfirmAction(null);
    } catch (err: any) {
      triggerAdminToast("error", "रीस्टोर त्रुटि", `रीस्टोर करने में त्रुटि: ${err?.message || "अज्ञात"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      const idsArray = Array.from(selectedIds);
      const nextStore = permanentDeleteQuestionsFromRecycleBin(store, idsArray);
      saveUserQuestionsStore(nextStore);
      setStore(nextStore);
      dispatchStoreUpdated({ store: nextStore });
      if (onStoreUpdated) onStoreUpdated(nextStore);

      // Cloud permanent delete sync
      if (isSupabaseConfigured()) {
        try {
          const { permanentDeleteQuestionsBulkFromSupabase } = await import("../../utils/supabaseSyncService");
          await permanentDeleteQuestionsBulkFromSupabase(idsArray);
        } catch (cloudErr) {
          console.warn("[RecycleBin] Cloud permanent delete note:", cloudErr);
        }
      }

      triggerAdminToast(
        "delete",
        "प्रश्न स्थायी रूप से हटाए गए",
        `सफलतापूर्वक ${idsArray.length} प्रश्न हमेशा के लिए हटा दिए गए।`
      );
      setSelectedIds(new Set());
      setConfirmAction(null);
    } catch (err: any) {
      triggerAdminToast("error", "डिलीट त्रुटि", `डिलीट करने में त्रुटि: ${err?.message || "अज्ञात"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyRecycleBin = async () => {
    setIsProcessing(true);
    try {
      const allIds = (store.recycleBinQuestions || []).map((q) => q.id);
      const nextStore = emptyRecycleBin(store);
      saveUserQuestionsStore(nextStore);
      setStore(nextStore);
      dispatchStoreUpdated({ store: nextStore });
      if (onStoreUpdated) onStoreUpdated(nextStore);

      // Cloud empty sync
      if (isSupabaseConfigured() && allIds.length > 0) {
        try {
          const { permanentDeleteQuestionsBulkFromSupabase } = await import("../../utils/supabaseSyncService");
          await permanentDeleteQuestionsBulkFromSupabase(allIds);
        } catch (cloudErr) {
          console.warn("[RecycleBin] Cloud empty bin note:", cloudErr);
        }
      }

      triggerAdminToast("info", "रीसायकल बिन खाली", "रीसायकल बिन पूर्ण रूप से खाली कर दिया गया।");
      setSelectedIds(new Set());
      setConfirmAction(null);
    } catch (err: any) {
      triggerAdminToast("error", "खाली करने में त्रुटि", `त्रुटि: ${err?.message || "अज्ञात"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ArchiveRestore className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">
                  Question Recycle Bin (क्वेश्चन रीसायकल बिन)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {recycleBinQuestions.length} हटाये गये प्रश्न
                </span>
              </div>
              <p className="text-xs text-slate-400">
                गलती से हटाए गए प्रश्नों को एक-क्लिक में रीस्टोर करें या सुरक्षित रूप से हमेशा के लिए हटाएं।
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSupabaseConfigured() && (
              <button
                onClick={handleFetchCloudRecycleBin}
                disabled={isFetchingCloud || isProcessing}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Fetch soft-deleted questions from Supabase"
              >
                <Cloud className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Fetch Cloud</span>
                {isFetchingCloud && <Loader2 className="w-3 h-3 animate-spin text-sky-400" />}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="प्रश्न, आईडी, विकल्प या व्याख्या खोजें..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Subject Filter */}
            {subjects && subjects.length > 0 && (
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  setSelectedChapterId("ALL");
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
              >
                <option value="ALL">सभी विषय (All Subjects)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.hindiName}
                  </option>
                ))}
              </select>
            )}

            {/* Quick Actions for Selected */}
            <div className="flex items-center gap-2">
              <button
                disabled={selectedIds.size === 0 || isProcessing}
                onClick={() => setConfirmAction("restore")}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>चयनित रीस्टोर करें ({selectedIds.size})</span>
              </button>

              <button
                disabled={selectedIds.size === 0 || isProcessing}
                onClick={() => setConfirmAction("permanent_delete")}
                className="px-3.5 py-2 bg-rose-600/80 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>स्थायी हटाएं ({selectedIds.size})</span>
              </button>

              {recycleBinQuestions.length > 0 && (
                <button
                  disabled={isProcessing}
                  onClick={() => setConfirmAction("empty_all")}
                  className="px-3 py-2 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title="रीसायकल बिन खाली करें"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>बिन खाली करें</span>
                </button>
              )}
            </div>
          </div>

          {/* Select all & Stats Bar */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <button
              onClick={toggleSelectAllPage}
              className="flex items-center gap-2 hover:text-slate-200 cursor-pointer font-medium"
            >
              {paginatedQuestions.length > 0 &&
              paginatedQuestions.every((q) => selectedIds.has(q.id)) ? (
                <CheckSquare className="w-4 h-4 text-amber-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
              <span>इस पेज के सभी चुनें ({paginatedQuestions.length})</span>
            </button>
            <span>
              कुल परिणाम: {filteredQuestions.length} प्रश्न | चयनित: {selectedIds.size}
            </span>
          </div>
        </div>

        {/* Question List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredQuestions.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center">
              <ArchiveRestore className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-base font-semibold text-slate-400">
                रीसायकल बिन में कोई प्रश्न नहीं है!
              </p>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                जब भी कोई प्रश्न हटाया जाता है, वह यहाँ सुरक्षित संग्रहीत होता है ताकि आवश्यकता पड़ने पर उसे तुरंत वापस लाया जा सके।
              </p>
            </div>
          ) : (
            paginatedQuestions.map((q) => {
              const isSelected = selectedIds.has(q.id);
              const deletedDate = q.deletedAt || q.deleted_at;

              return (
                <div
                  key={q.id}
                  onClick={() => toggleSelect(q.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-950/20 border-amber-500/50 shadow-xs"
                      : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleSelect(q.id)}
                          className="text-slate-400 hover:text-amber-400 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-900 rounded border border-slate-700/80 text-amber-300">
                            #{q.id}
                          </span>
                          {deletedDate && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              हटाया गया: {new Date(deletedDate).toLocaleString("hi-IN")}
                            </span>
                          )}
                          {q.chapterTitle && (
                            <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                              {q.chapterTitle}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-200 line-clamp-2">
                          {q.text}
                        </p>

                        {/* Options preview */}
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs">
                            {q.options.map((opt, idx) => (
                              <div
                                key={idx}
                                className={`px-2 py-1 rounded text-slate-400 ${
                                  idx === (q.correctIndex ?? (q as any).correct_answer)
                                    ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-semibold"
                                    : "bg-slate-900/40"
                                }`}
                              >
                                <span className="font-mono mr-1.5 text-slate-500">
                                  {String.fromCharCode(65 + idx)}.
                                </span>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Single-click restore action */}
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        title="तुरंत रीस्टोर करें"
                        onClick={async () => {
                          const { nextStore, restoredQuestions } = restoreQuestionsFromRecycleBin(store, [q.id]);
                          saveUserQuestionsStore(nextStore);
                          setStore(nextStore);
                          dispatchStoreUpdated({ store: nextStore });
                          if (onStoreUpdated) onStoreUpdated(nextStore);
                          if (isSupabaseConfigured()) {
                            import("../../utils/supabaseSyncService").then(({ restoreQuestionFromSupabase }) => {
                              restoreQuestionFromSupabase(q.id).catch(() => {});
                            });
                          }
                          triggerAdminToast(
                            "success",
                            "प्रश्न रीस्टोर किया गया",
                            `प्रश्न #${q.id} सफलतापूर्वक रीस्टोर कर दिया गया।`
                          );
                        }}
                        className="p-1.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-400 rounded-lg transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <button
                        title="हमेशा के लिए हटाएं"
                        onClick={() => {
                          setSelectedIds(new Set([q.id]));
                          setConfirmAction("permanent_delete");
                        }}
                        className="p-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-500/30 text-rose-400 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with pagination */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            पेज {currentPage} का {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-slate-300 rounded-lg cursor-pointer"
            >
              पिछला
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-slate-300 rounded-lg cursor-pointer"
            >
              अगला
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div
                className={`p-3 rounded-xl ${
                  confirmAction === "restore"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}
              >
                {confirmAction === "restore" ? (
                  <RotateCcw className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100">
                  {confirmAction === "restore"
                    ? "प्रश्नों को रीस्टोर करें?"
                    : confirmAction === "empty_all"
                    ? "पूरा रीसायकल बिन खाली करें?"
                    : "हमेशा के लिए हटाएं?"}
                </h3>
                <p className="text-xs text-slate-400">
                  {confirmAction === "restore"
                    ? `क्या आप चयनित ${selectedIds.size} प्रश्नों को वापस लाइव प्रश्न बैंक में रीस्टोर करना चाहते हैं?`
                    : confirmAction === "empty_all"
                    ? `सावधानी: यह रीसायकल बिन के सभी ${recycleBinQuestions.length} प्रश्नों को हमेशा के लिए नष्ट कर देगा। यह क्रिया वापस नहीं ली जा सकेगी।`
                    : `सावधानी: चयनित ${selectedIds.size} प्रश्न डेटाबेस से स्थायी रूप से डिलीट हो जाएंगे।`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                disabled={isProcessing}
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                रद्द करें
              </button>
              <button
                disabled={isProcessing}
                onClick={() => {
                  if (confirmAction === "restore") handleRestoreSelected();
                  else if (confirmAction === "empty_all") handleEmptyRecycleBin();
                  else handlePermanentDeleteSelected();
                }}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
                  confirmAction === "restore"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-rose-600 hover:bg-rose-500"
                }`}
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {confirmAction === "restore" ? "पुष्टि करें व रीस्टोर करें" : "पुष्टि करें व हटाएं"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionRecycleBinModal;
