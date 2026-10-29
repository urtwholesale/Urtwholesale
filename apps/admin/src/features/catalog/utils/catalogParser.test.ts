import { describe, it, expect } from "vitest";
import { parseSpreadsheetRowsWithReport } from "./catalogParser";
import Papa from "papaparse";

const CSV_FIXTURE_5_ROWS = `Product Name,URL Slug,Product SKU,Category,Subcategory,Selected Path,Maximum Retail Price (MRP ₹),Warranty (Months),Short Tagline / Subtitle,Detailed Description,Base Wholesale Price,Tier 1 Min Qty,Tier 1 Wholesale Price (₹/pc),Tier 2 Min Qty,Tier 2 Wholesale Price (₹/pc),Tier 3 Min Qty,Tier 3 Wholesale Price (₹/pc),Current Stock,Min Order Qty,Order Qty Step,Low Stock Alert,Technical Specs (JSON),Search Keywords,Urbanrat Brand,Featured,Trending,Active,Brand,Compatibility Group,Image URL
realme 5,realme 5,SX-REA-REALME-5,Tempered Glass,super x,Tempered Glass > super x > realme 5 (Product),13.3,0,,original china imported super-x,13.3,10,13.3,20,13.3,50,13.3,993,10,1,200,"{""material"": ""Super X Tempered Glass"", ""finish"": ""Anti-Static Anti-Dust"", ""glue"": ""Full Glue 330 AB"", ""brand_compatibility"": ""Realme"", ""compatibility_group"": ""GRP-01 (Universal Waterdrop 6.5-6.6 Inch)""}","realme 5, realme, super x, tempered glass, screen protector, 9d, 11d",False,False,False,True,Realme,GRP-01 (Universal Waterdrop 6.5-6.6 Inch),https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/product-images/catalog/2026/10/d4bcd31f-0d15-40f0-ad50-061851ce0988-g-tel-d-plus-tempered-glass.webp
realme 5i,realme 5i,SX-REA-REALME-5I,Tempered Glass,super x,Tempered Glass > super x > realme 5i (Product),13.3,0,,original china imported super-x,13.3,10,13.3,20,13.3,50,13.3,993,10,1,200,"{""material"": ""Super X Tempered Glass"", ""finish"": ""Anti-Static Anti-Dust"", ""glue"": ""Full Glue 330 AB"", ""brand_compatibility"": ""Realme"", ""compatibility_group"": ""GRP-01 (Universal Waterdrop 6.5-6.6 Inch)""}","realme 5i, realme, super x, tempered glass, screen protector, 9d, 11d",False,False,False,True,Realme,GRP-01 (Universal Waterdrop 6.5-6.6 Inch),https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/product-images/catalog/2026/10/d4bcd31f-0d15-40f0-ad50-061851ce0988-g-tel-d-plus-tempered-glass.webp
mt g86 power,mt g86 power,SX-MOT-MT-G86-POWER,Tempered Glass,super x,Tempered Glass > super x > mt g86 power (Product),13.3,0,,original china imported super-x,13.3,10,13.3,20,13.3,50,13.3,993,10,1,200,"{""material"": ""Super X Tempered Glass"", ""finish"": ""Anti-Static Anti-Dust"", ""glue"": ""Full Glue 330 AB"", ""brand_compatibility"": ""Motorola"", ""compatibility_group"": ""Label: MT G86 / G86 POWER""}","mt g86 power, motorola, super x, tempered glass, screen protector, 9d, 11d",False,False,False,True,Motorola,Label: MT G86 / G86 POWER,https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/product-images/catalog/2026/10/d4bcd31f-0d15-40f0-ad50-061851ce0988-g-tel-d-plus-tempered-glass.webp
mt g86 power duplicate,mt g86 power duplicate,SX-MOT-MT-G86-POWER,Tempered Glass,super x,Tempered Glass > super x > mt g86 power dup (Product),13.3,0,,duplicate item,13.3,10,13.3,20,13.3,50,13.3,993,10,1,200,"{""material"": ""Super X Tempered Glass""}","mt g86 power",False,False,False,True,Motorola,Label: MT G86 / G86 POWER,https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/product-images/catalog/2026/10/d4bcd31f-0d15-40f0-ad50-061851ce0988-g-tel-d-plus-tempered-glass.webp
oppo a2,oppo a2,SX-OPP-OPPO-A2,Tempered Glass,super x,Tempered Glass > super x > oppo a2 (Product),13.3,0,,original china imported super-x,13.3,10,13.3,20,13.3,50,13.3,993,10,1,200,"{""material"": ""Super X Tempered Glass""}","oppo a2, oppo",False,False,False,True,OPPO,GRP-01 (Universal Waterdrop 6.5-6.6 Inch),https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/product-images/catalog/2026/10/d4bcd31f-0d15-40f0-ad50-061851ce0988-g-tel-d-plus-tempered-glass.webp`;

