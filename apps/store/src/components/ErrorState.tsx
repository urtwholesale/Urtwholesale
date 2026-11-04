import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Unable to load content",
  message = "Something went wrong while connecting to the store server. Please check your connection and try again.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-rose-50/50 rounded-3xl border border-rose-100 shadow-xs max-w-md mx-auto my-6 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-rose-100/70 border border-rose-200/70 flex items-center justify-center text-rose-600 mb-4 shadow-inner">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
        {title}
      </h3>
      <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs">
        {message}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active font-semibold text-xs shadow-xs focus-visible:ring-2 ring-ring ring-offset-2 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
