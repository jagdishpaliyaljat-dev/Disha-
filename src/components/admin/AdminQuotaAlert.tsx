import * as React from "react";
import { 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  CheckCircle2,
  X
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";

export const AdminQuotaAlert: React.FC = () => {
  const [isDismissed, setIsDismissed] = React.useState(false);

  // In Supabase PostgreSQL, there are no artificial 50k read / 20k write daily circuit breakers.
  // We only alert if Supabase credentials are completely missing.
  if (isDismissed || isSupabaseConfigured()) {
    return null;
  }

  return (
    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 flex items-center justify-between gap-3 text-amber-800 dark:text-amber-300">
      <div className="flex items-center gap-2.5 text-xs">
        <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>
          Supabase environment variables (VITE_SUPABASE_URL) not detected. Operating in Local IndexedDB mode.
        </span>
      </div>
      <button
        onClick={() => setIsDismissed(true)}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default AdminQuotaAlert;
