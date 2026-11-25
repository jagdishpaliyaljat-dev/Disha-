import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, Copy, Share2, Sparkles } from "lucide-react";
import { triggerHaptic } from "../utils/audioFeedback";
import { trackShareClick } from "../utils/analytics";

export interface ShareData {
  title: string;
  text?: string;
  url: string;
  category?: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ShareData;
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = data.url || (typeof window !== "undefined" ? window.location.href : "https://disha2020.in");
  const shareTitle = data.title || "Disha PYQ Exam Prep";
  const shareText = data.text ? `${data.text}\n\n` : "";
  const fullShareMessage = `${shareTitle}\n${shareText}Check it out here: ${shareUrl}`;

  // Copy to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      triggerHaptic("success");
      trackShareClick(shareUrl, "copy_link");
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn("Failed to copy link:", err);
    }
  };

  // Native Web Share API
  const handleNativeShare = async () => {
    triggerHaptic("light");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: data.text || shareTitle,
          url: shareUrl,
        });
        trackShareClick(shareUrl, "native_share");
        onClose();
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("Native share error:", err);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // Social Share Handlers
  const openShareLink = (url: string) => {
    triggerHaptic("light");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareToWhatsApp = () => {
    const waText = encodeURIComponent(`${shareTitle}\n\n${shareText}👉 ${shareUrl}`);
    trackShareClick(shareUrl, "whatsapp");
    openShareLink(`https://api.whatsapp.com/send?text=${waText}`);
  };

  const shareToTelegram = () => {
    const tgUrl = encodeURIComponent(shareUrl);
    const tgText = encodeURIComponent(`${shareTitle}\n${shareText}`);
    trackShareClick(shareUrl, "telegram");
    openShareLink(`https://t.me/share/url?url=${tgUrl}&text=${tgText}`);
  };

  const shareToTwitter = () => {
    const twText = encodeURIComponent(`${shareTitle} — Practice on Disha PYQ!`);
    const twUrl = encodeURIComponent(shareUrl);
    openShareLink(`https://twitter.com/intent/tweet?text=${twText}&url=${twUrl}`);
  };

  const shareToFacebook = () => {
    const fbUrl = encodeURIComponent(shareUrl);
    openShareLink(`https://www.facebook.com/sharer/sharer.php?u=${fbUrl}`);
  };

  const shareToLinkedIn = () => {
    const liUrl = encodeURIComponent(shareUrl);
    openShareLink(`https://www.linkedin.com/sharing/share-offsite/?url=${liUrl}`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-md bg-white dark:bg-[#1B1536] rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-slate-200 dark:border-[#31275E] overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-200 dark:border-[#31275E]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shadow-2xs">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-50 leading-tight">
                  Share on Social Media
                </h3>
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Share practice tests and performance with study partners
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            {/* Content Preview Box */}
            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E]">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#7045D8] dark:text-[#A78BFA] mb-1">
                <Sparkles className="w-3 h-3" />
                <span>{data.category || "Disha PYQ Practice"}</span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 leading-snug line-clamp-2 font-hindi">
                {shareTitle}
              </h4>
              {data.text && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 font-hindi">
                  {data.text}
                </p>
              )}
            </div>

            {/* 1-Tap Social Icons Grid */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 px-0.5">
                Choose Platform:
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                {/* 1. WhatsApp */}
                <button
                  onClick={shareToWhatsApp}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-all active:scale-95 cursor-pointer group"
                  title="Share to WhatsApp"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-md shadow-[#25D366]/30 group-hover:scale-105 transition-transform">
                    {/* Official WhatsApp SVG */}
                    <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
                      <path d="M12.031 2C6.495 2 2 6.495 2 12.031c0 1.908.536 3.731 1.554 5.305L2 22l4.821-1.523c1.516.945 3.272 1.455 5.21 1.455 5.536 0 10.031-4.495 10.031-10.031C22.062 6.495 17.567 2 12.031 2zm5.836 14.199c-.246.689-1.428 1.328-1.986 1.378-.507.045-1.164.064-3.712-.992-3.197-1.323-5.234-4.57-5.393-4.783-.159-.213-1.286-1.71-1.286-3.262 0-1.552.812-2.316 1.1-2.632.288-.316.629-.395.839-.395.21 0 .42.002.604.011.196.01.456-.074.713.542.268.643.913 2.227.992 2.389.079.162.132.352.026.565-.105.213-.158.345-.316.531-.158.186-.333.415-.476.557-.159.158-.324.329-.14.644.184.315.819 1.352 1.761 2.191 1.211 1.079 2.232 1.413 2.548 1.571.316.158.502.132.686-.079.184-.211.789-.921 1.001-1.236.211-.315.422-.263.71-.158.288.105 1.83.864 2.146 1.022.316.158.526.237.605.369.079.132.079.764-.167 1.453z"/>
                    </svg>
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                    WhatsApp
                  </span>
                </button>

                {/* 2. Telegram */}
                <button
                  onClick={shareToTelegram}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] transition-all active:scale-95 cursor-pointer group"
                  title="Share to Telegram"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#0088cc] text-white flex items-center justify-center shadow-md shadow-[#0088cc]/30 group-hover:scale-105 transition-transform">
                    {/* Official Telegram SVG */}
                    <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                    </svg>
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                    Telegram
                  </span>
                </button>

                {/* 3. Twitter / X */}
                <button
                  onClick={shareToTwitter}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-slate-900/10 hover:bg-slate-900/20 text-slate-900 dark:text-white transition-all active:scale-95 cursor-pointer group"
                  title="Share to Twitter / X"
                >
                  <div className="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center shadow-md shadow-black/20 group-hover:scale-105 transition-transform">
                    {/* Official X Logo SVG */}
                    <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                    X (Twitter)
                  </span>
                </button>

                {/* 4. Facebook */}
                <button
                  onClick={shareToFacebook}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] transition-all active:scale-95 cursor-pointer group"
                  title="Share to Facebook"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#1877F2] text-white flex items-center justify-center shadow-md shadow-[#1877F2]/30 group-hover:scale-105 transition-transform">
                    {/* Official Facebook SVG */}
                    <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                    Facebook
                  </span>
                </button>

                {/* 5. LinkedIn */}
                <button
                  onClick={shareToLinkedIn}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2] transition-all active:scale-95 cursor-pointer group"
                  title="Share to LinkedIn"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#0A66C2] text-white flex items-center justify-center shadow-md shadow-[#0A66C2]/30 group-hover:scale-105 transition-transform">
                    {/* Official LinkedIn SVG */}
                    <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0 0-3.28 1.64 1.64 0 0 0 0 3.28m1.4 9.74v-8.37H5.06v8.37h2.8z"/>
                    </svg>
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                    LinkedIn
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Copy Link Box */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block px-0.5">
                Direct Link:
              </label>
              <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  aria-label="Direct share URL"
                  className="flex-1 px-2.5 py-1 text-xs font-mono text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] rounded-lg select-all truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer shrink-0 ${
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-[#7045D8] hover:bg-[#5B32BF] dark:bg-[#7045D8] dark:hover:bg-[#5B32BF] text-white"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Native Device Share Action (Mobile Web Share Sheet) */}
            <div className="pt-2">
              <button
                onClick={handleNativeShare}
                className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-[#241D48] hover:border-[#7045D8] border border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-50 text-xs font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA]" />
                <span>More Sharing Options (Device Apps)</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ShareModal;
