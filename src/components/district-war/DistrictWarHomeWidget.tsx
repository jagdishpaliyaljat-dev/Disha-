import React, { useState, useEffect } from "react";
import { Swords, Crown, ChevronRight, Shield, Sparkles } from "lucide-react";
import { districtWarService } from "./districtWarService";
import { DistrictWarScore, UserDistrictAffiliation } from "./types";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";
import { RAJASTHAN_50_DISTRICTS } from "../rajasthan-map/data/districtsData";

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

  const getDistrictHindiName = (districtId?: string, fallback = "") => {
    if (!districtId) return fallback;
    return RAJASTHAN_50_DISTRICTS[districtId]?.nameHindi || fallback;
  };

  return (
    <div
      onClick={handleClick}
      className="w-full bg-white dark:bg-[#1A1D2B] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#C99A45] active:scale-[0.99] rounded-2xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between text-left transition-all cursor-pointer group select-none"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-[#800020] to-[#A8002B] text-amber-300 flex items-center justify-center shrink-0 shadow-xs border border-[#C99A45]/30">
          <Swords className="w-5.5 h-5.5 sm:w-6 sm:h-6 animate-pulse" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-[13.5px] sm:text-[15.5px] font-black text-[#171923] dark:text-[#FFF9EF] leading-snug tracking-tight truncate">
              राजस्थान 50 ज़िला महासंग्राम
            </h3>
            <span className="px-1.5 py-0.2 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 border border-red-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-ping" />
              LIVE
            </span>
            {topDistricts[0] && (
              <span className="px-1.5 py-0.2 rounded-md bg-[#C99A45]/20 text-[#8C6016] dark:text-[#E2B755] text-[9px] font-black flex items-center gap-0.5">
                <Crown className="w-2.5 h-2.5 inline text-amber-500" /> #{getDistrictHindiName(topDistricts[0].districtId, topDistricts[0].nameHindi)}
              </span>
            )}
          </div>

          <div className="text-[10.5px] sm:text-[11.5px] font-semibold text-stone-500 dark:text-stone-400 truncate mt-0.5">
            {userAffiliation ? (
              <span>
                आपकी सेना: <b className="text-stone-800 dark:text-stone-100 font-bold">{getDistrictHindiName(userAffiliation.districtId, userAffiliation.districtNameHindi)}</b> (रैंक #{userRank || "—"}) •{" "}
                <b className="text-[#800020] dark:text-[#F47B20] font-black">+{userAffiliation.userPointsEarned} अंक</b>
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 inline text-amber-500 shrink-0" />
                <span>अपनी गृह सेना चुनें और पाएं +50 बोनस अंक</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 pl-2">
        <div className="w-8 h-8 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#C99A45] flex items-center justify-center group-hover:translate-x-1 transition-transform">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