const CSV_FIXTURE_GTEL_6_ROWS = `product_name,url_slug,product_sku,category,subcategory,brand,compatibility_group,short_tagline,detailed_description,product_images,mrp,base_wholesale_price,warranty_months,tier1_min_qty,tier1_wholesale_price,tier2_min_qty,tier2_wholesale_price,tier3_min_qty,tier3_wholesale_price,initial_stock,min_order_qty,order_qty_step,search_keywords,is_urbanrat_brand,is_featured,is_trending,is_active
Motorola G85 5G,motorola-g85-5g,UV-MOT-G85-5G,UV Glass,Curved Glass,Motorola,GRP-MOTO-G85,Premium UV Curved Glass,"Specially engineered for Motorola G85 5G
Edge-to-edge curve protection
Full UV liquid glue adhesion",https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500,99,40,6,5,38,20,34,30,32,150,5,1,"motorola, g85, uv glass, curved glass",false,false,true,true
Vivo V60E,vivo-v60e,UV-VIVO-VIVO-V60E,UV Glass,Curved Glass,Vivo,GRP-VIVO-V60E,UV Glass,"Original UV Tempered Glass",https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/product-images/catalog/2026/10/vivo-v60e.webp,99,40,0,5,38,20,34,30,32,100,5,1,"vivo, v60e, uv glass",false,false,false,true
Vivo V60E,vivo-v60e,UV-VIVO-VIVO-V60E,UV Glass,Curved Glass,Vivo,GRP-VIVO-V60E,UV Glass,"Original UV Tempered Glass duplicate",https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/product-images/catalog/2026/10/vivo-v60e.webp,99,40,0,5,38,20,34,30,32,100,5,1,"vivo, v60e, uv glass",false,false,false,true
Motorola EDGE 70 PRO,motorola-edge-70-pro,UV-MOTOROLA-MOTOROLA-EDGE-70-PRO,UV Glass,Curved Glass,Motorola,GRP-EDGE-70,UV Glass PRO,"Premium UV Glass for Edge 70 Pro",https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500,149,45,6,5,38,20,34,30,32,80,5,1,"motorola, edge 70 pro",false,true,true,true
Motorola EDGE 70 PRO+,motorola-edge-70-pro,UV-MOTOROLA-MOTOROLA-EDGE-70-PRO,UV Glass,Curved Glass,Motorola,GRP-EDGE-70-PLUS,UV Glass PRO+,"Premium UV Glass for Edge 70 Pro Plus",https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500,149,45,6,5,38,20,34,30,32,80,5,1,"motorola, edge 70 pro plus",false,true,true,true
OnePlus 12,oneplus-12,UV-OP-ONEPLUS-12,UV Glass,Curved Glass,OnePlus,GRP-OP-12,UV Glass,"Ultra clear curved protector",https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500,129,42,12,5,38,20,34,30,32,200,5,1,"oneplus, 12, uv glass",false,false,true,true`;

