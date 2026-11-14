import * as React from "react";
import { Activity, RefreshCw } from "lucide-react";
import { runFirebaseDiagnostic, FirebaseTestResult } from "../../utils/firebaseTest";
import { AdminCard } from "./AdminCard";

export const FirestoreDiagnosticPanel: React.FC = () => {
  const [result, setResult] = React.useState<FirebaseTestResult | null>(null);
  const [loading, setLoading] = React.useState(false);

  const runTest = async () => {
    setLoading(true);
    const res = await runFirebaseDiagnostic();
    setResult(res);
    setLoading(false);
  };

  return (
    <AdminCard
      title="Connectivity Diagnostics"
      subtitle="Verify live Firestore and Auth status"
      icon={Activity}
      headerAction={
        <button
          onClick={runTest}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95"
        >
          {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
          <span>{loading ? "Testing..." : "Check Connection"}</span>
        </button>
      }
    >
      {result ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Auth Status</span>
            <span className={`text-xs font-black ${result.authState.isAuthenticated ? "text-emerald-600" : "text-rose-600"}`}>
              {result.authState.isAuthenticated ? "Authenticated" : "Not Authenticated"}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Firestore Read</span>
            <span className={`text-xs font-black ${result.firestoreRead.success ? "text-emerald-600" : "text-rose-600"}`}>
              {result.firestoreRead.message}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Firestore Write</span>
            <span className={`text-xs font-black ${result.firestoreWrite.success ? "text-emerald-600" : "text-rose-600"}`}>
              {result.firestoreWrite.message}
            </span>
          </div>
          <div className="flex items-center justify-center pt-2">
            <p className="text-[10px] font-bold text-slate-400">Tested at: {result.timestamp}</p>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-xs text-slate-400 font-medium italic">No recent diagnostic results. Click the button above to test.</p>
        </div>
      )}
    </AdminCard>
  );
};
