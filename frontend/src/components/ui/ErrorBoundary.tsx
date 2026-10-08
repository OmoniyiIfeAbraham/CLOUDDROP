import { Component } from "react";
import type { ReactNode } from "react";
import { StatusView } from "./StatusView";

interface ErrorBoundaryProps {
  children: ReactNode;
  fullPage?: boolean;
}

interface ErrorBoundaryState {
  failed: boolean;
}

// Shows a recovery screen instead of a blank page when rendering throws.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const view = <StatusView kind="error" title="Something went wrong" description="This page ran into a problem. Reload to try again." onRetry={() => window.location.reload()} />;
    return this.props.fullPage ? <div className="session-recovery">{view}</div> : view;
  }
}