describe("Bulk CSV Catalog Parser — SuperX 5-row Fixture", () => {
  const parsed = Papa.parse<string[]>(CSV_FIXTURE_5_ROWS, { skipEmptyLines: "greedy", header: false });
  const result = parseSpreadsheetRowsWithReport(parsed.data);
  const rows = result.rows;

  it("has 0 ignored columns for SuperX format", () => {
    expect(result.ignoredColumns).toHaveLength(0);
  });

  it("parses exactly 5 product rows", () => {
    expect(rows).toHaveLength(5);
  });

  it("preserves SKU and Slug exactly as provided in the CSV without row numbers", () => {
    const mtG86 = rows.find((r) => r.name === "mt g86 power");
    expect(mtG86).toBeDefined();
    expect(mtG86?.sku).toBe("SX-MOT-MT-G86-POWER");
    expect(mtG86?.slug).toBe("mt g86 power");
  });

  it("keeps all 3 tiers even though all prices are 13.3 (non-increasing prices)", () => {
    const mtG86 = rows.find((r) => r.name === "mt g86 power")!;
    expect(mtG86.tiers).toHaveLength(3);
    expect(mtG86.tiers[0]).toEqual({ min_qty: 10, unit_price: 13.3 });
    expect(mtG86.tiers[1]).toEqual({ min_qty: 20, unit_price: 13.3 });
    expect(mtG86.tiers[2]).toEqual({ min_qty: 50, unit_price: 13.3 });
  });

  it("correctly extracts stock 993, low stock 200, MRP 13.3, description, keywords, specs object, and image URL", () => {
    const mtG86 = rows.find((r) => r.name === "mt g86 power")!;
    expect(mtG86.stock).toBe(993);
    expect(mtG86.lowStockThreshold).toBe(200);
    expect(mtG86.mrp).toBe(13.3);
    expect(mtG86.description).toBe("original china imported super-x");
    expect(mtG86.keywords).toBeDefined();
    expect(mtG86.keywords!.length).toBeGreaterThan(0);
    expect(mtG86.keywords).toContain("mt g86 power");

    // Specs JSON parse
    expect(mtG86.specs).toBeDefined();
    expect(mtG86.specs?.material).toBe("Super X Tempered Glass");
    expect(mtG86.specs?.finish).toBe("Anti-Static Anti-Dust");
    expect(mtG86.specs?.glue).toBe("Full Glue 330 AB");

    // Brand and attributes
    expect(mtG86.brand).toBe("Motorola");
    expect(mtG86.attributes?.compatibility_group).toBe("Label: MT G86 / G86 POWER");

    // Images
    expect(mtG86.images).toHaveLength(1);
    expect(mtG86.images[0]).toContain("product-images/catalog");
  });

  it("parses Urbanrat Brand === false and Active === true via parseBool", () => {
    const mtG86 = rows.find((r) => r.name === "mt g86 power")!;
    expect(mtG86.isUrbanrat).toBe(false);
    expect(mtG86.isActive).toBe(true);
    expect(mtG86.isFeatured).toBe(false);
    expect(mtG86.isTrending).toBe(false);
  });

  it("reports duplicate SKU as an error with the conflicting row number", () => {
    const row3 = rows[2]!; // mt g86 power (rowNumber: 3)
    const row4 = rows[3]!; // mt g86 power duplicate (rowNumber: 4)

    expect(row3.sku).toBe("SX-MOT-MT-G86-POWER");
    expect(row4.sku).toBe("SX-MOT-MT-G86-POWER");

    expect(row4.isValid).toBe(false);
    expect(row4.errors.some((e) => e.includes('Duplicate SKU "SX-MOT-MT-G86-POWER" (conflicts with row #3)'))).toBe(true);
  });
});

