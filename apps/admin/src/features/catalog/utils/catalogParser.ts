import * as XLSX from "xlsx";
import type { BulkCatalogParsedRow } from "../types";
import { normalizeKeywords, validateCatalogImageUrl } from "@urbanrat/shared";
import { supabase } from "../../../lib/supabase";

/**
 * Normalizes header string for fuzzy matching (e.g. "Product Name*" -> "productname")
 */
function normalizeHeader(h: string): string {
  return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Re-validates a single row (used when editing fields or keywords inline in preview)
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

  // Check Volume Tiers
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
      if (imgUrl && imgUrl.trim()) {
        const v = validateCatalogImageUrl(imgUrl.trim());
        if (!v.valid) {
          errors.push(`Image ${idx + 1}: ${v.errors.join(", ")}`);
        }
      }
    });
  }

  return {
    ...row,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Parses and validates uploaded CSV/Excel spreadsheet data against Urbanrat catalog constraints.
 */
export function parseSpreadsheetRows(dataLines: string[][]): BulkCatalogParsedRow[] {
  // Filter out comment lines starting with '#'
  const nonCommentLines = dataLines.filter(
    (row) => row.length > 0 && !String(row[0] || "").startsWith("#")
  );

  if (nonCommentLines.length < 2) {
    throw new Error("File must contain a header row and at least one product row.");
  }

  const rawHeaders = nonCommentLines[0] || [];
  const headerMap = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    headerMap.set(normalizeHeader(String(h)), idx);
  });

  const getCol = (normalizedName: string, row?: string[]): string => {
    if (!row) return "";
    const idx = headerMap.get(normalizedName);
    return idx !== undefined && idx < row.length ? String(row[idx] ?? "").trim() : "";
  };

  const parsedRows: BulkCatalogParsedRow[] = [];

  for (let i = 1; i < nonCommentLines.length; i++) {
    const row = nonCommentLines[i];
    if (!row || row.length === 0 || !row.some((c) => String(c).trim().length > 0)) continue;
    const rowNumber = i;
    const errors: string[] = [];

    // 1. Name
    const name =
      getCol("productname", row) ||
      getCol("name", row) ||
      getCol("title", row);
    if (!name) {
      errors.push("Product name is required.");
    }

    // 2. SKU
    const sku =
      getCol("sku", row) ||
      `URT-${Date.now().toString(36).toUpperCase()}-${i}`;

    // 3. Pricing
    const priceStr =
      getCol("basewholesaleprice", row) ||
      getCol("wholesaleprice", row) ||
      getCol("price", row);
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

    // 4. Stock & MOQ
    const stockStr = getCol("initialstock", row) || getCol("stock", row) || "0";
    const stock = parseInt(stockStr, 10);
    if (isNaN(stock) || stock < 0) {
      errors.push("Stock must be an integer greater than or equal to 0.");
    }

    const moqStr = getCol("minorderqty", row) || getCol("moq", row) || "1";
    const minOrderQty = parseInt(moqStr, 10);
    if (isNaN(minOrderQty) || minOrderQty < 1) {
      errors.push("Minimum order quantity must be at least 1.");
    }

    // 5. Volume Tiers
    const baseMinQty = isNaN(minOrderQty) ? 1 : minOrderQty;
    const baseUnitPrice = isNaN(price) ? 0 : price;
    const tiers: { min_qty: number; unit_price: number }[] = [
      { min_qty: baseMinQty, unit_price: baseUnitPrice },
    ];

    const t2Qty = parseInt(getCol("tier2minqty", row), 10);
    const t2Price = parseFloat(getCol("tier2unitprice", row));
    if (!isNaN(t2Qty) && !isNaN(t2Price) && t2Qty > 0 && t2Price > 0) {
      const tier1 = tiers[0];
      if (tier1 && t2Qty <= tier1.min_qty) {
        errors.push(`Tier 2 min qty (${t2Qty}) must be greater than Tier 1 min qty (${tier1.min_qty}).`);
      } else if (tier1 && t2Price > tier1.unit_price) {
        errors.push(`Tier 2 unit price (₹${t2Price}) cannot exceed base price (₹${tier1.unit_price}).`);
      } else {
        tiers.push({ min_qty: t2Qty, unit_price: t2Price });
      }
    }

    const t3Qty = parseInt(getCol("tier3minqty", row), 10);
    const t3Price = parseFloat(getCol("tier3unitprice", row));
    if (!isNaN(t3Qty) && !isNaN(t3Price) && t3Qty > 0 && t3Price > 0) {
      const prevTier = tiers[tiers.length - 1];
      if (prevTier && t3Qty <= prevTier.min_qty) {
        errors.push(`Tier 3 min qty (${t3Qty}) must be greater than Tier 2 min qty (${prevTier.min_qty}).`);
      } else if (prevTier && t3Price > prevTier.unit_price) {
        errors.push(`Tier 3 unit price (₹${t3Price}) cannot exceed Tier 2 unit price (₹${prevTier.unit_price}).`);
      } else {
        tiers.push({ min_qty: t3Qty, unit_price: t3Price });
      }
    }

    // 6. Images (support Image URL 1-10 columns, with fallback to legacy comma/pipe separated column)
    const images: string[] = [];
    for (let colIdx = 1; colIdx <= 10; colIdx++) {
      const url = getCol(`imageurl${colIdx}`, row);
      if (url) images.push(url);
    }
    if (images.length === 0) {
      const rawImages =
        getCol("imageurls", row) ||
        getCol("images", row) ||
        getCol("imageurlscommaseparated", row) ||
        "";
      if (rawImages) {
        images.push(
          ...rawImages
            .split(/[,|]/)
            .map((url) => url.trim())
            .filter((url) => url.length > 0)
        );
      }
    }

    // Validate images
    images.forEach((imgUrl, idx) => {
      const v = validateCatalogImageUrl(imgUrl);
      if (!v.valid) {
        errors.push(`Image URL ${idx + 1}: ${v.errors.join(", ")}`);
      }
    });

    // 7. Descriptions & Specs
    const shortDescription = getCol("shortdescription", row);
    const description = getCol("fulldescription", row) || getCol("description", row);
    const warrantyMonths = parseInt(getCol("warrantymonths", row) || "0", 10);

    const specs: Record<string, any> = {};
    if (warrantyMonths > 0) {
      specs.warranty = `${warrantyMonths} Months Manufacturer Warranty`;
    }

    // 8. Search Keywords with limit checks
    const rawKeywords =
      getCol("keywords", row) ||
      getCol("searchkeywords", row) ||
      getCol("searchkeywordscommaseparated", row);

    let keywords: string[] = [];
    if (rawKeywords && rawKeywords.trim()) {
      const rawTokens = rawKeywords.split(/[,;|\n\r]+/).map((t) => t.trim()).filter(Boolean);
      if (rawTokens.length > 30) {
        errors.push(`Keywords limit exceeded: maximum 30 keywords allowed (found ${rawTokens.length}).`);
      }
      const longToken = rawTokens.find((t) => t.length > 50);
      if (longToken) {
        errors.push(`Keyword "${longToken.slice(0, 20)}..." exceeds 50 character limit (${longToken.length} chars).`);
      }
      keywords = normalizeKeywords(rawKeywords);
    }

    parsedRows.push({
      rowNumber,
      name,
      sku,
      price: isNaN(price) ? 0 : price,
      mrp,
      stock: isNaN(stock) ? 0 : stock,
      minOrderQty: isNaN(minOrderQty) ? 1 : minOrderQty,
      description: description || shortDescription || "",
      keywords,
      specs,
      images,
      tiers,
      isValid: errors.length === 0,
      errors,
    });
  }

  return parsedRows;
}

