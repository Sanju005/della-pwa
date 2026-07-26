import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string | null;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Admin dashboard crashed", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="grid min-h-screen place-items-center bg-[linear-gradient(180deg,#f8fff9_0%,#eef8f0_50%,#f8fafc_100%)] px-6 text-center">
        <div className="max-w-xl rounded-[32px] border border-white/80 bg-white/95 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.12)]">
          <h1 className="font-display text-3xl font-bold text-slate-950">
            Admin dashboard could not load
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            Try a hard refresh with Ctrl+F5. If it still fails, clear site data for
            <span className="font-semibold text-slate-700"> admin.myswiper.my</span> and try again.
          </p>
          {this.state.message ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {this.state.message}
            </p>
          ) : null}
        </div>
      </div>
    );
  }
}
