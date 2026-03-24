"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 mb-4">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-stone-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-stone-400 mb-6 max-w-xs">
            {this.state.error?.message || "An unexpected error occurred. Please try refreshing."}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="btn-secondary flex items-center gap-2 text-sm px-4 py-2"
          >
            <RefreshCw size={14} /> Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