/**
 * Universal file parser supporting both Excel (.xlsx, .xls) and CSV (.csv, text)
 */
export async function parseCatalogUploadedFile(file: File): Promise<BulkCatalogParsedRow[]> {
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
    return parseSpreadsheetRows(rawData);
  } else {
    // CSV / text fallback
    const text = await file.text();
    const wb = XLSX.read(text, { type: "string" });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("File contains no data.");
    }
    const ws = wb.Sheets[firstSheetName];
    if (!ws) {
      throw new Error("Unable to read sheet content.");
    }
    const rawData: string[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: false,
    });
    return parseSpreadsheetRows(rawData);
  }
}

/**
 * Backward compatibility helper for raw CSV string
 */
export function parseCatalogCSV(csvText: string): BulkCatalogParsedRow[] {
  const wb = XLSX.read(csvText, { type: "string" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("CSV contains no data.");
  }
  const ws = wb.Sheets[firstSheetName];
  if (!ws) {
    throw new Error("Unable to read CSV content.");
  }
  const rawData: string[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  });
  return parseSpreadsheetRows(rawData);
}

/**
 * Asynchronously verifies image links in bulk uploaded rows:
 * 1. Links from 'catalog-images' bucket are checked against catalog_images table.
 * 2. External links are probed for reachability and valid image headers/loading.
 * 3. Any failures are appended as row errors and invalidate the row in the preview table.
 */
