import { loadUserProfile } from "./userProfileStorage";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export interface AIUsageRecord {
  id: string;
  timestamp: string; // ISO date string
  userId: string;
  userName: string;
  provider: string; // "gemini" | "openrouter" | "openai" | "groq" | "claude" | "cliproxy"
  model: string; // e.g. "gemini-3.5-flash-lite"
  queryType: "doubt" | "question_explain" | "exam_strategy" | "general";
  inputMessages: number; // 1
  outputMessages: number; // 1
  inputChars: number;
  outputChars: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  status: "success" | "error";
  errorMessage?: string;
  promptSnippet: string;
  responseSnippet: string;
  estimatedCostUsd: number;
}

export interface AIUsageSummary {
  totalInputMessages: number;
  totalOutputMessages: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostInr: number;
  avgLatencyMs: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  activeModel: string;
  activeProvider: string;
  modelBreakdown: Record<string, { count: number; inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number }>;
  providerBreakdown: Record<string, { count: number; totalTokens: number }>;
  queryTypeBreakdown: Record<string, { count: number; totalTokens: number }>;
  dailyHistory: {
    date: string;
    displayDate: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputMessages: number;
    outputMessages: number;
    costUsd: number;
  }[];
  recentLogs: AIUsageRecord[];
}

const STORAGE_KEY = "disha2020_ai_usage_telemetry_v1";
const USD_TO_INR = 87.5;

// Pricing per million tokens (USD)
const MODEL_PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  "gemini-3.5-flash-lite": { inputPerM: 0.075, outputPerM: 0.30 },
  "gemini-3.8-flash": { inputPerM: 0.15, outputPerM: 0.60 },
  "gemini-3.1-flash-lite": { inputPerM: 0.075, outputPerM: 0.30 },
  "gemini-2.5-flash": { inputPerM: 0.075, outputPerM: 0.30 },
  "gemini-2.5-pro": { inputPerM: 1.25, outputPerM: 5.00 },
  "gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.60 },
  "gpt-4o": { inputPerM: 2.50, outputPerM: 10.00 },
  "deepseek/deepseek-chat": { inputPerM: 0.14, outputPerM: 0.28 },
  "llama-3.3-70b-versatile": { inputPerM: 0.59, outputPerM: 0.79 },
  default: { inputPerM: 0.10, outputPerM: 0.40 },
};

function estimateTokens(text: string): number {
  if (!text) return 0;
  // Multibyte characters (Devanagari/Hindi) take ~3-3.5 chars per token
  // English words take ~4 chars per token
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const factor = hasDevanagari ? 3.2 : 3.8;
  return Math.max(1, Math.ceil(text.length / factor));
}

function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const normModel = model.toLowerCase();
  const pricing = MODEL_PRICING[normModel] || MODEL_PRICING.default;
  const cost = (inputTokens / 1_000_000) * pricing.inputPerM + (outputTokens / 1_000_000) * pricing.outputPerM;
  return Number(cost.toFixed(6));
}

// Clean-slate production policy: Zero hardcoded mock AI records
function generateSeedRecords(): AIUsageRecord[] {
  return [];
}

/**
 * Record a single AI interaction into telemetry
 */
