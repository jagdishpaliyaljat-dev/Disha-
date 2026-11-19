import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Swords,
  Users,
  Trophy,
  Flame,
  Clock,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  Calendar,
  Layers,
  Sparkles,
  Award,
  Zap,
  TrendingUp,
  UserCheck,
  Activity,
  Trash2,
  ArrowUpRight,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import {
  LiveBattleRoomRecord,
  BattleAnalyticsSummary,
  getBattleAnalyticsSummary,
  initGlobalBattleMonitor,
  clearBattleHistory,
  trackBattleRoomCreated,
  trackBattleRoomStarted,
  trackBattleRoomEnded,
} from "../../utils/battleTracker";
import { BattleAvatar } from "../battle/BattleAvatar";

interface LiveBattleDashboardProps {
  onNavigateToBattle?: () => void;
}

export const LiveBattleDashboard: React.FC<LiveBattleDashboardProps> = () => {
  const [summary, setSummary] = useState<BattleAnalyticsSummary>(() =>
    getBattleAnalyticsSummary()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshIntervalSec, setAutoRefreshIntervalSec] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "in_progress" | "lobby">("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"live" | "history" | "analytics">("live");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Function to refresh metrics
  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    try {
      const data = getBattleAnalyticsSummary();
      setSummary(data);
      setLastRefreshedAt(new Date());
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  }, []);

  // Connect to global Realtime battle monitor
  useEffect(() => {
    const unsubscribe = initGlobalBattleMonitor(() => {
      refreshData();
    });
    return () => {
      unsubscribe();
    };
  }, [refreshData]);

  // Periodic Auto-refresh
  useEffect(() => {
    if (autoRefreshIntervalSec <= 0) return;
    const interval = setInterval(() => {
      refreshData();
    }, autoRefreshIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshIntervalSec, refreshData]);

  const handleCopyCode = (code: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // Filtered recent battles for history view
  const filteredBattles = useMemo(() => {
    let list = summary.recentBattles;
    if (statusFilter !== "all") {
      list = list.filter((b) => b.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.roomCode.toLowerCase().includes(q) ||
          b.hostName.toLowerCase().includes(q) ||
          (b.winnerName && b.winnerName.toLowerCase().includes(q)) ||
          b.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [summary.recentBattles, statusFilter, searchQuery]);

  // Quick Demo Simulator (Creates a realistic battle to test live monitoring immediately)
  const handleSimulateDemoBattle = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const demoRoomCode = `RJ-${randomNum}`;
    const host = {
      id: `host_${randomNum}`,
      name: "छात्र अभ्यर्थी " + randomNum,
      avatar: "👑",
      isHost: true,
      isReady: true,
      score: 0,
      streak: 0,
      correctCount: 0,
      wrongCount: 0,
      avgResponseTimeMs: 0,
    };

    trackBattleRoomCreated({
      roomCode: demoRoomCode,
      config: {
        roomCode: demoRoomCode,
        hostId: host.id,
        questionCount: 30,
        timePerQuestionSec: 10,
        category: "all",
        questionSource: "curated",
        createdAt: Date.now(),
      },
      hostPlayer: host,
    });

    const botPlayer = {
      id: `bot_${randomNum}`,
      name: "Tanjiro AI",
      avatar: "⚔️",
      isBot: true,
      isHost: false,
      isReady: true,
      score: 0,
      streak: 0,
      correctCount: 0,
      wrongCount: 0,
      avgResponseTimeMs: 0,
    };

    trackBattleRoomStarted(demoRoomCode, [host, botPlayer]);
    refreshData();
  };

  // Export Battle Data as CSV
  const handleExportCSV = () => {
    try {
      const headers = [
        "Room Code",
        "Host Name",
        "Status",
        "Category",
        "Questions",
        "Time Per Question (s)",
        "Total Players",
        "Winner Name",
        "Winner Score",
        "Winner Accuracy (%)",
        "Created At",
        "Ended At",
      ];

      const rows = summary.recentBattles.map((b) => [
        `"${b.roomCode}"`,
        `"${b.hostName || ""}"`,
        `"${b.status}"`,
        `"${b.category}"`,
        b.questionCount,
        b.timePerQuestionSec,
        b.totalPlayerCount,
        `"${b.winnerName || "N/A"}"`,
        b.winnerScore || 0,
        b.winnerAccuracy || 0,
        `"${b.createdAt}"`,
        `"${b.endedAt || ""}"`,
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `disha2020_live_battles_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Failed to export battle report.");
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. Header Banner & Live Monitoring Status */}
      <div className="bg-gradient-to-r from-amber-950 via-[#800020] to-rose-950 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden border border-amber-500/20">
        <div className="absolute right-0 top-0 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black uppercase tracking-wider shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>Realtime Live Monitor Active</span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <Swords className="w-7 h-7 text-amber-400" />
              <span>Live Quiz Battle Telemetry</span>
            </h1>

            <p className="text-xs sm:text-sm text-amber-100/90 max-w-2xl font-medium leading-relaxed">
              वर्तमान में लाइव खेल रहे अभ्यर्थी, सक्रिय बैटल रूम्स, कुल खेली गई बैटल्स और छात्रों के रियल-टाइम स्कोरकार्ड का संपूर्ण एनालिटिक्स।
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Auto refresh dropdown */}
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-2xl border border-white/15 text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline text-white/80">Auto:</span>
              <select
                value={autoRefreshIntervalSec}
                onChange={(e) => setAutoRefreshIntervalSec(Number(e.target.value))}
                className="bg-transparent text-white font-extrabold focus:outline-none cursor-pointer"
              >
                <option value={5} className="text-stone-900">5s Fast</option>
                <option value={10} className="text-stone-900">10s Normal</option>
                <option value={30} className="text-stone-900">30s Slow</option>
                <option value={0} className="text-stone-900">Off</option>
              </select>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-xs font-bold flex items-center gap-1.5 border border-white/20 shadow-xs cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-300" : ""}`} />
              <span>रिफ्रेश</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Export</span>
            </button>
          </div>
        </div>

        {/* Footer timestamp */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-amber-200/80">
          <span>Last Synced: {lastRefreshedAt.toLocaleTimeString()}</span>
          <span>Room Timeout: 60s Heartbeat Check</span>
        </div>
      </div>

      {/* 2. Top Metric Cards (Core KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Live Now Players (वर्तमान में लाइव खिलाड़ी) */}
        <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-4 sm:p-5 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                लाइव खिलाड़ी अभी
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-emerald-600 dark:text-emerald-400">
                  {summary.liveNowPlayersCount}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Now
                </span>
              </div>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2 font-medium">
            वर्तमान में एक्टिव बैटल रूम्स में उपस्थित
          </p>
        </div>

        {/* KPI 2: Live Active Rooms (सक्रिय रूम्स) */}
        <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-4 sm:p-5 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                सक्रिय लाइव रूम्स
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-rose-600 dark:text-rose-400">
                  {summary.liveNowRoomsCount}
                </span>
                <span className="text-xs font-bold text-stone-400">
                  Rooms
                </span>
              </div>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2 font-medium">
            लॉबी या मैच प्रोग्रेस में चल रहे मुकाबले
          </p>
        </div>

        {/* KPI 3: Total Battles Played (कुल खेली गई बैटल) */}
        <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-4 sm:p-5 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                कुल खेली गई बैटल
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-amber-600 dark:text-amber-400">
                  {summary.totalBattlesPlayed}
                </span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                  +{summary.todayBattlesCount} आज
                </span>
              </div>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2 font-medium">
            सफलतापूर्वक पूर्ण हुए कुल मुकाबले
          </p>
        </div>

        {/* KPI 4: Total Battle Participants (कुल प्रतिभागी) */}
        <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-4 sm:p-5 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                कुल प्रतिभागी छात्र
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#800020] dark:text-[#F47B20]">
                  {summary.totalParticipantsCount}
                </span>
                <span className="text-[10px] font-bold text-stone-400">
                  ({summary.avgPlayersPerBattle} / मैच)
                </span>
              </div>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2 font-medium">
            औसत विजेता एक्यूरेसी: {summary.avgAccuracyPercent}%
          </p>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab("live")}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSubTab === "live"
                ? "bg-[#800020] text-white shadow-md shadow-amber-950/20"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>लाइव सक्रिय बैटल्स ({summary.activeLiveRooms.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSubTab === "history"
                ? "bg-[#800020] text-white shadow-md shadow-amber-950/20"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>मैच इतिहास ({summary.recentBattles.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab("analytics")}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSubTab === "analytics"
                ? "bg-[#800020] text-white shadow-md shadow-amber-950/20"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>पैटर्न व एनालिटिक्स</span>
          </button>
        </div>

        {/* Quick Simulation Button for Immediate Admin Verification */}
        <button
          onClick={handleSimulateDemoBattle}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-300/40 transition-all cursor-pointer"
          title="Simulate a real live battle room to test monitoring"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>+ टेस्ट लाइव रूम जोड़ें</span>
        </button>
      </div>

      {/* 4. Sub-Tab 1: Currently Active Live Battles (लाइव सक्रिय रूम्स) */}
      {activeSubTab === "live" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
              <span>वर्तमान में एक्टिव रूम्स</span>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {summary.activeLiveRooms.length} Active
              </span>
            </h2>

            <span className="text-xs text-stone-500 font-medium">
              हर 10 सेकंड में स्वतः रिफ्रेश होता है
            </span>
          </div>

          {summary.activeLiveRooms.length === 0 ? (
            <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-8 sm:p-12 text-center border border-dashed border-stone-300 dark:border-stone-800 space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/40 text-[#800020] dark:text-amber-300 mx-auto flex items-center justify-center">
                <Swords className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
                अभी कोई लाइव बैटल सक्रिय नहीं है
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                जैसे ही कोई भी छात्र ऐप में 1v1 या मल्टी-प्लेयर लाइव बैटल शुरू करेगा, वह रूम और सभी खिलाड़ियों की लाइव स्थिति तुरंत यहाँ दिखाई देगी।
              </p>
              <div className="pt-2">
                <button
                  onClick={handleSimulateDemoBattle}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>लाइव टेस्ट बैटल सिमुलेट करें</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.activeLiveRooms.map((room) => {
                const isLobby = room.status === "lobby";
                const isCopied = copiedCode === room.roomCode;

                return (
                  <div
                    key={room.id}
                    className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 border-2 border-emerald-400/50 dark:border-emerald-500/40 shadow-sm relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Room Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyCode(room.roomCode)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-[#800020] dark:text-amber-300 text-xs font-black border border-amber-300/50 hover:bg-amber-200 transition-colors"
                            title="Click to copy room code"
                          >
                            <span>{room.roomCode}</span>
                            {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-stone-500" />}
                          </button>
                          <span className="text-[10px] font-bold text-stone-500 capitalize">
                            {room.category}
                          </span>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isLobby
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {isLobby ? "Lobby" : "In Battle"}
                        </span>
                      </div>

                      {/* Host & Config */}
                      <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800">
                        <BattleAvatar avatar={room.hostAvatar} name={room.hostName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                            {room.hostName} (Host)
                          </p>
                          <p className="text-[10px] text-stone-500 flex items-center gap-2 mt-0.5 font-medium">
                            <span>{room.questionCount} प्रश्न</span>
                            <span>•</span>
                            <span>{room.timePerQuestionSec}s प्रति सवाल</span>
                          </p>
                        </div>
                      </div>

                      {/* Players Strip */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 mb-1.5">
                          <span>सक्रिय खिलाड़ी ({room.players?.length || room.activePlayerCount})</span>
                          <span className="text-emerald-600 font-extrabold">Online</span>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                          {room.players?.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs shrink-0"
                            >
                              <BattleAvatar avatar={p.avatar} name={p.name} size="sm" />
                              <span className="max-w-[60px] truncate text-[11px] font-semibold">
                                {p.name}
                              </span>
                              {p.isBot && (
                                <span className="text-[9px] font-extrabold text-blue-600 bg-blue-100 px-1 rounded">
                                  AI
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-500">
                      <span>Started: {new Date(room.createdAt).toLocaleTimeString()}</span>
                      <span className="text-emerald-600 font-bold">🟢 Live Telemetry</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Sub-Tab 2: Battles History (खेली गई बैटल्स का इतिहास) */}
      {activeSubTab === "history" && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#111A2E] p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="रूम कोड, होस्ट या विजेता खोजें..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-stone-100 dark:bg-stone-800 border-none focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-amber-400 text-stone-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs font-bold text-stone-500 whitespace-nowrap">Filter:</span>
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition ${
                  statusFilter === "all" ? "bg-[#800020] text-white" : "bg-stone-100 dark:bg-stone-800 text-stone-600"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("completed")}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition ${
                  statusFilter === "completed" ? "bg-[#800020] text-white" : "bg-stone-100 dark:bg-stone-800 text-stone-600"
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setStatusFilter("in_progress")}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition ${
                  statusFilter === "in_progress" ? "bg-[#800020] text-white" : "bg-stone-100 dark:bg-stone-800 text-stone-600"
                }`}
              >
                In Progress
              </button>
            </div>
          </div>

          {/* History Records Table / Cards */}
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 dark:bg-stone-900/60 border-b border-stone-200 dark:border-stone-800 text-stone-500 font-extrabold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Room Code</th>
                    <th className="py-3 px-4">Host</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Config</th>
                    <th className="py-3 px-4">Players</th>
                    <th className="py-3 px-4">Winner</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                  {filteredBattles.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs font-bold text-stone-400">
                        कोई बैटल रिकॉर्ड नहीं मिला।
                      </td>
                    </tr>
                  ) : (
                    filteredBattles.map((battle) => {
                      const isCompleted = battle.status === "completed";
                      return (
                        <tr key={battle.id} className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition">
                          <td className="py-3 px-4 font-mono font-bold text-[#800020] dark:text-amber-400">
                            {battle.roomCode}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <BattleAvatar avatar={battle.hostAvatar} name={battle.hostName} size="sm" />
                              <span className="font-semibold text-stone-900 dark:text-white truncate max-w-[100px]">
                                {battle.hostName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 capitalize font-medium text-stone-600 dark:text-stone-300">
                            {battle.category}
                          </td>
                          <td className="py-3 px-4 font-medium text-stone-500">
                            {battle.questionCount}Q • {battle.timePerQuestionSec}s
                          </td>
                          <td className="py-3 px-4 font-bold text-stone-700 dark:text-stone-200">
                            {battle.totalPlayerCount} छात्र
                          </td>
                          <td className="py-3 px-4">
                            {battle.winnerName ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-amber-500 font-bold">👑</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {battle.winnerName}
                                </span>
                                <span className="text-[10px] text-stone-400">
                                  ({battle.winnerScore} pts)
                                </span>
                              </div>
                            ) : (
                              <span className="text-stone-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-stone-500 whitespace-nowrap">
                            {new Date(battle.createdAt).toLocaleDateString("hi-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                isCompleted
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : battle.status === "in_progress"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {battle.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Sub-Tab 3: Analytics & Patterns (पैटर्न व एनालिटिक्स) */}
      {activeSubTab === "analytics" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Question Count Preference */}
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 border border-stone-200 dark:border-stone-800 shadow-xs">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Question Count Preference</span>
              <Layers className="w-4 h-4 text-amber-500" />
            </h3>
            <div className="space-y-2.5">
              {Object.entries(summary.questionCountBreakdown).map(([key, count]) => {
                const pct = Math.round((count / Math.max(1, summary.recentBattles.length)) * 100);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-stone-700 dark:text-stone-200">{key}</span>
                      <span className="text-stone-500">{count} matches ({pct}%)</span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time Per Question Preference */}
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 border border-stone-200 dark:border-stone-800 shadow-xs">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Speed Timer Preference</span>
              <Zap className="w-4 h-4 text-rose-500" />
            </h3>
            <div className="space-y-2.5">
              {Object.entries(summary.timeLimitBreakdown).map(([key, count]) => {
                const pct = Math.round((count / Math.max(1, summary.recentBattles.length)) * 100);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-stone-700 dark:text-stone-200">{key} per question</span>
                      <span className="text-stone-500">{count} matches ({pct}%)</span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Popularity */}
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 border border-stone-200 dark:border-stone-800 shadow-xs">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Popular GK Categories</span>
              <Trophy className="w-4 h-4 text-emerald-500" />
            </h3>
            <div className="space-y-2.5">
              {Object.entries(summary.popularCategories).map(([key, count]) => {
                const pct = Math.round((count / Math.max(1, summary.recentBattles.length)) * 100);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold capitalize">
                      <span className="text-stone-700 dark:text-stone-200">{key}</span>
                      <span className="text-stone-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveBattleDashboard;
