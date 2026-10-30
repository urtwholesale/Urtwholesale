/**
 * Category Theme Image Mapper
 * Maps categories to high-resolution, photorealistic 1:1 3D tech studio renders.
 * Supports dual-theme: clean light studio renders for Light Theme and sleek obsidian/cyan renders for Dark Theme.
 */

export const CATEGORY_FILENAMES: Record<string, string> = {
  // All Products
  all: "all-products.jpg",
  "all-products": "all-products.jpg",

  // Tempered Glass & UV Glass
  "tempered-glass-uv-glass": "tempered-glass.jpg",
  "tempered-glass": "tempered-glass.jpg",
  "uv-glass": "tempered-glass.jpg",

  // Cables & Cords
  cables: "cables.jpg",
  "cables-cords": "cables.jpg",

  // Mobile Chargers
  "mobile-chargers": "chargers.jpg",
  chargers: "chargers.jpg",

  // Buds & TWS
  "buds-tws": "buds-tws.jpg",
  buds: "buds-tws.jpg",
  tws: "buds-tws.jpg",

  // Neckbands
  neckbands: "neckbands.jpg",

  // Speakers / Audio
  audio: "speakers.jpg",
  speakers: "speakers.jpg",

  // OTG Connectors
  "otg-connector": "otg-connectors.jpg",
  "otg connector": "otg-connectors.jpg",
  "otg-connectors": "otg-connectors.jpg",
  otg: "otg-connectors.jpg",

  // Mobile Holders & Stand
  "mobile-holders-stand": "mobile-holders.jpg",
  "mobile-holders": "mobile-holders.jpg",
  stands: "mobile-holders.jpg",

  // Power Banks
  "power-banks": "power-banks.jpg",
  powerbanks: "power-banks.jpg",

  // Watches
  watches: "watches.jpg",
  smartwatches: "watches.jpg",

  // Earphones
  earphones: "earphones.jpg",

  // Battery
  battry: "battery.jpg",
  battery: "battery.jpg",
};

/**
 * Resolves the themed UI image for a category.
 * Dynamically selects light studio or dark studio asset based on active theme.
 */
export function getCategoryThemeImage(
  category?: { slug?: string | null; name?: string | null; image_url?: string | null } | string | null,
  isDark?: boolean
): string {
  // Automatically detect dark mode if not explicitly supplied
  const resolvedIsDark =
    isDark !== undefined
      ? isDark
      : typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true;

  const mode = resolvedIsDark ? "dark" : "light";
  const defaultImage = `/categories/${mode}/all-products.jpg`;

  if (!category) return defaultImage;

  let filename: string | undefined;

  if (typeof category === "string") {
    const slugKey = category.toLowerCase().trim();
    filename = CATEGORY_FILENAMES[slugKey];
  } else {
    // 1. Match by slug
    if (category.slug) {
      const slugKey = category.slug.toLowerCase().trim();
      filename = CATEGORY_FILENAMES[slugKey];
    }

    // 2. Match by normalized name
    if (!filename && category.name) {
      const nameLower = category.name.toLowerCase().trim();
      filename = CATEGORY_FILENAMES[nameLower];

      if (!filename) {
        if (nameLower.includes("tempered") || nameLower.includes("glass")) filename = "tempered-glass.jpg";
        else if (nameLower.includes("cable") || nameLower.includes("cord")) filename = "cables.jpg";
        else if (nameLower.includes("charger")) filename = "chargers.jpg";
        else if (nameLower.includes("bud") || nameLower.includes("tws")) filename = "buds-tws.jpg";
        else if (nameLower.includes("neckband")) filename = "neckbands.jpg";
        else if (nameLower.includes("speaker") || nameLower.includes("audio")) filename = "speakers.jpg";
        else if (nameLower.includes("otg")) filename = "otg-connectors.jpg";
        else if (nameLower.includes("holder") || nameLower.includes("stand")) filename = "mobile-holders.jpg";
        else if (nameLower.includes("power") || nameLower.includes("bank")) filename = "power-banks.jpg";
        else if (nameLower.includes("watch")) filename = "watches.jpg";
        else if (nameLower.includes("earphone")) filename = "earphones.jpg";
        else if (nameLower.includes("batt")) filename = "battery.jpg";
      }
    }

    // 3. Fallback to existing image_url if provided and no match
    if (!filename && category.image_url) {
      return category.image_url;
    }
  }

  if (filename) {
    return `/categories/${mode}/${filename}`;
  }

  return defaultImage;
}