describe("Bulk CSV Catalog Parser — G-TEL UV Glass 6-row Fixture", () => {
  const parsed = Papa.parse<string[]>(CSV_FIXTURE_GTEL_6_ROWS, { skipEmptyLines: "greedy", header: false });
  const result = parseSpreadsheetRowsWithReport(parsed.data);
  const rows = result.rows;

  it("has 0 ignored columns for snake_case G-TEL format", () => {
    expect(result.ignoredColumns).toHaveLength(0);
  });

  it("parses exactly 6 product rows with correct tier counts", () => {
    expect(rows).toHaveLength(6);
    // Every row must have 3 volume tiers: 5@38, 20@34, 30@32
    rows.forEach((r) => {
      expect(r.tiers).toHaveLength(3);
      expect(r.tiers[0]).toEqual({ min_qty: 5, unit_price: 38 });
      expect(r.tiers[1]).toEqual({ min_qty: 20, unit_price: 34 });
      expect(r.tiers[2]).toEqual({ min_qty: 30, unit_price: 32 });
    });
  });

  it("preserves multi-line descriptions with internal newlines intact", () => {
    const motoG85 = rows.find((r) => r.name === "Motorola G85 5G");
    expect(motoG85).toBeDefined();
    expect(motoG85?.description).toContain("\n");
    expect(motoG85?.description).toContain("Edge-to-edge curve protection");
    expect(motoG85?.description).toContain("Full UV liquid glue adhesion");
  });

  it("correctly extracts product_images URLs into images array", () => {
    rows.forEach((r) => {
      expect(r.images).toHaveLength(1);
      expect(r.images[0]).toMatch(/^https:\/\//);
    });
  });

  it("reports Vivo V60E duplicate with conflicting row number #2", () => {
    const row2 = rows[1]!; // Vivo V60E (rowNumber: 2)
    const row3 = rows[2]!; // Vivo V60E duplicate (rowNumber: 3)

    expect(row2.sku).toBe("UV-VIVO-VIVO-V60E");
    expect(row3.sku).toBe("UV-VIVO-VIVO-V60E");
    expect(row3.isValid).toBe(false);
    expect(row3.errors.some((e) => e.includes('conflicts with row #2'))).toBe(true);
  });

  it("detects Motorola EDGE 70 PRO+ collision and suggests unique SKU ending in -PLUS", () => {
    const row4 = rows[3]!; // Motorola EDGE 70 PRO (rowNumber: 4)
    const row5 = rows[4]!; // Motorola EDGE 70 PRO+ (rowNumber: 5)

    expect(row4.name).toBe("Motorola EDGE 70 PRO");
    expect(row5.name).toBe("Motorola EDGE 70 PRO+");
    expect(row5.sku).toBe("UV-MOTOROLA-MOTOROLA-EDGE-70-PRO");

    // Must report collision with row 4
    expect(row5.isValid).toBe(false);
    expect(row5.errors.some((e) => e.includes('conflicts with row #4'))).toBe(true);

    // Must generate suggested SKU with -PLUS
    expect(row5.suggestedSku).toBe("UV-MOTOROLA-MOTOROLA-EDGE-70-PRO-PLUS");
  });
});

describe("Bulk CSV Catalog Parser — Mobile Accessories with mrp_inr & volume_price_tiers_json", () => {
  const CSV_FIXTURE_MOBILE_ACCESSORIES = `product_name,url_slug,product_sku,category,subcategory,mrp_inr,base_wholesale_price,wholesale_price,volume_price_tiers_json,warranty_months,brand,compatibility_group,short_tagline,primary_image_url,product_images,detailed_description,initial_stock,min_order_qty,order_qty_step,technical_specs_json,search_keywords,flag_urbanrat_brand,flag_featured,flag_trending,flag_active
"Fresh Pyramid Multi-Angle Stackable Mobile Stand (Series 38, 20-Piece Bulk Poly Pack)",fresh-pyramid-multi-angle-stackable-mobile-stand-s38,HLD-DSK-PYRAMID-S38-20P,Mobile Accessories,Mobile Stands & Docks,129,13,13,"[{""min_qty"": 1, ""unit_price"": 13.0}, {""min_qty"": 60, ""unit_price"": 11.0}, {""min_qty"": 300, ""unit_price"": 9.0}]",0,Generic / Fresh Pyramid,Universal Mobile Phones,"Stable. Stylish. Stackable",https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/product-images/catalog/2026/10/d0eeb02a.webp,https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/product-images/catalog/2026/10/d0eeb02a.webp,"Detailed pyramid description",2000,1,1,"{""model"": ""Series 38""}","fresh pyramid, mobile stand",False,True,True,True`;

  const parsed = Papa.parse<string[]>(CSV_FIXTURE_MOBILE_ACCESSORIES, { skipEmptyLines: "greedy", header: false });
  const result = parseSpreadsheetRowsWithReport(parsed.data);
  const rows = result.rows;

  it("parses mrp_inr into mrp accurately", () => {
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.mrp).toBe(129);
    expect(row.price).toBe(13);
  });

  it("parses volume_price_tiers_json into 3 volume tiers", () => {
    const row = rows[0]!;
    expect(row.tiers).toHaveLength(3);
    expect(row.tiers[0]).toEqual({ min_qty: 1, unit_price: 13 });
    expect(row.tiers[1]).toEqual({ min_qty: 60, unit_price: 11 });
    expect(row.tiers[2]).toEqual({ min_qty: 300, unit_price: 9 });
  });

  it("parses boolean flags flag_featured, flag_trending, flag_active, flag_urbanrat_brand", () => {
    const row = rows[0]!;
    expect(row.isUrbanrat).toBe(false);
    expect(row.isFeatured).toBe(true);
    expect(row.isTrending).toBe(true);
    expect(row.isActive).toBe(true);
  });

  it("deduplicates primary_image_url and product_images into unique images", () => {
    const row = rows[0]!;
    expect(row.images).toHaveLength(1);
    expect(row.images[0]).toContain("product-images/catalog");
  });
});

