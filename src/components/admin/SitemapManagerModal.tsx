import * as React from "react";
import {
  Globe,
  RefreshCw,
  Download,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  FileCode,
  X,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import {
  CANONICAL_SITE_URL,
  generateSitemapFromDatabase,
  updateSitemapFileOnServer,
  downloadSitemapXmlFile,
  copySitemapToClipboard,
  validateSitemap,
  SitemapGenerationResult,
} from "../../utils/sitemapGenerator";

interface SitemapManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (type: "success" | "error", message: string) => void;
}

export const SitemapManagerModal: React.FC<SitemapManagerModalProps> = ({
  isOpen,
  onClose,
  onNotify,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<SitemapGenerationResult | null>(null);
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [copiedXml, setCopiedXml] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"overview" | "urls" | "raw">("overview");
  const [serverSyncMsg, setServerSyncMsg] = React.useState<string | null>(null);

  const sitemapSubmissionUrl = `${CANONICAL_SITE_URL}/sitemap.xml`;
  const gscSitemapsUrl = "https://search.google.com/search-console/sitemaps";

  const handleRefresh = async () => {
    setLoading(true);
    setServerSyncMsg(null);
    try {
      // 1. Generate XML sitemap from database
      const result = await generateSitemapFromDatabase();
      setData(result);

      // 2. Sync to physical server file
      const syncResult = await updateSitemapFileOnServer();
      if (syncResult.success) {
        setServerSyncMsg("Sitemap file updated successfully on server disk.");
        onNotify?.("success", `Sitemap updated! ${result.validPublishedArticles} published articles included.`);
      } else {
        setServerSyncMsg(syncResult.message);
      }
    } catch (err: any) {
      console.error("Failed to generate sitemap:", err);
      onNotify?.("error", err?.message || "Failed to generate sitemap.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      handleRefresh();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(sitemapSubmissionUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    onNotify?.("success", "Sitemap URL copied to clipboard!");
  };

  const handleCopyXml = async () => {
    if (!data?.xml) return;
    const ok = await copySitemapToClipboard(data.xml);
    if (ok) {
      setCopiedXml(true);
      setTimeout(() => setCopiedXml(false), 2000);
      onNotify?.("success", "Sitemap XML content copied to clipboard!");
    }
  };

  const handleDownload = () => {
    if (!data?.xml) return;
    downloadSitemapXmlFile(data.xml, "sitemap.xml");
    onNotify?.("success", "Downloaded sitemap.xml");
  };

  const validation = data ? validateSitemap(data.xml) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                XML Sitemap Manager
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                  Search Console Ready
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated sitemap file generator with strict draft exclusion and valid canonical URLs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Console Submission Banner */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b border-blue-100 dark:border-blue-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                Google Search Console Submission URL
              </div>
              <div className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300 truncate">
                {sitemapSubmissionUrl}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={handleCopyUrl}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedUrl ? "Copied" : "Copy URL"}
            </button>
            <a
              href={gscSitemapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open GSC
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-4 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
              activeTab === "overview"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Overview & Stats
          </button>
          <button
            onClick={() => setActiveTab("urls")}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
              activeTab === "urls"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Included URLs ({data?.entries?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("raw")}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
              activeTab === "raw"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Raw XML Preview
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Published Articles</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {data ? data.validPublishedArticles : "..."}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                    Included in XML
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Drafts Excluded</div>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {data ? data.draftsExcluded : "..."}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Strictly omitted
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Sitemap URLs</div>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                    {data ? data.entries.length : "..."}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    5 Static + Articles
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">XML Protocol</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <FileCheck2 className="w-4 h-4" /> 0.9 Standard
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Valid Schema
                  </div>
                </div>
              </div>

              {/* Validation Status Card */}
              {validation && (
                <div className={`p-4 rounded-2xl border ${validation.valid ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200" : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-200"}`}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {validation.valid ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                    {validation.valid ? "Sitemap Passes Search Console Validation Checks" : "Sitemap Validation Warnings"}
                  </div>
                  <p className="text-xs mt-1 text-slate-600 dark:text-slate-400">
                    {validation.valid
                      ? `All ${validation.urlCount} URLs are fully qualified, include W3C formatted lastmod dates, valid priority ratings, and strictly exclude unpublished drafts.`
                      : validation.errors.join(", ")}
                  </p>
                </div>
              )}

              {serverSyncMsg && (
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  ⚡ <strong>Server Sync Note:</strong> {serverSyncMsg}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Regenerating..." : "Regenerate & Update Sitemap"}
                </button>

                <button
                  onClick={handleDownload}
                  disabled={!data}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download sitemap.xml
                </button>

                <button
                  onClick={handleCopyXml}
                  disabled={!data}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
                >
                  {copiedXml ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiedXml ? "Copied XML" : "Copy XML"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "urls" && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Displaying all valid URLs included in <code>sitemap.xml</code>:
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                {data?.entries.map((entry, idx) => (
                  <div key={idx} className="p-3 text-xs flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-850">
                    <div className="min-w-0 flex-1">
                      <a
                        href={entry.loc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-600 dark:text-blue-400 hover:underline truncate block"
                      >
                        {entry.loc}
                      </a>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-slate-400">
                      {entry.lastmod && <span className="text-[11px] font-mono">{entry.lastmod}</span>}
                      {entry.priority !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          {entry.priority.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "raw" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Standard XML 0.9 output:</span>
                <button
                  onClick={handleCopyXml}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  {copiedXml ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedXml ? "Copied to clipboard" : "Copy full XML"}
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-96 border border-slate-800">
                <code>{data?.xml || "No XML generated yet."}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <FileCode className="w-3.5 h-3.5" />
            File: <code>public/sitemap.xml</code>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
