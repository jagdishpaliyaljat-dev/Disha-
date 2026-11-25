import React, { useState, useMemo } from "react";
import {
  X,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Shuffle,
  Check,
  BookOpen,
} from "lucide-react";
import type { BattleQuestion } from "./types";
import {
  getUserCustomQuestionsList,
  FALLBACK_BATTLE_QUESTIONS,
  formatToBattleQuestion,
} from "../../utils/realtimeBattleService";
import { getCombinedChapters, getCombinedQuestions } from "../../utils/questionsStorage";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

interface CustomQuestionPickerModalProps {
  isOpen: boolean;
  selectedIds: string[];
  targetCount: number;
  onSave: (selectedIds: string[]) => void;
  onClose: () => void;
}

export const CustomQuestionPickerModal: React.FC<CustomQuestionPickerModalProps> = ({
  isOpen,
  selectedIds: initialSelectedIds,
  targetCount,
  onSave,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [filterSource, setFilterSource] = useState<"all" | "custom" | "curated">("all");

  const customQuestions = useMemo(() => getUserCustomQuestionsList(), []);
  const curatedQuestions = useMemo(() => {
    try {
      const chapters = getCombinedChapters();
      const raw = getCombinedQuestions(chapters);
      if (raw && raw.length > 0) {
        return raw.map((q) => formatToBattleQuestion(q));
      }
    } catch {}
    return FALLBACK_BATTLE_QUESTIONS;
  }, []);

  const allAvailableQuestions = useMemo(() => {
    const combined: (BattleQuestion & { source: "custom" | "curated" })[] = [
      ...customQuestions.map((q) => ({ ...q, source: "custom" as const })),
      ...curatedQuestions.map((q) => ({ ...q, source: "curated" as const })),
    ];
    return combined;
  }, [customQuestions, curatedQuestions]);

  const filteredQuestions = useMemo(() => {
    return allAvailableQuestions.filter((q) => {
      if (filterSource === "custom" && q.source !== "custom") return false;
      if (filterSource === "curated" && q.source !== "curated") return false;

      if (!searchQuery.trim()) return true;
      const lower = searchQuery.toLowerCase();
      return (
        q.text.toLowerCase().includes(lower) ||
        q.options.some((opt) => opt.toLowerCase().includes(lower)) ||
        (q.category && q.category.toLowerCase().includes(lower))
      );
    });
  }, [allAvailableQuestions, filterSource, searchQuery]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    triggerHaptic("light");
    playClickSound();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectRandom = (count: number) => {
    triggerHaptic("medium");
    playClickSound();
    const shuffled = [...filteredQuestions].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, count).map((q) => q.id);
    setSelectedIds(picked);
  };

  const handleSelectAllFiltered = () => {
    triggerHaptic("light");
    playClickSound();
    const ids = filteredQuestions.map((q) => q.id);
    setSelectedIds(ids);
  };

  const handleClearAll = () => {
    triggerHaptic("light");
    playClickSound();
    setSelectedIds([]);
  };

  const handleSave = () => {
    triggerHaptic("medium");
    playClickSound();
    onSave(selectedIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-5 select-none">
      <div className="bg-[#F8FAFC] dark:bg-[#130E26] w-full max-w-2xl h-[90vh] max-h-[720px] rounded-3xl shadow-2xl flex flex-col overflow-hidden border-2 border-amber-300/80 dark:border-amber-500/50">
        {/* Royal Header */}
        <div className="bg-gradient-to-r from-[#5B32BF] via-[#7045D8] to-[#5B32BF] text-white p-4 sm:p-5 flex items-center justify-between shadow-md border-b border-amber-400/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-300/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-wide">
                Select Custom Questions
              </h3>
              <p className="text-xs text-amber-200/90 font-medium">
                Selected: <span className="font-black text-amber-300">{selectedIds.length}</span> questions (Target: {targetCount})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition border border-white/10"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3.5 bg-white dark:bg-[#1B1536] border-b border-stone-200/90 dark:border-[#31275E] space-y-2.5">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions, options or topics..."
              className="w-full pl-10 pr-9 py-2 text-sm bg-stone-50 dark:bg-[#241D48] border border-stone-300 dark:border-[#31275E] rounded-xl text-stone-800 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[#7045D8] dark:focus:ring-amber-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter tabs & Selection helpers */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 bg-stone-100 dark:bg-[#241D48] p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterSource("all")}
                className={`px-3 py-1 rounded-lg transition ${
                  filterSource === "all"
                    ? "bg-white dark:bg-[#1B1536] text-[#7045D8] dark:text-amber-300 shadow-xs font-bold"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                }`}
              >
                All ({allAvailableQuestions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterSource("custom")}
                className={`px-3 py-1 rounded-lg transition ${
                  filterSource === "custom"
                    ? "bg-white dark:bg-[#1B1536] text-[#7045D8] dark:text-amber-300 shadow-xs font-bold"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                }`}
              >
                Custom Questions ({customQuestions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterSource("curated")}
                className={`px-3 py-1 rounded-lg transition ${
                  filterSource === "curated"
                    ? "bg-white dark:bg-[#1B1536] text-[#7045D8] dark:text-amber-300 shadow-xs font-bold"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                }`}
              >
                Rajasthan GK ({curatedQuestions.length})
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleSelectRandom(targetCount)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-950 dark:text-amber-300 font-bold active:scale-95 transition border border-amber-300 dark:border-amber-700/60"
              >
                <Shuffle className="w-3.5 h-3.5 text-[#7045D8] dark:text-amber-400" />
                <span>Random {targetCount}</span>
              </button>
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-[#241D48] hover:bg-stone-200 dark:hover:bg-[#2E3448] text-stone-700 dark:text-stone-300 active:scale-95 transition"
              >
                All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-[#241D48] hover:bg-stone-200 dark:hover:bg-[#2E3448] text-stone-700 dark:text-stone-300 active:scale-95 transition"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-16 text-stone-500 dark:text-stone-400">
              <Sparkles className="w-10 h-10 text-amber-500 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold">No questions found.</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                Please try a different search keyword or select another tab.
              </p>
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isSelected = selectedIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  onClick={() => toggleSelect(q.id)}
                  className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 active:scale-99 ${
                    isSelected
                      ? "bg-amber-50/90 dark:bg-amber-950/40 border-[#7045D8] dark:border-amber-400 ring-1 ring-amber-400/50 dark:ring-amber-400/30 shadow-xs"
                      : "bg-white dark:bg-[#1B1536] border-stone-200/90 dark:border-[#31275E] hover:border-amber-300 dark:hover:border-amber-500/50"
                  }`}
                >
                  <div className="mt-0.5">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-[#7045D8] dark:text-amber-400" />
                    ) : (
                      <Square className="w-5 h-5 text-stone-300 dark:text-stone-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-extrabold text-stone-500 dark:text-stone-400">
                        #{idx + 1}
                      </span>
                      {q.source === "custom" ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                          Custom Question
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60">
                          Rajasthan GK
                        </span>
                      )}
                      {q.category && (
                        <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 capitalize">
                          {q.category}
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm font-bold text-stone-800 dark:text-slate-50 leading-snug">
                      {q.text}
                    </p>

                    <div className="grid grid-cols-2 gap-1 mt-2 text-[11px] text-stone-600 dark:text-stone-300">
                      {q.options.slice(0, 4).map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`truncate px-2 py-0.5 rounded-lg ${
                            oIdx === q.correctIndex
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800/60"
                              : "bg-stone-50 dark:bg-[#241D48]"
                          }`}
                        >
                          {String.fromCharCode(65 + oIdx)}. {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-white dark:bg-[#1B1536] border-t border-stone-200 dark:border-[#31275E] flex items-center justify-between shadow-lg">
          <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
            Selected: <span className="text-[#7045D8] dark:text-amber-400 font-black text-sm">{selectedIds.length}</span> / {targetCount} Questions
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-[#241D48] hover:bg-stone-200 dark:hover:bg-[#2E3448] active:scale-95 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#7045D8] to-[#5B32BF] text-white shadow-md active:scale-95 transition border border-amber-400/40 hover:brightness-110"
            >
              <Check className="w-4 h-4" />
              <span>Save Selection ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
