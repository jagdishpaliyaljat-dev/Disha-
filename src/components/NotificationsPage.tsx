import React, { useState, useMemo } from "react";
import { AppNotification, ActiveTab, MCQSession } from "../types";
import {
  Bell,
  CheckCheck,
  Trash2,
  BookOpen,
  Brain,
  Award,
  Sparkles,
  ArrowLeft,
  Settings,
  CheckCircle2,
  Clock,
  ChevronRight,
  BellRing,
  Volume2,
  Calendar,
  X,
  PlusCircle,
  Smartphone,
  ExternalLink
} from "lucide-react";
import {
  NotificationSettings,
  loadNotificationSettings,
  saveNotificationSettings
} from "../utils/notificationsStorage";
import {
  getNotificationPermission,
  requestNotificationPermission,
  triggerLocalNotification
} from "../utils/webPushService";

interface NotificationsPageProps {
  notifications: AppNotification[];
  onUpdateNotifications: (notifications: AppNotification[]) => void;
  onBack: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onStartSession?: (session: MCQSession) => void;
  onOpenFullExam?: () => void;
}

type FilterCategory = "all" | "unread" | "study" | "exam";

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  notifications,
  onUpdateNotifications,
  onBack,
  onNavigateTab,
  onStartSession,
  onOpenFullExam,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(() => loadNotificationSettings());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<string>(() => getNotificationPermission());
  const [isTestingPush, setIsTestingPush] = useState(false);

  const handleEnablePush = async () => {
    const res = await requestNotificationPermission();
    setPushPermission(res);
    if (res === "granted") {
      showToast("Push notifications enabled!");
    } else if (res === "denied") {
      showToast("Notifications blocked in browser settings.");
    }
  };

  const handleTestPush = async () => {
    setIsTestingPush(true);
    const ok = await triggerLocalNotification({
      title: "DISHA 20-20 — टेस्ट अलर्ट",
      body: "बैकग्राउंड पुश नोटिफिकेशन सेवा सक्रिय है!",
      url: "/",
      tag: "test-push",
    });
    setIsTestingPush(false);
    if (ok) {
      showToast("Test notification sent!");
    } else {
      showToast("Please grant notification permission first.");
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (activeFilter === "unread") return !notif.read;
      if (activeFilter === "study") return notif.category === "study";
      if (activeFilter === "exam") return notif.category === "exam";
      return true;
    });
  }, [notifications, activeFilter]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Mark single notification as read
  const handleMarkAsRead = (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (target && !target.read) {
      const updated = notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      onUpdateNotifications(updated);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = () => {
    if (unreadCount === 0) return;
    const updated = notifications.map((n) => ({ ...n, read: true }));
    onUpdateNotifications(updated);
    showToast("All marked as read");
  };

  // Delete notification
  const handleDeleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.filter((n) => n.id !== id);
    onUpdateNotifications(updated);
    showToast("Notification removed");
  };

  // Clear all notifications
  const handleClearAll = () => {
    if (notifications.length === 0) return;
    if (window.confirm("Are you sure you want to clear all notifications?")) {
      onUpdateNotifications([]);
      showToast("All notifications cleared");
    }
  };

  // Clean notification trigger for test alert
  const handleAddSampleNotification = () => {
    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      title: "Study Reminder",
      message: "Daily practice keeps your concepts fresh and revision on track.",
      category: "study" as const,
      timestamp: new Date().toISOString(),
      read: false,
      priority: "normal",
    };

    onUpdateNotifications([newNotif, ...notifications]);
    showToast("Notification added");
  };

  // Save settings
  const handleToggleSetting = (key: keyof NotificationSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    saveNotificationSettings(next);
  };

  const handleTimeChange = (time: string) => {
    const next = { ...settings, reminderTime: time };
    setSettings(next);
    saveNotificationSettings(next);
  };

  // Perform notification action
  const handleAction = (notif: AppNotification) => {
    handleMarkAsRead(notif.id);

    if (notif.actionType === "open_tab" && notif.actionData?.tab) {
      onNavigateTab(notif.actionData.tab);
      return;
    }

    if (notif.actionType === "open_full_exam") {
      onOpenFullExam?.();
      return;
    }

    if (notif.actionType === "open_session" && onStartSession) {
      const source = notif.actionData?.source || "due-today";
      onStartSession({
        title: notif.actionData?.sessionTitle || "Practice Session",
        source: source,
        questionIds: [],
      });
      return;
    }
  };

  // Format relative time with friendly mobile brevity
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } catch {
      return "Recent";
    }
  };

  // Meta badge and color configuration
  const getCategoryMeta = (category: AppNotification["category"]) => {
    switch (category) {
      case "study":
        return {
          icon: Brain,
          bg: "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200/70 dark:border-blue-800/80",
          tag: "Study",
        };
      case "exam":
        return {
          icon: BookOpen,
          bg: "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200/70 dark:border-amber-800/80",
          tag: "Exam",
        };
      case "achievement":
        return {
          icon: Award,
          bg: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200/70 dark:border-emerald-800/80",
          tag: "Milestone",
        };
      case "system":
      default:
        return {
          icon: Sparkles,
          bg: "bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border-purple-200/70 dark:border-purple-800/80",
          tag: "System",
        };
    }
  };

  return (
    <div
      id="notifications-page"
      className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors selection:bg-blue-500/20"
    >
      {/* Toast Notification Popup */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md border border-slate-700/80 animate-in fade-in slide-in-from-top-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 truncate">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 text-slate-400 hover:text-white"
            aria-label="Dismiss toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MOBILE-OPTIMIZED TOP APP BAR */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800 px-3.5 sm:px-5 py-2.5 sm:py-3 transition-colors">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          {/* Back button with 44px touch target */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onBack}
              id="notif-back-btn"
              aria-label="Back to previous screen"
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/90 active:bg-slate-200 dark:active:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-transform active:scale-95 shrink-0"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>

            <div className="truncate">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                  Notifications
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-blue-600 text-white leading-tight shadow-sm shrink-0">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Exam alerts, mock reminders & updates
              </p>
            </div>
          </div>

          {/* Action buttons with minimum 44px touch targets */}
          <div className="flex items-center gap-1 shrink-0">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                id="notif-mark-all-read-btn"
                title="Mark all as read"
                aria-label="Mark all as read"
                className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-2xl text-slate-600 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800 flex items-center justify-center transition-colors relative"
              >
                <CheckCheck className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={() => setShowSettingsModal(true)}
              id="notif-settings-btn"
              title="Notification Settings"
              aria-label="Open notification settings"
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-2xl text-slate-600 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800 flex items-center justify-center transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOUCH-FRIENDLY HORIZONTAL FILTER PILLS */}
        <div className="max-w-2xl mx-auto mt-2.5">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveFilter("all")}
              id="notif-filter-all"
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                activeFilter === "all"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 ring-2 ring-blue-600/30"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-700"
              }`}
            >
              <span>All</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/10 dark:bg-white/10 font-extrabold">
                {notifications.length}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter("unread")}
              id="notif-filter-unread"
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                activeFilter === "unread"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 ring-2 ring-blue-600/30"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-700"
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 ? (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              ) : null}
            </button>

            <button
              onClick={() => setActiveFilter("study")}
              id="notif-filter-study"
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                activeFilter === "study"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 ring-2 ring-blue-600/30"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-700"
              }`}
            >
              <Brain className="w-3.5 h-3.5 shrink-0" />
              <span>Study</span>
            </button>

            <button
              onClick={() => setActiveFilter("exam")}
              id="notif-filter-exam"
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                activeFilter === "exam"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 ring-2 ring-blue-600/30"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-700"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Exam</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN FEED: Generous padding for mobile bottom bar */}
      <main className="flex-1 px-3.5 sm:px-4 py-3 max-w-2xl mx-auto w-full space-y-3 pb-28 sm:pb-24">
        {/* MOBILE UTILITY BAR */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-1">
          <span className="font-semibold text-[11px]">
            {filteredNotifications.length} {filteredNotifications.length === 1 ? "notification" : "notifications"}
          </span>
          <div className="flex items-center gap-3">
            {notifications.length > 0 && (
              <>
                <button
                  onClick={handleClearAll}
                  id="notif-clear-all-btn"
                  className="text-rose-500 dark:text-rose-400 font-bold text-xs active:underline"
                >
                  Clear All
                </button>
              </>
            )}
          </div>
        </div>

        {/* NOTIFICATIONS LIST */}
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-14 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm mt-2">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3.5 border border-blue-200/50 dark:border-blue-900/50">
              <Bell className="w-8 h-8 stroke-[1.8]" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              No Notifications
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1.5 leading-relaxed">
              {activeFilter === "unread"
                ? "You have caught up with all notifications! You will be alerted when new updates arrive."
                : "No active notifications currently."}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              {activeFilter !== "all" && (
                <button
                  onClick={() => setActiveFilter("all")}
                  className="min-h-[40px] px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
                >
                  View All
                </button>
              )}

            </div>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const meta = getCategoryMeta(item.category);
            const Icon = meta.icon;

            return (
              <div
                key={item.id}
                id={`notification-card-${item.id}`}
                onClick={() => handleMarkAsRead(item.id)}
                className={`relative rounded-2xl p-3.5 sm:p-4 transition-all border select-none ${
                  !item.read
                    ? "bg-white dark:bg-slate-900 border-blue-200/90 dark:border-blue-900/70 shadow-[0_4px_16px_-4px_rgba(37,99,235,0.08)] ring-1 ring-blue-500/10"
                    : "bg-white/85 dark:bg-slate-900/75 border-slate-200/60 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900"
                }`}
              >
                {/* Mobile Unread Indicator */}
                {!item.read && (
                  <span className="absolute top-3.5 right-3.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-950/80" />
                )}

                <div className="flex items-start gap-3">
                  {/* Category icon */}
                  <div
                    className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${meta.bg}`}
                  >
                    <Icon className="w-5 h-5 stroke-[2]" />
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 pr-2">
                    {/* Category tag & relative timestamp */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {meta.tag}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" />
                        {formatTime(item.timestamp)}
                      </span>
                    </div>

                    {/* Notification Title */}
                    <h4
                      className={`text-sm leading-snug break-words ${
                        !item.read
                          ? "text-slate-900 dark:text-white font-bold"
                          : "text-slate-800 dark:text-slate-200 font-semibold"
                      }`}
                    >
                      {item.title || item.hindiTitle}
                    </h4>

                    {/* Message Body */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed break-words">
                      {item.message || item.hindiMessage}
                    </p>

                    {/* MOBILE-FIRST ACTION BUTTON */}
                    {item.actionType && item.actionType !== "none" && (
                      <div className="mt-3 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(item);
                          }}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm shadow-blue-500/20 active:scale-[0.98] transition-all"
                        >
                          <span>
                            {item.actionType === "open_session"
                              ? "Start Practice"
                              : item.actionType === "open_full_exam"
                              ? "Take Mock Test"
                              : "Open Topics"}
                          </span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 44px Touch Target Delete Button */}
                  <button
                    onClick={(e) => handleDeleteNotification(item.id, e)}
                    title="Delete Notification"
                    aria-label="Delete Notification"
                    className="min-w-[40px] min-h-[40px] w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 active:bg-rose-50 dark:active:bg-rose-950/40 active:text-rose-600 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* MOBILE-FIRST BOTTOM SHEET FOR SETTINGS */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200 dark:border-slate-800 w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5 pb-8 sm:pb-5 shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95"
          >
            {/* Mobile Sheet Drag Indicator Pill */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Notification Settings
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Preferences & Reminder Schedule
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="min-w-[40px] min-h-[40px] w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center"
                aria-label="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Daily Study Reminders with 44px min row */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 cursor-pointer active:bg-slate-100 dark:active:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100/70 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      Daily Study Reminder
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Spaced repetition and daily goal alerts
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.studyReminders}
                  onChange={() => handleToggleSetting("studyReminders")}
                  className="w-5 h-5 accent-blue-600 rounded-md cursor-pointer shrink-0"
                />
              </label>

              {/* Time Picker Sub-row */}
              {settings.studyReminders && (
                <div className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/25 border border-blue-100 dark:border-blue-900/40">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Reminder Time:
                  </span>
                  <input
                    type="time"
                    value={settings.reminderTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-extrabold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Exam Updates */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 cursor-pointer active:bg-slate-100 dark:active:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-100/70 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      Exam & Syllabus Alerts
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Latest syllabus updates and question bank additions
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.examUpdates}
                  onChange={() => handleToggleSetting("examUpdates")}
                  className="w-5 h-5 accent-blue-600 rounded-md cursor-pointer shrink-0"
                />
              </label>

              {/* Sound Enabled */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 cursor-pointer active:bg-slate-100 dark:active:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      Sound Effects
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Play audio chime when alerts arrive
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={() => handleToggleSetting("soundEnabled")}
                  className="w-5 h-5 accent-blue-600 rounded-md cursor-pointer shrink-0"
                />
              </label>

              {/* Web Push Notifications (Service Worker / Device Alert) */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-100 dark:border-indigo-900/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 pr-2">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100/70 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        System Push Notifications
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          pushPermission === "granted"
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            : pushPermission === "denied"
                            ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                            : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                        }`}>
                          {pushPermission === "granted" ? "Active" : pushPermission === "denied" ? "Blocked" : "Disabled"}
                        </span>
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Receive exam alerts & mock test reminders when app is closed
                      </p>
                    </div>
                  </div>
                  {pushPermission !== "granted" ? (
                    <button
                      onClick={handleEnablePush}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shrink-0 transition-transform active:scale-95"
                    >
                      Enable
                    </button>
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  )}
                </div>

                {pushPermission === "granted" && (
                  <div className="mt-3 pt-2.5 border-t border-indigo-100 dark:border-indigo-900/40 flex justify-end">
                    <button
                      onClick={handleTestPush}
                      disabled={isTestingPush}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      {isTestingPush ? "Sending Test..." : "Send Test Notification"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Save Button for Mobile Thumb Reach */}
            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  showToast("Settings saved successfully");
                }}
                className="w-full min-h-[46px] py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-extrabold rounded-2xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.99] flex items-center justify-center"
              >
                Save & Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
