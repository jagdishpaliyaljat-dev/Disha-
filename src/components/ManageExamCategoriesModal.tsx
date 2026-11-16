import React, { useState, useEffect } from "react";
import { ExamCategory } from "../types";
import { fetchExamCategories, saveExamCategory, deleteExamCategory } from "../utils/categoryStorage";
import { X, Plus, Edit2, Trash2, Save, Tags, RefreshCw } from "lucide-react";

interface ManageExamCategoriesModalProps {
  onClose: () => void;
}

export const ManageExamCategoriesModal: React.FC<ManageExamCategoriesModalProps> = ({ onClose }) => {
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [hindiName, setHindiName] = useState("");
  const [order, setOrder] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchExamCategories();
      setCategories(data);
    } catch (e: any) {
      console.error("Failed to load categories", e);
      setLoadError(e?.message || "Failed to load categories.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (cat: ExamCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setHindiName(cat.hindiName || "");
    setOrder(cat.order || 0);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setHindiName("");
    setOrder(0);
  };

  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    setToastMessage(null);
    try {
      const catToSave: ExamCategory = {
        id: editingId || `cat-${Date.now()}`,
        name: name.trim(),
        hindiName: hindiName.trim(),
        order: order,
        createdAt: new Date().toISOString()
      };
      const updated = await saveExamCategory(catToSave);
      setCategories(updated);
      handleCancelEdit();
      setToastMessage({ type: "success", msg: "Exam Category saved successfully!" });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (e: any) {
      console.error("Save failed", e);
      setToastMessage({ type: "error", msg: "Failed to save category: " + (e?.message || "Check network") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingCategoryId) return; // Block duplicate clicks
    if (!confirm("Are you sure you want to delete this category?")) return;

    setDeletingCategoryId(id);
    setToastMessage(null);
    const previous = [...categories];
    // Immediate optimistic removal from UI
    setCategories((prev) => prev.filter((c) => c.id !== id));

    try {
      await deleteExamCategory(id);
      setToastMessage({ type: "success", msg: "Exam Category deleted successfully!" });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (e: any) {
      console.error("Delete failed", e);
      // Rollback on failure
      setCategories(previous);
      setToastMessage({ type: "error", msg: e?.message || "Failed to delete category." });
    } finally {
      setDeletingCategoryId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Tags className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black font-display leading-tight">Manage Exam Categories</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">For Live Tests & PYQ Papers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className={`mx-5 mt-3 p-3 rounded-2xl flex items-center justify-between text-xs font-bold border transition-all ${
            toastMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}>
            <span>{toastMessage.msg}</span>
            <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-70">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Form */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.1em]">
              {editingId ? "Edit Category" : "Add New Category"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Name (English)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. RAS Pre"
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Name (Hindi)</label>
                <input
                  type="text"
                  value={hindiName}
                  onChange={(e) => setHindiName(e.target.value)}
                  placeholder="e.g. RAS Pre"
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold font-hindi focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Display Order</label>
                <input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                />
              </div>
              <div className="col-span-1 flex items-end gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !name.trim()}
                  className="flex-1 p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingId ? "Update" : "Add"}</span>
                </button>
                {editingId && (
                  <button
                    onClick={handleCancelEdit}
                    className="p-2.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Existing Categories ({categories.length})
              </span>
              {isLoading && <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />}
            </div>

            {loadError ? (
              <div className="p-4 text-center bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800 space-y-2">
                <p className="text-xs font-bold text-rose-700 dark:text-rose-300">{loadError}</p>
                <button
                  onClick={loadCategories}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {categories.length === 0 && !isLoading ? (
                  <div className="py-10 text-center text-xs font-bold text-slate-400">
                    No categories found.
                  </div>
                ) : (
                  categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl group hover:border-indigo-400 dark:hover:border-indigo-600 transition-all shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center font-mono text-xs font-black">
                          {cat.order || 0}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">{cat.name}</h4>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {cat.id.slice(0, 8)}</span>
                          </div>
                          {cat.hindiName && (
                            <p className="text-[11px] font-bold text-slate-500 font-hindi mt-0.5">{cat.hindiName}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(cat)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          disabled={deletingCategoryId === cat.id}
                          className={`p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg cursor-pointer ${
                            deletingCategoryId === cat.id ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        >
                          {deletingCategoryId === cat.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
