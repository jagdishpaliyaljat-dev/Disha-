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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full sm:max-w-2xl max-h-[88vh] sm:max-h-[82vh] flex flex-col bg-[#FFF9EF] dark:bg-[#171923] rounded-t-3xl sm:rounded-3xl border-t-2 sm:border-2 border-[#C99A45]/40 shadow-2xl overflow-hidden text-[#171923] dark:text-[#FFF9EF]">
        {/* Top Header Banner */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#800020] text-white">
          <button
            onClick={() => {
              triggerHaptic("light");
              onClose();
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold shadow-sm"
              style={{ backgroundColor: division?.color || "#F47B20", color: "#FFF" }}
            >
              {division?.nameHindi || "संभाग"}
            </span>
            {district.isNewDistrict && (
              <span className="px-3 py-1 rounded-full text-xs font-black bg-[#F47B20] text-white shadow-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3 fill-current" />
                2023 नया ज़िला
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{district.nameHindi}</h2>
              <p className="text-xs sm:text-sm font-medium text-[#FFF9EF]/80 mt-0.5">{district.nameEnglish}</p>
            </div>
            <button
              onClick={handleSpeakHighlights}
              title="ऑडियो सुनें"
              className={`p-3 rounded-2xl border transition active:scale-95 flex items-center gap-1.5 text-xs font-bold ${
                isSpeaking
                  ? "bg-[#F47B20] text-white border-white animate-pulse"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/30"
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{isSpeaking ? "सुन रहे हैं..." : "ऑडियो"}</span>
            </button>
          </div>

          <p className="text-xs sm:text-sm text-[#F7EFE1] mt-2 font-medium italic border-t border-white/20 pt-2">
            "{district.tagline}"
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#C99A45]/30 bg-white/70 dark:bg-[#1E222D]/70 overflow-x-auto scrollbar-none px-3 pt-2 gap-1.5">
          {[
            { id: "overview", label: "अवलोकन", icon: Landmark },
            { id: "new_changes", label: "2023 बदलाव", icon: Sparkles },
            { id: "culture", label: "इतिहास-संस्कृति", icon: BookOpen },
            { id: "geography", label: "भूगोल-खनिज", icon: Compass },
            { id: "pyqs", label: `PYQ प्रश्न (${district.pyqQuestions?.length || 0})`, icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic("light");
                  setActiveTab(tab.id as any);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
                  isActive
                    ? "border-[#800020] text-[#800020] dark:border-[#F47B20] dark:text-[#F47B20] bg-[#800020]/10 dark:bg-[#F47B20]/10"
                    : "border-transparent text-stone-600 dark:text-stone-400 hover:text-[#800020]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Snapshot Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 font-bold mb-1">
                    <MapPin className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                    मुख्यालय
                  </div>
                  <div className="font-extrabold text-sm">{district.headquarter}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 font-bold mb-1">
                    <Calendar className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                    गठन / स्थापना
                  </div>
                  <div className="font-extrabold text-xs leading-snug">{district.formationInfo}</div>
                </div>
              </div>

              {/* High-Yield Exam Facts */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#800020]/5 via-[#C99A45]/10 to-transparent border border-[#C99A45]/40">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20] flex items-center gap-1.5 mb-2.5">
                  <Sparkles className="w-4 h-4" />
                  RPSC व REET परीक्षा के मुख्य तथ्य (High-Yield Facts)
                </h4>
                <ul className="space-y-2">
                  {district.examHighYieldFacts.map((fact, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm font-medium leading-relaxed">
                      <span className="w-5 h-5 rounded-full bg-[#800020] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: NEW CHANGES 2023 */}
          {activeTab === "new_changes" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 font-medium">
                ⚡ <strong>अगस्त 2023 पुनर्गठन:</strong> इस ज़िले में कौन-कौन से ऐतिहासिक स्थल, नदियाँ और स्मारक शामिल हुए:
              </div>

              {district.newChangesIn2023 && district.newChangesIn2023.length > 0 ? (
                <div className="space-y-2.5">
                  {district.newChangesIn2023.map((change, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30 flex items-start gap-3 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-xs sm:text-sm font-semibold leading-relaxed">{change}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-stone-500">
                  इस ज़िले की मूल सीमाएं और प्रमुख धरोहरें पूर्ववत हैं।
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CULTURE & HERITAGE */}
          {activeTab === "culture" && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {district.culture.forts && district.culture.forts.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30">
                  <h5 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-1.5 flex items-center gap-1.5">
                    🏰 प्रमुख दुर्ग व किले
                  </h5>
                  <p className="text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300">
                    {district.culture.forts.join(" • ")}
                  </p>
                </div>
              )}

              {district.culture.temples && district.culture.temples.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30">
                  <h5 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-1.5 flex items-center gap-1.5">
                    🛕 प्रमुख मंदिर व धाम
                  </h5>
                  <p className="text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300">
                    {district.culture.temples.join(" • ")}
                  </p>
                </div>
              )}

              {district.culture.fairs && district.culture.fairs.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30">
                  <h5 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-1.5 flex items-center gap-1.5">
                    🎪 प्रमुख मेले व उत्सव
                  </h5>
                  <p className="text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300">
                    {district.culture.fairs.join(" • ")}
                  </p>
                </div>
              )}

              {district.culture.artAndCraft && district.culture.artAndCraft.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30">
                  <h5 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-1.5 flex items-center gap-1.5">
                    🎨 कला, हस्तशिल्प व लोकनाट्य
                  </h5>
                  <p className="text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300">
                    {district.culture.artAndCraft.join(" • ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: GEOGRAPHY & MINERALS */}
          {activeTab === "geography" && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30">
                <h5 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-1">⛰️ भू-आकृति व उच्चावच</h5>
                <p className="text-xs sm:text-sm font-medium">{district.geography.terrain}</p>
              </div>

              {district.geography.rivers && district.geography.rivers.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30">
                  <h5 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-1">🌊 नदियाँ व अपवाह तंत्र</h5>
                  <p className="text-xs sm:text-sm font-medium">{district.geography.rivers.join(", ")}</p>
                </div>
              )}

              {district.geography.lakes && district.geography.lakes.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30">
                  <h5 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-1">💧 प्रमुख झीलें व बांध</h5>
                  <p className="text-xs sm:text-sm font-medium">{district.geography.lakes.join(", ")}</p>
                </div>
              )}

              {district.geography.minerals && district.geography.minerals.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30">
                  <h5 className="text-xs font-black text-[#800020] dark:text-[#F47B20] mb-1">⛏️ खनिज संपदा</h5>
                  <p className="text-xs sm:text-sm font-medium">{district.geography.minerals.join(", ")}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PYQ PRACTICE */}
          {activeTab === "pyqs" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {district.pyqQuestions && district.pyqQuestions.length > 0 ? (
                district.pyqQuestions.map((q, qIdx) => {
                  const selectedOpt = selectedPyqAnswers[q.id];
                  const hasAnswered = selectedOpt !== undefined;

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#C99A45]/30 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#800020] dark:text-[#F47B20] bg-[#800020]/10 dark:bg-[#F47B20]/10 px-2.5 py-0.5 rounded-full">
                          प्रश्न {qIdx + 1}
                        </span>
                        <span className="text-[10px] font-bold text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                          {q.examTag}
                        </span>
                      </div>

                      <h5 className="font-bold text-xs sm:text-sm leading-relaxed">{q.question}</h5>

                      {/* Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => {
                          const isSelected = selectedOpt === oIdx;
                          const isCorrect = q.correctIndex === oIdx;

                          let btnStyle = "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60";
                          if (hasAnswered) {
                            if (isCorrect) {
                              btnStyle = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold";
                            } else if (isSelected) {
                              btnStyle = "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 font-bold";
                            }
                          } else if (isSelected) {
                            btnStyle = "border-[#800020] bg-[#800020]/10 font-bold";
                          }

                          return (
                            <button
                              key={oIdx}
                              onClick={() => handleSelectPyqOption(q.id, oIdx)}
                              className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center gap-2 ${btnStyle}`}
                            >
                              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0">
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="leading-tight">{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {hasAnswered && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs leading-relaxed text-stone-800 dark:text-stone-200 animate-in fade-in">
                          <strong>व्याख्या:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-xs text-stone-500">
                  इस ज़िले के प्रश्न जल्द ही जोड़े जाएंगे।
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Actions Footer */}
        <div className="p-4 bg-white/90 dark:bg-[#1E222D]/90 border-t border-[#C99A45]/30 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              triggerHaptic("light");
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-bold border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
          >
            बंद करें
          </button>

          {onStartDistrictPractice && (
            <button
              onClick={() => {
                triggerHaptic("medium");
                playClickSound();
                onStartDistrictPractice(district.id);
              }}
              className="flex-1 max-w-xs px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-[#800020] to-[#F47B20] text-white shadow-lg hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <span>इस ज़िले का टेस्ट दें</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
