import React, { useState, useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import { DailyStudyRecord } from "../types";
import {
  TrendingUp,
  Award,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  BarChart2,
} from "lucide-react";

interface StudyAnalyticsChartProps {
  data: DailyStudyRecord[];
  isDarkMode?: boolean;
}

export const StudyAnalyticsChart: React.FC<StudyAnalyticsChartProps> = ({
  data,
  isDarkMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(360);
  const [chartMode, setChartMode] = useState<"grouped" | "stacked">("grouped");
  const [activeHoverIndex, setActiveHoverIndex] = useState<number | null>(null);

  // ResizeObserver for responsive width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Summary Metrics over the 7 days
  const metrics = useMemo<{
    totalQuestions: number;
    totalCorrect: number;
    totalWrong: number;
    avgAccuracy: number;
    peakDay: DailyStudyRecord | null;
  }>(() => {
    let totalCorrect = 0;
    let totalWrong = 0;
    let peakDay: DailyStudyRecord | null = null;

    data.forEach((d) => {
      totalCorrect += d.correct;
      totalWrong += d.wrong;
      if (!peakDay || d.total > peakDay.total) {
        peakDay = d;
      }
    });

    const totalQuestions = totalCorrect + totalWrong;
    const avgAccuracy =
      totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    return {
      totalQuestions,
      totalCorrect,
      totalWrong,
      avgAccuracy,
      peakDay,
    };
  }, [data]);

  // Chart Dimensions
  const height = 230;
  const margin = { top: 28, right: 8, bottom: 44, left: 24 };
  const innerWidth = Math.max(containerWidth - margin.left - margin.right, 140);
  const innerHeight = height - margin.top - margin.bottom;

  // Max value for y-axis
  const maxY = useMemo(() => {
    if (chartMode === "grouped") {
      const highestBar = d3.max(data, (d) => Math.max(d.correct, d.wrong)) || 0;
      return Math.max(highestBar + 4, 10);
    } else {
      const highestTotal = d3.max(data, (d) => d.total) || 0;
      return Math.max(highestTotal + 5, 10);
    }
  }, [data, chartMode]);

  // D3 Scales
  const xScale = useMemo(() => {
    return d3
      .scaleBand<string>()
      .domain(data.map((d) => d.date))
      .range([0, innerWidth])
      .padding(0.24);
  }, [data, innerWidth]);

  const xSubScale = useMemo(() => {
    return d3
      .scaleBand<string>()
      .domain(["correct", "wrong"])
      .range([0, xScale.bandwidth()])
      .padding(0.12);
  }, [xScale]);

  const yScale = useMemo(() => {
    return d3.scaleLinear().domain([0, maxY]).range([innerHeight, 0]).nice();
  }, [maxY, innerHeight]);

  // Y-axis grid ticks (e.g. 4 horizontal reference lines)
  const yTicks = useMemo(() => {
    return yScale.ticks(4);
  }, [yScale]);

  const activeRecord = activeHoverIndex !== null ? data[activeHoverIndex] : null;

  return (
    <div
      id="study-analytics-section"
      className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-4 sm:p-5 shadow-xs transition-all"
    >
      {/* Header: Title, Subtitle, and View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#800020] dark:bg-[#F47B20]" />
            <h3 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] tracking-tight">
              Study Analytics
            </h3>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#800020] dark:text-[#F47B20] bg-[#F7EFE2] dark:bg-[#252A3A] px-2 py-0.5 rounded-full border border-[#E8D9C0] dark:border-[#31374A]">
              Last 7 Days
            </span>
          </div>
          <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] mt-0.5 ml-4.5 font-medium">
            Questions answered correctly vs. wrongly
          </p>
        </div>

        {/* Display Mode Toggle & Legend */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 ml-4 sm:ml-0">
          <div className="flex items-center gap-2 text-[11px] font-bold text-[#52576A] dark:text-[#CBD2E1]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 shadow-xs" />
              Correct
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#800020] dark:bg-[#F47B20] shadow-xs" />
              Wrong
            </span>
          </div>

          <div className="flex items-center bg-[#F7EFE2] dark:bg-[#252A3A] p-0.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A]">
            <button
              id="btn-chart-mode-grouped"
              onClick={() => setChartMode("grouped")}
              title="Side-by-side view"
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                chartMode === "grouped"
                  ? "bg-[#800020] text-white shadow-xs"
                  : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923]"
              }`}
            >
              <BarChart2 className="w-3 h-3" />
              Side
            </button>
            <button
              id="btn-chart-mode-stacked"
              onClick={() => setChartMode("stacked")}
              title="Stacked view"
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                chartMode === "stacked"
                  ? "bg-[#800020] text-white shadow-xs"
                  : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923]"
              }`}
            >
              <Layers className="w-3 h-3" />
              Stack
            </button>
          </div>
        </div>
      </div>

      {/* 3 Summary Badges */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-[#787D91] dark:text-[#929AB0] block font-bold uppercase tracking-wider">
            7-Day Total
          </span>
          <span className="text-base font-black text-[#171923] dark:text-[#FFF9EF] font-mono leading-tight tabular-nums">
            {metrics.totalQuestions}
          </span>
          <span className="text-[9px] text-[#787D91] dark:text-[#929AB0] block mt-0.5 font-medium">Questions</span>
        </div>

        <div className="bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-[#787D91] dark:text-[#929AB0] block font-bold uppercase tracking-wider">
            7-Day Accuracy
          </span>
          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono leading-tight tabular-nums">
            {metrics.avgAccuracy}%
          </span>
          <span className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 block mt-0.5 font-medium tabular-nums">
            {metrics.totalCorrect} right / {metrics.totalWrong} wrong
          </span>
        </div>

        <div className="bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-[#787D91] dark:text-[#929AB0] block font-bold uppercase tracking-wider">
            Best Activity
          </span>
          <span className="text-base font-black text-[#800020] dark:text-[#F47B20] font-mono leading-tight tabular-nums">
            {metrics.peakDay ? metrics.peakDay.dayLabel : "—"}
          </span>
          <span className="text-[9px] text-[#787D91] dark:text-[#929AB0] block mt-0.5 font-medium">
            {metrics.peakDay ? `${metrics.peakDay.total} Qs` : "0 Qs"}
          </span>
        </div>
      </div>

      {/* SVG D3 Bar Chart Container */}
      <div
        ref={containerRef}
        id="d3-analytics-chart-wrapper"
        className="w-full relative select-none overflow-hidden"
        onMouseLeave={() => setActiveHoverIndex(null)}
      >
        <svg
          width={containerWidth}
          height={height}
          className="overflow-visible block"
        >
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Horizontal Gridlines & Y-Axis Labels */}
            {yTicks.map((tick) => {
              const y = yScale(tick);
              return (
                <g key={tick} className="text-[#787D91] dark:text-[#929AB0]">
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    strokeOpacity={isDarkMode ? 0.25 : 0.4}
                  />
                  <text
                    x={-8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize={10}
                    fill="currentColor"
                    className="font-mono"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Zero Baseline */}
            <line
              x1={0}
              x2={innerWidth}
              y1={innerHeight}
              y2={innerHeight}
              stroke={isDarkMode ? "#31374A" : "#E8D9C0"}
              strokeWidth={1.5}
            />

            {/* Day Groups and Bars */}
            {data.map((dayData, index) => {
              const xPos = xScale(dayData.date) || 0;
              const bandWidth = xScale.bandwidth();
              const isHovered = activeHoverIndex === index;

              return (
                <g
                  key={dayData.date}
                  id={`bar-group-${dayData.date}`}
                  transform={`translate(${xPos}, 0)`}
                  onMouseEnter={() => setActiveHoverIndex(index)}
                  onClick={() =>
                    setActiveHoverIndex(activeHoverIndex === index ? null : index)
                  }
                  className="cursor-pointer"
                >
                  {/* Subtle hover background highlight */}
                  <rect
                    x={-bandWidth * 0.08}
                    y={-14}
                    width={bandWidth * 1.16}
                    height={innerHeight + 14}
                    fill={
                      isHovered
                        ? isDarkMode
                          ? "rgba(244, 123, 32, 0.12)"
                          : "rgba(128, 0, 32, 0.06)"
                        : "transparent"
                    }
                    rx={8}
                    className="transition-colors duration-150"
                  />

                  {chartMode === "grouped" ? (
                    <>
                      {/* Correct Bar (Emerald) */}
                      {(() => {
                        const subX = xSubScale("correct") || 0;
                        const barW = xSubScale.bandwidth();
                        const barH = innerHeight - yScale(dayData.correct);
                        const barY = yScale(dayData.correct);
                        return (
                          <g>
                            <rect
                              x={subX}
                              y={barY}
                              width={barW}
                              height={Math.max(barH, 0)}
                              fill={isHovered ? "#059669" : "#10b981"}
                              rx={Math.min(barW / 3, 4)}
                              className="transition-all duration-200"
                            />
                            {/* Numerical count label above bar */}
                            {dayData.correct > 0 && (
                              <text
                                x={subX + barW / 2}
                                y={barY - 4}
                                textAnchor="middle"
                                fontSize={9}
                                fontWeight={isHovered ? 700 : 600}
                                fill={isDarkMode ? "#34d399" : "#059669"}
                                className="font-mono"
                              >
                                {dayData.correct}
                              </text>
                            )}
                          </g>
                        );
                      })()}

                      {/* Wrong Bar (Royal Crimson / Maroon) */}
                      {(() => {
                        const subX = xSubScale("wrong") || 0;
                        const barW = xSubScale.bandwidth();
                        const barH = innerHeight - yScale(dayData.wrong);
                        const barY = yScale(dayData.wrong);
                        return (
                          <g>
                            <rect
                              x={subX}
                              y={barY}
                              width={barW}
                              height={Math.max(barH, 0)}
                              fill={isHovered ? "#991B1B" : "#800020"}
                              rx={Math.min(barW / 3, 4)}
                              className="transition-all duration-200"
                            />
                            {/* Numerical count label above bar */}
                            {dayData.wrong > 0 && (
                              <text
                                x={subX + barW / 2}
                                y={barY - 4}
                                textAnchor="middle"
                                fontSize={9}
                                fontWeight={isHovered ? 700 : 600}
                                fill={isDarkMode ? "#F47B20" : "#800020"}
                                className="font-mono"
                              >
                                {dayData.wrong}
                              </text>
                            )}
                          </g>
                        );
                      })()}
                    </>
                  ) : (
                    /* Stacked Mode: Correct at bottom, Wrong on top */
                    (() => {
                      const barW = bandWidth;
                      const correctH = innerHeight - yScale(dayData.correct);
                      const wrongH = innerHeight - yScale(dayData.wrong);
                      const totalH = correctH + wrongH;
                      const startY = innerHeight - totalH;

                      return (
                        <g>
                          {/* Correct segment */}
                          {dayData.correct > 0 && (
                            <rect
                              x={0}
                              y={innerHeight - correctH}
                              width={barW}
                              height={Math.max(correctH, 0)}
                              fill={isHovered ? "#059669" : "#10b981"}
                              rx={dayData.wrong === 0 ? 4 : 2}
                              className="transition-all duration-200"
                            />
                          )}

                          {/* Wrong segment */}
                          {dayData.wrong > 0 && (
                            <rect
                              x={0}
                              y={startY}
                              width={barW}
                              height={Math.max(wrongH, 0)}
                              fill={isHovered ? "#991B1B" : "#800020"}
                              rx={4}
                              className="transition-all duration-200"
                            />
                          )}

                          {/* Total count badge above stacked bar */}
                          {dayData.total > 0 && (
                            <text
                              x={barW / 2}
                              y={startY - 4}
                              textAnchor="middle"
                              fontSize={9}
                              fontWeight={isHovered ? 700 : 600}
                              fill={isDarkMode ? "#FFF9EF" : "#171923"}
                              className="font-mono"
                            >
                              {dayData.total}
                            </text>
                          )}
                        </g>
                      );
                    })()
                  )}

                  {/* Empty state baseline indicator if 0 questions */}
                  {dayData.total === 0 && (
                    <circle
                      cx={bandWidth / 2}
                      cy={innerHeight - 2}
                      r={2}
                      fill={isDarkMode ? "#31374A" : "#E8D9C0"}
                    />
                  )}

                  {/* Day Label below axis */}
                  <text
                    x={bandWidth / 2}
                    y={innerHeight + 16}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={
                      dayData.dayLabel === "Today" || isHovered ? 700 : 500
                    }
                    fill={
                      dayData.dayLabel === "Today"
                        ? (isDarkMode ? "#F47B20" : "#800020")
                        : isDarkMode
                        ? "#C99A45"
                        : "#5E0017"
                    }
                  >
                    {dayData.dayLabel}
                  </text>

                  {/* Date sublabel (e.g. "Sep 18") */}
                  <text
                    x={bandWidth / 2}
                    y={innerHeight + 28}
                    textAnchor="middle"
                    fontSize={9}
                    fill={isDarkMode ? "#E8D9C0" : "#718096"}
                  >
                    {dayData.fullDateLabel.split(" ")[1]}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Interactive Floating Tooltip on Hover/Tap */}
        {activeRecord && (
          <div
            id="chart-tooltip"
            className="mt-2 bg-[#171923] text-[#FFF9EF] rounded-2xl p-3 shadow-xl border border-[#C99A45]/30 animate-in fade-in zoom-in-95 duration-150 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#F47B20]" />
              <div>
                <span className="text-xs font-bold block">
                  {activeRecord.dayLabel === "Today"
                    ? `Today (${activeRecord.fullDateLabel})`
                    : `${activeRecord.dayLabel}, ${activeRecord.fullDateLabel}`}
                </span>
                <span className="text-[10px] text-[#E8D9C0]/75">
                  {activeRecord.total === 0
                    ? "No questions answered on this day"
                    : `${activeRecord.total} questions answered • ${activeRecord.accuracy}% accuracy`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {activeRecord.correct}
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-[#F47B20] font-mono">
                <XCircle className="w-3.5 h-3.5" />
                {activeRecord.wrong}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Footnote */}
      <div className="mt-3 pt-3 border-t border-[#E8D9C0]/60 dark:border-[#31374A]/80 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
          <span>Updates in real-time as you practice MCQs</span>
        </span>
        <span className="font-mono text-[10px] text-[#800020] dark:text-[#C99A45] font-semibold">
          Target: &gt;80% Accuracy
        </span>
      </div>
    </div>
  );
};
