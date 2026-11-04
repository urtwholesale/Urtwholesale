import {
  useState,
  useEffect,
  useRef,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Ticket, ChevronRight, Loader2, AlertCircle, X } from "lucide-react";
import { AppliedCouponChip } from "./AppliedCouponChip";
import { useLanguage } from "../../context/LanguageContext";
import { triggerHaptic } from "../../utils/haptics";
import { buttonClasses } from "../ui/buttonStyles";

export interface CouponInputProps {
  onApply: (code: string) => Promise<boolean | void>;
  isLoading: boolean;
  error?: string | null;
  appliedCode?: string | null;
  savedAmount?: number;
  onRemove?: () => void;
  className?: string;
}

export function CouponInput({
  onApply,
  isLoading,
  error,
  appliedCode,
  savedAmount = 0,
  onRemove,
  className = "",
}: CouponInputProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [inputCode, setInputCode] = useState<string>("");
  const [shake, setShake] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // If already applied, stay collapsed or show applied chip
  const isApplied = Boolean(appliedCode && savedAmount > 0);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && !isApplied) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isExpanded, isApplied]);

  // Shake effect on error
  useEffect(() => {
    if (error) {
      setShake(true);
      triggerHaptic("heavy");
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Auto-uppercase, strip inner spaces, cap at 32 chars, allow standard promo code chars
    const cleaned = e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 32);
    setInputCode(cleaned);
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim() || isLoading) return;

    const success = await onApply(inputCode.trim());
    if (success) {
      setInputCode("");
      setIsExpanded(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleFormSubmit(e);
    }
  };

  if (isApplied && appliedCode && onRemove) {
    return (
      <div className={className}>
        <AppliedCouponChip
          code={appliedCode}
          savedAmount={savedAmount}
          onRemove={() => {
            onRemove();
            setInputCode("");
            setIsExpanded(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {!isExpanded ? (
        // Collapsed trigger row
        <button
          type="button"
          onClick={() => {
            setIsExpanded(true);
            triggerHaptic("selection");
          }}
          className="flex items-center justify-between w-full p-3 rounded-2xl border border-dashed border-primary-border bg-primary-soft/50 hover:bg-primary-soft text-primary transition-all cursor-pointer group"
          aria-expanded={false}
          aria-label={t("coupon.have_code") || "Have a coupon code?"}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-primary-soft text-primary border border-primary-border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Ticket className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs sm:text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate">
              {t("coupon.have_code") || "Have a coupon code?"}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-primary text-xs font-bold shrink-0">
            <span>{t("coupon.apply") || "Apply"}</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      ) : (
        // Expanded input container
        <form
          onSubmit={handleFormSubmit}
          className={`p-3 rounded-2xl bg-surface-card border border-surface-border shadow-xs space-y-2 animate-in fade-in zoom-in-95 duration-200 ${
            shake ? "animate-shake" : ""
          }`}
          aria-expanded={true}
        >
          <div className="flex items-center justify-between pb-1 border-b border-surface-border/60">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Ticket className="w-3.5 h-3.5 text-primary" />
              <span>{t("coupon.title") || "Coupons & Discounts"}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                triggerHaptic("light");
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
              aria-label="Close coupon input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputCode}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={t("coupon.placeholder") || "ENTER COUPON CODE"}
                maxLength={32}
                disabled={isLoading}
                aria-label={t("coupon.input_label") || "Enter coupon code"}
                className="w-full h-10 px-3 uppercase text-xs font-bold tracking-wider rounded-xl border border-surface-border bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-text-subtle focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-ring/30 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={!inputCode.trim() || isLoading}
              className={buttonClasses({
                variant: "primary",
                size: "sm",
                className: "h-10 px-4 text-xs font-bold shrink-0",
              })}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t("coupon.applying") || "Applying..."}</span>
                </>
              ) : (
                <span>{t("coupon.apply") || "Apply"}</span>
              )}
            </button>
          </div>

          {/* Inline Error Message */}
          {error && (
            <div
              aria-live="polite"
              className="flex items-center space-x-1.5 text-[11px] font-semibold text-danger pt-0.5 animate-in fade-in"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