export function recordAIUsage(record: {
  provider?: string;
  model?: string;
  queryType?: AIUsageRecord["queryType"];
  prompt: string;
  response?: string;
  latencyMs?: number;
  status?: "success" | "error";
  errorMessage?: string;
  inputTokens?: number;
  outputTokens?: number;
}): AIUsageRecord {
  const profile = loadUserProfile();
  const userName = profile?.full_name || profile?.name || "Student";
  const userId = profile?.id || "anonymous";

  const provider = record.provider || "gemini";
  const model = record.model || "gemini-3.5-flash-lite";
  const queryType = record.queryType || "doubt";
  const latencyMs = record.latencyMs || 850;
  const status = record.status || "success";

  const inputChars = record.prompt.length;
  const outputChars = (record.response || "").length;

  const inTok = record.inputTokens || (estimateTokens(record.prompt) + 150); // account for system prompt
  const outTok = record.outputTokens || (record.response ? estimateTokens(record.response) : 0);
  const totalTokens = inTok + outTok;
  const cost = calculateCostUsd(model, inTok, outTok);

  const newLog: AIUsageRecord = {
    id: `ai_log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    provider,
    model,
    queryType,
    inputMessages: 1,
    outputMessages: status === "success" ? 1 : 0,
    inputChars,
    outputChars,
    inputTokens: inTok,
    outputTokens: outTok,
    totalTokens,
    latencyMs,
    status,
    errorMessage: record.errorMessage,
    promptSnippet: record.prompt.slice(0, 80),
    responseSnippet: (record.response || "").slice(0, 100),
    estimatedCostUsd: cost,
  };

  try {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const existing = loadRawLogs();
      const updated = [newLog, ...existing].slice(0, 500); // keep last 500 logs
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn("[aiUsageTracker] Failed to save log:", err);
  }

  // Asynchronously sync to Supabase Cloud ai_telemetry table
  if (isSupabaseConfigured()) {
    try {
      Promise.resolve(
        supabase.from("ai_telemetry").insert({
          id: newLog.id,
          user_id: newLog.userId,
          user_name: newLog.userName,
          provider: newLog.provider,
          model: newLog.model,
          query_type: newLog.queryType,
          input_messages: newLog.inputMessages,
          output_messages: newLog.outputMessages,
          input_chars: newLog.inputChars,
          output_chars: newLog.outputChars,
          input_tokens: newLog.inputTokens,
          output_tokens: newLog.outputTokens,
          total_tokens: newLog.totalTokens,
          latency_ms: newLog.latencyMs,
          status: newLog.status,
          error_message: newLog.errorMessage || null,
          prompt_snippet: newLog.promptSnippet,
          response_snippet: newLog.responseSnippet,
          estimated_cost_usd: newLog.estimatedCostUsd,
          created_at: newLog.timestamp,
        })
      )
        .then(({ error }) => {
          if (error) console.warn("[aiUsageTracker] Supabase note:", error.message);
        })
        .catch(() => {});
    } catch {
      // Ignore background telemetry push errors
    }
  }

  return newLog;
}

function loadRawLogs(): AIUsageRecord[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((l) => !l.id?.startsWith("ai_log_seed_"));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Get AI telemetry logs filtered by timeframe
 */
export function getAIUsageRecords(timeframe: "today" | "7days" | "30days" | "all" = "all"): AIUsageRecord[] {
  const allLogs = loadRawLogs();
  if (timeframe === "all") return allLogs;

  const now = new Date();
  let cutoff = new Date();
  if (timeframe === "today") {
    cutoff.setHours(0, 0, 0, 0);
  } else if (timeframe === "7days") {
    cutoff.setDate(now.getDate() - 7);
  } else if (timeframe === "30days") {
    cutoff.setDate(now.getDate() - 30);
  }

  return allLogs.filter((l) => new Date(l.timestamp) >= cutoff);
}

/**
 * Get aggregated dashboard analytics
 */
export function getAIUsageSummary(timeframe: "today" | "7days" | "30days" | "all" = "all"): AIUsageSummary {
  const logs = getAIUsageRecords(timeframe);

  let totalInputMessages = 0;
  let totalOutputMessages = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalLatency = 0;
  let totalCostUsd = 0;
  let successCount = 0;
  let errorCount = 0;

  const modelBreakdown: AIUsageSummary["modelBreakdown"] = {};
  const providerBreakdown: AIUsageSummary["providerBreakdown"] = {};
  const queryTypeBreakdown: AIUsageSummary["queryTypeBreakdown"] = {};
  const dailyMap = new Map<string, { inputTokens: number; outputTokens: number; totalTokens: number; inputMessages: number; outputMessages: number; costUsd: number }>();

  logs.forEach((log) => {
    totalInputMessages += log.inputMessages || 1;
    totalOutputMessages += log.outputMessages || (log.status === "success" ? 1 : 0);
    totalInputTokens += log.inputTokens || 0;
    totalOutputTokens += log.outputTokens || 0;
    totalLatency += log.latencyMs || 0;
    totalCostUsd += log.estimatedCostUsd || 0;

    if (log.status === "success") {
      successCount++;
    } else {
      errorCount++;
    }

    // Model breakdown
    const m = log.model || "gemini-3.5-flash-lite";
    if (!modelBreakdown[m]) {
      modelBreakdown[m] = { count: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 };
    }
    modelBreakdown[m].count++;
    modelBreakdown[m].inputTokens += log.inputTokens || 0;
    modelBreakdown[m].outputTokens += log.outputTokens || 0;
    modelBreakdown[m].totalTokens += log.totalTokens || 0;
    modelBreakdown[m].costUsd += log.estimatedCostUsd || 0;

    // Provider breakdown
    const p = log.provider || "gemini";
    if (!providerBreakdown[p]) {
      providerBreakdown[p] = { count: 0, totalTokens: 0 };
    }
    providerBreakdown[p].count++;
    providerBreakdown[p].totalTokens += log.totalTokens || 0;

    // Query type breakdown
    const qt = log.queryType || "doubt";
    if (!queryTypeBreakdown[qt]) {
      queryTypeBreakdown[qt] = { count: 0, totalTokens: 0 };
    }
    queryTypeBreakdown[qt].count++;
    queryTypeBreakdown[qt].totalTokens += log.totalTokens || 0;

    // Daily distribution (YYYY-MM-DD)
    const dateStr = log.timestamp.split("T")[0] || "Today";
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputMessages: 0,
        outputMessages: 0,
        costUsd: 0,
      });
    }
    const d = dailyMap.get(dateStr)!;
    d.inputTokens += log.inputTokens || 0;
    d.outputTokens += log.outputTokens || 0;
    d.totalTokens += log.totalTokens || 0;
    d.inputMessages += log.inputMessages || 1;
    d.outputMessages += log.outputMessages || (log.status === "success" ? 1 : 0);
    d.costUsd += log.estimatedCostUsd || 0;
  });

  const totalTokens = totalInputTokens + totalOutputTokens;
  const totalCalls = logs.length;
  const avgLatencyMs = totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0;
  const successRate = totalCalls > 0 ? Number(((successCount / totalCalls) * 100).toFixed(1)) : 100;
  const totalCostInr = Number((totalCostUsd * USD_TO_INR).toFixed(2));

  // Determine active model from most used
  let activeModel = "gemini-3.5-flash-lite";
  let maxModelCount = -1;
  Object.entries(modelBreakdown).forEach(([mName, val]) => {
    if (val.count > maxModelCount) {
      maxModelCount = val.count;
      activeModel = mName;
    }
  });

  // Build sorted daily history (last 7 or 14 days)
  const dailyHistory = Array.from(dailyMap.entries())
    .map(([date, val]) => {
      const parts = date.split("-");
      const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
      return {
        date,
        displayDate,
        ...val,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalInputMessages,
    totalOutputMessages,
    totalMessages: totalInputMessages + totalOutputMessages,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    totalCostInr,
    avgLatencyMs,
    successCount,
    errorCount,
    successRate,
    activeModel,
    activeProvider: "gemini",
    modelBreakdown,
    providerBreakdown,
    queryTypeBreakdown,
    dailyHistory,
    recentLogs: logs.slice(0, 30),
  };
}

/**
 * Clear or reset all AI telemetry data
 */
export function clearAIUsageRecords(): void {
  try {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

/**
 * Fetch live AI usage summary directly from Supabase Cloud telemetry table
 */
export async function fetchLiveAIUsageSummary(
  timeframe: "today" | "7days" | "30days" | "all" = "all"
): Promise<AIUsageSummary> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from("ai_telemetry")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      const now = new Date();
      if (timeframe === "today") {
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        query = query.gte("created_at", cutoff.toISOString());
      } else if (timeframe === "7days") {
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - 7);
        query = query.gte("created_at", cutoff.toISOString());
      } else if (timeframe === "30days") {
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - 30);
        query = query.gte("created_at", cutoff.toISOString());
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const cloudLogs: AIUsageRecord[] = data.map((r: any) => ({
          id: r.id,
          timestamp: r.created_at,
          userId: r.user_id || "anonymous",
          userName: r.user_name || "Student",
          provider: r.provider || "gemini",
          model: r.model || "gemini-3.5-flash-lite",
          queryType: r.query_type || "doubt",
          inputMessages: r.input_messages || 1,
          outputMessages: r.output_messages || 1,
          inputChars: r.input_chars || 0,
          outputChars: r.output_chars || 0,
          inputTokens: r.input_tokens || 0,
          outputTokens: r.output_tokens || 0,
          totalTokens: r.total_tokens || 0,
          latencyMs: r.latency_ms || 0,
          status: r.status || "success",
          errorMessage: r.error_message || undefined,
          promptSnippet: r.prompt_snippet || "",
          responseSnippet: r.response_snippet || "",
          estimatedCostUsd: Number(r.estimated_cost_usd) || 0,
        }));

        // Merge with local logs to prevent missing any offline records
        const local = loadRawLogs();
        const cloudIds = new Set(cloudLogs.map((l) => l.id));
        const merged = [...cloudLogs, ...local.filter((l) => !cloudIds.has(l.id))]
          .filter((l) => !l.id?.startsWith("ai_log_seed_"));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.slice(0, 500)));
        } catch {}
        return computeSummaryFromLogs(merged, timeframe);
      }
    } catch (err) {
      console.warn("[aiUsageTracker] Cloud fetch note:", err);
    }
  }
  return getAIUsageSummary(timeframe);
}

function computeSummaryFromLogs(
  logs: AIUsageRecord[],
  timeframe: "today" | "7days" | "30days" | "all"
): AIUsageSummary {
  let filteredLogs = logs;
  if (timeframe !== "all") {
    const now = new Date();
    let cutoff = new Date();
    if (timeframe === "today") {
      cutoff.setHours(0, 0, 0, 0);
    } else if (timeframe === "7days") {
      cutoff.setDate(now.getDate() - 7);
    } else if (timeframe === "30days") {
      cutoff.setDate(now.getDate() - 30);
    }
    filteredLogs = logs.filter((l) => new Date(l.timestamp) >= cutoff);
  }

  let totalInputMessages = 0;
  let totalOutputMessages = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalLatency = 0;
  let totalCostUsd = 0;
  let successCount = 0;
  let errorCount = 0;

  const modelBreakdown: AIUsageSummary["modelBreakdown"] = {};
  const providerBreakdown: AIUsageSummary["providerBreakdown"] = {};
  const queryTypeBreakdown: AIUsageSummary["queryTypeBreakdown"] = {};
  const dailyMap = new Map<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      inputMessages: number;
      outputMessages: number;
      costUsd: number;
    }
  >();

  filteredLogs.forEach((log) => {
    totalInputMessages += log.inputMessages || 1;
    totalOutputMessages += log.outputMessages || (log.status === "success" ? 1 : 0);
    totalInputTokens += log.inputTokens || 0;
    totalOutputTokens += log.outputTokens || 0;
    totalLatency += log.latencyMs || 0;
    totalCostUsd += log.estimatedCostUsd || 0;

    if (log.status === "success") {
      successCount++;
    } else {
      errorCount++;
    }

    const m = log.model || "gemini-3.5-flash-lite";
    if (!modelBreakdown[m]) {
      modelBreakdown[m] = { count: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 };
    }
    modelBreakdown[m].count++;
    modelBreakdown[m].inputTokens += log.inputTokens || 0;
    modelBreakdown[m].outputTokens += log.outputTokens || 0;
    modelBreakdown[m].totalTokens += log.totalTokens || 0;
    modelBreakdown[m].costUsd += log.estimatedCostUsd || 0;

    const p = log.provider || "gemini";
    if (!providerBreakdown[p]) {
      providerBreakdown[p] = { count: 0, totalTokens: 0 };
    }
    providerBreakdown[p].count++;
    providerBreakdown[p].totalTokens += log.totalTokens || 0;

    const qt = log.queryType || "doubt";
    if (!queryTypeBreakdown[qt]) {
      queryTypeBreakdown[qt] = { count: 0, totalTokens: 0 };
    }
    queryTypeBreakdown[qt].count++;
    queryTypeBreakdown[qt].totalTokens += log.totalTokens || 0;

    const dateStr = log.timestamp.split("T")[0] || "Today";
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputMessages: 0,
        outputMessages: 0,
        costUsd: 0,
      });
    }
    const d = dailyMap.get(dateStr)!;
    d.inputTokens += log.inputTokens || 0;
    d.outputTokens += log.outputTokens || 0;
    d.totalTokens += log.totalTokens || 0;
    d.inputMessages += log.inputMessages || 1;
    d.outputMessages += log.outputMessages || (log.status === "success" ? 1 : 0);
    d.costUsd += log.estimatedCostUsd || 0;
  });

  const totalTokens = totalInputTokens + totalOutputTokens;
  const totalCalls = filteredLogs.length;
  const avgLatencyMs = totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0;
  const successRate = totalCalls > 0 ? Number(((successCount / totalCalls) * 100).toFixed(1)) : 100;
  const totalCostInr = Number((totalCostUsd * USD_TO_INR).toFixed(2));

  let activeModel = "gemini-3.5-flash-lite";
  let maxModelCount = -1;
  Object.entries(modelBreakdown).forEach(([mName, val]) => {
    if (val.count > maxModelCount) {
      maxModelCount = val.count;
      activeModel = mName;
    }
  });

  const dailyHistory = Array.from(dailyMap.entries())
    .map(([date, val]) => {
      const parts = date.split("-");
      const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
      return {
        date,
        displayDate,
        ...val,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalInputMessages,
    totalOutputMessages,
    totalMessages: totalInputMessages + totalOutputMessages,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    totalCostInr,
    avgLatencyMs,
    successCount,
    errorCount,
    successRate,
    activeModel,
    activeProvider: "gemini",
    modelBreakdown,
    providerBreakdown,
    queryTypeBreakdown,
    dailyHistory,
    recentLogs: filteredLogs.slice(0, 50),
  };
}

/**
 * Export telemetry logs as CSV
 */
export function exportAITelemetryCsv(logs: AIUsageRecord[]): void {
  if (typeof window === "undefined") return;
  const headers = [
    "ID",
    "Timestamp",
    "User",
    "Provider",
    "Model",
    "Query Type",
    "Input Tokens",
    "Output Tokens",
    "Total Tokens",
    "Latency (ms)",
    "Status",
    "Cost (USD)",
    "Prompt Snippet",
  ];

  const rows = logs.map((l) => [
    l.id,
    l.timestamp,
    `"${(l.userName || "Student").replace(/"/g, '""')}"`,
    l.provider,
    l.model,
    l.queryType,
    l.inputTokens,
    l.outputTokens,
    l.totalTokens,
    l.latencyMs,
    l.status,
    l.estimatedCostUsd,
    `"${(l.promptSnippet || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `disha_ai_telemetry_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
