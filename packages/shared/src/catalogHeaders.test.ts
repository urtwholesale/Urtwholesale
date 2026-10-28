import { describe, it, expect } from "vitest";
import { normalizeHeaderKey, resolveCanonicalHeader, parseBool } from "./catalogHeaders";

describe("catalogHeaders", () => {
  it("normalizes headers by stripping BOM, parens, and non-alphanumerics", () => {
    expect(normalizeHeaderKey("Product Name")).toBe("productname");
    expect(normalizeHeaderKey("Maximum Retail Price (MRP ₹)")).toBe("maximumretailprice");
    expect(normalizeHeaderKey("Tier 1 Wholesale Price (₹/pc)")).toBe("tier1wholesaleprice");
    expect(normalizeHeaderKey("Technical Specs (JSON)")).toBe("technicalspecs");
    expect(normalizeHeaderKey("\uFEFFProduct SKU* ")).toBe("productsku");
    expect(normalizeHeaderKey("tier1_min_qty")).toBe("tier1minqty");
    expect(normalizeHeaderKey("tier1_wholesale_price")).toBe("tier1wholesaleprice");
    expect(normalizeHeaderKey("product_images")).toBe("productimages");
  });

  it("resolves canonical fields from snake_case G-TEL style headers", () => {
    expect(resolveCanonicalHeader("product_name")).toBe("name");
    expect(resolveCanonicalHeader("url_slug")).toBe("slug");
    expect(resolveCanonicalHeader("product_sku")).toBe("sku");
    expect(resolveCanonicalHeader("category")).toBe("category");
    expect(resolveCanonicalHeader("subcategory")).toBe("subcategory");
    expect(resolveCanonicalHeader("brand")).toBe("brand");
    expect(resolveCanonicalHeader("compatibility_group")).toBe("compatibility_group");
    expect(resolveCanonicalHeader("short_tagline")).toBe("tagline");
    expect(resolveCanonicalHeader("detailed_description")).toBe("description");
    expect(resolveCanonicalHeader("product_images")).toBe("images");
    expect(resolveCanonicalHeader("primary_image_url")).toBe("images");
    expect(resolveCanonicalHeader("mrp")).toBe("mrp");
    expect(resolveCanonicalHeader("mrp_inr")).toBe("mrp");
    expect(resolveCanonicalHeader("MRP (INR)")).toBe("mrp");
    expect(resolveCanonicalHeader("volume_price_tiers_json")).toBe("tiers_json");
    expect(resolveCanonicalHeader("base_wholesale_price")).toBe("base_price");
    expect(resolveCanonicalHeader("warranty_months")).toBe("warranty_months");
    expect(resolveCanonicalHeader("tier1_min_qty")).toBe("tier1_min_qty");
    expect(resolveCanonicalHeader("tier1_wholesale_price")).toBe("tier1_price");
    expect(resolveCanonicalHeader("tier2_min_qty")).toBe("tier2_min_qty");
    expect(resolveCanonicalHeader("tier2_wholesale_price")).toBe("tier2_price");
    expect(resolveCanonicalHeader("tier3_min_qty")).toBe("tier3_min_qty");
    expect(resolveCanonicalHeader("tier3_wholesale_price")).toBe("tier3_price");
    expect(resolveCanonicalHeader("initial_stock")).toBe("stock");
    expect(resolveCanonicalHeader("min_order_qty")).toBe("moq");
    expect(resolveCanonicalHeader("order_qty_step")).toBe("order_step");
    expect(resolveCanonicalHeader("search_keywords")).toBe("keywords");
    expect(resolveCanonicalHeader("is_urbanrat_brand")).toBe("is_urbanrat_brand");
    expect(resolveCanonicalHeader("flag_urbanrat_brand")).toBe("is_urbanrat_brand");
    expect(resolveCanonicalHeader("is_featured")).toBe("is_featured");
    expect(resolveCanonicalHeader("flag_featured")).toBe("is_featured");
    expect(resolveCanonicalHeader("is_trending")).toBe("is_trending");
    expect(resolveCanonicalHeader("flag_trending")).toBe("is_trending");
    expect(resolveCanonicalHeader("is_active")).toBe("is_active");
    expect(resolveCanonicalHeader("flag_active")).toBe("is_active");
  });

  it("resolves canonical fields from SuperX / Editor template style headers", () => {
    expect(resolveCanonicalHeader("Product Name")).toBe("name");
    expect(resolveCanonicalHeader("URL Slug")).toBe("slug");
    expect(resolveCanonicalHeader("Product SKU")).toBe("sku");
    expect(resolveCanonicalHeader("Category")).toBe("category");
    expect(resolveCanonicalHeader("Subcategory")).toBe("subcategory");
    expect(resolveCanonicalHeader("Maximum Retail Price (MRP ₹)")).toBe("mrp");
    expect(resolveCanonicalHeader("Detailed Description")).toBe("description");
    expect(resolveCanonicalHeader("Base Wholesale Price")).toBe("base_price");
    expect(resolveCanonicalHeader("Tier 2 Wholesale Price (₹/pc)")).toBe("tier2_price");
    expect(resolveCanonicalHeader("Current Stock")).toBe("stock");
    expect(resolveCanonicalHeader("Low Stock Alert")).toBe("low_stock_threshold");
    expect(resolveCanonicalHeader("Urbanrat Brand")).toBe("is_urbanrat_brand");
    expect(resolveCanonicalHeader("Compatibility Group")).toBe("compatibility_group");
    expect(resolveCanonicalHeader("Image URL")).toBe("images");
  });

  it("supports custom mappings and ignoring columns", () => {
    const custom = {
      "Custom Field": "brand",
      "Skip Me": "ignore",
    };
    expect(resolveCanonicalHeader("Custom Field", custom)).toBe("brand");
    expect(resolveCanonicalHeader("Skip Me", custom)).toBe(null);
  });

  it("parseBool strictly parses false and true values", () => {
    expect(parseBool("False")).toBe(false);
    expect(parseBool("FALSE")).toBe(false);
    expect(parseBool(false)).toBe(false);
    expect(parseBool("no")).toBe(false);
    expect(parseBool(0)).toBe(false);
    expect(parseBool("0")).toBe(false);

    expect(parseBool("True")).toBe(true);
    expect(parseBool("TRUE")).toBe(true);
    expect(parseBool(true)).toBe(true);
    expect(parseBool("yes")).toBe(true);
    expect(parseBool(1)).toBe(true);
    expect(parseBool("1")).toBe(true);

    // Empty with default
    expect(parseBool("", false)).toBe(false);
    expect(parseBool("", true)).toBe(true);
    expect(parseBool(null, false)).toBe(false);
  });
});
