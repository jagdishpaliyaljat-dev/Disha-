import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Link as LinkIcon,
  Plus,
  Trash2,
  X,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Layers,
  Search,
  RefreshCw,
  Info,
  BookOpen,
  Sliders,
  Check
} from "lucide-react";
import {
  AutoLinkRule,
  AUTO_INTERNAL_LINK_RULES,
  AUTO_EXTERNAL_LINK_RULES,
  fetchCustomAutoLinkRules,
  saveCustomAutoLinkRule,
  deleteCustomAutoLinkRule
} from "../../utils/smartArticleImporter";

interface AutoLinkRulesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRulesUpdated?: () => void;
}

export const AutoLinkRulesManagerModal: React.FC<AutoLinkRulesManagerModalProps> = ({
  isOpen,
  onClose,
  onRulesUpdated
}) => {
  const [activeTab, setActiveTab] = React.useState<"custom" | "builtin">("custom");
  const [customRules, setCustomRules] = React.useState<AutoLinkRule[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // New Rule Form State
  const [newKeywords, setNewKeywords] = React.useState("");
  const [newUrl, setNewUrl] = React.useState("");
  const [newType, setNewType] = React.useState<"internal" | "external">("internal");
  const [newDescription, setNewDescription] = React.useState("");
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const loadRules = async () => {
    setLoading(true);
    try {
      const rules = await fetchCustomAutoLinkRules();
      setCustomRules(rules);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeywords.trim() || !newUrl.trim()) {
      alert("Please enter at least one keyword and target URL.");
      return;
    }

    const keywordList = newKeywords
      .split(",")
      .map(k => k.trim())
      .filter(Boolean);

    if (keywordList.length === 0) {
      alert("Please provide valid keywords separated by commas.");
      return;
    }

    setLoading(true);
    try {
      const newRule: AutoLinkRule = {
        keywords: keywordList,
        url: newUrl.trim(),
        type: newType,
        description: newDescription.trim() || `${newType.toUpperCase()} Link Mapping`
      };

      await saveCustomAutoLinkRule(newRule);
      await loadRules();

      // Reset Form
      setNewKeywords("");
      setNewUrl("");
      setNewDescription("");
      setFeedback(`New ${newType} link rule added for "${keywordList.join(", ")}"!`);
      setTimeout(() => setFeedback(null), 3000);

      if (onRulesUpdated) onRulesUpdated();
    } catch (err: any) {
      alert("Failed to save rule: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (idToDelete?: string) => {
    if (!idToDelete) return;
    if (!window.confirm("Are you sure you want to delete this link rule?")) return;
    
    setLoading(true);
    try {
      await deleteCustomAutoLinkRule(idToDelete);
      await loadRules();
      if (onRulesUpdated) onRulesUpdated();
    } catch (err: any) {
      alert("Failed to delete rule: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllCustomRules = async () => {
    if (window.confirm("Are you sure you want to delete all custom auto-link rules? This cannot be undone.")) {
      setLoading(true);
      try {
        for (const rule of customRules) {
          if (rule.id) await deleteCustomAutoLinkRule(rule.id);
        }
        await loadRules();
        if (onRulesUpdated) onRulesUpdated();
      } catch (err: any) {
        alert("Failed to clear rules: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredCustomRules = customRules.filter(r => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.keywords.some(k => k.toLowerCase().includes(q)) ||
      r.url.toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-white dark:bg-[#111A2E] rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden my-auto"
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-8 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-[#7045D8]/20 shrink-0">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Automated Internal & External Links Manager
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider">
                  Auto-Link Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Set keyword triggers to automatically inject internal routes or external reference links when importing and editing articles.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="min-w-[40px] min-h-[40px] p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div className="px-6 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 p-5 sm:p-8 overflow-y-auto space-y-6">
          {/* Add New Link Rule Form */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Add Custom Auto-Link Rule</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">
                Admin Custom Rule
              </span>
            </div>

            <form onSubmit={handleAddRule} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Keywords input */}
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Keywords / Phrases (comma separated) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newKeywords}
                    onChange={e => setNewKeywords(e.target.value)}
                    placeholder="e.g. Rajasthan History, Rajasthan Geography, GK Notes"
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Target URL */}
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Target URL / Path *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    placeholder="e.g. /topics or https://rpsc.rajasthan.gov.in"
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Type Selection */}
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Link Type
                  </label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as "internal" | "external")}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="internal">Internal App Route (/...)</option>
                    <option value="external">External Website (https://...)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input
                  type="text"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Optional rule description (e.g. Rajasthan GK Section Link)"
                  className="flex-1 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white"
                />

                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs font-black shadow-md shadow-[#7045D8]/20 transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Link Rule</span>
                </button>
              </div>
            </form>
          </div>

          {/* Tab Selector for Rules List */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("custom")}
                className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === "custom"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                Custom Admin Rules ({customRules.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("builtin")}
                className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === "builtin"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                Default System Rules ({AUTO_INTERNAL_LINK_RULES.length + AUTO_EXTERNAL_LINK_RULES.length})
              </button>
            </div>

            {activeTab === "custom" && customRules.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllCustomRules}
                className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
              >
                Clear All Custom Rules
              </button>
            )}
          </div>

          {/* CUSTOM RULES LIST */}
          {activeTab === "custom" && (
            <div className="space-y-3">
              {customRules.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mx-auto">
                    <LinkIcon className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    No custom link rules added yet
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Use the form above to add custom keywords (e.g. "Rajasthan History" → "/topics"). They will automatically link whenever articles are imported or edited!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredCustomRules.map(rule => (
                    <div
                      key={rule.id}
                      className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            rule.type === "internal"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                          }`}>
                            {rule.type}
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {rule.keywords.join(", ")}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 truncate">
                          {rule.url}
                        </p>
                        {rule.description && (
                          <p className="text-[10px] text-slate-400">
                            {rule.description}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer self-end sm:self-center"
                        title="Delete rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BUILT-IN SYSTEM RULES LIST */}
          {activeTab === "builtin" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                  Built-in Internal Link Rules ({AUTO_INTERNAL_LINK_RULES.length}):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AUTO_INTERNAL_LINK_RULES.map((rule, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {rule.keywords.slice(0, 3).join(", ")}
                        </span>
                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 shrink-0 font-bold">
                          {rule.url}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">{rule.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                  Built-in External Link Rules ({AUTO_EXTERNAL_LINK_RULES.length}):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AUTO_EXTERNAL_LINK_RULES.map((rule, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {rule.keywords.slice(0, 3).join(", ")}
                        </span>
                        <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 shrink-0 font-bold truncate max-w-[120px]">
                          {rule.url}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">{rule.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-8 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-6 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
