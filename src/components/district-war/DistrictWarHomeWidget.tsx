import React from "react";
import { Swords, ChevronRight } from "lucide-react";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

interface DistrictWarHomeWidgetProps {
  onOpenWar: () => void;
}

export const DistrictWarHomeWidget: React.FC<DistrictWarHomeWidgetProps> = ({ onOpenWar }) => {
  const handleClick = () => {
    triggerHaptic("medium");
    playClickSound();
    onOpenWar();
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
          <h3 className="text-[13.5px] sm:text-[15.5px] font-black text-[#171923] dark:text-[#FFF9EF] leading-snug tracking-tight truncate">
            राजस्थान 50 ज़िला महासंग्राम
          </h3>
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
