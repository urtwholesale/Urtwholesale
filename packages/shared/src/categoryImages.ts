/**
 * Shared category image mapping and path resolution for storefront and admin hero banner linking.
 */

export const CATEGORY_IMAGE_MAP: Record<string, string> = {
  all: "all-products.jpg",
  "all-products": "all-products.jpg",
  chargers: "chargers.jpg",
  "mobile-chargers": "chargers.jpg",
  cables: "cables.jpg",
  "cables-cords": "cables.jpg",
  "buds-tws": "buds-tws.jpg",
  buds: "buds-tws.jpg",
  tws: "buds-tws.jpg",
  neckbands: "neckbands.jpg",
  audio: "speakers.jpg",
  speakers: "speakers.jpg",
  "tempered-glass": "tempered-glass.jpg",
  "tempered-glass-uv-glass": "tempered-glass.jpg",
  "uv-glass": "tempered-glass.jpg",
  "power-banks": "power-banks.jpg",
  powerbanks: "power-banks.jpg",
  watches: "watches.jpg",
  smartwatches: "watches.jpg",
  earphones: "earphones.jpg",
  battery: "battery.jpg",
  battry: "battery.jpg",
  "mobile-holders": "mobile-holders.jpg",
  "mobile-holders-stand": "mobile-holders.jpg",
  "otg-connectors": "otg-connectors.jpg",
  otg: "otg-connectors.jpg",
};

export function getCategoryVisualPath(slug: string, mode: "dark" | "light" = "dark"): string {
  const clean = (slug || "").toLowerCase().trim();
  const file = CATEGORY_IMAGE_MAP[clean] || `${clean}.jpg`;
  return `/categories/${mode}/${file}`;
}

export function isCategorySlug(slug: string): boolean {
  if (!slug) return false;
  const clean = slug.toLowerCase().trim();
  return clean in CATEGORY_IMAGE_MAP;
}

