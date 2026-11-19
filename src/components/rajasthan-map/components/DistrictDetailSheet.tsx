import React, { useState } from "react";
import { DistrictInfo } from "../types";
import { RAJASTHAN_DIVISIONS } from "../data/divisionsData";
import {
  X,
  Sparkles,
  MapPin,
  Calendar,
  Layers,
  Landmark,
  Compass,
  CheckCircle2,
  HelpCircle,
  Volume2,
  ChevronRight,
  BookOpen,
  ArrowRight,
  Flame,
} from "lucide-react";
import { triggerHaptic, playClickSound } from "../../../utils/audioFeedback";

interface DistrictDetailSheetProps {
  district: DistrictInfo | null;
  onClose: () => void;
  onStartDistrictPractice?: (districtId: string) => void;
}

export const DistrictDetailSheet: React.FC<DistrictDetailSheetProps> = ({
  district,
  onClose,
  onStartDistrictPractice,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "new_changes" | "culture" | "geography" | "pyqs">("overview");
  const [selectedPyqAnswers, setSelectedPyqAnswers] = useState<Record<string, number>>({});
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  if (!district) return null;

  const division = RAJASTHAN_DIVISIONS[district.divisionId];

  const handleSpeakHighlights = () => {
    triggerHaptic("light");
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = `${district.nameHindi} ज़िला। ${district.tagline}। मुख्य परीक्षा बिंदु: ${district.examHighYieldFacts.join(". ")}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "hi-IN";
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSelectPyqOption = (qId: string, optIndex: number) => {
    triggerHaptic("light");
    playClickSound();
    setSelectedPyqAnswers((prev) => ({ ...prev, [qId]: optIndex }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[84vh] flex flex-col bg-[#FFF9EF] dark:bg-[#151822] rounded-t-3xl sm:rounded-3xl border-t-2 sm:border-2 border-[#C99A45]/40 shadow-2xl overflow-hidden text-[#171923] dark:text-[#FFF9EF]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= PULL-DOWN HANDLE & BANNER ================= */}
        <div className="relative p-4 sm:p-5 bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#800020] text-white shrink-0">
          {/* Mobile Sheet Drag Indicator */}
          <div className="w-12 h-1.5 bg-white/40 rounded-full mx-auto -mt-1 mb-2.5 sm:hidden" />

          {/* Close Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              if (isSpeaking && typeof window !== "undefined") {
                window.speechSynthesis.cancel();
              }
              onClose();
            }}
            aria-label="Close district sheet"
            className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-black/25 hover:bg-black/40 text-white flex items-center justify-center transition active:scale-90 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5 pr-10">
            <span
              className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black shadow-xs"
              style={{ backgroundColor: division?.color || "#F47B20", color: "#FFF" }}
            >
              {division?.nameEnglish || division?.nameHindi || "Division"}
            </span>
            {district.isNewDistrict && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-[#F47B20] text-white shadow-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3 fill-current" />
                2023 New District
              </span>
            )}
          </div>

          {/* Title & Audio Read-Aloud */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight truncate">
                {district.nameEnglish || district.nameHindi}
              </h2>
              <p className="text-[11px] sm:text-xs font-medium text-[#FFF9EF]/80">
                {district.nameHindi} • Headquarter: {district.headquarter}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSpeakHighlights}
              title="Listen to high-yield facts"
              className={`px-3 py-1.5 rounded-xl border transition active:scale-95 flex items-center gap-1.5 text-xs font-black shrink-0 cursor-pointer ${
                isSpeaking
                  ? "bg-[#F47B20] text-white border-white animate-pulse shadow-md"
                  : "bg-white/15 hover:bg-white/25 text-white border-white/30"
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{isSpeaking ? "Stop" : "Audio"}</span>
            </button>
          </div>

          <p className="text-[11px] sm:text-xs text-[#F7EFE1] mt-2 font-medium italic border-t border-white/20 pt-1.5 truncate">
            "{district.tagline}"
          </p>
        </div>

        {/* ================= TOUCH SCROLLABLE TABS ================= */}
        <div className="flex border-b border-[#E8D9C0] dark:border-[#2D3345] bg-white dark:bg-[#181B26] overflow-x-auto no-scrollbar px-3 pt-2 gap-1 shrink-0">
          {[
            { id: "overview", label: "Overview", icon: Landmark },
            { id: "new_changes", label: "2023 Changes", icon: Sparkles },
            { id: "culture", label: "Forts & Culture", icon: BookOpen },
            { id: "geography", label: "Geography & Minerals", icon: Compass },
            { id: "pyqs", label: `PYQs (${district.pyqQuestions?.length || 0})`, icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  playClickSound();
                  setActiveTab(tab.id as any);
                }}
                className={`flex items-center gap-1 px-3 py-2 rounded-t-xl text-xs font-black whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  isActive
                    ? "border-[#800020] text-[#800020] dark:border-[#F47B20] dark:text-[#F47B20] bg-[#800020]/10 dark:bg-[#F47B20]/10"
                    : "border-transparent text-[#52576A] dark:text-[#929AB0] hover:text-[#171923] dark:hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ================= TAB CONTENT SCROLLABLE BODY ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar overscroll-contain">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Formation / Reorganization Callout */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-[#800020] dark:text-[#F47B20] mb-1">
                  <Calendar className="w-4 h-4" />
                  <span>Formation / Reorganization Details</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold">{district.formationInfo}</p>
                {district.parentDistricts?.length > 0 && (
                  <p className="text-[11px] text-[#52576A] dark:text-[#929AB0] mt-1">
                    Parent District: {district.parentDistricts.join(", ")}
                  </p>
                )}
              </div>

              {/* High Yield Facts for Exams */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>High-Yield Exam Points</span>
                </h4>
                <div className="space-y-2">
                  {district.examHighYieldFacts.map((fact, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] text-xs sm:text-sm font-medium flex items-start gap-2.5 shadow-xs"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="leading-relaxed">{fact}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 2023 NEW CHANGES */}
          {activeTab === "new_changes" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
                <span className="font-black flex items-center gap-1 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  2023 Reorganization Changes (Ram Lubhaya Committee Report):
                </span>
                <p className="text-[11px] opacity-90">
                  These updated geographical facts are frequently tested in recent exams.
                </p>
              </div>

              <div className="space-y-2">
                {district.newChangesIn2023.map((change, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] text-xs sm:text-sm font-medium flex items-start gap-2.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#F47B20] shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{change}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CULTURE & FORTS */}
          {activeTab === "culture" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {district.culture.forts && district.culture.forts.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
                  <h4 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-2 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4" />
                    <span>Major Forts & Heritage</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {district.culture.forts.map((fort, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-bold">
                        🏰 {fort}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {district.culture.temples && district.culture.temples.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
                  <h4 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-2 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4" />
                    <span>Major Temples & Sacred Sites</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {district.culture.temples.map((temple, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-bold">
                        🛕 {temple}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {district.culture.artAndCraft && district.culture.artAndCraft.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
                  <h4 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Handicrafts, Festivals & Culture</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {district.culture.artAndCraft.map((craft, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-bold">
                        🎨 {craft}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: GEOGRAPHY & MINERALS */}
          {activeTab === "geography" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
                <span className="text-[10px] font-bold text-[#52576A] dark:text-[#929AB0] block uppercase">Terrain</span>
                <p className="text-xs sm:text-sm font-semibold mt-0.5">{district.geography.terrain}</p>
              </div>

              {district.geography.minerals && district.geography.minerals.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
                  <h4 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-2 flex items-center gap-1.5">
                    <Compass className="w-4 h-4" />
                    <span>Major Minerals</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {district.geography.minerals.map((m, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-bold">
                        💎 {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {district.geography.rivers && district.geography.rivers.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
                  <h4 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-2 flex items-center gap-1.5">
                    <Compass className="w-4 h-4" />
                    <span>Rivers & Drainage</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {district.geography.rivers.map((r, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-xs font-bold">
                        🌊 {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PREVIOUS YEAR QUESTIONS (PYQs) */}
          {activeTab === "pyqs" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-[11px] font-bold text-[#800020] dark:text-[#F47B20]">
                Real RPSC & RSMSSB past exam questions from this district:
              </div>

              {district.pyqQuestions.map((pyq, idx) => {
                const selectedOpt = selectedPyqAnswers[pyq.id];
                const isAnswered = selectedOpt !== undefined;

                return (
                  <div
                    key={pyq.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-[#800020]/10 dark:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20]">
                        Question {idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[#52576A] dark:text-[#929AB0]">
                        {pyq.examTag}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-snug">
                      {pyq.question}
                    </p>

                    {/* Options list */}
                    <div className="space-y-1.5">
                      {pyq.options.map((opt, optIdx) => {
                        const isThisSelected = selectedOpt === optIdx;
                        const isCorrectOption = optIdx === pyq.correctIndex;

                        let btnStyle = "bg-[#FFF9EF] dark:bg-[#171923] border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF]";

                        if (isAnswered) {
                          if (isCorrectOption) {
                            btnStyle = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-black";
                          } else if (isThisSelected) {
                            btnStyle = "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-800 dark:text-rose-200";
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={isAnswered}
                            onClick={() => handleSelectPyqOption(pyq.id, optIdx)}
                            className={`w-full min-h-[42px] text-left px-3 py-2 rounded-xl border text-xs flex items-center gap-2 transition active:scale-98 cursor-pointer ${btnStyle}`}
                          >
                            <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-[10px] font-black shrink-0">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="flex-1 leading-snug">{opt}</span>
                            {isAnswered && isCorrectOption && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-auto" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {isAnswered && (
                      <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed animate-in fade-in">
                        <span className="font-black">Explanation: </span>
                        <span>{pyq.explanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ================= STICKY FOOTER ACTIONS (Safe Area) ================= */}
        <div className="p-3 sm:p-4 bg-white dark:bg-[#181B26] border-t border-[#E8D9C0] dark:border-[#2D3345] flex items-center justify-between gap-2 shrink-0 pb-safe">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("medium");
              onClose();
              onStartDistrictPractice?.(district.id);
            }}
            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#800020] to-[#F47B20] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            <Flame className="w-4 h-4" />
            <span>🎯 Practice District Quiz</span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
