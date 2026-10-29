/**
 * Shared Catalog Header Normalization and Aliasing
 */

/**
 * Normalizes header keys by:
 * 1. Stripping UTF-8 BOM
 * 2. Removing text in parentheses (e.g. (MRP ₹), (₹/pc), (Months), (JSON))
 * 3. Lowercasing
 * 4. Stripping all non-alphanumeric characters
 *
 * Examples:
 * - "Tier 1 Min Qty", "tier1_min_qty", "Tier1-Min-Qty" -> "tier1minqty"
 * - "Tier 1 Wholesale Price (₹/pc)", "tier1_wholesale_price" -> "tier1wholesaleprice"
 * - "product_images", "Product Images", "Image URL" -> "productimages", "imageurl"
 */
export function normalizeHeaderKey(header: string): string {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Canonical field alias mapping.
 * One table per canonical field containing all accepted normalized variations.
 */
export const CANONICAL_FIELD_ALIASES: Record<string, string[]> = {
  name: ["productname", "name", "title", "producttitle"],
  slug: ["urlslug", "slug", "productslug"],
  sku: ["productsku", "sku", "itemcode", "productcode"],
  category: ["category", "maincategory", "parentcategory"],
  subcategory: ["subcategory", "subcat", "childcategory", "subcategories"],
  brand: ["brand", "brandname", "manufacturer"],
  compatibility_group: ["compatibilitygroup", "compatibility", "modelcompatibility"],
  selected_path: ["selectedpath", "categorypath", "path"],
  tagline: ["shorttagline", "tagline", "subtitle", "shortdescription", "shorttaglinesubtitle"],
  description: ["detaileddescription", "description", "fulldescription", "longdescription"],
  images: [
    "productimages",
    "imageurl",
    "imageurls",
    "images",
    "image",
    "productimage",
    "imageurlscommaseparated",
    "imageurl1",
    "image1",
    "primaryimageurl",
    "primaryimage",
    "mainimage",
    "mainimageurl",
    "coverimage",
    "coverimageurl",
    "featuredimage",
    "featuredimageurl",
    "thumbnail",
    "thumbnailurl",
    "galleryimages",
    "additionalimages",
  ],
  mrp: [
    "mrp",
    "mrpinr",
    "mrprs",
    "mrprupees",
    "mrpprice",
    "maximumretailprice",
    "maxretailprice",
    "retailprice",
    "retailmrp",
    "mrpamount",
    "mrpval",
    "mrpvalue",
    "originalprice",
    "listprice",
    "standardmrp",
  ],
  base_price: [
    "basewholesaleprice",
    "baseprice",
    "wholesaleprice",
    "price",
    "wholesaleunitprice",
    "wholesalepriceinr",
    "basepriceinr",
    "unitprice",
    "costprice",
  ],
  warranty_months: ["warrantymonths", "warranty", "warrantymonth"],

  // Volume tiers 1 - 5 and JSON volume tiers
  tiers_json: [
    "volumepricetiersjson",
    "volumepricetiers",
    "volumetiersjson",
    "volumetiers",
    "pricetiersjson",
    "pricetiers",
    "tiersjson",
    "tiers",
    "pricingtiersjson",
    "pricingtiers",
  ],
  tier1_min_qty: ["tier1minqty", "tier1minquantity", "tier1qty", "tier1minimumquantity"],
  tier1_price: ["tier1wholesaleprice", "tier1price", "tier1unitprice"],

  tier2_min_qty: ["tier2minqty", "tier2minquantity", "tier2qty", "tier2minimumquantity"],
  tier2_price: ["tier2wholesaleprice", "tier2price", "tier2unitprice"],

  tier3_min_qty: ["tier3minqty", "tier3minquantity", "tier3qty", "tier3minimumquantity"],
  tier3_price: ["tier3wholesaleprice", "tier3price", "tier3unitprice"],

  tier4_min_qty: ["tier4minqty", "tier4minquantity", "tier4qty", "tier4minimumquantity"],
  tier4_price: ["tier4wholesaleprice", "tier4price", "tier4unitprice"],

  tier5_min_qty: ["tier5minqty", "tier5minquantity", "tier5qty", "tier5minimumquantity"],
  tier5_price: ["tier5wholesaleprice", "tier5price", "tier5unitprice"],

  stock: ["initialstock", "currentstock", "stock", "stockquantity", "inventory"],
  low_stock_threshold: ["lowstockalert", "lowstockthreshold", "lowstock", "minstockalert"],
  moq: ["minorderqty", "moq", "minimumorderqty", "minimumorderquantity"],
  order_step: ["orderqtystep", "orderstep", "stepqty", "orderquantitystep"],
  specs_json: [
    "technicalspecsjson",
    "technicalspecs",
    "specsjson",
    "specs",
    "specifications",
    "technicalspecsdata",
    "specsdata",
    "productspecs",
    "productspecifications",
  ],
  keywords: ["searchkeywords", "keywords", "tags", "searchterms", "productkeywords", "metakeywords"],
  colors: [
    "colors",
    "color",
    "coloroptions",
    "colorvariants",
    "availablecolors",
    "productcolors",
    "colours",
    "colour",
    "colouroptions",
    "colourvariants",
    "colorways",
  ],
  has_colors: [
    "hascolors",
    "enablecolors",
    "colorvariantsenabled",
    "colorselection",
    "flagcolors",
    "hascolours",
    "iscolorenabled",
  ],
  is_urbanrat_brand: [
    "isurbanratbrand",
    "urbanratbrand",
    "inhousebrand",
    "urbanrat",
    "flagurbanratbrand",
    "flagurbanrat",
    "isurbanrat",
  ],
  is_featured: ["isfeatured", "featured", "flagfeatured"],
  is_trending: ["istrending", "trending", "flagtrending"],
  is_active: ["isactive", "active", "status", "enabled", "flagactive", "ispublished", "published"],
};

/**
 * Inverted alias lookup table for O(1) matching.
 */
export const HEADER_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(CANONICAL_FIELD_ALIASES)) {
    for (const alias of aliases) {
      map[alias] = canonical;
    }
  }
  return map;
})();

