import { describe, it, expect } from "vitest";
import {
  getProductHighlightSpec,
  getProductTopBadge,
  resolveColorHex,
} from "./productSpecs";
import type { Product } from "./types/product";

describe("boAt-style Product Highlight Specs & Badges", () => {
  const baseProduct: Product = {
    id: "prod-1",
    name: "Urbanrat 100W PD Type-C Cable",
    slug: "100w-pd-cable",
    description: "Fast charging ballistic cord",
    price: 199,
    mrp: 599,
    sku: "URT-100W",
    stock: 500,
    in_stock: true,
    images: ["/hero.jpg"],
    category_id: "cables",
    is_urbanrat_brand: true,
    is_active: true,
    is_featured: false,
    created_at: new Date().toISOString(),
  };

  it("extracts 100W PD spec highlight from cable product", () => {
    expect(getProductHighlightSpec(baseProduct)).toBe("100W PD Fast");
  });

  it("extracts playback spec for TWS and buds", () => {
    const tws: Product = {
      ...baseProduct,
      name: "AirBass Pro Wireless TWS Earbuds",
    };
    expect(getProductHighlightSpec(tws)).toBe("40 Hours Playback");
  });

  it("extracts GaN specs for 65W chargers", () => {
    const charger: Product = {
      ...baseProduct,
      name: "65W GaN Dual Port Charger",
    };
    expect(getProductHighlightSpec(charger)).toBe("65W GaN Fast");
  });

  it("extracts diamond hardness for tempered glass", () => {
    const glass: Product = {
      ...baseProduct,
      name: "9D Tempered Glass Protector",
    };
    expect(getProductHighlightSpec(glass)).toBe("9H Diamond Hardness");
  });

  it("resolves top badge prioritizing featured or brand", () => {
    const featured: Product = { ...baseProduct, is_featured: true };
    expect(getProductTopBadge(featured, 60).text).toBe("Best Seller");

    const brandOnly: Product = { ...baseProduct, is_featured: false, is_urbanrat_brand: true };
    expect(getProductTopBadge(brandOnly, 20).text).toBe("URT Original");
  });

  it("resolves known color hex codes", () => {
    expect(resolveColorHex("Black")).toBe("#18181b");
    expect(resolveColorHex("blue")).toBe("#2563eb");
    expect(resolveColorHex("green")).toBe("#10b981");
  });
});

