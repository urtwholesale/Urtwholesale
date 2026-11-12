import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { SettingsProvider } from "./context/SettingsContext";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import "./index.css";

interface StoreErrorBoundaryProps {
  children: ReactNode;
}

interface StoreErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class StoreErrorBoundary extends Component<StoreErrorBoundaryProps, StoreErrorBoundaryState> {
  constructor(props: StoreErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error("[Store Runtime Error]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white p-6 sm:p-8 rounded-3xl max-w-md w-full text-center shadow-lg border border-slate-200/80 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-base font-bold text-slate-900">Application Error</h2>
            <p className="text-xs text-slate-500">
              {this.state.error?.message || "An unexpected error occurred while loading the store."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs bg-slate-900 hover:bg-slate-800 active:bg-black transition cursor-pointer"
            >
              Reload Store
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
    <StoreErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <LanguageProvider>
            <SettingsProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </SettingsProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </StoreErrorBoundary>
  </StrictMode>,
);

