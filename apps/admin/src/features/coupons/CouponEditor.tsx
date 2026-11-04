import { useState, useEffect, useMemo } from "react";
import {
  X,
  Sparkles,
  Ticket,
  Layers,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Tag,
  Percent,
  IndianRupee,
} from "lucide-react";
import type { Coupon, AdminCouponInput, Category } from "@urbanrat/shared";
import { validateAdminCouponInput } from "@urbanrat/shared";
import { upsertCoupon, fetchCategories } from "../../lib/adminService";
import { triggerHaptic } from "../../utils/haptics";

interface CouponEditorProps {
  coupon?: Coupon | null;
  onClose: () => void;
  onSaved: (savedCoupon: Coupon) => void;
}

function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "URT";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function CouponEditor({ coupon, onClose, onSaved }: CouponEditorProps) {
  const isEditing = Boolean(coupon?.id);

  // Form State
  const [code, setCode] = useState(coupon?.code || "");
  const [description, setDescription] = useState(coupon?.description || "");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    coupon?.discount_type || "percent"
  );
  const [discountValue, setDiscountValue] = useState<string>(
    coupon?.discount_value != null ? String(coupon.discount_value) : ""
  );
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<string>(
    coupon?.max_discount_amount != null ? String(coupon.max_discount_amount) : ""
  );
  const [minOrderValue, setMinOrderValue] = useState<string>(
    coupon?.min_order_value != null ? String(coupon.min_order_value) : "0"
  );
  const [startsAt, setStartsAt] = useState<string>(
    coupon?.starts_at ? new Date(coupon.starts_at).toISOString().slice(0, 16) : ""
  );
  const [expiresAt, setExpiresAt] = useState<string>(
    coupon?.expires_at ? new Date(coupon.expires_at).toISOString().slice(0, 16) : ""
  );
  const [usageLimitTotal, setUsageLimitTotal] = useState<string>(
    coupon?.usage_limit_total != null ? String(coupon.usage_limit_total) : ""
  );
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState<string>(
    coupon?.usage_limit_per_customer != null
      ? String(coupon.usage_limit_per_customer)
      : "1"
  );
  const [firstOrderOnly, setFirstOrderOnly] = useState<boolean>(
    coupon?.first_order_only ?? false
  );
  const [categoryIds, setCategoryIds] = useState<string[]>(
    coupon?.category_ids || []
  );
  const [isActive, setIsActive] = useState<boolean>(coupon?.is_active ?? true);

  // Categories for multi-select
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  // Errors and Submission
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => console.warn("Failed to load categories for coupon picker:", err));
  }, []);

  const handleGenerateCode = () => {
    triggerHaptic("selection");
    setCode(generateRandomCode());
    if (errors.code) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.code;
        return next;
      });
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 32);
    setCode(raw);
    if (errors.code) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.code;
        return next;
      });
    }
  };

  const handleToggleCategory = (catId: string) => {
    triggerHaptic("selection");
    setCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const payload: AdminCouponInput = {
      ...(coupon?.id ? { id: coupon.id } : {}),
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      discount_type: discountType,
      discount_value: parseFloat(discountValue) || 0,
      max_discount_amount:
        discountType === "percent" && maxDiscountAmount.trim()
          ? parseFloat(maxDiscountAmount)
          : null,
      min_order_value: parseFloat(minOrderValue) || 0,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      usage_limit_total: usageLimitTotal.trim()
        ? parseInt(usageLimitTotal, 10)
        : null,
      usage_limit_per_customer: parseInt(usageLimitPerCustomer, 10) || 1,
      first_order_only: firstOrderOnly,
      category_ids: categoryIds,
      is_active: isActive,
    };

    // Client-side validation using shared domain rules
    const validationErrors = validateAdminCouponInput(payload);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      triggerHaptic("heavy");
      return;
    }

    setSubmitting(true);
    try {
      const saved = await upsertCoupon(payload);
      triggerHaptic("success");
      onSaved(saved);
      onClose();
    } catch (err: any) {
      triggerHaptic("heavy");
      const msg = err?.message || "Failed to save coupon";
      if (msg.includes("already exists") || msg.includes("unique")) {
        setErrors((prev) => ({
          ...prev,
          code: `A coupon with code "${payload.code}" already exists.`,
        }));
      } else {
        setServerError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Live "Customer will see" preview copy
  const previewCopy = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    const minVal = parseFloat(minOrderValue) || 0;
    const maxVal = parseFloat(maxDiscountAmount) || 0;

    let discountStr = "";
    if (discountType === "percent") {
      discountStr = `${val}% OFF`;
      if (maxVal > 0) discountStr += ` (up to ₹${maxVal})`;
    } else {
      discountStr = `₹${val} OFF`;
    }

    const conditions: string[] = [];
    if (minVal > 0) conditions.push(`on orders over ₹${minVal.toLocaleString("en-IN")}`);
    if (firstOrderOnly) conditions.push("first order only");
    if (categoryIds.length > 0) conditions.push(`on ${categoryIds.length} select category(ies)`);

    return `${discountStr} ${conditions.join(" • ")}`;
  }, [discountType, discountValue, maxDiscountAmount, minOrderValue, firstOrderOnly, categoryIds]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-editor-title"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-primary-soft text-primary border border-primary-border flex items-center justify-center">
              <Ticket className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 id="coupon-editor-title" className="font-extrabold text-base text-slate-900">
                {isEditing ? `Edit Coupon: ${coupon?.code}` : "Create New Coupon"}
              </h2>
              <p className="text-xs text-slate-500">
                Configure promotional discount value, duration and usage conditions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onClose();
            }}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {serverError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* 1. Code & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-6 space-y-1">
              <label className="block font-bold text-slate-700">
                Coupon Code <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="e.g. DIWALI500"
                  maxLength={32}
                  className={`w-full h-10 px-3 uppercase font-mono font-bold tracking-wider rounded-xl border bg-slate-50/60 focus:bg-white transition-all outline-none ${
                    errors.code
                      ? "border-rose-400 ring-1 ring-rose-400"
                      : "border-slate-200 focus:border-primary focus:ring-2 focus:ring-ring/30"
                  }`}
                />
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  title="Generate random code"
                  className="h-10 px-3 rounded-xl bg-primary-soft hover:bg-primary-soft/80 text-primary border border-primary-border font-bold shrink-0 flex items-center space-x-1 transition active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Random</span>
                </button>
              </div>
              {errors.code && (
                <p className="text-[11px] font-semibold text-rose-600">{errors.code}</p>
              )}
            </div>

            <div className="sm:col-span-6 space-y-1">
              <label className="block font-bold text-slate-700">Campaign Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Diwali festive wholesale discount"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-ring/30 transition-all outline-none"
              />
            </div>
          </div>

          {/* 2. Type & Values */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 pt-2 border-t border-slate-100">
            {/* Discount Type Segmented Control */}
            <div className="sm:col-span-5 space-y-1">
              <label className="block font-bold text-slate-700">Discount Type</label>
              <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200/80 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setDiscountType("percent");
                  }}
                  className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    discountType === "percent"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>Percentage</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setDiscountType("fixed");
                  }}
                  className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    discountType === "fixed"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <IndianRupee className="w-3.5 h-3.5" />
                  <span>Fixed (₹)</span>
                </button>
              </div>
            </div>

            {/* Discount Value */}
            <div className="sm:col-span-4 space-y-1">
              <label className="block font-bold text-slate-700">
                Discount Value ({discountType === "percent" ? "%" : "₹"}){" "}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={discountType === "percent" ? "100" : undefined}
                value={discountValue}
                onChange={(e) => {
                  setDiscountValue(e.target.value);
                  if (errors.discount_value) {
                    setErrors((p) => {
                      const next = { ...p };
                      delete next.discount_value;
                      return next;
                    });
                  }
                }}
                placeholder={discountType === "percent" ? "e.g. 15" : "e.g. 250"}
                className={`w-full h-10 px-3 font-bold rounded-xl border bg-slate-50/60 focus:bg-white transition-all outline-none ${
                  errors.discount_value
                    ? "border-rose-400 ring-1 ring-rose-400"
                    : "border-slate-200 focus:border-primary focus:ring-2 focus:ring-ring/30"
                }`}
              />
              {errors.discount_value && (
                <p className="text-[11px] font-semibold text-rose-600">{errors.discount_value}</p>
              )}
            </div>

            {/* Max Discount Cap (Only for percent) */}
            {discountType === "percent" && (
              <div className="sm:col-span-3 space-y-1">
                <label className="block font-bold text-slate-700">Max Discount (₹)</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={maxDiscountAmount}
                  onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  placeholder="Optional cap"
                  className="w-full h-10 px-3 font-bold rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-ring/30 transition-all outline-none"
                />
              </div>
            )}

            {/* Minimum Order Value */}
            <div className="sm:col-span-4 space-y-1">
              <label className="block font-bold text-slate-700">Min. Order Value (₹)</label>
              <input
                type="number"
                step="1"
                min="0"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                placeholder="0 for none"
                className="w-full h-10 px-3 font-bold rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-ring/30 transition-all outline-none"
              />
            </div>
          </div>

          {/* 3. Validity Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Starts At</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-ring/30 transition-all outline-none font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Expires At</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => {
                  setExpiresAt(e.target.value);
                  if (errors.expires_at) {
                    setErrors((p) => {
                      const next = { ...p };
                      delete next.expires_at;
                      return next;
                    });
                  }
                }}
                className={`w-full h-10 px-3 rounded-xl border bg-slate-50/60 focus:bg-white transition-all outline-none font-medium ${
                  errors.expires_at
                    ? "border-rose-400 ring-1 ring-rose-400"
                    : "border-slate-200 focus:border-primary focus:ring-2 focus:ring-ring/30"
                }`}
              />
              {errors.expires_at && (
                <p className="text-[11px] font-semibold text-rose-600">{errors.expires_at}</p>
              )}
            </div>
          </div>

          {/* 4. Limits & Restrictions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-slate-100">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Total Usage Limit</label>
              <input
                type="number"
                min="1"
                step="1"
                value={usageLimitTotal}
                onChange={(e) => setUsageLimitTotal(e.target.value)}
                placeholder="Blank for unlimited"
                className="w-full h-10 px-3 font-medium rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-ring/30 transition-all outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Per-Customer Limit</label>
              <input
                type="number"
                min="1"
                step="1"
                value={usageLimitPerCustomer}
                onChange={(e) => setUsageLimitPerCustomer(e.target.value)}
                placeholder="Default 1"
                className="w-full h-10 px-3 font-medium rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-ring/30 transition-all outline-none"
              />
            </div>

            <div className="space-y-1 flex flex-col justify-end">
              <label className="flex items-center space-x-2.5 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={firstOrderOnly}
                  onChange={(e) => setFirstOrderOnly(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-ring/30 cursor-pointer"
                />
                <span className="font-bold text-slate-800">First-Order Only</span>
              </label>
            </div>
          </div>

          {/* 5. Category Restrictions Multi-Select */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Category Restrictions</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {categoryIds.length === 0
                  ? "Applies to all products in catalog"
                  : `${categoryIds.length} category(ies) selected`}
              </span>
            </div>

            {/* Selected category chips */}
            {categoryIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-xl bg-slate-50 border border-slate-200/80">
                {categoryIds.map((cid) => {
                  const cat = categories.find((c) => c.id === cid);
                  return (
                    <span
                      key={cid}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-800 shadow-2xs"
                    >
                      <span>{cat?.name || "Category"}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(cid)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCategoryIds([])}
                  className="text-[10px] text-rose-600 font-bold hover:underline px-1 py-0.5 cursor-pointer self-center"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Category search & pick */}
            <div className="relative">
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => {
                  setCategorySearch(e.target.value);
                  setCategoryDropdownOpen(true);
                }}
                onFocus={() => setCategoryDropdownOpen(true)}
                placeholder="Search categories to add restriction..."
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-ring/30 transition-all outline-none"
              />

              {categoryDropdownOpen && (
                <div className="absolute top-10 inset-x-0 max-h-48 overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-xl z-20 p-1.5 space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 text-[10px] text-slate-400">
                    <span>Click category to toggle</span>
                    <button
                      type="button"
                      onClick={() => setCategoryDropdownOpen(false)}
                      className="font-bold hover:underline text-slate-600 cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                  {filteredCategories.slice(0, 30).map((cat) => {
                    const isSelected = categoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                          isSelected
                            ? "bg-primary-soft text-primary font-bold"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 6. Active Toggle & Live Preview */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div>
                <p className="font-bold text-slate-900">Campaign Active Status</p>
                <p className="text-[11px] text-slate-400">
                  When active, eligible buyers can apply this coupon in store checkout
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setIsActive(!isActive);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive ? "bg-emerald-600" : "bg-slate-300"
                }`}
                role="switch"
                aria-checked={isActive}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    isActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Live "Customer will see" Preview Card */}
            <div className="p-3.5 rounded-2xl bg-primary-soft/60 border border-primary-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center space-x-1">
                  <Tag className="w-3 h-3" />
                  <span>Customer Live Preview</span>
                </span>
                <span className="font-mono text-xs font-black uppercase text-slate-900">
                  {code || "YOURCODE"}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800">
                {previewCopy || "Configure discount values above"}
              </p>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onClose();
              }}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary-active text-on-primary font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Coupon...</span>
                </>
              ) : (
                <span>{isEditing ? "Save Changes" : "Create Coupon"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

