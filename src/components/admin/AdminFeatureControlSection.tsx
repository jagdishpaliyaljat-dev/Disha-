import React, { useState } from "react";
import {
  Sparkles,
  Swords,
  PlaySquare,
  Trophy,
  FileText,
  Compass,
  Newspaper,
  Scan,
  Download,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Power,
  ShieldCheck,
  Sliders,
  Radio,
  Edit2,
  Save,
  X
} from "lucide-react";
import {
  FeatureKey,
  AppFeatureItem,
  useAppFeatures,
  saveAppFeaturesToCloud,
  DEFAULT_APP_FEATURES,
} from "../../utils/featureControlService";
import { triggerHaptic } from "../../utils/audioFeedback";

interface AdminFeatureControlSectionProps {
  adminEmail?: string;
}

const CATEGORY_LABELS: Record<string, { title: string; subtitle: string; icon: any }> = {
  ai: {
    title: "AI एवं स्मार्ट टूल्स",
    subtitle: "Disha AI साथी, डाउट सॉल्वर व OMR स्कैनर",
    icon: Sparkles,
  },
  battle: {
    title: "लाइव मुकाबला एवं गेमिंग",
    subtitle: "1v1 रियल-टाइम लाइव क्विज़ बैटल रूम्स",
    icon: Swords,
  },
  exam: {
    title: "लाइव परीक्षाएं व रैंकिंग",
    subtitle: "शेड्यूल लाइव टेस्ट, टाइमर एवं ऑल-राजस्थान मेरिट",
    icon: Trophy,
  },
  study: {
    title: "कोचिंग स्टडी डेस्क व वीडियो",
    subtitle: "वीडियो लेक्चर्स, इन-ऐप पीडीएफ नोट्स और स्टडी सामग्री",
    icon: PlaySquare,
  },
  practice: {
    title: "अभ्यास व प्रश्न बैंक",
    subtitle: "गत वर्षों के प्रश्न पत्र (PYQ) व 20-20 कस्टम टेस्ट",
    icon: Compass,
  },
  general: {
    title: "सामान्य सुविधाएं व एक्सेस कंट्रोल",
    subtitle: "करंट अफेयर्स, PDF एक्सपोर्ट और अतिथि लॉगिन नियंत्रण",
    icon: Sliders,
  },
};

const FEATURE_ICONS: Record<FeatureKey, any> = {
  disha_ai: Sparkles,
  live_battle: Swords,
  video_classes: PlaySquare,
  live_tests: Trophy,
  pyq_vault: FileText,
  custom_test: Compass,
  news_articles: Newspaper,
  omr_scanner: Scan,
  pdf_export: Download,
  guest_mode: UserCheck,
};

