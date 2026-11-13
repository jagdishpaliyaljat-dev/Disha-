import * as React from "react";
import { 
  Eye, 
  Database, 
  Zap, 
  ShieldCheck, 
  RefreshCw, 
  TrendingDown, 
  Radio, 
  Layers, 
  FileText, 
  Clock, 
  CheckCircle2, 
  HardDrive,
  BarChart3,
  Server
} from "lucide-react";
import { 
  firestoreDataService, 
  ReadTelemetryMetrics 
} from "../../services/firestoreDataService";
import { getQuotaSummary, getReadOptimizationStats } from "../../utils/quotaTracker";

const READ_DAILY_LIMIT = 50000;

export const ReadHealthDashboard: React.FC = () => {
  const [metrics, setMetrics] = React.useState<ReadTelemetryMetrics>(firestoreDataService.getReadTelemetryMetrics());
  const [quotaSummary, setQuotaSummary] = React.useState(getQuotaSummary());
  const [optStats, setOptStats] = React.useState(getReadOptimizationStats());
  const [lastRefreshed, setLastRefreshed] = React.useState<Date>(new Date());

  React.useEffect(() => {
    // Subscribe to real-time telemetry from firestoreDataService
    const unsub = firestoreDataService.subscribeReadTelemetry((newMetrics) => {
      setMetrics(newMetrics);
      setQuotaSummary(getQuotaSummary());
      setOptStats(getReadOptimizationStats());
      setLastRefreshed(new Date());
    });

    return () => unsub();
  }, []);

  const handleManualRefresh = () => {
    setMetrics(firestoreDataService.getReadTelemetryMetrics());
    setQuotaSummary(getQuotaSummary());
    setOptStats(getReadOptimizationStats());
    setLastRefreshed(new Date());
  };

  const handleReset = () => {
    firestoreDataService.resetReadTelemetry();
    setMetrics(firestoreDataService.getReadTelemetryMetrics());
  };

  // Calculations
  const appRequests = Math.max(metrics.totalAppRequests, quotaSummary.reads);
  const actualBilledReads = quotaSummary.reads;
  const inFlightDedupes = Math.max(metrics.deduplicatedInFlightRequests, optStats.inFlightDeduplications || 0);
  const totalCacheHits = Math.max(metrics.memoryCacheHits + metrics.persistentCacheHits, optStats.cacheHits || 0);
  const activeListeners = Math.max(metrics.activePhysicalListeners, optStats.activeListeners || 0);
  
  const savedReads = inFlightDedupes + totalCacheHits;
  const totalOpportunities = actualBilledReads + savedReads;
  const overallCacheEfficiency = totalOpportunities > 0 
    ? Math.round((savedReads / totalOpportunities) * 100) 
    : 100;

  const quotaPercent = Math.min(100, Math.round((actualBilledReads / READ_DAILY_LIMIT) * 100));
  const remainingQuota = Math.max(0, READ_DAILY_LIMIT - actualBilledReads);

  const avgDocsPerQuery = metrics.avgDocsPerServerFetch > 0
    ? metrics.avgDocsPerServerFetch.toFixed(1)
    : "1.0";

  // Collection breakdown
  const collectionBreakdown = Object.entries(metrics.readsByCollection || {}).map(([col, reads]) => ({
    name: col,
    reads
  })).sort((a, b) => b.reads - a.reads);

  // Screen / Category breakdown
  const categoryBreakdown = Object.entries(metrics.readsByScreen || {}).map(([cat, reads]) => ({
    name: cat,
    reads
  })).sort((a, b) => b.reads - a.reads);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Firestore Read Telemetry & Multi-Tier Cache Health
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Spark 50k Guard
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Zero-redundancy read engine: Deduplication, LRU memory cache, persistent IndexedDB, and reference-counted listeners
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all"
            title="Reset telemetry counters"
          >
            Reset Session Stats
          </button>
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Actual Billed Reads */}
        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Billed Firebase Reads</span>
            <Server className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
              {actualBilledReads.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400">/ 50,000 limit</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                quotaPercent > 80 ? 'bg-red-500' : quotaPercent > 50 ? 'bg-amber-500' : 'bg-blue-600'
              }`} 
              style={{ width: `${quotaPercent}%` }} 
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 pt-1 font-semibold">
            <span>{quotaPercent}% Quota Used</span>
            <span>{remainingQuota.toLocaleString()} Remaining</span>
          </div>
        </div>

        {/* Read Deduplication & Savings */}
        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Reads Saved</span>
            <TrendingDown className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {savedReads.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-600">Saved</span>
          </div>
          <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
            <div className="flex justify-between">
              <span>Cache Hits:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{totalCacheHits}</span>
            </div>
            <div className="flex justify-between">
              <span>In-flight Deduplications:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{inFlightDedupes}</span>
            </div>
          </div>
        </div>

        {/* Cache Efficiency */}
        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cache Efficiency</span>
            <HardDrive className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-purple-600 dark:text-purple-400">
              {overallCacheEfficiency}%
            </span>
            <span className="text-xs font-bold text-purple-600">Efficiency</span>
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            {overallCacheEfficiency >= 90 ? "Excellent: >90% of requests resolved locally" : "Warmup phase: Cache populating"}
          </p>
        </div>

        {/* Active Listeners & Query Average */}
        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Shared Listeners</span>
            <Radio className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
              {activeListeners}
            </span>
            <span className="text-xs font-bold text-amber-600">Ref Counted</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 pt-1">
            <span>Avg Docs / Query:</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{avgDocsPerQuery} docs</span>
          </div>
        </div>
      </div>

      {/* Breakdowns & Architecture Guarantee */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection Breakdown */}
        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Reads by Collection
              </h4>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Billed Docs</span>
          </div>

          {collectionBreakdown.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 font-medium">
              No collection reads recorded in this session (0 reads / offline cache active)
            </div>
          ) : (
            <div className="space-y-2.5">
              {collectionBreakdown.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {item.reads} reads
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Screen / Feature Category Breakdown */}
        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Reads by Screen / Context
              </h4>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Operations</span>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 font-medium">
              Curriculum version check active: Navigation generates 0 reads
            </div>
          ) : (
            <div className="space-y-2.5">
              {categoryBreakdown.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {item.name}
                  </span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {item.reads} reads
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Optimization Architecture Safeguards */}
      <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-slate-600 dark:text-slate-300 space-y-2">
        <div className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px]">
          <ShieldCheck className="w-4 h-4" />
          <span>Active Spark Guard Architecture</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-indigo-500/10">
            <p className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">1-Read Curriculum Check</p>
            <p className="text-slate-500">Only `metadata/app_version` is read on app open. If remote matches local IndexedDB, all questions load locally at 0 reads.</p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-indigo-500/10">
            <p className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">In-Flight Deduplication</p>
            <p className="text-slate-500">Concurrent requests for identical paths reuse the exact same Promise, eliminating parallel duplicate reads.</p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-indigo-500/10">
            <p className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">Shared Ref-Counted Listeners</p>
            <p className="text-slate-500">Multiple UI components share single physical Firestore listeners. Unsubscribes are reference-counted to stop leaks.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
