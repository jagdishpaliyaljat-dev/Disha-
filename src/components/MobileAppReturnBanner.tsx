import React, { useState } from 'react';
import { Smartphone, ExternalLink, X } from 'lucide-react';
import { isNativePlatform, isMobileBrowser, getAppDeepLinkFromSession } from '../utils/mobileAuthService';
import { supabase } from '../lib/supabase';

interface MobileAppReturnBannerProps {
  userName?: string;
}

export const MobileAppReturnBanner: React.FC<MobileAppReturnBannerProps> = ({ userName }) => {
  const [dismissed, setDismissed] = useState(false);

  // Only show on mobile web browsers (e.g. Chrome on Android after OAuth redirect)
  if (dismissed || isNativePlatform() || !isMobileBrowser()) {
    return null;
  }

  const handleOpenApp = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token && data?.session?.refresh_token) {
        const deepLink = getAppDeepLinkFromSession(
          data.session.access_token,
          data.session.refresh_token
        );
        window.location.href = deepLink;
      }
    } catch (err) {
      console.warn('[MobileAppReturnBanner] Failed to get session for handover:', err);
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white px-3.5 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs z-50 sticky top-0 border-b border-amber-500/30">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
          <Smartphone className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="truncate">
          <p className="font-bold truncate">
            {userName ? `Welcome, ${userName}!` : 'Login successful!'}
          </p>
          <p className="text-[11px] text-purple-100 opacity-90 truncate">
            Tap to open and sync your session with Disha PYQ App
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleOpenApp}
          className="px-3 py-1.5 bg-white text-amber-900 rounded-lg font-bold text-[11px] shadow-sm hover:bg-amber-50 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>Open App</span>
          <ExternalLink className="w-3 h-3" />
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-md hover:bg-white/10 text-amber-200 hover:text-white transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
