import React from "react";

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center text-center p-6">
          <h1 className="text-3xl font-semibold mb-4">Something went wrong</h1>
          <p className="text-white/70 mb-6">
            {this.state.error?.message ?? "Unexpected error"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-white text-neutral-900 font-medium hover:opacity-90"
          >
            Reload
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}