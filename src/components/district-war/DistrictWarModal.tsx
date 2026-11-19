import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Trophy,
  Swords,
  Crown,
  Flame,
  Share2,
  Users,
  Search,
  Sparkles,
  ChevronRight,
  TrendingUp,
  MapPin,
  Clock,
  Shield,
  Info,
  Check,
  Zap,
  Award,
} from "lucide-react";
import { districtWarService } from "./districtWarService";
import { DistrictWarScore, WarLeagueTab, DistrictWarEvent, UserDistrictAffiliation } from "./types";
import { DistrictSelectModal } from "./DistrictSelectModal";
import { DistrictDetailSheet } from "../rajasthan-map/components/DistrictDetailSheet";
import { RAJASTHAN_50_DISTRICTS } from "../rajasthan-map/data/districtsData";
import { RAJASTHAN_DIVISIONS_LIST } from "../rajasthan-map/data/divisionsData";
import { DistrictInfo } from "../rajasthan-map/types";
import { triggerHaptic, playClickSound, playSuccessSound } from "../../utils/audioFeedback";

interface DistrictWarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMap?: () => void;
}

export const DistrictWarModal: React.FC<DistrictWarModalProps> = ({
  isOpen,
  onClose,
  onOpenMap,
}) => {
  const [activeLeague, setActiveLeague] = useState<WarLeagueTab>("total");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [isSelectDistrictOpen, setIsSelectDistrictOpen] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [leaderboard, setLeaderboard] = useState<DistrictWarScore[]>([]);
  const [liveEvents, setLiveEvents] = useState<DistrictWarEvent[]>([]);
  const [userAffiliation, setUserAffiliation] = useState<UserDistrictAffiliation | null>(null);
  const [selectedDistrictForDetail, setSelectedDistrictForDetail] = useState<DistrictInfo | null>(null);
  const [activeLiveEventIndex, setActiveLiveEventIndex] = useState(0);

  const handleOpenDistrictDetail = (districtId: string) => {
    triggerHaptic("light");
    playClickSound();
    const info = RAJASTHAN_50_DISTRICTS[districtId];
    if (info) {
      setSelectedDistrictForDetail(info);
    }
  };

  const refreshData = () => {
    setLeaderboard(districtWarService.getLeaderboard(activeLeague));
    setLiveEvents(districtWarService.getLiveEvents());
    setUserAffiliation(districtWarService.getUserContribution());
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshData();

    const handleUpdate = () => refreshData();
    window.addEventListener("disha:district-war-updated", handleUpdate);
    return () => window.removeEventListener("disha:district-war-updated", handleUpdate);
  }, [isOpen, activeLeague]);

  // Rotate live events every 4 seconds
  useEffect(() => {
    if (!isOpen || liveEvents.length <= 1) return;
    const interval = setInterval(() => {
      setActiveLiveEventIndex((prev) => (prev + 1) % liveEvents.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen, liveEvents.length]);

  const filteredDistricts = useMemo(() => {
    return leaderboard.filter((item) => {
      const distInfo = RAJASTHAN_50_DISTRICTS[item.districtId];
      const eng = (distInfo?.nameEnglish || "").toLowerCase();
      const hin = (distInfo?.nameHindi || item.nameHindi).toLowerCase();
      const q = searchQuery.trim().toLowerCase();

      const matchesSearch = !q || eng.includes(q) || hin.includes(q);
      const matchesDivision = !selectedDivision || distInfo?.divisionId === selectedDivision;

      return matchesSearch && matchesDivision;
    });
  }, [leaderboard, searchQuery, selectedDivision]);

  if (!isOpen) return null;

  const topThree = leaderboard.slice(0, 3);
  const maxPoints = leaderboard[0]?.totalPoints || 1;

  const handleShareWhatsApp = (districtId?: string) => {
    triggerHaptic("medium");
    playClickSound();
    const url = districtWarService.getWhatsAppShareUrl(districtId);
    window.open(url, "_blank");
  };

  const currentLiveEvent = liveEvents[activeLiveEventIndex] || liveEvents[0];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FDFBF7] dark:bg-[#0D0F18] text-stone-900 dark:text-stone-100 overflow-hidden select-none animate-in fade-in duration-200">
      {/* ================= 1. PREMIUM HEADER ================= */}
      <header className="bg-gradient-to-r from-[#800020] via-[#5A0016] to-[#F47B20] text-white px-3.5 py-3 sm:px-5 sm:py-3.5 shrink-0 shadow-lg border-b border-[#C99A45]/40 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-amber-300 shadow-xs shrink-0">
            <Swords className="w-5 h-5 sm:w-5.5 sm:h-5.5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-black text-sm sm:text-base tracking-tight leading-tight truncate">
                राजस्थान 50 ज़िला महासंग्राम
              </h1>
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8.5px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                LIVE
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-amber-200/90 font-medium truncate">
              हर सही उत्तर से बढ़ेगी आपके ज़िले की साख • रविवार मध्यरात्रि रिसेट
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          {/* Rules / Info Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              setShowRulesModal(true);
            }}
            className="px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-amber-200 hover:text-white text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
            title="वॉर नियम देखें"
          >
            <Info className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">वॉर नियम</span>
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              onClose();
            }}
            aria-label="Close"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer active:scale-95 transition"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* ================= 2. LIVE BATTLE TICKER ================= */}
      <div className="bg-[#12141F] text-white/90 px-3 py-1.5 text-[10.5px] font-medium flex items-center gap-2 shrink-0 overflow-hidden border-b border-stone-800">
        <span className="flex items-center gap-1 text-[#F47B20] font-black shrink-0 uppercase tracking-wider text-[9px] bg-[#F47B20]/15 px-1.5 py-0.5 rounded-md border border-[#F47B20]/30">
          <Flame className="w-3 h-3 text-[#F47B20] animate-bounce" /> हलचल
        </span>
        <div className="truncate flex-1 text-stone-200 text-[10px] sm:text-[11px]">
          {currentLiveEvent ? (
            <span className="inline-flex items-center gap-1 truncate">
              ⚡ <b className="text-amber-300 font-bold">{RAJASTHAN_50_DISTRICTS[currentLiveEvent.districtId]?.nameHindi || currentLiveEvent.districtNameHindi}</b> के <span className="text-white font-medium">{currentLiveEvent.warriorName}</span> ने <b className="text-emerald-400 font-bold">+{currentLiveEvent.pointsEarned} अंक</b> जोड़े ({currentLiveEvent.actionText})
            </span>
          ) : (
            <span>राजस्थान के सभी 50 ज़िलों में महासंग्राम जारी है...</span>
          )}
        </div>
      </div>

      {/* ================= 3. USER DISTRICT STATUS BANNER ================= */}
      <div className="p-2.5 sm:p-3 bg-white dark:bg-[#141622] border-b border-stone-200 dark:border-stone-800 shrink-0 shadow-xs">
        {userAffiliation ? (
          <div className="bg-gradient-to-r from-[#FFF9EF] via-[#FFF2DC] to-amber-50/70 dark:from-[#1E2230] dark:via-[#191D2B] dark:to-[#171926] p-2.5 sm:p-3 rounded-2xl border border-[#C99A45]/45 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-[#800020] to-[#A8002B] text-amber-300 flex items-center justify-center font-black text-sm shrink-0 shadow-sm border border-[#C99A45]/40">
                <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    आपकी ज़िला सेना:
                  </span>
                  <span className="font-black text-xs sm:text-sm text-stone-900 dark:text-white truncate">
                    {RAJASTHAN_50_DISTRICTS[userAffiliation.districtId]?.nameHindi || userAffiliation.districtNameHindi}
                    <span className="text-stone-500 text-[11px] font-medium ml-1">
                      ({RAJASTHAN_50_DISTRICTS[userAffiliation.districtId]?.nameEnglish})
                    </span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-black bg-[#800020] text-white shadow-xs">
                    राज्य रैंक #{districtWarService.getDistrictRank(userAffiliation.districtId, activeLeague)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10.5px] sm:text-[11px] text-stone-600 dark:text-stone-300 font-medium mt-0.5 flex-wrap">
                  <span>
                    🎖️ आपका योगदान: <b className="text-[#800020] dark:text-[#F47B20] font-black">+{userAffiliation.userPointsEarned} अंक</b>
                  </span>
                  <span>•</span>
                  <span>
                    🛡️ ज़िला रैंक: <b className="text-stone-800 dark:text-stone-100 font-bold">#{userAffiliation.userRankInDistrict}</b>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-amber-200/50 dark:border-stone-800">
              <button
                type="button"
                onClick={() => handleShareWhatsApp(userAffiliation.districtId)}
                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-black shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>सेना लामबंद करें 📲</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  playClickSound();
                  setIsSelectDistrictOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-stone-200/90 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[10.5px] font-bold hover:bg-stone-300 dark:hover:bg-stone-700 transition cursor-pointer"
              >
                बदलें
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-amber-500/15 via-[#F47B20]/20 to-transparent p-2.5 sm:p-3 rounded-2xl border border-amber-500/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-stone-900 flex items-center justify-center font-black shadow-xs shrink-0">
                <Shield className="w-5 h-5 text-stone-950" />
              </div>
              <div className="min-w-0">
                <span className="font-black text-xs sm:text-sm text-stone-900 dark:text-white block truncate">
                  आपने अभी तक अपनी ज़िला सेना नहीं चुनी है!
                </span>
                <span className="text-[10px] sm:text-[10.5px] text-stone-600 dark:text-stone-300 font-medium block">
                  अपने गृह ज़िले का प्रतिनिधित्व करें और तुरंत <b className="text-emerald-600 dark:text-emerald-400 font-bold">+50 बोनस अंक</b> पाएं।
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                playClickSound();
                setIsSelectDistrictOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#800020] to-[#F47B20] text-white font-black text-[11px] sm:text-xs shadow-md active:scale-95 transition cursor-pointer shrink-0 flex items-center gap-1"
            >
              <span>सेना चुनें 🛡️</span>
            </button>
          </div>
        )}
      </div>

      {/* ================= 4. LEAGUE SELECTOR & FILTERS ================= */}
      <div className="p-2.5 sm:p-3 bg-stone-100/80 dark:bg-[#12141F] border-b border-stone-200 dark:border-stone-800 shrink-0 space-y-2">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* League Segmented Switcher */}
          <div className="flex items-center gap-1 bg-white dark:bg-[#1A1D2C] p-1 rounded-xl border border-stone-200 dark:border-stone-700 w-full sm:w-auto shadow-xs">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                playClickSound();
                setActiveLeague("total");
              }}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeLeague === "total"
                  ? "bg-[#800020] text-white shadow-xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>कुल वॉर अंक</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                playClickSound();
                setActiveLeague("efficiency");
              }}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeLeague === "efficiency"
                  ? "bg-[#800020] text-white shadow-xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>औसत दक्षता (प्रति छात्र)</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="50 ज़िले खोजें (उदा. सीकर, जोधपुर)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-[#1A1D2C] text-xs rounded-xl border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-hidden focus:border-[#C99A45] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Division Filter Chips (Horizontal Scrollable) */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              setSelectedDivision(null);
            }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition cursor-pointer shrink-0 ${
              selectedDivision === null
                ? "bg-[#800020] text-white shadow-xs"
                : "bg-white dark:bg-[#1A1D2C] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
            }`}
          >
            सभी 10 संभाग (50 ज़िले)
          </button>
          {RAJASTHAN_DIVISIONS_LIST.map((div) => {
            const isSelected = selectedDivision === div.id;
            return (
              <button
                key={div.id}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  playClickSound();
                  setSelectedDivision(div.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1 ${
                  isSelected
                    ? "bg-[#800020] text-white shadow-xs"
                    : "bg-white dark:bg-[#1A1D2C] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ backgroundColor: div.color }}
                />
                <span>{div.nameHindi}</span>
                <span className="opacity-70 text-[9px]">({div.districtIds.length})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= 5. PODIUM & 50 DISTRICT LEADERBOARD ================= */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 overscroll-contain">
        {/* TOP 3 PODIUM (Visible when no search and all divisions selected) */}
        {!searchQuery.trim() && !selectedDivision && topThree.length === 3 && (
          <div className="bg-gradient-to-b from-amber-500/5 via-transparent to-transparent p-2 rounded-3xl border border-[#C99A45]/20 max-w-xl mx-auto mb-2">
            <div className="text-center mb-1">
              <span className="text-[10px] font-black text-[#800020] dark:text-[#C99A45] uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-full">
                👑 शीर्ष विजय मंच (Top 3 Warriors)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-3 items-end pt-3 pb-1">
              {/* Rank 2 (Silver) */}
              <div
                onClick={() => handleOpenDistrictDetail(topThree[1].districtId)}
                className="flex flex-col items-center justify-end cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-slate-400 to-slate-200 text-stone-800 flex items-center justify-center font-black text-xs shadow-md mb-1 border border-white dark:border-stone-700">
                  🥈 2
                </div>
                <div className="w-full bg-gradient-to-b from-slate-100 to-slate-200/90 dark:from-[#1E2232] dark:to-[#171926] p-2 rounded-2xl border border-slate-300 dark:border-slate-700 text-center shadow-xs group-hover:border-[#800020] dark:group-hover:border-[#C99A45] transition-colors">
                  <span className="font-black text-[11px] sm:text-xs text-stone-900 dark:text-white block truncate">
                    {RAJASTHAN_50_DISTRICTS[topThree[1].districtId]?.nameHindi || topThree[1].nameHindi}
                  </span>
                  <span className="text-[9px] text-stone-500 dark:text-stone-400 block truncate">
                    {RAJASTHAN_50_DISTRICTS[topThree[1].districtId]?.nameEnglish}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono font-black text-[#800020] dark:text-amber-400 block mt-0.5">
                    {activeLeague === "total"
                      ? topThree[1].totalPoints.toLocaleString()
                      : `${topThree[1].avgScore} अंक`}
                  </span>
                  <span className="text-[8.5px] text-stone-500 block">
                    {topThree[1].activeWarriors} योद्धा
                  </span>
                  <span className="text-[8px] font-black text-[#800020] dark:text-[#C99A45] mt-1 block">
                    विवरण देखें →
                  </span>
                </div>
              </div>

              {/* Rank 1 (Gold Champion) */}
              <div
                onClick={() => handleOpenDistrictDetail(topThree[0].districtId)}
                className="flex flex-col items-center justify-end -mt-3 cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="relative flex flex-col items-center">
                  <Crown className="w-6 h-6 text-amber-400 animate-bounce -mb-1" />
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 text-stone-950 flex items-center justify-center font-black text-sm shadow-lg mb-1 border-2 border-white dark:border-stone-800">
                    🥇 1
                  </div>
                </div>
                <div className="w-full bg-gradient-to-b from-amber-50 to-amber-100/90 dark:from-[#2B2314] dark:to-[#1E1A12] p-2.5 rounded-2xl border-2 border-[#C99A45] text-center shadow-md group-hover:border-amber-400 transition-colors">
                  <span className="font-black text-xs sm:text-sm text-stone-950 dark:text-amber-200 block truncate">
                    {RAJASTHAN_50_DISTRICTS[topThree[0].districtId]?.nameHindi || topThree[0].nameHindi}
                  </span>
                  <span className="text-[9.5px] text-stone-600 dark:text-stone-300 block truncate">
                    {RAJASTHAN_50_DISTRICTS[topThree[0].districtId]?.nameEnglish}
                  </span>
                  <span className="text-[11px] sm:text-xs font-mono font-black text-[#800020] dark:text-amber-300 block mt-0.5">
                    {activeLeague === "total"
                      ? topThree[0].totalPoints.toLocaleString()
                      : `${topThree[0].avgScore} अंक`}
                  </span>
                  <span className="text-[9px] text-stone-600 dark:text-amber-200/80 block font-medium">
                    {topThree[0].activeWarriors} योद्धा
                  </span>
                  <span className="text-[8.5px] font-black text-amber-800 dark:text-amber-300 mt-1 block">
                    विवरण देखें →
                  </span>
                </div>
              </div>

              {/* Rank 3 (Bronze) */}
              <div
                onClick={() => handleOpenDistrictDetail(topThree[2].districtId)}
                className="flex flex-col items-center justify-end cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-white flex items-center justify-center font-black text-xs shadow-md mb-1 border border-white dark:border-stone-700">
                  🥉 3
                </div>
                <div className="w-full bg-gradient-to-b from-orange-50 to-orange-100/70 dark:from-[#241D18] dark:to-[#1A1614] p-2 rounded-2xl border border-amber-700/40 text-center shadow-xs group-hover:border-amber-600 transition-colors">
                  <span className="font-black text-[11px] sm:text-xs text-stone-900 dark:text-white block truncate">
                    {RAJASTHAN_50_DISTRICTS[topThree[2].districtId]?.nameHindi || topThree[2].nameHindi}
                  </span>
                  <span className="text-[9px] text-stone-500 dark:text-stone-400 block truncate">
                    {RAJASTHAN_50_DISTRICTS[topThree[2].districtId]?.nameEnglish}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono font-black text-[#800020] dark:text-amber-400 block mt-0.5">
                    {activeLeague === "total"
                      ? topThree[2].totalPoints.toLocaleString()
                      : `${topThree[2].avgScore} अंक`}
                  </span>
                  <span className="text-[8.5px] text-stone-500 block">
                    {topThree[2].activeWarriors} योद्धा
                  </span>
                  <span className="text-[8px] font-black text-amber-700 dark:text-amber-400 mt-1 block">
                    विवरण देखें →
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 50 DISTRICTS TABLE HEADER / STATS */}
        <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 px-1 font-bold">
          <span>
            दिखाए जा रहे ज़िले: <b className="text-stone-800 dark:text-stone-200">{filteredDistricts.length}</b> / 50
          </span>
          <span>
            {activeLeague === "total" ? "सॉर्ट: कुल वॉर अंक" : "सॉर्ट: औसत दक्षता"}
          </span>
        </div>

        {/* 50 DISTRICT ROWS */}
        <div className="space-y-1.5 pb-2">
          {filteredDistricts.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#161825] rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
              <Search className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-stone-600 dark:text-stone-300">
                कोई ज़िला नहीं मिला
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                खोज शब्द बदलें या संभाग फ़िल्टर रीसेट करें
              </p>
            </div>
          ) : (
            filteredDistricts.map((item) => {
              const isUserDistrict = userAffiliation?.districtId === item.districtId;
              const pctOfMax = Math.max(8, Math.round((item.totalPoints / maxPoints) * 100));
              const distInfo = RAJASTHAN_50_DISTRICTS[item.districtId];

              return (
                <div
                  key={item.districtId}
                  onClick={() => handleOpenDistrictDetail(item.districtId)}
                  className={`w-full p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer group active:scale-[0.99] ${
                    isUserDistrict
                      ? "bg-gradient-to-r from-[#800020]/10 via-[#800020]/5 to-transparent dark:from-[#800020]/30 dark:via-[#800020]/15 dark:to-transparent border-[#800020] dark:border-[#C99A45] shadow-xs ring-1 ring-[#800020]/30"
                      : item.rank === 1
                      ? "bg-amber-500/10 dark:bg-amber-500/15 border-[#C99A45]"
                      : "bg-white dark:bg-[#161825] border-stone-200 dark:border-stone-800/80 hover:border-[#800020]/60 dark:hover:border-[#C99A45]/60"
                  }`}
                >
                  {/* Left: Rank + District Identity */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        item.rank === 1
                          ? "bg-amber-400 text-stone-900 shadow-xs"
                          : item.rank === 2
                          ? "bg-slate-300 text-stone-800"
                          : item.rank === 3
                          ? "bg-amber-700/30 text-amber-800 dark:text-amber-300"
                          : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                      }`}
                    >
                      #{item.rank}
                    </div>

                    {/* Name + Division + Progress */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs sm:text-sm text-stone-900 dark:text-white truncate">
                          {distInfo?.nameHindi || item.nameHindi}
                        </span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">
                          ({distInfo?.nameEnglish})
                        </span>

                        {isUserDistrict && (
                          <span className="px-1.5 py-0.2 rounded-xs bg-[#800020] text-white text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5">
                            <Shield className="w-2.5 h-2.5 inline" /> आपकी सेना
                          </span>
                        )}

                        {item.rank === 1 && (
                          <span className="px-1.5 py-0.2 rounded-xs bg-amber-400 text-stone-950 text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5 inline" /> शीर्ष
                          </span>
                        )}

                        {distInfo?.isNew && (
                          <span className="px-1.5 py-0.2 rounded-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[8px] font-bold">
                            नवीन
                          </span>
                        )}
                      </div>

                      {/* Dynamic Progress Bar */}
                      <div className="w-full max-w-[150px] sm:max-w-[200px] bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.rank === 1
                              ? "bg-amber-400"
                              : isUserDistrict
                              ? "bg-[#800020] dark:bg-[#F47B20]"
                              : "bg-stone-400 dark:bg-stone-600"
                          }`}
                          style={{ width: `${pctOfMax}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: Score + Warriors + WhatsApp Share + Chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="font-mono font-black text-xs sm:text-sm text-stone-900 dark:text-white block">
                        {activeLeague === "total"
                          ? item.totalPoints.toLocaleString()
                          : `${item.avgScore} pts`}
                      </span>
                      <span className="text-[9px] text-stone-500 dark:text-stone-400 block font-medium">
                        {item.activeWarriors} योद्धा
                      </span>
                    </div>

                    {/* Quick WhatsApp Challenge Share */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareWhatsApp(item.districtId);
                      }}
                      title={`${distInfo?.nameHindi || item.nameHindi} के लिए व्हाट्सएप चुनौती भेजें`}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center transition active:scale-90 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-6 h-6 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 group-hover:text-[#800020] dark:group-hover:text-[#C99A45] group-hover:translate-x-0.5 transition-all">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= 6. STICKY BOTTOM ACTION DOCK ================= */}
      <footer className="p-2.5 sm:p-3 bg-white dark:bg-[#141622] border-t border-stone-200 dark:border-stone-800 shrink-0 flex items-center justify-between gap-2.5 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("medium");
            playClickSound();
            onClose();
            onOpenMap?.();
          }}
          className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs border border-stone-200 dark:border-stone-700"
        >
          <MapPin className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
          <span>लाइव 50 ज़िला नक्शा</span>
        </button>

        <button
          type="button"
          onClick={() => handleShareWhatsApp(userAffiliation?.districtId)}
          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>व्हाट्सएप चुनौती भेजें</span>
        </button>
      </footer>

      {/* ================= 7. WAR RULES MODAL ================= */}
      {showRulesModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#161825] rounded-3xl shadow-2xl border border-[#C99A45]/40 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-[#800020] to-[#F47B20] text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-sm sm:text-base">
                  राजस्थान 50 ज़िला महासंग्राम नियम
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 text-xs text-stone-700 dark:text-stone-300">
              <div className="bg-[#FFF9EF] dark:bg-[#1C2030] p-3 rounded-2xl border border-[#C99A45]/30">
                <h4 className="font-black text-sm text-[#800020] dark:text-[#C99A45] mb-1">
                  ⚔️ महासंग्राम क्या है?
                </h4>
                <p className="leading-relaxed text-[11.5px]">
                  यह राजस्थान के सभी 50 ज़िलों के अभ्यर्थियों का वास्तविक समय का ज्ञान युद्ध है। ऐप में आप जो भी सही अभ्यास करते हैं, उससे आपके गृह ज़िले को वॉर अंक मिलते हैं!
                </p>
              </div>

              <div>
                <h4 className="font-black text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
                  📈 अंक अर्जित करने के नियम:
                </h4>
                <div className="space-y-1.5 font-medium">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" /> प्रत्येक सही उत्तर
                    </span>
                    <b className="text-emerald-600 dark:text-emerald-400 font-mono font-black">+10 अंक</b>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                    <span className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-blue-500" /> संपूर्ण PYQ टेस्ट सबमिशन
                    </span>
                    <b className="text-emerald-600 dark:text-emerald-400 font-mono font-black">+25 अंक</b>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                    <span className="flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5 text-rose-500" /> 1v1 लाइव युद्ध में विजय
                    </span>
                    <b className="text-emerald-600 dark:text-emerald-400 font-mono font-black">+50 अंक</b>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#800020] dark:text-[#C99A45]" /> ज़िला सेना में शामिल होने पर
                    </span>
                    <b className="text-emerald-600 dark:text-emerald-400 font-mono font-black">+50 बोनस</b>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <h4 className="font-black text-xs text-amber-800 dark:text-amber-300 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> दक्षता लीग (Efficiency League) क्या है?
                </h4>
                <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
                  छोटे व नवीन ज़िलों (उदा. दूदू, अनूपगढ़, सलूम्बर) के पास भले ही कुल विद्यार्थी कम हों, लेकिन यदि उनका औसत प्रदर्शन शानदार है तो वे दक्षता लीग में नंबर #1 बन सकते हैं!
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800/80 text-[11px] text-stone-600 dark:text-stone-400">
                🔄 <b>साप्ताहिक रिसेट:</b> हर रविवार रात्रि 12:00 बजे साप्ताहिक स्कोर शून्य होकर नई वॉर शुरू होती है। विजेता ज़िले को विशेष "साप्ताहिक राज्य चैंपियन 👑" मुकुट मिलता है।
              </div>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-[#12141F] border-t border-stone-200 dark:border-stone-800 text-center">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#800020] to-[#F47B20] text-white font-black text-xs shadow-md active:scale-95 transition cursor-pointer"
              >
                समझ गया, युद्ध शुरू करें ⚔️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 8. DISTRICT SELECT MODAL ================= */}
      <DistrictSelectModal
        isOpen={isSelectDistrictOpen}
        onClose={() => setIsSelectDistrictOpen(false)}
        onSelected={() => {
          refreshData();
        }}
      />

      {/* ================= 9. FULL-PAGE DISTRICT DETAIL SHEET ================= */}
      {selectedDistrictForDetail && (
        <DistrictDetailSheet
          district={selectedDistrictForDetail}
          onClose={() => setSelectedDistrictForDetail(null)}
          onOpenMap={() => {
            setSelectedDistrictForDetail(null);
            onClose();
            onOpenMap?.();
          }}
        />
      )}
    </div>
  );
};
