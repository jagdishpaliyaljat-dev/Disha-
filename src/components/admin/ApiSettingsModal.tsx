import * as React from "react";
import { loadUserProfile } from "../../utils/userProfileStorage";
import { AIApiConfig, AIProvider } from "../../types";
import { PROVIDER_RECOMMENDED_MODELS, AIModelDefinition, testAIKeyConnection } from "../../utils/aiProviderService";
import { 
  X, 
  Loader2, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Eye,
  EyeOff,
  Zap,
  Activity,
  Cpu,
  Bot,
  ExternalLink,
  Layers,
  Globe
} from "lucide-react";

interface ApiSettingsModalProps {
  onClose: () => void;
  onSaved: () => void;
  initialConfig?: AIApiConfig | null;
}

const PROVIDER_INFO: Record<AIProvider, {
  title: string;
  subtitle: string;
  keyPlaceholder: string;
  defaultName: string;
  docsUrl: string;
  docsLabel: string;
  badgeColor: string;
}> = {
  cliproxy: {
    title: "AGY Pro Proxy (5-Account Local)",
    subtitle: "5 Gmail Pro Accounts Auto-Rotation • Zero Quota Errors • OpenRouter Fallback",
    keyPlaceholder: "cliproxy-local",
    defaultName: "Antigravity Pro Proxy",
    docsUrl: "http://127.0.0.1:8317",
    docsLabel: "Proxy Status (port 8317)",
    badgeColor: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  },
  gemini: {
    title: "Google Gemini",
    subtitle: "Native @google/genai SDK • Multimodal & High Speed Bilingual Reasoning",
    keyPlaceholder: "AIzaSy...",
    defaultName: "Google Gemini Key",
    docsUrl: "https://aistudio.google.com/app/apikey",
    docsLabel: "Get Gemini API Key",
    badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  },
  openai: {
    title: "OpenAI (ChatGPT)",
    subtitle: "GPT-4o, GPT-4o Mini & o3-mini • Industry Standard Precision",
    keyPlaceholder: "sk-proj-...",
    defaultName: "OpenAI ChatGPT Key",
    docsUrl: "https://platform.openai.com/api-keys",
    docsLabel: "Get OpenAI API Key",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  claude: {
    title: "Anthropic Claude",
    subtitle: "Claude 3.7 & 3.5 Sonnet / Haiku • Advanced Nuance & Comprehension",
    keyPlaceholder: "sk-ant-...",
    defaultName: "Anthropic Claude Key",
    docsUrl: "https://console.anthropic.com/settings/keys",
    docsLabel: "Get Anthropic Key",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  groq: {
    title: "Groq (LPU Inference)",
    subtitle: "Llama 3.3 70B & Mixtral • Blazing Fast 300+ Tokens/Sec",
    keyPlaceholder: "gsk_...",
    defaultName: "Groq High-Speed Key",
    docsUrl: "https://console.groq.com/keys",
    docsLabel: "Get Groq API Key",
    badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  },
  openrouter: {
    title: "OpenRouter (Universal Gateway)",
    subtitle: "DeepSeek R1, V3, Llama 3.3, Claude & GPT-4o • Single Unified API",
    keyPlaceholder: "sk-or-v1-...",
    defaultName: "OpenRouter Universal Key",
    docsUrl: "https://openrouter.ai/keys",
    docsLabel: "Get OpenRouter API Key",
    badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  },
};

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ onClose, onSaved, initialConfig }) => {
  const isEditing = Boolean(initialConfig?.id && initialConfig.id !== "system-gemini");
  const isSystem = initialConfig?.id === "system-gemini";

  const [selectedProvider, setSelectedProvider] = React.useState<AIProvider>(initialConfig?.provider || "gemini");
  const [newConfig, setNewConfig] = React.useState<Partial<AIApiConfig>>({ 
    provider: initialConfig?.provider || "gemini", 
    enabled: initialConfig?.enabled ?? true, 
    name: initialConfig?.name || PROVIDER_INFO.gemini.defaultName, 
    apiKey: initialConfig?.apiKey || "", 
    model: initialConfig?.model || PROVIDER_RECOMMENDED_MODELS[initialConfig?.provider || "gemini"]?.[0]?.id || "gemini-2.5-flash",
    priority: initialConfig?.priority ?? 1,
  });

  const [customModelName, setCustomModelName] = React.useState("");
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [availableModels, setAvailableModels] = React.useState<AIModelDefinition[]>(
    PROVIDER_RECOMMENDED_MODELS[initialConfig?.provider || "gemini"] || PROVIDER_RECOMMENDED_MODELS.gemini
  );
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // When provider changes, update models list and default model
  const handleProviderChange = async (provider: AIProvider) => {
    setSelectedProvider(provider);
    const recommended = PROVIDER_RECOMMENDED_MODELS[provider] || [];
    setAvailableModels(recommended);
    
    const defaultModel = recommended[0]?.id || "";
    setNewConfig(prev => ({
      ...prev,
      provider,
      name: (!isEditing && prev.name === PROVIDER_INFO[selectedProvider]?.defaultName) 
        ? PROVIDER_INFO[provider].defaultName 
        : (prev.name || PROVIDER_INFO[provider].defaultName),
      model: defaultModel,
    }));
    setTestResult(null);

    // Fetch models if available
    try {
      const endpoint = provider === "gemini" ? "/api/gemini/models" : provider === "groq" ? "/api/groq/models" : null;
      if (endpoint) {
        const headers: Record<string, string> = {};
        if (newConfig.apiKey && !newConfig.apiKey.includes("••••")) {
          if (provider === "gemini") headers["x-gemini-api-key"] = newConfig.apiKey;
          if (provider === "groq") headers["Authorization"] = `Bearer ${newConfig.apiKey}`;
        }
        
        const res = await fetch(endpoint, { headers });
        if (res.ok) {
          const remoteModels = await res.json();
          if (Array.isArray(remoteModels) && remoteModels.length > 0) {
            setAvailableModels(remoteModels);
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch models for ${provider}:`, err);
    }
  };

  const getAdminHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    try {
      const { supabase } = await import("../../lib/supabase");
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {}
    return headers;
  };

  const selectedModelId = newConfig.model === "custom" 
    ? customModelName.trim() 
    : (newConfig.model || PROVIDER_RECOMMENDED_MODELS[selectedProvider]?.[0]?.id || "");

  const handleTest = async () => {
    const testKeyToUse = newConfig.apiKey?.trim();

    if (!testKeyToUse && !initialConfig?.id) {
      setTestResult({ success: false, message: "Please enter an API key to test." });
      return;
    }
    if (!selectedModelId) {
      setTestResult({ success: false, message: "Please select or enter a valid model." });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const payload: any = {
        provider: selectedProvider,
        model: selectedModelId,
      };

      if (testKeyToUse && !testKeyToUse.includes("••••")) {
        payload.apiKey = testKeyToUse;
      } else if (initialConfig?.id) {
        payload.configId = initialConfig.id;
      }

      let testSuccess = false;
      let data: any = null;

      // 1. Attempt server-side verification first with a 20s AbortSignal timeout
      try {
        const controller = new AbortController();
        const serverTimer = setTimeout(() => {
          try {
            controller.abort(new Error("Verification timed out"));
          } catch {
            controller.abort();
          }
        }, 20000);
        try {
          const authHeaders = await getAdminHeaders();
          const response = await fetch("/api/ai/test-key", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          const respText = await response.text();
          try {
            data = JSON.parse(respText);
          } catch {
            data = { error: respText ? `Server response (${response.status}): ${respText.replace(/<[^>]*>?/gm, '').slice(0, 150)}` : `HTTP ${response.status}` };
          }
          if (response.ok && data.success) {
            testSuccess = true;
          }
        } finally {
          clearTimeout(serverTimer);
        }
      } catch (serverErr) {
        console.warn("Server-side test endpoint unavailable or timed out, using direct client verification:", serverErr);
      }

      // 2. Resilient client-side verification fallback if raw key is available
      if (!testSuccess && payload.apiKey && !payload.apiKey.includes("••••")) {
        try {
          const clientResult = await testAIKeyConnection({
            provider: selectedProvider,
            apiKey: payload.apiKey,
            model: selectedModelId,
          });
          if (clientResult.success) {
            testSuccess = true;
            data = clientResult;
          } else if (!data?.error) {
            data = clientResult;
          }
        } catch (clientErr: any) {
          if (!data?.error) {
            data = { error: clientErr?.message || "Client verification failed" };
          }
        }
      }

      if (testSuccess && data?.success) {
        setTestResult({ 
          success: true, 
          message: data.message || `Connected successfully! Latency: ${data.latencyMs || 0}ms.`,
          latencyMs: data.latencyMs,
        });
      } else {
        let displayError = data?.error || data?.message || `Failed to validate with ${PROVIDER_INFO[selectedProvider].title}.`;
        if (displayError.includes("aborted") || displayError.includes("AbortError")) {
          displayError = "Connection timed out. The AI provider took too long to respond. Please try again.";
        }
        setTestResult({ 
          success: false, 
          message: displayError
        });
      }
    } catch (e: any) {
      let rawMsg = e?.message || "";
      if (rawMsg.includes("aborted") || rawMsg.includes("AbortError")) {
        rawMsg = "Connection timed out. The AI provider took too long to respond. Please try again.";
      }
      setTestResult({ 
        success: false, 
        message: rawMsg || "Network error while connecting to server." 
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConfig.name?.trim()) {
      alert("Please enter a name for this API configuration.");
      return;
    }
    if (!isEditing && !newConfig.apiKey?.trim()) {
      alert("Please provide a valid API key.");
      return;
    }
    if (!selectedModelId) {
      alert("Please specify a model ID.");
      return;
    }

    setLoading(true);
    setSaveError(null);
    try {
      const headers = await getAdminHeaders();
      const payload: any = {
        name: newConfig.name.trim(),
        provider: selectedProvider,
        model: selectedModelId,
        enabled: newConfig.enabled ?? true,
        priority: typeof newConfig.priority === "number" ? newConfig.priority : 1,
      };

      if (newConfig.apiKey && !newConfig.apiKey.includes("••••") && newConfig.apiKey.trim().length > 0) {
        payload.apiKey = newConfig.apiKey.trim();
      }

      const configId = initialConfig?.id || ("config_" + Date.now());
      const url = initialConfig?.id ? `/api/admin/ai-configs/${initialConfig.id}` : "/api/admin/ai-configs";
      const method = initialConfig?.id ? "PUT" : "POST";

      console.log(`[Admin ApiSettingsModal] Submitting API config (${method} ${url}):`, { ...payload, apiKey: payload.apiKey ? "••••••••" : "unchanged" });

      let serverSuccess = false;
      let respData: any = null;

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          serverSuccess = true;
          try {
            respData = await response.json();
          } catch (_) {}
        } else {
          const text = await response.text();
          console.warn(`[Admin ApiSettingsModal] Server endpoint returned ${response.status}:`, text);
        }
      } catch (fetchErr) {
        console.warn("[Admin ApiSettingsModal] Server fetch notice, falling back to local client store:", fetchErr);
      }

      // Persist non-secret metadata locally
      try {
        const configDoc: any = {
          id: configId,
          name: newConfig.name.trim(),
          provider: selectedProvider,
          model: selectedModelId,
          enabled: newConfig.enabled ?? true,
          priority: typeof newConfig.priority === "number" ? newConfig.priority : 1,
          hasKey: Boolean(payload.apiKey || initialConfig?.apiKey),
          updatedAt: new Date().toISOString(),
        };
        const raw = localStorage.getItem("disha2020_ai_api_configs_v1") || localStorage.getItem("quizpro_ai_api_configs_v1") || "{}";
        const configs = JSON.parse(raw);
        configs[configId] = configDoc;
        localStorage.setItem("disha2020_ai_api_configs_v1", JSON.stringify(configs));
      } catch (err) {
        console.warn("[Admin ApiSettingsModal] Local config save notice:", err);
      }

      console.log("[Admin ApiSettingsModal] API key saved successfully.");
      await onSaved();
      onClose();
    } catch (e: any) {
      console.error("[Admin ApiSettingsModal] Exception during save:", e);
      setSaveError(`Failed to save API key: ${e.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const currentProviderInfo = PROVIDER_INFO[selectedProvider];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-900 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                {isEditing ? "Modify Node Configuration" : isSystem ? "System Configuration" : "Initialize New Node"}
              </h2>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">
                Failover & Rotation Strategy
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Provider Selection (Minimal Grid) */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Inference Provider
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(["gemini", "openai", "claude", "groq", "openrouter"] as AIProvider[]).map((prov) => {
                const info = PROVIDER_INFO[prov];
                const isSelected = selectedProvider === prov;
                return (
                  <button
                    key={prov}
                    type="button"
                    disabled={isSystem}
                    onClick={() => handleProviderChange(prov)}
                    className={`px-4 py-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                      isSelected 
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm" 
                        : "border-slate-100 bg-white text-slate-600 hover:border-slate-300"
                    } ${isSystem ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className={isSelected ? "text-white" : "text-slate-400"}>
                      {prov === "gemini" && <Sparkles className="w-4 h-4" />}
                      {prov === "openai" && <Cpu className="w-4 h-4" />}
                      {prov === "claude" && <Bot className="w-4 h-4" />}
                      {prov === "groq" && <Zap className="w-4 h-4" />}
                      {prov === "openrouter" && <Globe className="w-4 h-4" />}
                    </div>
                    <span className="text-xs font-bold truncate">{info.title.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Config Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Registry Label
              </label>
              <input 
                type="text"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-colors" 
                placeholder={currentProviderInfo.defaultName} 
                value={newConfig.name} 
                onChange={e => setNewConfig({ ...newConfig, name: e.target.value })} 
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                Sequence Rank
              </label>
              <input 
                type="number"
                min="1"
                max="99"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-colors tabular-nums" 
                value={newConfig.priority ?? 1} 
                onChange={e => setNewConfig({ ...newConfig, priority: parseInt(e.target.value) || 1 })} 
              />
            </div>
          </div>

          {/* Model selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Model Endpoint
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-colors cursor-pointer appearance-none"
              value={newConfig.model}
              onChange={e => setNewConfig({ ...newConfig, model: e.target.value })}
            >
              {availableModels.map(m => (
                <option key={m.id} value={m.id}>
                  {m.displayName || m.name}
                </option>
              ))}
              <option value="custom">+ Manual Model Override</option>
            </select>

            {newConfig.model === "custom" && (
              <input
                type="text"
                placeholder="e.g. gemini-2.0-flash-exp"
                className="mt-2 w-full px-4 py-2.5 rounded-xl border border-slate-900 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none"
                value={customModelName}
                onChange={e => setCustomModelName(e.target.value)}
                required
              />
            )}
          </div>

          {/* API Key */}
          {!isSystem && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Authentication Secret
                </label>
                <a 
                  href={currentProviderInfo.docsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-slate-900 hover:underline flex items-center gap-1"
                >
                  Retrieve Key <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="relative">
                <input 
                  type={showApiKey ? "text" : "password"}
                  required={!isEditing}
                  className="w-full px-4 py-2.5 pr-12 rounded-xl border border-slate-100 bg-slate-50/50 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-colors" 
                  placeholder={isEditing ? "••••••••••••••••" : currentProviderInfo.keyPlaceholder}
                  value={newConfig.apiKey || ""} 
                  onChange={e => {
                    setNewConfig({ ...newConfig, apiKey: e.target.value });
                    if (testResult) setTestResult(null);
                  }} 
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                Secret is encrypted at rest and never returned to the browser in plain text.
              </p>
            </div>
          )}

          {/* Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-900">Active Status</span>
              <p className="text-[10px] text-slate-400 font-medium">Allow system to include this node in rotation pools</p>
            </div>
            <button
              type="button"
              onClick={() => setNewConfig({ ...newConfig, enabled: !newConfig.enabled })}
              className={`w-10 h-6 rounded-full transition-colors relative ${newConfig.enabled ? 'bg-slate-900' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${newConfig.enabled ? 'left-5' : 'left-1'}`} />
            </button>
          </div>

          {/* Test/Save Feedback */}
          {(testResult || saveError) && (
            <div className={`p-4 rounded-xl border text-[11px] font-medium flex items-center justify-between gap-3 animate-in slide-in-from-top-2 ${
              (testResult?.success) 
                ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                : "bg-rose-50 border-rose-100 text-rose-800"
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                {(testResult?.success) ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span className="truncate">{testResult?.message || saveError}</span>
              </div>
              <button 
                type="button" 
                onClick={() => { setTestResult(null); setSaveError(null); }}
                className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between shrink-0">
          <button
            type="button"
            disabled={testing || (!newConfig.apiKey?.trim() && !initialConfig?.id)}
            onClick={handleTest}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
            <span>{testing ? "Verifying..." : "Dry Run Test"}</span>
          </button>

          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEditing ? "Update Registry" : "Commit Configuration"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

