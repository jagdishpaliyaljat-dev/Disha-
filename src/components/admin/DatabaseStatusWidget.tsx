import * as React from "react";
import { Database, BookOpen, Layers, Target, HelpCircle, Loader2 } from "lucide-react";
import { collection } from "firebase/firestore";
import { guardedGetCountFromServer } from "../../utils/quotaTracker";
import { db } from "../../lib/firebase";
import { AdminCard } from "./AdminCard";

export const DatabaseStatusWidget: React.FC = () => {
  const [counts, setCounts] = React.useState<{
    subjects: number | null;
    chapters: number | null;
    topics: number | null;
    mcqs: number | null;
  }>({ subjects: null, chapters: null, topics: null, mcqs: null });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      setLoading(true);
      try {
        const collections = ["subjects", "chapters", "topics", "mcqs"];
        const results = await Promise.allSettled(
          collections.map((coll) => guardedGetCountFromServer(collection(db, coll), "Admin", `Count ${coll}`))
        );

        if (!isMounted) return;

        const getCountVal = (idx: number) => {
          const res = results[idx];
          if (res.status === "fulfilled" && res.value?.data) {
            return res.value.data().count ?? 0;
          }
          return 0;
        };

        setCounts({
          subjects: getCountVal(0),
          chapters: getCountVal(1),
          topics: getCountVal(2),
          mcqs: getCountVal(3),
        });
      } catch (error) {
        console.warn("Notice while fetching database counts:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchCounts();
    return () => {
      isMounted = false;
    };
  }, []);

  const stats = [
    { label: "Subjects", value: counts.subjects, icon: BookOpen, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/50" },
    { label: "Chapters", value: counts.chapters, icon: Layers, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/50" },
    { label: "Topics", value: counts.topics, icon: Target, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
    { label: "MCQs", value: counts.mcqs, icon: HelpCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50" },
  ];

  return (
    <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <Database className="w-4 h-4 text-slate-400" />
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Content Engine Inventory</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 group hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${stat.bg}`}>
                <Icon className={`w-4.5 h-4.5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : stat.value?.toLocaleString() ?? "0"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
