import React, { useState, useMemo } from "react";
import {
  X,
  Search,
  Map,
  Layers,
  Sparkles,
  Filter,
  Flame,
  ListFilter,
  Check,
  ChevronRight,
  ChevronLeft,
  Swords,
  Crown,
} from "lucide-react";
import { DivisionId, DistrictInfo } from "./types";
import { RAJASTHAN_DIVISIONS, RAJASTHAN_DIVISIONS_LIST } from "./data/divisionsData";
import { RAJASTHAN_50_DISTRICTS, RAJASTHAN_DISTRICTS_LIST, searchDistrictsByQuery } from "./data/districtsData";
import { RajasthanSvgMap } from "./map/RajasthanSvgMap";
import { DistrictDetailSheet } from "./components/DistrictDetailSheet";
import { MapQuizRunner } from "./components/MapQuizRunner";
import { DistrictWarModal } from "../district-war/DistrictWarModal";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

interface RajasthanMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "explorer" | "quiz" | "war";
  initialDistrictId?: string | null;
}

export const RajasthanMapModal: React.FC<RajasthanMapModalProps> = ({
  isOpen,
  onClose,
  initialMode = "explorer",
  initialDistrictId = null,
}) => {
  const [activeMode, setActiveMode] = useState<"explorer" | "quiz" | "war">(initialMode);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(initialDistrictId);
  const [activeDivisionFilter, setActiveDivisionFilter] = useState<DivisionId | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showDistrictListSheet, setShowDistrictListSheet] = useState<boolean>(false);
  const [showDistrictWarModal, setShowDistrictWarModal] = useState<boolean>(false);

  // Quiz Mode state
  const [quizTargetDistrictId, setQuizTargetDistrictId] = useState<string | null>(null);
  const [selectedDistrictFromMap, setSelectedDistrictFromMap] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<{
    selectedDistrictId: string;
    isCorrect: boolean;
  } | null>(null);

  // Filtered and Searched districts
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      if (activeDivisionFilter) {
        return RAJASTHAN_DISTRICTS_LIST.filter((d) => d.divisionId === activeDivisionFilter);
      }
      return RAJASTHAN_DISTRICTS_LIST;
    }
    const queried = searchDistrictsByQuery(searchQuery);
    if (activeDivisionFilter) {
      return queried.filter((d) => d.divisionId === activeDivisionFilter);
    }
    return queried;
  }, [searchQuery, activeDivisionFilter]);

  const searchHighlightedIds = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchResults.map((d) => d.id);
  }, [searchQuery, searchResults]);

  if (!isOpen) return null;

  const selectedDistrictData: DistrictInfo | null = selectedDistrictId
    ? RAJASTHAN_50_DISTRICTS[selectedDistrictId] || null
    : null;

  const handleSelectDistrict = (districtId: string) => {
    if (activeMode === "quiz") {
      setSelectedDistrictFromMap(districtId);
    } else {
      triggerHaptic("light");
      playClickSound();
      setSelectedDistrictId(districtId);
      setShowDistrictListSheet(false);
    }
  };

  const handleSwitchMode = (mode: "explorer" | "quiz" | "war") => {
    triggerHaptic("medium");
    playClickSound();
    setActiveMode(mode);
    setSelectedDistrictId(null);
    setSelectedDistrictFromMap(null);
    setQuizFeedback(null);
    setShowDistrictListSheet(false);
  };

  const handleClearFilters = () => {
    triggerHaptic("light");
    setActiveDivisionFilter(null);
    setSearchQuery("");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rajasthan-map-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-3 overflow-hidden animate-in fade-in duration-150"
    >
      <div className="relative w-full h-[100dvh] sm:max-w-6xl sm:h-[94vh] bg-[#FFF9EF] dark:bg-[#12141C] text-[#171923] dark:text-[#FFF9EF] rounded-none sm:rounded-2xl border-0 sm:border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl flex flex-col overflow-hidden">
        
        {/* ================= COMPACT MOBILE-FIRST HEADER ================= */}
        <header className="shrink-0 bg-white dark:bg-[#181B26] border-b border-[#E8D9C0] dark:border-[#2D3345] px-2.5 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2 shadow-xs z-30">
          {/* Left: Back/Close + Title */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                playClickSound();
                onClose();
              }}
              aria-label="Back / Close"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#800020]/10 dark:bg-[#800020]/30 hover:bg-[#800020]/20 text-[#800020] dark:text-[#F47B20] flex items-center justify-center transition active:scale-90 cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2
                  id="rajasthan-map-title"
                  className="text-xs sm:text-base font-black text-[#800020] dark:text-[#F47B20] tracking-tight truncate leading-tight"
                >
                  राजस्थान 50 ज़िला मानचित्र
                </h2>
                <span className="hidden xs:inline-block px-1.5 py-0.2 rounded-full bg-[#F47B20]/15 text-[#C85A0A] dark:text-[#F47B20] text-[9px] font-black uppercase">
                  2026 अद्यतित
                </span>
              </div>
              <p className="text-[10px] text-[#52576A] dark:text-[#929AB0] font-medium truncate hidden sm:block">
                10 संभाग • 50 ज़िले • राम लुभाया समिति पुनर्गठन (नवीनतम भौगोलिक स्वरूप)
              </p>
            </div>
          </div>

          {/* Right: Mode Switcher & Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mode Segmented Control */}
            <div className="inline-flex rounded-xl bg-[#FFF9EF] dark:bg-[#12141C] p-0.5 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
              <button
                type="button"
                onClick={() => handleSwitchMode("explorer")}
                className={`px-2 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                  activeMode === "explorer"
                    ? "bg-[#800020] text-white shadow-xs"
                    : "text-[#52576A] dark:text-[#929AB0] hover:text-[#171923]"
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>🗺️ खोज</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode("quiz")}
                className={`px-2 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                  activeMode === "quiz"
                    ? "bg-[#F47B20] text-white shadow-xs"
                    : "text-[#52576A] dark:text-[#929AB0] hover:text-[#171923]"
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>🎯 क्विज़</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode("war")}
                className={`px-2 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                  activeMode === "war"
                    ? "bg-gradient-to-r from-[#800020] to-[#F47B20] text-white shadow-xs"
                    : "text-[#52576A] dark:text-[#929AB0] hover:text-[#171923]"
                }`}
              >
                <Swords className="w-3 h-3" />
                <span>⚔️ महासंग्राम</span>
              </button>
            </div>

            {/* Close Button (Desktop) */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="hidden sm:flex w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-[#52576A] dark:text-[#929AB0] items-center justify-center transition active:scale-95 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ================= WAR MODE TOP BANNER ================= */}
        {activeMode === "war" && (
          <div className="shrink-0 bg-gradient-to-r from-[#800020] via-[#5C0318] to-[#D97706] text-white px-3 sm:px-5 py-2 flex items-center justify-between gap-2 shadow-xs z-20">
            <div className="flex items-center gap-2 truncate">
              <Crown className="w-4 h-4 text-amber-300 shrink-0 animate-bounce" />
              <span className="text-xs sm:text-sm font-black truncate">
                ज़िला महासंग्राम लाइव स्थिति • शीर्ष ज़िले एवं राज्य रैंक मानचित्र पर देखें
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowDistrictWarModal(true)}
              className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-black text-[10px] sm:text-xs shrink-0 cursor-pointer active:scale-95 transition flex items-center gap-1"
            >
              <span>लीडरबोर्ड 🏆</span>
            </button>
          </div>
        )}

        {/* ================= SECONDARY TOOLBAR: SEARCH & DIVISION PILLS ================= */}
        {activeMode === "explorer" && (
          <div className="shrink-0 bg-white/95 dark:bg-[#181B26]/95 border-b border-[#E8D9C0] dark:border-[#2D3345] px-2.5 sm:px-5 py-2 flex flex-col gap-1.5 z-20">
            {/* Search Input Row + District Quick List Button */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ज़िला, खनिज (जिप्सम, तांबा, लिग्नाइट), किला या नदी खोजें..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-[#FFF9EF] dark:bg-[#12141C] border border-[#E8D9C0] dark:border-[#31374A] focus:outline-hidden focus:border-[#800020] dark:focus:border-[#F47B20] text-[#171923] dark:text-[#FFF9EF] placeholder-[#929AB0]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile District List Button */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setShowDistrictListSheet(true);
                }}
                title="सभी 50 ज़िलों की सूची"
                className="px-2.5 py-1.5 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 hover:bg-[#800020]/20 text-[#800020] dark:text-[#F47B20] border border-[#800020]/25 dark:border-[#F47B20]/25 text-xs font-black flex items-center gap-1 shrink-0 active:scale-95 transition cursor-pointer"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">ज़िला सूची</span>
                <span className="text-[10px] opacity-75 font-mono">({searchResults.length})</span>
              </button>

              {/* Reset filter button */}
              {(activeDivisionFilter || searchQuery) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-[10px] sm:text-xs font-black text-[#800020] dark:text-[#F47B20] hover:underline px-1 py-1 shrink-0"
                >
                  फ़िल्टर हटाएं
                </button>
              )}
            </div>

            {/* Division Filter Pills Horizontal Touch-Scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs touch-pan-x">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setActiveDivisionFilter(null);
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all shrink-0 cursor-pointer ${
                  activeDivisionFilter === null
                    ? "bg-[#800020] text-white shadow-xs"
                    : "bg-[#FFF9EF] dark:bg-[#12141C] border border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#929AB0]"
                }`}
              >
                सभी (50)
              </button>

              {RAJASTHAN_DIVISIONS_LIST.map((div) => {
                const isActive = activeDivisionFilter === div.id;
                const districtCount = div.districtIds.length;
                return (
                  <button
                    key={div.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setActiveDivisionFilter(isActive ? null : div.id);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? "bg-[#800020] text-white border-[#800020] shadow-xs"
                        : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF] hover:border-[#800020]/40"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: div.color }}
                    />
                    <span>{div.nameHindi.replace(" संभाग", "")}</span>
                    <span className="text-[10px] font-mono opacity-80">({districtCount})</span>
                    {div.isNew && (
                      <span className="px-1 py-0.2 rounded-xs bg-[#F47B20] text-white text-[7px] font-black uppercase">
                        नया
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= MAIN INTERACTIVE MAP & QUIZ CONTAINER ================= */}
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
          {activeMode === "quiz" ? (
            /* QUIZ MODE */
            <div className="h-full flex flex-col overflow-hidden">
              {/* Compact Quiz Bar on Top */}
              <div className="shrink-0 p-2 sm:p-3 bg-white/95 dark:bg-[#181B26]/95 border-b border-[#E8D9C0] dark:border-[#31374A] z-10 shadow-xs">
                <MapQuizRunner
                  onSelectTargetForMap={(districtId) => setQuizTargetDistrictId(districtId)}
                  onQuizFeedback={(fb) => setQuizFeedback(fb)}
                  selectedDistrictFromMap={selectedDistrictFromMap}
                  onExitQuiz={() => handleSwitchMode("explorer")}
                />
              </div>

              {/* Map Canvas taking remaining space */}
              <div className="flex-1 min-h-0 relative bg-[#FFF9EF] dark:bg-[#12141C]">
                <RajasthanSvgMap
                  selectedDistrictId={null}
                  onSelectDistrict={handleSelectDistrict}
                  activeDivisionFilter={null}
                  searchHighlightedIds={[]}
                  quizTargetDistrictId={quizTargetDistrictId}
                  isQuizMode={true}
                  quizFeedback={quizFeedback}
                />
              </div>
            </div>
          ) : (
            /* EXPLORER MODE */
            <div className="h-full flex flex-col relative overflow-hidden">
              {/* Quick tip pill */}
              <div className="shrink-0 px-2.5 py-1 bg-[#800020]/5 dark:bg-[#800020]/20 border-b border-[#800020]/10 flex items-center justify-between text-[10px] text-[#800020] dark:text-[#F47B20] font-medium z-10">
                <div className="flex items-center gap-1 truncate">
                  <Sparkles className="w-3 h-3 shrink-0 text-[#F47B20]" />
                  <span className="truncate">
                    किसी भी ज़िले पर टैप करें — इतिहास, 2023 पुनर्गठन, कला-संस्कृति, भूगोल व PYQs पढ़ें!
                  </span>
                </div>
                <span className="hidden xs:inline-block shrink-0 pl-1 font-bold">
                  पिंच या बटन से ज़ूम करें
                </span>
              </div>

              {/* Svg Map Container */}
              <div className="flex-1 min-h-0 relative bg-[#FFF9EF] dark:bg-[#12141C]">
                <RajasthanSvgMap
                  selectedDistrictId={selectedDistrictId}
                  onSelectDistrict={handleSelectDistrict}
                  activeDivisionFilter={activeDivisionFilter}
                  searchHighlightedIds={searchHighlightedIds}
                  isQuizMode={false}
                  isWarMode={activeMode === "war"}
                />
              </div>

              {/* District Detail Sheet Modal */}
              {selectedDistrictData && (
                <DistrictDetailSheet
                  district={selectedDistrictData}
                  onClose={() => setSelectedDistrictId(null)}
                  onStartDistrictPractice={() => handleSwitchMode("quiz")}
                />
              )}
            </div>
          )}
        </div>

        {/* ================= MOBILE QUICK DISTRICT LIST DRAWER ================= */}
        {showDistrictListSheet && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in"
            onClick={() => setShowDistrictListSheet(false)}
          >
            <div
              className="w-full sm:max-w-md max-h-[78vh] bg-[#FFF9EF] dark:bg-[#181B26] rounded-t-3xl border-t border-[#C99A45]/40 shadow-2xl flex flex-col overflow-hidden text-[#171923] dark:text-[#FFF9EF]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Handle & Header */}
              <div className="p-3 bg-gradient-to-r from-[#800020] to-[#5E0017] text-white shrink-0">
                <div className="w-12 h-1 bg-white/40 rounded-full mx-auto mb-2" />
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-sm">राजस्थान 50 ज़िला सूची (All 50 Districts)</h3>
                    <p className="text-[10px] text-[#FFF9EF]/80">
                      मानचित्र पर देखने व अध्ययन हेतु किसी भी ज़िले पर टैप करें
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDistrictListSheet(false)}
                    className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Districts List Items */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 overscroll-contain no-scrollbar">
                {searchResults.map((d) => {
                  const div = RAJASTHAN_DIVISIONS[d.divisionId];
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleSelectDistrict(d.id)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] flex items-center justify-between text-left transition active:scale-98 cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: div?.color || "#800020" }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs truncate text-[#171923] dark:text-[#FFF9EF]">{d.nameHindi}</span>
                            <span className="text-[10px] text-stone-400 font-normal truncate hidden xs:inline">({d.nameEnglish})</span>
                            {d.isNewDistrict && (
                              <span className="px-1.5 py-0.1 text-[8px] font-black bg-[#F47B20] text-white rounded-xs">
                                2023 नया ज़िला
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#52576A] dark:text-[#929AB0] truncate">
                            {div?.nameHindi || "—"} • {d.tagline}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] font-black text-[#C99A45] shrink-0 ml-1">
                        <span className="hidden xs:inline">देखें</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* District War Leaderboard Modal */}
        {showDistrictWarModal && (
          <DistrictWarModal
            isOpen={showDistrictWarModal}
            onClose={() => setShowDistrictWarModal(false)}
          />
        )}
      </div>
    </div>
  );
};
