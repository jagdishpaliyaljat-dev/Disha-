import React, { useState } from "react";
import { FileText, Maximize2, Minimize2, RefreshCw, X, Shield, BookOpen } from "lucide-react";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";

export function normalizeInAppPdfUrl(url?: string): string | null {
  if (!url) return null;
  const clean = url.trim();

  // 1. Google Drive direct /file/d/ID/view or /preview
  const driveMatch = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  // 2. Google Drive open?id=ID
  const driveOpenMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (clean.includes("drive.google.com") && driveOpenMatch && driveOpenMatch[1]) {
    return `https://drive.google.com/file/d/${driveOpenMatch[1]}/preview`;
  }

  // 3. Direct PDF URLs or Cloud storage URLs -> use Google Docs embedded viewer for 100% mobile in-app compatibility
  if (clean.toLowerCase().endsWith(".pdf") || clean.includes(".pdf?")) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(clean)}&embedded=true`;
  }

  // If already preview or embed link
  if (clean.includes("preview") || clean.includes("embedded=true")) {
    return clean;
  }

  // Fallback to embedded viewer
  return `https://docs.google.com/viewer?url=${encodeURIComponent(clean)}&embedded=true`;
}

interface InAppPdfViewerProps {
  pdfUrl?: string;
  title?: string;
  subjectName?: string;
  chapterName?: string;
}

export const InAppPdfViewer: React.FC<InAppPdfViewerProps> = ({
  pdfUrl,
  title = "हस्तलिखित नोट्स व अध्ययन सामग्री",
  subjectName,
  chapterName,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0); // For reloading iframe
  const [isLoading, setIsLoading] = useState(true);

  const previewUrl = normalizeInAppPdfUrl(pdfUrl);

  if (!previewUrl) return null;

  const handleToggleFullscreen = () => {
    triggerHaptic("medium");
    playClickSound();
    setIsFullscreen(!isFullscreen);
  };

  const handleReload = () => {
    triggerHaptic("light");
    setIsLoading(true);
    setKey((prev) => prev + 1);
  };

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. IN-PAGE EMBEDDED MOBILE-FRIENDLY VIEWER
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-white dark:bg-[#1E2230] rounded-2xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="px-4 py-3 bg-[#FAF5EB] dark:bg-[#262B3D] border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
                {title}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-emerald-600" />
                <span>सुरक्षित इन-ऐप अध्ययन मोड</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleReload}
              className="p-1.5 rounded-lg bg-white dark:bg-[#1E2230] text-slate-600 dark:text-slate-300 border border-[#E8D9C0] dark:border-[#31374A] hover:bg-slate-100 dark:hover:bg-[#2C3246] transition-all cursor-pointer"
              title="पुनः लोड करें"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="px-2.5 py-1.5 rounded-xl bg-[#800020] text-white hover:bg-[#600018] dark:bg-[#F47B20] text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              title="फुलस्क्रीन में पढ़ें"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">फुलस्क्रीन</span>
            </button>
          </div>
        </div>

        {/* Iframe Viewport Container */}
        <div className="relative w-full h-[520px] sm:h-[620px] bg-[#FAF5EB] dark:bg-[#171923] overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#FAF5EB]/90 dark:bg-[#171923]/90">
              <RefreshCw className="w-6 h-6 animate-spin text-[#800020] dark:text-[#F47B20]" />
              <p className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">PDF नोट्स लोड हो रहे हैं...</p>
            </div>
          )}

          <iframe
            key={key}
            src={previewUrl}
            title={title}
            onLoad={() => setIsLoading(false)}
            className="w-full h-full border-0"
            allow="autoplay"
          />
        </div>

        {/* Bottom Helper Bar */}
        <div className="px-4 py-2 bg-[#FAF5EB]/60 dark:bg-[#1E2230] border-t border-[#E8D9C0]/50 dark:border-[#31374A]/50 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-hindi">
            नोट: आप दोनों उंगलियों (Pinch) से ज़ूम इन / ज़ूम आउट कर सकते हैं।
          </span>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="text-[#800020] dark:text-[#F47B20] font-bold hover:underline cursor-pointer"
          >
            बड़ी स्क्रीन पर खोलें
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. 100% IN-APP FULLSCREEN IMMERSIVE READER MODAL
          ───────────────────────────────────────────────────────────── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[150] bg-[#171923] flex flex-col animate-in fade-in duration-200">
          {/* Immersive Top Bar */}
          <div className="px-4 py-3 bg-[#1F2330] border-b border-[#31374A] flex items-center justify-between text-white shadow-md shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer active:scale-95 transition-all"
                title="वापस जाएं"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] text-[#F47B20] font-bold uppercase tracking-wider truncate">
                  {subjectName} {chapterName ? `· ${chapterName}` : ""}
                </p>
                <h2 className="text-sm font-extrabold truncate font-hindi">
                  {title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleReload}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-all"
                title="रिफ्रेश करें"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="p-2 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-white cursor-pointer transition-all"
                title="बंद करें"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Full Screen Iframe */}
          <div className="relative flex-1 w-full bg-[#12151E] overflow-hidden">
            <iframe
              key={`fs-${key}`}
              src={previewUrl}
              title={title}
              className="w-full h-full border-0"
              allow="autoplay"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default InAppPdfViewer;
