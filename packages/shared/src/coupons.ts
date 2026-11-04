import type { AdminCouponInput, CouponType } from "./types/coupon";

/**
 * Normalizes a raw coupon code:
 * - Trims leading and trailing whitespace
 * - Converts to uppercase
 * - Strips all internal whitespace
 * - Restricts to permitted characters: A-Z, 0-9, _, -
 * - Truncates to a maximum of 32 characters
 */
export function normalizeCouponCode(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

/**
 * Validates whether a coupon code adheres to the canonical format:
 * 1-32 characters consisting solely of uppercase alphanumerics, underscores, and dashes.
 */
export function isValidCouponCodeFormat(code: string | null | undefined): boolean {
  if (!code || typeof code !== "string") return false;
  if (code.length < 1 || code.length > 32) return false;
  return /^[A-Z0-9_-]+$/.test(code);
}

export interface CalculateCouponDiscountParams {
  type: CouponType;
  value: number;
  maxDiscount?: number | null;
  eligibleSubtotal: number;
}

/**
 * Calculates the monetary discount provided by a coupon:
 * - Rounds to 2 decimal places
 * - Never exceeds the eligible subtotal
 * - Never produces negative values
 * - For percentage coupons, applies maxDiscount cap if defined
 */
export function calculateCouponDiscount({
  type,
  value,
  maxDiscount,
  eligibleSubtotal,
}: CalculateCouponDiscountParams): number {
  if (
    !eligibleSubtotal ||
    eligibleSubtotal <= 0 ||
    !value ||
    value <= 0 ||
    isNaN(eligibleSubtotal) ||
    isNaN(value)
  ) {
    return 0;
  }

  let discount = 0;
  if (type === "percent") {
    discount = eligibleSubtotal * (value / 100);
    if (maxDiscount != null && maxDiscount > 0 && !isNaN(maxDiscount)) {
      discount = Math.min(discount, maxDiscount);
    }
  } else {
    discount = Math.min(value, eligibleSubtotal);
  }

  discount = Math.min(discount, eligibleSubtotal);
  discount = Math.max(discount, 0);

  return Math.round((discount + Number.EPSILON) * 100) / 100;
}

export interface GstCalculationResult {
  taxableAmount: number;
  gstAmount: number;
  totalWithGst: number;
}

/**
 * Computes GST on a discounted subtotal:
 * Taxable Amount = Subtotal - Discount
 * GST Amount = Taxable Amount * (gstPercent / 100)
 * All monetary amounts rounded to 2 decimal places.
 */
export function computeGstOnDiscountedTotal(
  subtotal: number,
  discount: number,
  gstPercent: number
): GstCalculationResult {
  const cleanSubtotal = Math.max(0, Number(subtotal) || 0);
  const cleanDiscount = Math.min(cleanSubtotal, Math.max(0, Number(discount) || 0));
  const taxableAmount = Math.round((cleanSubtotal - cleanDiscount + Number.EPSILON) * 100) / 100;

  const cleanGstPercent = Math.max(0, Number(gstPercent) || 0);
  const gstAmount = Math.round((taxableAmount * (cleanGstPercent / 100) + Number.EPSILON) * 100) / 100;
  const totalWithGst = Math.round((taxableAmount + gstAmount + Number.EPSILON) * 100) / 100;

  return {
    taxableAmount,
    gstAmount,
    totalWithGst,
  };
}

/**
 * Validates administrative coupon creation/update input and returns a dictionary of field errors.
 */
export function validateAdminCouponInput(input: AdminCouponInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input) {
    errors.general = "Coupon payload is required.";
    return errors;
  }

  // Code validation
  const code = (input.code || "").trim();
  if (!code) {
    errors.code = "Coupon code is required.";
  } else if (!isValidCouponCodeFormat(code)) {
    errors.code = "Coupon code must be 1-32 alphanumeric characters, dashes, or underscores.";
  }

  // Discount type validation
  if (input.discount_type !== "percent" && input.discount_type !== "fixed") {
    errors.discount_type = "Discount type must be either 'percent' or 'fixed'.";
  }

  // Discount value validation
  if (input.discount_value == null || isNaN(input.discount_value) || input.discount_value <= 0) {
    errors.discount_value = "Discount value must be greater than 0.";
  } else if (input.discount_type === "percent" && input.discount_value > 100) {
    errors.discount_value = "Percentage discount cannot exceed 100%.";
  }

  // Max discount cap validation
  if (input.max_discount_amount != null && (isNaN(input.max_discount_amount) || input.max_discount_amount <= 0)) {
    errors.max_discount_amount = "Maximum discount amount must be greater than 0 if provided.";
  }

  // Minimum order value validation
  if (input.min_order_value != null && (isNaN(input.min_order_value) || input.min_order_value < 0)) {
    errors.min_order_value = "Minimum order value cannot be negative.";
  }

  // Date range validation
  if (input.starts_at && input.expires_at) {
    const startTime = new Date(input.starts_at).getTime();
    const endTime = new Date(input.expires_at).getTime();
    if (!isNaN(startTime) && !isNaN(endTime) && endTime <= startTime) {
      errors.expires_at = "Expiry date must be later than start date.";
    }
  }

  // Per-customer limit validation
  if (
    input.usage_limit_per_customer != null &&
    (isNaN(input.usage_limit_per_customer) ||
      input.usage_limit_per_customer < 1 ||
      !Number.isInteger(input.usage_limit_per_customer))
  ) {
    errors.usage_limit_per_customer = "Usage limit per customer must be an integer of at least 1.";
  }

  // Total limit validation
  if (
    input.usage_limit_total != null &&
    (isNaN(input.usage_limit_total) ||
      input.usage_limit_total <= 0 ||
      !Number.isInteger(input.usage_limit_total))
  ) {
    errors.usage_limit_total = "Total usage limit must be a positive integer.";
  }

  return errors;
}

/**
 * Maps technical error codes or server error messages to friendly, localized customer copy.
 */
export function mapCouponErrorMessage(codeOrMessage: string | null | undefined): string {
  if (!codeOrMessage) {
    return "This coupon is not valid for your cart.";
  }

  const raw = codeOrMessage.trim();

  // If already a clean user-facing server message, preserve it
  if (raw.startsWith("Minimum order of ₹")) {
    return raw;
  }
  if (raw === "Coupon expired" || raw === "COUPON_EXPIRED") {
    return "This coupon has expired.";
  }
  if (raw === "Too many attempts. Try again later." || raw === "RATE_LIMITED") {
    return "Too many coupon attempts. Please wait 10 minutes before trying again.";
  }
  if (
    raw.includes("redemption limit") ||
    raw.includes("reached the redemption limit") ||
    raw === "LIMIT_REACHED"
  ) {
    return "You have already reached the redemption limit for this coupon.";
  }
  if (raw.includes("first order") || raw.includes("first-time") || raw === "FIRST_ORDER_ONLY") {
    return "This coupon is only valid for your first order.";
  }
  if (
    raw.includes("not applicable to any") ||
    raw.includes("not valid for any items") ||
    raw === "CATEGORY_NOT_ELIGIBLE"
  ) {
    return "This coupon is not applicable to any products currently in your cart.";
  }
  if (raw.includes("Cart is empty")) {
    return "Your cart is empty. Please add items before applying a coupon.";
  }
  if (raw.includes("COUPON_INVALID") || raw.includes("does not exist") || raw.includes("not valid for your cart")) {
    return "This coupon code is not valid for your cart.";
  }

  return raw;
}

