import type { Product } from "./types/product";

/**
 * Resolves signature boAt-style highlight specs for product cards.
 * E.g., "40 Hours Playback", "100W PD Fast Charge", "9H Diamond Hardness", "BT Calling"
 */
export function getProductHighlightSpec(product: Product): string {
  // 1. If explicit specs dictionary has popular metrics
  if (product.specs && typeof product.specs === "object") {
    const s = product.specs as Record<string, any>;
    if (s.playback) return `${s.playback} Playback`;
    if (s.battery) return `${s.battery} Battery`;
    if (s.power) return `${s.power} Power`;
    if (s.wattage) return `${s.wattage} Fast Charge`;
    if (s.output) return `${s.output} Output`;
    if (s.driver) return `${s.driver} Drivers`;
    if (s.connectivity) return `${s.connectivity}`;
    if (s.hardness) return `${s.hardness} Hardness`;
    if (s.material) return `${s.material}`;
  }

  // 2. Check tags, keywords, and title
  const nameAndTags = `${product.name} ${(product.tags || []).join(" ")} ${(product.keywords || []).join(" ")}`.toLowerCase();

  if (nameAndTags.includes("120w")) return "120W Turbo Charge";
  if (nameAndTags.includes("100w")) return "100W PD Fast";
  if (nameAndTags.includes("65w") || nameAndTags.includes("gan")) return "65W GaN Fast";
  if (nameAndTags.includes("45w")) return "45W Super Fast";
  if (nameAndTags.includes("33w") || nameAndTags.includes("30w")) return "33W Turbo Fast";
  if (nameAndTags.includes("20w")) return "20W PD Fast";
  if (nameAndTags.includes("braided") || nameAndTags.includes("kevlar")) return "Kevlar Braided";
  if (nameAndTags.includes("tws") || nameAndTags.includes("earbuds") || nameAndTags.includes("airbass") || nameAndTags.includes("airdopes") || nameAndTags.includes("buds")) {
    return "40 Hours Playback";
  }
  if (nameAndTags.includes("neckband")) return "60 Hrs Playback";
  if (nameAndTags.includes("speaker") || nameAndTags.includes("soundbar") || nameAndTags.includes("audio")) {
    return "10W RMS Sound";
  }
  if (nameAndTags.includes("tempered") || nameAndTags.includes("diamond") || nameAndTags.includes("glass")) {
    return "9H Diamond Hardness";
  }
  if (nameAndTags.includes("power bank") || nameAndTags.includes("battery")) {
    return "10000mAh Battery";
  }
  if (nameAndTags.includes("watch") || nameAndTags.includes("calling")) {
    return "BT Calling";
  }
  if (nameAndTags.includes("otg")) return "5Gbps High Speed";
  if (nameAndTags.includes("holder") || nameAndTags.includes("stand")) return "360° Metal Arm";

  // 3. Warranty fallback
  if (product.warranty_months && product.warranty_months > 0) {
    return `${product.warranty_months}M Warranty`;
  }

  return "Wholesale Grade";
}

/**
 * Resolves signature boAt-style top-left badge tag (e.g. "🔥 Best Seller", "⚡ New Launch")
 */
export function getProductTopBadge(
  product: Product,
  discountPercent: number
): { text: string; icon: string } {
  if (product.is_featured) return { text: "Best Seller", icon: "🔥" };
  if (product.is_urbanrat_brand) return { text: "URT Original", icon: "⭐" };
  if (product.is_trending) return { text: "New Launch", icon: "⚡" };
  if (discountPercent >= 50) return { text: `EXTRA ${discountPercent}% OFF`, icon: "🏷️" };
  if (product.warranty_months && product.warranty_months >= 12) return { text: "1-Yr Warranty", icon: "🛡️" };
  return { text: "Express Dispatch", icon: "⚡" };
}

export const COLOR_HEX_MAP: Record<string, string> = {
  black: "#18181b",
  obsidian: "#09090b",
  midnight: "#0f172a",
  white: "#f8fafc",
  silver: "#cbd5e1",
  grey: "#64748b",
  gray: "#64748b",
  blue: "#2563eb",
  cyan: "#06b6d4",
  teal: "#0d9488",
  green: "#10b981",
  emerald: "#059669",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  purple: "#8b5cf6",
  violet: "#7c3aed",
  pink: "#ec4899",
  rose: "#f43f5e",
  gold: "#d97706",
};

export function resolveColorHex(colorName?: string): string {
  if (!colorName) return "#18181b";
  const clean = colorName.toLowerCase().trim();
  return COLOR_HEX_MAP[clean] || "#334155";
}

