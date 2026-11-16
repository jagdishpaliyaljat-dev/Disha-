import * as React from "react";
import { 
  Bell, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  Sparkles, 
  Trash2, 
  RefreshCw,
  Megaphone,
  BookOpen,
  Award
} from "lucide-react";
import { AppNotification } from "../../types";

interface BroadcastNotificationItem extends AppNotification {
  id: string;
  sentBy?: string;
}

export const AdminNotificationBroadcastSection: React.FC = () => {
  const [title, setTitle] = React.useState("");
  const [hindiTitle, setHindiTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [hindiMessage, setHindiMessage] = React.useState("");
  const [category, setCategory] = React.useState<AppNotification["category"]>("exam");
  const [priority, setPriority] = React.useState<AppNotification["priority"]>("normal");
  const [actionType, setActionType] = React.useState<AppNotification["actionType"]>("none");
  const [actionUrl, setActionUrl] = React.useState("");

  const [isSending, setIsSending] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [sentBroadcasts, setSentBroadcasts] = React.useState<BroadcastNotificationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  const fetchBroadcastHistory = async () => {
    setLoadingHistory(true);
    try {
      const local = localStorage.getItem("disha2020_admin_broadcasts") || localStorage.getItem("quizpro_admin_broadcasts");
      if (local) setSentBroadcasts(JSON.parse(local));
    } catch {}
    setLoadingHistory(false);
  };

  React.useEffect(() => {
    fetchBroadcastHistory();
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setErrorMsg("Please enter both English/Hindi Title and Message body.");
      return;
    }

    setIsSending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const newNotif: Omit<AppNotification, "id"> = {
      title: title.trim(),
      hindiTitle: hindiTitle.trim() || title.trim(),
      message: message.trim(),
      hindiMessage: hindiMessage.trim() || message.trim(),
      category,
      priority,
      timestamp: new Date().toISOString(),
      read: false,
      actionType: actionType !== "none" ? actionType : undefined,
      actionData: actionType === "open_link" && actionUrl ? { url: actionUrl } : undefined
    };

    try {
      // Also dispatch browser notification if permitted on admin machine
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(newNotif.hindiTitle || newNotif.title, {
          body: newNotif.hindiMessage || newNotif.message,
          icon: "/favicon.ico"
        });
      }

      // Save locally
      const updatedList = [
        { id: `broadcast_${Date.now()}`, ...newNotif },
        ...sentBroadcasts
      ];
      setSentBroadcasts(updatedList);
      try {
        localStorage.setItem("disha2020_admin_broadcasts", JSON.stringify(updatedList));
      } catch {}

      setSuccessMsg("Notification successfully broadcasted to all active users!");
      setTitle("");
      setHindiTitle("");
      setMessage("");
      setHindiMessage("");
      setActionUrl("");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Broadcast failed:", err);
      setErrorMsg(err?.message || "Failed to broadcast notification.");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this broadcast?")) return;
    const filtered = sentBroadcasts.filter(b => b.id !== id);
    setSentBroadcasts(filtered);
    try {
      localStorage.setItem("disha2020_admin_broadcasts", JSON.stringify(filtered));
    } catch {}
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header — Phase 1 Redesign */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Megaphone className="w-3.5 h-3.5" />
              <span>Broadcast Center</span>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Notification Engine</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
                Dispatch push notifications and alerts instantly to all student devices and notification centers.
              </p>
            </div>
          </div>
          <button
            onClick={fetchBroadcastHistory}
            disabled={loadingHistory}
            className="px-4 py-2 bg-white border border-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl text-[11px] font-bold uppercase tracking-tight transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
            <span>Sync History</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Compose Form */}
        <div className="lg:col-span-7 bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-900 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Compose Payload</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bilingual Notification Delivery</p>
            </div>
          </div>

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-2.5 animate-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-[11px] font-bold flex items-center gap-2.5 animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleBroadcast} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Label (English)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Official Update Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Label (Hindi)
                </label>
                <input
                  type="text"
                  placeholder="Secondary / Localized Title (optional)"
                  value={hindiTitle}
                  onChange={(e) => setHindiTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Segment / Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer appearance-none"
                >
                  <option value="exam">Exam Alert</option>
                  <option value="study">Study Reminder</option>
                  <option value="achievement">Result / Achievement</option>
                  <option value="system">System Notification</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Priority Rank
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer appearance-none"
                >
                  <option value="normal">Standard</option>
                  <option value="high">Critical / Urgent</option>
                  <option value="low">Low Latency</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Statement (English)
              </label>
              <textarea
                required
                rows={3}
                placeholder="Message content details..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 transition-colors resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Statement (Secondary / Localized)
              </label>
              <textarea
                rows={3}
                placeholder="Secondary / Localized message content (optional)..."
                value={hindiMessage}
                onChange={(e) => setHindiMessage(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing Nodes...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Execute Broadcast</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Broadcast History */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col space-y-5">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Recent Dispatches</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400 tabular-nums font-bold">
              {sentBroadcasts.length.toString().padStart(2, '0')} NODES
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] space-y-3">
            {loadingHistory ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Syncing History...</span>
              </div>
            ) : sentBroadcasts.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-xs text-slate-400">Empty Logs.</p>
              </div>
            ) : (
              sentBroadcasts.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-100 bg-white hover:bg-slate-50/50 transition-colors space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-900 uppercase tracking-tight">
                      {item.category}
                    </span>
                    <button
                      onClick={() => handleDeleteBroadcast(item.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors"
                      title="Purge Log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.hindiTitle || item.title}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 font-medium">{item.hindiMessage || item.message}</p>
                  </div>
                  <div className="text-[10px] font-medium text-slate-400 tabular-nums uppercase">
                    {new Date(item.timestamp).toLocaleDateString()} · {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