/**
 * Canonical field options for dropdown selection in Column Mapper UI.
 */
export const CANONICAL_FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: "name", label: "Product Name" },
  { key: "sku", label: "Product SKU" },
  { key: "slug", label: "URL Slug" },
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Subcategory" },
  { key: "brand", label: "Brand" },
  { key: "compatibility_group", label: "Compatibility Group" },
  { key: "base_price", label: "Base Wholesale Price" },
  { key: "mrp", label: "Maximum Retail Price (MRP)" },
  { key: "stock", label: "Current / Initial Stock" },
  { key: "moq", label: "Minimum Order Qty (MOQ)" },
  { key: "order_step", label: "Order Qty Step" },
  { key: "low_stock_threshold", label: "Low Stock Alert" },
  { key: "tagline", label: "Short Tagline / Subtitle" },
  { key: "description", label: "Detailed Description" },
  { key: "warranty_months", label: "Warranty (Months)" },
  { key: "tiers_json", label: "Volume Price Tiers (JSON)" },
  { key: "tier1_min_qty", label: "Tier 1 Min Qty" },
  { key: "tier1_price", label: "Tier 1 Wholesale Price" },
  { key: "tier2_min_qty", label: "Tier 2 Min Qty" },
  { key: "tier2_price", label: "Tier 2 Wholesale Price" },
  { key: "tier3_min_qty", label: "Tier 3 Min Qty" },
  { key: "tier3_price", label: "Tier 3 Wholesale Price" },
  { key: "tier4_min_qty", label: "Tier 4 Min Qty" },
  { key: "tier4_price", label: "Tier 4 Wholesale Price" },
  { key: "tier5_min_qty", label: "Tier 5 Min Qty" },
  { key: "tier5_price", label: "Tier 5 Wholesale Price" },
  { key: "specs_json", label: "Technical Specs (JSON)" },
  { key: "keywords", label: "Search Keywords" },
  { key: "colors", label: "Color Options (Comma-separated / JSON)" },
  { key: "has_colors", label: "Enable Colors (Boolean)" },
  { key: "images", label: "Product Images (URLs)" },
  { key: "is_urbanrat_brand", label: "Urbanrat Brand (Boolean)" },
  { key: "is_featured", label: "Featured (Boolean)" },
  { key: "is_trending", label: "Trending (Boolean)" },
  { key: "is_active", label: "Active (Boolean)" },
];

/**
 * Resolves a raw header to its canonical field key, allowing custom overrides.
 */
export function resolveCanonicalHeader(
  rawHeader: string,
  customMappings?: Record<string, string>
): string | null {
  if (customMappings && customMappings[rawHeader]) {
    const custom = customMappings[rawHeader];
    return custom === "ignore" ? null : custom;
  }
  const norm = normalizeHeaderKey(rawHeader);
  return HEADER_ALIASES[norm] || null;
}

/**
 * Universal boolean parser.
 * Explicitly prevents string "False" from becoming truthy.
 */
export function parseBool(val: any, defaultVal: boolean = false): boolean {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;

  const str = String(val).trim().toLowerCase();
  if (str === "") return defaultVal;
  if (["true", "yes", "y", "1"].includes(str)) return true;
  if (["false", "no", "n", "0"].includes(str)) return false;

  return defaultVal;
}
