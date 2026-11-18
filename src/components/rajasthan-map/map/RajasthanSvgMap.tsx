import React, { useState, useRef, useEffect, useCallback } from "react";
import { RAJASTHAN_DIVISIONS } from "../data/divisionsData";
import { RAJASTHAN_50_DISTRICTS } from "../data/districtsData";
import { DISTRICT_SVG_NODES, DistrictSvgNode } from "./districtCoordinates";
import { DivisionId } from "../types";
import { ZoomIn, ZoomOut, RotateCcw, Navigation, CheckCircle2, XCircle, Compass } from "lucide-react";
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

  // Drag & Touch Tracking Refs
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchDistRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-center on selected district if provided
  useEffect(() => {
    if (selectedDistrictId && DISTRICT_SVG_NODES[selectedDistrictId]) {
      const node = DISTRICT_SVG_NODES[selectedDistrictId];
      // Center SVG node (880x860 canvas center is 440, 430)
      const targetX = (440 - node.cx) * (zoomLevel > 1.2 ? 0.7 : 0.4);
      const targetY = (430 - node.cy) * (zoomLevel > 1.2 ? 0.7 : 0.4);
      setPanOffset({ x: targetX, y: targetY });
    }
  }, [selectedDistrictId]);

  // Zoom Controls
  const handleZoomIn = () => {
    triggerHaptic("light");
    playClickSound();
    setZoomLevel((prev) => Math.min(Number((prev + 0.3).toFixed(2)), 3.0));
  };

  const handleZoomOut = () => {
    triggerHaptic("light");
    playClickSound();
    setZoomLevel((prev) => Math.max(Number((prev - 0.3).toFixed(2)), 0.8));
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
    setZoomLevel((prev) => Math.min(Math.max(Number((prev + delta).toFixed(2)), 0.8), 3.0));
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
          return Math.min(Math.max(Number(next.toFixed(2)), 0.8), 3.0);
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

  const nodes = Object.values(DISTRICT_SVG_NODES);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[340px] flex-1 bg-gradient-to-b from-[#FFF9EF]/90 via-[#FFFDF9] to-[#F7EFE1] dark:from-[#111318] dark:via-[#171923] dark:to-[#0F1117] overflow-hidden select-none touch-none flex flex-col justify-center items-center"
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

      {/* ================= COMPASS INDICATOR (Top Left) ================= */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/90 dark:bg-[#1E222D]/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-[#C99A45]/30 shadow-xs pointer-events-none">
        <Navigation className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
        <span className="text-[10px] sm:text-xs font-black text-[#800020] dark:text-[#F47B20]">N (उत्तर)</span>
      </div>

      {/* ================= MOBILE BOTTOM-LEFT DISTRICT PREVIEW PILL ================= */}
      {hoveredDistrictId && !isQuizMode && (
        <div className="absolute bottom-4 left-3 z-20 max-w-[200px] sm:max-w-xs bg-[#171923]/95 text-white backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-[#C99A45]/40 pointer-events-none animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-xs sm:text-sm text-[#F47B20] truncate">
              {RAJASTHAN_50_DISTRICTS[hoveredDistrictId]?.nameHindi || hoveredDistrictId}
            </span>
            {RAJASTHAN_50_DISTRICTS[hoveredDistrictId]?.isNewDistrict && (
              <span className="px-1.5 py-0.2 text-[8px] font-black bg-amber-500 text-stone-900 rounded-sm">
                नया
              </span>
            )}
          </div>
          <div className="text-[10px] text-stone-300 truncate">
            {RAJASTHAN_DIVISIONS[RAJASTHAN_50_DISTRICTS[hoveredDistrictId]?.divisionId]?.nameHindi}
          </div>
        </div>
      )}

      {/* ================= SVG VECTOR CANVAS ================= */}
      <div
        className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
      >
        <svg
          viewBox="0 0 880 860"
          className="w-full h-full max-w-full max-h-full block transition-transform duration-75 ease-out"
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
            className="text-[#C99A45]/20 dark:text-[#C99A45]/15 pointer-events-none"
            strokeWidth="2"
          />

          {/* District Nodes & Interactive Touch Hit-Boxes */}
          {nodes.map((node) => {
            const district = RAJASTHAN_50_DISTRICTS[node.id];
            const division = district ? RAJASTHAN_DIVISIONS[district.divisionId] : null;
            const isSelected = selectedDistrictId === node.id;
            const isHovered = hoveredDistrictId === node.id;
            const isDivisionFiltered = activeDivisionFilter && district?.divisionId !== activeDivisionFilter;
            const isSearchMatch = searchHighlightedIds.includes(node.id);
            const isQuizFeedbackTarget = quizFeedback?.selectedDistrictId === node.id;
            const isTargetInQuiz = quizTargetDistrictId === node.id;

            const baseColor = division?.color || "#800020";

            return (
              <g
                key={node.id}
                onClick={(e) => handleDistrictClick(node.id, e)}
                onMouseEnter={() => handleSetHover(node.id)}
                onMouseLeave={() => handleSetHover(null)}
                className="cursor-pointer transition-all duration-150"
                style={{
                  opacity: isDivisionFiltered ? 0.22 : 1,
                  transform: isHovered || isSelected ? `scale(1.05)` : "scale(1)",
                  transformOrigin: `${node.cx}px ${node.cy}px`,
                }}
              >
                {/* 1. Generous Invisible Touch-Target Circle for Thumb Accessibility on Mobile */}
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={Math.max(node.rx + 16, 32)}
                  fill="transparent"
                  className="cursor-pointer"
                />

                {/* 2. Search Match Halo Glow */}
                {isSearchMatch && (
                  <ellipse
                    cx={node.cx}
                    cy={node.cy}
                    rx={node.rx + 12}
                    ry={node.ry + 10}
                    fill="none"
                    stroke="#F47B20"
                    strokeWidth="4"
                    className="animate-ping opacity-60 pointer-events-none"
                  />
                )}

                {/* 3. Selected District Outer Halo */}
                {isSelected && !isQuizMode && (
                  <ellipse
                    cx={node.cx}
                    cy={node.cy}
                    rx={node.rx + 6}
                    ry={node.ry + 6}
                    fill="none"
                    stroke="#F47B20"
                    strokeWidth="3.5"
                    className="animate-pulse pointer-events-none"
                  />
                )}

                {/* 4. District Elliptical Body */}
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

                {/* 5. Mobile-Readable Label Container Pill */}
                <rect
                  x={node.cx - (node.nameHindi.length * 4.4 + 6)}
                  y={node.cy - 10}
                  width={node.nameHindi.length * 8.8 + 12}
                  height={20}
                  rx={6}
                  fill={isSelected ? "#800020" : isHovered ? "#171923" : "rgba(255,255,255,0.92)"}
                  className="dark:fill-[#171923]/90 shadow-sm pointer-events-none"
                  stroke={isSelected ? "#C99A45" : "#E2E8F0"}
                  strokeWidth="0.8"
                />

                {/* 6. District Name Text (Hindi) */}
                <text
                  x={node.cx}
                  y={node.cy + 4.5}
                  textAnchor="middle"
                  fill={isSelected ? "#FFF9EF" : isHovered ? "#F47B20" : "#171923"}
                  className="dark:fill-[#FFF9EF] font-black text-[11px] pointer-events-none tracking-tight"
                >
                  {node.nameHindi}
                </text>

                {/* 7. Star Badge for 2023 Formed Districts */}
                {district?.isNewDistrict && (
                  <circle
                    cx={node.cx + node.rx - 4}
                    cy={node.cy - node.ry + 4}
                    r={5}
                    fill="#F47B20"
                    stroke="#FFF"
                    strokeWidth="1.2"
                    className="pointer-events-none"
                  />
                )}

                {/* 8. Quiz Feedback Visual SVG Icon */}
                {isQuizFeedbackTarget && (
                  <g transform={`translate(${node.cx - 12}, ${node.cy - 12})`} className="pointer-events-none">
                    <circle cx="12" cy="12" r="11" fill={quizFeedback?.isCorrect ? "#16A34A" : "#DC2626"} />
                    <text
                      x="12"
                      y="16"
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
        </svg>
      </div>
    </div>
  );
};
