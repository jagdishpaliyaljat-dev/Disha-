import React, { useState, useEffect } from "react";
import {
  FileText,
  Save,
  RefreshCw,
  ShieldCheck,
  Printer,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Download,
  Type,
} from "lucide-react";
import {
  AdminPDFConfig,
  DEFAULT_PDF_CONFIG,
  PDFAccessTier,
  usePdfConfig,
  savePDFConfigToCloud,
} from "../../utils/pdfConfigService";
import { triggerAdminToast } from "../../utils/adminToast";

interface AdminPDFControlSectionProps {
  adminEmail?: string;
}

export const AdminPDFControlSection: React.FC<AdminPDFControlSectionProps> = ({
  adminEmail = "admin",
}) => {
  const { config, refresh, isLoading } = usePdfConfig();
  const [draft, setDraft] = useState<AdminPDFConfig>(config);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    const res = await savePDFConfigToCloud(draft, adminEmail);
    setSaving(false);
    if (res.success) {
      triggerAdminToast("success", "PDF Settings Saved", "All student PDF download controls updated.");
    } else {
      triggerAdminToast("warning", "Saved Locally", res.error || "Saved locally; cloud sync pending.");
    }
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_PDF_CONFIG, updatedAt: new Date().toISOString(), updatedBy: adminEmail });
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#31275E] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              PDF Download Controls
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Control student access, question limits, formats, print permission &amp; PDF watermark.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving..." : "Save Controls"}</span>
          </button>
        </div>
      </div>

      {/* 1. Master Toggle & Access Tier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#31275E] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA]" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Master Availability
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                draft.enabled
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
              }`}
            >
              {draft.enabled ? "Enabled (ON)" : "Disabled (OFF)"}
            </button>
          </div>

          {!draft.enabled && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Message Shown When Disabled
              </label>
              <input
                type="text"
                value={draft.disabledMessage}
                onChange={(e) => setDraft((d) => ({ ...d, disabledMessage: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
              />
            </div>
          )}

          <div className="space-y-2 pt-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#7045D8]" />
              <span>Who Can Download PDFs?</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "free_all", label: "Free for All" },
                { id: "login_required", label: "Login Only" },
                { id: "vip_only", label: "VIP Only" },
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, accessTier: tier.id as PDFAccessTier }))}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    draft.accessTier === tier.id
                      ? "bg-[#7045D8] text-white border-[#7045D8] shadow-xs"
                      : "bg-[#F8FAFC] dark:bg-[#241D48] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#31275E]"
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Limits & Quotas */}
        <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#31275E] space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA]" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Free User Quotas &amp; Limits
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Max Questions / PDF (0 = Unlimited)
              </label>
              <select
                value={draft.maxQuestionsFree}
                onChange={(e) => setDraft((d) => ({ ...d, maxQuestionsFree: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
              >
                <option value={0}>Unlimited</option>
                <option value={15}>15 Questions</option>
                <option value={25}>25 Questions</option>
                <option value={50}>50 Questions</option>
                <option value={100}>100 Questions</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Daily PDFs Limit (0 = Unlimited)
              </label>
              <select
                value={draft.dailyQuotaFree}
                onChange={(e) => setDraft((d) => ({ ...d, dailyQuotaFree: Number(e.target.value) }))}
                className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
              >
                <option value={0}>Unlimited</option>
                <option value={1}>1 PDF / day</option>
                <option value={2}>2 PDFs / day</option>
                <option value={3}>3 PDFs / day</option>
                <option value={5}>5 PDFs / day</option>
                <option value={10}>10 PDFs / day</option>
              </select>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            VIP / Premium users bypass free-tier limits automatically.
          </p>
        </div>
      </div>

      {/* 3. Allowed Formats & Branding */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#31275E] space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA]" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Allowed Formats &amp; Actions
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: "question_paper", label: "Question Paper" },
              { key: "question_paper_omr", label: "Paper + OMR Sheet" },
              { key: "answer_key", label: "Answer Key" },
              { key: "detailed_solutions", label: "Detailed Solutions" },
            ].map((item) => {
              const k = item.key as keyof AdminPDFConfig["allowedFormats"];
              return (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] cursor-pointer"
                >
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={draft.allowedFormats[k]}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        allowedFormats: { ...d.allowedFormats, [k]: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 accent-[#7045D8] rounded cursor-pointer"
                  />
                </label>
              );
            })}

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] cursor-pointer">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Allow Print / New Tab</span>
              <input
                type="checkbox"
                checked={draft.allowPrint}
                onChange={(e) => setDraft((d) => ({ ...d, allowPrint: e.target.checked }))}
                className="w-4 h-4 accent-[#7045D8] rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] cursor-pointer">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Allow JSON Export</span>
              <input
                type="checkbox"
                checked={draft.allowJsonExport}
                onChange={(e) => setDraft((d) => ({ ...d, allowJsonExport: e.target.checked }))}
                className="w-4 h-4 accent-[#7045D8] rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* 4. Branding & Watermark */}
        <div className="bg-white dark:bg-[#1B1536] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#31275E] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA]" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                PDF Branding &amp; Watermark
              </h4>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.forceBranding}
                onChange={(e) => setDraft((d) => ({ ...d, forceBranding: e.target.checked }))}
                className="w-4 h-4 accent-[#7045D8] rounded cursor-pointer"
              />
              <span>Force Header/Footer</span>
            </label>
          </div>

          <div className="space-y-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Custom PDF Header Title
              </label>
              <input
                type="text"
                value={draft.brandTitle}
                onChange={(e) => setDraft((d) => ({ ...d, brandTitle: e.target.value }))}
                placeholder="Disha PYQ — Rajasthan Exam Prep"
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Footer Watermark Text
              </label>
              <input
                type="text"
                value={draft.watermarkText}
                onChange={(e) => setDraft((d) => ({ ...d, watermarkText: e.target.value }))}
                placeholder="Downloaded from Disha PYQ App"
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
              />
            </div>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-bold text-slate-500 hover:text-[#7045D8] dark:text-slate-400 cursor-pointer"
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
