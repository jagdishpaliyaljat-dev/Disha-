import * as React from "react";
import { supabase } from "../../lib/supabase";
import { guardedSetDoc, guardedDeleteDoc } from "../../utils/quotaTracker";
import { loadUserProfile } from "../../utils/userProfileStorage";
import { AIApiConfig, AIProvider, AIKeyHealthStatus } from "../../types";
import { 
  Plus, 
  Loader2, 
  Key, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Trash2, 
  Activity, 
  ShieldCheck, 
  Cpu, 
  Zap,
  Bot,
  Power,
  SlidersHorizontal,
  Database,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Edit3,
  Clock,
  History,
  Layers,
  ChevronDown,
  ChevronUp,
  Globe,
  X
} from "lucide-react";
import { ApiSettingsModal } from "./ApiSettingsModal";
import { AdminCard } from "./AdminCard";

const PROVIDER_METADATA: Record<AIProvider, {
  name: string;
  badgeClass: string;
  icon: React.FC<{ className?: string }>;
  tagline: string;
}> = {
  gemini: {
    name: "Google Gemini",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    icon: Sparkles,
    tagline: "Multimodal & Native SDK",
  },
  openai: {
    name: "OpenAI (ChatGPT)",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    icon: Cpu,
    tagline: "GPT-4o & Mini Models",
  },
  claude: {
    name: "Anthropic Claude",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    icon: Bot,
    tagline: "Claude 3.7 & 3.5 Sonnet",
  },
  groq: {
    name: "Groq (LPU Speed)",
    badgeClass: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    icon: Zap,
    tagline: "300+ Tokens/sec Inference",
  },
};

