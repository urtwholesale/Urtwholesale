import { useLanguage } from "../../context/LanguageContext";

export interface CouponSavingsRowProps {
  code: string;
  discountAmount: number;
  className?: string;
}

export function CouponSavingsRow({
  code,
  discountAmount,
  className = "",
}: CouponSavingsRowProps) {
  const { t } = useLanguage();

  if (discountAmount <= 0) return null;

  return (
    <div
      className={`flex justify-between items-center text-xs font-semibold text-success animate-in fade-in duration-200 ${className}`}
      aria-live="polite"
    >
      <span className="flex items-center space-x-1 truncate pr-2">
        <span>{t("coupon.summary_label") || "Coupon"}</span>
        <span className="font-extrabold uppercase text-[11px] px-1.5 py-0.5 rounded-md bg-success-soft text-emerald-800 dark:text-emerald-300">
          ({code})
        </span>
      </span>
      <span className="shrink-0 font-black tracking-tight">
        -₹{discountAmount.toLocaleString("en-IN")}
      </span>
    </div>
  );
}
