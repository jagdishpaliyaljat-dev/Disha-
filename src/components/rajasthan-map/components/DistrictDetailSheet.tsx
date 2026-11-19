import React, { useState, useMemo } from "react";
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
  VolumeX,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  ArrowRight,
  Flame,
  Swords,
  Trophy,
  Crown,
  Share2,
  ShieldCheck,
  Check,
  Copy,
  Map,
  RotateCcw,
  Building2,
  Mountain,
  Trees,
  Gem,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { districtWarService } from "../../district-war/districtWarService";
import { triggerHaptic, playClickSound, playSuccessSound } from "../../../utils/audioFeedback";

export interface DistrictDetailSheetProps {
  district: DistrictInfo | null;
  onClose: () => void;
  onStartDistrictPractice?: (districtId: string) => void;
  onOpenMap?: () => void;
}

type DistrictTabId = "overview" | "new_changes" | "culture" | "geography" | "pyqs";

export const DistrictDetailSheet: React.FC<DistrictDetailSheetProps> = ({
  district,
  onClose,
  onStartDistrictPractice,
  onOpenMap,
}) => {
  const [activeTab, setActiveTab] = useState<DistrictTabId>("overview");
  const [selectedPyqAnswers, setSelectedPyqAnswers] = useState<Record<string, number>>({});
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [copiedFactIndex, setCopiedFactIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live 50-District War Stats & Affiliation
  const warScore = useMemo(() => {
    if (!district) return null;
    const board = districtWarService.getLeaderboard();
    return board.find((b) => b.districtId === district.id) || null;
  }, [district]);

  const userAffiliation = useMemo(() => {
    return districtWarService.getUserContribution();
  }, []);

  const isUserHomeDistrict = userAffiliation?.districtId === district?.id;

  if (!district) return null;

  const division = RAJASTHAN_DIVISIONS[district.divisionId];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSpeakHighlights = () => {
    triggerHaptic("light");
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      showToast("आपके ब्राउज़र में वॉयस वाचन समर्थित नहीं है");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = `${district.nameHindi} ज़िला। ${division?.nameHindi || ""} संभाग। ${district.tagline}। मुख्य परीक्षा बिंदु: ${district.examHighYieldFacts.join(". ")}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "hi-IN";
    utterance.rate = 0.92;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const handleSelectPyqOption = (qId: string, optIndex: number, isCorrect: boolean) => {
    if (selectedPyqAnswers[qId] !== undefined) return;
    if (isCorrect) {
      triggerHaptic("medium");
      playSuccessSound();
    } else {
      triggerHaptic("light");
      playClickSound();
    }
    setSelectedPyqAnswers((prev) => ({ ...prev, [qId]: optIndex }));
  };

  const handleCopyFact = (fact: string, idx: number) => {
    triggerHaptic("light");
    playClickSound();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fact);
      setCopiedFactIndex(idx);
      showToast("परीक्षा बिंदु कॉपी किया गया!");
      setTimeout(() => setCopiedFactIndex(null), 2000);
    }
  };

  const handleSetHomeDistrict = () => {
    triggerHaptic("medium");
    playSuccessSound();
    districtWarService.setUserHomeDistrict(district.id);
    showToast(`शानदार! ${district.nameHindi} को आपकी ज़िला सेना बना दिया गया (+50 बोनस अंक)`);
  };

  const handleShareWhatsApp = () => {
    triggerHaptic("medium");
    playClickSound();
    const rankStr = warScore?.rank ? ` (रैंक #${warScore.rank})` : "";
    const text = `🔥 राजस्थान 50 ज़िला महासंग्राम — ${district.nameHindi} ज़िला${rankStr}!\n\n${district.tagline}\n\nक्या आप हमारी ज़िला सेना को टॉप पर पहुँचाने के लिए MCQs हल करेंगे? अभी DISHA 20-20 ऐप पर जुड़ें:`;
    const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://disha2020.in";
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text}\n${shareUrl}`)}`;
    window.open(waUrl, "_blank");
  };

  const answeredCount = Object.keys(selectedPyqAnswers).length;
  const totalPyqs = district.pyqQuestions?.length || 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex flex-col h-full w-full bg-[#FFF9EF] dark:bg-[#0D0F18] text-[#171923] dark:text-[#FFF9EF] overflow-hidden select-none animate-in fade-in duration-200"
    >
      {/* ================= 1. FULL-PAGE MOBILE-FRIENDLY TOP APP BAR ================= */}
      <header className="bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#800020] text-white shrink-0 shadow-md border-b border-[#C99A45]/40 relative z-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          {/* Back Button with Arrow and Label */}
          <button
            type="button"
            onClick={() => {
              handleStopSpeech();
              onClose();
            }}
            className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white font-black text-xs cursor-pointer shadow-2xs"
            aria-label="Go back"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">वापस सूची</span>
            <span className="sm:hidden">वापस</span>
          </button>

          {/* Center Identity */}
          <div className="flex items-center gap-2 min-w-0 text-center">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: division?.color || "#C99A45" }}
            />
            <h1 className="text-sm sm:text-base font-black tracking-tight truncate leading-tight">
              {district.nameHindi}
            </h1>
            <span className="text-[10px] sm:text-xs font-semibold text-[#FFF9EF]/80 truncate hidden xs:inline">
              ({district.nameEnglish})
            </span>
          </div>

          {/* Action Icons: Audio Narration, WhatsApp Share, Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleSpeakHighlights}
              title="हिंदी वाचन सुनें (Audio Narration)"
              className={`p-2 rounded-xl transition-all cursor-pointer shadow-2xs ${
                isSpeaking
                  ? "bg-[#F47B20] text-white animate-pulse shadow-md"
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              title="WhatsApp पर चुनौती साझा करें"
              className="p-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white active:scale-90 transition-all cursor-pointer shadow-2xs"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                handleStopSpeech();
                onClose();
              }}
              title="बंद करें"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white active:scale-90 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ================= 2. DISTRICT HERO & WAR STATS CARD ================= */}
      <div className="bg-gradient-to-b from-[#800020]/10 via-[#FFF9EF] to-[#FFF9EF] dark:from-[#800020]/25 dark:via-[#0D0F18] dark:to-[#0D0F18] border-b border-[#E8D9C0] dark:border-[#2A2E40] shrink-0">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-3.5 pb-3 space-y-3">
          {/* Top Info Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-xs"
                  style={{ backgroundColor: division?.color || "#800020" }}
                >
                  {division?.nameHindi || "संभाग"} संभाग
                </span>

                {district.isNewDistrict && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-[#F47B20] to-[#E06A14] text-white shadow-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3 fill-current" />
                    2023 नवीन पुनर्गठित ज़िला
                  </span>
                )}

                {isUserHomeDistrict && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-[#800020] to-[#5E0017] text-white border border-[#C99A45]/40 shadow-xs flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-[#C99A45]" />
                    आपकी ज़िला सेना
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight">
                  {district.nameHindi}
                </h2>
                <span className="text-sm sm:text-base font-bold text-slate-500 dark:text-[#CBD2E1]">
                  ({district.nameEnglish})
                </span>
              </div>

              <p className="text-xs sm:text-[13px] font-medium text-slate-600 dark:text-[#CBD2E1] mt-0.5 line-clamp-1 italic">
                "{district.tagline}"
              </p>
            </div>

            {/* Quick Action: Join Army Button if not home district */}
            {!isUserHomeDistrict && (
              <button
                type="button"
                onClick={handleSetHomeDistrict}
                className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E2232] border border-[#800020]/30 dark:border-[#C99A45]/30 text-[#800020] dark:text-[#C99A45] text-xs font-black flex items-center gap-1.5 shadow-2xs hover:border-[#800020] active:scale-95 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#800020] dark:text-[#C99A45]" />
                <span>अपनी सेना चुनें (+50 अंक)</span>
              </button>
            )}
          </div>

          {/* 4-Metric Live War & Administrative Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
            {/* Rank */}
            <div className="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-2xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-500 dark:text-[#CBD2E1] block uppercase tracking-wider">
                  राज्य वॉर रैंक
                </span>
                <span className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] block truncate font-mono">
                  #{warScore?.rank || "—"} रैंक
                </span>
              </div>
            </div>

            {/* Total War Points */}
            <div className="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-2xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#800020]/10 dark:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                <Swords className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-500 dark:text-[#CBD2E1] block uppercase tracking-wider">
                  कुल वॉर अंक
                </span>
                <span className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] block truncate font-mono">
                  {warScore?.totalPoints.toLocaleString() || "—"} pts
                </span>
              </div>
            </div>

            {/* Warriors */}
            <div className="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-2xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-500 dark:text-[#CBD2E1] block uppercase tracking-wider">
                  अध्ययनरत योद्धा
                </span>
                <span className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] block truncate font-mono">
                  {warScore?.activeWarriors || "—"} अभ्यर्थी
                </span>
              </div>
            </div>

            {/* Headquarter */}
            <div className="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-2xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-500 dark:text-[#CBD2E1] block uppercase tracking-wider">
                  ज़िला मुख्यालय
                </span>
                <span className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] block truncate">
                  {district.headquarter}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 3. MINIMAL PREMIUM TAB SELECTOR (HORIZONTALLY SCROLLABLE) ================= */}
      <div className="bg-white dark:bg-[#131522] border-b border-[#E8D9C0] dark:border-[#2A2E40] shrink-0 sticky top-0 z-10 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center overflow-x-auto no-scrollbar px-3 sm:px-6 pt-1 gap-1">
          {[
            { id: "overview", label: "सामान्य परिचय", sub: "Overview", icon: Landmark },
            { id: "new_changes", label: "2023 पुनर्गठन", sub: "Changes", icon: Sparkles },
            { id: "culture", label: "कला व संस्कृति", sub: "Culture", icon: BookOpen },
            { id: "geography", label: "भूगोल व खनिज", sub: "Geography", icon: Compass },
            { id: "pyqs", label: `विगत PYQs (${totalPyqs})`, sub: "Questions", icon: HelpCircle },
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
                  setActiveTab(tab.id as DistrictTabId);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-2xl text-xs font-black whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  isActive
                    ? "border-[#800020] dark:border-[#F47B20] text-[#800020] dark:text-[#F47B20] bg-[#FFF9EF] dark:bg-[#1C2030]"
                    : "border-transparent text-slate-600 dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= 4. FULL-PAGE SCROLLABLE CONTENT BODY ================= */}
      <main className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 space-y-4 max-w-4xl mx-auto w-full overscroll-contain">
        {/* Toast Alert */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="sticky top-2 z-30 mx-auto max-w-md p-2.5 rounded-xl bg-[#800020] text-white text-xs font-bold text-center shadow-lg border border-[#C99A45]/40 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: सामान्य परिचय (OVERVIEW & HIGH-YIELD POINTS)
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Quick 4-Fact Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-[#CBD2E1] uppercase block">
                  प्रशासनिक संभाग
                </span>
                <span className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] block truncate">
                  {division?.nameHindi || "संभाग"}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {division?.nameEnglish}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-[#CBD2E1] uppercase block">
                  ज़िला गठन / पुनर्गठन
                </span>
                <span className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] block truncate">
                  {district.formationInfo.split("(")[0].trim()}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  राम लुभाया समिति
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-[#CBD2E1] uppercase block">
                  ज़िला मुख्यालय
                </span>
                <span className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] block truncate">
                  {district.headquarter}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  प्रशासनिक केंद्र
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-[#CBD2E1] uppercase block">
                  मूल ज़िले (Parent)
                </span>
                <span className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] block truncate">
                  {district.parentDistricts?.length > 0
                    ? district.parentDistricts.join(", ")
                    : "मूल ऐतिहासिक ज़िला"}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  पुनर्गठन स्रोत
                </span>
              </div>
            </div>

            {/* Formation / Reorganization Details Callout */}
            <div className="p-4 rounded-3xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                <span>गठन पृष्ठभूमि एवं प्रशासनिक विवरण</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#171923] dark:text-[#FFF9EF] leading-relaxed">
                {district.formationInfo}
              </p>
              {district.parentDistricts?.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#CBD2E1] pt-1">
                  <span className="font-bold">मूल पैतृक ज़िले:</span>
                  <div className="flex flex-wrap gap-1">
                    {district.parentDistricts.map((p, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-lg bg-[#FFF9EF] dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-black text-[#800020] dark:text-[#C99A45]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* High-Yield Exam Points (परीक्षा में बार-बार पूछे जाने वाले बिंदु) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black text-[#800020] dark:text-[#C99A45] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#800020] dark:text-[#C99A45]" />
                  <span>मुख्य परीक्षा बिंदु (Exam High-Yield Facts)</span>
                </h3>
                <span className="text-[10px] font-bold text-slate-500 dark:text-[#CBD2E1]">
                  RPSC & RSMSSB स्पेशल
                </span>
              </div>

              <div className="space-y-2">
                {district.examHighYieldFacts.map((fact, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] text-xs sm:text-sm font-medium flex items-start gap-3 shadow-2xs hover:border-[#800020] dark:hover:border-[#C99A45] transition-all group"
                  >
                    <span className="w-6 h-6 rounded-xl bg-gradient-to-tr from-[#800020] to-[#5E0017] dark:from-[#F47B20] dark:to-[#E06A14] text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5 shadow-2xs">
                      {idx + 1}
                    </span>

                    <p className="flex-1 text-[#171923] dark:text-[#FFF9EF] leading-relaxed">
                      {fact}
                    </p>

                    <button
                      type="button"
                      onClick={() => handleCopyFact(fact, idx)}
                      title="यह बिंदु कॉपी करें"
                      className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-slate-400 group-hover:text-[#800020] dark:group-hover:text-[#C99A45] transition-all shrink-0 cursor-pointer"
                    >
                      {copiedFactIndex === idx ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: 2023 नवीन पुनर्गठन व परिवर्तन (2023 CHANGES)
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "new_changes" && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Committee Callout */}
            <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs sm:text-sm space-y-1">
              <span className="font-black flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-600" />
                राम लुभाया उच्च स्तरीय समिति रिपोर्ट (2023 पुनर्गठन):
              </span>
              <p className="text-[11px] sm:text-xs leading-relaxed opacity-95">
                नवीन प्रशासनिक परिसीमन के पश्चात् भौगोलिक, ऐतिहासिक एवं खनिज संबंधी तथ्यों में बदलाव हुए हैं। आगामी परीक्षाओं में इन नए आंकड़ों से प्रश्न सीधे पूछे जा रहे हैं।
              </p>
            </div>

            {/* List of 2023 Changes */}
            <div className="space-y-2">
              {district.newChangesIn2023.map((change, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] text-xs sm:text-sm font-medium flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-6 h-6 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <p className="flex-1 text-[#171923] dark:text-[#FFF9EF] leading-relaxed">
                    {change}
                  </p>
                </div>
              ))}
            </div>

            {/* Exam Trap Warning Card */}
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-black block">अभ्यर्थी ध्यान दें (Exam Alert):</span>
                <span className="text-[11px] leading-relaxed block">
                  यदि परीक्षा में 2023 पुनर्गठन से पूर्व का ऐतिहासिक संदर्भ पूछा जाए तो मूल ज़िले का ध्यान रखें, तथा वर्तमान भौगोलिक स्थिति में इस नए ज़िले का चयन करें।
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: कला, संस्कृति, दुर्ग व धरोहर (CULTURE & HERITAGE)
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "culture" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Forts & Monuments */}
            {district.culture.forts && district.culture.forts.length > 0 && (
              <div className="p-4 rounded-3xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-xs space-y-2.5">
                <h4 className="text-xs font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-4 h-4" />
                  <span>प्रमुख दुर्ग, महल व ऐतिहासिक धरोहर (Forts & Heritage)</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {district.culture.forts.map((fort, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-[#FFF9EF] dark:bg-[#1C2030] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-bold text-[#171923] dark:text-[#FFF9EF] shadow-2xs"
                    >
                      🏰 {fort}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Temples & Sacred Sites */}
            {district.culture.temples && district.culture.temples.length > 0 && (
              <div className="p-4 rounded-3xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-xs space-y-2.5">
                <h4 className="text-xs font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-4 h-4" />
                  <span>प्रमुख मंदिर व पवित्र तीर्थ स्थल (Temples & Sacred Sites)</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {district.culture.temples.map((temple, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-[#FFF9EF] dark:bg-[#1C2030] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-bold text-[#171923] dark:text-[#FFF9EF] shadow-2xs"
                    >
                      🛕 {temple}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Handicrafts, Fairs & Art */}
            {district.culture.artAndCraft && district.culture.artAndCraft.length > 0 && (
              <div className="p-4 rounded-3xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-xs space-y-2.5">
                <h4 className="text-xs font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>हस्तकला, मेले, उत्सव व लोक संस्कृति (Art, Fairs & Craft)</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {district.culture.artAndCraft.map((craft, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-[#FFF9EF] dark:bg-[#1C2030] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-bold text-[#171923] dark:text-[#FFF9EF] shadow-2xs"
                    >
                      🎨 {craft}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 4: भूगोल, नदियां व खनिज (GEOGRAPHY & RESOURCES)
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "geography" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Terrain & Climate */}
            <div className="p-4 rounded-3xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-xs space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-[#CBD2E1] block uppercase tracking-wider">
                धरातलीय स्वरूप व जलवायु (Terrain & Climate)
              </span>
              <p className="text-xs sm:text-sm font-semibold text-[#171923] dark:text-[#FFF9EF] leading-relaxed">
                {district.geography.terrain}
              </p>
            </div>

            {/* Minerals */}
            {district.geography.minerals && district.geography.minerals.length > 0 && (
              <div className="p-4 rounded-3xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-xs space-y-2.5">
                <h4 className="text-xs font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-4 h-4" />
                  <span>प्रमुख खनिज संपदा (Major Minerals & Ores)</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {district.geography.minerals.map((m, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-bold shadow-2xs"
                    >
                      💎 {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Rivers & Lakes */}
            {district.geography.rivers && district.geography.rivers.length > 0 && (
              <div className="p-4 rounded-3xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-xs space-y-2.5">
                <h4 className="text-xs font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-4 h-4" />
                  <span>प्रमुख नदियां व जलप्रवाह (Rivers & Drainage)</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {district.geography.rivers.map((r, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-xs font-bold shadow-2xs"
                    >
                      🌊 {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 5: विगत परीक्षा प्रश्न (PYQs) & तुरंत अभ्यास
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "pyqs" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Header / Score Banner */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-[#800020] dark:text-[#C99A45] block">
                  RPSC एवं RSMSSB विगत परीक्षा प्रश्न
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#CBD2E1]">
                  इस ज़िले से विगत वर्षों में पूछे गए आधिकारिक प्रश्न
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] font-mono font-black text-xs">
                {answeredCount} / {totalPyqs} हल किए
              </span>
            </div>

            {district.pyqQuestions && district.pyqQuestions.length > 0 ? (
              district.pyqQuestions.map((pyq, idx) => {
                const selectedOpt = selectedPyqAnswers[pyq.id];
                const isAnswered = selectedOpt !== undefined;

                return (
                  <div
                    key={pyq.id}
                    className="p-4 rounded-3xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] uppercase tracking-wider">
                        प्रश्न {idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#FFF9EF] dark:bg-[#1C2030] text-slate-600 dark:text-[#CBD2E1] border border-[#E8D9C0] dark:border-[#31374A]">
                        {pyq.examTag}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-snug">
                      {pyq.question}
                    </p>

                    {/* Options list */}
                    <div className="space-y-2">
                      {pyq.options.map((opt, optIdx) => {
                        const isThisSelected = selectedOpt === optIdx;
                        const isCorrectOption = optIdx === pyq.correctIndex;

                        let btnStyle =
                          "bg-[#FFF9EF] dark:bg-[#1C2030] border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF]";

                        if (isAnswered) {
                          if (isCorrectOption) {
                            btnStyle =
                              "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-black";
                          } else if (isThisSelected) {
                            btnStyle =
                              "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-800 dark:text-rose-200";
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={isAnswered}
                            onClick={() => handleSelectPyqOption(pyq.id, optIdx, isCorrectOption)}
                            className={`w-full min-h-[44px] text-left px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm flex items-center gap-2.5 transition active:scale-98 cursor-pointer ${btnStyle}`}
                          >
                            <span className="w-6 h-6 rounded-xl bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-xs font-black shrink-0">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="flex-1 leading-snug">{opt}</span>
                            {isAnswered && isCorrectOption && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-auto" />
                            )}
                          </button>
                        );
                      })}

                      {/* 5th Option - Option E (अनुत्तरित प्रश्न) */}
                      {!isAnswered && (
                        <button
                          type="button"
                          onClick={() => handleSelectPyqOption(pyq.id, 4, false)}
                          className="w-full text-left px-3.5 py-2 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 text-xs flex items-center gap-2 hover:bg-stone-100 dark:hover:bg-stone-800 transition active:scale-98 cursor-pointer"
                        >
                          <span className="w-5 h-5 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-[10px] font-bold">
                            E
                          </span>
                          <span>अनुत्तरित प्रश्न (Question Unattempted — 5th Option)</span>
                        </button>
                      )}
                    </div>

                    {/* Official Explanation */}
                    {isAnswered && (
                      <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 leading-relaxed animate-in fade-in space-y-1">
                        <span className="font-black flex items-center gap-1 text-amber-800 dark:text-amber-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          विस्तृत व्याख्या (Official Explanation):
                        </span>
                        <p className="text-[11px] sm:text-xs leading-relaxed">
                          {pyq.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-6 rounded-3xl bg-white dark:bg-[#161826] border border-[#E8D9C0] dark:border-[#2D3345] text-center space-y-2">
                <p className="text-xs font-bold text-slate-500">
                  इस नए ज़िले के विशिष्ट PYQs संकलन प्रक्रिया में हैं।
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ================= 5. STICKY BOTTOM SAFE-AREA ACTION BAR ================= */}
      <footer className="p-3 sm:p-4 bg-white dark:bg-[#131522] border-t border-[#E8D9C0] dark:border-[#2A2E40] shrink-0 shadow-lg relative z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
          {/* Main Practice CTA */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("medium");
              playClickSound();
              handleStopSpeech();
              onClose();
              onStartDistrictPractice?.(district.id);
            }}
            className="flex-1 min-h-[48px] py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#F47B20] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          >
            <Flame className="w-4 h-4 fill-amber-300 text-amber-300" />
            <span>🎯 इस ज़िले का टेस्ट अभ्यास करें</span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </button>

          {/* Map View Button */}
          {onOpenMap && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                handleStopSpeech();
                onClose();
                onOpenMap();
              }}
              className="min-h-[48px] px-3.5 py-2.5 rounded-2xl bg-[#FFF9EF] dark:bg-[#1E2232] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#C99A45] text-[#800020] dark:text-[#C99A45] font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
            >
              <Map className="w-4 h-4" />
              <span className="hidden sm:inline">नक्शे पर देखें</span>
            </button>
          )}

          {/* WhatsApp Share Button */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="min-h-[48px] px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            title="WhatsApp पर चुनौती भेजें"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">चुनौती भेजें</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
