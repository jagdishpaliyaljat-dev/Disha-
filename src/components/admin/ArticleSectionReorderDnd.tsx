import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Table as TableIcon,
  HelpCircle,
  Sparkles,
  BookOpen,
  Send,
  AlertCircle,
  CheckCircle2,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckSquare,
  Layers,
  Zap,
  RotateCcw
} from "lucide-react";
import { ArticleBlock } from "../../types";

export interface ArticleSectionReorderDndProps {
  blocks: ArticleBlock[];
  onReorderBlocks: (updatedBlocks: ArticleBlock[]) => void;
  onDeleteBlock: (index: number) => void;
  onUpdateBlockText: (index: number, newText: string) => void;
  onUpdateHeadingLevel?: (index: number, level: 1 | 2 | 3 | 4) => void;
}

export const ArticleSectionReorderDnd: React.FC<ArticleSectionReorderDndProps> = ({
  blocks,
  onReorderBlocks,
  onDeleteBlock,
  onUpdateBlockText,
  onUpdateHeadingLevel,
}) => {
  const [draggedIdx, setDraggedIdx] = React.useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = React.useState<number | null>(null);
  const [expandedIndices, setExpandedIndices] = React.useState<Record<number, boolean>>({});

  const toggleExpand = (idx: number) => {
    setExpandedIndices(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragLeave = () => {
    // Only clear if leaving the container
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const reordered = [...blocks];
    const item = reordered.splice(draggedIdx, 1)[0];
    reordered.splice(targetIndex, 0, item);

    onReorderBlocks(reordered);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // Up / Down Button Handlers
  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;

    const reordered = [...blocks];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    onReorderBlocks(reordered);
  };

  // Preset: Recommended SEO Section Flow
  const handleApplySeoPreset = () => {
    const typePriority: Record<string, number> = {
      intro: 1,
      key_points: 2,
      callout: 3,
      heading: 4,
      paragraph: 5,
      list: 6,
      table: 7,
      conclusion: 8,
      faq: 9,
      cta: 10
    };

    const sorted = [...blocks].sort((a, b) => {
      const pA = typePriority[a.type] ?? 50;
      const pB = typePriority[b.type] ?? 50;
      return pA - pB;
    });

    onReorderBlocks(sorted);
  };

  // Helper to get visual config for each section type
  const getSectionConfig = (block: ArticleBlock) => {
    switch (block.type) {
      case "intro":
        return {
          title: "Introduction & Hook",
          sub: "Opening lead paragraph and user hook",
          badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          icon: <BookOpen className="w-4 h-4 text-blue-600" />,
          border: "border-l-4 border-l-blue-600",
          cardBg: "bg-blue-50/20 dark:bg-blue-950/10",
        };
      case "key_points":
        return {
          title: "Key Points & Highlights",
          sub: `${block.listItems?.length || 0} Key Takeaways with Checkmarks`,
          badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          icon: <Sparkles className="w-4 h-4 text-amber-600" />,
          border: "border-l-4 border-l-amber-500",
          cardBg: "bg-amber-50/20 dark:bg-amber-950/10",
        };
      case "heading":
        return {
          title: `H${block.level || 2} Section Heading`,
          sub: block.text || "Heading Title",
          badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
          icon: <Layers className="w-4 h-4 text-indigo-600" />,
          border: "border-l-4 border-l-indigo-600",
          cardBg: "bg-indigo-50/20 dark:bg-indigo-950/10",
        };
      case "table":
        return {
          title: "Data Table Grid",
          sub: `${block.tableHeaders?.length || 0} Columns × ${block.tableRows?.length || 0} Rows`,
          badge: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
          icon: <TableIcon className="w-4 h-4 text-cyan-600" />,
          border: "border-l-4 border-l-cyan-600",
          cardBg: "bg-cyan-50/20 dark:bg-cyan-950/10",
        };
      case "conclusion":
        return {
          title: "Conclusion & Final Strategy",
          sub: "Article conclusion and summary takeaway",
          badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          icon: <CheckCircle2 className="w-4 h-4 text-purple-600" />,
          border: "border-l-4 border-l-purple-600",
          cardBg: "bg-purple-50/20 dark:bg-purple-950/10",
        };
      case "faq":
        return {
          title: "FAQ Accordion (Google FAQPage)",
          sub: `${block.faqs?.length || 0} Questions & Answers extracted`,
          badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          icon: <HelpCircle className="w-4 h-4 text-emerald-600" />,
          border: "border-l-4 border-l-emerald-600",
          cardBg: "bg-emerald-50/20 dark:bg-emerald-950/10",
        };
      case "cta":
        return {
          title: "Call to Action (CTA)",
          sub: block.ctaText || "DISHA 20-20 Test Series & Practice Quiz",
          badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          icon: <Send className="w-4 h-4 text-rose-600" />,
          border: "border-l-4 border-l-rose-600",
          cardBg: "bg-rose-50/20 dark:bg-rose-950/10",
        };
      case "callout":
        return {
          title: "Alert / Notice Callout",
          sub: block.text?.substring(0, 60) || "Notice box",
          badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
          icon: <AlertCircle className="w-4 h-4 text-amber-600" />,
          border: "border-l-4 border-l-amber-500",
          cardBg: "bg-amber-50/10 dark:bg-amber-950/5",
        };
      case "paragraph":
        return {
          title: "Paragraph Block",
          sub: block.text?.substring(0, 80) || "Explanatory text...",
          badge: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200",
          icon: <FileText className="w-4 h-4 text-slate-500" />,
          border: "border-l-4 border-l-slate-400",
          cardBg: "bg-white dark:bg-[#111A2E]",
        };
      default:
        return {
          title: `${block.type.toUpperCase()} Section`,
          sub: block.text?.substring(0, 60) || "",
          badge: "bg-slate-100 dark:bg-slate-800 text-slate-600 border-slate-200",
          icon: <Sliders className="w-4 h-4 text-slate-500" />,
          border: "border-l-4 border-l-slate-400",
          cardBg: "bg-white dark:bg-[#111A2E]",
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <GripVertical className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>Section Drag-and-Drop Sequencing</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black">
                {blocks.length} Sections
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Drag sections by the grip handle or use up/down buttons to reorder
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleApplySeoPreset}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Apply Standard SEO Order</span>
        </button>
      </div>

      {/* Draggable Section List */}
      <div className="space-y-2.5">
        {blocks.map((block, index) => {
          const cfg = getSectionConfig(block);
          const isExpanded = !!expandedIndices[index];
          const isDragging = draggedIdx === index;
          const isOver = dragOverIdx === index;

          return (
            <div
              key={block.id || index}
              draggable
              onDragStart={e => handleDragStart(e, index)}
              onDragOver={e => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, index)}
              className={`rounded-2xl border transition-all ${cfg.cardBg} ${cfg.border} ${
                isDragging
                  ? "opacity-30 border-dashed border-indigo-500 scale-98"
                  : isOver
                  ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/30"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
              }`}
            >
              {/* Section Header Row */}
              <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                {/* Drag Handle & Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    title="Drag to reorder section"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-black shrink-0 font-mono">
                    {index + 1}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${cfg.badge}`}>
                      {cfg.icon}
                      <span>{cfg.title}</span>
                    </span>
                  </div>

                  {/* Summary preview snippet */}
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate hidden md:inline">
                    {cfg.sub}
                  </span>
                </div>

                {/* Right Reorder and Expand Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-20 cursor-pointer"
                    title="Move section up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMove(index, "down")}
                    disabled={index === blocks.length - 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-20 cursor-pointer"
                    title="Move section down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpand(index)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title={isExpanded ? "Collapse preview" : "Expand preview"}
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteBlock(index)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="Delete section"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expandable Content Preview / Edit Form */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 overflow-hidden"
                  >
                    {block.type === "heading" && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-black uppercase text-slate-400">Heading Level:</label>
                          <select
                            value={block.level || 2}
                            onChange={e => onUpdateHeadingLevel?.(index, Number(e.target.value) as 1 | 2 | 3 | 4)}
                            className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700"
                          >
                            <option value={1}>H1 Main Title</option>
                            <option value={2}>H2 Major Section</option>
                            <option value={3}>H3 Sub-section</option>
                            <option value={4}>H4 Minor Heading</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          value={block.text || ""}
                          onChange={e => onUpdateBlockText(index, e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-900 dark:text-white"
                        />
                      </div>
                    )}

                    {block.type === "intro" && (
                      <div className="space-y-1.5 pt-2">
                        <label className="text-[10px] font-black uppercase text-blue-600">Introduction Hook Text:</label>
                        <textarea
                          rows={3}
                          value={block.text || ""}
                          onChange={e => onUpdateBlockText(index, e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white resize-y"
                        />
                      </div>
                    )}

                    {block.type === "conclusion" && (
                      <div className="space-y-1.5 pt-2">
                        <label className="text-[10px] font-black uppercase text-purple-600">Conclusion & Takeaways:</label>
                        <textarea
                          rows={3}
                          value={block.text || ""}
                          onChange={e => onUpdateBlockText(index, e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white resize-y"
                        />
                      </div>
                    )}

                    {block.type === "paragraph" && (
                      <div className="space-y-1.5 pt-2">
                        <label className="text-[10px] font-black uppercase text-slate-400">Paragraph Content:</label>
                        <textarea
                          rows={3}
                          value={block.text || ""}
                          onChange={e => onUpdateBlockText(index, e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white resize-y"
                        />
                      </div>
                    )}

                    {block.type === "key_points" && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-black uppercase text-amber-600">Takeaway Bullet Points:</label>
                        <ul className="space-y-1.5 pl-4 list-disc text-xs text-slate-800 dark:text-slate-200">
                          {block.listItems?.map((li, i) => (
                            <li key={i}>{li}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {block.type === "table" && (
                      <div className="space-y-2 pt-2 overflow-x-auto">
                        <label className="text-[10px] font-black uppercase text-cyan-600">Table Structure:</label>
                        <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                          {block.tableHeaders && (
                            <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                              <tr>
                                {block.tableHeaders.map((h, i) => (
                                  <th key={i} className="p-2 border-b border-slate-200 dark:border-slate-700">{h}</th>
                                ))}
                              </tr>
                            </thead>
                          )}
                          <tbody>
                            {block.tableRows?.slice(0, 4).map((r, ri) => (
                              <tr key={ri} className="border-b border-slate-100 dark:border-slate-800">
                                {r.cells.map((c, ci) => (
                                  <td key={ci} className="p-2 text-slate-700 dark:text-slate-300">{c}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {block.type === "faq" && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-black uppercase text-emerald-600">FAQ Question Items:</label>
                        <div className="space-y-1.5">
                          {block.faqs?.map((f, fi) => (
                            <div key={fi} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                              <p className="font-bold text-slate-900 dark:text-white">Q: {f.question}</p>
                              <p className="text-slate-600 dark:text-slate-400 mt-0.5">A: {f.answer}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {block.type === "cta" && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-black uppercase text-rose-600">Call to Action Configuration:</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={block.ctaText || ""}
                            onChange={e => onUpdateBlockText(index, e.target.value)}
                            placeholder="CTA Button Text"
                            className="flex-1 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                          />
                          <input
                            type="text"
                            value={block.ctaUrl || ""}
                            placeholder="/live_tests"
                            className="w-full sm:w-48 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
