import { describe, it, expect } from "vitest";
import { getUnitPrice, getNextTier, getTierRanges } from "./pricing";
import type { PriceTier } from "./types/pricing";

describe("packages/shared pricing helpers", () => {
  const standardTiers: PriceTier[] = [
    { min_qty: 1, unit_price: 100 },
    { min_qty: 10, unit_price: 80 },
    { min_qty: 50, unit_price: 60 },
  ];

  describe("1. qty below first tier", () => {
    it("returns base tier price and next tier when qty is 0 (below min_qty 1)", () => {
      const price = getUnitPrice(standardTiers, 0);
      expect(price).toBe(100);

      const next = getNextTier(standardTiers, 0);
      expect(next).not.toBeNull();
      expect(next?.tier.min_qty).toBe(1);
      expect(next?.piecesNeeded).toBe(1);
    });

    it("handles tiers starting at higher minimum quantity (e.g. min_qty 10)", () => {
      const bulkOnlyTiers: PriceTier[] = [
        { min_qty: 10, unit_price: 80 },
        { min_qty: 50, unit_price: 60 },
      ];

      const price = getUnitPrice(bulkOnlyTiers, 4);
      expect(price).toBe(80);

      const next = getNextTier(bulkOnlyTiers, 4);
      expect(next).not.toBeNull();
      expect(next?.tier.min_qty).toBe(10);
      expect(next?.piecesNeeded).toBe(6);
    });
  });

  describe("2. exact boundaries", () => {
    it("evaluates tier transitions at exact boundary values", () => {
      // At boundary qty = 1
      expect(getUnitPrice(standardTiers, 1)).toBe(100);
      const nextAt1 = getNextTier(standardTiers, 1);
      expect(nextAt1?.tier.min_qty).toBe(10);
      expect(nextAt1?.piecesNeeded).toBe(9);

      // Just before boundary qty = 9
      expect(getUnitPrice(standardTiers, 9)).toBe(100);
      const nextAt9 = getNextTier(standardTiers, 9);
      expect(nextAt9?.tier.min_qty).toBe(10);
      expect(nextAt9?.piecesNeeded).toBe(1);

      // At boundary qty = 10
      expect(getUnitPrice(standardTiers, 10)).toBe(80);
      const nextAt10 = getNextTier(standardTiers, 10);
      expect(nextAt10?.tier.min_qty).toBe(50);
      expect(nextAt10?.piecesNeeded).toBe(40);

      // Just before highest boundary qty = 49
      expect(getUnitPrice(standardTiers, 49)).toBe(80);
      const nextAt49 = getNextTier(standardTiers, 49);
      expect(nextAt49?.tier.min_qty).toBe(50);
      expect(nextAt49?.piecesNeeded).toBe(1);

      // At highest boundary qty = 50
      expect(getUnitPrice(standardTiers, 50)).toBe(60);
      expect(getNextTier(standardTiers, 50)).toBeNull();
    });

    it("generates correct range labels like '1-9', '10-49', '50+'", () => {
      const ranges = getTierRanges(standardTiers);
      expect(ranges).toEqual(["1-9", "10-49", "50+"]);
    });
  });

  describe("3. above last tier", () => {
    it("applies the highest discount tier when qty exceeds last tier", () => {
      expect(getUnitPrice(standardTiers, 75)).toBe(60);
      expect(getUnitPrice(standardTiers, 500)).toBe(60);
      expect(getNextTier(standardTiers, 75)).toBeNull();
      expect(getNextTier(standardTiers, 500)).toBeNull();
    });
  });

  describe("4. unsorted input", () => {
    it("handles tiers passed in arbitrary unsorted order", () => {
      const unsortedTiers: PriceTier[] = [
        { min_qty: 50, unit_price: 60 },
        { min_qty: 1, unit_price: 100 },
        { min_qty: 10, unit_price: 80 },
      ];

      expect(getUnitPrice(unsortedTiers, 5)).toBe(100);
      expect(getUnitPrice(unsortedTiers, 25)).toBe(80);
      expect(getUnitPrice(unsortedTiers, 100)).toBe(60);

      const nextAt5 = getNextTier(unsortedTiers, 5);
      expect(nextAt5?.tier.min_qty).toBe(10);
      expect(nextAt5?.piecesNeeded).toBe(5);

      const ranges = getTierRanges(unsortedTiers);
      expect(ranges).toEqual(["1-9", "10-49", "50+"]);
    });
  });

  describe("5. single tier", () => {
    const singleTier: PriceTier[] = [{ min_qty: 1, unit_price: 149 }];

    it("evaluates single tier with no subsequent discounts", () => {
      expect(getUnitPrice(singleTier, 1)).toBe(149);
      expect(getUnitPrice(singleTier, 10)).toBe(149);
      expect(getNextTier(singleTier, 1)).toBeNull();
      expect(getNextTier(singleTier, 50)).toBeNull();

      const ranges = getTierRanges(singleTier);
      expect(ranges).toEqual(["1+"]);
    });

    it("handles single tier starting above 1", () => {
      const singleBulkTier: PriceTier[] = [{ min_qty: 5, unit_price: 199 }];

      expect(getUnitPrice(singleBulkTier, 2)).toBe(199);
      expect(getUnitPrice(singleBulkTier, 5)).toBe(199);

      const nextAt2 = getNextTier(singleBulkTier, 2);
      expect(nextAt2?.tier.min_qty).toBe(5);
      expect(nextAt2?.piecesNeeded).toBe(3);

      expect(getNextTier(singleBulkTier, 5)).toBeNull();
      expect(getTierRanges(singleBulkTier)).toEqual(["5+"]);
    });
  });

  describe("Edge cases: empty tiers", () => {
    it("gracefully returns defaults for empty tiers array", () => {
      expect(getUnitPrice([], 10)).toBe(0);
      expect(getNextTier([], 10)).toBeNull();
      expect(getTierRanges([])).toEqual([]);
    });
  });
});