describe("Bulk CSV Catalog Parser — Selective Color Configuration", () => {
  const CSV_WITH_COLORS = `product_name,url_slug,product_sku,base_wholesale_price,initial_stock,colors,has_colors
"boAt Buds X Prime",boat-buds-x-prime,BOAT-BUDS-X-PRIME,245,100,"Jet Black, Forest Emerald, Crimson Ruby",true
"Tempered Glass Clear",tempered-glass-clear,TG-CLEAR-01,15,500,"",false
"iPhone 16 Pro Case",iphone-16-pro-case,CASE-IP16P,99,200,"Natural Titanium, Desert Titanium, White Titanium, Black Titanium",
"Plain Cable",plain-cable,CBL-01,40,150,"Black, White",disabled`;

  const parsed = Papa.parse<string[]>(CSV_WITH_COLORS, { skipEmptyLines: "greedy", header: false });
  const result = parseSpreadsheetRowsWithReport(parsed.data);
  const rows = result.rows;

  it("parses 4 products with selective colors", () => {
    expect(rows).toHaveLength(4);
  });

  it("parses boAt Buds with 3 colors enabled (has_colors=true)", () => {
    const row = rows[0]!;
    expect(row.hasColors).toBe(true);
    expect(row.colors).toEqual(["Jet Black", "Forest Emerald", "Crimson Ruby"]);
    expect(row.specs?.colors).toEqual(["Jet Black", "Forest Emerald", "Crimson Ruby"]);
    expect(row.specs?.has_colors).toBe(true);
  });

  it("parses Tempered Glass with colors disabled (has_colors=false, empty colors)", () => {
    const row = rows[1]!;
    expect(row.hasColors).toBe(false);
    expect(row.colors).toEqual([]);
    expect(row.specs?.has_colors).toBe(false);
  });

  it("auto-enables colors when colors provided and has_colors column is omitted", () => {
    const row = rows[2]!;
    expect(row.hasColors).toBe(true);
    expect(row.colors).toHaveLength(4);
    expect(row.colors).toContain("Natural Titanium");
  });

  it("disables colors when explicitly disabled even if colors string was present", () => {
    const row = rows[3]!;
    expect(row.hasColors).toBe(false);
    expect(row.colors).toEqual([]);
    expect(row.specs?.has_colors).toBe(false);
  });
});
