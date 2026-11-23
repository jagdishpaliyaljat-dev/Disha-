import * as React from "react";
import {
  Users,
  Eye,
  UserCheck,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Loader2,
  BookOpen,
  Trophy,
  Award,
  Zap,
  Target,
  Sparkles,
  Flame,
  AlertCircle,
  Database,
  Layers,
  CheckCircle2,
  Bell,
  Globe,
  Smartphone,
  ExternalLink,
  Download,
  Share2
} from "lucide-react";
import { AdminCard } from "./AdminCard";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

interface CloudTelemetrySummary {
  timestamp: string;
  total_students: number;
  active_24h: number;
  total_attempts: number;
  today_attempts: number;
  total_questions: number;
  total_subjects: number;
  total_chapters: number;
  total_tests: number;
  total_submissions: number;
  total_reports: number;
  active_broadcasts: number;
  exam_breakdown: Record<string, number>;
  subject_breakdown: Record<string, number>;
}

interface SiteDailyRecord {
  date: string;
  total_visits: number;
  unique_visitors: number;
  mobile_visits: number;
  desktop_visits: number;
  logged_in_visits: number;
  guest_visits: number;
  sources: Record<string, number>;
  pages: Record<string, number>;
  app_download_clicks: number;
}

interface SiteTrafficSummary {
  history: SiteDailyRecord[];
  total_visits: number;
  unique_visitors: number;
  mobile_visits: number;
  desktop_visits: number;
  app_downloads: number;
}

