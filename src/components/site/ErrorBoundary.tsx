import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = {
  children: ReactNode;
  /** Name of the UI block, shown in the fallback widget. */
  label?: string;
};

type State = { error: Error | null; key: number };

/**
 * Isolated error boundary: a crash inside `children` renders a small fallback
 * widget with a retry button instead of freezing/blanking the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, key: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.label ?? "block", error, info.componentStack);
    reportLovableError(error, { boundary: this.props.label ?? "ui_error_boundary" });
  }

  retry = () => {
    this.setState((s) => ({ error: null, key: s.key + 1 }));
  };

  override render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-center">
          <AlertTriangle className="mx-auto size-6 text-destructive" />
          <p className="mt-3 text-sm font-bold text-foreground">
            تعذّر تحميل هذا القسم · This section failed to load
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {this.props.label ? `${this.props.label} — ` : ""}
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            <RotateCcw className="size-3.5" />
            إعادة المحاولة · Retry Component
          </button>
        </div>
      );
    }

    return <div key={this.state.key} className="contents">{this.props.children}</div>;
  }
}
