import React from "react";
import { Bot, Sparkles } from "lucide-react";
import { triggerHaptic } from "../utils/audioFeedback";

export interface FloatingAIAssistantProps {
  onOpen: () => void;
  isHidden?: boolean;
}

export const FloatingAIAssistant: React.FC<FloatingAIAssistantProps> = ({ onOpen, isHidden }) => {
  if (isHidden) return null;

  return (
    <div className="fixed bottom-22 md:bottom-8 right-4 sm:right-6 z-40 group">
      <button
        type="button"
        onClick={() => {
          triggerHaptic("light");
          onOpen();
        }}
        aria-label="Open Disha AI Companion"
        title="Disha AI Companion — Ask any question or doubt"
        className="relative min-h-[44px] flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-[#7045D8] to-[#5B32BF] hover:from-[#6339CA] hover:to-[#4F29AC] text-white font-bold rounded-full shadow-lg shadow-[#7045D8]/25 hover:shadow-[#7045D8]/45 transition-all duration-200 active:scale-95 cursor-pointer border border-white/20 backdrop-blur-md"
      >
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
        </div>
        <span className="text-xs tracking-tight font-black pr-1 text-white">
          Disha AI
        </span>
      </button>
    </div>
  );
};
