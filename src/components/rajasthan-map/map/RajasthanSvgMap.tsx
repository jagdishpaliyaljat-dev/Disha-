import React, { useState, useRef } from "react";
import { RAJASTHAN_DIVISIONS } from "../data/divisionsData";
import { RAJASTHAN_50_DISTRICTS } from "../data/districtsData";
import { DISTRICT_SVG_NODES, DistrictSvgNode } from "./districtCoordinates";
import { DivisionId } from "../types";
import { ZoomIn, ZoomOut, RotateCcw, Navigation, CheckCircle2, XCircle } from "lucide-react";
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
}

export const RajasthanSvgMap: React.FC<RajasthanSvgMapProps> = ({
  selectedDistrictId,
  onSelectDistrict,
  activeDivisionFilter,
  searchHighlightedIds = [],
  quizTargetDistrictId,
  isQuizMode = false,
  quizFeedback = null,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(null);

  const handleZoomIn = () => {
    triggerHaptic("light");
    playClickSound();
    setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    triggerHaptic("light");
    playClickSound();
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  };

  const handleResetZoom = () => {
    triggerHaptic("medium");
    playClickSound();
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDistrictClick = (districtId: string) => {
    triggerHaptic("light");
    playClickSound();
    onSelectDistrict(districtId);
  };

  const nodes = Object.values(DISTRICT_SVG_NODES);

  return (
    <div className="relative w-full h-[520px] sm:h-[620px] md:h-[680px] bg-gradient-to-b from-[#FFF9EF]/90 via-[#FFFDF9] to-[#F7EFE1] dark:from-[#111318] dark:via-[#171923] dark:to-[#0F1117] rounded-3xl border-2 border-[#C99A45]/30 dark:border-[#C99A45]/20 overflow-hidden shadow-2xl select-none">
      {/* Map Control Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-white/90 dark:bg-[#1E222D]/90 backdrop-blur-md p-2 rounded-2xl shadow-lg border border-[#C99A45]/40">
        <button
          onClick={handleZoomIn}
          title="Zoom In (ज़ूम करें)"
          className="p-2.5 rounded-xl hover:bg-[#800020]/10 dark:hover:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20] transition active:scale-95"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out (छोटा करें)"
          className="p-2.5 rounded-xl hover:bg-[#800020]/10 dark:hover:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20] transition active:scale-95"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleResetZoom}
          title="Reset View (केंद्रित करें)"
          className="p-2.5 rounded-xl hover:bg-[#800020]/10 dark:hover:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20] transition active:scale-95"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Compass / Orientation Indicator */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/85 dark:bg-[#1E222D]/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#C99A45]/30 shadow-md pointer-events-none">
        <Navigation className="w-4 h-4 text-[#800020] dark:text-[#F47B20] animate-pulse" />
        <span className="text-xs font-bold text-[#800020] dark:text-[#F47B20]">N (उत्तर)</span>
      </div>

      {/* Hover Info Tooltip */}
      {hoveredDistrictId && !isQuizMode && (
        <div className="absolute bottom-4 left-4 z-20 bg-[#171923]/95 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-[#C99A45]/50 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base text-[#F47B20]">
              {RAJASTHAN_50_DISTRICTS[hoveredDistrictId]?.nameHindi || hoveredDistrictId}
            </span>
            {RAJASTHAN_50_DISTRICTS[hoveredDistrictId]?.isNewDistrict && (
              <span className="px-2 py-0.5 text-[10px] font-black bg-amber-500 text-stone-900 rounded-full tracking-wide">
                नया ज़िला
              </span>
            )}
          </div>
          <div className="text-xs text-stone-300">
            {RAJASTHAN_DIVISIONS[RAJASTHAN_50_DISTRICTS[hoveredDistrictId]?.divisionId]?.nameHindi}
          </div>
        </div>
      )}

      {/* SVG Vector Canvas */}
      <div
        className="w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          viewBox="0 0 880 860"
          className="w-full h-full transition-transform duration-100 ease-out"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: "center center",
          }}
        >
          {/* Subtle Rajasthan Outer Rhomboid Contour Guide */}
          <polygon
            points="330,60 760,320 620,720 390,830 180,630 80,410"
            fill="none"
            stroke="currentColor"
            strokeDasharray="6 6"
            className="text-[#C99A45]/20 dark:text-[#C99A45]/15"
            strokeWidth="2"
          />

          {/* Division Connecting Constellations */}
          {nodes.map((node) => {
            const district = RAJASTHAN_50_DISTRICTS[node.id];
            const division = district ? RAJASTHAN_DIVISIONS[district.divisionId] : null;
            const isSelected = selectedDistrictId === node.id;
            const isHovered = hoveredDistrictId === node.id;
            const isDivisionFiltered = activeDivisionFilter && district?.divisionId !== activeDivisionFilter;
            const isSearchMatch = searchHighlightedIds.includes(node.id);
            const isQuizFeedbackTarget = quizFeedback?.selectedDistrictId === node.id;

            const baseColor = division?.color || "#800020";

            return (
              <g
                key={node.id}
                onClick={() => handleDistrictClick(node.id)}
                onMouseEnter={() => setHoveredDistrictId(node.id)}
                onMouseLeave={() => setHoveredDistrictId(null)}
                className="cursor-pointer transition-all duration-200"
                style={{
                  opacity: isDivisionFiltered ? 0.25 : 1,
                  transform: isHovered || isSelected ? `scale(1.06)` : "scale(1)",
                  transformOrigin: `${node.cx}px ${node.cy}px`,
                }}
              >
                {/* Search Match Halo Glow */}
                {isSearchMatch && (
                  <ellipse
                    cx={node.cx}
                    cy={node.cy}
                    rx={node.rx + 12}
                    ry={node.ry + 10}
                    fill="none"
                    stroke="#F47B20"
                    strokeWidth="4"
                    className="animate-ping opacity-60"
                  />
                )}

                {/* Selected District Outer Halo */}
                {isSelected && !isQuizMode && (
                  <ellipse
                    cx={node.cx}
                    cy={node.cy}
                    rx={node.rx + 6}
                    ry={node.ry + 6}
                    fill="none"
                    stroke="#F47B20"
                    strokeWidth="3.5"
                    className="animate-pulse"
                  />
                )}

                {/* District Elliptical Body */}
                <ellipse
                  cx={node.cx}
                  cy={node.cy}
                  rx={node.rx}
                  ry={node.ry}
                  fill={
                    isQuizFeedbackTarget
                      ? quizFeedback?.isCorrect
                        ? "#16A34A"
                        : "#DC2626"
                      : isSelected
                      ? baseColor
                      : isHovered
                      ? `${baseColor}CC`
                      : `${baseColor}30`
                  }
                  stroke={
                    isQuizFeedbackTarget
                      ? quizFeedback?.isCorrect
                        ? "#22C55E"
                        : "#EF4444"
                      : isSelected
                      ? "#C99A45"
                      : isHovered
                      ? baseColor
                      : `${baseColor}99`
                  }
                  strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.5}
                  className="transition-colors duration-200"
                />

                {/* Small Pill / Label Container */}
                <rect
                  x={node.cx - (node.nameHindi.length * 4.6 + 6)}
                  y={node.cy - 10}
                  width={node.nameHindi.length * 9.2 + 12}
                  height={20}
                  rx={6}
                  fill={isSelected ? "#800020" : isHovered ? "#171923" : "rgba(255,255,255,0.92)"}
                  className="dark:fill-[#171923]/90 shadow-sm"
                  stroke={isSelected ? "#C99A45" : "#E2E8F0"}
                  strokeWidth="0.8"
                />

                {/* District Name Text (Hindi) */}
                <text
                  x={node.cx}
                  y={node.cy + 4}
                  textAnchor="middle"
                  fill={isSelected ? "#FFF9EF" : isHovered ? "#F47B20" : "#171923"}
                  className="dark:fill-[#FFF9EF] font-bold text-[11px] pointer-events-none tracking-tight"
                >
                  {node.nameHindi}
                </text>

                {/* "NEW" Star Badge for 2023 Formed Districts */}
                {district?.isNewDistrict && (
                  <circle
                    cx={node.cx + node.rx - 5}
                    cy={node.cy - node.ry + 5}
                    r={5.5}
                    fill="#F47B20"
                    stroke="#FFF"
                    strokeWidth="1.2"
                  />
                )}

                {/* Quiz Success / Error Overlay Icons */}
                {isQuizFeedbackTarget && (
                  <g transform={`translate(${node.cx - 12}, ${node.cy - 12})`}>
                    {quizFeedback?.isCorrect ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 fill-emerald-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400 fill-red-600" />
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
