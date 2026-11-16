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
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/5">
            <AlertTriangle className="w-8 h-8 stroke-[2]" />
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-[#171923] dark:text-[#FFF9EF] tracking-tight">
            Section Temporarily Unavailable
          </h2>
          <p className="text-sm font-bold text-[#800020] dark:text-[#C99A45] mt-1 font-hindi">
            यह अनुभाग अस्थायी रूप से अनुपलब्ध है
          </p>

          <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] mt-3 leading-relaxed">
            An unexpected error occurred while loading this section. Your progress and saved data remain completely safe.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 w-full sm:w-auto">
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#800020] hover:bg-[#600018] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry / पुनः प्रयास करें</span>
            </button>

            <button
              type="button"
              onClick={this.handleGoHome}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] border border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF] font-bold text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Home / मुख्य पृष्ठ</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
