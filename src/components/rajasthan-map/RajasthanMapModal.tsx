import React, { useState, useMemo } from "react";
import { X, Search, Map, HelpCircle, Layers, Sparkles, Filter, Check, Flame, Trophy, Volume2, Info } from "lucide-react";
import { DivisionId, DistrictInfo } from "./types";
import { RAJASTHAN_DIVISIONS, RAJASTHAN_DIVISIONS_LIST } from "./data/divisionsData";
import { RAJASTHAN_50_DISTRICTS, RAJASTHAN_DISTRICTS_LIST, searchDistrictsByQuery } from "./data/districtsData";
import { RajasthanSvgMap } from "./map/RajasthanSvgMap";
import { DistrictDetailSheet } from "./components/DistrictDetailSheet";
import { MapQuizRunner } from "./components/MapQuizRunner";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

interface RajasthanMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "explorer" | "quiz";
  initialDistrictId?: string | null;
}

export const RajasthanMapModal: React.FC<RajasthanMapModalProps> = ({
  isOpen,
  onClose,
  initialMode = "explorer",
  initialDistrictId = null,
}) => {
  const [activeMode, setActiveMode] = useState<"explorer" | "quiz">(initialMode);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(initialDistrictId);
  const [activeDivisionFilter, setActiveDivisionFilter] = useState<DivisionId | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);

  // Quiz Mode internal communications
  const [quizTargetDistrictId, setQuizTargetDistrictId] = useState<string | null>(null);
  const [selectedDistrictFromMap, setSelectedDistrictFromMap] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<{
    selectedDistrictId: string;
    isCorrect: boolean;
  } | null>(null);

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchDistrictsByQuery(searchQuery);
  }, [searchQuery]);

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
      // In quiz mode, dispatch selection to quiz engine
      setSelectedDistrictFromMap(districtId);
    } else {
      // In explorer mode, open district detail sheet
      triggerHaptic("selection");
      playClickSound();
      setSelectedDistrictId(districtId);
    }
  };

  const handleSwitchMode = (mode: "explorer" | "quiz") => {
    triggerHaptic("medium");
    playClickSound();
    setActiveMode(mode);
    setSelectedDistrictId(null);
    setSelectedDistrictFromMap(null);
    setQuizFeedback(null);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-3 overflow-hidden animate-in fade-in duration-200"
    >
      <div className="relative w-full h-full sm:max-w-6xl sm:h-[94vh] bg-[#FFF9EF] dark:bg-[#12141C] text-[#171923] dark:text-[#FFF9EF] sm:rounded-2xl border-0 sm:border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl flex flex-col overflow-hidden">
        
        {/* ================= HEADER TOOLBAR ================= */}
        <header className="shrink-0 bg-white dark:bg-[#181B26] border-b border-[#E8D9C0] dark:border-[#2D3345] px-3 sm:px-5 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          {/* Title & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#800020] to-[#F47B20] text-white flex items-center justify-center shadow-xs shrink-0">
              <Map className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2
                  id="rajasthan-map-title"
                  className="text-sm sm:text-base font-black text-[#800020] dark:text-[#F47B20] tracking-tight truncate"
                >
                  राजस्थान 50 ज़िला दर्शन व मैप क्विज़
                </h2>
                <span className="px-1.5 py-0.5 rounded-full bg-[#F47B20]/15 text-[#C85A0A] dark:text-[#F47B20] text-[9px] font-black uppercase tracking-wider">
                  नवीनतम 2026
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-[#52576A] dark:text-[#929AB0] font-medium truncate">
                10 संभाग • 50 ज़िले • रामलुभाया कमेटी पुनर्गठन • RPSC व RSMSSB स्पेशल
              </p>
            </div>
          </div>

          {/* Mode Switcher & Close */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="inline-flex rounded-xl bg-[#FFF9EF] dark:bg-[#12141C] p-1 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
              <button
                type="button"
                onClick={() => handleSwitchMode("explorer")}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMode === "explorer"
                    ? "bg-[#800020] text-white shadow-xs"
                    : "text-[#52576A] dark:text-[#929AB0] hover:text-[#171923] dark:hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>🗺️ ज़िला दर्शन</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode("quiz")}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMode === "quiz"
                    ? "bg-[#F47B20] text-white shadow-xs"
                    : "text-[#52576A] dark:text-[#929AB0] hover:text-[#171923] dark:hover:text-white"
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>🎯 मैप क्विज़</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                playClickSound();
                onClose();
              }}
              aria-label="Close Rajasthan Map"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[#52576A] dark:text-[#929AB0] flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </header>

        {/* ================= SECONDARY TOOLBAR: SEARCH & DIVISION FILTERS ================= */}
        {activeMode === "explorer" && (
          <div className="shrink-0 bg-white/90 dark:bg-[#181B26]/90 backdrop-blur-xs border-b border-[#E8D9C0] dark:border-[#2D3345] px-3 sm:px-5 py-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#800020] dark:text-[#F47B20] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ज़िला, खनिज (जिप्सम, तांबा, लिग्नाइट), दुर्ग या नदी खोजें..."
                  className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm rounded-xl bg-[#FFF9EF] dark:bg-[#12141C] border border-[#E8D9C0] dark:border-[#31374A] focus:outline-hidden focus:border-[#800020] dark:focus:border-[#F47B20] text-[#171923] dark:text-[#FFF9EF] placeholder-[#929AB0]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Reset filter button */}
              {(activeDivisionFilter || searchQuery) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-[11px] font-bold text-[#800020] dark:text-[#F47B20] hover:underline px-2 py-1 shrink-0"
                >
                  फिल्टर हटाएं
                </button>
              )}
            </div>

            {/* Division Filter Pills Scrollable */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
              <span className="text-[10px] font-extrabold uppercase text-[#52576A] dark:text-[#929AB0] shrink-0 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> संभाग:
              </span>
              
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setActiveDivisionFilter(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all shrink-0 cursor-pointer ${
                  activeDivisionFilter === null
                    ? "bg-[#800020] text-white shadow-xs"
                    : "bg-[#FFF9EF] dark:bg-[#12141C] border border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#929AB0]"
                }`}
              >
                सभी 50 ज़िले
              </button>

              {RAJASTHAN_DIVISIONS_LIST.map((div) => {
                const isActive = activeDivisionFilter === div.id;
                return (
                  <button
                    key={div.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setActiveDivisionFilter(isActive ? null : div.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? "bg-[#800020] text-white border-[#800020] shadow-xs"
                        : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF] hover:border-[#800020]"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: div.color }}
                    />
                    <span>{div.nameHindi}</span>
                    {div.isNew && (
                      <span className="px-1 py-0.2 rounded-sm bg-[#F47B20] text-white text-[8px] font-black uppercase">
                        नया
                      </span>
                    )}
                    <span className="text-[10px] opacity-75 font-mono">({div.districtIds.length})</span>
                  </button>
                );
              })}
            </div>

            {/* Search Match Info */}
            {searchQuery && (
              <div className="flex items-center justify-between text-[11px] font-bold text-[#800020] dark:text-[#F47B20] px-1">
                <span>🔍 "{searchQuery}" से जुड़े ज़िले: {searchResults.length}</span>
                <span className="text-gray-500 font-normal">नक्शे पर नीले रंग में हाइलाइट किए गए हैं</span>
              </div>
            )}
          </div>
        )}

        {/* ================= MAIN CONTENT AREA ================= */}
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
          {/* QUIZ ENGINE OVERLAY (when in quiz mode) */}
          {activeMode === "quiz" ? (
            <div className="h-full flex flex-col overflow-hidden">
              {/* Quiz Header & Prompt Runner */}
              <div className="shrink-0 p-2 sm:p-4 bg-white/95 dark:bg-[#181B26]/95 border-b border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
                <MapQuizRunner
                  onSelectTargetForMap={(districtId) => setQuizTargetDistrictId(districtId)}
                  onQuizFeedback={(fb) => setQuizFeedback(fb)}
                  selectedDistrictFromMap={selectedDistrictFromMap}
                  onExitQuiz={() => handleSwitchMode("explorer")}
                />
              </div>

              {/* Map Display in Quiz Mode */}
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
              {/* Tip Banner */}
              <div className="shrink-0 px-3 py-1.5 bg-[#800020]/5 dark:bg-[#800020]/20 border-b border-[#800020]/15 flex items-center justify-between text-[11px] text-[#800020] dark:text-[#F47B20] font-medium">
                <div className="flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#F47B20]" />
                  <span className="truncate">
                    नक्शे पर किसी भी ज़िले पर टैप करें - उसका पूरा इतिहास, 2023 के नए बदलाव, खनिज व PYQs देखें!
                  </span>
                </div>
                <span className="hidden sm:inline-block font-bold shrink-0 pl-2">
                  जूम: + / - या माउस व्हील
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
                />
              </div>

              {/* District Detail Sheet Modal/Drawer */}
              {selectedDistrictData && (
                <DistrictDetailSheet
                  district={selectedDistrictData}
                  onClose={() => setSelectedDistrictId(null)}
                  onStartDistrictPractice={() => {
                    handleSwitchMode("quiz");
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* ================= FOOTER SUMMARY BAR ================= */}
        <footer className="shrink-0 bg-white dark:bg-[#181B26] border-t border-[#E8D9C0] dark:border-[#2D3345] px-3 sm:px-5 py-2 flex items-center justify-between text-[11px] text-[#52576A] dark:text-[#929AB0]">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <span className="font-bold text-[#800020] dark:text-[#F47B20]">
              50 कुल ज़िले
            </span>
            <span className="hidden sm:inline">•</span>
            <span>10 संभाग (3 नए: सीकर, पाली, बांसवाड़ा)</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              17 नए ज़िले (2023)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[10px] text-gray-500">
              दिशा 20-20 स्मार्ट विज़ुअलाइज़र
            </span>
          </div>
        </footer>

      </div>
    </div>
  );
};
