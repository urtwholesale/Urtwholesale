import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { BulkCatalogParsedRow } from "../types";
import {
  normalizeKeywords,
  resolveCanonicalHeader,
  parseBool,
  parseColorString,
} from "@urbanrat/shared";

export interface BulkCatalogParseResult {
  rows: BulkCatalogParsedRow[];
  ignoredColumns: string[];
  duplicateColumns?: { canonical: string; headers: string[] }[];
  rawHeaders: string[];
}

/**
 * Validates a single bulk import image URL.
 * Accepts:
 * - HTTPS URLs from the 'product-images' bucket
 * - HTTPS URLs from the 'catalog-images' bucket
 * - Any valid HTTPS URL ending in a standard image extension or from standard image hosts
 */
export function validateBulkImportImageUrl(url: string): { valid: boolean; error?: string } {
  const trimmed = (url || "").trim();
  if (!trimmed) {
    return { valid: false, error: "Image URL is empty" };
  }

  const isLocalDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(trimmed);
  if (!/^https:\/\//i.test(trimmed) && !isLocalDev) {
    return { valid: false, error: "Image URL must start with https://" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Image link is not a valid URL" };
  }

  const lower = parsed.href.toLowerCase();
  if (
    lower.includes("/product-images/") ||
    lower.includes("/catalog-images/")
  ) {
    return { valid: true };
  }

  const pathname = parsed.pathname.toLowerCase();
  const match = pathname.match(/\.(jpg|jpeg|png|webp|gif|avif|svg|bmp|tiff|tif)(\?.*)?$/i);
  if (!match) {
    if (
      parsed.hostname.includes("unsplash.com") ||
      parsed.hostname.includes("cloudinary.com") ||
      parsed.hostname.includes("imgur.com") ||
      parsed.hostname.includes("supabase.co")
    ) {
      return { valid: true };
    }
    return {
      valid: false,
      error: "URL does not end with a recognized image extension (.jpg, .png, .webp, etc.)",
    };
  }

  return { valid: true };
}

/**
 * Generates URL slug ensuring symbols like '+' convert to '-plus-' instead of merging.
 */
export function generateSlug(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/\+/g, "-plus-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generates fallback SKU ensuring symbols like '+' convert to '-PLUS-'.
 */
export function generateSku(name: string, rowNumber: number): string {
  const clean = (name || "")
    .toUpperCase()
    .replace(/\+/g, "-PLUS-")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `URT-${clean.slice(0, 20)}-${rowNumber}`;
}

/**
 * Re-validates a single row (used when editing fields inline in preview)
 */
export function revalidateRow(row: BulkCatalogParsedRow): BulkCatalogParsedRow {
  const errors: string[] = [];

  if (!row.name || !row.name.trim()) {
    errors.push("Product name is required.");
  }

  if (isNaN(row.price) || row.price < 0) {
    errors.push("Base wholesale price must be a valid number greater than or equal to 0.");
  }

  if (row.mrp !== null && row.mrp !== undefined) {
    if (isNaN(row.mrp) || row.mrp < row.price) {
      errors.push("MRP must be greater than or equal to base wholesale price.");
    }
  }

  if (isNaN(row.stock) || row.stock < 0) {
    errors.push("Stock must be an integer greater than or equal to 0.");
  }

  if (isNaN(row.minOrderQty) || row.minOrderQty < 1) {
    errors.push("Minimum order quantity must be at least 1.");
  }

  if (isNaN(row.orderQtyStep) || row.orderQtyStep < 1) {
    errors.push("Order quantity step must be at least 1.");
  }

  if (isNaN(row.lowStockThreshold) || row.lowStockThreshold < 0) {
    errors.push("Low stock alert threshold must be greater than or equal to 0.");
  }

  // Check Volume Tiers: strictly increasing qty, non-increasing price
  if (row.tiers && row.tiers.length > 1) {
    for (let t = 1; t < row.tiers.length; t++) {
      const prev = row.tiers[t - 1];
      const curr = row.tiers[t];
      if (curr && prev && curr.min_qty <= prev.min_qty) {
        errors.push(`Tier ${t + 1} min qty (${curr.min_qty}) must be greater than Tier ${t} min qty (${prev.min_qty}).`);
      }
      if (curr && prev && curr.unit_price > prev.unit_price) {
        errors.push(`Tier ${t + 1} unit price (₹${curr.unit_price}) cannot exceed Tier ${t} unit price (₹${prev.unit_price}).`);
      }
    }
  }

  // Keywords limits validation
  if (row.keywords && row.keywords.length > 30) {
    errors.push(`Exceeds maximum limit of 30 keywords (found ${row.keywords.length}).`);
  }
  if (row.keywords) {
    const longKw = row.keywords.find((k) => k.length > 50);
    if (longKw) {
      errors.push(`Keyword "${longKw.slice(0, 20)}..." exceeds 50 character limit.`);
    }
  }

  // Check images
  if (row.images && row.images.length > 0) {
    row.images.forEach((imgUrl, idx) => {
      const v = validateBulkImportImageUrl(imgUrl);
      if (!v.valid) {
        errors.push(`Image ${idx + 1}: ${v.error}`);
      }
    });
  }

  // Sync colors into specs
  const updatedSpecs = { ...(row.specs || {}) };
  if (row.hasColors !== undefined) {
    updatedSpecs.has_colors = !!row.hasColors;
    updatedSpecs.colors = row.hasColors ? (row.colors || []) : [];
  }

  return {
    ...row,
    specs: updatedSpecs,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Parses 2D array of string cells with canonical header mapping, specs JSON parsing,
 * tier rules (1-5), boolean casting, duplicate detection, and suggested SKU generation.
 */
export function parseSpreadsheetRowsWithReport(
  dataLines: string[][],
  customMappings?: Record<string, string>
): BulkCatalogParseResult {
  // Filter out empty rows and comment rows starting with '#'
  const nonCommentLines = dataLines.filter(
    (row) => row && row.length > 0 && !String(row[0] || "").trim().startsWith("#")
  );

  if (nonCommentLines.length < 2) {
    throw new Error("File must contain a header row and at least one product row.");
  }

  const rawHeaders = (nonCommentLines[0] || []).map((h) => String(h || "").trim()).filter(Boolean);
  const headerMap = new Map<string, number[]>(); // canonical -> array of column indices
  const canonicalToRawHeaders = new Map<string, string[]>();
  const ignoredColumns: string[] = [];

  rawHeaders.forEach((rawTrimmed, idx) => {
    const canonical = resolveCanonicalHeader(rawTrimmed, customMappings);
    if (canonical) {
      const indices = headerMap.get(canonical) || [];
      indices.push(idx);
      headerMap.set(canonical, indices);

      const headers = canonicalToRawHeaders.get(canonical) || [];
      headers.push(rawTrimmed);
      canonicalToRawHeaders.set(canonical, headers);
    } else {
      ignoredColumns.push(rawTrimmed);
    }
  });

  const duplicateColumns: { canonical: string; headers: string[] }[] = [];
  for (const [canonical, headers] of canonicalToRawHeaders.entries()) {
    if (headers.length > 1) {
      duplicateColumns.push({ canonical, headers });
    }
  }

  const getCol = (canonical: string, row?: string[]): string => {
    if (!row) return "";
    const indices = headerMap.get(canonical);
    if (!indices || indices.length === 0) return "";
    for (const idx of indices) {
      if (idx < row.length) {
        const val = String(row[idx] ?? "").trim();
        if (val) return val;
      }
    }
    return "";
  };

  const getAllCols = (canonical: string, row?: string[]): string[] => {
    if (!row) return [];
    const indices = headerMap.get(canonical);
    if (!indices || indices.length === 0) return [];
    const results: string[] = [];
    for (const idx of indices) {
      if (idx < row.length) {
        const val = String(row[idx] ?? "").trim();
        if (val) results.push(val);
      }
    }
    return results;
  };

  const parsedRows: BulkCatalogParsedRow[] = [];

  // Duplication tracking maps (case-insensitive value -> info object)
  const skuSeen = new Map<string, { rowNumber: number; name: string }>();
  const slugSeen = new Map<string, { rowNumber: number; name: string }>();

  for (let i = 1; i < nonCommentLines.length; i++) {
    const row = nonCommentLines[i];
    if (!row || row.length === 0 || !row.some((c) => String(c).trim().length > 0)) continue;
    const rowNumber = i;
    const errors: string[] = [];

    // 1. Product Name
    const name = getCol("name", row);
    if (!name) {
      errors.push("Product name is required.");
    }

    // 2. URL Slug
    const rawSlug = getCol("slug", row);
    const slug = rawSlug || (name ? generateSlug(name) : "");

    // 3. Product SKU
    const rawSku = getCol("sku", row);
    const sku = rawSku || (name ? generateSku(name, rowNumber) : `URT-${Date.now().toString(36).toUpperCase()}-${rowNumber}`);

    // Duplicate detection in file with symbol / '+' conflict resolution
    let suggestedSku: string | undefined;
    let suggestedSlug: string | undefined;

    if (sku) {
      const lowerSku = sku.toLowerCase();
      if (skuSeen.has(lowerSku)) {
        const prev = skuSeen.get(lowerSku)!;
        const hasPlusInName = name.includes("+");
        const prevHasPlusInName = prev.name.includes("+");
        const skuLacksPlus = !sku.toUpperCase().includes("PLUS");

        if ((hasPlusInName || prevHasPlusInName) && skuLacksPlus) {
          suggestedSku = `${sku.replace(/-+$/, "")}-PLUS`;
          if (slug && !slug.toLowerCase().includes("plus")) {
            suggestedSlug = `${slug.replace(/-+$/, "")}-plus`;
          }
          errors.push(
            `Duplicate SKU "${sku}" (conflicts with row #${prev.rowNumber}). Suggested: "${suggestedSku}".`
          );
        } else {
          errors.push(`Duplicate SKU "${sku}" (conflicts with row #${prev.rowNumber}).`);
        }
      } else {
        skuSeen.set(lowerSku, { rowNumber, name });
      }
    }

    if (slug) {
      const lowerSlug = slug.toLowerCase();
      if (slugSeen.has(lowerSlug)) {
        const prev = slugSeen.get(lowerSlug)!;
        errors.push(`Duplicate URL Slug "${slug}" (conflicts with row #${prev.rowNumber}).`);
      } else {
        slugSeen.set(lowerSlug, { rowNumber, name });
      }
    }

    // 4. Categories & Paths
    const categoryName = getCol("category", row);
    const subcategoryName = getCol("subcategory", row);
    const selectedPath = getCol("selected_path", row);

    // 5. Pricing & MRP
    const priceStr = getCol("base_price", row);
    const price = parseFloat(priceStr);
    if (isNaN(price) || price < 0) {
      errors.push("Base wholesale price must be a valid number greater than or equal to 0.");
    }

    const mrpStr = getCol("mrp", row);
    let mrp: number | null = null;
    if (mrpStr) {
      mrp = parseFloat(mrpStr);
      if (isNaN(mrp) || mrp < price) {
        errors.push("MRP must be greater than or equal to base wholesale price.");
      }
    }

    // 6. Stock & Quantities
    const stockStr = getCol("stock", row);
    const stock = stockStr === "" ? 0 : parseInt(stockStr, 10);
    if (isNaN(stock) || stock < 0) {
      errors.push("Stock must be an integer greater than or equal to 0.");
    }

    const moqStr = getCol("moq", row);
    const minOrderQty = moqStr === "" ? 1 : parseInt(moqStr, 10);
    if (isNaN(minOrderQty) || minOrderQty < 1) {
      errors.push("Minimum order quantity must be at least 1.");
    }

    const stepStr = getCol("order_step", row);
    const orderQtyStep = stepStr === "" ? 1 : parseInt(stepStr, 10);
    if (isNaN(orderQtyStep) || orderQtyStep < 1) {
      errors.push("Order quantity step must be at least 1.");
    }

    const lowStockStr = getCol("low_stock_threshold", row);
    const lowStockThreshold = lowStockStr === "" ? 5 : parseInt(lowStockStr, 10);
    if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
      errors.push("Low stock alert threshold must be greater than or equal to 0.");
    }

    // 7. Descriptions & Warranty (preserving internal newlines)
    const tagline = getCol("tagline", row);
    const description = getCol("description", row);
    const warrantyStr = getCol("warranty_months", row);
    const warrantyMonths = warrantyStr ? parseInt(warrantyStr, 10) : 0;

    // 8. Volume Tiers (Preserve JSON tiers or all tiers 1 to 5, non-increasing unit prices, strictly increasing quantities)
    const tiers: { min_qty: number; unit_price: number }[] = [];
    const tiersJsonStr = getCol("tiers_json", row);
    let parsedJsonTiers: { min_qty: number; unit_price: number }[] | null = null;

    if (tiersJsonStr) {
      try {
        const rawJson = JSON.parse(tiersJsonStr);
        if (Array.isArray(rawJson)) {
          const list: { min_qty: number; unit_price: number }[] = [];
          for (const item of rawJson) {
            if (typeof item === "object" && item !== null) {
              const q = parseInt(
                String(item.min_qty ?? item.minQty ?? item.min_quantity ?? item.qty ?? item.quantity ?? ""),
                10
              );
              const p = parseFloat(
                String(item.unit_price ?? item.unitPrice ?? item.price ?? item.wholesale_price ?? "")
              );
              if (!isNaN(q) && !isNaN(p) && q > 0 && p >= 0) {
                list.push({ min_qty: q, unit_price: p });
              }
            }
          }
          if (list.length > 0) {
            list.sort((a, b) => a.min_qty - b.min_qty);
            parsedJsonTiers = list;
          }
        }
      } catch (err: any) {
        errors.push(`Invalid JSON in Volume Tiers: ${err?.message || "Parse error"}`);
      }
    }

    if (parsedJsonTiers && parsedJsonTiers.length > 0) {
      for (let t = 0; t < parsedJsonTiers.length; t++) {
        const curr = parsedJsonTiers[t]!;
        if (t > 0) {
          const prev = parsedJsonTiers[t - 1]!;
          if (curr.min_qty <= prev.min_qty) {
            errors.push(`Tier ${t + 1} min qty (${curr.min_qty}) must be greater than Tier ${t} min qty (${prev.min_qty}).`);
          } else if (curr.unit_price > prev.unit_price) {
            errors.push(`Tier ${t + 1} unit price (₹${curr.unit_price}) cannot exceed Tier ${t} unit price (₹${prev.unit_price}).`);
          }
        }
        tiers.push(curr);
      }
    } else {
      const t1QtyStr = getCol("tier1_min_qty", row);
      const t1PriceStr = getCol("tier1_price", row);
      const t1Qty = t1QtyStr ? parseInt(t1QtyStr, 10) : minOrderQty;
      const t1Price = t1PriceStr ? parseFloat(t1PriceStr) : price;

      if (!isNaN(t1Qty) && !isNaN(t1Price) && t1Qty > 0 && t1Price >= 0) {
        tiers.push({ min_qty: t1Qty, unit_price: t1Price });
      } else {
        tiers.push({ min_qty: isNaN(minOrderQty) ? 1 : minOrderQty, unit_price: isNaN(price) ? 0 : price });
      }

      // Tiers 2 through 5
      for (let t = 2; t <= 5; t++) {
        const tQtyStr = getCol(`tier${t}_min_qty`, row);
        const tPriceStr = getCol(`tier${t}_price`, row);
        if (tQtyStr && tPriceStr) {
          const tQty = parseInt(tQtyStr, 10);
          const tPrice = parseFloat(tPriceStr);
          if (!isNaN(tQty) && !isNaN(tPrice) && tQty > 0 && tPrice >= 0) {
            const prevTier = tiers[tiers.length - 1];
            if (prevTier && tQty <= prevTier.min_qty) {
              errors.push(`Tier ${t} min qty (${tQty}) must be greater than Tier ${t - 1} min qty (${prevTier.min_qty}).`);
            } else if (prevTier && tPrice > prevTier.unit_price) {
              errors.push(`Tier ${t} unit price (₹${tPrice}) cannot exceed Tier ${t - 1} unit price (₹${prevTier.unit_price}).`);
            } else {
              tiers.push({ min_qty: tQty, unit_price: tPrice });
            }
          }
        }
      }
    }

    // 9. Technical Specs (JSON)
    const specsJsonStr = getCol("specs_json", row);
    let specs: Record<string, any> = {};
    if (specsJsonStr) {
      try {
        const parsed = JSON.parse(specsJsonStr);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          specs = parsed as Record<string, any>;
        } else {
          errors.push("Technical Specs must be a valid JSON object.");
        }
      } catch (err: any) {
        errors.push(`Invalid JSON in Technical Specs: ${err.message || "Parse error"}`);
      }
    }
    if (warrantyMonths > 0 && !specs.warranty) {
      specs.warranty = `${warrantyMonths} Months Manufacturer Warranty`;
    }

    // 10. Search Keywords
    const rawKeywords = getCol("keywords", row);
    let keywords: string[] = [];
    if (rawKeywords) {
      const tokens = rawKeywords.split(/[,;|\n\r]+/).map((t) => t.trim()).filter(Boolean);
      if (tokens.length > 30) {
        errors.push(`Keywords limit exceeded: maximum 30 keywords allowed (found ${tokens.length}).`);
      }
      const longKw = tokens.find((t) => t.length > 50);
      if (longKw) {
        errors.push(`Keyword "${longKw.slice(0, 20)}..." exceeds 50 character limit.`);
      }
      keywords = normalizeKeywords(rawKeywords);
    }

    // 11. Brand & Attributes
    const brand = getCol("brand", row) || (specs.brand ? String(specs.brand) : undefined);
    const compatibilityGroup = getCol("compatibility_group", row) || specs.compatibility_group;
    const attributes: Record<string, any> = {};
    if (compatibilityGroup) {
      attributes.compatibility_group = compatibilityGroup;
    }

    // 12. Images: read all columns mapped to canonical "images", split on delimiters, trim, deduplicate
    const rawImageValues = getAllCols("images", row);
    const images: string[] = [];
    for (const val of rawImageValues) {
      if (val) {
        const splitUrls = val
          .split(/[|;,]|\s+/)
          .map((u) => u.trim())
          .filter(Boolean);
        images.push(...splitUrls);
      }
    }
    const uniqueImages = Array.from(new Set(images));

    // Validate images
    uniqueImages.forEach((imgUrl, idx) => {
      const v = validateBulkImportImageUrl(imgUrl);
      if (!v.valid) {
        errors.push(`Image URL ${idx + 1}: ${v.error}`);
      }
    });

    // 13. Boolean flags via parseBool (ensure "False" never becomes true)
    const rawUrbanrat = getCol("is_urbanrat_brand", row);
    const isUrbanrat = rawUrbanrat === "" ? false : parseBool(rawUrbanrat, false);

    const rawFeatured = getCol("is_featured", row);
    const isFeatured = rawFeatured === "" ? false : parseBool(rawFeatured, false);

    const rawTrending = getCol("is_trending", row);
    const isTrending = rawTrending === "" ? false : parseBool(rawTrending, false);

    const rawActive = getCol("is_active", row);
    const isActive = rawActive === "" ? true : parseBool(rawActive, true);

    // 14. Colors & Selective Color Configuration
    const rawColors = getCol("colors", row);
    const parsedColors = rawColors ? parseColorString(rawColors) : [];
    const specsColors = Array.isArray(specs.colors) ? specs.colors : [];
    const colors = parsedColors.length > 0 ? parsedColors : specsColors;

    const rawHasColors = getCol("has_colors", row);
    let hasColors = false;
    if (rawHasColors !== "") {
      hasColors = parseBool(rawHasColors, false);
    } else if (specs.has_colors !== undefined) {
      hasColors = parseBool(specs.has_colors, false);
    } else {
      hasColors = colors.length > 0;
    }

    // Persist into specs for database compatibility
    specs.colors = hasColors ? colors : [];
    specs.has_colors = hasColors;

    parsedRows.push({
      rowNumber,
      name,
      slug,
      sku,
      suggestedSku,
      suggestedSlug,
      price: isNaN(price) ? 0 : price,
      mrp,
      stock: isNaN(stock) ? 0 : stock,
      minOrderQty: isNaN(minOrderQty) ? 1 : minOrderQty,
      orderQtyStep: isNaN(orderQtyStep) ? 1 : orderQtyStep,
      lowStockThreshold: isNaN(lowStockThreshold) ? 5 : lowStockThreshold,
      warrantyMonths: isNaN(warrantyMonths) ? 0 : warrantyMonths,
      tagline: tagline || "",
      description: description || "",
      categoryName,
      subcategoryName,
      selectedPath,
      brand: brand || "",
      attributes,
      keywords,
      specs,
      hasColors,
      colors: hasColors ? colors : [],
      images: uniqueImages,
      tiers,
      isUrbanrat,
      isFeatured,
      isTrending,
      isActive,
      isValid: errors.length === 0,
      errors,
    });
  }

  return {
    rows: parsedRows,
    ignoredColumns: Array.from(new Set(ignoredColumns)),
    duplicateColumns,
    rawHeaders,
  };
}

/**
 * Backward compatibility parser returning parsed rows
 */
export function parseSpreadsheetRows(dataLines: string[][]): BulkCatalogParsedRow[] {
  return parseSpreadsheetRowsWithReport(dataLines).rows;
}

/**
 * Parses uploaded CSV / Excel file into rows and ignored column reports.
 */
export async function parseCatalogUploadedFile(
  file: File
): Promise<BulkCatalogParsedRow[]> {
  const result = await parseCatalogUploadedFileWithReport(file);
  return result.rows;
}

export async function parseCatalogUploadedFileWithReport(
  file: File,
  customMappings?: Record<string, string>
): Promise<BulkCatalogParseResult> {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("Excel file contains no sheets.");
    }
    const sheetName =
      wb.SheetNames.find((s) => /template|product/i.test(s)) || firstSheetName;
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      throw new Error("Unable to read worksheet data.");
    }
    const rawData: string[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: false,
    });
    return parseSpreadsheetRowsWithReport(rawData, customMappings);
  } else {
    // CSV with UTF-8 and BOM handling via PapaParse
    const rawText = await file.text();
    const cleanText = rawText.replace(/^\uFEFF/, "");
    const parsed = Papa.parse<string[]>(cleanText, {
      skipEmptyLines: "greedy",
      header: false,
    });

    if (parsed.errors && parsed.errors.length > 0) {
      console.warn("PapaParse encountered CSV parsing warnings:", parsed.errors);
    }

    return parseSpreadsheetRowsWithReport(parsed.data, customMappings);
  }
}

/**
 * Compatibility helper for raw CSV string
 */
export function parseCatalogCSV(csvText: string, customMappings?: Record<string, string>): BulkCatalogParsedRow[] {
  const cleanText = (csvText || "").replace(/^\uFEFF/, "");
  const parsed = Papa.parse<string[]>(cleanText, {
    skipEmptyLines: "greedy",
    header: false,
  });
  return parseSpreadsheetRowsWithReport(parsed.data, customMappings).rows;
}

/**
 * Light asynchronous verifier for image links (validates URLs without hanging UI)
 */
export async function validateUploadedImageLinks(
  rows: BulkCatalogParsedRow[]
): Promise<BulkCatalogParsedRow[]> {
  return rows.map((row) => {
    const newErrors = [...row.errors];
    if (row.images && row.images.length > 0) {
      row.images.forEach((imgUrl, idx) => {
        const v = validateBulkImportImageUrl(imgUrl);
        if (!v.valid && !newErrors.some((e) => e.includes(v.error || ""))) {
          newErrors.push(`Image ${idx + 1}: ${v.error}`);
        }
      });
    }

    return {
      ...row,
      isValid: newErrors.length === 0,
      errors: newErrors,
    };
  });
}