export const AdminFeatureControlSection: React.FC<AdminFeatureControlSectionProps> = ({
  adminEmail = "admin",
}) => {
  const { features, toggle, refresh, isLoading } = useAppFeatures();
  const [updatingKey, setUpdatingKey] = useState<FeatureKey | null>(null);
  const [editingMsgKey, setEditingMsgKey] = useState<FeatureKey | null>(null);
  const [tempMsg, setTempMsg] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleToggle = async (key: FeatureKey, currentStatus: boolean) => {
    triggerHaptic("medium");
    setUpdatingKey(key);
    const newStatus = !currentStatus;
    const success = await toggle(key, newStatus, adminEmail);
    setUpdatingKey(null);

    if (success) {
      showToast(
        `${features[key]?.hindiName || key} को ${newStatus ? "सक्रिय (ON)" : "अस्थायी रूप से बंद (OFF)"} कर दिया गया है।`
      );
    } else {
      showToast("सेटिंग्स अपडेट करने में समस्या आई।", "error");
    }
  };

  const handleSaveMessage = async (key: FeatureKey) => {
    triggerHaptic("light");
    setUpdatingKey(key);
    const success = await toggle(key, features[key]?.enabled ?? true, adminEmail, tempMsg);
    setUpdatingKey(null);
    setEditingMsgKey(null);

    if (success) {
      showToast(`मेंटेनेंस संदेश अपडेट हो गया!`);
    } else {
      showToast("संदेश सेव नहीं हो सका।", "error");
    }
  };

  const handleEnableAll = async () => {
    if (!confirm("क्या आप यूज़र ऐप के सभी 10 फ़ीचर्स को एक साथ सक्रिय (ON) करना चाहते हैं?")) return;
    setIsBulkOperating(true);
    const updated = { ...features };
    (Object.keys(updated) as FeatureKey[]).forEach((k) => {
      updated[k] = { ...updated[k], enabled: true };
    });
    const res = await saveAppFeaturesToCloud(updated, adminEmail);
    setIsBulkOperating(false);
    if (res.success) {
      showToast("All features have been enabled successfully!");
    } else {
      showToast(res.error || "Update failed", "error");
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm("Are you sure you want to reset all feature settings to factory defaults?")) return;
    setIsBulkOperating(true);
    const res = await saveAppFeaturesToCloud(DEFAULT_APP_FEATURES, adminEmail);
    setIsBulkOperating(false);
    if (res.success) {
      showToast("Feature settings reset to defaults!");
    } else {
      showToast(res.error || "Reset failed", "error");
    }
  };

  // Group features by category
  const allList = Object.values(features) as AppFeatureItem[];
  const activeCount = allList.filter((f) => f.enabled).length;
  const totalCount = allList.length;

  const grouped = allList.reduce((acc, item) => {
    const cat = item.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, AppFeatureItem[]>);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Live Status */}
      <div className="bg-gradient-to-r from-slate-900 via-[#800020] to-slate-950 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-rose-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>Live Real-Time Control</span>
              </span>
              <span className="text-xs text-rose-200/80 font-medium">
                Supabase Cloud + Instant Sync
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-amber-400" />
              <span>User App Feature Control</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Instantly enable or disable any user-facing module (Disha AI, 1v1 Battle, Study Desk, Live Tests). Changes take effect in real time on student apps.
            </p>
          </div>

          {/* Active Count Metric */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 shrink-0 self-start md:self-auto">
            <div className="text-center">
              <div className="text-2xl font-black text-amber-300">
                {activeCount} / {totalCount}
              </div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-rose-200/90">
                Features Active
              </div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <button
              onClick={() => refresh()}
              disabled={isLoading}
              title="Refresh"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? "animate-spin text-amber-300" : ""}`} />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleEnableAll}
              disabled={isBulkOperating}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Enable All Features</span>
            </button>
            <button
              onClick={handleResetDefaults}
              disabled={isBulkOperating}
              className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-300 font-medium">
            Last Sync: <span className="font-bold text-amber-300">Real-Time Connected</span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all animate-in fade-in shadow-md ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800"
          }`}
        >
          {feedbackMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* 2. Categorized Feature Cards */}
      <div className="space-y-6">
        {Object.entries(CATEGORY_LABELS).map(([catKey, catMeta]) => {
          const items = grouped[catKey] || [];
          if (items.length === 0) return null;
          const CategoryIcon = catMeta.icon;

          return (
            <div
              key={catKey}
              className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4"
            >
              {/* Category Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#800020] dark:text-amber-400 flex items-center justify-center shrink-0">
                  <CategoryIcon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {catMeta.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {catMeta.subtitle}
                  </p>
                </div>
              </div>

              {/* Feature Items List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {items.map((item) => {
                  const Icon = FEATURE_ICONS[item.key] || Sliders;
                  const isUpdating = updatingKey === item.key;
                  const isEditingMsg = editingMsgKey === item.key;

                  return (
                    <div
                      key={item.key}
                      className={`p-4 rounded-2xl border transition-all ${
                        item.enabled
                          ? "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                          : "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Icon & Title */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              item.enabled
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            <Icon className="w-4.5 h-4.5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                {item.hindiName}
                              </h4>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  item.enabled
                                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                                    : "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300"
                                }`}
                              >
                                {item.enabled ? "Active (ON)" : "Disabled (OFF)"}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>

                            <div className="mt-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                              ID: {item.key}
                            </div>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div className="shrink-0 flex items-center pt-0.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.enabled}
                            disabled={isUpdating}
                            onClick={() => handleToggle(item.key, item.enabled)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2 ${
                              item.enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                            } ${isUpdating ? "opacity-50 cursor-wait" : ""}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                item.enabled ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Optional Custom Maintenance Note */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80">
                        {isEditingMsg ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={tempMsg}
                              onChange={(e) => setTempMsg(e.target.value)}
                              placeholder="e.g. This feature is temporarily under maintenance until 6:00 PM."
                              className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#800020]"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveMessage(item.key)}
                                className="px-2.5 py-1 rounded-lg bg-[#800020] text-white text-[10.5px] font-bold flex items-center gap-1 active:scale-95 cursor-pointer"
                              >
                                <Save className="w-3 h-3" />
                                <span>Save</span>
                              </button>
                              <button
                                onClick={() => setEditingMsgKey(null)}
                                className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10.5px] font-bold flex items-center gap-1 active:scale-95 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                                <span>Cancel</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                              {item.maintenanceMessage ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                  Note: {item.maintenanceMessage}
                                </span>
                              ) : (
                                <span className="italic text-slate-400">No active notice</span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setEditingMsgKey(item.key);
                                setTempMsg(item.maintenanceMessage || "");
                              }}
                              className="text-[10.5px] text-[#800020] dark:text-amber-400 font-bold hover:underline flex items-center gap-0.5 shrink-0 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>{item.maintenanceMessage ? "Edit Note" : "Add Note"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
