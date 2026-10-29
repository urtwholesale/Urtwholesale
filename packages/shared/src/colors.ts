/**
 * Shared Color Variants & Color Palette Helpers
 */

/**
 * Extracts normalized color strings from a product's attributes, specs, or top-level properties.
 * Returns an empty array if color selection is explicitly disabled (`has_colors: false`)
 * or if no colors are configured.
 */
export function getProductColors(product: any): string[] {
  if (!product || typeof product !== "object") return [];

  // 1. Explicit disable check
  if (product.specs?.has_colors === false || product.attributes?.has_colors === false) {
    return [];
  }

  // 2. Check specs.colors
  const specsColors = product.specs?.colors;
  if (Array.isArray(specsColors) && specsColors.length > 0) {
    return cleanColorArray(specsColors);
  }
  if (typeof specsColors === "string" && specsColors.trim()) {
    return parseColorString(specsColors);
  }

  // 3. Check attributes.colors
  const attrColors = product.attributes?.colors;
  if (Array.isArray(attrColors) && attrColors.length > 0) {
    return cleanColorArray(attrColors);
  }
  if (typeof attrColors === "string" && attrColors.trim()) {
    return parseColorString(attrColors);
  }

  // 4. Check top-level product.colors
  if (Array.isArray(product.colors) && product.colors.length > 0) {
    return cleanColorArray(product.colors);
  }
  if (typeof product.colors === "string" && product.colors.trim()) {
    return parseColorString(product.colors);
  }

  // 5. Fallback check for specs.colorways (e.g. boAt Buds)
  const colorways = product.specs?.colorways || product.specs?.colorway || product.specs?.color_options;
  if (typeof colorways === "string" && colorways.trim()) {
    return parseColorString(colorways);
  }
  if (Array.isArray(colorways) && colorways.length > 0) {
    return cleanColorArray(colorways);
  }

  return [];
}

/**
 * Checks whether color variant selection is actively enabled and populated for a product.
 */
export function isColorSelectionEnabled(product: any): boolean {
  if (!product || typeof product !== "object") return false;
  if (product.specs?.has_colors === false || product.attributes?.has_colors === false) {
    return false;
  }
  return getProductColors(product).length > 0;
}

/**
 * Normalizes an array of color strings, stripping empty tokens and removing duplicates.
 */
export function cleanColorArray(list: any[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const trimmed = String(item || "").trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * Parses comma, pipe, semicolon, or slash separated color strings.
 */
export function parseColorString(raw: string): string[] {
  if (!raw || typeof raw !== "string") return [];
  const tokens = raw.split(/[,;|/\n\r]+/).map((s) => s.trim()).filter(Boolean);
  return cleanColorArray(tokens);
}

/**
 * Maps color names to rich visual hex values for swatches and badges.
 * Provides resilient keyword/fuzzy matching across standard and composite color names
 * (e.g. "Forest Emerald" -> emerald green, "Jet Black" -> dark zinc, "Titanium Silver" -> metallic grey).
 */
export function getColorHex(colorName: string): string {
  if (!colorName) return "#94a3b8";
  const lower = colorName.toLowerCase().trim();

  // Rainbow / Multicolor
  if (lower.includes("rainbow") || lower.includes("multi")) return "linear-gradient(135deg, #f43f5e, #eab308, #06b6d4, #8b5cf6)";

  // Blacks & Darks
  if (lower.includes("black") || lower.includes("matte black") || lower.includes("phantom") || lower.includes("dark")) {
    return "#18181b";
  }

  // Whites & Off-whites
  if (lower.includes("white") || lower.includes("pure white") || lower.includes("pearl") || lower.includes("ivory") || lower.includes("cream")) {
    return "#ffffff";
  }

  // Transparent / Clear
  if (lower.includes("transparent") || lower.includes("clear")) {
    return "#f1f5f9";
  }

  // Greens
  if (lower.includes("mint")) return "#6ee7b7";
  if (lower.includes("emerald")) return "#10b981";
  if (lower.includes("forest")) return "#047857";
  if (lower.includes("olive")) return "#65a30d";
  if (lower.includes("green")) return "#22c55e";

  // Reds & Pinks
  if (lower.includes("crimson") || lower.includes("ruby") || lower.includes("cherry") || lower.includes("wine")) return "#be123c";
  if (lower.includes("red")) return "#ef4444";
  if (lower.includes("magenta")) return "#d946ef";
  if (lower.includes("rose gold")) return "#f43f5e";
  if (lower.includes("pink") || lower.includes("blush")) return "#f472b6";

  // Blues
  if (lower.includes("navy")) return "#1e3a8a";
  if (lower.includes("sky")) return "#38bdf8";
  if (lower.includes("cyan")) return "#06b6d4";
  if (lower.includes("teal")) return "#0d9488";
  if (lower.includes("royal blue")) return "#2563eb";
  if (lower.includes("blue")) return "#0284c7";

  // Yellows & Oranges
  if (lower.includes("gold") || lower.includes("brass")) return "#d97706";
  if (lower.includes("orange") || lower.includes("rust") || lower.includes("coral") || lower.includes("peach")) return "#ea580c";
  if (lower.includes("yellow") || lower.includes("amber")) return "#eab308";

  // Purples
  if (lower.includes("violet") || lower.includes("lavender") || lower.includes("purple") || lower.includes("plum")) return "#8b5cf6";

  // Greys & Metallics
  if (lower.includes("titanium")) return "#71717a";
  if (lower.includes("silver")) return "#cbd5e1";
  if (lower.includes("grey") || lower.includes("gray") || lower.includes("space grey") || lower.includes("charcoal")) return "#64748b";
  if (lower.includes("brown") || lower.includes("tan") || lower.includes("coffee") || lower.includes("bronze")) return "#78350f";

  // Default fallback: Urbanrat brand cyan/blue
  return "#0A82A8";
}

/**
 * Standard palette suggestions for quick-add pills in Admin editors
 */
export const POPULAR_COLOR_PRESETS = [
  "Black",
  "White",
  "Silver",
  "Gold",
  "Deep Blue",
  "Forest Green",
  "Titanium",
  "Rainbow",
  "Red",
  "Transparent",
];

