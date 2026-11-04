import { ReactNode } from "react";
import { PackageOpen } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs max-w-md mx-auto my-6">
      <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
        {icon || <PackageOpen className="w-8 h-8 text-brand-dark dark:text-brand" />}
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white tracking-tight">
        {title}
      </h3>
      <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
        {description}
      </p>

      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 h-11 px-5 rounded-xl bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active font-semibold text-xs shadow-xs focus-visible:ring-2 ring-ring ring-offset-2 transition-all cursor-pointer inline-flex items-center justify-center gap-2"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
