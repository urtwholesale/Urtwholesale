import { describe, it, expect } from "vitest";
import {
  normalizeCouponCode,
  isValidCouponCodeFormat,
  calculateCouponDiscount,
  computeGstOnDiscountedTotal,
  validateAdminCouponInput,
  mapCouponErrorMessage,
} from "./coupons";
import { calculateCartSummary } from "./pricing";
import type { AdminCouponInput } from "./types/coupon";

describe("Coupon Domain Logic (packages/shared)", () => {
  describe("1. normalizeCouponCode", () => {
    it("trims whitespace and converts to uppercase", () => {
      expect(normalizeCouponCode("  diwali50  ")).toBe("DIWALI50");
      expect(normalizeCouponCode("save_10")).toBe("SAVE_10");
    });

    it("strips all internal whitespace", () => {
      expect(normalizeCouponCode(" save  20   now ")).toBe("SAVE20NOW");
      expect(normalizeCouponCode("FLAT 100")).toBe("FLAT100");
    });

    it("strips disallowed characters and preserves dashes and underscores", () => {
      expect(normalizeCouponCode("welcome@2024!")).toBe("WELCOME2024");
      expect(normalizeCouponCode("mega#deal$50%")).toBe("MEGADEAL50");
      expect(normalizeCouponCode("CYBER-MON_50")).toBe("CYBER-MON_50");
      expect(normalizeCouponCode("urt-glass_pro-100")).toBe("URT-GLASS_PRO-100");
    });

    it("truncates at 32 characters", () => {
      const longCode = "A".repeat(45);
      const normalized = normalizeCouponCode(longCode);
      expect(normalized.length).toBe(32);
      expect(normalized).toBe("A".repeat(32));
    });

    it("handles null, undefined, and empty string safely", () => {
      expect(normalizeCouponCode(null)).toBe("");
      expect(normalizeCouponCode(undefined)).toBe("");
      expect(normalizeCouponCode("")).toBe("");
      expect(normalizeCouponCode("   ")).toBe("");
    });
  });

  describe("2. isValidCouponCodeFormat", () => {
    it("accepts valid alphanumeric coupon codes with dashes and underscores", () => {
      expect(isValidCouponCodeFormat("SAVE20")).toBe(true);
      expect(isValidCouponCodeFormat("URT-WHOLESALE_100")).toBe(true);
      expect(isValidCouponCodeFormat("A")).toBe(true);
      expect(isValidCouponCodeFormat("12345")).toBe(true);
      expect(isValidCouponCodeFormat("A".repeat(32))).toBe(true);
    });

    it("rejects invalid formats, spaces, symbols, and length violations", () => {
      expect(isValidCouponCodeFormat("")).toBe(false);
      expect(isValidCouponCodeFormat(null as any)).toBe(false);
      expect(isValidCouponCodeFormat(undefined as any)).toBe(false);
      expect(isValidCouponCodeFormat("save 20")).toBe(false);
      expect(isValidCouponCodeFormat("SAVE 20")).toBe(false);
      expect(isValidCouponCodeFormat("SAVE#20")).toBe(false);
      expect(isValidCouponCodeFormat("SAVE@OFF")).toBe(false);
      expect(isValidCouponCodeFormat("A".repeat(33))).toBe(false);
    });
  });

  describe("3. calculateCouponDiscount", () => {
    describe("percentage discounts", () => {
      it("calculates percentage discount accurately without cap", () => {
        const discount = calculateCouponDiscount({
          type: "percent",
          value: 10,
          eligibleSubtotal: 1500,
        });
        expect(discount).toBe(150);
      });

      it("enforces maxDiscount cap when discount exceeds cap", () => {
        const discount = calculateCouponDiscount({
          type: "percent",
          value: 20,
          maxDiscount: 100,
          eligibleSubtotal: 1000,
        });
        expect(discount).toBe(100);
      });

      it("does not clamp when discount is below maxDiscount cap", () => {
        const discount = calculateCouponDiscount({
          type: "percent",
          value: 10,
          maxDiscount: 500,
          eligibleSubtotal: 1000,
        });
        expect(discount).toBe(100);
      });
    });

    describe("fixed discounts", () => {
      it("applies fixed discount when subtotal is larger", () => {
        const discount = calculateCouponDiscount({
          type: "fixed",
          value: 150,
          eligibleSubtotal: 500,
        });
        expect(discount).toBe(150);
      });

      it("clamps fixed discount to eligibleSubtotal when discount is larger than subtotal", () => {
        const discount = calculateCouponDiscount({
          type: "fixed",
          value: 500,
          eligibleSubtotal: 200,
        });
        expect(discount).toBe(200);
      });
    });

    describe("rounding and zero/negative subtotal edge cases", () => {
      it("rounds fractional calculations to 2 decimal places", () => {
        const discount = calculateCouponDiscount({
          type: "percent",
          value: 15,
          eligibleSubtotal: 33.33,
        });
        // 33.33 * 0.15 = 4.9995 -> 5.00
        expect(discount).toBe(5);

        const discount2 = calculateCouponDiscount({
          type: "percent",
          value: 12.5,
          eligibleSubtotal: 105.75,
        });
        // 105.75 * 0.125 = 13.21875 -> 13.22
        expect(discount2).toBe(13.22);
      });

      it("returns 0 for zero or negative subtotal", () => {
        expect(
          calculateCouponDiscount({
            type: "percent",
            value: 20,
            eligibleSubtotal: 0,
          })
        ).toBe(0);

        expect(
          calculateCouponDiscount({
            type: "fixed",
            value: 100,
            eligibleSubtotal: -50,
          })
        ).toBe(0);
      });

      it("returns 0 for non-positive discount values", () => {
        expect(
          calculateCouponDiscount({
            type: "percent",
            value: 0,
            eligibleSubtotal: 500,
          })
        ).toBe(0);

        expect(
          calculateCouponDiscount({
            type: "fixed",
            value: -50,
            eligibleSubtotal: 500,
          })
        ).toBe(0);
      });
    });
  });

  describe("4. computeGstOnDiscountedTotal", () => {
    it("computes taxable amount, GST amount, and total with GST after discount", () => {
      const res = computeGstOnDiscountedTotal(1000, 200, 18);
      expect(res.taxableAmount).toBe(800);
      expect(res.gstAmount).toBe(144);
      expect(res.totalWithGst).toBe(944);
    });

    it("clamps taxable amount to 0 when discount equals or exceeds subtotal", () => {
      const res = computeGstOnDiscountedTotal(500, 600, 18);
      expect(res.taxableAmount).toBe(0);
      expect(res.gstAmount).toBe(0);
      expect(res.totalWithGst).toBe(0);
    });

    it("handles fractional numbers and rounds correctly", () => {
      // Subtotal 100, discount 15 => Taxable 85. 85 * 0.18 = 15.3 => Total 100.3
      const res = computeGstOnDiscountedTotal(100, 15, 18);
      expect(res.taxableAmount).toBe(85);
      expect(res.gstAmount).toBe(15.3);
      expect(res.totalWithGst).toBe(100.3);
    });
  });

  describe("5. validateAdminCouponInput", () => {
    const validBase: AdminCouponInput = {
      code: "SAVE20",
      description: "20% wholesale discount",
      discount_type: "percent",
      discount_value: 20,
      max_discount_amount: 500,
      min_order_value: 1000,
      starts_at: "2026-11-01T00:00:00Z",
      expires_at: "2026-11-30T23:59:59Z",
      usage_limit_total: 100,
      usage_limit_per_customer: 1,
      first_order_only: false,
      is_active: true,
    };

    it("returns no errors for valid coupon input", () => {
      const errors = validateAdminCouponInput(validBase);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it("validates code requirement and format", () => {
      const errors1 = validateAdminCouponInput({ ...validBase, code: "" });
      expect(errors1.code).toBe("Coupon code is required.");

      const errors2 = validateAdminCouponInput({ ...validBase, code: "INVALID CODE!" });
      expect(errors2.code).toContain("1-32 alphanumeric characters");
    });

    it("validates discount_type", () => {
      const errors = validateAdminCouponInput({
        ...validBase,
        discount_type: "bogo" as any,
      });
      expect(errors.discount_type).toContain("percent");
    });

    it("validates discount_value bounds and percent <= 100", () => {
      const zeroVal = validateAdminCouponInput({ ...validBase, discount_value: 0 });
      expect(zeroVal.discount_value).toContain("greater than 0");

      const negVal = validateAdminCouponInput({ ...validBase, discount_value: -10 });
      expect(negVal.discount_value).toContain("greater than 0");

      const overHundred = validateAdminCouponInput({
        ...validBase,
        discount_type: "percent",
        discount_value: 120,
      });
      expect(overHundred.discount_value).toContain("cannot exceed 100%");

      // Fixed over 100 is valid
      const fixedOverHundred = validateAdminCouponInput({
        ...validBase,
        discount_type: "fixed",
        discount_value: 500,
      });
      expect(fixedOverHundred.discount_value).toBeUndefined();
    });

    it("validates max_discount_amount and min_order_value", () => {
      const negMax = validateAdminCouponInput({ ...validBase, max_discount_amount: -5 });
      expect(negMax.max_discount_amount).toContain("greater than 0");

      const negMin = validateAdminCouponInput({ ...validBase, min_order_value: -10 });
      expect(negMin.min_order_value).toContain("cannot be negative");
    });

    it("validates chronological date ordering (expires_at > starts_at)", () => {
      const invalidDates = validateAdminCouponInput({
        ...validBase,
        starts_at: "2026-11-10T00:00:00Z",
        expires_at: "2026-11-05T00:00:00Z",
      });
      expect(invalidDates.expires_at).toContain("later than start date");

      const sameDates = validateAdminCouponInput({
        ...validBase,
        starts_at: "2026-11-05T00:00:00Z",
        expires_at: "2026-11-05T00:00:00Z",
      });
      expect(sameDates.expires_at).toContain("later than start date");
    });

    it("validates usage limits", () => {
      const zeroPerCust = validateAdminCouponInput({
        ...validBase,
        usage_limit_per_customer: 0,
      });
      expect(zeroPerCust.usage_limit_per_customer).toContain("at least 1");

      const negTotal = validateAdminCouponInput({
        ...validBase,
        usage_limit_total: 0,
      });
      expect(negTotal.usage_limit_total).toContain("positive integer");
    });
  });

  describe("6. mapCouponErrorMessage", () => {
    it("maps standard server error codes and messages to user-friendly copy", () => {
      expect(mapCouponErrorMessage("COUPON_EXPIRED")).toBe("This coupon has expired.");
      expect(mapCouponErrorMessage("Coupon expired")).toBe("This coupon has expired.");
      expect(mapCouponErrorMessage("RATE_LIMITED")).toContain("Too many coupon attempts");
      expect(mapCouponErrorMessage("You have reached the redemption limit")).toContain(
        "redemption limit"
      );
      expect(mapCouponErrorMessage("FIRST_ORDER_ONLY")).toContain("first order");
      expect(mapCouponErrorMessage("CATEGORY_NOT_ELIGIBLE")).toContain("not applicable");
      expect(mapCouponErrorMessage("Cart is empty")).toContain("Your cart is empty");
      expect(mapCouponErrorMessage("Minimum order of ₹999 required")).toBe(
        "Minimum order of ₹999 required"
      );
    });

    it("falls back to friendly default on invalid or unknown code", () => {
      expect(mapCouponErrorMessage("COUPON_INVALID")).toBe(
        "This coupon code is not valid for your cart."
      );
      expect(mapCouponErrorMessage(null)).toBe("This coupon is not valid for your cart.");
    });
  });

  describe("7. calculateCartSummary with coupon discount", () => {
    it("computes consolidated summary with subtotal, discount, shipping, and total", () => {
      const summary = calculateCartSummary({
        items: [
          { price: 50, quantity: 10 }, // 500
          { price: 100, quantity: 5 }, // 500 => Subtotal: 1000
        ],
        shipping: 49,
        couponCode: "SAVE100",
        couponDiscount: 100,
      });

      expect(summary.itemsCount).toBe(15);
      expect(summary.subtotal).toBe(1000);
      expect(summary.shipping).toBe(49);
      expect(summary.discountAmount).toBe(100);
      expect(summary.totalBeforeDiscount).toBe(1049);
      expect(summary.total).toBe(949); // (1000 - 100) + 49
      expect(summary.coupon).toEqual({
        code: "SAVE100",
        discountAmount: 100,
      });
    });

    it("clamps discount to subtotal if coupon discount exceeds subtotal", () => {
      const summary = calculateCartSummary({
        items: [{ price: 50, quantity: 2 }], // 100
        shipping: 0,
        couponCode: "SUPER200",
        couponDiscount: 200,
      });

      expect(summary.subtotal).toBe(100);
      expect(summary.discountAmount).toBe(100);
      expect(summary.total).toBe(0);
    });
  });
});

