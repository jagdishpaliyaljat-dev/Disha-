import * as React from "react";
import { FileDown, Upload, Link, CheckCircle2, Download, Trash2, FileText } from "lucide-react";
import { ArticleBlock } from "../../types";

interface PdfBlockEditorProps {
  block: ArticleBlock;
  onChange: (updated: ArticleBlock) => void;
}

export const PdfBlockEditor: React.FC<PdfBlockEditorProps> = ({ block, onChange }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    const sizeLabel = `${sizeInMb} MB • PDF`;

    // Auto-fill title if currently default or empty
    const currentTitle = block.pdfTitle || "";
    const cleanFileName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    const nextTitle = !currentTitle || currentTitle === "Download Official PDF Document" || currentTitle === "Official Exam Syllabus & Detailed Guidelines PDF"
      ? cleanFileName
      : currentTitle;

    const reader = new FileReader();
    reader.onload = () => {
      const resultDataUrl = reader.result as string;
      onChange({
        ...block,
        pdfTitle: nextTitle,
        pdfUrl: resultDataUrl,
        pdfFileSize: sizeLabel,
        pdfBadge: block.pdfBadge || "Official PDF",
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <FileDown className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              PDF Document / Syllabus Block
            </h4>
            <p className="text-[10px] text-slate-500">
              Upload a local PDF file or paste an external download link for students.
            </p>
          </div>
        </div>
        {block.pdfUrl && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> Ready
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* PDF Title */}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            PDF Document Title (Hindi or English)
          </label>
          <input
            type="text"
            value={block.pdfTitle || ""}
            onChange={(e) => onChange({ ...block, pdfTitle: e.target.value })}
            placeholder="e.g. Rajasthan CET 2026 Official Syllabus & Pattern PDF"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white font-hindi"
          />
        </div>

        {/* PDF URL or Upload */}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>PDF File Link (Cloud URL or Upload from Computer)</span>
            <span className="text-[9.5px] text-blue-600 dark:text-blue-400">Supports Google Drive, Telegram, Direct Links</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={block.pdfUrl || ""}
              onChange={(e) => onChange({ ...block, pdfUrl: e.target.value })}
              placeholder="https://drive.google.com/... or https://rpsc.rajasthan.gov.in/...pdf"
              className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Choose PDF File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Badge & Size */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Badge Label
          </label>
          <input
            type="text"
            value={block.pdfBadge || "Official PDF"}
            onChange={(e) => onChange({ ...block, pdfBadge: e.target.value })}
            placeholder="Official PDF, Handwritten Notes, Answer Key..."
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            File Size / Pages
          </label>
          <input
            type="text"
            value={block.pdfFileSize || "2.4 MB • PDF"}
            onChange={(e) => onChange({ ...block, pdfFileSize: e.target.value })}
            placeholder="e.g. 2.4 MB • 18 Pages"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
          />
        </div>

        {/* Description / Instructions */}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Short Description / Note for Students
          </label>
          <textarea
            rows={2}
            value={block.pdfDescription || ""}
            onChange={(e) => onChange({ ...block, pdfDescription: e.target.value })}
            placeholder="e.g. Detailed subject-wise syllabus and marking scheme issued by the commission."
            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white font-hindi"
          />
        </div>

        {/* Button Text */}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Button Label Text
          </label>
          <input
            type="text"
            value={block.pdfButtonText || "Download PDF Now"}
            onChange={(e) => onChange({ ...block, pdfButtonText: e.target.value })}
            placeholder="Download PDF Now, View Official Notice, Open Syllabus..."
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white font-hindi"
          />
        </div>
      </div>

      {/* Live Card Preview Inside Editor */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Live Card Preview (As Seen by Students)
        </span>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/70 via-red-50/40 to-slate-50 dark:from-rose-950/20 dark:to-slate-900 border border-rose-200/80 dark:border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white">
                  {block.pdfBadge || "Official PDF"}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  {block.pdfFileSize || "PDF Document"}
                </span>
              </div>
              <h5 className="text-sm font-black text-slate-900 dark:text-white mt-1 font-hindi">
                {block.pdfTitle || "PDF Document Title"}
              </h5>
              {block.pdfDescription && (
                <p className="text-xs text-slate-600 dark:text-slate-300 font-hindi mt-0.5 max-w-md">
                  {block.pdfDescription}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shrink-0 flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{block.pdfButtonText || "Download PDF Now"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
