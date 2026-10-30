/**
 * Category Theme Image Mapper
 * Maps categories to high-resolution, photorealistic 1:1 3D tech studio renders
 * featuring a cohesive dark graphite/charcoal studio background and cyan rim lighting.
 */

export const CATEGORY_THEME_IMAGES: Record<string, string> = {
  // All Products
  all: "/categories/all-products.jpg",
  "all-products": "/categories/all-products.jpg",

  // Tempered Glass & UV Glass
  "tempered-glass-uv-glass": "/categories/tempered-glass.jpg",
  "tempered-glass": "/categories/tempered-glass.jpg",
  "uv-glass": "/categories/tempered-glass.jpg",

  // Cables & Cords
  cables: "/categories/cables.jpg",
  "cables-cords": "/categories/cables.jpg",

  // Mobile Chargers
  "mobile-chargers": "/categories/chargers.jpg",
  chargers: "/categories/chargers.jpg",

  // Buds & TWS
  "buds-tws": "/categories/buds-tws.jpg",
  buds: "/categories/buds-tws.jpg",
  tws: "/categories/buds-tws.jpg",

  // Neckbands
  neckbands: "/categories/neckbands.jpg",

  // Speakers / Audio
  audio: "/categories/speakers.jpg",
  speakers: "/categories/speakers.jpg",

  // OTG Connectors
  "otg-connector": "/categories/otg-connectors.jpg",
  "otg connector": "/categories/otg-connectors.jpg",
  "otg-connectors": "/categories/otg-connectors.jpg",
  otg: "/categories/otg-connectors.jpg",

  // Mobile Holders & Stand
  "mobile-holders-stand": "/categories/mobile-holders.jpg",
  "mobile-holders": "/categories/mobile-holders.jpg",
  stands: "/categories/mobile-holders.jpg",

  // Power Banks
  "power-banks": "/categories/power-banks.jpg",
  powerbanks: "/categories/power-banks.jpg",

  // Watches
  watches: "/categories/watches.jpg",
  smartwatches: "/categories/watches.jpg",

  // Earphones
  earphones: "/categories/earphones.jpg",

  // Battery
  battry: "/categories/battery.jpg",
  battery: "/categories/battery.jpg",
};

/**
 * Resolves the themed UI image for a category.
 * Prioritizes the curated 1:1 themed studio asset to maintain a cohesive UI theme.
 */
export function getCategoryThemeImage(
  category?: { slug?: string | null; name?: string | null; image_url?: string | null } | string | null
): string {
  if (!category) return "/categories/all-products.jpg";

  if (typeof category === "string") {
    const slugKey = category.toLowerCase().trim();
    if (CATEGORY_THEME_IMAGES[slugKey]) {
      return CATEGORY_THEME_IMAGES[slugKey];
    }
  } else {
    // 1. Match by slug
    if (category.slug) {
      const slugKey = category.slug.toLowerCase().trim();
      if (CATEGORY_THEME_IMAGES[slugKey]) {
        return CATEGORY_THEME_IMAGES[slugKey];
      }
    }

    // 2. Match by normalized name
    if (category.name) {
      const nameLower = category.name.toLowerCase().trim();
      if (CATEGORY_THEME_IMAGES[nameLower]) {
        return CATEGORY_THEME_IMAGES[nameLower];
      }

      if (nameLower.includes("tempered") || nameLower.includes("glass")) return "/categories/tempered-glass.jpg";
      if (nameLower.includes("cable") || nameLower.includes("cord")) return "/categories/cables.jpg";
      if (nameLower.includes("charger")) return "/categories/chargers.jpg";
      if (nameLower.includes("bud") || nameLower.includes("tws")) return "/categories/buds-tws.jpg";
      if (nameLower.includes("neckband")) return "/categories/neckbands.jpg";
      if (nameLower.includes("speaker") || nameLower.includes("audio")) return "/categories/speakers.jpg";
      if (nameLower.includes("otg")) return "/categories/otg-connectors.jpg";
      if (nameLower.includes("holder") || nameLower.includes("stand")) return "/categories/mobile-holders.jpg";
      if (nameLower.includes("power") || nameLower.includes("bank")) return "/categories/power-banks.jpg";
      if (nameLower.includes("watch")) return "/categories/watches.jpg";
      if (nameLower.includes("earphone")) return "/categories/earphones.jpg";
      if (nameLower.includes("batt")) return "/categories/battery.jpg";
    }

    // 3. Fallback to existing image_url if provided
    if (category.image_url) {
      return category.image_url;
    }
  }

  return "/categories/all-products.jpg";
}
