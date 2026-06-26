"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** Optional fallback to show instead of the generic error UI */
  fallback?: React.ReactNode;
  /** Label for the error context, e.g. "Dashboard" */
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * H7: Feature-level error boundary.
 *
 * Wraps feature components so that a runtime error in one feature does not
 * crash the entire dashboard. Uses a React class component because the
 * getDerivedStateFromError lifecycle is not available as a hook.
 *
 * Usage:
 *   <FeatureErrorBoundary context="Notifications">
 *     <NotificationBell />
 *   </FeatureErrorBoundary>
 */
export class FeatureErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in all envs; swap for a monitoring service (Sentry, etc.) in production
    console.error(
      `[FeatureErrorBoundary${this.props.context ? ` — ${this.props.context}` : ""}]`,
      error,
      info.componentStack,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-400/20 bg-red-50/60 p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {this.props.context
                ? `${this.props.context} failed to load`
                : "Something went wrong"}
            </p>
            <p className="mt-1 text-xs text-red-500/80">
              {process.env.NODE_ENV !== "production" && this.state.error?.message
                ? this.state.error.message
                : "Please try refreshing this section."}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
          >
            <RotateCcw className="h-3 w-3" /> Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
