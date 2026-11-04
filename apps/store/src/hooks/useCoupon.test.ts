import { describe, it, expect, vi, beforeEach } from "vitest";
import { COUPON_STORAGE_KEY } from "./useCoupon";
import { normalizeCouponCode, mapCouponErrorMessage } from "@urbanrat/shared";

describe("useCoupon behavior and helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports the expected sessionStorage key for coupons", () => {
    expect(COUPON_STORAGE_KEY).toBe("urt_applied_coupon");
  });

  it("normalizes coupon codes correctly before submitting", () => {
    expect(normalizeCouponCode("  SAVE20  ")).toBe("SAVE20");
    expect(normalizeCouponCode("festive-50")).toBe("FESTIVE-50");
    expect(normalizeCouponCode("diwali_100")).toBe("DIWALI_100");
    expect(normalizeCouponCode("")).toBe("");
  });

  it("maps server error codes into friendly user messages", () => {
    expect(mapCouponErrorMessage("COUPON_INVALID: Coupon does not exist")).toBe(
      "This coupon code is not valid for your cart."
    );
    expect(
      mapCouponErrorMessage("COUPON_INVALID: Minimum order value of ₹500 required")
    ).toBe("This coupon code is not valid for your cart.");
    expect(
      mapCouponErrorMessage("COUPON_INVALID: You have reached the redemption limit")
    ).toContain("redemption limit");
  });
});
