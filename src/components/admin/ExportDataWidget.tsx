import * as React from "react";
import { Download } from "lucide-react";
import { UserQuestionsStore } from "../../types";
import { AdminCard } from "./AdminCard";

interface ExportDataWidgetProps {
  questionsStore: UserQuestionsStore;
}

export const ExportDataWidget: React.FC<ExportDataWidgetProps> = ({ questionsStore }) => {
  const handleExport = () => {
    const dataStr = JSON.stringify(questionsStore, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `disha2020_questions_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AdminCard className="p-3">
      <button
        onClick={handleExport}
        className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-[20px] text-xs font-black uppercase tracking-tight transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#7045D8]/20"
      >
        <Download className="w-4 h-4" />
        <span>Export Data Registry</span>
      </button>
    </AdminCard>
  );
};
