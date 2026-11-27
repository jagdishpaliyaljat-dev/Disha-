import * as React from "react";
import { productionMonitor } from "../../utils/productionMonitoring";

interface AdminErrorBoundaryProps {
  children: React.ReactNode;
}

interface AdminErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class AdminErrorBoundary extends React.Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
  constructor(props: AdminErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("AdminTab failed to mount:", error, errorInfo);
    try {
      productionMonitor.captureReactError(error, errorInfo, "AdminErrorBoundary");
    } catch {
      // Ignore fallback failures
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Admin Module Loading Notice</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-3">
            The Admin Panel module encountered a temporary loading issue. Click retry to reload the panel.
          </p>
          {this.state.error && (
            <p className="text-[10px] font-mono text-rose-500 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 px-3 py-1.5 rounded-xl max-w-md truncate mb-4">
              {this.state.error.message || String(this.state.error)}
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              Retry Loading
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
