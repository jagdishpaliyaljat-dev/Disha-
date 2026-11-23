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
  Award,
  Target,
  Flame,
  Globe,
  Radio,
  ExternalLink
} from "lucide-react";
import { 
  sendBroadcastNotification, 
  fetchActiveBroadcasts, 
  deleteBroadcastNotification, 
  BroadcastNotification 
} from "../../utils/broadcastNotificationService";

interface PresetTemplate {
  name: string;
  hindiTitle: string;
  title: string;
  hindiMessage: string;
  message: string;
  category: "exam" | "test" | "update" | "streak" | "general";
  priority: "low" | "normal" | "high" | "urgent";
  targetExam: string;
  actionType: "none" | "open_link" | "open_tab" | "start_test";
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    name: "🔴 लाइव टेस्ट शुरू",
    hindiTitle: "🔴 राज्य स्तरीय लाइव टेस्ट शुरू हो चुका है!",
    title: "State-Wide Live Mock Test is Now Active!",
    hindiMessage: "RPSC / RSMSSB पैटर्न पर आधारित नया लाइव टेस्ट शुरू हो गया है। अपनी स्टेट मेरिट रैंक जानने के लिए अभी भाग लें।",
    message: "The new state-level live test is now live. Attempt now to view your real-time leaderboard ranking.",
    category: "test",
    priority: "high",
    targetExam: "all",
    actionType: "open_tab",
  },
  {
    name: "📝 नया PYQ पेपर",
    hindiTitle: "📚 नया ओरिजिनल PYQ पेपर बैंक में जुड़ा",
    title: "New Previous Year Question Paper Added",
    hindiMessage: "विगत परीक्षाओं के प्रामाणिक प्रश्न व विस्तृत व्याख्या अब ऐप में उपलब्ध हैं। अभी अभ्यास शुरू करें।",
    message: "New previous year exam questions with verified detailed explanations are now available.",
    category: "exam",
    priority: "normal",
    targetExam: "all",
    actionType: "open_tab",
  },
  {
    name: "📢 प्रवेश पत्र / परीक्षा सूचना",
    hindiTitle: "📢 आवश्यक परीक्षा सूचना व प्रवेश पत्र अलर्ट",
    title: "Official Exam Date & Admit Card Notice",
    hindiMessage: "आगामी भर्ती परीक्षा की आधिकारिक तिथि एवं महत्वपूर्ण दिशा-निर्देश जारी कर दिए गए हैं।",
    message: "Important exam date notification and guidelines have been announced.",
    category: "exam",
    priority: "urgent",
    targetExam: "all",
    actionType: "none",
  },
  {
    name: "🔥 दैनिक अभ्यास चुनौती",
    hindiTitle: "🔥 आज का दैनिक PYQ अभ्यास पूरा करें",
    title: "Maintain Your Daily Study Streak!",
    hindiMessage: "सफलता निरंतरता से मिलती है। आज के 20 महत्वपूर्ण प्रश्न हल करके अपनी दैनिक स्ट्रीक बनाए रखें।",
    message: "Solve today's 20 essential questions to keep your learning streak alive.",
    category: "streak",
    priority: "normal",
    targetExam: "all",
    actionType: "open_tab",
  },
];

