/**
 * Catalog Image helpers — shared between admin and storefront.
 *
 * • parseSkuFromFilename – extracts SKU hint and index from filenames like "CHG-001_1.jpg"
 * • sanitizeFileName – produces lowercase, safe character filenames without spaces
 * • validateCatalogImageUrl – validates image URL cells in bulk templates
 */

export interface CatalogImage {
  id: string;
  original_name: string;
  storage_path: string;
  public_url: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  original_size_bytes: number | null;
  compressed_size_bytes: number | null;
  sku_hint: string | null;
  batch_id: string | null;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

/** Recognised image file extensions (lowercase, no dot). */
export const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "svg",
  "bmp",
  "tiff",
  "tif",
] as const;

export interface ParsedSkuHint {
  sku: string | null;
  index: number | null;
}

/**
 * Parse a SKU hint and numeric index from a typical product-image filename.
 *
 * Supports patterns:
 *   - "_1", "_2" (e.g. "CHG-001_1.jpg")
 *   - "-1", "-2" (e.g. "CHG-001-1.jpg")
 *   - " (1)", " (2)" (e.g. "CHG-001 (1).jpg")
 *
 * Returns `{ sku: null, index: null }` if no pattern is found.
 */
export function parseSkuFromFilename(filename: string): ParsedSkuHint {
  if (!filename || !filename.trim()) {
    return { sku: null, index: null };
  }

  // Strip path portions (handle both / and \)
  const basename = filename.split(/[\\/]/).pop() || filename;

  // Remove extension
  const dotIdx = basename.lastIndexOf(".");
  const stem = dotIdx > 0 ? basename.substring(0, dotIdx) : basename;

  const trimmedStem = stem.trim();
  if (!trimmedStem) {
    return { sku: null, index: null };
  }

  // Match suffixes: _N, -N, or " (N)" / "(N)"
  const match = trimmedStem.match(/^(.+?)(?:_(\d+)|-(\d+)|\s*\((\d+)\))$/);
  if (match) {
    const rawSku = match[1]?.trim() || null;
    const rawIndex = match[2] || match[3] || match[4];
    const index = rawIndex ? parseInt(rawIndex, 10) : null;
    if (rawSku) {
      return { sku: rawSku, index };
    }
  }

  return { sku: null, index: null };
}

/**
 * Extracts the numeric image index from a filename.
 * Falls back to 0 if no suffix is found.
 */
export function parseImageIndex(filename: string): number {
  const parsed = parseSkuFromFilename(filename);
  return parsed.index ?? 0;
}

/**
 * Sanitizes a filename for storage paths.
 * Enforces lowercase, safe characters (alphanumeric, hyphens, underscores, dots), and removes spaces.
 * Example: "My Product (1).JPG" → "my-product-1.jpg"
 */
export function sanitizeFileName(filename: string): string {
  if (!filename || !filename.trim()) return "unnamed-file";

  // Strip path portions
  const basename = filename.split(/[\\/]/).pop() || filename;

  // Split name and extension
  const dotIdx = basename.lastIndexOf(".");
  let name = dotIdx > 0 ? basename.substring(0, dotIdx) : basename;
  const ext = dotIdx > 0 ? basename.substring(dotIdx).toLowerCase() : "";

  let cleanName = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[()[\]{}]/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  const cleanExt = ext.replace(/[^a-z0-9.]/g, "");

  if (!cleanName) cleanName = "file";

  return `${cleanName}${cleanExt}`;
}

/** Hostname fragment used to detect own-bucket image URLs. */
const SUPABASE_STORAGE_PATTERNS = [
  "supabase.co/storage",
  "supabase.in/storage",
] as const;

export interface ImageUrlValidation {
  /** Whether the URL passed all checks */
  valid: boolean;
  /** Human-readable error messages (empty if valid) */
  errors: string[];
  /** Whether this URL belongs to the catalog-images bucket */
  isCatalogBucketUrl: boolean;
}

/**
 * Validates a single image URL cell from a bulk-upload template.
 *
 * Rules:
 * 1. Must be a valid HTTPS URL (or HTTP for dev).
 * 2. Must end with a recognised image extension OR belong to the catalog-images bucket.
 * 3. No empty strings (caller should skip those).
 *
 * This is a pure function — it does NOT make network requests.
 * The optional `supabaseUrl` param lets callers match against their own project URL.
 */
export function validateCatalogImageUrl(
  url: string,
  supabaseUrl?: string
): ImageUrlValidation {
  const errors: string[] = [];
  let isCatalogBucketUrl = false;

  const trimmed = url.trim();

  // Blank check
  if (!trimmed) {
    return { valid: false, errors: ["Image URL is empty"], isCatalogBucketUrl };
  }

  // Protocol check: must be https (allow http only for localhost/127.0.0.1 in development)
  const isLocalDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(trimmed);
  if (!/^https:\/\//i.test(trimmed) && !isLocalDev) {
    errors.push("Image URL must start with https://");
  }

  // Parse URL
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    errors.push("Image URL is not a valid URL");
    return { valid: false, errors, isCatalogBucketUrl };
  }

  // Check if it's from the catalog-images bucket
  const lowerUrl = trimmed.toLowerCase();
  const isSupa =
    SUPABASE_STORAGE_PATTERNS.some((p) => lowerUrl.includes(p)) ||
    (supabaseUrl && lowerUrl.startsWith(supabaseUrl.toLowerCase()));

  if (isSupa && lowerUrl.includes("/catalog-images/")) {
    isCatalogBucketUrl = true;
  }

  // Extension check (only required if NOT from catalog-images bucket)
  if (!isCatalogBucketUrl) {
    const pathname = parsedUrl.pathname.toLowerCase();
    const lastDot = pathname.lastIndexOf(".");
    const ext = lastDot > 0 ? pathname.substring(lastDot + 1) : "";
    if (!ext || !IMAGE_EXTENSIONS.includes(ext as any)) {
      errors.push(
        `URL does not end with a recognised image extension (${IMAGE_EXTENSIONS.slice(0, 5).join(", ")}…)`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    isCatalogBucketUrl,
  };
}
