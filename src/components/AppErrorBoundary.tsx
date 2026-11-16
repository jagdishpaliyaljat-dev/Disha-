import * as React from "react";
import { productionMonitor } from "../utils/productionMonitoring";

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
}

/**
 * Root Application Error Boundary for DISHA 20-20
 * Prevents full-screen whiteout / crash scenarios.
 * Integrates with productionMonitoring telemetry without logging secrets or credentials.
 * Handles automatic chunk cache busting on deployment hash mismatch.
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
      error?.name === "ChunkLoadError";

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const entry = productionMonitor.captureReactError(error, errorInfo, "RootAppBoundary");
    this.setState({ errorEventId: entry.id });
    console.error("[DISHA 20-20 Root Error Boundary]", error, errorInfo);

    // If chunk mismatch detected and not yet auto-reloaded in this session, auto-clear SW & reload seamlessly
    const msg = String(error?.message || "");
    const isChunkFail =
      msg.includes("dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("Failed to fetch") ||
      error?.name === "ChunkLoadError";

    if (isChunkFail && typeof window !== "undefined") {
      const lockKey = "disha_auto_chunk_reload_done";
      if (!sessionStorage.getItem(lockKey)) {
        sessionStorage.setItem(lockKey, "1");
        this.handleClearCacheAndReload();
      }
    }
  }

  handleRetry = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: undefined, errorEventId: undefined, isChunkError: false, showDetails: false });
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
        alert("Diagnostic report copied to clipboard.");
      }
    } catch {}
  };

  handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleClearCacheAndReload = async (): Promise<void> => {
    try {
      if (typeof window !== "undefined") {
        // 1. Clear all CacheStorage entries
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }

        // 2. Unregister all active Service Workers to purge stale precache
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));
        }

        // 3. Purge curriculum and temporary cache keys while preserving authenticated profile & streak
        if (typeof localStorage !== "undefined") {
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
          ];
          purgeKeys.forEach((k) => localStorage.removeItem(k));
        }
      }
    } catch (e) {
      console.warn("Could not completely flush caches:", e);
    }

    if (typeof window !== "undefined") {
      window.location.replace(`/?_v=${Date.now()}`);
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
                  ? "App Update Available"
                  : this.props.fallbackTitle || "Something went wrong"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-hindi">
                {isChunk
                  ? "A newer version of DISHA 20-20 has been deployed with performance and database updates. Tap below to refresh."
                  : "DISHA 20-20 encountered an unexpected view error. Your practice progress and bookmark records are safely stored."}
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
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                {isChunk ? (
                  <button
                    onClick={this.handleClearCacheAndReload}
                    className="w-full sm:flex-1 py-3 px-4 bg-[#800020] hover:bg-[#600018] text-[#FFF9EF] rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    Update & Launch
                  </button>
                ) : (
                  <button
                    onClick={this.handleGoHome}
                    className="w-full sm:flex-1 py-3 px-4 bg-[#800020] hover:bg-[#600018] text-[#FFF9EF] rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Go to Home Dashboard</span>
                  </button>
                )}
                <button
                  onClick={this.handleReload}
                  className="w-full sm:flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  Reload Page
                </button>
              </div>

              {!isChunk && (
                <button
                  onClick={this.handleClearCacheAndReload}
                  className="w-full py-2.5 px-3 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-500 dark:text-slate-400 rounded-xl text-[11px] font-bold transition-all active:scale-95 cursor-pointer border border-dashed border-slate-300 dark:border-slate-700"
                >
                  Reset Temporary Cache & Launch
                </button>
              )}
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
                    {this.state.showDetails ? "Hide Error Details" : "Show Error Details"}
                  </button>
                  {this.state.showDetails && (
                    <button
                      type="button"
                      onClick={this.handleCopyDiagnostics}
                      className="text-[10px] font-bold text-[#800020] dark:text-[#F47B20] hover:underline cursor-pointer"
                    >
                      Copy Diagnostic Report
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
