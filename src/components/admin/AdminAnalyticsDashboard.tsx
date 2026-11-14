import * as React from "react";
import {
  Users,
  Eye,
  UserCheck,
  Smartphone,
  TrendingUp,
  Globe,
  ExternalLink,
  RefreshCw,
  BarChart3,
  PieChart,
  Loader2
} from "lucide-react";
import { collection, query, where } from "firebase/firestore";
import { guardedGetDocs } from "../../utils/quotaTracker";
import { db } from "../../lib/firebase";
import { UTMLinkBuilder } from "./UTMLinkBuilder";
import { AdminCard } from "./AdminCard";

interface DailyAnalyticsDoc {
  date: string;
  totalVisits?: number;
  uniqueVisitors?: number;
  loggedInCount?: number;
  guestCount?: number;
  deviceSplit?: { mobile?: number; desktop?: number };
  trafficSources?: Record<string, number>;
  topPages?: Record<string, number>;
}

export const AdminAnalyticsDashboard: React.FC = () => {
  const [range, setRange] = React.useState<"today" | "7days" | "30days">("7days");
  const [data, setData] = React.useState<DailyAnalyticsDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const daysToFetch = range === "today" ? 1 : range === "7days" ? 7 : 30;
      const dates: string[] = [];
      const now = new Date();

      for (let i = 0; i < daysToFetch; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
      }

      const q = query(
        collection(db, "analytics_daily"),
        where("date", "in", dates.slice(0, 30))
      );
      const snap = await guardedGetDocs(q, "Admin", "Fetch Daily Analytics");

      const docsMap = new Map<string, DailyAnalyticsDoc>();
      if (!snap.empty) {
        snap.docs.forEach((doc) => {
          docsMap.set(doc.id, doc.data() as DailyAnalyticsDoc);
        });
      }

      const list: DailyAnalyticsDoc[] = dates.map((d) => {
        return (
          docsMap.get(d) || {
            date: d,
            totalVisits: 0,
            uniqueVisitors: 0,
            loggedInCount: 0,
            guestCount: 0,
            deviceSplit: { mobile: 0, desktop: 0 },
            trafficSources: {},
            topPages: {},
          }
        );
      });

      list.sort((a, b) => a.date.localeCompare(b.date));
      setData(list);
    } catch (err) {
      console.warn("Failed to fetch analytics_daily from Firestore:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAnalytics();
  }, [range]);

  const totalVisits = data.reduce((acc, d) => acc + (d.totalVisits || 0), 0);
  const uniqueVisitors = data.reduce((acc, d) => acc + (d.uniqueVisitors || 0), 0);
  const loggedInCount = data.reduce((acc, d) => acc + (d.loggedInCount || 0), 0);
  const guestCount = data.reduce((acc, d) => acc + (d.guestCount || 0), 0);
  const mobileCount = data.reduce((acc, d) => acc + (d.deviceSplit?.mobile || 0), 0);
  const desktopCount = data.reduce((acc, d) => acc + (d.deviceSplit?.desktop || 0), 0);

  const sourcesMap: Record<string, number> = {};
  data.forEach((d) => {
    if (d.trafficSources) {
      Object.entries(d.trafficSources).forEach(([k, v]) => {
        sourcesMap[k] = (sourcesMap[k] || 0) + v;
      });
    }
  });

  const totalSourcesCount = Object.values(sourcesMap).reduce((a, b) => a + b, 0) || 1;

  const pagesMap: Record<string, number> = {};
  data.forEach((d) => {
    if (d.topPages) {
      Object.entries(d.topPages).forEach(([k, v]) => {
        const readablePath = k.replace(/_/g, "/") || "/";
        pagesMap[readablePath] = (pagesMap[readablePath] || 0) + v;
      });
    }
  });

  const sortedPages = Object.entries(pagesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const maxDailyVisit = Math.max(...data.map((d) => d.totalVisits || 0), 10);

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-3 duration-700">
      {/* 1. Header Section */}
      <div className="bg-white dark:bg-[#111A2E] rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Traffic Analytics</span>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Live <span className="text-blue-600">Insights</span>
              </h1>
              <p className="text-xs sm:text-base text-slate-500 dark:text-slate-400 font-medium max-w-xl">
                Track student engagement, acquisition channels, and popular content performance across the platform.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {(["today", "7days", "30days"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                      range === r
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {r === "today" ? "1D" : r === "7days" ? "7D" : "30D"}
                  </button>
                ))}
              </div>
              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
              </button>
              <a
                href="https://analytics.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-[#1E5BF0] hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-blue-600/10 active:scale-95"
              >
                <span>Google Analytics</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Key KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full lg:w-auto lg:min-w-[280px]">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Visits</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{loading ? "..." : totalVisits.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unique Users</p>
              <p className="text-2xl font-black text-emerald-600 tabular-nums">{loading ? "..." : uniqueVisitors.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mobile Share</p>
              <p className="text-2xl font-black text-blue-600 tabular-nums">{loading ? "..." : (totalVisits > 0 ? Math.round((mobileCount / (mobileCount + desktopCount || 1)) * 100) : 0)}%</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Auth Rate</p>
              <p className="text-2xl font-black text-purple-600 tabular-nums">{loading ? "..." : (totalVisits > 0 ? Math.round((loggedInCount / totalVisits) * 100) : 0)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          { label: "Visits", value: totalVisits, icon: Eye, color: "blue", sub: "Total Volume" },
          { label: "Users", value: uniqueVisitors, icon: Users, color: "emerald", sub: "Unique IDs" },
          { label: "Auth Split", value: loggedInCount, icon: UserCheck, color: "purple", sub: `${guestCount} Guests`, percent: totalVisits > 0 ? Math.round((loggedInCount / totalVisits) * 100) : 0 },
          { label: "Mobile", value: mobileCount, icon: Smartphone, color: "amber", sub: `${desktopCount} PC`, percent: mobileCount + desktopCount > 0 ? Math.round((mobileCount / (mobileCount + desktopCount)) * 100) : 0 },
        ].map((card, i) => (
          <AdminCard key={i} className="p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{card.label}</span>
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-${card.color}-500/10 text-${card.color}-600 flex items-center justify-center`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {loading ? "..." : card.value.toLocaleString()}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{card.sub}</p>
              {card.percent !== undefined && (
                <span className={`text-[9px] font-black text-${card.color}-600`}>{card.percent}%</span>
              )}
            </div>
          </AdminCard>
        ))}
      </div>

      {/* Trend Chart */}
      <AdminCard className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 sm:pb-4">
          <div className="space-y-0.5">
            <h3 className="text-[11px] sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>Volume Trends</span>
            </h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Page visit distribution</p>
          </div>
          <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest">
            PEAK: {maxDailyVisit}
          </span>
        </div>

        {loading ? (
          <div className="h-32 sm:h-48 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="h-32 sm:h-48 flex items-end justify-between gap-1 sm:gap-2 pt-4">
            {data.map((item) => {
              const heightPercent = Math.max(Math.round(((item.totalVisits || 0) / maxDailyVisit) * 100), 4);
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-1.5 group h-full justify-end">
                  <div className="text-[7px] sm:text-[8px] font-black text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.totalVisits || 0}
                  </div>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full max-w-[24px] sm:max-w-[32px] rounded-t-lg sm:rounded-t-2xl bg-gradient-to-t from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 transition-all shadow-sm"
                  />
                  <span className="text-[7px] font-black text-slate-400 uppercase hidden sm:block">
                    {new Date(item.date).toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </AdminCard>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Acquisition */}
        <AdminCard className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 sm:pb-4">
            <h3 className="text-[11px] sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>Acquisition</span>
            </h3>
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">CHANNELS</span>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {[
              { key: "telegram", label: "Telegram", color: "bg-sky-500" },
              { key: "whatsapp", label: "WhatsApp", color: "bg-emerald-500" },
              { key: "google", label: "Google Search", color: "bg-blue-600" },
              { key: "direct", label: "Direct Access", color: "bg-purple-600" },
              { key: "youtube", label: "YouTube", color: "bg-rose-500" },
              { key: "other", label: "Others", color: "bg-amber-500" },
            ].map((src) => {
              const count = sourcesMap[src.key] || 0;
              const percent = Math.round((count / totalSourcesCount) * 100);
              return (
                <div key={src.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-black uppercase tracking-tight">
                    <span className="text-slate-700 dark:text-slate-300">{src.label}</span>
                    <span className="text-slate-400 font-mono">
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${percent}%` }}
                      className={`h-full ${src.color} rounded-full transition-all duration-700`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </AdminCard>

        {/* Popular Content */}
        <AdminCard className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 sm:pb-4">
            <h3 className="text-[11px] sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-600" />
              <span>Top Articles</span>
            </h3>
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">ENGAGEMENT</span>
          </div>

          {sortedPages.length === 0 ? (
            <div className="py-10 text-center text-[9px] text-slate-400 font-black uppercase tracking-widest">
              No content metrics
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {sortedPages.map(([pagePath, hits]) => {
                const percent = Math.round((hits / totalVisits) * 100) || 0;
                return (
                  <div key={pagePath} className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-[24px] bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 sm:gap-4 group hover:border-purple-300 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] sm:text-[11px] font-black font-mono text-slate-900 dark:text-white truncate uppercase tracking-tighter">
                        {pagePath}
                      </div>
                      <div className="w-full h-0.5 sm:h-1 rounded-full bg-slate-200 dark:bg-slate-800 mt-2 overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className="h-full bg-purple-600 rounded-full transition-all duration-700"
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-white font-mono uppercase">
                        {hits} Hits
                      </div>
                      <div className="text-[8px] sm:text-[9px] text-slate-400 font-black uppercase tracking-tighter">
                        {percent}% Share
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminCard>
      </div>

      <UTMLinkBuilder />
    </div>
  );
};
