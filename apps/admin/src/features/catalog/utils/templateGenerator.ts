import * as XLSX from "xlsx";
import type { Category } from "@urbanrat/shared";
import type { CatalogImage } from "../../../lib/adminService";
import { parseSkuFromFilename, parseImageIndex } from "@urbanrat/shared";

/**
 * Generates and triggers download of a standardized Excel (.xlsx) catalog template
 * with a 'Products Template' sheet and a dedicated 'Instructions' sheet detailing
 * all fields, price tier rules, and Search Keywords constraints.
 */
export function downloadCatalogTemplate(category: Category, categoryPath: string): void {
  const headers = [
    "Product Name*",
    "SKU",
    "MRP (₹)",
    "Base Wholesale Price (₹)*",
    "Initial Stock*",
    "Min Order Qty*",
    "Tier 2 Min Qty",
    "Tier 2 Unit Price (₹)",
    "Tier 3 Min Qty",
    "Tier 3 Unit Price (₹)",
    "Image URL 1",
    "Image URL 2",
    "Image URL 3",
    "Image URL 4",
    "Image URL 5",
    "Short Description",
    "Full Description",
    "Warranty Months",
    "Is Urbanrat Brand (TRUE/FALSE)",
    "Keywords",
  ];

  const sampleRows = [
    [
      `Sample ${category.name} Pro Edition`,
      `URT-${category.name.substring(0, 3).toUpperCase()}-001`,
      999,
      450,
      100,
      10,
      25,
      420,
      50,
      390,
      "https://example.com/front.jpg",
      "https://example.com/back.jpg",
      "",
      "",
      "",
      `High quality ${category.name} wholesale pack`,
      `Engineered for premium performance and high durability in ${categoryPath}`,
      12,
      "TRUE",
      `${category.name.toLowerCase()}, wholesale, premium, ${category.slug}, fast dispatch`,
    ],
    [
      `Sample ${category.name} Standard Model`,
      `URT-${category.name.substring(0, 3).toUpperCase()}-002`,
      599,
      280,
      250,
      20,
      50,
      260,
      100,
      240,
      "https://example.com/front.jpg",
      "",
      "",
      "",
      "",
      `Reliable wholesale ${category.name}`,
      `Standard bulk distributor edition for pan-India delivery`,
      6,
      "TRUE",
      `${category.name.toLowerCase()}, bulk, distributor, standard edition`,
    ],
  ];

  // Instructions Sheet content
  const instructions = [
    ["Urbanrat Wholesale — Bulk Catalog Upload Guidelines"],
    [`Target Category: ${categoryPath}`],
    [`Category ID: ${category.id} | Slug: ${category.slug}`],
    [""],
    ["Column Name", "Required?", "Validation Rules", "Guidance & Examples"],
    ["Product Name*", "YES", "Min 3 chars, max 200 chars", "Official title displayed on marketplace"],
    ["SKU", "NO", "Unique alphanumeric identifier", "Auto-generated if left blank (e.g. URT-CAT-001)"],
    ["MRP (₹)", "NO", "Must be >= Wholesale Price", "Maximum retail price shown with strikethrough"],
    ["Base Wholesale Price (₹)*", "YES", "Number >= 0", "Starting wholesale price for MOQ tier 1"],
    ["Initial Stock*", "YES", "Integer >= 0", "Current live warehouse inventory count"],
    ["Min Order Qty*", "YES", "Integer >= 1", "Minimum quantity buyers must order (Tier 1 min)"],
    ["Tier 2 Min Qty", "NO", "Must be > Min Order Qty", "Volume discount threshold 2 (e.g. 25 units)"],
    ["Tier 2 Unit Price (₹)", "NO", "Must be <= Base Price", "Discounted wholesale rate for tier 2"],
    ["Tier 3 Min Qty", "NO", "Must be > Tier 2 Min Qty", "Volume discount threshold 3 (e.g. 50 units)"],
    ["Tier 3 Unit Price (₹)", "NO", "Must be <= Tier 2 Price", "Deepest wholesale rate for tier 3"],
    ["Image URL 1", "NO", "HTTPS URL ending in image extension", "Primary product image (front photo)"],
    ["Image URL 2", "NO", "Same as above", "Additional angle or variant"],
    ["Image URL 3", "NO", "Same as above", "Additional image"],
    ["Image URL 4", "NO", "Same as above", "Additional image"],
    ["Image URL 5", "NO", "Same as above", "Additional image"],
    ["Short Description", "NO", "Single-sentence summary", "Displayed on catalog cards and search snippets"],
    ["Full Description", "NO", "Full technical product text", "Specifications, box contents, durability details"],
    ["Warranty Months", "NO", "Integer (months)", "Manufacturer warranty duration in months (e.g. 12)"],
    ["Is Urbanrat Brand (TRUE/FALSE)", "NO", "TRUE or FALSE", "Marks verified Urbanrat in-house brand items"],
    [
      "Keywords",
      "NO",
      "Comma, semicolon, or pipe-separated words. Max 30 keywords per product, up to 50 characters each.",
      "Add words buyers search for: alternate names, model numbers, compatible devices, common misspellings (e.g. 'fast charger, 65w adapter, type c cable, travel plug'). Automatically lowercased, trimmed, and deduplicated.",
    ],
  ];

  // Build Workbook using SheetJS
  const wb = XLSX.utils.book_new();

  // 1. Template sheet
  const wsTemplate = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  wsTemplate["!cols"] = [
    { wch: 30 }, // Product Name
    { wch: 20 }, // SKU
    { wch: 12 }, // MRP
    { wch: 22 }, // Base Price
    { wch: 14 }, // Stock
    { wch: 14 }, // MOQ
    { wch: 15 }, // Tier 2 Qty
    { wch: 18 }, // Tier 2 Price
    { wch: 15 }, // Tier 3 Qty
    { wch: 18 }, // Tier 3 Price
    { wch: 40 }, // Image URL 1
    { wch: 40 }, // Image URL 2
    { wch: 40 }, // Image URL 3
    { wch: 40 }, // Image URL 4
    { wch: 40 }, // Image URL 5
    { wch: 30 }, // Short Desc
    { wch: 45 }, // Full Desc
    { wch: 16 }, // Warranty
    { wch: 25 }, // Is Urbanrat
    { wch: 40 }, // Keywords
  ];
  XLSX.utils.book_append_sheet(wb, wsTemplate, "Products Template");

  // 2. Instructions sheet
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions["!cols"] = [
    { wch: 25 },
    { wch: 12 },
    { wch: 45 },
    { wch: 55 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

  // Trigger browser download
  const cleanCategorySlug = category.slug.replace(/[^a-z0-9_-]/gi, "_");
  XLSX.writeFile(wb, `urbanrat_catalog_template_${cleanCategorySlug}.xlsx`);
}

/**
 * Generates and triggers download of a prefilled template with SKU and Image URL columns
 * populated from the Image Library. Unmatched images go to a separate sheet.
 */
export function downloadPrefilledTemplate(
  category: Category,
  _categoryPath: string,
  libraryImages: CatalogImage[]
): void {
  // Group images by sku_hint
  const skuGroups = new Map<string, CatalogImage[]>();
  const unmatched: CatalogImage[] = [];

  for (const img of libraryImages) {
    const sku = img.sku_hint || parseSkuFromFilename(img.original_name).sku;
    if (sku) {
      const existing = skuGroups.get(sku) || [];
      existing.push(img);
      skuGroups.set(sku, existing);
    } else {
      unmatched.push(img);
    }
  }

  const headers = [
    "Product Name*",
    "SKU",
    "MRP (₹)",
    "Base Wholesale Price (₹)*",
    "Initial Stock*",
    "Min Order Qty*",
    "Tier 2 Min Qty",
    "Tier 2 Unit Price (₹)",
    "Tier 3 Min Qty",
    "Tier 3 Unit Price (₹)",
    "Image URL 1",
    "Image URL 2",
    "Image URL 3",
    "Image URL 4",
    "Image URL 5",
    "Short Description",
    "Full Description",
    "Warranty Months",
    "Is Urbanrat Brand (TRUE/FALSE)",
    "Keywords",
  ];

  // Build prefilled rows
  const dataRows: (string | number)[][] = [];
  for (const [sku, imgs] of skuGroups.entries()) {
    // Sort images by their parsed index
    const sorted = [...imgs].sort(
      (a, b) => parseImageIndex(a.original_name) - parseImageIndex(b.original_name)
    );

    const imageUrls = sorted.slice(0, 5).map((img) => img.public_url);
    while (imageUrls.length < 5) imageUrls.push("");

    dataRows.push([
      "", // Product Name — to be filled
      sku,
      "", // MRP
      "", // Base Price
      "", // Stock
      "", // MOQ
      "", // Tier 2 Qty
      "", // Tier 2 Price
      "", // Tier 3 Qty
      "", // Tier 3 Price
      imageUrls[0] || "",
      imageUrls[1] || "",
      imageUrls[2] || "",
      imageUrls[3] || "",
      imageUrls[4] || "",
      "", // Short Desc
      "", // Full Desc
      "", // Warranty
      "TRUE",
      "", // Keywords
    ]);
  }

  const wb = XLSX.utils.book_new();

  // 1. Prefilled template sheet
  const wsTemplate = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  wsTemplate["!cols"] = [
    { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 22 }, { wch: 14 },
    { wch: 14 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 },
    { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 40 },
    { wch: 30 }, { wch: 45 }, { wch: 16 }, { wch: 25 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTemplate, "Products Template");

  // 2. Unmatched images sheet
  if (unmatched.length > 0) {
    const unmatchedHeaders = ["Filename", "Public URL", "Uploaded At"];
    const unmatchedRows = unmatched.map((img) => [
      img.original_name,
      img.public_url,
      img.created_at,
    ]);
    const wsUnmatched = XLSX.utils.aoa_to_sheet([unmatchedHeaders, ...unmatchedRows]);
    wsUnmatched["!cols"] = [{ wch: 30 }, { wch: 60 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsUnmatched, "Unmatched Images");
  }

  const cleanCategorySlug = category.slug.replace(/[^a-z0-9_-]/gi, "_");
  XLSX.writeFile(wb, `urbanrat_prefilled_template_${cleanCategorySlug}.xlsx`);
}
