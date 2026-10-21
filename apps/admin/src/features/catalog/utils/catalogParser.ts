import type { BulkCatalogParsedRow } from "../types";

/**
 * Parses raw CSV text into rows and columns, respecting quotes.
 */
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentToken = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentToken += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(currentToken.trim());
      currentToken = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // skip \r\n
      }
      row.push(currentToken.trim());
      currentToken = "";
      if (row.length > 0 && row.some((cell) => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
    } else {
      currentToken += char;
    }
  }

  if (currentToken.length > 0 || row.length > 0) {
    row.push(currentToken.trim());
    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

/**
 * Normalizes header string for fuzzy matching (e.g. "Product Name*" -> "productname")
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parses and validates uploaded CSV text against Urbanrat catalog constraints.
 */
export function parseCatalogCSV(csvText: string): BulkCatalogParsedRow[] {
  const rawRows = parseCSV(csvText);
  // Filter out comments starting with '#'
  const dataLines = rawRows.filter(
    (row) => row.length > 0 && !row[0]?.startsWith("#")
  );

  if (dataLines.length < 2) {
    throw new Error("CSV file must contain a header row and at least one product row.");
  }

  const rawHeaders = dataLines[0] || [];
  const headerMap = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    headerMap.set(normalizeHeader(h), idx);
  });

  const getCol = (normalizedName: string, row?: string[]): string => {
    if (!row) return "";
    const idx = headerMap.get(normalizedName);
    return idx !== undefined && idx < row.length ? row[idx] || "" : "";
  };

  const parsedRows: BulkCatalogParsedRow[] = [];

  for (let i = 1; i < dataLines.length; i++) {
    const row = dataLines[i];
    if (!row || row.length === 0) continue;
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

    const moqStr =
      getCol("minorderqty", row) || getCol("moq", row) || "1";
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

    // 6. Images
    const rawImages =
      getCol("imageurls", row) || getCol("images", row) || "";
    const images = rawImages
      ? rawImages
          .split(/[,|]/)
          .map((url) => url.trim())
          .filter((url) => url.length > 0)
      : [];

    // 7. Descriptions & Specs
    const shortDescription = getCol("shortdescription", row);
    const description = getCol("fulldescription", row) || getCol("description", row);
    const warrantyMonths = parseInt(getCol("warrantymonths", row) || "0", 10);

    const specs: Record<string, any> = {};
    if (warrantyMonths > 0) {
      specs.warranty = `${warrantyMonths} Months Manufacturer Warranty`;
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
      specs,
      images,
      tiers,
      isValid: errors.length === 0,
      errors,
    });
  }

  return parsedRows;
}
