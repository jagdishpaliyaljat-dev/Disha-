import React, { useState, useEffect, useMemo } from "react";
import {
  Bot,
  Sparkles,
  TrendingUp,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Trash2,
  Search,
  Filter,
  ArrowUpRight,
  ChevronRight,
  Database,
  Cpu,
  Layers,
  Coins,
  DollarSign,
  Activity,
  Send,
  Eye,
  X,
  Check,
} from "lucide-react";
import {
  getAIUsageSummary,
  getAIUsageRecords,
  clearAIUsageRecords,
  exportAITelemetryCsv,
  recordAIUsage,
  AIUsageRecord,
  AIUsageSummary,
} from "../../utils/aiUsageTracker";
import { getActiveAICredentials } from "../../utils/aiTutorService";
import { executeAICompletion } from "../../utils/aiProviderService";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

export const DishaAIDashboard: React.FC = () => {
  const [timeframe, setTimeframe] = useState<"today" | "7days" | "30days" | "all">("7days");
  const [summary, setSummary] = useState<AIUsageSummary>(() => getAIUsageSummary("7days"));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<AIUsageRecord | null>(null);
  const [isTestingLive, setIsTestingLive] = useState(false);
  const [testResult, setTestResult] = useState<{
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    model: string;
    success: boolean;
  } | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Refresh summary when timeframe changes
  const refreshData = () => {
    setSummary(getAIUsageSummary(timeframe));
  };

  useEffect(() => {
    refreshData();
  }, [timeframe]);

  // Filter recent logs by search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return summary.recentLogs;
    const q = searchQuery.toLowerCase();
    return summary.recentLogs.filter(
      (l) =>
        l.userName.toLowerCase().includes(q) ||
        l.promptSnippet.toLowerCase().includes(q) ||
        l.model.toLowerCase().includes(q) ||
        l.queryType.toLowerCase().includes(q)
    );
  }, [summary.recentLogs, searchQuery]);

  // Handle Live Test Inference
  const handleLiveTestInference = async () => {
    setIsTestingLive(true);
    setTestResult(null);
    triggerHaptic("light");
    playClickSound();

    const creds = getActiveAICredentials();
    const prompt = "राजस्थान की राजधानी क्या है और इसे गुलाबी नगरी क्यों कहते हैं? संक्षेप में 2 पंक्तियों में बताएं।";
    const startTime = Date.now();

    try {
      const response = await executeAICompletion({
        provider: creds.provider,
        apiKey: creds.apiKey,
        model: creds.model,
        prompt,
        temperature: 0.2,
      });

      const latencyMs = Date.now() - startTime;
      const logged = recordAIUsage({
        provider: creds.provider,
        model: creds.model,
        queryType: "doubt",
        prompt,
        response,
        latencyMs,
        status: "success",
      });

      setTestResult({
        latencyMs,
        inputTokens: logged.inputTokens,
        outputTokens: logged.outputTokens,
        totalTokens: logged.totalTokens,
        model: creds.model,
        success: true,
      });

      refreshData();
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      recordAIUsage({
        provider: creds.provider,
        model: creds.model,
        queryType: "doubt",
        prompt,
        latencyMs,
        status: "error",
        errorMessage: err?.message || String(err),
      });

      setTestResult({
        latencyMs,
        inputTokens: 25,
        outputTokens: 0,
        totalTokens: 25,
        model: creds.model,
        success: false,
      });

      refreshData();
    } finally {
      setIsTestingLive(false);
    }
  };

  // Handle CSV Export
  const handleExportCsv = () => {
    triggerHaptic("light");
    exportAITelemetryCsv(getAIUsageRecords(timeframe));
  };

  // Handle Clear Logs
  const handleClearLogs = () => {
    if (confirm("Are you sure you want to reset all Disha AI telemetry logs?")) {
      triggerHaptic("success");
      clearAIUsageRecords();
      refreshData();
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. TOP HEADER & TIMEFRAME SWITCHER */}
      <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#800020] to-[#F47B20] text-white flex items-center justify-center font-black shadow-md shadow-[#800020]/20 shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Disha AI Tutor Telemetry Engine</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Disha AI Messages, Token Usage & Analytics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Monitor total student queries, AI responses, token consumption, cost estimate and latency
            </p>
          </div>
        </div>

        {/* Timeframe Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Timeframe Chips */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {[
              { id: "today", label: "Today" },
              { id: "7days", label: "7 Days" },
              { id: "30days", label: "30 Days" },
              { id: "all", label: "All Time" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setTimeframe(t.id as any);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  timeframe === t.id
                    ? "bg-[#800020] text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              refreshData();
            }}
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Refresh Telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Test Live Ping */}
          <button
            type="button"
            onClick={handleLiveTestInference}
            disabled={isTestingLive}
            className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-[#800020] to-[#5E0017] hover:brightness-110 text-white font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isTestingLive ? "animate-spin text-amber-300" : "text-[#F47B20]"}`} />
            <span>{isTestingLive ? "Testing..." : "Ping Live AI"}</span>
          </button>
        </div>
      </div>

      {/* Live Test Feedback Banner (If run) */}
      {testResult && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs animate-in fade-in duration-300 ${
            testResult.success
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>
              <strong>Live Ping Result:</strong> {testResult.model} responded in{" "}
              <strong>{testResult.latencyMs}ms</strong> with{" "}
              <strong>{testResult.totalTokens} Tokens</strong> ({testResult.inputTokens} Prompt /{" "}
              {testResult.outputTokens} Completion).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="p-1 hover:bg-black/10 rounded-lg text-slate-500 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. EXECUTIVE METRICS GRID (4 HIGHLIGHT CARDS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Messages (Input + Output) */}
        <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total AI Messages
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
              {summary.totalMessages}
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              <span className="text-purple-600 dark:text-purple-400 font-mono">
                {summary.totalInputMessages} Input Qs
              </span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                {summary.totalOutputMessages} Output Ans
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-purple-600 h-full rounded-full transition-all duration-700"
              style={{
                width: `${
                  summary.totalMessages > 0
                    ? Math.round((summary.totalInputMessages / summary.totalMessages) * 100)
                    : 50
                }%`,
              }}
            />
          </div>
        </div>

        {/* Metric 2: Total Token Usage */}
        <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Tokens Used
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
              {summary.totalTokens.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              <span className="font-mono text-amber-600 dark:text-amber-400">
                {summary.totalInputTokens.toLocaleString()} in
              </span>
              <span>•</span>
              <span className="font-mono text-teal-600 dark:text-teal-400">
                {summary.totalOutputTokens.toLocaleString()} out
              </span>
            </div>
          </div>
          <div className="text-[9px] font-bold text-slate-400 mt-3 uppercase tracking-wider">
            Token Ratio: {(summary.totalOutputTokens / Math.max(1, summary.totalInputTokens)).toFixed(2)}x Expansion
          </div>
        </div>

        {/* Metric 3: Estimated Cost (USD & INR) */}
        <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Estimated AI Cost
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums tracking-tight">
              ₹{summary.totalCostInr}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              <span className="font-mono">${summary.totalCostUsd} USD</span>
              <span className="text-[10px] text-slate-400">(Gemini Flash Lite Rates)</span>
            </div>
          </div>
          <div className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 mt-3 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>99.2% Cost-Efficient</span>
          </div>
        </div>

        {/* Metric 4: Latency & Success Rate */}
        <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Avg Speed & Uptime
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
              {(summary.avgLatencyMs / 1000).toFixed(2)}s
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {summary.successRate}% Success
              </span>
              <span>•</span>
              <span className="font-mono text-slate-400">{summary.errorCount} Errors</span>
            </div>
          </div>
          <div className="text-[9px] font-bold text-slate-400 mt-3 truncate font-mono">
            Active: {summary.activeModel}
          </div>
        </div>
      </div>

      {/* 3. VISUAL CHARTS: DAILY TOKEN USAGE TRENDS & QUERY TYPES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Daily Token Usage Bar Chart (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111A2E] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                <span>Daily Token Usage & Traffic</span>
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Input vs Output Token Distribution over time
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-black">
              <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                Input Tokens
              </span>
              <span className="flex items-center gap-1 text-amber-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Output Tokens
              </span>
            </div>
          </div>

          {/* Daily Bar Visualization */}
          <div className="pt-2">
            {summary.dailyHistory.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                No telemetry recorded for this timeframe
              </div>
            ) : (
              <div className="space-y-3">
                {summary.dailyHistory.slice(-7).map((d) => {
                  const maxToken = Math.max(
                    ...summary.dailyHistory.map((item) => item.totalTokens),
                    1000
                  );
                  const inPct = Math.round((d.inputTokens / maxToken) * 100);
                  const outPct = Math.round((d.outputTokens / maxToken) * 100);

                  return (
                    <div key={d.date} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {d.displayDate}
                        </span>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-purple-600 dark:text-purple-400">
                            {d.inputTokens.toLocaleString()} in
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-amber-600 dark:text-amber-400">
                            {d.outputTokens.toLocaleString()} out
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {d.totalTokens.toLocaleString()} Tok
                          </span>
                        </div>
                      </div>

                      {/* Stacked Bar */}
                      <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                        <div
                          className="bg-purple-600 h-full transition-all duration-500"
                          style={{ width: `${Math.max(2, inPct)}%` }}
                          title={`Input: ${d.inputTokens}`}
                        />
                        <div
                          className="bg-amber-500 h-full transition-all duration-500"
                          style={{ width: `${Math.max(2, outPct)}%` }}
                          title={`Output: ${d.outputTokens}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Model & Query Type Distribution (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Query Type Breakdown */}
          <div className="bg-white dark:bg-[#111A2E] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
              <span>Query Types Breakdown</span>
            </h3>

            <div className="space-y-2.5 pt-1">
              {[
                { key: "doubt", label: "Subject Doubts & Concepts", color: "bg-purple-500" },
                { key: "question_explain", label: "MCQ Deep Explanation", color: "bg-teal-500" },
                { key: "exam_strategy", label: "Exam Strategy & Plans", color: "bg-amber-500" },
                { key: "general", label: "General Student Guidance", color: "bg-blue-500" },
              ].map((item) => {
                const count = summary.queryTypeBreakdown[item.key]?.count || 0;
                const tokens = summary.queryTypeBreakdown[item.key]?.totalTokens || 0;
                const pct = summary.totalMessages > 0 ? Math.round((count / summary.totalMessages) * 100) : 0;

                return (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {item.label}
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {count} Qs ({tokens.toLocaleString()} tok)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`${item.color} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(3, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Model Breakdown */}
          <div className="bg-white dark:bg-[#111A2E] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
              <span>Models Consumption Share</span>
            </h3>

            <div className="space-y-2">
              {Object.entries(summary.modelBreakdown).map(([mName, data]) => {
                const pct = summary.totalTokens > 0 ? Math.round((data.totalTokens / summary.totalTokens) * 100) : 0;
                return (
                  <div
                    key={mName}
                    className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white block">
                        {mName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {data.count} calls • ${(data.costUsd || 0).toFixed(4)} USD
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-black text-[#800020] dark:text-[#F47B20] block">
                        {data.totalTokens.toLocaleString()} Tok
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {pct}% share
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. REAL-TIME AI INTERACTION LOGS TABLE */}
      <div className="bg-white dark:bg-[#111A2E] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
              <span>Recent Disha AI Interaction Logs</span>
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Live audit of student prompts, token consumption and latency
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search queries or models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#800020] w-48 sm:w-64"
              />
            </div>

            {/* Clear Logs */}
            <button
              type="button"
              onClick={handleClearLogs}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
              title="Reset Telemetry Logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase font-black text-slate-400 tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-3.5">Time & Student</th>
                <th className="py-3 px-3.5">Topic / Prompt</th>
                <th className="py-3 px-3.5">Model</th>
                <th className="py-3 px-3.5 text-right">Tokens (In / Out)</th>
                <th className="py-3 px-3.5 text-right">Speed</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs font-medium">
                    No interaction logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isErr = log.status === "error";
                  const time = new Date(log.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {log.userName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {time}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 max-w-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                          {log.promptSnippet}
                        </span>
                        <span className="text-[9px] font-mono text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                          {log.queryType}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {log.model}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap text-right font-mono tabular-nums">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {log.totalTokens}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {log.inputTokens} in / {log.outputTokens} out
                        </span>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap text-right font-mono text-[11px]">
                        <span
                          className={`font-bold ${
                            log.latencyMs < 1000
                              ? "text-emerald-600 dark:text-emerald-400"
                              : log.latencyMs < 2000
                              ? "text-amber-500"
                              : "text-rose-500"
                          }`}
                        >
                          {log.latencyMs}ms
                        </span>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            isErr
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/30"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {isErr ? "Error" : "Success"}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("light");
                            setSelectedLog(log);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#800020] hover:text-white dark:hover:bg-[#F47B20] text-slate-600 dark:text-slate-300 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. INSPECT MODAL FOR LOG DETAILS */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#111A2E] rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    AI Interaction Audit Details
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {selectedLog.timestamp}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metadata Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80">
                <span className="text-[9px] text-slate-400 uppercase block">Model</span>
                <span className="font-bold text-slate-900 dark:text-white truncate block">
                  {selectedLog.model}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80">
                <span className="text-[9px] text-slate-400 uppercase block">Total Tokens</span>
                <span className="font-bold text-amber-500 block">
                  {selectedLog.totalTokens}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80">
                <span className="text-[9px] text-slate-400 uppercase block">Latency</span>
                <span className="font-bold text-emerald-500 block">
                  {selectedLog.latencyMs}ms
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80">
                <span className="text-[9px] text-slate-400 uppercase block">Cost</span>
                <span className="font-bold text-teal-500 block">
                  ${selectedLog.estimatedCostUsd}
                </span>
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Student Query (Prompt):
              </span>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-36 overflow-y-auto">
                {selectedLog.promptSnippet}
              </div>
            </div>

            {/* Response */}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Disha AI Answer (Response):
              </span>
              <div className="p-3 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-48 overflow-y-auto">
                {selectedLog.responseSnippet || (
                  <span className="text-rose-500 italic">
                    {selectedLog.errorMessage || "No response received"}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="w-full h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default DishaAIDashboard;
