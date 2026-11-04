import { useLanguage } from "../../context/LanguageContext";
import { CouponSavingsRow } from "./CouponSavingsRow";

export interface PriceSummaryProps {
  subtotal: number;
  discountAmount?: number;
  couponCode?: string | null;
  shipping: number;
  gstPercent?: number; // inclusive GST percentage, e.g. 18
  marginSavings?: number;
  className?: string;
}

export function PriceSummary({
  subtotal,
  discountAmount = 0,
  couponCode,
  shipping,
  gstPercent,
  marginSavings = 0,
  className = "",
}: PriceSummaryProps) {
  const { t } = useLanguage();

  const effectiveDiscount = Math.min(discountAmount, subtotal);
  const discountedSubtotal = Math.max(0, subtotal - effectiveDiscount);

  const originalTotal = subtotal + shipping;
  const finalTotal = Math.max(0, discountedSubtotal + shipping);

  // Inclusive GST calculation if gstPercent is provided
  const gstRate = gstPercent && gstPercent > 0 ? gstPercent : 18;
  const taxableBase = Math.round((discountedSubtotal / (1 + gstRate / 100)) * 100) / 100;
  const gstAmount = Math.round((discountedSubtotal - taxableBase) * 100) / 100;

  return (
    <div className={`space-y-3 ${className}`} aria-live="polite">
      <div className="space-y-2 text-xs text-text-muted border-b border-surface-border pb-3">
        {/* Items Subtotal */}
        <div className="flex justify-between items-center">
          <span>{t("cart.items_subtotal") || "Items Subtotal"}</span>
          <span className="font-bold text-slate-900 dark:text-white">
            ₹{subtotal.toLocaleString("en-IN")}
          </span>
        </div>

        {/* Wholesale Tier Margin Savings */}
        {marginSavings > 0 && (
          <div className="flex justify-between items-center text-success font-semibold">
            <span>{t("cart.margin_savings") || "Wholesale Margin Savings"}</span>
            <span>-₹{marginSavings.toLocaleString("en-IN")}</span>
          </div>
        )}

        {/* Coupon Discount Row */}
        {effectiveDiscount > 0 && couponCode && (
          <CouponSavingsRow
            code={couponCode}
            discountAmount={effectiveDiscount}
          />
        )}

        {/* GST Notice (Inclusive) */}
        {discountedSubtotal > 0 && (
          <div className="flex justify-between items-center text-[11px] text-text-subtle">
            <span>
              {t("cart.gst_included") || "GST Included (18% ITC Eligible)"}
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              ₹{gstAmount.toLocaleString("en-IN")}
            </span>
          </div>
        )}

        {/* Shipping */}
        <div className="flex justify-between items-center">
          <span>{t("cart.shipping") || "Shipping"}</span>
          <span className="font-semibold text-success">
            {shipping === 0 ? (t("cart.free") || "FREE") : `₹${shipping.toLocaleString("en-IN")}`}
          </span>
        </div>
      </div>

      {/* Estimated Final Total */}
      <div className="flex justify-between items-baseline pt-1">
        <span className="font-black text-sm text-slate-900 dark:text-white">
          {t("cart.estimated_total") || "Estimated Total"}
        </span>

        <div className="flex items-baseline space-x-2 text-right">
          {effectiveDiscount > 0 && (
            <span className="text-xs sm:text-sm text-text-subtle line-through decoration-danger/60 font-semibold">
              ₹{originalTotal.toLocaleString("en-IN")}
            </span>
          )}
          <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            ₹{finalTotal.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </div>
  );
}
