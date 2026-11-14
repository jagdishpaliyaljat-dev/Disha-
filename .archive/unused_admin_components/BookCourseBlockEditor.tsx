import * as React from "react";
import {
  GraduationCap,
  BookOpen,
  ShoppingBag,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { ArticleBlock } from "../../types";

interface BookCourseBlockEditorProps {
  block: ArticleBlock;
  onChange: (updated: ArticleBlock) => void;
}

export const BookCourseBlockEditor: React.FC<BookCourseBlockEditorProps> = ({ block, onChange }) => {
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onChange({
        ...block,
        itemImageUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddFeature = () => {
    const current = block.itemFeatures || [];
    onChange({
      ...block,
      itemFeatures: [...current, "New Highlight or Benefit"],
    });
  };

  const handleUpdateFeature = (idx: number, val: string) => {
    const current = [...(block.itemFeatures || [])];
    current[idx] = val;
    onChange({
      ...block,
      itemFeatures: current,
    });
  };

  const handleRemoveFeature = (idx: number) => {
    const current = [...(block.itemFeatures || [])].filter((_, i) => i !== idx);
    onChange({
      ...block,
      itemFeatures: current,
    });
  };

  const itemType = block.itemType || "book";

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Book &amp; Course Recommendation Card
            </h4>
            <p className="text-[10px] text-slate-500">
              Promote recommended books, online batches, or study material with purchase / enrollment links.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Resource Type */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Resource Type
          </label>
          <select
            value={itemType}
            onChange={(e) =>
              onChange({
                ...block,
                itemType: e.target.value as any,
                itemButtonText:
                  e.target.value === "book"
                    ? "Buy Book / Order Now"
                    : e.target.value === "course"
                    ? "Enroll in Course"
                    : "View Details",
              })
            }
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="book">Book</option>
            <option value="course">Online Course</option>
            <option value="test_series">Test Series</option>
            <option value="notes">Study Notes</option>
          </select>
        </div>

        {/* Title */}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Book / Course Title
          </label>
          <input
            type="text"
            value={block.itemTitle || ""}
            onChange={(e) => onChange({ ...block, itemTitle: e.target.value })}
            placeholder="e.g. Rajasthan CET Complete Guide Book 2026"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white font-hindi"
          />
        </div>

        {/* Subtitle / Author */}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Author / Faculty / Publisher Subtitle
          </label>
          <input
            type="text"
            value={block.itemSubtitle || ""}
            onChange={(e) => onChange({ ...block, itemSubtitle: e.target.value })}
            placeholder="e.g. By Senior Exam Experts • 1,500+ Practice MCQs included"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white font-hindi"
          />
        </div>

        {/* Badge */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Badge Tag
          </label>
          <input
            type="text"
            value={block.itemBadge || "Top Recommended"}
            onChange={(e) => onChange({ ...block, itemBadge: e.target.value })}
            placeholder="Top Recommended, Bestseller, Free Access..."
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
          />
        </div>

        {/* Target URL */}
        <div className="space-y-1 sm:col-span-3">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Purchase / Course Link (Amazon, FlipKart, Course Portal, App Link)
          </label>
          <input
            type="text"
            value={block.itemUrl || ""}
            onChange={(e) => onChange({ ...block, itemUrl: e.target.value })}
            placeholder="https://amazon.in/... or https://yourcourseapp.com/batch/cet-2026"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
          />
        </div>

        {/* Cover Image URL & File Upload */}
        <div className="space-y-1 sm:col-span-3">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Book / Course Thumbnail Cover (Image URL or Upload from Device)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={block.itemImageUrl || ""}
              onChange={(e) => onChange({ ...block, itemImageUrl: e.target.value })}
              placeholder="https://images.unsplash.com/... or data:image/..."
              className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Image</span>
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Offer / Current Price
          </label>
          <input
            type="text"
            value={block.itemPrice || "₹349"}
            onChange={(e) => onChange({ ...block, itemPrice: e.target.value })}
            placeholder="e.g. ₹349 or Free"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Original Price (MRP)
          </label>
          <input
            type="text"
            value={block.itemOriginalPrice || "₹599"}
            onChange={(e) => onChange({ ...block, itemOriginalPrice: e.target.value })}
            placeholder="e.g. ₹599"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-500 line-through"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Button Label Text
          </label>
          <input
            type="text"
            value={block.itemButtonText || "Buy Now / View Details"}
            onChange={(e) => onChange({ ...block, itemButtonText: e.target.value })}
            placeholder="Buy on Amazon, Enroll in Course, Get Book..."
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white font-hindi"
          />
        </div>

        {/* Features / Highlights */}
        <div className="space-y-2 sm:col-span-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
              Key Features &amp; Highlights (Bullet Points)
            </label>
            <button
              type="button"
              onClick={handleAddFeature}
              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add Feature Point
            </button>
          </div>
          <div className="space-y-2">
            {(block.itemFeatures || []).map((feat, fIdx) => (
              <div key={fIdx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={feat}
                  onChange={(e) => handleUpdateFeature(fIdx, e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white font-hindi"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveFeature(fIdx)}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  title="Remove Feature"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Preview Card */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Live Card Preview (As Seen by Students)
        </span>
        <div className="rounded-2xl bg-white dark:bg-[#111927] border border-indigo-200/80 dark:border-indigo-900/50 p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
          {block.itemImageUrl && (
            <img
              src={block.itemImageUrl}
              alt={block.itemTitle || "Resource"}
              className="w-20 h-24 sm:w-24 sm:h-28 object-contain rounded-xl bg-slate-100 dark:bg-slate-800 shadow-xs"
            />
          )}
          <div className="flex-1 space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-600 text-white">
                {block.itemBadge || "Recommended"}
              </span>
              {block.itemPrice && (
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {block.itemPrice}
                </span>
              )}
            </div>
            <h5 className="text-sm font-black text-slate-900 dark:text-white font-hindi">
              {block.itemTitle || "Book or Course Title"}
            </h5>
            {block.itemSubtitle && (
              <p className="text-xs text-slate-500 font-hindi">
                {block.itemSubtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-sm"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{block.itemButtonText || "View Details"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
