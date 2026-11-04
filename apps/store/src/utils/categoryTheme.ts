/**
 * Category Theme Image Mapper
 * Maps categories to high-resolution, photorealistic 1:1 3D tech studio renders.
 * Supports dual-theme: clean light studio renders for Light Theme and sleek obsidian/cyan renders for Dark Theme.
 */

export const CATEGORY_FILENAMES: Record<string, string> = {
  // All Products
  all: "all-products.png",
  "all-products": "all-products.png",

  // Tempered Glass & UV Glass
  "tempered-glass-uv-glass": "tempered-glass.png",
  "tempered-glass": "tempered-glass.png",
  "uv-glass": "tempered-glass.png",

  // Cables & Cords
  cables: "cables.png",
  "cables-cords": "cables.png",

  // Mobile Chargers
  "mobile-chargers": "chargers.png",
  chargers: "chargers.png",

  // Buds & TWS
  "buds-tws": "buds-tws.png",
  buds: "buds-tws.png",
  tws: "buds-tws.png",

  // Neckbands
  neckbands: "neckbands.png",

  // Speakers / Audio
  audio: "speakers.png",
  speakers: "speakers.png",

  // OTG Connectors
  "otg-connector": "otg-connectors.png",
  "otg connector": "otg-connectors.png",
  "otg-connectors": "otg-connectors.png",
  otg: "otg-connectors.png",

  // Mobile Holders & Stand
  "mobile-holders-stand": "mobile-holders.png",
  "mobile-holders": "mobile-holders.png",
  stands: "mobile-holders.png",

  // Power Banks
  "power-banks": "power-banks.png",
  powerbanks: "power-banks.png",

  // Watches
  watches: "watches.png",
  smartwatches: "watches.png",

  // Earphones
  earphones: "earphones.png",

  // Battery
  battry: "battery.png",
  battery: "battery.png",
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
  const defaultImage = `/categories/${mode}/all-products.png`;

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
        if (nameLower.includes("tempered") || nameLower.includes("glass")) filename = "tempered-glass.png";
        else if (nameLower.includes("cable") || nameLower.includes("cord")) filename = "cables.png";
        else if (nameLower.includes("charger")) filename = "chargers.png";
        else if (nameLower.includes("bud") || nameLower.includes("tws")) filename = "buds-tws.png";
        else if (nameLower.includes("neckband")) filename = "neckbands.png";
        else if (nameLower.includes("speaker") || nameLower.includes("audio")) filename = "speakers.png";
        else if (nameLower.includes("otg")) filename = "otg-connectors.png";
        else if (nameLower.includes("holder") || nameLower.includes("stand")) filename = "mobile-holders.png";
        else if (nameLower.includes("power") || nameLower.includes("bank")) filename = "power-banks.png";
        else if (nameLower.includes("watch")) filename = "watches.png";
        else if (nameLower.includes("earphone")) filename = "earphones.png";
        else if (nameLower.includes("batt")) filename = "battery.png";
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
