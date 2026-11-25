import React from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { productionMonitor } from "../utils/productionMonitoring";

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  onNavigateHome?: () => void;
  tabName?: string;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[RouteErrorBoundary: ${this.props.tabName || "Route"}]`, error, errorInfo);
    try {
      productionMonitor.captureReactError(error, errorInfo, `Route:${this.props.tabName || "unknown"}`);
    } catch {
      // Safe fallback
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: undefined });
    this.props.onNavigateHome?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-12 text-center max-w-md mx-auto"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#A78BFA]/15 border border-[#A78BFA]/30 text-amber-500 flex items-center justify-center mb-5 shadow-lg shadow-[#A78BFA]/5">
            <AlertTriangle className="w-8 h-8 stroke-[2]" />
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
            Section Temporarily Unavailable
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
            An unexpected error occurred while loading this section. Your progress and saved data remain completely safe.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 w-full sm:w-auto">
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7045D8] to-[#5B32BF] hover:brightness-105 text-white font-black text-xs uppercase tracking-wider shadow-[0_4px_14px_rgba(244,123,32,0.35)] border border-[#A78BFA]/40 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry</span>
            </button>

            <button
              type="button"
              onClick={this.handleGoHome}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] border border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-50 font-bold text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
