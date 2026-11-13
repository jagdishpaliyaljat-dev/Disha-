import React from "react";
import { X, Edit3, Trash2 } from "lucide-react";

interface AdminActionsModalProps {
  type: "chapter" | "topic";
  title: string;
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export const AdminActionsModal: React.FC<AdminActionsModalProps> = ({
  type,
  title,
  onEdit,
  onRemove,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Manage {type === "chapter" ? "Chapter" : "Topic"}
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Selected: <span className="font-semibold text-slate-900 dark:text-white">{title}</span>
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => { onEdit(); onClose(); }}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60"
          >
            <Edit3 className="w-5 h-5" />
            Edit
          </button>
          <button
            onClick={() => { onRemove(); onClose(); }}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold hover:bg-rose-100 dark:hover:bg-rose-900/60"
          >
            <Trash2 className="w-5 h-5" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};
