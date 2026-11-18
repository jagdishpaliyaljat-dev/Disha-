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
} from "../../utils/realtimeBattleService";
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
  const curatedQuestions = FALLBACK_BATTLE_QUESTIONS;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5 select-none">
      <div className="bg-[#FFF9EF] w-full max-w-2xl h-[90vh] max-h-[720px] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-amber-900/20">
        {/* Header */}
        <div className="bg-[#800020] text-white p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/15 text-amber-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">कस्टम प्रश्न चयन करें</h3>
              <p className="text-xs text-amber-200">
                चयनित: {selectedIds.length} प्रश्न (लक्ष्य: {targetCount} प्रश्न)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 bg-white border-b border-stone-200 space-y-2.5">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="प्रश्न या विकल्प खोजें..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]"
            />
          </div>

          {/* Quick Filter tabs & Selection helpers */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 bg-stone-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterSource("all")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterSource === "all"
                    ? "bg-white text-[#800020] shadow-xs font-bold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                सभी ({allAvailableQuestions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterSource("custom")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterSource === "custom"
                    ? "bg-white text-[#800020] shadow-xs font-bold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                मेरे कस्टम प्रश्न ({customQuestions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterSource("curated")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterSource === "curated"
                    ? "bg-white text-[#800020] shadow-xs font-bold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                राजस्थान GK ({curatedQuestions.length})
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleSelectRandom(targetCount)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold active:scale-95 transition"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>रैंडम {targetCount}</span>
              </button>
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
              >
                सभी
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
              >
                साफ़
              </button>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12 text-stone-500">
              <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">कोई प्रश्न नहीं मिला।</p>
              <p className="text-xs text-stone-400 mt-1">
                कृपया सर्च कीवर्ड बदलें या अन्य टैब चुनें।
              </p>
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isSelected = selectedIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  onClick={() => toggleSelect(q.id)}
                  className={`p-3 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? "bg-amber-50/80 border-[#800020] shadow-sm"
                      : "bg-white border-stone-200 hover:border-amber-300"
                  }`}
                >
                  <div className="mt-0.5">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-[#800020]" />
                    ) : (
                      <Square className="w-5 h-5 text-stone-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-stone-500">
                        #{idx + 1}
                      </span>
                      {q.source === "custom" ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                          कस्टम प्रश्न
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                          राजस्थान GK
                        </span>
                      )}
                      {q.category && (
                        <span className="text-[10px] font-semibold text-stone-500 capitalize">
                          {q.category}
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm font-bold text-stone-800 leading-snug">
                      {q.text}
                    </p>

                    <div className="grid grid-cols-2 gap-1 mt-2 text-[11px] text-stone-600">
                      {q.options.slice(0, 4).map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`truncate px-2 py-0.5 rounded ${
                            oIdx === q.correctIndex
                              ? "bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200"
                              : "bg-stone-50"
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
        <div className="p-3 bg-white border-t border-stone-200 flex items-center justify-between shadow-lg">
          <div className="text-xs font-semibold text-stone-600">
            चयनित: <span className="text-[#800020] font-bold">{selectedIds.length}</span> प्रश्न
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200"
            >
              रद्द करें
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-[#800020] hover:bg-[#68001a] text-white shadow-md active:scale-95 transition"
            >
              <Check className="w-4 h-4" />
              <span>चयन सहेजें ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