export const AdminAnalyticsDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = React.useState<"students" | "website">("website");
  const [telemetry, setTelemetry] = React.useState<CloudTelemetrySummary | null>(null);
  const [siteTraffic, setSiteTraffic] = React.useState<SiteTrafficSummary | null>(null);
  const [trafficDays, setTrafficDays] = React.useState<number>(7);
  const [loading, setLoading] = React.useState(true);
  const [lastRefreshed, setLastRefreshed] = React.useState<string | null>(null);

  // Fetch student telemetry
  const fetchCloudTelemetry = React.useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.rpc("get_admin_telemetry_summary");
        if (!error && data) {
          setTelemetry(data as CloudTelemetrySummary);
          try {
            localStorage.setItem("disha2020_cloud_telemetry_cache", JSON.stringify(data));
          } catch {}
          return;
        }
      }
    } catch (err) {
      console.warn("[AdminAnalytics] Error fetching cloud telemetry:", err);
    }

    try {
      const cached = localStorage.getItem("disha2020_cloud_telemetry_cache");
      if (cached) setTelemetry(JSON.parse(cached));
    } catch {}
  }, []);

  // Fetch website traffic
  const fetchSiteTraffic = React.useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.rpc("get_site_traffic_summary", { p_days: trafficDays });
        if (!error && data) {
          setSiteTraffic(data as SiteTrafficSummary);
          try {
            localStorage.setItem("disha2020_site_traffic_cache", JSON.stringify(data));
          } catch {}
          return;
        }
      }
    } catch (err) {
      console.warn("[AdminAnalytics] Error fetching site traffic:", err);
    }

    try {
      const cached = localStorage.getItem("disha2020_site_traffic_cache");
      if (cached) setSiteTraffic(JSON.parse(cached));
    } catch {}
  }, [trafficDays]);

  const refreshAll = React.useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCloudTelemetry(), fetchSiteTraffic()]);
    setLastRefreshed(new Date().toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setLoading(false);
  }, [fetchCloudTelemetry, fetchSiteTraffic]);

  React.useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Aggregate sources from site traffic history
  const aggregatedSources = React.useMemo(() => {
    const map: Record<string, number> = {};
    if (siteTraffic?.history) {
      siteTraffic.history.forEach((day) => {
        if (day.sources) {
          Object.entries(day.sources).forEach(([src, count]) => {
            map[src] = (map[src] || 0) + Number(count);
          });
        }
      });
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [siteTraffic]);

  const totalSourcesCount = React.useMemo(() => {
    return aggregatedSources.reduce((acc, [, v]) => acc + v, 0) || 1;
  }, [aggregatedSources]);

  // Aggregate top pages from site traffic history
  const aggregatedPages = React.useMemo(() => {
    const map: Record<string, number> = {};
    if (siteTraffic?.history) {
      siteTraffic.history.forEach((day) => {
        if (day.pages) {
          Object.entries(day.pages).forEach(([pg, count]) => {
            map[pg] = (map[pg] || 0) + Number(count);
          });
        }
      });
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [siteTraffic]);

  const maxDailyVisits = React.useMemo(() => {
    if (!siteTraffic?.history || siteTraffic.history.length === 0) return 10;
    const max = Math.max(...siteTraffic.history.map((d) => Number(d.total_visits || 0)));
    return max > 0 ? max : 10;
  }, [siteTraffic]);

  // Student exam & subject lists
  const examList = React.useMemo(() => {
    if (!telemetry?.exam_breakdown) return [];
    return Object.entries(telemetry.exam_breakdown).sort((a, b) => b[1] - a[1]);
  }, [telemetry]);

  const totalExamStudents = React.useMemo(() => {
    return examList.reduce((acc, [, v]) => acc + v, 0) || 1;
  }, [examList]);

  const subjectList = React.useMemo(() => {
    if (!telemetry?.subject_breakdown) return [];
    return Object.entries(telemetry.subject_breakdown).sort((a, b) => b[1] - a[1]);
  }, [telemetry]);

  const totalSubjectAttempts = React.useMemo(() => {
    return subjectList.reduce((acc, [, v]) => acc + v, 0) || 1;
  }, [subjectList]);

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-3 duration-700">
      
      {/* 1. Header Banner & Section Switcher */}
      <div className="bg-gradient-to-br from-white via-[#FFF9EF] to-white dark:from-[#171923] dark:via-[#1F2330] dark:to-[#171923] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] shadow-sm p-4 sm:p-7 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#C99A45]/15 via-[#800020]/10 to-transparent rounded-bl-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#800020]/10 dark:bg-[#F47B20]/15 border border-[#800020]/20 dark:border-[#F47B20]/30 text-[#800020] dark:text-[#F47B20] text-[10px] font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time Cloud Telemetry</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              एनालिटिक्स एवं <span className="text-[#800020] dark:text-[#F47B20]">लाइव इनसाइट्स</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium max-w-xl">
              वेबसाइट विजिटर्स, अधिग्रहण स्रोत (Telegram, WhatsApp, Search) एवं छात्र अभ्यास का लाइव डेटा।
            </p>

            {/* Sub-Tab Navigation Toggle */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setActiveSection("website")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  activeSection === "website"
                    ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                    : "bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-slate-600 dark:text-slate-300 hover:bg-[#F7EFE2]"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>🌐 वेबसाइट विजिटर्स व ट्रैफिक</span>
              </button>

              <button
                onClick={() => setActiveSection("students")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  activeSection === "students"
                    ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                    : "bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-slate-600 dark:text-slate-300 hover:bg-[#F7EFE2]"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>🎓 छात्र अभ्यास व सहभागिता</span>
              </button>
            </div>
          </div>

          {/* Quick Realtime Pill Badges */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[240px]">
            <div className="flex items-center justify-between gap-3 bg-white/80 dark:bg-[#252A3A]/80 p-3 rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">वेबसाइट पेज व्यूज</p>
                <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                  {loading ? "..." : (siteTraffic?.total_visits ?? 0).toLocaleString()}
                </p>
              </div>
              <button
                onClick={refreshAll}
                disabled={loading}
                className="p-2 bg-[#800020]/10 text-[#800020] dark:text-[#F47B20] rounded-xl hover:bg-[#800020]/20 transition-all cursor-pointer disabled:opacity-50"
                title="रीफ्रेश"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 bg-white/80 dark:bg-[#252A3A]/80 p-3 rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">APK डाउनलोड क्लिक्स</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {loading ? "..." : (siteTraffic?.app_downloads ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECTION 1: WEBSITE VISITORS & TRAFFIC TELEMETRY */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeSection === "website" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Days Filter Strip */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-slate-600 dark:text-slate-400">समय सीमा:</span>
              <div className="flex items-center bg-white dark:bg-[#1F2330] p-1 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
                {[7, 14, 30].map((days) => (
                  <button
                    key={days}
                    onClick={() => setTrafficDays(days)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                      trafficDays === days
                        ? "bg-[#800020] text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>

            <a
              href="https://analytics.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1.5"
            >
              <span>Google Analytics (GA4)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* 4 Cards: Visits, Unique, Mobile %, App Downloads */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <AdminCard className="p-4 space-y-2 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">कुल पेज व्यूज</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                {loading ? "..." : (siteTraffic?.total_visits ?? 0).toLocaleString()}
              </div>
              <p className="text-[10px] font-bold text-slate-400">पिछले {trafficDays} दिनों में</p>
            </AdminCard>

            <AdminCard className="p-4 space-y-2 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">यूनिक विजिटर्स</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {loading ? "..." : (siteTraffic?.unique_visitors ?? 0).toLocaleString()}
              </div>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">नए छात्र एवं आगंतुक</p>
            </AdminCard>

            <AdminCard className="p-4 space-y-2 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">मोबाइल शेयर</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                {loading
                  ? "..."
                  : siteTraffic?.total_visits && siteTraffic.total_visits > 0
                  ? Math.round(((siteTraffic.mobile_visits || 0) / siteTraffic.total_visits) * 100)
                  : 100}
                %
              </div>
              <p className="text-[10px] font-bold text-slate-400">
                {siteTraffic?.mobile_visits || 0} Mobile • {siteTraffic?.desktop_visits || 0} PC
              </p>
            </AdminCard>

            <AdminCard className="p-4 space-y-2 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">APK डाउनलोड सीटीए</span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 tabular-nums">
                {loading ? "..." : (siteTraffic?.app_downloads ?? 0).toLocaleString()}
              </div>
              <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400">वेबसाइट से डाउनलोड बटन टैप</p>
            </AdminCard>
          </div>

          {/* Daily Traffic Volume Bar Chart */}
          <AdminCard className="p-4 sm:p-6 space-y-4 border-[#E8D9C0] dark:border-[#31374A]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                  <span>दैनिक विजिट ट्रेंड (Daily Visits Timeline)</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">प्रतिदिन वेबसाइट पर आने वाले छात्रों का वितरण</p>
              </div>
              <span className="text-[10px] font-mono font-black text-slate-400 uppercase">
                PEAK: {maxDailyVisits}
              </span>
            </div>

            {loading ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[#800020] animate-spin" />
              </div>
            ) : !siteTraffic?.history || siteTraffic.history.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-slate-400 font-bold">
                अभी तक कोई वेबसाइट विजिट दर्ज नहीं हुई है।
              </div>
            ) : (
              <div className="h-40 flex items-end justify-between gap-1 sm:gap-2 pt-4">
                {siteTraffic.history.map((item) => {
                  const visits = Number(item.total_visits || 0);
                  const heightPercent = Math.max(Math.round((visits / maxDailyVisits) * 100), 6);
                  return (
                    <div key={item.date} className="flex-1 flex flex-col items-center gap-1.5 group h-full justify-end">
                      <div className="text-[8px] font-bold text-[#800020] dark:text-[#F47B20] opacity-0 group-hover:opacity-100 transition-opacity">
                        {visits}
                      </div>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full max-w-[28px] sm:max-w-[36px] rounded-t-xl bg-gradient-to-t from-[#800020] to-[#F47B20] hover:brightness-110 transition-all shadow-xs"
                      />
                      <span className="text-[8px] font-black text-slate-400 uppercase hidden sm:block">
                        {new Date(item.date).toLocaleDateString("hi-IN", { weekday: "short" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </AdminCard>

          {/* Acquisition Channels & Top Pages Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Traffic Acquisition Channels */}
            <AdminCard className="p-4 sm:p-6 space-y-4 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-emerald-600" />
                  <span>ट्रैफिक स्रोत (Traffic Sources)</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400 font-black uppercase">CHANNELS</span>
              </div>

              {aggregatedSources.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-bold">
                  कोई स्रोत डेटा उपलब्ध नहीं
                </div>
              ) : (
                <div className="space-y-3">
                  {aggregatedSources.map(([source, count]) => {
                    const percent = Math.round((count / totalSourcesCount) * 100);
                    const color = source.includes("telegram")
                      ? "bg-sky-500"
                      : source.includes("whatsapp")
                      ? "bg-emerald-500"
                      : source.includes("google")
                      ? "bg-blue-600"
                      : source.includes("youtube")
                      ? "bg-rose-500"
                      : "bg-[#800020]";

                    return (
                      <div key={source} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="capitalize text-slate-800 dark:text-slate-200">{source}</span>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {count} ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            style={{ width: `${percent}%` }}
                            className={`h-full ${color} rounded-full transition-all duration-700`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminCard>

            {/* Top Visited Pages */}
            <AdminCard className="p-4 sm:p-6 space-y-4 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  <span>सर्वाधिक देखे गए पेज (Top Pages)</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400 font-black uppercase">PAGES</span>
              </div>

              {aggregatedPages.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-bold">
                  कोई पेज डेटा उपलब्ध नहीं
                </div>
              ) : (
                <div className="space-y-2.5">
                  {aggregatedPages.map(([page, hits]) => {
                    const totalVisits = siteTraffic?.total_visits || 1;
                    const percent = Math.round((hits / totalVisits) * 100);
                    return (
                      <div
                        key={page}
                        className="p-3 rounded-2xl bg-[#FFF9EF]/60 dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white font-mono truncate">
                            {page}
                          </p>
                          <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-800 mt-1.5 overflow-hidden">
                            <div
                              style={{ width: `${percent}%` }}
                              className="h-full bg-purple-600 rounded-full"
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                            {hits} Hits
                          </span>
                          <span className="block text-[9px] text-slate-400 font-bold">{percent}% Share</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminCard>
          </div>

        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECTION 2: STUDENT PRACTICE & TEST TELEMETRY */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeSection === "students" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Key Metrics 4-Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <AdminCard className="p-4 space-y-2 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">सक्रिय अभ्यर्थी</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Users className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                {loading ? "..." : (telemetry?.active_24h ?? 0)}
              </div>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>पिछले 24 घंटों में एक्टिव</span>
              </p>
            </AdminCard>

            <AdminCard className="p-4 space-y-2 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">कुल प्रश्न बैंक</span>
                <div className="w-9 h-9 rounded-xl bg-[#800020]/10 text-[#800020] dark:text-[#F47B20] flex items-center justify-center">
                  <Database className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                {loading ? "..." : (telemetry?.total_questions ?? 0).toLocaleString()}
              </div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {telemetry?.total_subjects ?? 8} विषय • {telemetry?.total_chapters ?? 48} अध्याय
              </p>
            </AdminCard>

            <AdminCard className="p-4 space-y-2 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">लाइव टेस्ट सहभागिता</span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Trophy className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                {loading ? "..." : (telemetry?.total_submissions ?? 0).toLocaleString()}
              </div>
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {telemetry?.total_tests ?? 0} टेस्ट आयोजित
              </p>
            </AdminCard>

            <AdminCard className="p-4 space-y-2 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">त्रुटि रिपोर्टें / टिकट</span>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <AlertCircle className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                {loading ? "..." : (telemetry?.total_reports ?? 0)}
              </div>
              <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                लंबित समीक्षा अनुरोध
              </p>
            </AdminCard>
          </div>

          {/* Detailed Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Target Exams Breakdown */}
            <AdminCard className="p-4 sm:p-6 space-y-4 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                  <span>अभ्यर्थियों के लक्षित परीक्षा वर्ग (Target Exams)</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                  {examList.length} श्रेणियां
                </span>
              </div>

              {loading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-6 h-6 text-[#800020] animate-spin" />
                </div>
              ) : examList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-bold">
                  कोई परीक्षा डेटा उपलब्ध नहीं
                </div>
              ) : (
                <div className="space-y-3">
                  {examList.map(([examName, count]) => {
                    const percent = Math.round((count / totalExamStudents) * 100);
                    return (
                      <div key={examName} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800 dark:text-slate-200">{examName}</span>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {count} छात्र ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            style={{ width: `${percent}%` }}
                            className="h-full bg-gradient-to-r from-[#800020] to-[#F47B20] rounded-full transition-all duration-700"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminCard>

            {/* Most Practiced Subjects */}
            <AdminCard className="p-4 sm:p-6 space-y-4 border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>सर्वाधिक अभ्यास किए गए विषय (Top Subjects)</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                  हल आवृत्ति
                </span>
              </div>

              {loading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-6 h-6 text-[#800020] animate-spin" />
                </div>
              ) : subjectList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-bold">
                  अभ्यास डेटा रिकॉर्ड हो रहा है
                </div>
              ) : (
                <div className="space-y-3">
                  {subjectList.map(([subj, count]) => {
                    const percent = Math.round((count / totalSubjectAttempts) * 100);
                    return (
                      <div key={subj} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{subj}</span>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {count} हल ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            style={{ width: `${percent}%` }}
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-700"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminCard>
          </div>

        </div>
      )}

    </div>
  );
};
