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
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white rounded-3xl border border-slate-100 shadow-xs max-w-md mx-auto my-6">
      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
        {icon || <PackageOpen className="w-8 h-8 text-[#0A82A8]/70" />}
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
        {title}
      </h3>
      <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs">
        {description}
      </p>

      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 px-5 py-2.5 rounded-full text-xs font-bold text-white shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
          style={{
            background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
          }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
