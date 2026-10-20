import { useState, useEffect } from "react";
import { Minus, Plus } from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

export interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: "sm" | "md";
  onBelowMin?: () => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
}

/**
 * Modern B2B Quantity Stepper & Direct Numeric Input.
 *
 * Allows wholesale buyers to either step with [-] and [+] buttons OR directly tap/click
 * and type large volume quantities (e.g., 50, 100, 250) with immediate live price calculation.
 */
export function QuantityInput({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  size = "md",
  onBelowMin,
  disabled = false,
  className = "",
  id,
  ariaLabel = "Quantity",
}: QuantityInputProps) {
  const [localValue, setLocalValue] = useState<string>(String(value));

  // Sync from external value changes (e.g. from parent re-fetch or external state changes)
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  function handleDecrement() {
    if (disabled) return;
    triggerHaptic("selection");
    if (value - step < min) {
      if (onBelowMin) {
        onBelowMin();
      } else {
        onChange(min);
        setLocalValue(String(min));
      }
    } else {
      const next = value - step;
      onChange(next);
      setLocalValue(String(next));
    }
  }

  function handleIncrement() {
    if (disabled) return;
    triggerHaptic("selection");
    const next = value + step;
    if (max && max > 0 && next > max) {
      triggerHaptic("heavy");
      return;
    }
    onChange(next);
    setLocalValue(String(next));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    // Allow only numeric digits
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setLocalValue(raw);

    if (raw !== "") {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) {
        // Clamp to max if stock is bounded
        let clamped = parsed;
        if (max && max > 0 && clamped > max) {
          clamped = max;
        }
        // If it's at least min, immediately notify parent so live price calculations update
        if (clamped >= min) {
          onChange(clamped);
        }
      }
    }
  }

  function handleBlur() {
    if (disabled) return;
    const parsed = parseInt(localValue, 10);

    // If completely empty or 0 and an onBelowMin handler exists (e.g. in cart), trigger it
    if ((isNaN(parsed) || parsed <= 0) && onBelowMin) {
      onBelowMin();
      return;
    }

    // If empty or less than min, clamp to min
    if (isNaN(parsed) || parsed < min) {
      setLocalValue(String(min));
      onChange(min);
      return;
    }

    // Clamp to stock max if provided
    let finalVal = parsed;
    if (max && max > 0 && finalVal > max) {
      finalVal = max;
    }

    setLocalValue(String(finalVal));
    onChange(finalVal);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      handleDecrement();
    }
  }

  const isMinDisabled = !onBelowMin && value <= min;
  const isMaxDisabled = Boolean(max && max > 0 && value + step > max);
  const isSm = size === "sm";

  return (
    <div
      className={`inline-flex items-center border border-slate-200/90 rounded-xl bg-slate-50 shadow-2xs transition-all focus-within:border-brand-dark/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-dark/15 ${
        disabled ? "opacity-50 pointer-events-none" : ""
      } ${className}`}
    >
      {/* Decrement Button */}
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || isMinDisabled}
        aria-label="Decrease quantity"
        className={`${
          isSm ? "w-7 h-7" : "w-8 h-8 sm:w-9 sm:h-9"
        } flex items-center justify-center text-slate-500 hover:text-slate-900 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer select-none`}
      >
        <Minus className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
      </button>

      {/* Editable Numeric Input Field */}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={ariaLabel}
        value={localValue}
        onChange={handleInputChange}
        onFocus={(e) => e.target.select()}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`${
          isSm
            ? "w-11 sm:w-12 text-xs py-0.5"
            : "w-13 sm:w-16 text-xs sm:text-sm py-1"
        } text-center font-black text-slate-800 bg-transparent focus:bg-white focus:outline-none rounded-md transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none selection:bg-brand-dark/20 selection:text-slate-900`}
      />

      {/* Increment Button */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || isMaxDisabled}
        aria-label="Increase quantity"
        className={`${
          isSm ? "w-7 h-7" : "w-8 h-8 sm:w-9 sm:h-9"
        } flex items-center justify-center text-slate-500 hover:text-slate-900 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer select-none`}
      >
        <Plus className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
      </button>
    </div>
  );
}
