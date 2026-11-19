import React, { useState } from "react";
import { 
  X, 
  Sparkles, 
  Key, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  ExternalLink,
  Trash2,
  Lock,
  Plus,
  Cpu,
  Bot,
  Zap,
  Check,
  Activity,
  Layers,
  ChevronRight,
  Globe
} from "lucide-react";
import { AppSettings, UserPersonalAIKey, AIProvider } from "../types";
import { loadSettingsFromStorage, saveSettingsToStorage } from "../utils/storage";
import { testAIKeyConnection, PROVIDER_RECOMMENDED_MODELS } from "../utils/aiProviderService";
import { DEFAULT_PROVIDER_MODELS } from "../utils/aiMultiProviderService";

interface ApiSettingsModalProps {
  onClose: () => void;
  settings?: AppSettings;
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
}

const PROVIDER_META: Record<AIProvider, {
  name: string;
  tagline: string;
  defaultModel: string;
  keyPlaceholder: string;
  docsUrl: string;
  badgeClass: string;
  icon: any;
}> = {
  cliproxy: {
    name: "AGY Pro Proxy",
    tagline: "5-Account Auto-Rotation (Continuous High Quota)",
    defaultModel: "gemini-3.5-flash-lite",
    keyPlaceholder: "cliproxy-local",
    docsUrl: "http://127.0.0.1:8317",
    badgeClass: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    icon: Zap
  },
  gemini: {
    name: "Google Gemini",
    tagline: "Multimodal & High-Speed Reasoning",
    defaultModel: "gemini-3.5-flash-lite",
    keyPlaceholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    icon: Sparkles
  },
  groq: {
    name: "Groq (LPU)",
    tagline: "Ultra-Fast 500+ tok/s LPU Inference",
    defaultModel: "llama-3.3-70b-versatile",
    keyPlaceholder: "gsk_...",
    docsUrl: "https://console.groq.com/keys",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    icon: Zap
  },
  openai: {
    name: "OpenAI",
    tagline: "GPT-4o & GPT-4o Mini",
    defaultModel: "gpt-4o-mini",
    keyPlaceholder: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    icon: Cpu
  },
  claude: {
    name: "Anthropic Claude",
    tagline: "Claude 3.5 Sonnet & Haiku",
    defaultModel: "claude-3-5-haiku-20241022",
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    icon: Bot
  },
  openrouter: {
    name: "OpenRouter",
    tagline: "DeepSeek, Llama & Universal Gateway",
    defaultModel: "deepseek/deepseek-chat",
    keyPlaceholder: "sk-or-v1-...",
    docsUrl: "https://openrouter.ai/keys",
    badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    icon: Globe
  }
};


