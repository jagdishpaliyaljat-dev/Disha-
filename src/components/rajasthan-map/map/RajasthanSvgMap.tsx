import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { RAJASTHAN_DIVISIONS } from "../data/divisionsData";
import { RAJASTHAN_50_DISTRICTS } from "../data/districtsData";
import {
  DISTRICT_SVG_PATHS,
  DISTRICT_CENTROIDS,
  RAJASTHAN_STATE_OUTLINE_PATH,
} from "../data/districtPaths";
import { DivisionId } from "../types";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Navigation,
  CheckCircle2,
  XCircle,
  Mountain,
} from "lucide-react";
import { triggerHaptic, playClickSound } from "../../../utils/audioFeedback";

interface RajasthanSvgMapProps {
  selectedDistrictId?: string | null;
  onSelectDistrict: (districtId: string) => void;
  activeDivisionFilter?: DivisionId | null;
  searchHighlightedIds?: string[];
  // Quiz Mode Props
  quizTargetDistrictId?: string | null;
  isQuizMode?: boolean;
  quizFeedback?: {
    selectedDistrictId: string;
    isCorrect: boolean;
  } | null;
  onDistrictHover?: (districtId: string | null) => void;
}

export const RajasthanSvgMap: React.FC<RajasthanSvgMapProps> = ({
  selectedDistrictId,
  onSelectDistrict,
  activeDivisionFilter,
  searchHighlightedIds = [],
  quizTargetDistrictId,
  isQuizMode = false,
  quizFeedback = null,
  onDistrictHover,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(null);
  const [showAravalli, setShowAravalli] = useState<boolean>(true);

  // Drag & Touch Tracking Refs
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchDistRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-center on selected district if provided
  useEffect(() => {
    if (selectedDistrictId && DISTRICT_CENTROIDS[selectedDistrictId]) {
      const [cx, cy] = DISTRICT_CENTROIDS[selectedDistrictId];
      // Center SVG in 960x960 canvas (center is 480, 480)
      const targetX = (480 - cx) * (zoomLevel > 1.2 ? 0.7 : 0.4);
      const targetY = (480 - cy) * (zoomLevel > 1.2 ? 0.7 : 0.4);
      setPanOffset({ x: targetX, y: targetY });
    }
  }, [selectedDistrictId]);

  // Zoom Controls
  const handleZoomIn = () => {
    triggerHaptic("light");
    playClickSound();
    setZoomLevel((prev) => Math.min(Number((prev + 0.3).toFixed(2)), 3.2));
  };

  const handleZoomOut = () => {
    triggerHaptic("light");
    playClickSound();
    setZoomLevel((prev) => Math.max(Number((prev - 0.3).toFixed(2)), 0.75));
  };

  const handleResetZoom = () => {
    triggerHaptic("medium");
    playClickSound();
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // ================= MOUSE EVENTS (Desktop) =================
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - panOffset.x;
    const dy = e.clientY - panOffset.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMovedRef.current = true;
    }
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel Zoom (Desktop)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoomLevel((prev) => Math.min(Math.max(Number((prev + delta).toFixed(2)), 0.75), 3.2));
  };

  // ================= TOUCH EVENTS (Mobile) =================
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      hasMovedRef.current = false;
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      dragStartRef.current = { x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y };
      lastTouchDistRef.current = null;
    } else if (e.touches.length === 2) {
      // Pinch to zoom start
      setIsDragging(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      lastTouchDistRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      const moveDist = Math.hypot(
        touch.clientX - touchStartPosRef.current.x,
        touch.clientY - touchStartPosRef.current.y
      );
      if (moveDist > 6) {
        hasMovedRef.current = true;
      }
      setPanOffset({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y,
      });
    } else if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      // Pinch-to-zoom calculation
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = currentDist / lastTouchDistRef.current;

      if (Math.abs(1 - ratio) > 0.02) {
        hasMovedRef.current = true;
        setZoomLevel((prev) => {
          const next = prev * ratio;
          return Math.min(Math.max(Number(next.toFixed(2)), 0.75), 3.2);
        });
        lastTouchDistRef.current = currentDist;
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    lastTouchDistRef.current = null;
  };

  // District Tap Handler
  const handleDistrictClick = (districtId: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    // Ignore click if user was just panning/dragging across screen
    if (hasMovedRef.current) return;

    triggerHaptic("light");
    playClickSound();
    onSelectDistrict(districtId);
  };

  const handleSetHover = (districtId: string | null) => {
    setHoveredDistrictId(districtId);
    onDistrictHover?.(districtId);
  };

  const districtsList = useMemo(() => Object.values(RAJASTHAN_50_DISTRICTS), []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[360px] flex-1 bg-gradient-to-b from-[#FFF9EF]/90 via-[#FFFDF9] to-[#F7EFE1] dark:from-[#0E1017] dark:via-[#141622] dark:to-[#0B0D13] overflow-hidden select-none touch-none flex flex-col justify-center items-center"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* ================= FLOATING THUMB CONTROLS (Mobile Friendly Bottom Right) ================= */}
      <div className="absolute bottom-4 right-3.5 z-20 flex flex-col items-center gap-1.5 bg-white/95 dark:bg-[#1E222D]/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-[#C99A45]/40 touch-auto">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom In"
          title="बड़ा करें"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-[#800020]/10 dark:hover:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20] flex items-center justify-center transition active:scale-90 cursor-pointer"
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        {/* Zoom Level Indicator */}
        <span className="text-[10px] font-mono font-black text-[#52576A] dark:text-[#929AB0] px-1">
          {Math.round(zoomLevel * 100)}%
        </span>

        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom Out"
          title="छोटा करें"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-[#800020]/10 dark:hover:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20] flex items-center justify-center transition active:scale-90 cursor-pointer"
        >
          <ZoomOut className="w-5 h-5" />
        </button>

        <div className="w-6 h-px bg-stone-200 dark:bg-stone-700 my-0.5" />

        <button
          type="button"
          onClick={handleResetZoom}
          aria-label="Reset View"
          title="केंद्रित करें"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-[#800020]/10 dark:hover:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20] flex items-center justify-center transition active:scale-90 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* ================= COMPASS & TOP BADGE (Top Left) ================= */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-white/95 dark:bg-[#1E222D]/95 backdrop-blur-md px-2.5 py-1 rounded-full border border-[#C99A45]/30 shadow-xs">
          <Navigation className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
          <span className="text-[10px] sm:text-xs font-black text-[#800020] dark:text-[#F47B20]">N (उत्तर)</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowAravalli(!showAravalli);
          }}
          className={`pointer-events-auto flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition ${
            showAravalli
              ? "bg-[#C99A45]/20 border-[#C99A45] text-[#800020] dark:text-[#F47B20]"
              : "bg-white/80 dark:bg-[#1E222D]/80 border-stone-300 dark:border-stone-700 text-stone-500"
          }`}
          title="अरावली पर्वतमाला देखें/छिपाएं"
        >
          <Mountain className="w-3 h-3" />
          <span className="hidden xs:inline">अरावली</span>
        </button>
      </div>

      {/* ================= MAP TITLE & STATS PILL (Top Right) ================= */}
      <div className="absolute top-3 right-3 z-10 hidden sm:flex items-center gap-2 pointer-events-none">
        <div className="bg-white/90 dark:bg-[#1E222D]/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#C99A45]/30 shadow-xs text-[10px] font-black text-[#52576A] dark:text-stone-300">
          <span className="text-[#800020] dark:text-[#F47B20] font-black">50 ज़िले</span> • 10 संभाग
        </div>
      </div>

      {/* ================= MOBILE BOTTOM-LEFT DISTRICT PREVIEW PILL ================= */}
      {hoveredDistrictId && !isQuizMode && (
        <div className="absolute bottom-4 left-3 z-20 max-w-[210px] sm:max-w-xs bg-[#171923]/95 text-white backdrop-blur-md px-3 py-2 rounded-xl shadow-xl border border-[#C99A45]/40 pointer-events-none animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-xs sm:text-sm text-[#F47B20] truncate">
              {RAJASTHAN_50_DISTRICTS[hoveredDistrictId]?.nameHindi || hoveredDistrictId}
            </span>
            {RAJASTHAN_50_DISTRICTS[hoveredDistrictId]?.isNewDistrict && (
              <span className="px-1.5 py-0.2 text-[8px] font-black bg-amber-500 text-stone-900 rounded-sm">
                नया ज़िला
              </span>
            )}
          </div>
          <div className="text-[10px] text-stone-300 truncate">
            संभाग: {RAJASTHAN_DIVISIONS[RAJASTHAN_50_DISTRICTS[hoveredDistrictId]?.divisionId]?.nameHindi || "—"}
          </div>
        </div>
      )}

      {/* ================= HIGH-QUALITY REAL GIS VECTOR MAP CANVAS ================= */}
      <div className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden">
        <svg
          viewBox="0 0 960 960"
          className="w-full h-full max-w-full max-h-full block transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: "center center",
          }}
        >
          <defs>
            {/* Selected District Saffron Glow */}
            <filter id="map-selected-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#F47B20" floodOpacity="0.8" />
            </filter>
            {/* Hover Shadow */}
            <filter id="map-hover-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.25" />
            </filter>
            {/* State Outer Shadow */}
            <filter id="state-silhouette-shadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#800020" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* 1. Underlying Real State Mass Foundation */}
          <path
            d={RAJASTHAN_STATE_OUTLINE_PATH}
            filter="url(#state-silhouette-shadow)"
            className="fill-[#F8F3EA] dark:fill-[#12141C] stroke-[#C99A45]/30"
            strokeWidth="8"
            strokeLinejoin="round"
          />

          {/* 2. Authentic Geographic Polygonal Districts Layer (All 50 Districts) */}
          <g id="rajasthan-districts-polygons">
            {districtsList.map((district) => {
              const pathD = DISTRICT_SVG_PATHS[district.id];
              if (!pathD) return null;

              const division = RAJASTHAN_DIVISIONS[district.divisionId];
              const isSelected = selectedDistrictId === district.id;
              const isHovered = hoveredDistrictId === district.id;
              const isDivisionFiltered =
                activeDivisionFilter && district.divisionId !== activeDivisionFilter;
              const isSearchMatch = searchHighlightedIds.includes(district.id);
              const isQuizFeedbackTarget = quizFeedback?.selectedDistrictId === district.id;

              const baseColor = division?.color || "#800020";

              // Color resolution
              let fillColor = `${baseColor}44`;
              let strokeColor = "#4B5563";
              let strokeWidth = 1.3;

              if (isQuizFeedbackTarget) {
                fillColor = quizFeedback?.isCorrect ? "#16A34A" : "#DC2626";
                strokeColor = quizFeedback?.isCorrect ? "#22C55E" : "#EF4444";
                strokeWidth = 3;
              } else if (isSelected) {
                fillColor = baseColor;
                strokeColor = "#F47B20";
                strokeWidth = 3.5;
              } else if (isHovered) {
                fillColor = `${baseColor}CC`;
                strokeColor = "#C99A45";
                strokeWidth = 2.5;
              } else if (isSearchMatch) {
                fillColor = `${baseColor}88`;
                strokeColor = "#F47B20";
                strokeWidth = 2.8;
              }

              return (
                <path
                  key={district.id}
                  id={`district-path-${district.id}`}
                  d={pathD}
                  onClick={(e) => handleDistrictClick(district.id, e)}
                  onMouseEnter={() => handleSetHover(district.id)}
                  onMouseLeave={() => handleSetHover(null)}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  filter={isSelected ? "url(#map-selected-glow)" : isHovered ? "url(#map-hover-shadow)" : undefined}
                  className="cursor-pointer transition-all duration-150 active:opacity-80"
                  style={{
                    opacity: isDivisionFiltered ? 0.2 : 1,
                  }}
                />
              );
            })}
          </g>

          {/* 3. Aravalli Mountain Range Diagonal Spine Overlay */}
          {showAravalli && (
            <g id="aravalli-range-overlay" className="pointer-events-none opacity-40 dark:opacity-30">
              <path
                d="M 290 710 Q 420 620 520 480 T 690 320"
                fill="none"
                stroke="#8B5A2B"
                strokeWidth="18"
                strokeLinecap="round"
                strokeDasharray="4 8"
              />
              <path
                d="M 290 710 Q 420 620 520 480 T 690 320"
                fill="none"
                stroke="#C99A45"
                strokeWidth="2.5"
                strokeDasharray="8 6"
              />
              <text
                x="475"
                y="525"
                transform="rotate(-38, 475, 525)"
                textAnchor="middle"
                fill="#8B5A2B"
                className="dark:fill-[#E0B872] font-black text-[12px] tracking-widest uppercase select-none"
              >
                ▲ ▲ अरावली पर्वतमाला (Aravalli Range) ▲ ▲
              </text>
            </g>
          )}

          {/* 4. High-Precision Survey of India Outer Border Outline */}
          <path
            d={RAJASTHAN_STATE_OUTLINE_PATH}
            fill="none"
            stroke="#800020"
            strokeWidth="3.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="pointer-events-none opacity-80 dark:stroke-[#E2B755] dark:opacity-85"
            vectorEffect="non-scaling-stroke"
          />

          {/* 5. Geographic Centroid Labels & Interactive Thumb Hitboxes */}
          <g id="rajasthan-district-labels">
            {districtsList.map((district) => {
              const centroid = DISTRICT_CENTROIDS[district.id];
              if (!centroid) return null;
              const [cx, cy] = centroid;

              const isSelected = selectedDistrictId === district.id;
              const isHovered = hoveredDistrictId === district.id;
              const isDivisionFiltered =
                activeDivisionFilter && district.divisionId !== activeDivisionFilter;
              const isQuizFeedbackTarget = quizFeedback?.selectedDistrictId === district.id;
              const isSearchMatch = searchHighlightedIds.includes(district.id);

              const name = district.nameHindi;
              const badgeWidth = Math.max(name.length * 8.6 + 12, 34);
              const badgeHeight = 18;

              return (
                <g
                  key={`label-${district.id}`}
                  onClick={(e) => handleDistrictClick(district.id, e)}
                  onMouseEnter={() => handleSetHover(district.id)}
                  onMouseLeave={() => handleSetHover(null)}
                  className="cursor-pointer select-none"
                  style={{
                    opacity: isDivisionFiltered ? 0.25 : 1,
                  }}
                >
                  {/* Large Invisible Thumb Accessibility Touch Hitbox */}
                  <circle cx={cx} cy={cy} r={34} fill="transparent" className="cursor-pointer" />

                  {/* Pulsing Halo for Search Match */}
                  {isSearchMatch && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={24}
                      fill="none"
                      stroke="#F47B20"
                      strokeWidth="3"
                      className="animate-ping opacity-70 pointer-events-none"
                    />
                  )}

                  {/* District Label Pill Background */}
                  <rect
                    x={cx - badgeWidth / 2}
                    y={cy - badgeHeight / 2}
                    width={badgeWidth}
                    height={badgeHeight}
                    rx={5}
                    fill={
                      isSelected
                        ? "#800020"
                        : isHovered
                        ? "#171923"
                        : "rgba(255, 255, 255, 0.94)"
                    }
                    className="dark:fill-[#171923]/95 shadow-sm pointer-events-none"
                    stroke={
                      isSelected
                        ? "#F47B20"
                        : isHovered
                        ? "#C99A45"
                        : "#CBD5E1"
                    }
                    strokeWidth={isSelected ? 1.5 : 0.8}
                  />

                  {/* District Name Text (Hindi) */}
                  <text
                    x={cx}
                    y={cy + 4.2}
                    textAnchor="middle"
                    fill={isSelected ? "#FFF9EF" : isHovered ? "#F47B20" : "#1E293B"}
                    className="dark:fill-[#FFF9EF] font-black text-[10.5px] pointer-events-none tracking-tight select-none"
                  >
                    {name}
                  </text>

                  {/* Star Badge for 2023 Formed Districts */}
                  {district.isNewDistrict && (
                    <circle
                      cx={cx + badgeWidth / 2 - 2}
                      cy={cy - badgeHeight / 2 + 2}
                      r={4}
                      fill="#F47B20"
                      stroke="#FFF"
                      strokeWidth="1"
                      className="pointer-events-none"
                    />
                  )}

                  {/* Quiz Feedback Check/Cross Icon */}
                  {isQuizFeedbackTarget && (
                    <g transform={`translate(${cx - 12}, ${cy - 12})`} className="pointer-events-none">
                      <circle
                        cx="12"
                        cy="12"
                        r="11"
                        fill={quizFeedback?.isCorrect ? "#16A34A" : "#DC2626"}
                      />
                      <text
                        x="12"
                        y="16.5"
                        textAnchor="middle"
                        fill="#FFF"
                        fontSize="14"
                        fontWeight="bold"
                      >
                        {quizFeedback?.isCorrect ? "✓" : "✗"}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};
