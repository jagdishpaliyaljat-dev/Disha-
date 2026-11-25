import React from "react";
import { AlertCircle, RotateCcw, X } from "lucide-react";
import { productionMonitor } from "../utils/productionMonitoring";

interface OverlayErrorBoundaryProps {
  children: React.ReactNode;
  viewName: string;
  onClose?: () => void;
  onReset?: () => void;
  fallbackComponent?: React.ReactNode;
}

interface OverlayErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  showDetails?: boolean;
}

export class OverlayErrorBoundary extends React.Component<
  OverlayErrorBoundaryProps,
  OverlayErrorBoundaryState
> {
  constructor(props: OverlayErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): OverlayErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[OverlayErrorBoundary: ${this.props.viewName}]`, error, errorInfo);
    try {
      productionMonitor.captureReactError(error, errorInfo, `Overlay:${this.props.viewName}`);
    } catch {
      // Safe fallback
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: undefined, showDetails: false });
    this.props.onReset?.();
  };

  handleClose = (): void => {
    this.setState({ hasError: false, error: undefined, showDetails: false });
    this.props.onClose?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallbackComponent !== undefined) {
        return this.props.fallbackComponent;
      }
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none"
        >
          <div className="bg-[#F8FAFC] dark:bg-[#1A202C] border border-slate-200 dark:border-[#31275E] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50">
                {this.props.viewName} Encountered an Issue
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This view could not be loaded temporarily. Your practice records and bookmarks are completely safe.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleClose}
                className="w-full sm:flex-1 py-3 px-4 bg-[#7045D8] hover:bg-[#5B32BF] dark:bg-[#7045D8] dark:hover:bg-[#5B32BF] text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Return to Study</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            </div>

            {this.state.error && (
              <div className="pt-2 text-left">
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline cursor-pointer"
                >
                  {this.state.showDetails ? "Hide Error Details" : "Show Error Details"}
                </button>
                {this.state.showDetails && (
                  <div className="mt-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-mono text-rose-600 dark:text-rose-400 break-all select-text max-h-32 overflow-y-auto">
                    <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
                    {this.state.error.stack && (
                      <p className="mt-1 text-[11px] text-slate-400 opacity-80 whitespace-pre-wrap">{this.state.error.stack.slice(0, 300)}</p>
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
