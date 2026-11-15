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
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            The Admin Panel module encountered a temporary loading issue. Click retry to reload the panel.
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
