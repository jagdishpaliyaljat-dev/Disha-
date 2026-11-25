import React, { useState, useEffect, useRef } from "react";
import { Bookmark, Trash2, X, Check } from "lucide-react";
import { BookmarkReasonTag } from "../types";
import { BOOKMARK_REASON_TAGS, getBookmarkTagMeta } from "../utils/bookmarkTags";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";

interface SmartBookmarkButtonProps {
  questionId: string;
  isBookmarked: boolean;
  currentTag?: BookmarkReasonTag;
  onToggleBookmark: (questionId: string, tag?: BookmarkReasonTag | null) => void;
  size?: "sm" | "md";
  align?: "left" | "right";
  className?: string;
}

/**
 * Smart Bookmark button with a lightweight, non-blocking "मैंने इसे सेव क्यों किया?" reason tag picker.
 */
export const SmartBookmarkButton: React.FC<SmartBookmarkButtonProps> = ({
  questionId,
  isBookmarked,
  currentTag,
  onToggleBookmark,
  size = "sm",
  align = "right",
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeMeta = isBookmarked ? getBookmarkTagMeta(currentTag) : null;

  // Close popover when switching questions
  useEffect(() => {
    setIsOpen(false);
  }, [questionId]);

  // Outside click / Escape dismissal
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Auto-dismiss after 6 seconds if untouched after newly bookmarking
  useEffect(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    if (isOpen) {
      autoCloseTimerRef.current = setTimeout(() => {
        setIsOpen(false);
      }, 6000);
    }
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, [isOpen]);

  const handleMainClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("light");
    playClickSound();

    if (!isBookmarked) {
      // Save bookmark immediately, then offer optional reason tag
      onToggleBookmark(questionId);
      setIsOpen(true);
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  const handleSelectTag = (tagId: BookmarkReasonTag, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("medium");
    playClickSound();
    if (currentTag === tagId && isBookmarked) {
      onToggleBookmark(questionId, null);
    } else {
      onToggleBookmark(questionId, tagId);
    }
    setIsOpen(false);
  };

  const handleRemoveBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("light");
    playClickSound();
    if (isBookmarked) {
      onToggleBookmark(questionId);
    }
    setIsOpen(false);
  };

  const btnSizeClass =
    size === "md"
      ? "w-11 h-11 rounded-xl"
      : "w-10 h-10 rounded-xl";

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleMainClick}
        title={
          isBookmarked
            ? activeMeta
              ? `Saved: ${activeMeta.shortLabel} (Tap to change tag or remove)`
              : "Bookmarked (Tap to add reason tag or remove)"
            : "Bookmark Question"
        }
        aria-label={isBookmarked ? "Manage Bookmark Tag" : "Bookmark Question"}
        aria-expanded={isOpen}
        className={
          className ||
          `${btnSizeClass} border flex items-center justify-center transition-all active:scale-90 cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${
            isBookmarked
              ? "bg-[#7045D8] border-[#7045D8] text-white shadow-md shadow-[#7045D8]/25"
              : "bg-white dark:bg-[#241D48] border-slate-200 dark:border-[#31275E] text-slate-600 dark:text-slate-300"
          }`
        }
      >
        <Bookmark className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isBookmarked ? "fill-current" : ""}`} />
        {activeMeta && (
          <span
            className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-white dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] text-[11px] leading-none flex items-center justify-center shadow-xs pointer-events-none"
            aria-hidden="true"
          >
            {activeMeta.emoji}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full mt-2 z-50 w-64 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] shadow-xl p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150 ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA]">
              Bookmark Reason Tag
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              aria-label="Close bookmark tags"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {BOOKMARK_REASON_TAGS.map((tag) => {
              const isSelected = isBookmarked && currentTag === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={(e) => handleSelectTag(tag.id, e)}
                  className={`w-full min-h-[42px] text-left px-2.5 py-2 rounded-xl border text-xs transition-all flex items-center justify-between gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${
                    isSelected
                      ? tag.activeButtonClass
                      : "bg-slate-50 dark:bg-[#130E26] border-slate-200 dark:border-[#31275E] text-slate-800 dark:text-slate-100 hover:border-[#7045D8]/50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-black leading-tight truncate">{tag.shortLabel}</div>
                    <div
                      className={`text-[11px] truncate mt-0.5 ${
                        isSelected ? "text-white/85" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {tag.description}
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>

          {isBookmarked && (
            <button
              type="button"
              onClick={handleRemoveBookmark}
              className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Bookmark</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