export const AIApiManagementSection: React.FC = () => {
  const [configs, setConfigs] = React.useState<AIApiConfig[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);
  const [editingConfig, setEditingConfig] = React.useState<AIApiConfig | null>(null);
  const [testingKeyId, setTestingKeyId] = React.useState<string | null>(null);
  const [togglingKeyId, setTogglingKeyId] = React.useState<string | null>(null);
  const [resettingKeyId, setResettingKeyId] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [deletingKeyId, setDeletingKeyId] = React.useState<string | null>(null);
  const [toastMessage, setToastMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [reordering, setReordering] = React.useState(false);
  const [filterProvider, setFilterProvider] = React.useState<string>("all");
  const [rotationPolicy, setRotationPolicy] = React.useState<"priority_failover" | "round_robin">("priority_failover");
  const [showFailoverLog, setShowFailoverLog] = React.useState(false);
  const [telemetry, setTelemetry] = React.useState<any>(null);
  const [testFeedback, setTestFeedback] = React.useState<{ 
    id: string; 
    success: boolean; 
    message: string; 
    latencyMs?: number;
  } | null>(null);

  const [firebaseInfo, setFirebaseInfo] = React.useState<{ projectId: string; databaseId: string; serviceAccount?: string } | null>(null);

  const getAdminHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {}
    return headers;
  };

  const fetchFirebaseInfo = async () => {
    try {
      const headers = await getAdminHeaders();
      const res = await fetch("/api/admin/firebase-info", { headers });
      if (res.ok) {
        const data = await res.json();
        setFirebaseInfo(data);
      }
    } catch (_) {}
  };

  const fetchTelemetry = async () => {
    try {
      const headers = await getAdminHeaders();
      const res = await fetch("/api/admin/ai-rotation/status", { headers });
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
        if (data.policy) {
          setRotationPolicy(data.policy);
        }
      }
    } catch (_) {}
  };

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const headers = await getAdminHeaders();
      let serverConfigs: AIApiConfig[] = [];
      try {
        const response = await fetch("/api/admin/ai-configs", { headers });
        if (response.ok) {
          const data = await response.json();
          serverConfigs = Array.isArray(data) ? data : (Array.isArray(data?.configs) ? data.configs : []);
        }
      } catch (err) {
        console.warn("[AIApiManagement] Server fetch configs notice:", err);
      }

      // Query Firestore client SDK to sync metadata (keys are stored encrypted on backend)
      let mergedConfigs = [...serverConfigs];
      try {
        const querySnapshot = await getDocs(collection(db, "ai_api_configs"));
        querySnapshot.forEach(docSnap => {
          const d = docSnap.data();
          const existingIdx = mergedConfigs.findIndex(c => c.id === docSnap.id);
          if (existingIdx === -1) {
            mergedConfigs.push({
              id: docSnap.id,
              name: d.name || "AI Key",
              provider: (d.provider as AIProvider) || "gemini",
              apiKey: "•••••••••••••",
              model: d.model || "gemini-2.5-flash",
              enabled: d.enabled ?? true,
              priority: d.priority || (mergedConfigs.length + 1),
              status: "available",
              isSystem: docSnap.id === "system-gemini",
              createdAt: d.createdAt || d.updatedAt,
            });
          }
        });
      } catch (fsErr) {
        console.warn("[AIApiManagement] Firestore client fetch notice:", fsErr);
      }

      setConfigs(mergedConfigs);
    } catch (e) {
      console.error("Failed to fetch configs", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchConfigs();
    fetchFirebaseInfo();
    fetchTelemetry();

    // Periodic telemetry polling every 10s to keep countdowns and failover events live
    const interval = setInterval(() => {
      fetchTelemetry();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleSetPolicy = async (newPolicy: "priority_failover" | "round_robin") => {
    try {
      const headers = await getAdminHeaders();
      const res = await fetch("/api/admin/ai-rotation/policy", {
        method: "POST",
        headers,
        body: JSON.stringify({ policy: newPolicy })
      });
      if (res.ok) {
        setRotationPolicy(newPolicy);
        fetchTelemetry();
      }
    } catch (e) {
      console.error("Failed to update policy", e);
    }
  };

  const handleTestConfig = async (config: AIApiConfig) => {
    setTestingKeyId(config.id);
    setTestFeedback(null);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try {
        controller.abort(new Error("Verification timed out"));
      } catch {
        controller.abort();
      }
    }, 20000);
    try {
      const headers = await getAdminHeaders();
      const response = await fetch("/api/ai/test-key", {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          configId: config.id,
          provider: config.provider || "gemini",
          model: config.model
        })
      });
      clearTimeout(timer);
      const data = await response.json();
      if (response.ok && data.success) {
        setTestFeedback({
          id: config.id,
          success: true,
          message: data.message || `Operational! Model responded in ${data.latencyMs || 0}ms.`,
          latencyMs: data.latencyMs,
        });
        fetchConfigs();
        fetchTelemetry();
      } else {
        let msg = data.error || data.message || `Failed to validate key with ${config.provider || "AI Provider"}.`;
        if (msg.includes("aborted") || msg.includes("AbortError")) {
          msg = "Connection timed out. The AI provider took too long to respond. Please try again.";
        }
        setTestFeedback({
          id: config.id,
          success: false,
          message: msg,
        });
      }
    } catch (err: any) {
      let msg = err?.message || "Network test failed.";
      if (msg.includes("aborted") || msg.includes("AbortError")) {
        msg = "Connection timed out. The AI provider took too long to respond. Please try again.";
      }
      setTestFeedback({
        id: config.id,
        success: false,
        message: msg
      });
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleResetStatus = async (config: AIApiConfig) => {
    setResettingKeyId(config.id);
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/ai-configs/${config.id}/reset`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        await fetchConfigs();
        await fetchTelemetry();
        setTestFeedback({
          id: config.id,
          success: true,
          message: `Status restored to Available. Cooldown cleared.`,
        });
      } else {
        const err = await res.json();
        alert(err.error || "Failed to reset status");
      }
    } catch (e: any) {
      alert(e.message || "Failed to reset status");
    } finally {
      setResettingKeyId(null);
    }
  };

  const handleToggleEnable = async (config: AIApiConfig) => {
    if (config.id === "system-gemini") {
      alert("The default system environment key is always enabled as fallback.");
      return;
    }
    setTogglingKeyId(config.id);
    const newStatus = !config.enabled;
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/ai-configs/${config.id}/toggle`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ enabled: newStatus })
      });
      if (res.ok) {
        setConfigs(prev => prev.map(c => c.id === config.id ? { ...c, enabled: newStatus, status: newStatus ? "available" : "disabled" } : c));
        fetchTelemetry();
        guardedSetDoc(doc(db, "ai_api_configs", config.id), { enabled: newStatus }, { merge: true }, "Admin", "Toggle AI API Config").catch(() => {});
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update configuration status");
      }
    } catch (e: any) {
      alert(e.message || "Failed to update status");
    } finally {
      setTogglingKeyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === "system-gemini") {
      setToastMessage({ type: "error", text: "The default system environment key cannot be deleted." });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    setDeletingKeyId(id);
    setConfirmDeleteId(null);
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/ai-configs/${id}`, {
        method: "DELETE",
        headers
      });
      if (res.ok) {
        setConfigs(prev => prev.filter(c => c.id !== id));
        fetchTelemetry();
        guardedDeleteDoc(doc(db, "ai_api_configs", id), "Admin", "Delete AI API Config").catch(() => {});
        setToastMessage({ type: "success", text: "API key removed from rotation pool successfully." });
      } else {
        const err = await res.json().catch(() => ({}));
        setToastMessage({ type: "error", text: err.error || "Failed to delete config." });
      }
    } catch (e: any) {
      setToastMessage({ type: "error", text: e?.message || "Failed to delete config." });
    } finally {
      setDeletingKeyId(null);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const movePriority = async (index: number, direction: "up" | "down") => {
    if (reordering) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= configs.length) return;

    setReordering(true);
    const newOrder = [...configs];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    // Reassign numeric priorities 1..N
    const priorities: Record<string, number> = {};
    const updatedConfigs = newOrder.map((cfg, idx) => {
      const prio = idx + 1;
      priorities[cfg.id] = prio;
      return { ...cfg, priority: prio };
    });

    setConfigs(updatedConfigs);

    try {
      const headers = await getAdminHeaders();
      await fetch("/api/admin/ai-configs/reorder", {
        method: "POST",
        headers,
        body: JSON.stringify({ priorities })
      });
      fetchTelemetry();
    } catch (err) {
      console.warn("Priority sync failed:", err);
    } finally {
      setReordering(false);
    }
  };

  const getStatusBadge = (status?: AIKeyHealthStatus, remainingSec?: number) => {
    const norm = String(status || "available").toLowerCase();
    switch (norm) {
      case "available":
      case "active":
        return {
          label: "Available • Ready",
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          dotColor: "bg-emerald-500",
        };
      case "rate_limited":
        return {
          label: remainingSec && remainingSec > 0 
            ? `Rate Limited (429) • Cooldown ${remainingSec}s` 
            : "Rate Limited (429)",
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse",
          dotColor: "bg-amber-500",
        };
      case "quota_exhausted":
      case "exhausted":
        return {
          label: "Quota Exhausted",
          className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
          dotColor: "bg-rose-500",
        };
      case "temporarily_unavailable":
        return {
          label: "Temporary Outage / 5xx",
          className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
          dotColor: "bg-orange-500",
        };
      case "auth_failed":
      case "invalid":
        return {
          label: "Auth Failed • Invalid Key",
          className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
          dotColor: "bg-rose-500",
        };
      case "disabled":
      default:
        return {
          label: "Disabled",
          className: "bg-slate-500/10 text-slate-500 border-slate-500/20",
          dotColor: "bg-slate-400",
        };
    }
  };

  const sortedConfigs = [...configs].sort((a, b) => (a.priority || 99) - (b.priority || 99));

  const filteredConfigs = filterProvider === "all" 
    ? sortedConfigs 
    : sortedConfigs.filter(c => (c.provider || "gemini") === filterProvider);

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-3 duration-700">
      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-in fade-in ${
          toastMessage.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
            : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-[10px] underline opacity-75 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Refined Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Intelligence Infrastructure</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Rotation Pool</h1>
            <p className="text-sm text-slate-500 font-medium max-w-lg leading-relaxed">
              Automated failover and key rotation for Gemini, OpenAI, and Claude models.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={async () => {
                  await Promise.all([fetchConfigs(), fetchTelemetry()]);
                  setToastMessage({ type: "success", text: "AI Pool synchronized." });
                  setTimeout(() => setToastMessage(null), 3000);
                }}
                disabled={loading}
                className="h-9 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
                <span>Sync Node</span>
              </button>
              <button
                onClick={() => {
                  setEditingConfig(null);
                  setShowModal(true);
                }}
                className="h-9 px-4 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm shadow-indigo-100 flex items-center gap-2 transition-all active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Key</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:min-w-[260px]">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Keys</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{configs.length}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Healthy Nodes</p>
              <p className="text-2xl font-bold text-emerald-600 tabular-nums leading-none">
                {configs.filter(c => c.enabled && (c.status === "available" || !c.status)).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rotation Policy Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <Layers className="w-4.5 h-4.5 text-indigo-600" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-slate-900">Routing Policy</h4>
            <p className="text-[11px] text-slate-500 font-medium">
              {rotationPolicy === "priority_failover" ? "Priority-based sequential routing" : "Even distribution across pool"}
            </p>
          </div>
        </div>

        <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
          {[
            { id: "priority_failover", label: "Failover" },
            { id: "round_robin", label: "Round Robin" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleSetPolicy(tab.id as any)}
              className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                rotationPolicy === tab.id
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Keys in Pool", value: configs.length, icon: Key, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Healthy", value: configs.filter(c => c.enabled && (c.status === "available" || !c.status)).length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Cooldown", value: configs.filter(c => c.status === "rate_limited" || c.status === "temporarily_unavailable" || c.status === "quota_exhausted").length, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Pool Uptime", value: `${telemetry?.successRate ?? 100}%`, icon: Activity, color: "text-blue-600", bg: "bg-blue-50" },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</span>
              <div className={`w-7 h-7 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900 tabular-nums font-mono">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Diagnostics & Event Stream */}
      <div className="space-y-3">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[10px] font-medium text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>Database Instance: <span className="font-bold text-slate-700">eaidivceejkdqsshlraj</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span>Layer: <span className="font-bold text-slate-700">Multi-Cloud AI Gateway</span></span>
            </div>
          </div>

          <button
            onClick={() => setShowFailoverLog(!showFailoverLog)}
            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold uppercase tracking-wider transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            <span>{showFailoverLog ? "Hide Logic Logs" : "View Logic Logs"}</span>
          </button>
        </div>

        {showFailoverLog && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-900">Failover Event Stream</h4>
              <span className="text-[10px] font-mono text-slate-400">Live Telemetry</span>
            </div>

            {(!telemetry?.recentFailovers || telemetry.recentFailovers.length === 0) ? (
              <p className="py-6 text-center text-[11px] text-slate-400 italic">No recent failover events detected.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {telemetry.recentFailovers.map((evt: any) => (
                  <div key={evt.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] flex items-center justify-between gap-3 font-mono">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                        evt.eventType === "failover" ? "bg-amber-100 text-amber-700" :
                        evt.eventType === "cooldown_recovery" ? "bg-emerald-100 text-emerald-700" :
                        "bg-indigo-100 text-indigo-700"
                      }`}>
                        {evt.eventType}
                      </span>
                      <span className="text-slate-600 truncate">
                        {evt.fromKeyName?.split(' ')[0]} ➔ {evt.toKeyName?.split(' ')[0]}
                      </span>
                    </div>
                    <span className="text-slate-400 shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filter:
        </span>
        {[
          { id: "all", label: "All Nodes", count: configs.length },
          { id: "gemini", label: "Gemini", count: configs.filter(c => (c.provider || "gemini") === "gemini").length },
          { id: "openai", label: "OpenAI", count: configs.filter(c => c.provider === "openai").length },
          { id: "claude", label: "Claude", count: configs.filter(c => c.provider === "claude").length },
          { id: "groq", label: "Groq", count: configs.filter(c => c.provider === "groq").length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterProvider(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              filterProvider === tab.id
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 rounded-full text-[9px] ${
              filterProvider === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Shared Platform Key Announcement */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-200 dark:border-purple-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-600/20">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                Platform Shared API for Users
              </h4>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                Active & Shared
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              The primary key in this pool (#1 priority) powers all students in the user app. Students can also upload their own personal keys separately.
            </p>
          </div>
        </div>
      </div>

      {/* Configured API Keys List — Phase 3 Redesign */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
              Active Rotation Pool
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400 tabular-nums">
            {filteredConfigs.length} NODE{filteredConfigs.length !== 1 ? 'S' : ''}
          </span>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Synchronizing Nodes...</span>
          </div>
        ) : filteredConfigs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs text-slate-400">No active keys found in this segment.</p>
            <button 
              onClick={() => { setEditingConfig(null); setShowModal(true); }} 
              className="mt-2 text-xs font-bold text-slate-900 hover:underline"
            >
              Initialize First Key
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredConfigs.map((config, index) => {
              const isTesting = testingKeyId === config.id;
              const isToggling = togglingKeyId === config.id;
              const isResetting = resettingKeyId === config.id;
              const feedback = testFeedback?.id === config.id ? testFeedback : null;
              const isSystem = config.id === "system-gemini" || (config as any).isSystem;
              const provider = (config.provider as AIProvider) || "gemini";
              const provMeta = PROVIDER_METADATA[provider] || PROVIDER_METADATA.gemini;
              const ProviderIcon = provMeta.icon;
              const statusBadge = getStatusBadge(config.status, config.remainingCooldownSec);
              const priorityNum = config.priority || (index + 1);

              return (
                <div key={config.id} className="group flex flex-col p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      {/* Priority Selector (Mobile Friendly) */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0 pt-1">
                        <button
                          type="button"
                          disabled={index === 0 || reordering}
                          onClick={() => movePriority(index, "up")}
                          className="p-1 rounded-md text-slate-300 hover:text-slate-900 disabled:opacity-20 transition-colors"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] font-bold font-mono text-slate-900 tabular-nums">
                          {priorityNum.toString().padStart(2, '0')}
                        </span>
                        <button
                          type="button"
                          disabled={index === filteredConfigs.length - 1 || reordering}
                          onClick={() => movePriority(index, "down")}
                          className="p-1 rounded-md text-slate-300 hover:text-slate-900 disabled:opacity-20 transition-colors"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Icon & Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border border-slate-100 ${isSystem ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>
                            {isSystem ? <ShieldCheck className="w-3.5 h-3.5" /> : <ProviderIcon className="w-3.5 h-3.5" />}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {config.name}
                          </h4>
                          {priorityNum === 1 && config.enabled && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 ml-1">
                              <Globe className="w-3 h-3" />
                              <span className="hidden sm:inline">PLATFORM PRIMARY</span>
                            </div>
                          )}
                        </div>

                        {/* Metadata - Zero Pill Discipline */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 font-medium">
                          <span className="text-slate-900">{provMeta.name?.split(' ')[0]}</span>
                          <span className="text-slate-300">/</span>
                          <span className="font-mono text-[10px]">{config.model?.slice(0, 15)}</span>
                          <span className="text-slate-300">/</span>
                          <span className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotColor}`} />
                            {statusBadge.label?.split('•')[0]}
                          </span>
                        </div>

                        {/* Stats - Tabular Nums */}
                        <div className="mt-2 flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-300">Requests</span>
                            <span className="text-slate-600 tabular-nums">{config.requestsTotal || 0}</span>
                          </div>
                          {config.errorsTotal ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-300">Errors</span>
                              <span className="text-rose-500 tabular-nums">{config.errorsTotal}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex flex-wrap items-center gap-1 shrink-0 pt-1">
                      <button
                        onClick={() => handleTestConfig(config)}
                        disabled={isTesting}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Test Node"
                      >
                        <Activity className={`w-4 h-4 ${isTesting ? "animate-spin" : ""}`} />
                      </button>

                      <button
                        onClick={() => { setEditingConfig(config); setShowModal(true); }}
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit Node"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {!isSystem && (
                        <button
                          onClick={() => handleToggleEnable(config)}
                          disabled={isToggling}
                          className={`p-2 rounded-lg transition-colors ${
                            config.enabled
                              ? "text-emerald-600 hover:bg-emerald-50"
                              : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"
                          }`}
                          title={config.enabled ? "Disable Node" : "Enable Node"}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      )}

                      {!isSystem && (
                        confirmDeleteId === config.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(config.id)}
                              disabled={deletingKeyId === config.id}
                              className="px-2 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold"
                            >
                              {deletingKeyId === config.id ? "..." : "CONFIRM"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(config.id)}
                            className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remove Node"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {feedback && (
                    <div className={`mt-3 p-3 rounded-lg border text-[11px] font-medium flex items-center justify-between gap-3 ${
                      feedback.success 
                        ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                        : "bg-rose-50 border-rose-100 text-rose-800"
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {feedback.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        <span className="truncate">{feedback.message}</span>
                      </div>
                      <button onClick={() => setTestFeedback(null)} className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100">Dismiss</button>
                    </div>
                  )}

                  {(config.status === "rate_limited" || config.status === "temporarily_unavailable" || config.status === "quota_exhausted" || config.consecutiveErrors) && !feedback && (
                    <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>NODE DEGRADED</span>
                      </div>
                      <button
                        onClick={() => handleResetStatus(config)}
                        disabled={isResetting}
                        className="px-3 py-1.5 bg-white border border-amber-200 text-amber-800 rounded-md text-[10px] font-bold uppercase tracking-tight shadow-sm hover:bg-amber-50 transition-colors"
                      >
                        {isResetting ? "Reinitializing..." : "Force Reset Node"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Key Modal */}
      {showModal && (
        <ApiSettingsModal 
          initialConfig={editingConfig}
          onClose={() => {
            setShowModal(false);
            setEditingConfig(null);
          }} 
          onSaved={() => {
            fetchConfigs();
            fetchTelemetry();
            setShowModal(false);
            setEditingConfig(null);
          }} 
        />
      )}
    </div>
  );
};

export default AIApiManagementSection;
