import * as React from "react";
import { productionMonitor } from "../utils/productionMonitoring";
import {
  safeGetSessionStorageItem,
  safeSetSessionStorageItem,
  safeRemoveLocalStorageItem,
} from "../utils/safeStorage";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorEventId?: string;
  isChunkError?: boolean;
  showDetails?: boolean;
  autoHealAttempted?: boolean;
}

/**
 * Root Application Error Boundary for DISHA 20-20
 * Prevents full-screen crashes with instant auto-healing recovery,
 * stale service-worker cache purging, and webview resilience.
 */
export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    const msg = String(error?.message || "");
    const isChunkError =
      msg.includes("dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("Failed to fetch") ||
      msg.includes("ChunkLoadError") ||
      error?.name === "ChunkLoadError";

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    let entryId = "err_" + Date.now();
    try {
      const entry = productionMonitor.captureReactError(error, errorInfo, "RootAppBoundary");
      entryId = entry.id;
    } catch (_) {}
    this.setState({ errorEventId: entryId });
    console.error("[DISHA 20-20 Root Error Boundary]", error, errorInfo);

    // Auto-healing recovery: If this is the first unexpected view error in the session,
    // seamlessly purge stale service-worker cache and recover once without scaring the user
    if (typeof window !== "undefined") {
      const now = Date.now();
      const lockKey = "disha_auto_heal_lock";
      const lastHeal = Number(safeGetSessionStorageItem(lockKey) || "0");

      if (!lastHeal || now - lastHeal > 10000) {
        safeSetSessionStorageItem(lockKey, String(now));
        this.setState({ autoHealAttempted: true });
        console.info("[AppErrorBoundary] Triggering instant self-healing auto-recovery...");
        this.handleSelfHealingRecovery();
      }
    }
  }

  handleRetry = (): void => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: undefined,
      errorEventId: undefined,
      isChunkError: false,
      showDetails: false,
    });
  };

  handleGoHome = (): void => {
    try {
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
        window.location.replace(`/?recovery=1&_t=${Date.now()}`);
        return;
      }
    } catch {}
    this.handleRetry();
  };

  handleCopyDiagnostics = async (): Promise<void> => {
    try {
      const err = this.state.error;
      const report = {
        name: err?.name || "UnknownError",
        message: err?.message || "",
        reference: this.state.errorEventId || "",
        stack: err?.stack || "",
        url: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        timestamp: new Date().toISOString(),
      };
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        alert("Diagnostic report copied to clipboard. / डायग्नोस्टिक रिपोर्ट क्लिपबोर्ड पर कॉपी हो गई।");
      }
    } catch {}
  };

  handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleSelfHealingRecovery = async (): Promise<void> => {
    try {
      if (typeof window !== "undefined") {
        // 1. Clear all CacheStorage entries to discard stale chunks
        if ("caches" in window) {
          const keys = await caches.keys().catch(() => []);
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
        }

        // 2. Unregister all active Service Workers
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
          await Promise.all(registrations.map((r) => r.unregister().catch(() => false)));
        }

        // 3. Purge transient corrupted cache keys while preserving authenticated profile, streak, & progress
        const purgeKeys = [
          "disha2020_cloud_cache_questions_v1",
          "disha2020_pending_writes_queue_v1",
          "disha2020_curriculum_cache_v1",
          "disha2020_clean_slate_zero_mock_v8_0",
          "quizpro_cloud_cache_questions_v1",
          "quizpro_pending_writes_queue_v1",
          "cached_curriculum_v1",
          "quizpro_curriculum_cache_v1",
          "quizpro_clean_slate_zero_mock_v7_0",
          "quizpro_clean_slate_zero_mock_v8_0",
          "disha_chunk_reload_lock",
        ];
        purgeKeys.forEach((k) => safeRemoveLocalStorageItem(k));
      }
    } catch (e) {
      console.warn("Could not completely flush caches:", e);
    }

    if (typeof window !== "undefined") {
      window.location.replace(`/?recovery=1&_t=${Date.now()}`);
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const isChunk = this.state.isChunkError;

      return (
        <div className="min-h-screen bg-[#FFF9EF] dark:bg-[#111A2E] flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none font-sans">
          <div className="max-w-md w-full bg-white dark:bg-[#17223B] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E8D9C0] dark:border-[#25324D] space-y-5 sm:space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#800020]/10 dark:bg-[#800020]/25 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shadow-inner">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-lg sm:text-xl font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight">
                {isChunk
                  ? "ऐप अपडेट उपलब्ध है (Update Ready)"
                  : this.props.fallbackTitle || "दिशा 20-20 — स्वतः मरम्मत (Auto-Repair)"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-hindi">
                {isChunk
                  ? "दिशा 20-20 का नया और तेज़ वर्शन लाइव है। नीचे 1-क्लिक रिपेयर बटन दबाकर तुरंत लॉन्च करें।"
                  : "अस्थायी व्यू एरर पकड़ा गया। आपका अभ्यास, बुकमार्क और प्रोफाइल डेटा 100% सुरक्षित है।"}
              </p>
              {this.state.errorEventId && (
                <div className="pt-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                    Reference: {this.state.errorEventId}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleSelfHealingRecovery}
                className="w-full py-3.5 px-4 bg-[#800020] hover:bg-[#600018] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🚀 1-क्लिक स्वतः मरम्मत और खोलें (1-Tap Auto-Repair & Launch)</span>
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={this.handleGoHome}
                  className="w-full sm:flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  मुख्य पृष्ठ (Home)
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="w-full sm:flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  पुनः लोड (Reload)
                </button>
              </div>
            </div>

            {/* Collapsible Error Diagnostics Details for Admins & Debugging */}
            {this.state.error && (
              <div className="pt-2 text-left">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline cursor-pointer"
                  >
                    {this.state.showDetails ? "विवरण छुपाएं (Hide Details)" : "त्रुटि विवरण देखें (Show Error Details)"}
                  </button>
                  {this.state.showDetails && (
                    <button
                      type="button"
                      onClick={this.handleCopyDiagnostics}
                      className="text-[10px] font-bold text-[#800020] dark:text-[#F47B20] hover:underline cursor-pointer"
                    >
                      कॉपी करें (Copy Report)
                    </button>
                  )}
                </div>
                {this.state.showDetails && (
                  <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-mono text-rose-600 dark:text-rose-400 break-all select-text max-h-36 overflow-y-auto">
                    <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
                    {this.state.error.stack && (
                      <p className="mt-1 text-[9px] text-slate-400 opacity-80 whitespace-pre-wrap">{this.state.error.stack.slice(0, 500)}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
