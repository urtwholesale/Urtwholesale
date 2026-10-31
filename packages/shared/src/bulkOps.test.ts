import { describe, it, expect } from "vitest";
import {
  computeTierAdjustment,
  computeTiersFromBase,
  validateTiers,
  computeStockResult,
  computeImageUpdate,
} from "./bulkOps";

describe("bulkOps pure helpers", () => {
  describe("computeTierAdjustment", () => {
    const sampleTiers = [
      { min_qty: 20, price: 100 },
      { min_qty: 50, price: 90 },
      { min_qty: 100, price: 80 },
    ];

    it("adjusts prices upwards by percentage", () => {
      const adjusted = computeTierAdjustment(sampleTiers, {
        type: "pct",
        direction: "up",
        value: 10,
      });

      expect(adjusted).toEqual([
        { min_qty: 20, price: 110 },
        { min_qty: 50, price: 99 },
        { min_qty: 100, price: 88 },
      ]);
    });

    it("adjusts prices downwards by percentage with rounding", () => {
      const adjusted = computeTierAdjustment(sampleTiers, {
        type: "pct",
        direction: "down",
        value: 15,
      });

      expect(adjusted).toEqual([
        { min_qty: 20, price: 85 },
        { min_qty: 50, price: 76.5 },
        { min_qty: 100, price: 68 },
      ]);
    });

    it("adjusts prices by flat amount", () => {
      const adjusted = computeTierAdjustment(sampleTiers, {
        type: "amount",
        direction: "down",
        value: 5,
      });

      expect(adjusted).toEqual([
        { min_qty: 20, price: 95 },
        { min_qty: 50, price: 85 },
        { min_qty: 100, price: 75 },
      ]);
    });

    it("enforces minimum price floor of 0.01", () => {
      const adjusted = computeTierAdjustment([{ min_qty: 1, price: 2 }], {
        type: "amount",
        direction: "down",
        value: 10,
      });

      expect(adjusted[0]!.price).toBe(0.01);
    });
  });

  describe("computeTiersFromBase", () => {
    it("computes tiered prices from product base wholesale price", () => {
      const basePrice = 200;
      const spec = [
        { min_qty: 10, discount_pct: 5 },  // 200 - 10 = 190
        { min_qty: 50, discount_pct: 12 }, // 200 - 24 = 176
        { min_qty: 100, discount_pct: 20 },// 200 - 40 = 160
      ];

      const tiers = computeTiersFromBase(basePrice, spec);
      expect(tiers).toEqual([
        { min_qty: 10, price: 190 },
        { min_qty: 50, price: 176 },
        { min_qty: 100, price: 160 },
      ]);
    });

    it("returns empty array for invalid base price", () => {
      expect(computeTiersFromBase(0, [{ min_qty: 10, discount_pct: 5 }])).toEqual([]);
    });
  });

  describe("validateTiers", () => {
    it("validates valid strictly increasing quantities and non-increasing prices", () => {
      const valid = [
        { min_qty: 10, price: 50 },
        { min_qty: 20, price: 45 },
        { min_qty: 50, price: 40 },
      ];

      const res = validateTiers(valid, 100, 50);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.warnings).toHaveLength(0);
    });

    it("detects non-increasing quantities", () => {
      const invalid = [
        { min_qty: 20, price: 50 },
        { min_qty: 15, price: 45 },
      ];

      const res = validateTiers(invalid, 100, 50);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain("must be strictly greater");
    });

    it("detects increasing prices on larger quantities", () => {
      const invalid = [
        { min_qty: 10, price: 40 },
        { min_qty: 20, price: 45 }, // price increased!
      ];

      const res = validateTiers(invalid, 100, 40);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain("cannot exceed previous tier price");
    });

    it("detects prices exceeding MRP", () => {
      const invalid = [{ min_qty: 10, price: 120 }];
      const res = validateTiers(invalid, 100, 50);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain("cannot exceed MRP");
    });

    it("warns if tier 1 price is above base price", () => {
      const tiers = [{ min_qty: 10, price: 60 }];
      const res = validateTiers(tiers, 100, 50);
      expect(res.isValid).toBe(true);
      expect(res.warnings).toHaveLength(1);
      expect(res.warnings[0]).toContain("is higher than base price");
    });
  });

  describe("computeStockResult", () => {
    it("adds stock correctly", () => {
      const res = computeStockResult(50, "add", 25);
      expect(res.isValid).toBe(true);
      expect(res.newStock).toBe(75);
      expect(res.change).toBe(25);
    });

    it("subtracts stock correctly", () => {
      const res = computeStockResult(50, "subtract", 20);
      expect(res.isValid).toBe(true);
      expect(res.newStock).toBe(30);
      expect(res.change).toBe(-20);
    });

    it("sets stock to explicit value", () => {
      const res = computeStockResult(50, "set", 100);
      expect(res.isValid).toBe(true);
      expect(res.newStock).toBe(100);
      expect(res.change).toBe(50);
    });

    it("zeros stock correctly", () => {
      const res = computeStockResult(50, "zero", 0);
      expect(res.isValid).toBe(true);
      expect(res.newStock).toBe(0);
      expect(res.change).toBe(-50);
    });

    it("fails gracefully when subtraction drops stock below 0", () => {
      const res = computeStockResult(10, "subtract", 25);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("cannot drop below 0");
    });
  });

  describe("computeImageUpdate", () => {
    const initialImages = [
      "https://example.com/img1.webp",
      "https://example.com/img2.webp",
    ];

    it("appends images without duplicates and caps at 10", () => {
      const res = computeImageUpdate(initialImages, "append", [
        "https://example.com/img2.webp", // duplicate
        "https://example.com/img3.webp",
      ]);
      expect(res.newImages).toEqual([
        "https://example.com/img1.webp",
        "https://example.com/img2.webp",
        "https://example.com/img3.webp",
      ]);
    });

    it("prepends image as primary", () => {
      const res = computeImageUpdate(initialImages, "prepend", [
        "https://example.com/new_hero.webp",
      ]);
      expect(res.newImages[0]).toBe("https://example.com/new_hero.webp");
      expect(res.newImages).toHaveLength(3);
    });

    it("replaces all images", () => {
      const res = computeImageUpdate(initialImages, "replace_all", [
        "https://example.com/only_one.webp",
      ]);
      expect(res.newImages).toEqual(["https://example.com/only_one.webp"]);
    });

    it("sets existing image as primary", () => {
      const res = computeImageUpdate(initialImages, "set_primary", [
        "https://example.com/img2.webp",
      ]);
      expect(res.newImages[0]).toBe("https://example.com/img2.webp");
      expect(res.newImages[1]).toBe("https://example.com/img1.webp");
      expect(res.error).toBeUndefined();
    });

    it("flags error if set_primary target URL is not in existing images", () => {
      const res = computeImageUpdate(initialImages, "set_primary", [
        "https://example.com/not_existing.webp",
      ]);
      expect(res.error).toContain("not among the product existing images");
    });

    it("removes specified image URLs", () => {
      const res = computeImageUpdate(initialImages, "remove_url", [
        "https://example.com/img1.webp",
      ]);
      expect(res.newImages).toEqual(["https://example.com/img2.webp"]);
    });

    it("clears all images", () => {
      const res = computeImageUpdate(initialImages, "clear", []);
      expect(res.newImages).toEqual([]);
    });
  });
});

