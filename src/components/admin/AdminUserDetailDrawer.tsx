import * as React from "react";
import {
  X,
  User,
  MapPin,
  Smartphone,
  Globe,
  BookOpen,
  Clock,
  CheckCircle2,
  Activity,
  Loader2,
  Award,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

export interface SelectedActivityUser {
  user_id: string;
  user_email: string;
  user_name: string;
  district: string | null;
  platform: string;
  total_attempts: number;
  avg_score: number | null;
  last_active: string | null;
  total_sessions: number;
}

interface QuizAttemptItem {
  id: string;
  topic_name: string | null;
  subject: string | null;
  total_q: number;
  correct_q: number;
  wrong_q: number;
  score_pct: number;
  duration_sec: number;
  platform: string;
  created_at: string;
}

interface ActivityEventItem {
  id: string;
  event_name: string;
  properties: Record<string, any>;
  platform: string;
  created_at: string;
}

interface SubjectStatItem {
  subject: string;
  attempts: number;
  avg_score: number;
}

interface AdminUserDetailDrawerProps {
  user: SelectedActivityUser | null;
  onClose: () => void;
}

export const AdminUserDetailDrawer: React.FC<AdminUserDetailDrawerProps> = ({
  user,
  onClose,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [attempts, setAttempts] = React.useState<QuizAttemptItem[]>([]);
  const [events, setEvents] = React.useState<ActivityEventItem[]>([]);
  const [subjects, setSubjects] = React.useState<SubjectStatItem[]>([]);
  const [activeTab, setActiveTab] = React.useState<"attempts" | "timeline">("attempts");

  React.useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;

    let cancelled = false;
    setLoading(true);

    supabase
      .rpc("get_user_detail_activity", { p_user_id: user.user_id })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setAttempts((data as any).attempts || []);
          setEvents((data as any).events || []);
          setSubjects((data as any).subjects || []);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-[#1B1536] h-full shadow-2xl border-l border-slate-200 dark:border-[#31275E] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#31275E] flex items-center justify-between bg-[#F8F6FF] dark:bg-[#130E26]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {user.user_name}
              </h4>
              <p className="text-[11px] text-slate-500 truncate">{user.user_email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-[#241D48] text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick Meta Badges */}
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#241D48] text-slate-700 dark:text-slate-200">
              <MapPin className="w-3 h-3 text-[#7045D8]" />
              {user.district || "District N/A"}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA]">
              {user.platform === "android" ? (
                <Smartphone className="w-3 h-3" />
              ) : (
                <Globe className="w-3 h-3" />
              )}
              {user.platform}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Award className="w-3 h-3" />
              Avg Score: {user.avg_score !== null ? `${user.avg_score}%` : "—"}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <BookOpen className="w-3 h-3" />
              {user.total_attempts} Quizzes
            </span>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-[#7045D8]" />
              <span className="text-xs">Loading user history...</span>
            </div>
          ) : (
            <>
              {/* Subject Breakdown */}
              {subjects.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Subject-Wise Accuracy
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    {subjects.map((s) => (
                      <div
                        key={s.subject}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E]"
                      >
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {s.subject}
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[11px]">
                          <span className="text-slate-500">{s.attempts} tests</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {s.avg_score}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabs: Quiz Attempts vs Activity Timeline */}
              <div className="flex gap-2 border-b border-slate-200 dark:border-[#31275E] pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("attempts")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    activeTab === "attempts"
                      ? "bg-[#7045D8] text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48]"
                  }`}
                >
                  Quiz Attempts ({attempts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("timeline")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    activeTab === "timeline"
                      ? "bg-[#7045D8] text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48]"
                  }`}
                >
                  Activity Timeline ({events.length})
                </button>
              </div>

              {activeTab === "attempts" ? (
                attempts.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    Koi quiz attempt record nahi mila.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {attempts.map((a) => (
                      <div
                        key={a.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {a.topic_name || "Practice Session"}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>
                              {a.correct_q}/{a.total_q} correct
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(a.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm font-black text-[#7045D8] dark:text-[#A78BFA] shrink-0">
                          {a.score_pct}%
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : events.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Koi activity event record nahi mila.
                </p>
              ) : (
                <div className="space-y-2">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] flex items-start gap-2.5"
                    >
                      <Activity className="w-3.5 h-3.5 text-[#7045D8] mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {ev.event_name}
                          </span>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {formatTime(ev.created_at)}
                          </span>
                        </div>
                        {ev.properties && Object.keys(ev.properties).length > 0 && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                            {JSON.stringify(ev.properties)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
