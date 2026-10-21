import { useState, useRef, useId, type KeyboardEvent, type ClipboardEvent } from "react";
import { Tag, X, AlertCircle } from "lucide-react";
import { normalizeKeywords } from "@urbanrat/shared";
import { triggerHaptic } from "../../../utils/haptics";

export interface KeywordsInputProps {
  value: string[];
  onChange: (keywords: string[]) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  helperText?: string;
  placeholder?: string;
  id?: string;
}

const MAX_KEYWORDS = 30;
const MAX_LENGTH = 50;

/**
 * Reusable, accessible, mobile-first Search Keywords input component with tag chips.
 * Enforces brand styling, haptic feedback, duplicate prevention, and length limits.
 */
export function KeywordsInput({
  value = [],
  onChange,
  disabled = false,
  className = "",
  label = "Search Keywords",
  helperText = "Add words buyers might search for: alternate names, model numbers, compatible devices, common misspellings.",
  placeholder = "Type a keyword and press Enter or comma (e.g. fast charger, type c cable)",
  id: customId,
}: KeywordsInputProps) {
  const autoId = useId();
  const inputId = customId || `keywords-input-${autoId}`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const currentCount = value.length;
  const isAtLimit = currentCount >= MAX_KEYWORDS;

  /**
   * Processes a raw string or pasted list and updates chips
   */
  function handleAdd(rawText: string) {
    if (!rawText || !rawText.trim() || disabled) {
      setInputValue("");
      return;
    }

    // Split by comma, semicolon, pipe, newline
    const tokens = rawText.split(/[,;|\n\r]+/);
    let addedCount = 0;
    let duplicateFound = false;
    let truncatedFound = false;

    const nextKeywords = [...value];
    const seen = new Set(nextKeywords.map((k) => k.toLowerCase()));

    for (const raw of tokens) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      if (trimmed.length > MAX_LENGTH) {
        truncatedFound = true;
      }

      // Normalize single token
      const [normalized] = normalizeKeywords(trimmed);
      if (!normalized) continue;

      if (seen.has(normalized)) {
        duplicateFound = true;
        continue;
      }

      if (nextKeywords.length >= MAX_KEYWORDS) {
        break;
      }

      seen.add(normalized);
      nextKeywords.push(normalized);
      addedCount++;
    }

    if (addedCount > 0) {
      triggerHaptic("selection");
      onChange(nextKeywords);
      setInputValue("");
    } else {
      setInputValue("");
    }

    // Dynamic feedback messages
    if (nextKeywords.length >= MAX_KEYWORDS && rawText.length > 0 && addedCount === 0) {
      triggerHaptic("heavy");
      setFeedback(`Maximum limit of ${MAX_KEYWORDS} keywords reached.`);
    } else if (duplicateFound && addedCount === 0) {
      triggerHaptic("heavy");
      setFeedback("Duplicate keyword ignored. It is already added.");
    } else if (truncatedFound) {
      setFeedback(`Keywords exceeding ${MAX_LENGTH} characters were truncated.`);
    } else {
      setFeedback(null);
    }
  }

  function handleRemove(indexToRemove: number) {
    if (disabled) return;
    triggerHaptic("selection");
    const updated = value.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
    setFeedback(null);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        handleAdd(inputValue);
      }
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      // Remove last keyword on backspace in empty input
      e.preventDefault();
      handleRemove(value.length - 1);
    }
  }

  function handleBlur() {
    if (inputValue.trim()) {
      handleAdd(inputValue);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (text && /[,;|\n\r]/.test(text)) {
      e.preventDefault();
      handleAdd(text);
    }
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header with Label and Counter */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={inputId}
          className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 cursor-pointer"
        >
          <Tag className="w-3.5 h-3.5 text-brand-dark" />
          <span>{label}</span>
        </label>
        <span
          className={`text-[11px] font-bold ${
            isAtLimit ? "text-rose-600 font-extrabold" : "text-slate-400"
          }`}
          aria-live="polite"
        >
          {currentCount} / {MAX_KEYWORDS}
        </span>
      </div>

      {/* Input container with chips inside/below */}
      <div
        className={`w-full min-h-11.5 p-2 bg-white border rounded-2xl shadow-2xs transition-all flex flex-col gap-2 ${
          feedback
            ? "border-rose-300 ring-2 ring-rose-100"
            : "border-slate-200 focus-within:ring-2 focus-within:ring-brand-light focus-within:border-brand"
        } ${disabled ? "opacity-60 pointer-events-none bg-slate-50" : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Chips list */}
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="list" aria-label="Selected search keywords">
            {value.map((kw, index) => (
              <span
                key={`${kw}-${index}`}
                role="listitem"
                tabIndex={0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-brand-light/20 text-brand-dark text-xs font-semibold border border-brand-light/40 shadow-2xs transition-all focus:outline-none focus:ring-1 focus:ring-brand active:scale-95"
              >
                <span>#{kw}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(index);
                    }}
                    aria-label={`Remove keyword ${kw}`}
                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-brand-dark/15 text-brand-dark transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Text Input */}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={inputValue}
          disabled={disabled || isAtLimit}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (feedback) setFeedback(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
          placeholder={isAtLimit ? `Maximum limit of ${MAX_KEYWORDS} keywords reached` : placeholder}
          className="w-full px-2 py-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      {/* Inline Feedback / Errors */}
      {feedback && (
        <p className="text-xs text-rose-600 font-medium flex items-center space-x-1.5 animate-fade-in" role="alert">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{feedback}</span>
        </p>
      )}

      {/* Helper text */}
      {helperText && !feedback && (
        <p className="text-[11px] text-slate-500 leading-relaxed">{helperText}</p>
      )}
    </div>
  );
}