export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ 
  onClose, 
  settings: propSettings,
  onUpdateSettings: propOnUpdateSettings
}) => {
  const currentSettings = propSettings || loadSettingsFromStorage();
  
  // Normalize personal keys list from storage
  const initialKeys: UserPersonalAIKey[] = Array.isArray(currentSettings.personalAiKeys) && currentSettings.personalAiKeys.length > 0
    ? currentSettings.personalAiKeys
    : currentSettings.geminiApiKey?.trim()
      ? [{
          id: "key_legacy_gemini",
          name: "My Personal Gemini Key",
          provider: "gemini",
          apiKey: currentSettings.geminiApiKey.trim(),
          model: "gemini-3.5-flash-lite",
          enabled: true,
          createdAt: new Date().toISOString()
        }]
      : [];

  const initialMode = currentSettings.aiMode || (currentSettings.useCustomApiKey && initialKeys.length > 0 ? "personal_keys" : "platform_default");

  const [aiMode, setAiMode] = useState<"platform_default" | "personal_keys">(initialMode);
  const [personalKeys, setPersonalKeys] = useState<UserPersonalAIKey[]>(initialKeys);
  const [activeKeyId, setActiveKeyId] = useState<string>(
    currentSettings.activePersonalKeyId || initialKeys[0]?.id || ""
  );

  // New key form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState<AIProvider>("gemini");
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newModel, setNewModel] = useState(PROVIDER_META.gemini.defaultModel);
  const [showNewKeyText, setShowNewKeyText] = useState(false);

  // Testing feedback states
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [confirmDeletePersonalId, setConfirmDeletePersonalId] = useState<string | null>(null);

  // Helper to persist updates to AppSettings and sync storage
  const commitSettings = async (
    modeToSave: "platform_default" | "personal_keys", 
    keysToSave: UserPersonalAIKey[], 
    activeIdToSave: string
  ) => {
    setIsSaving(true);
    try {
      const geminiKeyInList = keysToSave.find(k => k.provider === "gemini");
      
      const updatedSettings: Partial<AppSettings> = {
        aiMode: keysToSave.length === 0 ? "platform_default" : modeToSave,
        personalAiKeys: keysToSave,
        activePersonalKeyId: activeIdToSave,
        useCustomApiKey: modeToSave === "personal_keys" && keysToSave.length > 0,
        geminiApiKey: (modeToSave === "personal_keys" && geminiKeyInList?.apiKey) ? geminiKeyInList.apiKey : ""
      };

      console.log("[ApiSettingsModal] Persisting AI settings to LocalStorage:", updatedSettings);
      const stored = loadSettingsFromStorage();
      const merged = { ...stored, ...updatedSettings };
      saveSettingsToStorage(merged);

      if (propOnUpdateSettings) {
        console.log("[ApiSettingsModal] Triggering propOnUpdateSettings callback...");
        await propOnUpdateSettings(updatedSettings);
      }

      setSaveBanner("Preferences saved successfully!");
      setTimeout(() => setSaveBanner(null), 2500);
    } catch (err: any) {
      console.error("[ApiSettingsModal] Error saving API settings:", err);
      setSaveBanner(`Save error: ${err?.message || "Failed to persist settings"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleModeChange = async (newMode: "platform_default" | "personal_keys") => {
    setAiMode(newMode);
    await commitSettings(newMode, personalKeys, activeKeyId);
  };

  const handleSetActiveKey = async (id: string) => {
    setActiveKeyId(id);
    const updated = personalKeys.map(k => ({
      ...k,
      enabled: k.id === id ? true : k.enabled
    }));
    setPersonalKeys(updated);
    await commitSettings("personal_keys", updated, id);
  };

  const handleDeleteKey = async (id: string) => {
    const updated = personalKeys.filter(k => k.id !== id);
    setPersonalKeys(updated);
    const newActiveId = activeKeyId === id ? (updated[0]?.id || "") : activeKeyId;
    setActiveKeyId(newActiveId);
    const newMode = updated.length === 0 ? "platform_default" : aiMode;
    if (updated.length === 0) setAiMode("platform_default");
    await commitSettings(newMode, updated, newActiveId);
    setSaveBanner("Key deleted successfully.");
    setTimeout(() => setSaveBanner(null), 2500);
  };

  const handleTestKey = async (keyEntry: { id: string; provider: AIProvider; apiKey: string; model?: string }) => {
    const clean = keyEntry.apiKey?.trim();
    if (!clean) {
      setTestResult({
        id: keyEntry.id,
        success: false,
        message: "API key is empty."
      });
      return;
    }

    setTestingKeyId(keyEntry.id);
    setTestResult(null);

    try {
      const result = await testAIKeyConnection({
        provider: keyEntry.provider,
        apiKey: clean,
        model: keyEntry.model || PROVIDER_META[keyEntry.provider].defaultModel
      });

      setTestResult({
        id: keyEntry.id,
        success: result.success,
        message: result.message || (result.success ? "Key operational!" : "Verification failed."),
        latencyMs: result.latencyMs
      });
    } catch (err: any) {
      setTestResult({
        id: keyEntry.id,
        success: false,
        message: err?.message || "Connection timeout or network failure."
      });
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleAddKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = newKey.trim();
    if (!cleanKey) return;

    const newEntry: UserPersonalAIKey = {
      id: `user_key_${Date.now()}`,
      name: newName.trim() || `${PROVIDER_META[newProvider].name} Key`,
      provider: newProvider,
      apiKey: cleanKey,
      model: newModel || PROVIDER_META[newProvider].defaultModel,
      enabled: true,
      createdAt: new Date().toISOString()
    };

    const updated = [...personalKeys, newEntry];
    setPersonalKeys(updated);
    setActiveKeyId(newEntry.id);
    setAiMode("personal_keys");
    await commitSettings("personal_keys", updated, newEntry.id);

    // Reset form
    setNewName("");
    setNewKey("");
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-[#171923]/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-[#FFF9EF] dark:bg-[#171923] rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom duration-300">
        <div className="h-1 w-full bg-gradient-to-r from-[#800020] via-[#F47B20] to-[#C99A45] shrink-0" />

        {/* Header */}
        <header className="px-6 pt-5 pb-4 bg-white dark:bg-[#1F2330] flex items-center justify-between border-b border-[#E8D9C0] dark:border-[#31374A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#800020] dark:bg-[#F47B20] text-white flex items-center justify-center shadow-sm">
              <Key size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
                <span>Study Assistant Setup</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#F47B20] border border-[#E8D9C0] dark:border-[#31374A]">
                  DISHA 20-20
                </span>
              </h3>
              <p className="text-[11px] font-medium text-[#52576A] dark:text-[#CBD2E1]">
                Choose between DISHA 20-20 Platform Engine or your personal keys
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#52576A] dark:text-[#CBD2E1] hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* Toast / Banner */}
          {saveBanner && (
            <div className="p-3 rounded-2xl bg-[#15803D]/10 border border-[#15803D]/30 text-[#15803D] dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-emerald-400" />
              <span>{saveBanner}</span>
            </div>
          )}

          {/* Two-Way Mode Selector: Platform Default vs Personal Keys */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20]">
              Select Engine Source
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Card 1: Admin Shared Platform AI */}
              <button
                type="button"
                onClick={() => handleModeChange("platform_default")}
                className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                  aiMode === "platform_default"
                    ? "bg-white dark:bg-[#1F2330] border-[#800020] dark:border-[#F47B20] shadow-xs ring-2 ring-[#800020]/15 dark:ring-[#F47B20]/20"
                    : "bg-white/70 dark:bg-[#1F2330]/60 border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center">
                    <ShieldCheck size={18} />
                  </div>
                  {aiMode === "platform_default" && (
                    <span className="w-5 h-5 rounded-full bg-[#800020] dark:bg-[#F47B20] text-white flex items-center justify-center text-[10px]">
                      <Check size={12} />
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-black text-[#171923] dark:text-[#FFF9EF]">
                  DISHA 20-20 Platform Engine
                </h4>
                <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] mt-1 leading-snug">
                  Zero setup required. Powered by the high-speed shared key managed by Admin.
                </p>
                <span className="inline-block mt-2 text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20]">
                  Recommended for Aspirants
                </span>
              </button>

              {/* Card 2: My Personal Keys */}
              <button
                type="button"
                onClick={() => handleModeChange("personal_keys")}
                className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                  aiMode === "personal_keys"
                    ? "bg-white dark:bg-[#1F2330] border-[#F47B20] shadow-xs ring-2 ring-[#F47B20]/20"
                    : "bg-white/70 dark:bg-[#1F2330]/60 border-[#E8D9C0] dark:border-[#31374A] hover:border-[#F47B20]/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center">
                    <Layers size={18} />
                  </div>
                  {aiMode === "personal_keys" && (
                    <span className="w-5 h-5 rounded-full bg-[#F47B20] text-white flex items-center justify-center text-[10px]">
                      <Check size={12} />
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-black text-[#171923] dark:text-[#FFF9EF]">
                  My Personal Keys
                </h4>
                <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] mt-1 leading-snug">
                  Upload multiple keys (Gemini, Groq, OpenAI). Stored strictly on your device.
                </p>
                <span className="inline-block mt-2 text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-[#F47B20]/15 text-[#F47B20] font-mono tabular-nums">
                  {personalKeys.length} Personal Key{personalKeys.length === 1 ? "" : "s"}
                </span>
              </button>
            </div>
          </div>

          {/* Section A: Platform Default Details */}
          {aiMode === "platform_default" && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                  <span>DISHA 20-20 Status: Active</span>
                </span>
                <span className="text-[10px] font-extrabold text-[#15803D] dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#15803D] dark:bg-emerald-400" />
                  <span>Ready for MCQs</span>
                </span>
              </div>
              <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] leading-relaxed">
                You are currently using the default study engine provided by DISHA 20-20 Admin. MCQ explanations, hints, and smart practice run seamlessly without needing any personal API key.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-[#787D91] dark:text-[#929AB0] border-t border-[#E8D9C0]/70 dark:border-[#31374A] pt-2">
                <Lock className="w-3 h-3 text-[#800020] dark:text-[#F47B20] shrink-0" />
                <span>Admin server keys are managed centrally and are never exposed to client browsers.</span>
              </div>
            </div>
          )}

          {/* Section B: Personal Keys Pool (Multiple Keys Supported) */}
          {aiMode === "personal_keys" && (
            <div className="space-y-4 animate-in fade-in">
              
              {/* Header with Add Button */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] uppercase tracking-wider">
                    Your Personal API Keys ({personalKeys.length})
                  </h4>
                  <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1]">
                    Switch between keys or add multiple keys for high throughput
                  </p>
                </div>
                {!showAddForm && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(true);
                      setNewProvider("gemini");
                      setNewModel(PROVIDER_META.gemini.defaultModel);
                    }}
                    className="px-3 py-1.5 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Key</span>
                  </button>
                )}
              </div>

              {/* Add Key Inline Form */}
              {showAddForm && (
                <form onSubmit={handleAddKeySubmit} className="p-4 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-1 border-b border-[#E8D9C0] dark:border-[#31374A]">
                    <span className="text-xs font-black text-[#171923] dark:text-[#FFF9EF]">
                      Add New Personal API Key
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-[#52576A] dark:text-[#CBD2E1] hover:text-[#800020] text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Provider Selector Tabs */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#52576A] dark:text-[#CBD2E1] uppercase">Provider</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {(["gemini", "groq", "openai", "claude", "openrouter"] as AIProvider[]).map((prov) => {
                        const isSel = newProvider === prov;
                        const Meta = PROVIDER_META[prov];
                        const Icon = Meta.icon;
                        return (
                          <button
                            key={prov}
                            type="button"
                            onClick={() => {
                              setNewProvider(prov);
                              setNewModel(Meta.defaultModel);
                            }}
                            className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                              isSel 
                                ? "bg-[#FFF9EF] dark:bg-[#171923] border-[#800020] dark:border-[#F47B20] text-[#800020] dark:text-[#F47B20] shadow-xs font-black"
                                : "bg-[#F7EFE2] dark:bg-[#252A3A] border-transparent text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-white"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 mx-auto mb-0.5" />
                            <span className="text-[10px] block capitalize">{prov}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Key Label Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#52576A] dark:text-[#CBD2E1] uppercase">Key Label</label>
                    <input
                      type="text"
                      placeholder={`e.g. My Personal ${PROVIDER_META[newProvider].name}`}
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs text-[#171923] dark:text-[#FFF9EF] font-medium focus:outline-none focus:ring-2 focus:ring-[#800020]/20 dark:focus:ring-[#F47B20]/20"
                    />
                  </div>

                  {/* API Key Input */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-[#52576A] dark:text-[#CBD2E1] uppercase">
                        {PROVIDER_META[newProvider].name} Key
                      </label>
                      <a
                        href={PROVIDER_META[newProvider].docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#800020] dark:text-[#F47B20] font-bold hover:underline flex items-center gap-0.5"
                      >
                        <span>Get key</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        type={showNewKeyText ? "text" : "password"}
                        required
                        placeholder={PROVIDER_META[newProvider].keyPlaceholder}
                        value={newKey}
                        onChange={e => setNewKey(e.target.value)}
                        className="w-full px-3 py-2 pr-9 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-mono font-medium text-[#171923] dark:text-[#FFF9EF] focus:outline-none focus:ring-2 focus:ring-[#800020]/20 dark:focus:ring-[#F47B20]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewKeyText(!showNewKeyText)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#787D91] hover:text-[#171923] dark:hover:text-white"
                      >
                        {showNewKeyText ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Model Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#52576A] dark:text-[#CBD2E1] uppercase">Model</label>
                    <select
                      value={newModel}
                      onChange={e => setNewModel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs text-[#171923] dark:text-[#FFF9EF] font-medium focus:outline-none"
                    >
                      {(DEFAULT_PROVIDER_MODELS[newProvider] || []).map(m => (
                        <option key={m.id} value={m.id}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    Save & Activate This Key
                  </button>
                </form>
              )}

              {/* Personal Keys Table / Cards */}
              {personalKeys.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#1F2330] border border-dashed border-[#E8D9C0] dark:border-[#31374A] space-y-2">
                  <Key className="w-8 h-8 mx-auto text-[#C99A45]" />
                  <p className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                    No personal keys added yet
                  </p>
                  <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] max-w-xs mx-auto">
                    You can add your personal Gemini, Groq, or OpenAI keys for dedicated quota.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="px-4 py-1.5 bg-[#800020] dark:bg-[#F47B20] text-white rounded-xl text-xs font-black shadow-xs inline-flex items-center gap-1.5 mt-2 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Your First Key</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {personalKeys.map((k) => {
                    const isActive = activeKeyId === k.id;
                    const isTesting = testingKeyId === k.id;
                    const feedback = testResult?.id === k.id ? testResult : null;
                    const Meta = PROVIDER_META[k.provider] || PROVIDER_META.gemini;
                    const Icon = Meta.icon;

                    return (
                      <div
                        key={k.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isActive
                            ? "bg-white dark:bg-[#1F2330] border-[#800020] dark:border-[#F47B20] shadow-xs"
                            : "bg-white/70 dark:bg-[#1F2330]/60 border-[#E8D9C0] dark:border-[#31374A]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          
                          {/* Left: Radio Selector + Name + Provider Badge */}
                          <div 
                            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                            onClick={() => handleSetActiveKey(k.id)}
                          >
                            <input
                              type="radio"
                              name="activePersonalKey"
                              checked={isActive}
                              onChange={() => handleSetActiveKey(k.id)}
                              className="w-4 h-4 text-[#800020] dark:text-[#F47B20] focus:ring-[#800020] cursor-pointer"
                            />
                            <div className="w-7 h-7 rounded-lg bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center shrink-0">
                              <Icon size={14} className="text-[#800020] dark:text-[#F47B20]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] truncate">
                                  {k.name}
                                </span>
                                {isActive && (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-[#800020] dark:bg-[#F47B20] text-white uppercase">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-[#52576A] dark:text-[#CBD2E1] mt-0.5">
                                <span className="font-semibold uppercase">{k.provider}</span>
                                <span>·</span>
                                <span className="font-mono text-[9px] truncate">{k.model}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Test Button + Delete */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isTesting}
                              onClick={() => handleTestKey(k)}
                              className="px-2.5 py-1 bg-[#FFF9EF] dark:bg-[#171923] hover:border-[#800020] border border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF] rounded-lg text-[10px] font-bold flex items-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              <Activity className={`w-3 h-3 ${isTesting ? "animate-spin text-[#F47B20]" : "text-[#15803D] dark:text-emerald-400"}`} />
                              <span>{isTesting ? "Testing..." : "Test"}</span>
                            </button>

                            {confirmDeletePersonalId === k.id ? (
                              <div className="flex items-center gap-1 animate-in fade-in">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmDeletePersonalId(null);
                                    handleDeleteKey(k.id);
                                  }}
                                  className="px-2 py-0.5 bg-[#DC2626] hover:bg-rose-700 text-white rounded-lg text-[9px] font-bold flex items-center gap-0.5 active:scale-95 cursor-pointer shadow-xs"
                                >
                                  <Trash2 size={10} />
                                  <span>Delete?</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePersonalId(null)}
                                  className="p-1 text-[#787D91] hover:text-[#171923] text-xs font-bold cursor-pointer"
                                  title="Cancel"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePersonalId(k.id)}
                                className="p-1.5 text-[#787D91] hover:text-[#DC2626] hover:bg-[#DC2626]/10 rounded-lg transition-colors cursor-pointer"
                                title="Delete key"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline Test Result for this Key */}
                        {feedback && (
                          <div className={`mt-2 p-2 rounded-xl border text-[10px] flex items-center justify-between gap-2 animate-in fade-in ${
                            feedback.success
                              ? "bg-[#15803D]/10 border-[#15803D]/30 text-[#15803D] dark:text-emerald-300"
                              : "bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] dark:text-rose-300"
                          }`}>
                            <div className="flex items-center gap-1.5 truncate">
                              {feedback.success ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] dark:text-emerald-400 shrink-0" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                              )}
                              <span className="truncate font-medium">{feedback.message}</span>
                              {feedback.latencyMs && (
                                <span className="text-[9px] font-mono tabular-nums opacity-80">({feedback.latencyMs}ms)</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setTestResult(null)}
                              className="underline opacity-75 shrink-0"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between bg-white dark:bg-[#1F2330]">
          <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] flex items-center gap-1 font-medium">
            <Lock size={12} className="text-[#800020] dark:text-[#F47B20]" />
            <span>Personal keys stay private on this device.</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-xl text-xs font-black active:scale-95 transition-all cursor-pointer"
          >
            Done
          </button>
        </footer>

      </div>
    </div>
  );
};

export default ApiSettingsModal;
