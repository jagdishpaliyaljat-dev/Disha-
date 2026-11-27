import React from "react";
import { DishaAIIcon } from "./DishaAIIcon";
import { triggerHaptic } from "../utils/audioFeedback";

export interface FloatingAIAssistantProps {
  onOpen: () => void;
  isHidden?: boolean;
}

export const FloatingAIAssistant: React.FC<FloatingAIAssistantProps> = ({ onOpen, isHidden }) => {
  if (isHidden) return null;

  return (
    <aside
      aria-label="Disha AI Companion Trigger"
      className="fixed bottom-24 md:bottom-8 right-3.5 sm:right-6 z-40 group pointer-events-auto select-none"
    >
      <button
        type="button"
        onClick={() => {
          triggerHaptic("light");
          onOpen();
        }}
        aria-label="Open Disha AI Companion"
        title="Disha AI Companion — 24x7 Rajasthan Exam AI Mentor"
        className="relative min-h-[44px] flex items-center gap-2 pl-2 pr-3.5 py-1.5 bg-gradient-to-r from-[#7045D8] via-[#6339CA] to-[#4F29AC] hover:from-[#7C3AED] hover:to-[#5B32BF] text-white font-bold rounded-full shadow-[0_8px_24px_rgba(112,69,216,0.38)] hover:shadow-[0_12px_28px_rgba(112,69,216,0.5)] transition-all duration-300 active:scale-95 cursor-pointer border border-white/25 backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C084FC]"
      >
        {/* Ambient Glow Halo */}
        <span
          className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-400/25 via-purple-500/25 to-sky-400/25 blur-xs opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none"
          aria-hidden="true"
        />

        {/* Next-Gen Disha AI Emblem Container */}
        <div className="relative w-7 h-7 rounded-full bg-white/20 border border-white/35 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
          <DishaAIIcon size={18} glow />
        </div>

        {/* AI Brand Label & Live Status Indicator */}
        <div className="relative flex items-center gap-1.5 leading-none">
          <span className="text-xs tracking-tight font-black text-white whitespace-nowrap">
            Disha AI
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0 ring-1 ring-emerald-300/50"
            title="AI Mentor Online"
            aria-hidden="true"
          />
        </div>
      </button>
    </aside>
  );
};
