import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  X,
  FileText,
  BookOpen,
  HelpCircle,
  Zap,
  ArrowRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { fastSearchEngine, SearchResultItem } from "../utils/ultraFastSearchEngine";
import { Question, Topic, PYQPaper } from "../types";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuestion?: (q: Question) => void;
  onSelectTopic?: (t: Topic) => void;
  onSelectPaper?: (p: PYQPaper) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectQuestion,
  onSelectTopic,
  onSelectPaper,
}) => {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "question" | "topic" | "paper">("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [latency, setLatency] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize or re-index when modal opens
  useEffect(() => {
    if (isOpen) {
      if (!fastSearchEngine.isReady()) {
        fastSearchEngine.buildIndex();
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  // Execute fast search on query or filter change
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLatency(0);
      return;
    }

    const { results: res, latencyMs } = fastSearchEngine.search(
      query,
      activeFilter === "all" ? undefined : activeFilter,
      30
    );
    setResults(res);
    setLatency(latencyMs);
    setSelectedIndex(0);
  }, [query, activeFilter]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          results.length > 0 ? (prev - 1 + results.length) % results.length : 0
        );
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  if (!isOpen) return null;

  const handleSelect = (item: SearchResultItem) => {
    onClose();
    if (item.type === "question" && onSelectQuestion) {
      onSelectQuestion(item.rawItem);
    } else if (item.type === "topic" && onSelectTopic) {
      onSelectTopic(item.rawItem);
    } else if (item.type === "paper" && onSelectPaper) {
      onSelectPaper(item.rawItem);
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "question":
        return <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "topic":
        return <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "paper":
        return <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 sm:pt-16 animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-[#1E2230] rounded-2xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E8D9C0] dark:border-[#31374A] bg-[#FFFDF9] dark:bg-[#252A3A]">
          <Search className="w-5 h-5 text-[#800020] dark:text-[#E8D9C0] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="खोजें: प्रश्न, विषय, 1857 क्रांति, राजस्थान भूगोल, PYQ..."
            className="flex-1 bg-transparent border-none outline-none text-sm sm:text-base font-semibold text-[#171923] dark:text-white placeholder-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#F7EFE2] dark:bg-[#31374A] text-[#171923] dark:text-[#FFF9EF] hover:opacity-80 shrink-0"
          >
            Esc
          </button>
        </div>

        {/* Filter Pills & Metric Info */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#E8D9C0]/50 dark:border-[#31374A]/50 bg-white/50 dark:bg-[#1E2230]/50 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {[
              { id: "all", label: "सभी (All)" },
              { id: "question", label: "प्रश्न (MCQs)" },
              { id: "topic", label: "विषय (Topics)" },
              { id: "paper", label: "पेपर्स (PYQs)" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeFilter === f.id
                    ? "bg-[#800020] text-white shadow-sm"
                    : "bg-[#F7EFE2] dark:bg-[#252A3A] text-slate-600 dark:text-slate-300 hover:bg-[#E8D9C0]/70"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {query.trim() && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 pl-2">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>
                {latency}ms • {results.length} परिणाम
              </span>
            </div>
          )}
        </div>

        {/* Search Results List */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
          {query.trim() && results.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 dark:text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">कोई परिणाम नहीं मिला</p>
              <p className="text-xs mt-1">अन्य कीवर्ड से खोजें या स्पेलिंग जांचें</p>
            </div>
          ) : !query.trim() ? (
            <div className="py-8 px-4 text-center">
              <Sparkles className="w-8 h-8 text-[#800020] dark:text-amber-400 mx-auto mb-2 opacity-60" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                अल्ट्रा-फास्ट सर्च इंजन (10,000+ MCQs & Topics)
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                राजस्थान इतिहास, भूगोल, कला-संस्कृति, राजव्यवस्था या किसी भी परीक्षा प्रश्न को तुरंत खोजें।
              </p>
            </div>
          ) : (
            results.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-3 rounded-xl cursor-pointer transition-all flex items-start gap-3 select-none ${
                  selectedIndex === idx
                    ? "bg-[#FFF9EF] dark:bg-[#2A3042] border border-[#E8D9C0] dark:border-[#3D445A]"
                    : "hover:bg-slate-50 dark:hover:bg-[#252A3A]"
                }`}
              >
                <div className="p-2 rounded-xl bg-white dark:bg-[#1E2230] shadow-sm border border-slate-200/50 dark:border-slate-700/50 shrink-0 mt-0.5">
                  {getItemIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {item.type}
                    </span>
                    {item.subtitle && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                        {item.subtitle}
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                    {item.title}
                  </h4>

                  {item.snippet && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 font-normal">
                      {item.snippet}
                    </p>
                  )}
                </div>

                <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 self-center" />
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 border-t border-[#E8D9C0]/50 dark:border-[#31374A]/50 bg-[#FFFDF9] dark:bg-[#252A3A] text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>↑↓ नेविगेट</span>
            <span>↵ चयन करें</span>
            <span>Esc बंद करें</span>
          </div>
          <span className="font-semibold text-[#800020] dark:text-[#E8D9C0]">DISHA 20-20 FastSearch</span>
        </div>
      </div>
    </div>
  );
};
