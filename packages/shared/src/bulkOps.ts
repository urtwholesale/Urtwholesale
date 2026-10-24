import type {
  BulkTierAdjustmentPayload,
  BulkTierFromBasePayload,
  BulkStockMode,
} from "./types/bulk";

/**
 * Computes adjusted price tiers based on percentage or flat amount delta.
 */
export function computeTierAdjustment(
  currentTiers: Array<{ min_qty: number; price: number }>,
  payload: BulkTierAdjustmentPayload
): Array<{ min_qty: number; price: number }> {
  if (!currentTiers || currentTiers.length === 0) return [];
  const { type, direction, value, round_to = 0.01 } = payload;
  const factor = direction === "up" ? 1 : -1;

  return currentTiers.map((tier) => {
    let newPrice: number;
    if (type === "pct") {
      newPrice = tier.price * (1 + factor * (value / 100));
    } else {
      newPrice = tier.price + factor * value;
    }

    // Apply precision / rounding
    if (round_to > 0) {
      newPrice = Math.round(newPrice / round_to) * round_to;
    }
    newPrice = Math.max(0.01, Math.round(newPrice * 100) / 100);

    return {
      min_qty: tier.min_qty,
      price: newPrice,
    };
  });
}

/**
 * Computes price tiers from a product's base price given discount percentages.
 * e.g. base = 100, tiers = [{min_qty: 10, discount_pct: 10}] => price = 90
 */
export function computeTiersFromBase(
  basePrice: number,
  tiersSpec: BulkTierFromBasePayload[]
): Array<{ min_qty: number; price: number }> {
  if (!tiersSpec || tiersSpec.length === 0 || basePrice <= 0) return [];

  return tiersSpec.map((spec) => {
    const discount = (spec.discount_pct / 100) * basePrice;
    const price = Math.max(0.01, Math.round((basePrice - discount) * 100) / 100);
    return {
      min_qty: spec.min_qty,
      price,
    };
  });
}

/**
 * Validates price tiers according to editor rules:
 * - quantities strictly increasing
 * - prices > 0 and non-increasing
 * - price cannot exceed MRP (if set)
 * - warning if tier 1 price is above base price
 */
export function validateTiers(
  tiers: Array<{ min_qty: number; price: number }>,
  mrp?: number | null,
  basePrice?: number | null
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!tiers || tiers.length === 0) {
    return { isValid: true, errors: [], warnings: [] };
  }

  let prevQty = 0;
  let prevPrice: number | null = null;

  tiers.forEach((tier, i) => {
    if (tier.min_qty <= 0) {
      errors.push(`Tier #${i + 1} quantity must be greater than 0.`);
    }

    if (tier.price <= 0) {
      errors.push(`Tier #${i + 1} price must be greater than ₹0.`);
    }

    if (i > 0 && tier.min_qty <= prevQty) {
      errors.push(`Tier #${i + 1} quantity (${tier.min_qty}) must be strictly greater than previous tier (${prevQty}).`);
    }

    if (prevPrice !== null && tier.price > prevPrice) {
      errors.push(`Tier #${i + 1} unit price (₹${tier.price}) cannot exceed previous tier price (₹${prevPrice}).`);
    }

    if (mrp && mrp > 0 && tier.price > mrp) {
      errors.push(`Tier #${i + 1} unit price (₹${tier.price}) cannot exceed MRP (₹${mrp}).`);
    }

    prevQty = tier.min_qty;
    prevPrice = tier.price;
  });

  // Warn if tier 1 price is above base wholesale price
  const tier1 = tiers[0];
  if (basePrice && basePrice > 0 && tier1 && tier1.price > basePrice) {
    warnings.push(`Tier 1 price (₹${tier1.price}) is higher than base price (₹${basePrice}).`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Computes new stock level based on mode and delta. Stock cannot be negative.
 */
export function computeStockResult(
  currentStock: number,
  mode: BulkStockMode,
  qty: number
): { newStock: number; change: number; isValid: boolean; error?: string } {
  const current = Math.max(0, currentStock);
  let newStock = current;

  switch (mode) {
    case "add":
      newStock = current + Math.max(0, qty);
      break;
    case "subtract":
      newStock = current - Math.max(0, qty);
      break;
    case "set":
      newStock = Math.max(0, qty);
      break;
    case "zero":
      newStock = 0;
      break;
  }

  if (newStock < 0) {
    return {
      newStock: current,
      change: 0,
      isValid: false,
      error: `Stock cannot drop below 0 (current: ${current}, subtracted: ${qty}).`,
    };
  }

  return {
    newStock,
    change: newStock - current,
    isValid: true,
  };
}

/**
 * Computes updated image URLs based on BulkImageMode.
 * Matches Postgres RPC behavior: deduplicates, max 10 images, handles primary promotion.
 */
export function computeImageUpdate(
  currentImages: string[],
  mode: import("./types/bulk").BulkImageMode,
  urls: string[] = []
): { newImages: string[]; error?: string } {
  const current = currentImages || [];
  const cleanedUrls = (urls || []).map((u) => u.trim()).filter(Boolean);

  switch (mode) {
    case "clear":
      return { newImages: [] };

    case "replace_all":
      return { newImages: cleanedUrls.slice(0, 10) };

    case "append": {
      const merged = [...current];
      for (const u of cleanedUrls) {
        if (!merged.includes(u)) {
          merged.push(u);
        }
      }
      return { newImages: merged.slice(0, 10) };
    }

    case "prepend": {
      let merged = [...current];
      for (const u of cleanedUrls) {
        merged = merged.filter((img) => img !== u);
        merged.unshift(u);
      }
      return { newImages: merged.slice(0, 10) };
    }

    case "set_primary": {
      const target = cleanedUrls[0];
      if (!target) {
        return { newImages: current, error: "Target URL to set as primary is required." };
      }
      if (!current.includes(target)) {
        return {
          newImages: current,
          error: `URL ${target} is not among the product existing images.`,
        };
      }
      const reordered = [target, ...current.filter((img) => img !== target)];
      return { newImages: reordered };
    }

    case "remove_url": {
      const filtered = current.filter((img) => !cleanedUrls.includes(img));
      return { newImages: filtered };
    }

    default:
      return { newImages: current };
  }
}

