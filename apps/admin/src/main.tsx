import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AdminErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error("[Urbanrat Admin Runtime Error]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#ECEEED] flex items-center justify-center p-4 font-sans">
          <div className="bg-white p-6 sm:p-8 rounded-3xl max-w-md w-full text-center shadow-lg border border-rose-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-base font-bold text-slate-800">Admin Portal Error</h2>
            <p className="text-xs text-slate-500">
              {this.state.error?.message || "An unexpected error occurred while loading the admin interface."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs bg-brand-dark hover:bg-[#086b8b] transition cursor-pointer"
            >
              Reload Admin Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AdminErrorBoundary>
      <App />
    </AdminErrorBoundary>
  </StrictMode>
);
