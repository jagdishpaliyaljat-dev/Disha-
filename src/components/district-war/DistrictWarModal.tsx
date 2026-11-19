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
} from "lucide-react";
import { districtWarService } from "./districtWarService";
import { DistrictWarScore, WarLeagueTab, DistrictWarEvent, UserDistrictAffiliation } from "./types";
import { DistrictSelectModal } from "./DistrictSelectModal";
import { RAJASTHAN_50_DISTRICTS } from "../rajasthan-map/data/districtsData";
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
  const [isSelectDistrictOpen, setIsSelectDistrictOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<DistrictWarScore[]>([]);
  const [liveEvents, setLiveEvents] = useState<DistrictWarEvent[]>([]);
  const [userAffiliation, setUserAffiliation] = useState<UserDistrictAffiliation | null>(null);

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

  const filteredDistricts = useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;
    return leaderboard.filter((item) => {
      const eng = (RAJASTHAN_50_DISTRICTS[item.districtId]?.nameEnglish || "").toLowerCase();
      const hin = item.nameHindi.toLowerCase();
      const q = searchQuery.toLowerCase();
      return eng.includes(q) || hin.includes(q);
    });
  }, [leaderboard, searchQuery]);

  if (!isOpen) return null;

  const topThree = leaderboard.slice(0, 3);
  const maxPoints = leaderboard[0]?.totalPoints || 1;

  const handleShareWhatsApp = (districtId?: string) => {
    triggerHaptic("medium");
    playClickSound();
    const url = districtWarService.getWhatsAppShareUrl(districtId);
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FDFBF7] dark:bg-[#0D0F18] text-stone-900 dark:text-stone-100 overflow-hidden select-none animate-in fade-in duration-200">
      {/* ================= 1. HEADER ================= */}
      <div className="bg-gradient-to-r from-[#800020] via-[#5A0016] to-[#F47B20] text-white p-3.5 sm:p-4 shrink-0 shadow-lg border-b border-[#C99A45]/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-amber-300 shadow-xs">
            <Swords className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm sm:text-lg tracking-tight leading-tight">
                Rajasthan 50 Districts War
              </h2>
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                LIVE
              </span>
            </div>
            <p className="text-[10.5px] sm:text-xs text-amber-200 font-medium">
              Every correct answer earns points for your district • Weekly reset: Sunday midnight
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer active:scale-95 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ================= 2. LIVE TICKER ================= */}
      <div className="bg-[#171923] text-white/90 px-3 py-1.5 text-[10.5px] font-medium flex items-center gap-2 shrink-0 overflow-hidden border-b border-stone-800">
        <span className="flex items-center gap-1 text-[#F47B20] font-black shrink-0 uppercase tracking-wider text-[9px] bg-[#F47B20]/15 px-1.5 py-0.5 rounded-sm">
          <Flame className="w-3 h-3 text-[#F47B20]" /> Live Activity
        </span>
        <div className="truncate flex-1">
          {liveEvents.length > 0 ? (
            <span>
              ⚡ <b>{RAJASTHAN_50_DISTRICTS[liveEvents[0].districtId]?.nameEnglish || liveEvents[0].districtNameHindi}</b>'s {liveEvents[0].warriorName} scored{" "}
              <b>+{liveEvents[0].pointsEarned} pts</b> ({liveEvents[0].actionText})
            </span>
          ) : (
            <span>Battle is raging across all 50 districts...</span>
          )}
        </div>
      </div>

      {/* ================= 3. USER DISTRICT STATUS BANNER ================= */}
      <div className="p-3 sm:p-4 bg-white dark:bg-[#141622] border-b border-stone-200 dark:border-stone-800 shrink-0 shadow-xs">
        {userAffiliation ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-[#FFF9EF] to-amber-50/50 dark:from-[#1E2230] dark:to-[#171926] p-3 rounded-2xl border border-[#C99A45]/40 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#800020] text-amber-300 flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                <Crown className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base text-stone-900 dark:text-white">
                    Your Army: {RAJASTHAN_50_DISTRICTS[userAffiliation.districtId]?.nameEnglish || userAffiliation.districtNameHindi}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#800020] text-white">
                    Rank #{districtWarService.getDistrictRank(userAffiliation.districtId, activeLeague)}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 dark:text-stone-300 font-medium">
                  Your Contribution:{" "}
                  <b className="text-[#800020] dark:text-[#F47B20]">
                    {userAffiliation.userPointsEarned} pts
                  </b>{" "}
                  • District Rank #{userAffiliation.userRankInDistrict}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleShareWhatsApp(userAffiliation.districtId)}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Rally Army 📲</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSelectDistrictOpen(true)}
                className="px-2.5 py-2 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-bold hover:bg-stone-300 transition cursor-pointer"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-amber-500/10 via-[#F47B20]/15 to-transparent p-3 rounded-2xl border border-amber-500/30">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-900 flex items-center justify-center font-black">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="font-black text-xs sm:text-sm text-stone-900 dark:text-white block">
                  You haven't joined a district army yet!
                </span>
                <span className="text-[10.5px] text-stone-600 dark:text-stone-400">
                  Select your home district and get +50 welcome bonus points immediately.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSelectDistrictOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#800020] to-[#F47B20] text-white font-black text-xs shadow-md active:scale-95 transition cursor-pointer shrink-0"
            >
              Join Army 🛡️
            </button>
          </div>
        )}
      </div>

      {/* ================= 4. DUAL LEAGUE TABS & SEARCH ================= */}
      <div className="p-3 bg-stone-100/70 dark:bg-[#12141F] border-b border-stone-200 dark:border-stone-800 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* League Selector */}
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
                : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Total Points</span>
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
                : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Efficiency (Avg Score)</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search 50 districts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#1A1D2C] text-xs rounded-xl border border-stone-200 dark:border-stone-700 focus:outline-hidden focus:border-[#C99A45]"
          />
        </div>
      </div>

      {/* ================= 5. LEADERBOARD LIST & PODIUM ================= */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
        {/* TOP 3 PODIUM (Visible when no search filter) */}
        {!searchQuery.trim() && topThree.length === 3 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-lg mx-auto pt-2 pb-4">
            {/* Rank 2 (Silver) */}
            <div className="flex flex-col items-center justify-end">
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 text-stone-800 dark:text-white flex items-center justify-center font-black text-xs shadow-md mb-1.5">
                🥈 2
              </div>
              <div className="w-full bg-gradient-to-b from-slate-100 to-slate-200 dark:from-[#1E2232] dark:to-[#171926] p-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 text-center shadow-xs">
                <span className="font-black text-xs sm:text-sm text-stone-900 dark:text-white block truncate">
                  {RAJASTHAN_50_DISTRICTS[topThree[1].districtId]?.nameEnglish || topThree[1].nameHindi}
                </span>
                <span className="text-[10px] sm:text-xs font-mono font-black text-[#800020] dark:text-amber-400 block">
                  {activeLeague === "total"
                    ? topThree[1].totalPoints.toLocaleString()
                    : `${topThree[1].avgScore} pts/student`}
                </span>
                <span className="text-[9px] text-stone-500 block">
                  {topThree[1].activeWarriors} warriors
                </span>
              </div>
            </div>

            {/* Rank 1 (Gold Champion) */}
            <div className="flex flex-col items-center justify-end -mt-3">
              <div className="relative">
                <Crown className="w-7 h-7 text-amber-500 absolute -top-5 left-1/2 -translate-x-1/2 animate-bounce" />
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 text-stone-900 flex items-center justify-center font-black text-sm shadow-lg mb-1.5 border-2 border-white dark:border-stone-800">
                  🥇 1
                </div>
              </div>
              <div className="w-full bg-gradient-to-b from-amber-50 to-amber-100 dark:from-[#2A2418] dark:to-[#1E1C16] p-3 rounded-2xl border-2 border-[#C99A45] text-center shadow-md">
                <span className="font-black text-sm sm:text-base text-stone-900 dark:text-amber-200 block truncate">
                  {RAJASTHAN_50_DISTRICTS[topThree[0].districtId]?.nameEnglish || topThree[0].nameHindi}
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-[#800020] dark:text-amber-300 block">
                  {activeLeague === "total"
                    ? topThree[0].totalPoints.toLocaleString()
                    : `${topThree[0].avgScore} pts/student`}
                </span>
                <span className="text-[9.5px] text-stone-600 dark:text-amber-100/70 block font-medium">
                  {topThree[0].activeWarriors} warriors
                </span>
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="flex flex-col items-center justify-end">
              <div className="w-8 h-8 rounded-full bg-amber-700/30 text-amber-800 dark:text-amber-400 flex items-center justify-center font-black text-xs shadow-md mb-1.5">
                🥉 3
              </div>
              <div className="w-full bg-gradient-to-b from-orange-50 to-orange-100/50 dark:from-[#221C18] dark:to-[#191614] p-2.5 rounded-2xl border border-amber-700/30 text-center shadow-xs">
                <span className="font-black text-xs sm:text-sm text-stone-900 dark:text-white block truncate">
                  {RAJASTHAN_50_DISTRICTS[topThree[2].districtId]?.nameEnglish || topThree[2].nameHindi}
                </span>
                <span className="text-[10px] sm:text-xs font-mono font-black text-[#800020] dark:text-amber-400 block">
                  {activeLeague === "total"
                    ? topThree[2].totalPoints.toLocaleString()
                    : `${topThree[2].avgScore} pts/student`}
                </span>
                <span className="text-[9px] text-stone-500 block">
                  {topThree[2].activeWarriors} warriors
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 50 DISTRICTS TABLE */}
        <div className="space-y-2">
          {filteredDistricts.map((item) => {
            const isUserDistrict = userAffiliation?.districtId === item.districtId;
            const pctOfMax = Math.round((item.totalPoints / maxPoints) * 100);

            return (
              <div
                key={item.districtId}
                className={`w-full p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isUserDistrict
                    ? "bg-[#800020]/10 dark:bg-[#800020]/30 border-[#800020] dark:border-[#C99A45] shadow-md ring-2 ring-[#800020]/20"
                    : item.rank === 1
                    ? "bg-amber-500/10 dark:bg-amber-500/20 border-[#C99A45]"
                    : "bg-white dark:bg-[#161825] border-stone-200 dark:border-stone-800 hover:border-stone-300"
                }`}
              >
                {/* Left: Rank & Name */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      item.rank === 1
                        ? "bg-amber-400 text-stone-900 shadow-sm"
                        : item.rank === 2
                        ? "bg-slate-300 text-stone-800"
                        : item.rank === 3
                        ? "bg-amber-700/30 text-amber-800 dark:text-amber-300"
                        : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                    }`}
                  >
                    #{item.rank}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-xs sm:text-sm text-stone-900 dark:text-white truncate">
                        {RAJASTHAN_50_DISTRICTS[item.districtId]?.nameEnglish || item.nameHindi}
                      </span>
                      {isUserDistrict && (
                        <span className="px-1.5 py-0.2 rounded-xs bg-[#800020] text-white text-[8px] font-black uppercase tracking-wider">
                          Your Army
                        </span>
                      )}
                      {item.rank === 1 && (
                        <span className="px-1.5 py-0.2 rounded-xs bg-amber-400 text-stone-900 text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5 inline" /> Crown
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full max-w-[180px] bg-stone-150 dark:bg-stone-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
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

                {/* Right: Scores & Share Action */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <span className="font-mono font-black text-xs sm:text-sm text-stone-900 dark:text-white block">
                      {activeLeague === "total"
                        ? item.totalPoints.toLocaleString()
                        : `${item.avgScore}`}
                    </span>
                    <span className="text-[9px] text-stone-500 block">
                      {item.activeWarriors} warriors
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(item.districtId)}
                    title={`Send WhatsApp challenge for ${RAJASTHAN_50_DISTRICTS[item.districtId]?.nameEnglish || item.nameHindi} army`}
                    className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center transition active:scale-90 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= 6. STICKY BOTTOM BAR ================= */}
      <div className="p-3 bg-white dark:bg-[#141622] border-t border-stone-200 dark:border-stone-800 shrink-0 flex items-center justify-between gap-3 shadow-lg">
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenMap?.();
          }}
          className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <MapPin className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
          <span>View Live Map Status</span>
        </button>

        <button
          type="button"
          onClick={() => handleShareWhatsApp(userAffiliation?.districtId)}
          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>Send WhatsApp Challenge</span>
        </button>
      </div>

      {/* District Select Onboarding Modal */}
      <DistrictSelectModal
        isOpen={isSelectDistrictOpen}
        onClose={() => setIsSelectDistrictOpen(false)}
        onSelected={(distId) => {
          refreshData();
        }}
      />
    </div>
  );
};
