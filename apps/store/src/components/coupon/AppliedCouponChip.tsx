import { CheckCircle2, Trash2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export interface AppliedCouponChipProps {
  code: string;
  savedAmount: number;
  onRemove: () => void;
  className?: string;
}

export function AppliedCouponChip({
  code,
  savedAmount,
  onRemove,
  className = "",
}: AppliedCouponChipProps) {
  const { t } = useLanguage();

  return (
    <div
      aria-live="polite"
      className={`flex items-center justify-between gap-3 p-3 rounded-2xl bg-success-soft border border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-white shadow-2xs transition-all animate-in fade-in zoom-in-95 duration-200 ${className}`}
    >
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-success flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4 text-success" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-1.5 flex-wrap">
            <span className="font-extrabold text-xs sm:text-sm tracking-wider uppercase text-emerald-800 dark:text-emerald-300">
              {code}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-100">
              {t("cart.saved") || "Applied"}
            </span>
          </div>
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 truncate">
            {t("coupon.saved") || "You saved"} ₹{savedAmount.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`${t("coupon.remove") || "Remove"} ${code}`}
        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-colors cursor-pointer shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t("coupon.remove") || "Remove"}</span>
      </button>
    </div>
  );
}
