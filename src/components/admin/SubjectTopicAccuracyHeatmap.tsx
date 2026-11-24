import * as React from "react";
import {
  Target,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  BarChart3,
  BookOpen,
  ArrowUpDown,
  ChevronRight,
  Eye,
  X,
  Sparkles,
  Zap,
} from "lucide-react";
import { AdminCard } from "./AdminCard";
import {
  calculateTopicAccuracyMetrics,
  downloadAccuracyHeatmapCSV,
  TopicAccuracyMetric,
  AccuracyHeatmapSummary,
  HealthTier,
} from "../../utils/accuracyHeatmapService";
import {
  loadUserQuestionsStore,
  getCombinedSubjects,
  getCombinedChapters,
} from "../../utils/questionsStorage";
import { loadPerformanceStore } from "../../utils/performanceStorage";
import { triggerAdminToast } from "../../utils/adminToast";
import { Chapter, Question, Subject } from "../../types";

export interface SubjectTopicAccuracyHeatmapProps {
  onInspectTopic?: (topicId: string, chapterId: string, subjectId: string) => void;
  className?: string;
}

export const SubjectTopicAccuracyHeatmap: React.FC<SubjectTopicAccuracyHeatmapProps> = ({
  onInspectTopic,
  className = "",
}) => {
  // Data resolution
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [chapters, setChapters] = React.useState<Chapter[]>([]);
  const [summary, setSummary] = React.useState<AccuracyHeatmapSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedSubject, setSelectedSubject] = React.useState<string>("all");
  const [selectedTier, setSelectedTier] = React.useState<"all" | HealthTier>("all");
  const [sortBy, setSortBy] = React.useState<"accuracy_asc" | "accuracy_desc" | "attempts" | "questions">("accuracy_asc");

  // Topic Inspector modal
  const [inspectingMetric, setInspectingMetric] = React.useState<TopicAccuracyMetric | null>(null);

  // Load and aggregate data
  const loadHeatmapData = React.useCallback(() => {
    setIsLoading(true);
    try {
      const store = loadUserQuestionsStore();
      const loadedSubjects = getCombinedSubjects(store);
      const loadedChapters = getCombinedChapters(store);
      const perfStore = loadPerformanceStore();

      setSubjects(loadedSubjects);
      setChapters(loadedChapters);

      const computedSummary = calculateTopicAccuracyMetrics(
        loadedSubjects,
        loadedChapters,
        perfStore
      );
      setSummary(computedSummary);
    } catch (err) {
      console.error("[Heatmap] Failed to compute accuracy metrics:", err);
      triggerAdminToast("Failed to load accuracy heatmap data", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadHeatmapData();
  }, [loadHeatmapData]);

  // Filtered & Sorted Metrics
  const filteredMetrics = React.useMemo(() => {
    if (!summary?.metrics) return [];

    let list = summary.metrics.filter((m) => {
      // Subject filter
      if (selectedSubject !== "all" && m.subjectId !== selectedSubject) {
        return false;
      }
      // Health Tier filter
      if (selectedTier !== "all" && m.healthTier !== selectedTier) {
        return false;
      }
      // Search query filter (matches topic name, chapter name, or subject name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTopic = m.topicName.toLowerCase().includes(q);
        const matchesChap = m.chapterName.toLowerCase().includes(q);
        const matchesSub = m.subjectName.toLowerCase().includes(q);
        if (!matchesTopic && !matchesChap && !matchesSub) return false;
      }
      return true;
    });

    // Apply sorting
    list = [...list].sort((a, b) => {
      if (sortBy === "accuracy_asc") {
        return a.accuracyPercentage - b.accuracyPercentage;
      }
      if (sortBy === "accuracy_desc") {
        return b.accuracyPercentage - a.accuracyPercentage;
      }
      if (sortBy === "attempts") {
        return b.totalAttempts - a.totalAttempts;
      }
      if (sortBy === "questions") {
        return b.totalQuestions - a.totalQuestions;
      }
      return 0;
    });

    return list;
  }, [summary, selectedSubject, selectedTier, searchQuery, sortBy]);

  // Questions for topic inspector modal
  const inspectedTopicQuestions = React.useMemo(() => {
    if (!inspectingMetric) return [];
    const targetChap = chapters.find((c) => c.id === inspectingMetric.chapterId);
    if (!targetChap?.topics) return [];
    const targetTopic = targetChap.topics.find((t) => t.id === inspectingMetric.topicId);
    return targetTopic?.questions || [];
  }, [inspectingMetric, chapters]);

  // Export CSV handler
  const handleExportCSV = () => {
    if (!summary?.metrics || summary.metrics.length === 0) {
      triggerAdminToast("No metrics available to export", "info");
      return;
    }
    try {
      downloadAccuracyHeatmapCSV(filteredMetrics.length > 0 ? filteredMetrics : summary.metrics);
      triggerAdminToast("Heatmap CSV exported successfully", "success");
    } catch {
      triggerAdminToast("Failed to export CSV report", "error");
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Banner / Actions */}
      <AdminCard
        title="Subject & Topic Accuracy Heatmap"
        subtitle="Content Quality Control Desk: Monitor student success rate, identify confusing questions, and fix low-scoring topics (<50%)."
        icon={Target}
        headerAction={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#252A38] text-[#171923] dark:text-[#FFF9EF] hover:bg-neutral-50 dark:hover:bg-[#2F3546] transition-colors shadow-xs"
              title="Download CSV Audit Report"
            >
              <Download className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={() => {
                loadHeatmapData();
                triggerAdminToast("Telemetry refreshed", "success");
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#252A38] text-[#171923] dark:text-[#FFF9EF] hover:bg-neutral-50 dark:hover:bg-[#2F3546] transition-colors shadow-xs"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20] ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
      >
        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* Card 1: Overall Accuracy */}
          <div className="p-4 rounded-2xl bg-[#FFF9EF] dark:bg-[#1A1D27] border border-[#E8D9C0] dark:border-[#31374A]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-[#52576A] dark:text-[#A0AEC0]">Platform Accuracy</span>
              <BarChart3 className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
            </div>
            <div className="text-2xl font-black text-[#171923] dark:text-[#FFF9EF]">
              {summary?.overallAccuracy ?? 0}%
            </div>
            <div className="text-[11px] text-[#52576A] dark:text-[#A0AEC0] mt-1 flex items-center gap-1 font-medium">
              <span>{summary?.totalAttempts ?? 0} total attempts</span>
            </div>
          </div>

          {/* Card 2: Monitored Topics */}
          <div className="p-4 rounded-2xl bg-[#FFF9EF] dark:bg-[#1A1D27] border border-[#E8D9C0] dark:border-[#31374A]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-[#52576A] dark:text-[#A0AEC0]">Monitored Topics</span>
              <BookOpen className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
            </div>
            <div className="text-2xl font-black text-[#171923] dark:text-[#FFF9EF]">
              {summary?.totalTopics ?? 0}
            </div>
            <div className="text-[11px] text-[#52576A] dark:text-[#A0AEC0] mt-1 font-medium">
              Across {subjects.length} subjects
            </div>
          </div>

          {/* Card 3: Critical Attention (<50%) */}
          <div
            onClick={() => setSelectedTier(selectedTier === "critical" ? "all" : "critical")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedTier === "critical"
                ? "bg-rose-100 dark:bg-rose-950/60 border-rose-500 shadow-sm"
                : "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 hover:border-rose-400"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300">Critical Review</span>
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-300">
              {summary?.criticalCount ?? 0}
            </div>
            <div className="text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-1 font-medium">
              Accuracy &lt; 50% (High Error)
            </div>
          </div>

          {/* Card 4: High Mastery (>70%) */}
          <div
            onClick={() => setSelectedTier(selectedTier === "healthy" ? "all" : "healthy")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedTier === "healthy"
                ? "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-500 shadow-sm"
                : "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">High Mastery</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
              {summary?.healthyCount ?? 0}
            </div>
            <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 font-medium">
              Accuracy &gt; 70% (Well Understood)
            </div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FFF9EF]/60 dark:bg-[#1A1D27]/60 border border-[#E8D9C0] dark:border-[#31374A] space-y-3 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-5 relative">
              <Search className="w-4 h-4 text-[#8A92A6] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search topic, chapter, or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#252A38] text-[#171923] dark:text-[#FFF9EF] focus:outline-none focus:ring-2 focus:ring-[#800020]/20 dark:focus:ring-[#F47B20]/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Subject Selector */}
            <div className="sm:col-span-4">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#252A38] text-[#171923] dark:text-[#FFF9EF] focus:outline-none"
              >
                <option value="all">All Subjects ({subjects.length})</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Selector */}
            <div className="sm:col-span-3">
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#252A38] text-[#171923] dark:text-[#FFF9EF] focus:outline-none"
                >
                  <option value="accuracy_asc">Lowest Accuracy (Audit)</option>
                  <option value="accuracy_desc">Highest Accuracy</option>
                  <option value="attempts">Most Attempted</option>
                  <option value="questions">Most Questions</option>
                </select>
              </div>
            </div>
          </div>

          {/* Health Tier Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-[#52576A] dark:text-[#A0AEC0] flex items-center gap-1">
              <Filter className="w-3 h-3" /> Status:
            </span>
            <button
              onClick={() => setSelectedTier("all")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                selectedTier === "all"
                  ? "bg-[#800020] text-white dark:bg-[#F47B20] dark:text-neutral-900 shadow-xs"
                  : "bg-white dark:bg-[#252A38] text-[#52576A] dark:text-[#CBD2E1] border border-[#E8D9C0] dark:border-[#31374A]"
              }`}
            >
              All Topics ({summary?.totalTopics ?? 0})
            </button>
            <button
              onClick={() => setSelectedTier("critical")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${
                selectedTier === "critical"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Critical &lt;50% ({summary?.criticalCount ?? 0})
            </button>
            <button
              onClick={() => setSelectedTier("moderate")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                selectedTier === "moderate"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
              }`}
            >
              Moderate 50-70% ({summary?.moderateCount ?? 0})
            </button>
            <button
              onClick={() => setSelectedTier("healthy")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                selectedTier === "healthy"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
              }`}
            >
              Mastered &gt;70% ({summary?.healthyCount ?? 0})
            </button>

            {(selectedSubject !== "all" || selectedTier !== "all" || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedSubject("all");
                  setSelectedTier("all");
                  setSearchQuery("");
                }}
                className="ml-auto text-[11px] font-bold text-[#800020] dark:text-[#F47B20] hover:underline"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Heatmap Grid */}
        {filteredMetrics.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-[#E8D9C0] dark:border-[#31374A] rounded-2xl">
            <HelpCircle className="w-8 h-8 mx-auto text-[#8A92A6] mb-2 opacity-60" />
            <h4 className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF]">No topics found</h4>
            <p className="text-xs text-[#52576A] dark:text-[#A0AEC0] mt-1 max-w-sm mx-auto">
              No topics matched your search or filter criteria. Try clearing filters or searching for another keyword.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filteredMetrics.map((item) => {
              const isCrit = item.healthTier === "critical";
              const isMod = item.healthTier === "moderate";

              const badgeColor = isCrit
                ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                : isMod
                ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";

              const meterColor = isCrit
                ? "bg-rose-500"
                : isMod
                ? "bg-amber-500"
                : "bg-emerald-500";

              return (
                <div
                  key={`${item.chapterId}-${item.topicId}`}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isCrit
                      ? "bg-white dark:bg-[#1F2330] border-rose-300/80 dark:border-rose-900/60 shadow-xs hover:border-rose-500"
                      : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] shadow-xs hover:border-[#800020]/40 dark:hover:border-[#F47B20]/40"
                  }`}
                >
                  <div>
                    {/* Header: Subject & Chapter */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FFF9EF] dark:bg-[#252A38] text-[#52576A] dark:text-[#CBD2E1] border border-[#E8D9C0]/60 dark:border-[#31374A] truncate max-w-[150px]">
                        {item.subjectName}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeColor}`}>
                        {item.accuracyPercentage}% Accuracy
                      </span>
                    </div>

                    {/* Topic Name */}
                    <h4 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] line-clamp-2 font-hindi mb-1">
                      {item.topicName}
                    </h4>
                    <p className="text-[11px] text-[#52576A] dark:text-[#A0AEC0] truncate mb-3">
                      {item.chapterName}
                    </p>

                    {/* Visual Accuracy Meter */}
                    <div className="space-y-1 mb-3">
                      <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-[#252A38] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${meterColor}`}
                          style={{ width: `${Math.min(100, Math.max(4, item.accuracyPercentage))}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-[#8A92A6]">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Numerical Stats Pills */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-xl bg-[#FFF9EF]/70 dark:bg-[#1A1D27]/70 border border-[#E8D9C0]/60 dark:border-[#31374A] text-center text-[11px] mb-3">
                      <div>
                        <div className="text-[10px] text-[#52576A] dark:text-[#A0AEC0]">Attempts</div>
                        <div className="font-black text-[#171923] dark:text-[#FFF9EF]">{item.totalAttempts}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#52576A] dark:text-[#A0AEC0]">Correct/Wrong</div>
                        <div className="font-bold text-[#171923] dark:text-[#FFF9EF]">
                          <span className="text-emerald-600 dark:text-emerald-400">{item.correctAttempts}</span> /{" "}
                          <span className="text-rose-600 dark:text-rose-400">{item.wrongAttempts}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#52576A] dark:text-[#A0AEC0]">Questions</div>
                        <div className="font-black text-[#171923] dark:text-[#FFF9EF]">{item.totalQuestions}</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-[#E8D9C0]/50 dark:border-[#31374A]/50 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setInspectingMetric(item)}
                      className="flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold bg-[#FFF9EF] dark:bg-[#252A38] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] hover:bg-neutral-50 dark:hover:bg-[#2F3546] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                      <span>Inspect ({item.totalQuestions})</span>
                    </button>

                    {onInspectTopic && (
                      <button
                        onClick={() => onInspectTopic(item.topicId, item.chapterId, item.subjectId)}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0 ${
                          isCrit
                            ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                            : "bg-[#800020] hover:bg-[#600018] dark:bg-[#F47B20] dark:hover:bg-[#D96B1C] text-white dark:text-neutral-900 shadow-xs"
                        }`}
                        title="Audit Questions for this topic"
                      >
                        <span>Audit</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminCard>

      {/* Inline Topic Questions Inspector Modal */}
      {inspectingMetric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white dark:bg-[#1F2330] rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FFF9EF] dark:bg-[#252A38] text-[#800020] dark:text-[#F47B20] border border-[#E8D9C0] dark:border-[#31374A]">
                    {inspectingMetric.subjectName}
                  </span>
                  <span className="text-[11px] text-[#52576A] dark:text-[#A0AEC0]">
                    {inspectingMetric.chapterName}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] font-hindi">
                  {inspectingMetric.topicName}
                </h3>
              </div>
              <button
                onClick={() => setInspectingMetric(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#252A38] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Question List */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 divide-y divide-[#E8D9C0]/50 dark:divide-[#31374A]/50">
              {inspectedTopicQuestions.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#52576A] dark:text-[#A0AEC0]">
                  No questions currently loaded in this topic store.
                </div>
              ) : (
                inspectedTopicQuestions.map((q: Question, idx: number) => {
                  return (
                    <div key={q.id || idx} className={idx > 0 ? "pt-4" : ""}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-black text-[#800020] dark:text-[#F47B20]">
                          Q{idx + 1}.
                        </span>
                        {q.difficulty && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-[#252A38] text-[#52576A] dark:text-[#CBD2E1]">
                            {q.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-[#171923] dark:text-[#FFF9EF] font-hindi mb-2.5 leading-relaxed">
                        {q.text}
                      </p>

                      {/* Options Preview */}
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2.5">
                          {q.options.map((opt: string, optIdx: number) => {
                            const isCorrect =
                              q.correctIndex === optIdx ||
                              q.correct_answer === optIdx;
                            return (
                              <div
                                key={optIdx}
                                className={`px-2.5 py-1.5 rounded-xl text-xs border font-hindi ${
                                  isCorrect
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold"
                                    : "bg-neutral-50 dark:bg-[#252A38]/50 border-neutral-200 dark:border-[#31374A] text-neutral-700 dark:text-neutral-300"
                                }`}
                              >
                                <span className="font-mono font-bold mr-1.5 text-neutral-400">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                {opt}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Explanation preview if present */}
                      {q.explanation && (
                        <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#1A1D27] border border-[#E8D9C0]/60 dark:border-[#31374A] text-[11px] text-[#52576A] dark:text-[#CBD2E1] font-hindi">
                          <span className="font-bold text-[#800020] dark:text-[#F47B20] mr-1">
                            व्याख्या:
                          </span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-[#E8D9C0] dark:border-[#31374A] bg-[#FFF9EF]/40 dark:bg-[#1A1D27]/40 flex items-center justify-between">
              <span className="text-xs text-[#52576A] dark:text-[#A0AEC0] font-medium">
                Total {inspectedTopicQuestions.length} Questions
              </span>
              <button
                onClick={() => setInspectingMetric(null)}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-neutral-200 dark:bg-[#31374A] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-[#3B4259] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
