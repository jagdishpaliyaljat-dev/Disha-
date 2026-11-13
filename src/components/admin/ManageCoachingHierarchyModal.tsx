import React from "react";
import { Coaching, CoachingExam, CoachingTestSeries, LiveTest } from "../../types";
import { 
  fetchCoachings, 
  addCoaching, 
  updateCoaching, 
  deleteCoaching,
  fetchCoachingExams, 
  addCoachingExam, 
  updateCoachingExam, 
  deleteCoachingExam,
  fetchCoachingTestSeries, 
  addCoachingTestSeries, 
  updateCoachingTestSeries, 
  deleteCoachingTestSeries 
} from "../../utils/coachingHierarchyStorage";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";
import { 
  X, 
  Plus, 
  Edit2, 
  Trash2, 
  Building2, 
  BookOpen, 
  Layers, 
  Check, 
  AlertCircle, 
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";

interface ManageCoachingHierarchyModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveTests?: LiveTest[];
}

export const ManageCoachingHierarchyModal: React.FC<ManageCoachingHierarchyModalProps> = ({
  isOpen,
  onClose,
  liveTests = [],
}) => {
  const [activeTab, setActiveTab] = React.useState<"coaching" | "exam" | "series">("coaching");

  // State
  const [coachings, setCoachings] = React.useState<Coaching[]>([]);
  const [exams, setExams] = React.useState<CoachingExam[]>([]);
  const [seriesList, setSeriesList] = React.useState<CoachingTestSeries[]>([]);

  const [loading, setLoading] = React.useState<boolean>(false);
  const [actionMessage, setActionMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Selected Filters
  const [selectedCoachingId, setSelectedCoachingId] = React.useState<string>("");
  const [selectedExamId, setSelectedExamId] = React.useState<string>("");

  // Form State - Coaching
  const [editingCoachingId, setEditingCoachingId] = React.useState<string | null>(null);
  const [coachingName, setCoachingName] = React.useState<string>("");
  const [coachingDesc, setCoachingDesc] = React.useState<string>("");

  // Form State - Exam
  const [editingExamId, setEditingExamId] = React.useState<string | null>(null);
  const [examName, setExamName] = React.useState<string>("");
  const [examDesc, setExamDesc] = React.useState<string>("");

  // Form State - Series
  const [editingSeriesId, setEditingSeriesId] = React.useState<string | null>(null);
  const [seriesName, setSeriesName] = React.useState<string>("");
  const [seriesDesc, setSeriesDesc] = React.useState<string>("");
  const [seriesBadge, setSeriesBadge] = React.useState<string>("");
  const [selectedTestIds, setSelectedTestIds] = React.useState<string[]>([]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const cList = await fetchCoachings();
      setCoachings(cList);
      if (cList.length > 0 && !selectedCoachingId) {
        setSelectedCoachingId(cList[0].id);
      }

      const eList = await fetchCoachingExams();
      setExams(eList);
      if (eList.length > 0 && !selectedExamId) {
        setSelectedExamId(eList[0].id);
      }

      const sList = await fetchCoachingTestSeries();
      setSeriesList(sList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedCoachingId, selectedExamId]);

  React.useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  // ──────────────────────────────────────────
  // COACHING ACTIONS
  // ──────────────────────────────────────────
  const handleSaveCoaching = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachingName.trim()) return;

    if (editingCoachingId) {
      await updateCoaching(editingCoachingId, {
        name: coachingName.trim(),
        description: coachingDesc.trim(),
      });
      setActionMessage({ type: "success", text: "Coaching updated successfully." });
    } else {
      await addCoaching({
        name: coachingName.trim(),
        description: coachingDesc.trim(),
        isActive: true,
        order: coachings.length + 1,
      });
      setActionMessage({ type: "success", text: "New Coaching institute added." });
    }

    setCoachingName("");
    setCoachingDesc("");
    setEditingCoachingId(null);
    loadData();
  };

  const handleEditCoachingClick = (c: Coaching) => {
    setEditingCoachingId(c.id);
    setCoachingName(c.name);
    setCoachingDesc(c.description || "");
  };

  const handleToggleCoachingActive = async (c: Coaching) => {
    await updateCoaching(c.id, { isActive: !c.isActive });
    loadData();
  };

  const handleDeleteCoachingClick = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coaching institute?")) return;
    const res = await deleteCoaching(id);
    setActionMessage({
      type: res.success ? "success" : "error",
      text: res.message,
    });
    if (res.success) loadData();
  };

  // ──────────────────────────────────────────
  // EXAM ACTIONS
  // ──────────────────────────────────────────
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName.trim() || !selectedCoachingId) return;

    if (editingExamId) {
      await updateCoachingExam(editingExamId, {
        examName: examName.trim(),
        description: examDesc.trim(),
      });
      setActionMessage({ type: "success", text: "Exam updated successfully." });
    } else {
      await addCoachingExam({
        coachingId: selectedCoachingId,
        examName: examName.trim(),
        description: examDesc.trim(),
        isActive: true,
        order: exams.filter((x) => x.coachingId === selectedCoachingId).length + 1,
      });
      setActionMessage({ type: "success", text: "New Exam added under Coaching." });
    }

    setExamName("");
    setExamDesc("");
    setEditingExamId(null);
    loadData();
  };

  const handleEditExamClick = (eItem: CoachingExam) => {
    setEditingExamId(eItem.id);
    setExamName(eItem.examName);
    setExamDesc(eItem.description || "");
    setSelectedCoachingId(eItem.coachingId);
  };

  const handleToggleExamActive = async (eItem: CoachingExam) => {
    await updateCoachingExam(eItem.id, { isActive: !eItem.isActive });
    loadData();
  };

  const handleDeleteExamClick = async (id: string) => {
    if (!confirm("Are you sure you want to delete this exam?")) return;
    const res = await deleteCoachingExam(id);
    setActionMessage({
      type: res.success ? "success" : "error",
      text: res.message,
    });
    if (res.success) loadData();
  };

  // ──────────────────────────────────────────
  // SERIES ACTIONS
  // ──────────────────────────────────────────
  const handleSaveSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seriesName.trim() || !selectedCoachingId || !selectedExamId) return;

    if (editingSeriesId) {
      await updateCoachingTestSeries(editingSeriesId, {
        seriesName: seriesName.trim(),
        description: seriesDesc.trim(),
        badge: seriesBadge.trim(),
        testIds: selectedTestIds,
      });
      setActionMessage({ type: "success", text: "Test Series updated successfully." });
    } else {
      await addCoachingTestSeries({
        coachingId: selectedCoachingId,
        examId: selectedExamId,
        seriesName: seriesName.trim(),
        description: seriesDesc.trim(),
        badge: seriesBadge.trim(),
        testIds: selectedTestIds,
        isActive: true,
        order: seriesList.filter((s) => s.examId === selectedExamId).length + 1,
      });
      setActionMessage({ type: "success", text: "New Test Series created under Exam." });
    }

    setSeriesName("");
    setSeriesDesc("");
    setSeriesBadge("");
    setSelectedTestIds([]);
    setEditingSeriesId(null);
    loadData();
  };

  const handleEditSeriesClick = (sItem: CoachingTestSeries) => {
    setEditingSeriesId(sItem.id);
    setSeriesName(sItem.seriesName);
    setSeriesDesc(sItem.description || "");
    setSeriesBadge(sItem.badge || "");
    setSelectedTestIds(sItem.testIds || []);
    setSelectedCoachingId(sItem.coachingId);
    setSelectedExamId(sItem.examId);
  };

  const handleToggleSeriesActive = async (sItem: CoachingTestSeries) => {
    await updateCoachingTestSeries(sItem.id, { isActive: !sItem.isActive });
    loadData();
  };

  const handleDeleteSeriesClick = async (id: string) => {
    if (!confirm("Are you sure you want to delete this test series?")) return;
    const res = await deleteCoachingTestSeries(id);
    setActionMessage({
      type: res.success ? "success" : "error",
      text: res.message,
    });
    if (res.success) loadData();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Manage Test Series Hierarchy
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Coaching Name → Exam → Test Series Architecture
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Alert Banner */}
        {actionMessage && (
          <div
            className={`p-3 text-xs font-bold flex items-center justify-between ${
              actionMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Sub-tab Selection */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          {[
            { id: "coaching", label: "1. Coachings", icon: Building2, count: coachings.length },
            { id: "exam", label: "2. Exams", icon: BookOpen, count: exams.length },
            { id: "series", label: "3. Test Series", icon: Layers, count: seriesList.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic("light");
                setActiveTab(tab.id as any);
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
              }`}
            >
              <tab.icon size={14} />
              <span>{tab.label} ({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-5">
          
          {/* TAB 1: COACHING MANAGEMENT */}
          {activeTab === "coaching" && (
            <div className="space-y-4">
              <form onSubmit={handleSaveCoaching} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-black uppercase text-slate-400">
                  {editingCoachingId ? "Edit Coaching Institute" : "+ Add New Coaching Institute"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Enter coaching institute name..."
                    value={coachingName}
                    onChange={(e) => setCoachingName(e.target.value)}
                    required
                    className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Description / Tagline (Optional)"
                    value={coachingDesc}
                    onChange={(e) => setCoachingDesc(e.target.value)}
                    className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  {editingCoachingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCoachingId(null);
                        setCoachingName("");
                        setCoachingDesc("");
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-xs"
                  >
                    {editingCoachingId ? "Update Coaching" : "Add Coaching"}
                  </button>
                </div>
              </form>

              {/* Coaching List */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase">Existing Coaching Institutes</h4>
                {coachings.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">{c.name}</span>
                        <span
                          className={`px-2 py-0.2 text-[9px] font-black uppercase rounded-full ${
                            c.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {c.description && <p className="text-[11px] text-slate-400">{c.description}</p>}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleCoachingActive(c)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500"
                        title="Toggle Active"
                      >
                        {c.isActive ? <Eye size={15} className="text-emerald-500" /> : <EyeOff size={15} />}
                      </button>
                      <button
                        onClick={() => handleEditCoachingClick(c)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-blue-600"
                        title="Edit Coaching"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteCoachingClick(c.id)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-rose-500"
                        title="Delete Coaching"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: EXAM MANAGEMENT */}
          {activeTab === "exam" && (
            <div className="space-y-4">
              <form onSubmit={handleSaveExam} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-black uppercase text-slate-400">
                  {editingExamId ? "Edit Exam" : "+ Add Exam Under Selected Coaching"}
                </h3>
                
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Select Parent Coaching:</label>
                  <select
                    value={selectedCoachingId}
                    onChange={(e) => setSelectedCoachingId(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Choose Coaching Institute --</option>
                    {coachings.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Exam Name (e.g. RAS Preliminary 2026)"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    required
                    className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Exam Description (Optional)"
                    value={examDesc}
                    onChange={(e) => setExamDesc(e.target.value)}
                    className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  {editingExamId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExamId(null);
                        setExamName("");
                        setExamDesc("");
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-slate-500"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-xs"
                  >
                    {editingExamId ? "Update Exam" : "Add Exam"}
                  </button>
                </div>
              </form>

              {/* Exam List */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase">Existing Exams</h4>
                {exams.map((eItem) => {
                  const parentCoaching = coachings.find((c) => c.id === eItem.coachingId);
                  return (
                    <div
                      key={eItem.id}
                      className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">{eItem.examName}</span>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                            {parentCoaching?.name || eItem.coachingId}
                          </span>
                        </div>
                        {eItem.description && <p className="text-[11px] text-slate-400">{eItem.description}</p>}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleExamActive(eItem)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                          title="Toggle Active"
                        >
                          {eItem.isActive ? <Eye size={15} className="text-emerald-500" /> : <EyeOff size={15} />}
                        </button>
                        <button
                          onClick={() => handleEditExamClick(eItem)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-blue-600"
                          title="Edit Exam"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteExamClick(eItem.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-rose-500"
                          title="Delete Exam"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TEST SERIES MANAGEMENT */}
          {activeTab === "series" && (
            <div className="space-y-4">
              <form onSubmit={handleSaveSeries} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-black uppercase text-slate-400">
                  {editingSeriesId ? "Edit Test Series" : "+ Create Test Series Under Coaching & Exam"}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Coaching Institute:</label>
                    <select
                      value={selectedCoachingId}
                      onChange={(e) => setSelectedCoachingId(e.target.value)}
                      required
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Choose Coaching --</option>
                      {coachings.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Associated Exam:</label>
                    <select
                      value={selectedExamId}
                      onChange={(e) => setSelectedExamId(e.target.value)}
                      required
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Choose Exam --</option>
                      {exams
                        .filter((x) => !selectedCoachingId || x.coachingId === selectedCoachingId)
                        .map((eItem) => (
                          <option key={eItem.id} value={eItem.id}>
                            {eItem.examName}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Test Series Name (e.g. Full Length Mock Series 2026)"
                    value={seriesName}
                    onChange={(e) => setSeriesName(e.target.value)}
                    required
                    className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Badge / Tag (e.g. Bestseller, High Yield)"
                    value={seriesBadge}
                    onChange={(e) => setSeriesBadge(e.target.value)}
                    className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <input
                  type="text"
                  placeholder="Series Description"
                  value={seriesDesc}
                  onChange={(e) => setSeriesDesc(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex justify-end gap-2">
                  {editingSeriesId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSeriesId(null);
                        setSeriesName("");
                        setSeriesDesc("");
                        setSeriesBadge("");
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-slate-500"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-xs"
                  >
                    {editingSeriesId ? "Update Series" : "Create Test Series"}
                  </button>
                </div>
              </form>

              {/* Series List */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase">Existing Test Series</h4>
                {seriesList.map((sItem) => {
                  const pCoaching = coachings.find((c) => c.id === sItem.coachingId);
                  const pExam = exams.find((e) => e.id === sItem.examId);
                  return (
                    <div
                      key={sItem.id}
                      className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">{sItem.seriesName}</span>
                          {sItem.badge && (
                            <span className="text-[9px] font-black uppercase bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded">
                              {sItem.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {pCoaching?.name || "Coaching"} → {pExam?.examName || "Exam"}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleSeriesActive(sItem)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                          title="Toggle Active"
                        >
                          {sItem.isActive ? <Eye size={15} className="text-emerald-500" /> : <EyeOff size={15} />}
                        </button>
                        <button
                          onClick={() => handleEditSeriesClick(sItem)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-blue-600"
                          title="Edit Series"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteSeriesClick(sItem.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-rose-500"
                          title="Delete Series"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ManageCoachingHierarchyModal;
