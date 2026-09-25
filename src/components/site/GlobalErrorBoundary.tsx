import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

export function BrandedFallback({ message }: { message?: string }) {
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-4xl font-black text-primary">مُنجِز</p>
        <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <h1 className="mt-6 text-lg font-bold text-foreground">جاري استعادة الاتصال بمُنجِز...</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          حدث خلل مؤقت أثناء تحميل الصفحة. بياناتك وأرصدتك بأمان.
        </p>
        {message ? (
          <pre className="mt-4 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-right text-[11px] text-muted-foreground">
            {message}
          </pre>
        ) : null}
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          العودة للصفحة الرئيسية
        </a>
      </div>
    </div>
  );
}

type State = { error: Error | null };

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[GlobalErrorBoundary]", error, info.componentStack);
    reportLovableError(error, { boundary: "global_error_boundary" });
  }

  override render() {
    if (this.state.error) return <BrandedFallback message={this.state.error.message} />;
    return this.props.children;
  }
}
