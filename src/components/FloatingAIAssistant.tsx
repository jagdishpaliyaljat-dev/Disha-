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
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 group">
      <button
        type="button"
        onClick={() => {
          triggerHaptic("light");
          onOpen();
        }}
        aria-label="Open Disha AI Companion"
        title="Disha AI Companion — Ask any question or doubt"
        className="relative min-h-[46px] flex items-center gap-2 px-4 py-2.5 bg-[#7045D8] hover:bg-[#5B32BF] text-white font-black rounded-full shadow-lg shadow-[#7045D8]/30 hover:shadow-[#7045D8]/50 transition-all duration-200 active:scale-95 cursor-pointer border border-[#A78BFA]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] focus-visible:ring-offset-2"
      >
        <span className="relative flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
          <Sparkles className="w-3 h-3 text-amber-300 absolute -top-1.5 -right-1.5" />
        </span>
        <span className="text-xs tracking-tight font-black pr-0.5 text-white">
          Disha AI
        </span>
      </button>
    </div>
  );
};
