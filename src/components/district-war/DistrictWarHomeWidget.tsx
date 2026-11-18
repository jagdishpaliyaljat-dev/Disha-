import React, { useState, useEffect } from "react";
import { Swords, Crown, ChevronRight } from "lucide-react";
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
      className="w-full bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#F47B20] active:scale-[0.99] rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs flex items-center justify-between text-left transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#800020]/10 dark:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
          <Swords className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <h3 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-tight">
              राजस्थान 50 ज़िला महासंग्राम
            </h3>
            <span className="px-1.5 py-0.5 rounded-md bg-[#800020]/10 dark:bg-[#800020]/25 text-[#800020] dark:text-[#F47B20] text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#800020] dark:bg-[#F47B20] inline-block animate-ping" />
              LIVE WAR
            </span>
            {topDistricts[0] && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#C99A45]/15 text-[#946B1E] dark:text-[#C99A45] text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-0.5">
                <Crown className="w-2.5 h-2.5 inline" /> #{topDistricts[0].nameHindi}
              </span>
            )}
          </div>

          <div className="text-[10px] sm:text-[11px] font-medium text-[#52576A] dark:text-[#929AB0] truncate leading-tight">
            {userAffiliation ? (
              <span>
                आपकी सेना: <b className="text-[#171923] dark:text-[#FFF9EF] font-bold">{userAffiliation.districtNameHindi}</b> (रैंक #{userRank || "—"}) •{" "}
                <b className="text-[#800020] dark:text-[#F47B20] font-bold">+{userAffiliation.userPointsEarned} अंक</b>
              </span>
            ) : (
              <span>
                🥇 #1 {topDistricts[0]?.nameHindi || "सीकर"} • 🥈 #2 {topDistricts[1]?.nameHindi || "जोधपुर"} • 🥉 #3 {topDistricts[2]?.nameHindi || "जयपुर"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 pl-2">
        <span className="hidden sm:inline-block text-xs font-extrabold text-[#800020] dark:text-[#F47B20]">
          वॉर लीडरबोर्ड
        </span>
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center group-hover:translate-x-1 transition-transform">
          <ChevronRight className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
        </div>
      </div>
    </div>
  );
};
