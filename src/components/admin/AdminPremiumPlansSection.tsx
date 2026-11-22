import React, { useState, useEffect } from "react";
import {
  Crown,
  Lock,
  Unlock,
  ShieldCheck,
  Save,
  RotateCcw,
  Sparkles,
  Trophy,
  HelpCircle,
  FileText,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  Download,
  Swords,
  Layers,
  Edit2,
  Plus,
  Trash2,
  Check,
  Eye,
  Loader2,
  CreditCard,
  QrCode,
  ClipboardList,
  XCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import {
  AdminPremiumPlan,
  PaywallRules,
  PaymentGatewayConfig,
  DEFAULT_PREMIUM_PLANS,
  DEFAULT_PAYWALL_RULES,
  DEFAULT_GATEWAY_CONFIG,
  fetchPremiumConfigFromCloud,
  savePremiumPlansToCloud,
  savePaywallRulesToCloud,
  fetchGatewayConfigForAdmin,
  savePaymentGatewayConfigToCloud,
  getLocalPremiumPlans,
  getLocalPaywallRules,
  getLocalPaymentGatewayConfig,
} from "../../services/payment/premiumConfigService";
import {
  StudentOrderRecord,
  fetchPendingOrders,
  approveStudentOrder,
  rejectStudentOrder,
} from "../../services/payment/upiPaymentService";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

interface AdminPremiumPlansSectionProps {
  adminEmail?: string;
  onOpenPreview?: () => void;
}

export const AdminPremiumPlansSection: React.FC<AdminPremiumPlansSectionProps> = ({
  adminEmail = "admin",
  onOpenPreview,
}) => {
  const [activeTab, setActiveTab] = useState<"paywall" | "plans" | "gateway" | "orders">("paywall");
  const [plans, setPlans] = useState<AdminPremiumPlan[]>(() => getLocalPremiumPlans());
  const [rules, setRules] = useState<PaywallRules>(() => getLocalPaywallRules());
  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayConfig>(() => getLocalPaymentGatewayConfig());
  const [pendingOrders, setPendingOrders] = useState<StudentOrderRecord[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [editingPlanIndex, setEditingPlanIndex] = useState<number | null>(null);
  const [newFeatureText, setNewFeatureText] = useState("");

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load from Supabase on mount
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetchPremiumConfigFromCloud()
      .then((res) => {
        if (mounted) {
          setPlans(res.plans);
          setRules(res.paywallRules);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Save Paywall Rules
  const handleSavePaywallRules = async () => {
    triggerHaptic("medium");
    playClickSound();
    setIsSaving(true);
    const res = await savePaywallRulesToCloud(rules, adminEmail);
    setIsSaving(false);
    if (res.success) {
      triggerHaptic("success");
      showToast("पेवॉल सेटिंग्स Supabase पर सफलतापूर्वक अपडेट हो गईं!", "success");
    } else {
      triggerHaptic("warning");
      showToast(`सेव करने में त्रुटि: ${res.error}`, "error");
    }
  };

  // Save Plans & Pricing
  const handleSavePlans = async () => {
    triggerHaptic("medium");
    playClickSound();
    setIsSaving(true);
    const res = await savePremiumPlansToCloud(plans, adminEmail);
    setIsSaving(false);
    if (res.success) {
      triggerHaptic("success");
      showToast("प्रीमियम प्लान्स और कीमतें Supabase पर अपडेट हो गईं!", "success");
    } else {
      triggerHaptic("warning");
      showToast(`सेव करने में त्रुटि: ${res.error}`, "error");
    }
  };

  // Load gateway config and pending orders
  const loadGatewayAndOrders = async () => {
    try {
      const gw = await fetchGatewayConfigForAdmin();
      setGatewayConfig(gw);
      setIsLoadingOrders(true);
      const ords = await fetchPendingOrders();
      setPendingOrders(ords);
    } catch (e) {
      console.warn("Orders/GW load note:", e);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (activeTab === "gateway" || activeTab === "orders") {
      loadGatewayAndOrders();
    }
  }, [activeTab]);

  // Save Gateway & UPI Settings
  const handleSaveGatewayConfig = async () => {
    triggerHaptic("medium");
    playClickSound();
    setIsSaving(true);
    const res = await savePaymentGatewayConfigToCloud(gatewayConfig, adminEmail);
    setIsSaving(false);
    if (res.success) {
      triggerHaptic("success");
      showToast("गेटवे व UPI सेटिंग्स Supabase पर सफलतापूर्वक अपडेट हो गईं!", "success");
    } else {
      triggerHaptic("warning");
      showToast(`सेव करने में त्रुटि: ${res.error}`, "error");
    }
  };

  // Approve student UPI payment
  const handleApproveOrder = async (order: StudentOrderRecord) => {
    triggerHaptic("medium");
    if (!window.confirm(`क्या आप ${order.user_name || order.user_email || "छात्र"} का VIP प्लान मंजूर करना चाहते हैं?`)) return;
    const res = await approveStudentOrder(order);
    if (res.success) {
      triggerHaptic("success");
      showToast("VIP पास सफलतापूर्वक सक्रिय कर दिया गया!", "success");
      setPendingOrders((prev) => prev.filter((o) => o.order_id !== order.order_id));
    } else {
      triggerHaptic("warning");
      showToast(`स्वीकृत करने में त्रुटि: ${res.error}`, "error");
    }
  };

  // Reject student payment
  const handleRejectOrder = async (orderId: string) => {
    triggerHaptic("warning");
    const reason = window.prompt("खारिज करने का कारण दर्ज करें (वैकल्पिक):", "अमान्य UTR या भुगतान नहीं मिला");
    if (reason === null) return;
    const res = await rejectStudentOrder(orderId, reason);
    if (res.success) {
      showToast("ऑर्डर खारिज कर दिया गया।", "error");
      setPendingOrders((prev) => prev.filter((o) => o.order_id !== orderId));
    }
  };

  // Reset to Factory Defaults
  const handleResetDefaults = async () => {
    if (!window.confirm("क्या आप वाकई सभी सेटिंग्स को फ़ैक्ट्री डिफ़ॉल्ट पर रीसेट करना चाहते हैं?")) {
      return;
    }
    triggerHaptic("warning");
    setIsSaving(true);
    await savePremiumPlansToCloud(DEFAULT_PREMIUM_PLANS, adminEmail);
    await savePaywallRulesToCloud(DEFAULT_PAYWALL_RULES, adminEmail);
    setPlans([...DEFAULT_PREMIUM_PLANS]);
    setRules({ ...DEFAULT_PAYWALL_RULES });
    setIsSaving(false);
    triggerHaptic("success");
    showToast("सभी सेटिंग्स डिफ़ॉल्ट पर रीसेट हो गईं!", "success");
  };

  // Plan attribute update
  const handleUpdatePlan = (index: number, updates: Partial<AdminPremiumPlan>) => {
    setPlans((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  // Add feature point to plan
  const handleAddFeatureToPlan = (planIndex: number) => {
    if (!newFeatureText.trim()) return;
    setPlans((prev) => {
      const next = [...prev];
      const target = next[planIndex];
      next[planIndex] = {
        ...target,
        features: [...target.features, newFeatureText.trim()],
      };
      return next;
    });
    setNewFeatureText("");
  };

  // Remove feature point from plan
  const handleRemoveFeatureFromPlan = (planIndex: number, featIndex: number) => {
    setPlans((prev) => {
      const next = [...prev];
      const target = next[planIndex];
      next[planIndex] = {
        ...target,
        features: target.features.filter((_, i) => i !== featIndex),
      };
      return next;
    });
  };

  return (
    <div className="space-y-6 select-none">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-black border transition-all animate-fadeIn ${
            toast.type === "success"
              ? "bg-emerald-950 border-emerald-500/50 text-emerald-300"
              : "bg-rose-950 border-rose-500/50 text-rose-300"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#171329] via-[#221C38] to-[#171329] border border-[#7045D8]/40 shadow-xl text-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/30 shrink-0">
            <Crown className="w-6 h-6 fill-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                VIP Plans & Paywall Manager
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#7045D8] text-white uppercase tracking-wider">
                Full Control
              </span>
            </div>
            <p className="text-xs text-[#A78BFA] mt-0.5">
              कंट्रोल करें कि कौनसी सुविधाएं मुफ़्त रहेंगी, कौनसी VIP पास में, और प्लान्स की कीमतें तुरंत अपडेट करें।
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={
              activeTab === "paywall"
                ? handleSavePaywallRules
                : activeTab === "plans"
                ? handleSavePlans
                : activeTab === "gateway"
                ? handleSaveGatewayConfig
                : loadGatewayAndOrders
            }
            disabled={isSaving || (activeTab === "orders" && isLoadingOrders)}
            className="px-4 py-2.5 rounded-xl bg-[#7045D8] hover:bg-[#5e34ca] text-white text-xs font-black shadow-lg shadow-[#7045D8]/30 flex items-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving || (activeTab === "orders" && isLoadingOrders) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : activeTab === "orders" ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {isSaving
                ? "सेव हो रहा है..."
                : activeTab === "orders"
                ? "रिफ्रेश करें"
                : "सेटिंग्स सेव करें"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isSaving}
            title="फ़ैक्ट्री डिफ़ॉल्ट पर रीसेट करें"
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">सक्रिय प्लान्स (Active Plans)</p>
          <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">
            {plans.filter((p) => p.enabled !== false).length} / {plans.length}
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">स्टार्टर: ₹{plans[0]?.amount || 49}</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">पेमेंट गेटवे स्थिति</p>
          <p className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {gatewayConfig.upi?.enabled ? "UPI QR सक्रिय" : "केवल PG"}
          </p>
          <span className="text-[10px] text-slate-500 font-bold">
            {gatewayConfig.cashfree?.enabled ? "Cashfree ON" : "Cashfree OFF"}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">लंबित सत्यापन (Pending UPI)</p>
          <p className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {pendingOrders.length} छात्र
          </p>
          <span className="text-[10px] text-slate-500 font-bold">UTR सत्यापन हेतु</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">सुरक्षित क्लाउड सिंक</p>
          <p className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            Supabase Live
          </p>
          <span className="text-[10px] text-slate-500 font-bold">0ms स्थानीय कैश</span>
        </div>
      </div>

      {/* 3. Sub-Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-fit">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            setActiveTab("paywall");
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "paywall"
              ? "bg-[#7045D8] text-white shadow-md shadow-[#7045D8]/30"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>1. पेवॉल नियम</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            setActiveTab("plans");
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "plans"
              ? "bg-[#7045D8] text-white shadow-md shadow-[#7045D8]/30"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>2. प्लान्स व कीमतें</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            setActiveTab("gateway");
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "gateway"
              ? "bg-[#7045D8] text-white shadow-md shadow-[#7045D8]/30"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-teal-400" />
          <span>3. गेटवे व UPI सेटिंग्स</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            setActiveTab("orders");
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "orders"
              ? "bg-[#7045D8] text-white shadow-md shadow-[#7045D8]/30"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
          <span>4. पेमेंट्स सत्यापन</span>
          {pendingOrders.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[10px] font-black">
              {pendingOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* 4. TAB 1: PAYWALL RULES CONFIGURATION */}
      {activeTab === "paywall" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
            💡 <strong>सुझाव:</strong> यहां आप जो भी नियम बदलेंगे, वे तुरंत सभी विद्यार्थियों के फोन और वेबसाइट पर लागू हो जाएंगे। किसी भी बदलाव के बाद ऊपर दिए गए <strong>"सेटिंग्स सेव करें"</strong> बटन पर क्लिक करना न भूलें।
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1: Disha AI Tutor */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      Disha AI Tutor (24x7 डाउट सॉल्वर)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      विद्यार्थी द्वारा AI से कठिन प्रश्नों का हल व व्याख्या पूछना
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  एक्सेस मोड (Access Mode):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "free", label: "सबके लिए मुफ़्त" },
                    { id: "limited_free", label: "दैनिक फ्री लिमिट" },
                    { id: "vip_only", label: "केवल VIP पास" },
                  ].map((modeOption) => (
                    <button
                      key={modeOption.id}
                      type="button"
                      onClick={() =>
                        setRules((prev) => ({
                          ...prev,
                          ai_tutor: {
                            ...prev.ai_tutor,
                            mode: modeOption.id as any,
                          },
                        }))
                      }
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                        rules.ai_tutor.mode === modeOption.id
                          ? "bg-[#7045D8] border-[#7045D8] text-white shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {modeOption.label}
                    </button>
                  ))}
                </div>

                {rules.ai_tutor.mode === "limited_free" && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      मुफ़्त यूज़र्स हेतु दैनिक प्रश्न सीमा (Questions / Day):
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={rules.ai_tutor.freeDailyLimit}
                      onChange={(e) =>
                        setRules((prev) => ({
                          ...prev,
                          ai_tutor: {
                            ...prev.ai_tutor,
                            freeDailyLimit: Math.max(1, parseInt(e.target.value) || 1),
                          },
                        }))
                      }
                      className="w-20 px-2 py-1 text-center font-black rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Rule 2: Live Mock Tests */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      RPSC व RSMSSB Mock Tests & Live Series
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      RAS, 2nd Grade, 3rd Grade, CET फुल टेस्ट पेपर्स
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  एक्सेस मोड (Access Mode):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "free", label: "सभी टेस्ट मुफ़्त" },
                    { id: "limited_free", label: "डेमो फ्री टेस्ट्स" },
                    { id: "vip_only", label: "केवल VIP पास" },
                  ].map((modeOption) => (
                    <button
                      key={modeOption.id}
                      type="button"
                      onClick={() =>
                        setRules((prev) => ({
                          ...prev,
                          mock_tests: {
                            ...prev.mock_tests,
                            mode: modeOption.id as any,
                          },
                        }))
                      }
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                        rules.mock_tests.mode === modeOption.id
                          ? "bg-[#7045D8] border-[#7045D8] text-white shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {modeOption.label}
                    </button>
                  ))}
                </div>

                {rules.mock_tests.mode === "limited_free" && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      मुफ़्त यूज़र्स हेतु उपलब्ध डेमो टेस्ट संख्या:
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={rules.mock_tests.freeDemoTestsCount}
                      onChange={(e) =>
                        setRules((prev) => ({
                          ...prev,
                          mock_tests: {
                            ...prev.mock_tests,
                            freeDemoTestsCount: Math.max(1, parseInt(e.target.value) || 1),
                          },
                        }))
                      }
                      className="w-20 px-2 py-1 text-center font-black rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Rule 3: State Merit Rank */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    All-Rajasthan Realtime Merit Rank
                  </h4>
                  <p className="text-[10.5px] text-slate-500">
                    हज़ारों छात्रों के बीच राज्यस्तरीय रैंक व परसेंटाइल प्रदर्शन
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRules((prev) => ({
                    ...prev,
                    state_merit_rank: {
                      ...prev.state_merit_rank,
                      isVipOnly: !prev.state_merit_rank.isVipOnly,
                    },
                  }))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  rules.state_merit_rank.isVipOnly
                    ? "bg-amber-500 text-black shadow-xs"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {rules.state_merit_rank.isVipOnly ? "केवल VIP 👑" : "मुफ़्त (Free)"}
              </button>
            </div>

            {/* Rule 4: Detailed Explanations */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    विस्तृत उत्तर व्याख्या व शॉर्ट ट्रिक्स
                  </h4>
                  <p className="text-[10.5px] text-slate-500">
                    प्रत्येक प्रश्न के नीचे प्रामाणिक व्याख्या व समाधान
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRules((prev) => ({
                    ...prev,
                    detailed_explanations: {
                      ...prev.detailed_explanations,
                      isVipOnly: !prev.detailed_explanations.isVipOnly,
                    },
                  }))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  rules.detailed_explanations.isVipOnly
                    ? "bg-amber-500 text-black shadow-xs"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {rules.detailed_explanations.isVipOnly ? "केवल VIP 👑" : "मुफ़्त (Free)"}
              </button>
            </div>

            {/* Rule 5: Mistake Bank */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    मिस्टेक बैंक (गलत प्रश्नों का ऑटो-रिवीज़न)
                  </h4>
                  <p className="text-[10.5px] text-slate-500">
                    गलत प्रश्नों को सेव कर दोबारा अभ्यास कराने का फ़ीचर
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRules((prev) => ({
                    ...prev,
                    mistake_bank: {
                      ...prev.mistake_bank,
                      isVipOnly: !prev.mistake_bank.isVipOnly,
                    },
                  }))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  rules.mistake_bank.isVipOnly
                    ? "bg-amber-500 text-black shadow-xs"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {rules.mistake_bank.isVipOnly ? "केवल VIP 👑" : "मुफ़्त (Free)"}
              </button>
            </div>

            {/* Rule 6: 1v1 Battle Mode */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Swords className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    1v1 लाइव क्विज़ मुकाबला (Battle Mode)
                  </h4>
                  <p className="text-[10.5px] text-slate-500">
                    छात्रों के बीच लाइव मल्टीप्लेयर क्विज़ रूम
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRules((prev) => ({
                    ...prev,
                    live_battle: {
                      ...prev.live_battle,
                      isVipOnly: !prev.live_battle.isVipOnly,
                    },
                  }))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  rules.live_battle.isVipOnly
                    ? "bg-amber-500 text-black shadow-xs"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {rules.live_battle.isVipOnly ? "केवल VIP 👑" : "मुफ़्त (Free)"}
              </button>
            </div>

            {/* Rule 7: PDF Export */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    PDF टेस्ट पेपर डाउनलोड व एक्सपोर्ट
                  </h4>
                  <p className="text-[10.5px] text-slate-500">
                    प्रिंट-योग्य ऑफ़लाइन पीडीएफ टेस्ट पेपर्स डाउनलोड
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRules((prev) => ({
                    ...prev,
                    pdf_export: {
                      ...prev.pdf_export,
                      isVipOnly: !prev.pdf_export.isVipOnly,
                    },
                  }))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  rules.pdf_export.isVipOnly
                    ? "bg-amber-500 text-black shadow-xs"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {rules.pdf_export.isVipOnly ? "केवल VIP 👑" : "मुफ़्त (Free)"}
              </button>
            </div>

            {/* Rule 8: 100% Ad-Free */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    100% विज्ञापन-मुक्त अनुभव
                  </h4>
                  <p className="text-[10.5px] text-slate-500">
                    प्रीमियम यूज़र्स हेतु पूर्णतः ध्यान-भंग मुक्त इंटरफ़ेस
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRules((prev) => ({
                    ...prev,
                    ad_free: {
                      ...prev.ad_free,
                      isVipOnly: !prev.ad_free.isVipOnly,
                    },
                  }))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  rules.ad_free.isVipOnly
                    ? "bg-amber-500 text-black shadow-xs"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {rules.ad_free.isVipOnly ? "केवल VIP 👑" : "मुफ़्त (Free)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2: PRICING & PLANS CONFIGURATION */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((plan, index) => {
              const isEditing = editingPlanIndex === index;

              return (
                <div
                  key={plan.id}
                  className={`p-5 rounded-3xl border transition-all ${
                    plan.enabled !== false
                      ? "bg-white dark:bg-[#1E2330] border-slate-200 dark:border-slate-800 shadow-md"
                      : "bg-slate-50 dark:bg-slate-900/60 border-dashed border-slate-300 dark:border-slate-700 opacity-70"
                  }`}
                >
                  {/* Top Status & Enable Switch */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Tier {index + 1} • {plan.id}
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={plan.enabled !== false}
                        onChange={(e) => handleUpdatePlan(index, { enabled: e.target.checked })}
                        className="rounded text-[#7045D8] focus:ring-[#7045D8]"
                      />
                      <span>{plan.enabled !== false ? "सक्रिय (Active)" : "निष्क्रिय (Hidden)"}</span>
                    </label>
                  </div>

                  {/* Plan Details Form */}
                  <div className="space-y-3 pt-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        प्लान का नाम (Plan Name):
                      </label>
                      <input
                        type="text"
                        value={plan.name}
                        onChange={(e) => handleUpdatePlan(index, { name: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">
                          बिक्री मूल्य (Selling ₹):
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={plan.amount}
                          onChange={(e) => handleUpdatePlan(index, { amount: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full px-3 py-1.5 rounded-xl text-xs font-black border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">
                          वास्तविक मूल्य (MRP ₹):
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={plan.originalAmount}
                          onChange={(e) => handleUpdatePlan(index, { originalAmount: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full px-3 py-1.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-400 line-through"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">
                          वैधता (Duration):
                        </label>
                        <input
                          type="text"
                          value={plan.duration}
                          onChange={(e) => handleUpdatePlan(index, { duration: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">
                          टैग (Badge Tag):
                        </label>
                        <input
                          type="text"
                          value={plan.tag || ""}
                          onChange={(e) => handleUpdatePlan(index, { tag: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300"
                          placeholder="e.g. 🔥 सबसे लोकप्रिय"
                        />
                      </div>
                    </div>

                    {/* Is Popular Switch */}
                    <div className="pt-1 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                      <span>सर्वाधिक लोकप्रिय हाइलाइट (Best Seller):</span>
                      <input
                        type="checkbox"
                        checked={Boolean(plan.isPopular)}
                        onChange={(e) => handleUpdatePlan(index, { isPopular: e.target.checked })}
                        className="rounded text-amber-500 focus:ring-amber-500"
                      />
                    </div>

                    {/* Features Points Editor */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-500">
                          विशेष लाभ (Features List):
                        </label>
                        <span className="text-[10px] text-slate-400">{plan.features.length} बिंदु</span>
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                        {plan.features.map((feat, featIdx) => (
                          <div
                            key={featIdx}
                            className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300"
                          >
                            <span className="truncate flex-1">{feat}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFeatureFromPlan(index, featIdx)}
                              className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add new feature inline */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingPlanIndex === index ? newFeatureText : ""}
                          onFocus={() => setEditingPlanIndex(index)}
                          onChange={(e) => setNewFeatureText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleAddFeatureToPlan(index);
                            }
                          }}
                          placeholder="+ नया फ़ीचर जोड़ें..."
                          className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddFeatureToPlan(index)}
                          className="px-2 py-1 bg-[#7045D8] hover:bg-[#5e34ca] text-white rounded-lg text-xs font-bold cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB 3: PAYMENT GATEWAY & UPI CONFIGURATION */}
      {activeTab === "gateway" && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 text-xs">
            ⚡ <strong>पेमेंट गेटवे नियंत्रण:</strong> यहां से आप <strong>Cashfree Gateway</strong> और <strong>डायरेक्ट UPI QR कोड</strong> को पूरी तरह नियंत्रित कर सकते हैं। आप जो भी जानकारी यहां सेव करेंगे, वह सीधे डेटाबेस में अपडेट होगी।
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Box A: Direct UPI & Dynamic QR Code */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#1E2330] border border-emerald-500/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      डायरेक्ट UPI व QR कोड भुगतान
                    </h3>
                    <p className="text-[11px] text-slate-500">PhonePe, GPay, Paytm, BHIM</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(gatewayConfig.upi?.enabled)}
                    onChange={(e) =>
                      setGatewayConfig((prev) => ({
                        ...prev,
                        upi: { ...prev.upi, enabled: e.target.checked },
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    आपकी UPI ID (जिस पर पैसे प्राप्त होंगे):
                  </label>
                  <input
                    type="text"
                    value={gatewayConfig.upi?.upiId || ""}
                    onChange={(e) =>
                      setGatewayConfig((prev) => ({
                        ...prev,
                        upi: { ...prev.upi, upiId: e.target.value.trim() },
                      }))
                    }
                    placeholder="e.g. jagdishpaliyaljat@okhdfcbank"
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    विद्यार्थी को इसी UPI ID का डायनामिक QR कोड व डायरेक्ट पे लिंक दिखाया जाता है।
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    प्राप्तकर्ता का नाम (Payee Name):
                  </label>
                  <input
                    type="text"
                    value={gatewayConfig.upi?.payeeName || ""}
                    onChange={(e) =>
                      setGatewayConfig((prev) => ({
                        ...prev,
                        upi: { ...prev.upi, payeeName: e.target.value },
                      }))
                    }
                    placeholder="Disha PYQ Online"
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Auto Approve Toggle */}
                <div className="pt-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      ऑटो-अनलॉक (Instant Auto-Approve)
                    </h4>
                    <p className="text-[10.5px] text-slate-500">
                      विद्यार्थी द्वारा UTR सबमिट करते ही VIP पास तुरंत सक्रिय हो जाएगा।
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(gatewayConfig.autoApprove)}
                    onChange={(e) =>
                      setGatewayConfig((prev) => ({
                        ...prev,
                        autoApprove: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Box B: Cashfree Payment Gateway */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#1E2330] border border-[#7045D8]/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      Cashfree Payment Gateway
                    </h3>
                    <p className="text-[11px] text-slate-500">Cards, NetBanking & Wallets</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(gatewayConfig.cashfree?.enabled)}
                    onChange={(e) =>
                      setGatewayConfig((prev) => ({
                        ...prev,
                        cashfree: { ...prev.cashfree, enabled: e.target.checked },
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7045D8]"></div>
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cashfree App ID (Client ID):
                  </label>
                  <input
                    type="text"
                    value={gatewayConfig.cashfree?.appId || ""}
                    onChange={(e) =>
                      setGatewayConfig((prev) => ({
                        ...prev,
                        cashfree: { ...prev.cashfree, appId: e.target.value.trim() },
                      }))
                    }
                    placeholder="e.g. CF_APP_xxxxxx or TESTxxxxxx"
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#7045D8]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cashfree Secret Key:
                  </label>
                  <input
                    type="password"
                    value={gatewayConfig.cashfree?.secretKey || ""}
                    onChange={(e) =>
                      setGatewayConfig((prev) => ({
                        ...prev,
                        cashfree: { ...prev.cashfree, secretKey: e.target.value.trim() },
                      }))
                    }
                    placeholder="cfsk_ma_prod_xxxxxx..."
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#7045D8]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Environment (मोड):
                  </label>
                  <select
                    value={gatewayConfig.cashfree?.environment || "SANDBOX"}
                    onChange={(e) =>
                      setGatewayConfig((prev) => ({
                        ...prev,
                        cashfree: {
                          ...prev.cashfree,
                          environment: e.target.value as "SANDBOX" | "PRODUCTION",
                        },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="PRODUCTION">PRODUCTION (लाइव भुगतान)</option>
                    <option value="SANDBOX">SANDBOX (टेस्टिंग मोड)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSaveGatewayConfig}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>गेटवे व UPI सेटिंग्स सेव करें</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. TAB 4: STUDENT PAYMENTS APPROVAL (ORDERS) */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex-1">
              📋 <strong>सत्यापन डैशबोर्ड:</strong> यहां वे सभी विद्यार्थी दिखेंगे जिन्होंने UPI QR कोड से भुगतान करके 12 अंकों का UTR नंबर सबमिट किया है। आप UTR देखकर 1-क्लिक में उनका VIP पास एक्टिवेट कर सकते हैं।
            </div>
          </div>

          {isLoadingOrders ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#7045D8]" />
              <p className="text-xs font-bold mt-2">पेमेंट्स लोड हो रहे हैं...</p>
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                कोई भी लंबित पेमेंट नहीं है!
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                सभी विद्यार्थियों के ऑर्डर्स सत्यापित व सक्रिय हैं। नए UTR आने पर वे यहां स्वतः दिखाई देंगे।
              </p>
            </div>
          ) : (
            <div className="rounded-3xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3.5">विद्यार्थी (Student)</th>
                      <th className="p-3.5">प्लान (Plan)</th>
                      <th className="p-3.5">राशि (Amount)</th>
                      <th className="p-3.5">UTR / Ref No.</th>
                      <th className="p-3.5">तारीख व समय</th>
                      <th className="p-3.5 text-right">कार्रवाई (Action)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pendingOrders.map((order) => (
                      <tr key={order.order_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3.5">
                          <strong className="block text-slate-900 dark:text-white">
                            {order.user_name || "विद्यार्थी"}
                          </strong>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {order.user_email || order.user_id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] font-black uppercase text-[10px]">
                            {order.plan_id}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-black text-emerald-600 dark:text-emerald-400">
                          ₹{order.amount}
                        </td>
                        <td className="p-3.5 font-mono font-black text-slate-900 dark:text-white select-all">
                          <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            {order.utr_number || "—"}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 text-[11px]">
                          {order.created_at ? new Date(order.created_at).toLocaleString("hi-IN") : "—"}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveOrder(order)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>स्वीकृत करें</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectOrder(order.order_id)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs cursor-pointer"
                            >
                              खारिज
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
