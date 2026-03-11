import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-lg border border-error bg-error-light p-8 text-center">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-lg font-semibold text-error">Something went wrong</h2>
          <p className="max-w-md text-sm text-error">{this.state.error?.message || "An unexpected error occurred."}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/90"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