export const AdminNotificationBroadcastSection: React.FC = () => {
  const [title, setTitle] = React.useState("");
  const [hindiTitle, setHindiTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [hindiMessage, setHindiMessage] = React.useState("");
  const [category, setCategory] = React.useState<BroadcastNotification["category"]>("exam");
  const [priority, setPriority] = React.useState<BroadcastNotification["priority"]>("normal");
  const [targetExam, setTargetExam] = React.useState("all");
  const [actionType, setActionType] = React.useState<BroadcastNotification["actionType"]>("none");
  const [actionUrl, setActionUrl] = React.useState("");

  const [isSending, setIsSending] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [broadcasts, setBroadcasts] = React.useState<BroadcastNotification[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  const loadBroadcasts = React.useCallback(async () => {
    setLoadingHistory(true);
    try {
      const list = await fetchActiveBroadcasts();
      setBroadcasts(list);
    } catch (err) {
      console.warn("Failed to load broadcasts:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  React.useEffect(() => {
    loadBroadcasts();
  }, [loadBroadcasts]);

  const applyTemplate = (preset: PresetTemplate) => {
    setHindiTitle(preset.hindiTitle);
    setTitle(preset.title);
    setHindiMessage(preset.hindiMessage);
    setMessage(preset.message);
    setCategory(preset.category);
    setPriority(preset.priority);
    setTargetExam(preset.targetExam);
    setActionType(preset.actionType);
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hindiTitle.trim() && !title.trim()) {
      setErrorMsg("कृपया कम से कम शीर्षक (Title) अवश्य दर्ज करें।");
      return;
    }
    if (!hindiMessage.trim() && !message.trim()) {
      setErrorMsg("कृपया संदेश (Message Body) दर्ज करें।");
      return;
    }

    setIsSending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await sendBroadcastNotification({
        title: title.trim() || hindiTitle.trim(),
        hindiTitle: hindiTitle.trim() || title.trim(),
        message: message.trim() || hindiMessage.trim(),
        hindiMessage: hindiMessage.trim() || message.trim(),
        category,
        priority,
        targetExam,
        actionType,
        actionUrl: actionType === "open_link" && actionUrl ? actionUrl.trim() : undefined,
        sentBy: "Disha Admin",
      });

      if (result.success) {
        setSuccessMsg("सूचना सफलतापूर्वक Supabase क्लाउड पर ब्रॉडकास्ट हो गई! सभी छात्र उपकरणों पर यह तुरंत लाइव दिखाई देगी।");
        setTitle("");
        setHindiTitle("");
        setMessage("");
        setHindiMessage("");
        setActionUrl("");
        await loadBroadcasts();
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(result.error || "ब्रॉडकास्ट भेजने में समस्या आई।");
      }
    } catch (err: any) {
      console.error("Broadcast failed:", err);
      setErrorMsg(err?.message || "ब्रॉडकास्ट असफल रहा।");
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("क्या आप वाकई इस ब्रॉडकास्ट नोटिफिकेशन को हटाना चाहते हैं?")) return;
    await deleteBroadcastNotification(id);
    await loadBroadcasts();
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-br from-white via-[#FFF9EF] to-white dark:from-[#171923] dark:via-[#1F2330] dark:to-[#171923] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] p-5 sm:p-7 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#C99A45]/15 to-transparent rounded-bl-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] text-[10px] font-black uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse text-rose-500" />
              <span>Real-Time Cloud Push Broadcast</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              पुश नोटिफिकेशन एवं <span className="text-[#800020] dark:text-[#F47B20]">घोषणा केंद्र</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium max-w-xl">
              यहाँ से भेजा गया संदेश सीधे सभी अभ्यर्थियों के फोन पर रियल-टाइम में पहुंचेगा और अनरीड नोटिफिकेशन डॉट के साथ दिखाई देगा।
            </p>
          </div>

          <button
            onClick={loadBroadcasts}
            disabled={loadingHistory}
            className="px-4 py-2 bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-slate-700 dark:text-slate-200 hover:bg-[#F7EFE2] rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto shadow-xs active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin text-[#800020]" : ""}`} />
            <span>रीफ्रेश इतिहास</span>
          </button>
        </div>
      </div>

      {/* 2. 1-Click Preset Templates Strip */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-[#C99A45]" />
          <span>त्वरित 1-क्लिक टेम्पलेट्स (Quick Presets)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {PRESET_TEMPLATES.map((tpl) => (
            <button
              key={tpl.name}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="p-3 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#F47B20] rounded-2xl text-left transition-all shadow-xs group cursor-pointer active:scale-95"
            >
              <div className="font-extrabold text-xs text-slate-900 dark:text-white group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                {tpl.name}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-1">
                {tpl.hindiTitle}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Form & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Form Column */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Megaphone className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
            <span>नया ब्रॉडकास्ट संदेश तैयार करें</span>
          </h2>

          <form onSubmit={handleBroadcast} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Hindi Title */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                हिंदी शीर्षक (Hindi Title) *
              </label>
              <input
                type="text"
                value={hindiTitle}
                onChange={(e) => setHindiTitle(e.target.value)}
                placeholder="उदा. 🔴 RAS Prelims महा-मॉक टेस्ट लाइव है"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#FFF9EF]/50 dark:bg-[#171923] text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#800020]"
                required
              />
            </div>

            {/* English Title */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                अंग्रेजी शीर्षक (English Title - Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. RAS Prelims Mega Mock Test is Live"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#171923] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#800020]"
              />
            </div>

            {/* Hindi Message Body */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                हिंदी संदेश (Hindi Message Body) *
              </label>
              <textarea
                value={hindiMessage}
                onChange={(e) => setHindiMessage(e.target.value)}
                placeholder="अभ्यर्थियों के लिए विस्तृत विवरण या निर्देश लिखें..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#FFF9EF]/50 dark:bg-[#171923] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#800020]"
                required
              />
            </div>

            {/* Targeting and Priority Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                  लक्षित वर्ग (Target Exam)
                </label>
                <select
                  value={targetExam}
                  onChange={(e) => setTargetExam(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#171923] text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="all">सभी अभ्यर्थी (All Exams)</option>
                  <option value="RAS">RAS / RTS</option>
                  <option value="CET">CET (12th / Graduation)</option>
                  <option value="1st_Grade">1st / 2nd Grade शिक्षक</option>
                  <option value="REET">REET (Level 1 & 2)</option>
                  <option value="Police">राजस्थान पुलिस (SI/Constable)</option>
                  <option value="Patwar">पटवार / ग्रामसेवक</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                  श्रेणी (Category)
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#171923] text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="exam">परीक्षा (Exam Update)</option>
                  <option value="test">लाइव टेस्ट (Live Test)</option>
                  <option value="update">ऐप अपडेट (App Update)</option>
                  <option value="streak">अभ्यास स्ट्रीक (Study Streak)</option>
                  <option value="general">सामान्य (General)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                  प्राथमिकता (Priority)
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#171923] text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="normal">सामान्य (Normal)</option>
                  <option value="high">उच्च (High Alert)</option>
                  <option value="urgent">अति आवश्यक (Urgent)</option>
                </select>
              </div>
            </div>

            {/* Action Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                  टैप एक्शन (On Tap Action)
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#171923] text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="none">कोई एक्शन नहीं (केवल सूचना)</option>
                  <option value="open_tab">होम / टेस्ट स्क्रीन खोलें</option>
                  <option value="open_link">बाहरी वेबसाइट / PDF लिंक खोलें</option>
                </select>
              </div>

              {actionType === "open_link" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    वेब URL (URL Link)
                  </label>
                  <input
                    type="url"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="https://rpsc.rajasthan.gov.in"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#171923] text-xs font-medium"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3 bg-gradient-to-r from-[#800020] to-[#5E0017] dark:from-[#F47B20] dark:to-[#E06A14] text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>क्लाउड पर भेजा जा रहा है...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>तुरंत सभी छात्रों को ब्रॉडकास्ट करें (Send to All Students)</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-[#C99A45]" />
              <span>छात्र मोबाइल स्क्रीन पूर्वावलोकन (Live Preview)</span>
            </h3>

            {/* Mobile Push Notification Mock Card */}
            <div className="rounded-2xl bg-[#FFF9EF] dark:bg-[#171923] p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-inner space-y-2.5">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#800020] dark:bg-[#F47B20]" />
                  <span>दिशा 20-20 PYQ ऐप</span>
                </span>
                <span className="text-slate-400">अभी (Just Now)</span>
              </div>

              <div className="space-y-1">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug">
                  {hindiTitle || title || "शीर्षक यहाँ दिखाई देगा"}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {hindiMessage || message || "आपका विस्तृत संदेश यहाँ प्रदर्शित होगा..."}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px]">
                <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                  लक्ष्य: {targetExam === "all" ? "सभी छात्र" : targetExam}
                </span>
                {actionType !== "none" && (
                  <span className="font-extrabold text-[#800020] dark:text-[#F47B20] flex items-center gap-1">
                    <span>खोलने के लिए टैप करें</span>
                    <ExternalLink className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Active Broadcasts History Table */}
      <div className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500" />
              <span>सक्रिय ब्रॉडकास्ट इतिहास (Active Broadcasts)</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">
              Supabase क्लाउड में सुरक्षित और छात्रों के फोन में डिलीवर किए गए संदेश
            </p>
          </div>
          <span className="text-xs font-mono font-black text-slate-500">
            {broadcasts.length} सक्रिय
          </span>
        </div>

        {loadingHistory ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 text-[#800020] animate-spin" />
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 font-bold">
            अभी तक कोई ब्रॉडकास्ट संदेश नहीं भेजा गया है।
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {broadcasts.map((b) => (
              <div key={b.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      b.priority === "urgent" 
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                        : b.priority === "high"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                    }`}>
                      {b.category} • {b.priority}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {new Date(b.createdAt).toLocaleString("hi-IN", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {b.hindiTitle || b.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-2xl">
                    {b.hindiMessage || b.message}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>डिलीवर हुआ</span>
                  </span>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                    title="हटाएं"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
