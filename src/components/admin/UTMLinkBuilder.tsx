import * as React from "react";
import { Link2, Copy, Check, ExternalLink, Share2, Sparkles } from "lucide-react";
import { getSiteDomain } from "../../config/siteConfig";

interface UTMLinkBuilderProps {
  articleSlugs?: string[];
}

export const UTMLinkBuilder: React.FC<UTMLinkBuilderProps> = ({ articleSlugs = [] }) => {
  const domain = getSiteDomain();

  const [path, setPath] = React.useState("/news/rajasthan-budget-2024-25-highlights");
  const [customPath, setCustomPath] = React.useState("");
  const [source, setSource] = React.useState("telegram");
  const [customSource, setCustomSource] = React.useState("");
  const [medium, setMedium] = React.useState("social");
  const [campaign, setCampaign] = React.useState("ras_2024_prep");
  const [copied, setCopied] = React.useState(false);

  const selectedSource = source === "custom" ? customSource.trim() : source;
  const selectedPath = path === "custom" ? (customPath.startsWith("/") ? customPath : `/${customPath}`) : path;

  const generatedUrl = `${domain}${selectedPath}?utm_source=${encodeURIComponent(
    selectedSource || "telegram"
  )}&utm_medium=${encodeURIComponent(medium || "social")}&utm_campaign=${encodeURIComponent(
    campaign || "ras_2024"
  )}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              SEO & Campaign Tool
            </span>
            <span className="text-xs text-slate-400">UTM Generator</span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            <span>UTM Link Builder</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generate tagged links for Telegram, WhatsApp, YouTube, and Social Media to track exact traffic channels in GA4 and Visitor Analytics.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Page / Article Path */}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase">Target Article / Page *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
            >
              <option value="/">Home Page (/)</option>
              <option value="/news">News Index (/news)</option>
              {articleSlugs.map((slug) => (
                <option key={slug} value={`/news/${slug}`}>
                  Article: /news/{slug}
                </option>
              ))}
              <option value="custom">Custom Path...</option>
            </select>

            {path === "custom" && (
              <input
                type="text"
                placeholder="/topics/rajasthan-economy"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
              />
            )}
          </div>
        </div>

        {/* Source */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase">Traffic Source (utm_source) *</label>
          <div className="space-y-2">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
            >
              <option value="telegram">Telegram Channel (telegram)</option>
              <option value="whatsapp">WhatsApp Group (whatsapp)</option>
              <option value="youtube">YouTube Video / Description (youtube)</option>
              <option value="google">Google Search (google)</option>
              <option value="newsletter">Newsletter Email (newsletter)</option>
              <option value="twitter">Twitter / X (twitter)</option>
              <option value="custom">Custom Source...</option>
            </select>

            {source === "custom" && (
              <input
                type="text"
                placeholder="e.g. instagram"
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
              />
            )}
          </div>
        </div>

        {/* Medium */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase">Medium (utm_medium) *</label>
          <select
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
          >
            <option value="social">Social Share (social)</option>
            <option value="post">Channel Post (post)</option>
            <option value="cpc">Paid Ad (cpc)</option>
            <option value="email">Email Blast (email)</option>
            <option value="organic">Organic Link (organic)</option>
          </select>
        </div>

        {/* Campaign */}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase">Campaign Name (utm_campaign)</label>
          <input
            type="text"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="e.g. ras_2024_prep, budget_highlights"
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Output Link Box */}
      <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-slate-900 border border-blue-200/80 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-300">
          <span>Generated Campaign Tagged Link</span>
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">Ready for sharing</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={generatedUrl}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white select-all"
          />

          <button
            onClick={handleCopy}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95"
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Copied!" : "Copy Link"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
