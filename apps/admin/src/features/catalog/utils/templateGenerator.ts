import type { Category } from "@urbanrat/shared";

/**
 * Generates and triggers download of a standardized CSV catalog template
 * for the selected category with sample rows and instructions.
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
    "Image URLs (comma separated)",
    "Short Description",
    "Full Description",
    "Warranty Months",
    "Is Urbanrat Brand (TRUE/FALSE)",
  ];

  const sampleRows = [
    [
      `Sample ${category.name} Pro Edition`,
      `URT-${category.name.substring(0, 3).toUpperCase()}-001`,
      "999",
      "450",
      "100",
      "10",
      "25",
      "420",
      "50",
      "390",
      "https://example.com/front.jpg, https://example.com/back.jpg",
      `High quality ${category.name} wholesale pack`,
      `Engineered for premium performance and high durability in ${categoryPath}`,
      "12",
      "TRUE",
    ],
    [
      `Sample ${category.name} Standard Model`,
      `URT-${category.name.substring(0, 3).toUpperCase()}-002`,
      "599",
      "280",
      "250",
      "20",
      "50",
      "260",
      "100",
      "240",
      "https://example.com/front.jpg",
      `Reliable wholesale ${category.name}`,
      `Standard bulk distributor edition for pan-India delivery`,
      "6",
      "TRUE",
    ],
  ];

  // Build CSV content with header and metadata comment
  const escapeCell = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvLines = [
    `# Urbanrat Catalog Template: ${categoryPath}`,
    `# Category ID: ${category.id} | Slug: ${category.slug}`,
    `# Notes: Fields marked with * are strictly required. Unit prices in tiers must be non-increasing.`,
    headers.map(escapeCell).join(","),
    ...sampleRows.map((row) => row.map(escapeCell).join(",")),
  ];

  const csvContent = csvLines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const cleanCategorySlug = category.slug.replace(/[^a-z0-9_-]/gi, "_");
  link.setAttribute("href", url);
  link.setAttribute("download", `urbanrat_catalog_template_${cleanCategorySlug}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
