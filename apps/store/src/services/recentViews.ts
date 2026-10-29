import type { Product } from "@urbanrat/shared";

const RECENTLY_VIEWED_STORAGE_KEY = "urt_recently_viewed";
const MAX_RECENT_ITEMS = 10;

/**
 * Retrieves the list of recently viewed products from localStorage
 */
export function getRecentlyViewed(): Product[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to read recently viewed products:", e);
    return [];
  }
}

/**
 * Appends a product to the top of the recently viewed stack in localStorage
 */
export function recordRecentlyViewed(product: Product): void {
  if (!product || !product.id) return;
  try {
    const current = getRecentlyViewed();
    const filtered = current.filter((p) => p.id !== product.id);
    const updated = [product, ...filtered].slice(0, MAX_RECENT_ITEMS);
    localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to record recently viewed product:", e);
  }
}

/**
 * Clears recently viewed products history
 */
export function clearRecentlyViewed(): void {
  try {
    localStorage.removeItem(RECENTLY_VIEWED_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear recently viewed products:", e);
  }
}