export async function validateUploadedImageLinks(
  rows: BulkCatalogParsedRow[]
): Promise<BulkCatalogParsedRow[]> {
  const allUrls = new Set<string>();
  for (const r of rows) {
    if (r.images && r.images.length > 0) {
      for (const u of r.images) {
        if (u && u.trim()) allUrls.add(u.trim());
      }
    }
  }

  if (allUrls.size === 0) return rows;

  const urlErrors = new Map<string, string>();
  const ownBucketUrls: string[] = [];
  const externalUrls: string[] = [];

  for (const url of allUrls) {
    const val = validateCatalogImageUrl(url);
    if (!val.valid) {
      urlErrors.set(url, val.errors.join("; "));
    } else if (val.isCatalogBucketUrl) {
      ownBucketUrls.push(url);
    } else {
      externalUrls.push(url);
    }
  }

  // 1. Check own bucket URLs in catalog_images table
  if (ownBucketUrls.length > 0) {
    try {
      const { data, error } = await supabase
        .from("catalog_images")
        .select("public_url")
        .in("public_url", ownBucketUrls)
        .is("deleted_at", null);

      if (error) {
        console.warn("Could not query catalog_images table:", error);
      } else {
        const foundSet = new Set((data || []).map((d) => d.public_url));
        for (const u of ownBucketUrls) {
          if (!foundSet.has(u)) {
            urlErrors.set(
              u,
              "Image URL belongs to catalog-images bucket but does not exist in the Image Library"
            );
          }
        }
      }
    } catch (e) {
      console.warn("Error validating bucket images:", e);
    }
  }

  // 2. Probe external URLs for reachability
  if (externalUrls.length > 0 && typeof window !== "undefined" && typeof Image !== "undefined") {
    const probe = (url: string): Promise<void> =>
      new Promise((resolve) => {
        const img = new Image();
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            urlErrors.set(url, "Image link timed out or is unreachable");
            resolve();
          }
        }, 3500);

        img.onload = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        };

        img.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            urlErrors.set(url, "Image link is unreachable or not a valid image");
            resolve();
          }
        };

        img.src = url;
      });

    const concurrency = 6;
    for (let i = 0; i < externalUrls.length; i += concurrency) {
      const batch = externalUrls.slice(i, i + concurrency);
      await Promise.all(batch.map((u) => probe(u)));
    }
  }

  // Apply errors to rows
  return rows.map((row) => {
    const newErrors = [...row.errors];
    if (row.images && row.images.length > 0) {
      row.images.forEach((imgUrl, idx) => {
        const err = urlErrors.get(imgUrl.trim());
        if (err && !newErrors.some((e) => e.includes(err))) {
          newErrors.push(`Image ${idx + 1}: ${err}`);
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

