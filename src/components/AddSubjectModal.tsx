import React, { useState } from "react";
import { Subject } from "../types";
import {
  X,
  Plus,
  BookOpen,
  TrendingUp,
  Landmark,
  Globe,
  Cpu,
  Award,
  Shield,
  FileText,
  Compass,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";

interface AddSubjectModalProps {
  existingSubjectsCount: number;
  existingSubjects?: Subject[];
  onAddSubject: (newSubject: Subject) => void;
  onClose: () => void;
}

const AVAILABLE_ICONS = [
  { name: "TrendingUp", label: "Economy / Growth", icon: TrendingUp },
  { name: "Landmark", label: "Polity / Governance", icon: Landmark },
  { name: "Globe", label: "Geography / World", icon: Globe },
  { name: "BookOpen", label: "History / Culture", icon: BookOpen },
  { name: "Cpu", label: "Science / Tech", icon: Cpu },
  { name: "Award", label: "Special / GK", icon: Award },
  { name: "Shield", label: "Defense / Security", icon: Shield },
  { name: "Compass", label: "Environment / Map", icon: Compass },
  { name: "FileText", label: "Schemes / Current", icon: FileText },
  { name: "Sparkles", label: "General Studies", icon: Sparkles },
];

const AVAILABLE_COLORS = [
  { id: "blue", label: "Blue", bg: "bg-blue-500" },
  { id: "indigo", label: "Indigo", bg: "bg-indigo-500" },
  { id: "emerald", label: "Emerald", bg: "bg-emerald-500" },
  { id: "amber", label: "Amber", bg: "bg-amber-500" },
  { id: "purple", label: "Purple", bg: "bg-purple-500" },
  { id: "rose", label: "Rose", bg: "bg-rose-500" },
  { id: "cyan", label: "Cyan", bg: "bg-cyan-500" },
];

export const AddSubjectModal: React.FC<AddSubjectModalProps> = ({
  existingSubjectsCount,
  existingSubjects = [],
  onAddSubject,
  onClose,
}) => {
  const [name, setName] = useState("");
  const [hindiName, setHindiName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("BookOpen");
  const [selectedColor, setSelectedColor] = useState("blue");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanHindi = hindiName.trim();

    if (!cleanName && !cleanHindi) {
      setError("Please enter a subject title");
      return;
    }

    if (existingSubjects && existingSubjects.length > 0) {
      const isDuplicate = existingSubjects.some((s) => {
        const matchName = cleanName && s.name && s.name.trim().toLowerCase() === cleanName.toLowerCase();
        const matchHindi = cleanHindi && s.hindiName && s.hindiName.trim().toLowerCase() === cleanHindi.toLowerCase();
        return matchName || matchHindi;
      });
      if (isDuplicate) {
        setError(`A subject with the name "${cleanHindi || cleanName}" already exists. Duplicate subjects are not allowed.`);
        return;
      }
    }

    setIsLoading(true);
    const subjectId = `subj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newSubject: Subject = {
      id: subjectId,
      name: cleanName || cleanHindi,
      hindiName: cleanHindi || cleanName,
      description: description.trim() || "Course Subject MCQs and Study Material",
      icon: selectedIcon,
      color: selectedColor,
      order: existingSubjectsCount + 1,
      isUserAdded: true,
    };

    try {
      await onAddSubject(newSubject);
      onClose();
    } catch (err) {
      setError("Failed to create subject. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div
      id="add-subject-modal-backdrop"
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-all"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0"
      />

      <motion.div
        id="add-subject-modal-card"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full sm:max-w-lg bg-white dark:bg-[#130E26] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[90vh] relative z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-sm">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                Add New Subject
              </h2>
              <p className="text-[11px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">
                Syllabus Architecture
              </p>
            </div>
          </div>
          <button
            id="btn-close-add-subject"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 pt-4 space-y-5 custom-scrollbar">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl text-sm text-rose-600 dark:text-rose-400 font-bold">
              {error}
            </div>
          )}

          <form id="add-subject-form" onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-[11px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Subject Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="input-subject-title-hi"
                required
                autoComplete="off"
                placeholder="e.g. Indian Polity & Constitution"
                value={hindiName}
                onChange={(e) => {
                  setHindiName(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full h-12 sm:h-14 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                English Title (Subject Name)
              </label>
              <input
                type="text"
                id="input-subject-title-en"
                autoComplete="off"
                placeholder="e.g. Indian Polity & Constitution"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 sm:h-14 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Description
              </label>
              <input
                type="text"
                id="input-subject-description"
                autoComplete="off"
                placeholder="e.g. Parliament, Judiciary, Fundamental Rights & Articles"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-[11px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Subject Icon
              </label>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_ICONS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedIcon === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setSelectedIcon(item.name)}
                      className={`h-12 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/60 border-[#7045D8] text-blue-600 dark:text-blue-400 scale-105 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                      title={item.label}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-[11px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Theme Color
              </label>
              <div className="flex items-center gap-3">
                {AVAILABLE_COLORS.map((c) => {
                  const isSelected = selectedColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedColor(c.id)}
                      className={`w-9 h-9 rounded-full ${c.bg} transition-all cursor-pointer flex items-center justify-center ${
                        isSelected ? "ring-4 ring-blue-500/40 scale-110 shadow-md" : "opacity-80 hover:opacity-100"
                      }`}
                      title={c.label}
                    ></button>
                  );
                })}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-4 border-t border-slate-100 dark:border-slate-800/60 shrink-0 bg-white dark:bg-[#130E26]">
          <button
            type="button"
            id="btn-cancel-add-subject"
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-95"
          >
            Cancel
          </button>
          <button
            form="add-subject-form"
            type="submit"
            id="btn-submit-add-subject"
            disabled={isLoading}
            className={`flex-1 py-4 rounded-2xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-[#7045D8]/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              "Saving..."
            ) : (
              <>
                <Plus className="w-5 h-5 stroke-[3]" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
