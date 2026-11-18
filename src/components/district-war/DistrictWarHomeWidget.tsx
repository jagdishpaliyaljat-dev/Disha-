import React, { useState, useEffect } from "react";
import { Swords, Crown, ChevronRight, Flame, Shield, Trophy } from "lucide-react";
import { districtWarService } from "./districtWarService";
import { DistrictWarScore, UserDistrictAffiliation } from "./types";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

interface DistrictWarHomeWidgetProps {
  onOpenWar: () => void;
}

export const DistrictWarHomeWidget: React.FC<DistrictWarHomeWidgetProps> = ({ onOpenWar }) => {
  const [topDistricts, setTopDistricts] = useState<DistrictWarScore[]>([]);
  const [userAffiliation, setUserAffiliation] = useState<UserDistrictAffiliation | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  const loadData = () => {
    const top = districtWarService.getTopThree("total");
    setTopDistricts(top);
    const aff = districtWarService.getUserContribution();
    setUserAffiliation(aff);
    if (aff) {
      setUserRank(districtWarService.getDistrictRank(aff.districtId, "total"));
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("disha:district-war-updated", handleUpdate);
    return () => window.removeEventListener("disha:district-war-updated", handleUpdate);
  }, []);

  const handleClick = () => {
    triggerHaptic("medium");
    playClickSound();
    onOpenWar();
  };

  return (
    <div
      onClick={handleClick}
      className="w-full bg-gradient-to-r from-[#800020] via-[#5C0318] to-[#D97706] hover:brightness-105 active:scale-[0.99] border border-[#C99A45]/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md flex items-center justify-between text-left transition-all cursor-pointer group relative overflow-hidden"
    >
      {/* Background Animated Glow */}
      <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-amber-400/25 to-transparent rounded-full blur-xl pointer-events-none" />

      <div className="flex items-center gap-3 min-w-0 flex-1 relative z-10">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/15 border border-white/25 text-amber-300 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
          <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 animate-pulse" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-xs sm:text-sm font-black tracking-tight text-white flex items-center gap-1">
              <span>राजस्थान 50 ज़िला महासंग्राम</span>
            </span>
            <span className="px-1.5 py-0.2 rounded-md bg-red-500 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block animate-ping" />
              LIVE WAR
            </span>
            {topDistricts[0] && (
              <span className="px-1.5 py-0.2 rounded-md bg-amber-400 text-stone-900 text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5">
                <Crown className="w-2.5 h-2.5 inline" /> #{topDistricts[0].nameHindi}
              </span>
            )}
          </div>

          <div className="text-[10.5px] sm:text-xs text-amber-100 font-medium truncate flex items-center gap-2">
            {userAffiliation ? (
              <span>
                आपकी सेना: <b>{userAffiliation.districtNameHindi}</b> (रैंक #{userRank || "—"}) •{" "}
                <b className="text-amber-300">+{userAffiliation.userPointsEarned} अंक</b>
              </span>
            ) : (
              <span>
                🥇 #1 {topDistricts[0]?.nameHindi || "सीकर"} • 🥈 #2 {topDistricts[1]?.nameHindi || "जोधपुर"} • 🥉 #3 {topDistricts[2]?.nameHindi || "जयपुर"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 pl-2 relative z-10">
        <span className="hidden sm:inline-block text-xs font-black text-amber-200">
          वॉर लीडरबोर्ड
        </span>
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/15 flex items-center justify-center group-hover:translate-x-1 transition-transform">
          <ChevronRight className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
};
