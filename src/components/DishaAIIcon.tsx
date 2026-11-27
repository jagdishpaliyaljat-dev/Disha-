import React from 'react';

export interface DishaAIIconProps {
  size?: number | string;
  className?: string;
  glow?: boolean;
}

/**
 * DishaAIIcon - Next-gen custom AI emblem for Disha AI Companion
 * Combines an intelligent 4-point radiant AI diamond, orbital satellite spark,
 * glowing core, and vibrant brand color gradient.
 */
export const DishaAIIcon: React.FC<DishaAIIconProps> = ({
  size = 24,
  className = "",
  glow = false,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${glow ? "filter drop-shadow-[0_0_10px_rgba(245,158,11,0.55)]" : ""} ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Core AI Diamond Gradient: Solar Gold to Radiant Magenta */}
        <linearGradient id="dishaAiCoreGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="25%" stopColor="#F59E0B" />
          <stop offset="65%" stopColor="#F43F5E" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        {/* Satellite Spark Gradient: Electric Sky to Brand Violet */}
        <linearGradient id="dishaAiSatGrad" x1="15" y1="2" x2="22" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>

        {/* Central Luminous Aura */}
        <radialGradient id="dishaAiCenterAura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#FDE047" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Primary Radiant 4-Point AI Star */}
      <path
        d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
        fill="url(#dishaAiCoreGrad)"
      />

      {/* Luminous Inner Core */}
      <circle cx="12" cy="12" r="3" fill="url(#dishaAiCenterAura)" />
      <circle cx="12" cy="12" r="1.2" fill="#FFFFFF" />

      {/* Orbiting Satellite AI Spark (Top-Right) */}
      <path
        d="M19 2C19 3.65685 17.6569 5 16 5C17.6569 5 19 6.34315 19 8C19 6.34315 20.3431 5 22 5C20.3431 5 19 3.65685 19 2Z"
        fill="url(#dishaAiSatGrad)"
      />

      {/* Micro Quantum Spark (Bottom-Left) */}
      <circle cx="5" cy="18.5" r="1.25" fill="#38BDF8" opacity="0.9" />
    </svg>
  );
};
