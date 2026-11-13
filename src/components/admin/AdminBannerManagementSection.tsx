import * as React from "react";
import { 
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
  X, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft,
  ChevronRight,
  Loader2,
  Layers,
  Layout
} from "lucide-react";
import { AppBanner } from "../../types";
import { 
  fetchAllBanners, 
  saveBanner, 
  deleteBanner, 
  compressBannerImage 
} from "../../utils/bannerStorage";
import { ListRowSkeleton } from "./AdminSkeletonLoaders";

export const AdminBannerManagementSection: React.FC<{ onBannerUpdated?: () => void }> = ({
  onBannerUpdated,
}) => {
  const [banners, setBanners] = React.useState<AppBanner[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [currentBanner, setCurrentBanner] = React.useState<Partial<AppBanner> | null>(null);
  const [urlInput, setUrlInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [compressing, setCompressing] = React.useState(false);
  const [notification, setNotification] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deletingBanner, setDeletingBanner] = React.useState<AppBanner | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [previewIndex, setPreviewIndex] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadBanners = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchAllBanners();
      setBanners(data);
    } catch (err) {
      console.warn("Banner sync failed", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    loadBanners();
  }, []);

  const handleAddNew = () => {
    setCurrentBanner({
      title: "New Featured Campaign",
      subtitle: "Join our exclusive learning program today",
      badge: "FEATURED",
      imageUrl: "",
      color: "from-blue-600 to-indigo-700",
      actionLabel: "GET STARTED",
      actionTab: "home",
      isActive: true,
      order: banners.length,
    });
    setUrlInput("");
    setIsEditing(true);
  };

  const handleEdit = (banner: AppBanner) => {
    setCurrentBanner({ ...banner });
    setUrlInput(banner.imageUrl || "");
    setIsEditing(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const compressedDataUrl = await compressBannerImage(file);
      setCurrentBanner((prev) => ({ ...prev, imageUrl: compressedDataUrl }));
      setNotification({ type: "success", message: "Image optimized and loaded!" });
    } catch (err: any) {
      setNotification({ type: "error", message: "Optimization failed." });
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setCurrentBanner((prev) => ({ ...prev, imageUrl: urlInput.trim() }));
    setNotification({ type: "success", message: "Remote asset linked." });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBanner || !currentBanner.imageUrl) {
      setNotification({ type: "error", message: "Visual asset is required." });
      return;
    }
    setSaving(true);
    try {
      await saveBanner(currentBanner as AppBanner);
      setNotification({ type: "success", message: "Campaign published." });
      setIsEditing(false);
      setCurrentBanner(null);
      await loadBanners();
      onBannerUpdated?.();
    } catch (err: any) {
      setNotification({ type: "error", message: "Publishing failed." });
    } finally {
      setSaving(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleToggleActive = async (banner: AppBanner) => {
    try {
      const updated = { ...banner, isActive: !banner.isActive };
      await saveBanner(updated);
      setBanners(prev => prev.map(b => b.id === banner.id ? updated : b));
      onBannerUpdated?.();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveOrder = async (banner: AppBanner, direction: "up" | "down") => {
    const sorted = [...banners].sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex((b) => b.id === banner.id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const other = sorted[targetIdx];
    try {
      await Promise.all([
        saveBanner({ ...banner, order: other.order ?? targetIdx }),
        saveBanner({ ...other, order: banner.order ?? idx }),
      ]);
      await loadBanners();
      onBannerUpdated?.();
    } catch (err) {
      console.warn(err);
    }
  };

  const handleDelete = async () => {
    if (!deletingBanner) return;
    setIsDeleting(true);
    try {
      await deleteBanner(deletingBanner.id);
      setBanners(prev => prev.filter(b => b.id !== deletingBanner.id));
      setDeletingBanner(null);
      onBannerUpdated?.();
    } catch (err) {
      setNotification({ type: "error", message: "Deletion failed." });
    } finally {
      setIsDeleting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const activeBanners = banners.filter((b) => b.isActive).sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* 1. Header Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Layers className="w-3.5 h-3.5" />
              <span>Asset Management</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Campaign Banners</h2>
            <p className="text-sm text-slate-500 font-medium max-w-lg leading-relaxed">
              Design and deploy promotional slides to drive student engagement and highlight new content.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => loadBanners(true)} 
              className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
            </button>
            <button 
              onClick={handleAddNew}
              className="h-10 px-4 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-sm shadow-indigo-100 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Slide</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 animate-in zoom-in-95 duration-200 ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-rose-50 border-rose-100 text-rose-900'
        }`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600"/> : <AlertCircle className="w-4 h-4 text-rose-600"/>}
            <span className="text-xs font-bold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      )}

      {/* 2. Visual Control Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Mobile Preview Simulation */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <Layout className="w-4 h-4 text-slate-400" />
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mobile Preview</h3>
            </div>
            
            <div className="relative aspect-[2/1] rounded-lg overflow-hidden bg-slate-900 shadow-md group border border-slate-100">
              {activeBanners.length > 0 ? (
                <>
                  <img src={activeBanners[previewIndex]?.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 flex flex-col justify-end">
                    <span className="self-start px-2 py-0.5 rounded bg-amber-400 text-[8px] font-bold text-slate-900 mb-2 uppercase">{activeBanners[previewIndex]?.badge}</span>
                    <h4 className="text-white font-bold text-[15px] leading-tight truncate">{activeBanners[previewIndex]?.title}</h4>
                    <p className="text-white/70 text-[10px] font-medium mt-0.5 truncate">{activeBanners[previewIndex]?.subtitle}</p>
                  </div>
                  <div className="absolute bottom-3 right-4 flex gap-1">
                    {activeBanners.map((_, i) => (
                      <div key={i} className={`h-1 rounded-full transition-all ${i === previewIndex ? "w-4 bg-white" : "w-1 bg-white/40"}`} />
                    ))}
                  </div>
                  <button onClick={() => setPreviewIndex(prev => (prev + 1) % activeBanners.length)} className="absolute inset-y-0 right-0 w-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px] font-medium italic">No active campaigns</div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-50 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Infrastructure</span>
                <span className="text-emerald-500">Live CDN</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Active Slides</span>
                <span className="text-indigo-600 tabular-nums">{activeBanners.length} SLOTS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Main Content Area */}
        <div className="lg:col-span-8">
          {isEditing ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xl animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Slide Composer</h3>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><X className="w-5 h-5 text-slate-400"/></button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                {/* Visual Asset Upload */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Creative Asset</label>
                    {compressing && <span className="text-[10px] font-bold text-indigo-600 animate-pulse">OPTIMIZING...</span>}
                  </div>
                  
                  <div className="relative aspect-[2.4/1] rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden group">
                    {currentBanner?.imageUrl ? (
                      <>
                        <img src={currentBanner.imageUrl} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="h-9 px-4 bg-white text-slate-900 rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm">Replace</button>
                          <button type="button" onClick={() => setCurrentBanner(p => ({...p, imageUrl: ""}))} className="h-9 px-4 bg-rose-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm">Remove</button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <UploadCloud className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Upload Banner (Recommended: 800x400)</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-11 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-[0.98]">Upload Asset</button>
                    <div className="flex gap-2">
                      <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="Remote URL..." className="flex-1 px-4 h-11 bg-slate-50 border border-slate-100 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500/10 transition-all" />
                      <button type="button" onClick={handleApplyUrl} className="h-11 px-4 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase">Link</button>
                    </div>
                  </div>
                </div>

                {/* Meta Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Primary Title</label>
                    <input type="text" value={currentBanner?.title || ""} onChange={e => setCurrentBanner(p => ({...p, title: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500/10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subtitle Text</label>
                    <input type="text" value={currentBanner?.subtitle || ""} onChange={e => setCurrentBanner(p => ({...p, subtitle: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500/10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Badge Label</label>
                    <input type="text" value={currentBanner?.badge || ""} onChange={e => setCurrentBanner(p => ({...p, badge: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500/10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Button Label</label>
                    <input type="text" value={currentBanner?.actionLabel || ""} onChange={e => setCurrentBanner(p => ({...p, actionLabel: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500/10" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${currentBanner?.isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300"}`} />
                    <div>
                      <p className="text-[11px] font-bold text-slate-900 uppercase">Active Deployment</p>
                      <p className="text-[10px] text-slate-500 font-medium">Visible on all student mobile devices</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setCurrentBanner(p => ({...p, isActive: !p?.isActive}))} className={`w-11 h-6 rounded-full p-1 transition-all ${currentBanner?.isActive ? "bg-emerald-500" : "bg-slate-300"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${currentBanner?.isActive ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsEditing(false)} className="flex-1 h-12 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-xs uppercase tracking-wider transition-all hover:bg-slate-50">Discard</button>
                  <button type="submit" disabled={saving || compressing} className="flex-[2] h-12 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-100 disabled:opacity-50 transition-all active:scale-[0.98]">
                    {saving ? "Publishing..." : "Publish Campaign"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Campaign Registry</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider tabular-nums">{banners.length} TOTAL</span>
              </div>
              
              <div className="divide-y divide-slate-50">
                {loading ? (
                  <ListRowSkeleton count={4} />
                ) : (
                  banners.sort((a,b) => (a.order || 0) - (b.order || 0)).map((banner, i) => (
                    <div key={banner.id} className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-colors ${banner.isActive ? "hover:bg-slate-50/50" : "opacity-60 bg-slate-50/20 grayscale-[0.5]"}`}>
                      <div className="flex items-center gap-5 min-w-0">
                        <div className="w-24 aspect-[2/1] rounded-lg overflow-hidden bg-slate-100 shadow-sm shrink-0 border border-slate-100">
                          <img src={banner.imageUrl} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[15px] font-bold text-slate-900 truncate tracking-tight">{banner.title}</h4>
                            {banner.isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{banner.actionTab || "HOME"} • ORDER {banner.order ?? i}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                          <button onClick={() => handleMoveOrder(banner, "up")} className="p-2 hover:bg-slate-50 transition-colors text-slate-400 hover:text-indigo-600"><ArrowUp className="w-4 h-4"/></button>
                          <button onClick={() => handleMoveOrder(banner, "down")} className="p-2 hover:bg-slate-50 border-l border-slate-100 transition-colors text-slate-400 hover:text-indigo-600"><ArrowDown className="w-4 h-4"/></button>
                        </div>
                        <button onClick={() => handleToggleActive(banner)} className={`h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${banner.isActive ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-100 border-slate-200 text-slate-500"}`}>
                          {banner.isActive ? "ACTIVE" : "PAUSED"}
                        </button>
                        <button onClick={() => handleEdit(banner)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={() => setDeletingBanner(banner)} className="p-2.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors shadow-sm"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                  ))
                )}
                
                {banners.length === 0 && !loading && (
                  <div className="py-20 text-center space-y-4">
                    <ImageIcon className="w-12 h-12 text-slate-200 mx-auto" />
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No Active Campaigns Registered</p>
                    <button onClick={handleAddNew} className="text-[11px] font-bold text-indigo-600 underline uppercase tracking-wider hover:text-indigo-700">Create First Slide</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingBanner && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-xl p-8 w-full max-w-sm shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-lg flex items-center justify-center mx-auto text-rose-600 shadow-sm">
              <Trash2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Erase Campaign?</h3>
              <p className="text-sm text-slate-500 font-medium italic">"{deletingBanner.title}"</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button disabled={isDeleting} onClick={handleDelete} className="w-full h-12 bg-rose-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-100 transition-all active:scale-[0.98]">
                {isDeleting ? "Erase..." : "Confirm Deletion"}
              </button>
              <button disabled={isDeleting} onClick={() => setDeletingBanner(null)} className="w-full h-12 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-xs uppercase tracking-wider transition-all hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
