import type { PriceTier } from "./types/pricing";

export interface NextTierResult {
  tier: PriceTier;
  piecesNeeded: number;
}

/**
 * Returns the applicable unit price for a given quantity across volume pricing tiers.
 * If qty is below the lowest tier or no tiers exist, defaults to the lowest tier's unit_price.
 */
export function getUnitPrice(tiers: PriceTier[], qty: number): number {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);

  const firstTier = sorted[0];
  if (!firstTier) return 0;
  let selectedPrice = firstTier.unit_price;
  for (const tier of sorted) {
    if (qty >= tier.min_qty) {
      selectedPrice = tier.unit_price;
    } else {
      break;
    }
  }
  return selectedPrice;
}

/**
 * Returns the next available discount tier and how many more pieces are needed
 * to unlock that tier, or null if the quantity has already reached or exceeded
 * the highest tier.
 */
export function getNextTier(tiers: PriceTier[], qty: number): NextTierResult | null {
  if (!tiers || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);

  for (const tier of sorted) {
    if (tier.min_qty > qty) {
      return {
        tier,
        piecesNeeded: tier.min_qty - qty,
      };
    }
  }

  return null;
}

/**
 * Returns formatted quantity range strings for each tier, e.g. ["1-9", "10-49", "50+"].
 */
export function getTierRanges(tiers: PriceTier[]): string[] {
  if (!tiers || tiers.length === 0) return [];
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);

  return sorted.map((tier, idx) => {
    const isLast = idx === sorted.length - 1;
    if (isLast) {
      return `${tier.min_qty}+`;
    }
    const nextTier = sorted[idx + 1];
    if (!nextTier) {
      return `${tier.min_qty}+`;
    }
    const nextMin = nextTier.min_qty;
    const maxQty = nextMin - 1;
    if (maxQty === tier.min_qty) {
      return `${tier.min_qty}`;
    }
    return `${tier.min_qty}-${maxQty}`;
  });
}
