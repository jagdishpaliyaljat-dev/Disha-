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
}

/**
 * Root Application Error Boundary for DISHA 20-20
 * Prevents full-screen whiteout / crash scenarios.
 * Integrates with productionMonitoring telemetry without logging secrets or credentials.
 */
export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const entry = productionMonitor.captureReactError(error, errorInfo, "RootAppBoundary");
    this.setState({ errorEventId: entry.id });
    console.error("[DISHA 20-20 Root Error Boundary]", error, errorInfo);
  }

  handleRetry = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: undefined, errorEventId: undefined });
  };

  handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleClearCacheAndReload = (): void => {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem("quizpro_cloud_cache_questions_v1");
        localStorage.removeItem("quizpro_pending_writes_queue_v1");
      } catch {
        // Ignored
      }
    }
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFF9EF] dark:bg-[#111A2E] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="max-w-md w-full bg-white dark:bg-[#17223B] rounded-3xl p-8 shadow-2xl border border-[#E8D9C0] dark:border-[#25324D] space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#800020]/10 dark:bg-[#800020]/25 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shadow-inner">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight">
                {this.props.fallbackTitle || "Something went wrong"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                DISHA 20-20 encountered an unexpected view error. Your practice progress and bookmark records are safely stored.
              </p>
              {this.state.errorEventId && (
                <div className="pt-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                    Reference: {this.state.errorEventId}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={this.handleRetry}
                className="w-full sm:flex-1 py-3 px-4 bg-[#800020] hover:bg-[#600018] text-[#FFF9EF] rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                Reload Page
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={this.handleClearCacheAndReload}
                className="text-[11px] text-[#800020] dark:text-[#F47B20] font-bold hover:underline cursor-pointer"
              >
                Clear Local Cache & Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
