import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  UploadCloud,
  Check
} from "lucide-react";
import { AppBanner } from "../types";
import { fetchAllBanners, saveBanner, deleteBanner, compressBannerImage } from "../utils/bannerStorage";

interface ManageBannersModalProps {
  onClose: () => void;
}

export const ManageBannersModal: React.FC<ManageBannersModalProps> = ({ onClose }) => {
  const [banners, setBanners] = useState<AppBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentBanner, setCurrentBanner] = useState<Partial<AppBanner> | null>(null);
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    setLoading(true);
    try {
      const data = await fetchAllBanners();
      setBanners(data);
    } catch (err) {
      console.warn("Could not load banners", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setCurrentBanner({
      title: "Banner Slide",
      subtitle: "",
      badge: "",
      imageUrl: "",
      color: "from-blue-600 to-indigo-700",
      iconName: "Image",
      actionLabel: "",
      actionTab: "home",
      isActive: true,
      order: banners.length,
    });
    setUrlInput("");
    setIsEditing(true);
  };

  const handleEdit = (banner: AppBanner) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setCurrentBanner({ ...banner });
    setUrlInput(banner.imageUrl || "");
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBanner(id);
      setDeletingId(null);
      setSuccessMessage("Banner removed successfully.");
      await loadBanners();
    } catch (err: any) {
      setErrorMessage("Error removing banner.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    setErrorMessage(null);

    try {
      const compressedDataUrl = await compressBannerImage(file);
      setCurrentBanner((prev) => ({
        ...prev,
        imageUrl: compressedDataUrl,
      }));
      setSuccessMessage("Image processed and uploaded successfully!");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process image.");
    } finally {
      setCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setCurrentBanner((prev) => ({
      ...prev,
      imageUrl: urlInput.trim(),
    }));
    setSuccessMessage("Image URL applied successfully!");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBanner) return;
    
    if (!currentBanner.imageUrl) {
      setErrorMessage("Please upload a banner image or enter an image URL.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      await saveBanner(currentBanner);
      setSuccessMessage("Banner saved successfully!");
      setIsEditing(false);
      setCurrentBanner(null);
      await loadBanners();
    } catch (err: any) {
      setErrorMessage("Error saving banner: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-[#111A2E] w-full max-w-xl h-full max-h-[90vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-[#111A2E] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Banner Management
              </h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase">
                Home screen carousel slides
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Global Alert Messages */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-400 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="p-1 hover:text-rose-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="flex-1">{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="p-1 hover:text-emerald-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Image Upload & Live Preview Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider ml-1">
                    Banner Image (Required)
                  </label>
                  {compressing && (
                    <span className="text-[10px] font-bold text-blue-600 animate-pulse flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Optimizing image...
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {/* Live Aspect Preview Box */}
                  <div
                    className={`w-full aspect-[2.4/1] rounded-3xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all relative ${
                      currentBanner?.imageUrl
                        ? "border-blue-300 dark:border-blue-800 bg-slate-900"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                    }`}
                  >
                    {currentBanner?.imageUrl ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={currentBanner.imageUrl}
                          alt="Banner Preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-xl bg-white/90 text-slate-900 text-xs font-bold shadow-md hover:bg-white"
                          >
                            Change Image
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentBanner((prev) => ({ ...prev, imageUrl: "" }))}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-md hover:bg-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-6">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-slate-800 text-blue-600 flex items-center justify-center mx-auto mb-3">
                          <UploadCloud className="w-7 h-7" />
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          Upload Banner Image
                        </p>
                        <p className="text-[10.5px] text-slate-400 mt-1">
                          PNG, JPG, WebP (Any size auto-compressed • 1200x500px recommended)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Dual Upload Options: File Picker + URL Option */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Device Upload Button */}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={compressing}
                        className="w-full h-12 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-blue-600/20 active:scale-[0.98] cursor-pointer"
                      >
                        {compressing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <Plus size={16} />
                            <span>Select From Device</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Or URL Input */}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Paste image URL..."
                        className="flex-1 px-3.5 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleApplyUrl}
                        className="px-4 h-12 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Banner Title & Subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block">
                    Banner Title
                  </label>
                  <input
                    type="text"
                    value={currentBanner?.title || ""}
                    onChange={(e) => setCurrentBanner({ ...currentBanner, title: e.target.value })}
                    placeholder="Banner Title"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block">
                    Subtitle / Offer Text
                  </label>
                  <input
                    type="text"
                    value={currentBanner?.subtitle || ""}
                    onChange={(e) => setCurrentBanner({ ...currentBanner, subtitle: e.target.value })}
                    placeholder="Subtitle or description"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Badge Tag */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block">
                  Badge Tag (Optional)
                </label>
                <input
                  type="text"
                  value={currentBanner?.badge || ""}
                  onChange={(e) => setCurrentBanner({ ...currentBanner, badge: e.target.value })}
                  placeholder="e.g. NEW, OFFER, LIVE, 50% OFF"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Navigation Target & Ordering */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block">
                    Landing Page (On Click)
                  </label>
                  <div className="relative">
                    <select
                      value={currentBanner?.actionTab || "home"}
                      onChange={(e) => setCurrentBanner({ ...currentBanner, actionTab: e.target.value })}
                      className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-all cursor-pointer"
                    >
                      <option value="home">Home Dashboard</option>
                      <option value="topics">Syllabus / Topics</option>
                      <option value="live_tests">Live Mock Tests</option>
                      <option value="pyq_vault">PYQ Papers</option>
                      <option value="analytics">Analytics & Reports</option>
                      <option value="profile">Profile & Upgrade</option>
                    </select>
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block">
                    Display Order (Position)
                  </label>
                  <input
                    type="number"
                    value={currentBanner?.order ?? 0}
                    onChange={(e) => setCurrentBanner({ ...currentBanner, order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${currentBanner?.isActive ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600" : "bg-slate-200 dark:bg-slate-800 text-slate-400"}`}>
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                      Active Status
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      {currentBanner?.isActive ? "Visible on Home Carousel" : "Hidden from Users"}
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setCurrentBanner({ ...currentBanner, isActive: !currentBanner?.isActive })}
                  className={`w-12 h-6 rounded-full transition-all relative p-1 cursor-pointer ${currentBanner?.isActive ? "bg-emerald-500 shadow-md shadow-emerald-500/20" : "bg-slate-300 dark:bg-slate-700"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${currentBanner?.isActive ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl text-[11px] uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || compressing}
                  className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-black rounded-2xl text-[11px] uppercase tracking-wider shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Banner</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fetching Banners...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">
                      Live Banners: {banners.filter((b) => b.isActive).length} / {banners.length}
                    </span>
                    <button 
                      onClick={handleAdd}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus size={15} /> New Banner
                    </button>
                  </div>

                  <div className="space-y-3">
                    {banners.length === 0 ? (
                      <div className="p-12 text-center bg-slate-50 dark:bg-slate-900/40 rounded-[32px] border border-dashed border-slate-200 dark:border-slate-800">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">No banners configured yet</p>
                        <button 
                          onClick={handleAdd} 
                          className="text-blue-600 dark:text-blue-400 text-xs font-bold mt-2.5 uppercase tracking-wider underline underline-offset-4 cursor-pointer"
                        >
                          + Create First Banner
                        </button>
                      </div>
                    ) : (
                      banners.map((banner) => (
                        <div 
                          key={banner.id}
                          className={`group relative overflow-hidden bg-white dark:bg-[#151E2D] border rounded-2xl p-3 flex items-center justify-between transition-all hover:shadow-md ${
                            banner.isActive 
                              ? "border-slate-200 dark:border-slate-800" 
                              : "opacity-60 grayscale border-slate-100 dark:border-slate-900"
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-20 aspect-[2.4/1] rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                              {banner.imageUrl ? (
                                <img src={banner.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-5 h-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                                  banner.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-slate-100 text-slate-500"
                                }`}>
                                  {banner.isActive ? "Active" : "Inactive"}
                                </span>
                                <span className="text-[9.5px] font-mono font-bold text-slate-400">Order: {banner.order}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <LinkIcon className="w-3 h-3 text-blue-500" />
                                <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight truncate">
                                  {banner.actionTab || "home"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 pr-1">
                            {deletingId === banner.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(banner.id)}
                                  className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase hover:bg-rose-700 cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  className="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold hover:bg-slate-200 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => handleEdit(banner)}
                                  className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-all hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer"
                                  title="Edit Banner"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button 
                                  onClick={() => setDeletingId(banner.id)}
                                  className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-all hover:bg-rose-100 dark:hover:bg-rose-900 cursor-pointer"
                                  title="Delete Banner"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        {!isEditing && (
          <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <AlertCircle size={13} className="text-slate-400 shrink-0" />
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              Banners are saved instantly to local cache and synchronized across devices via cloud.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
