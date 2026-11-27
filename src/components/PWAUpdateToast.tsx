import React from "react";
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Sparkles } from 'lucide-react';

export const PWAUpdateToast: React.FC = () => {
  return <PWAUpdateToastInner />;
};

const PWAUpdateToastInner: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (import.meta.env.DEV) {
        console.log('SW Registered (dev cache-first active):', r);
      }
    },
    onRegisterError(error) {
      console.warn('SW registration notice:', error);
    },
  });

  if (!needRefresh || !import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 dark:bg-slate-800 text-white p-4 rounded-3xl shadow-2xl border border-[#7045D8]/30 flex items-center gap-4 animate-bounce-in">
      <div className="w-10 h-10 rounded-2xl bg-[#7045D8]/20 text-[#A78BFA] flex items-center justify-center shrink-0">
        <Sparkles className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-black uppercase tracking-wider text-[#A78BFA]">Update Available</h4>
        <p className="text-xs text-slate-300 mt-0.5 truncate">A new version of Disha PYQ is ready.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => updateServiceWorker(true)}
          className="px-3.5 py-2 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-[#7045D8]/25 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reload</span>
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
