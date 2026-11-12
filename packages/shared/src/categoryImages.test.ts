import { describe, it, expect } from "vitest";
import {
  CATEGORY_IMAGE_MAP,
  getCategoryVisualPath,
  isCategorySlug,
} from "./categoryImages";

describe("Category Images & Visuals", () => {
  it("exports CATEGORY_IMAGE_MAP with default category image mappings", () => {
    expect(CATEGORY_IMAGE_MAP).toBeDefined();
    expect(CATEGORY_IMAGE_MAP["chargers"]).toBe("chargers.jpg");
  });

  it("resolves dark and light theme image paths for chargers", () => {
    expect(getCategoryVisualPath("chargers", "dark")).toBe("/categories/dark/chargers.jpg");
    expect(getCategoryVisualPath("chargers", "light")).toBe("/categories/light/chargers.jpg");
  });

  it("resolves multi-word category aliases", () => {
    expect(getCategoryVisualPath("mobile-chargers", "dark")).toBe("/categories/dark/chargers.jpg");
    expect(getCategoryVisualPath("cables-cords", "light")).toBe("/categories/light/cables.jpg");
    expect(getCategoryVisualPath("tempered-glass-uv-glass", "dark")).toBe("/categories/dark/tempered-glass.jpg");
    expect(getCategoryVisualPath("all-products", "light")).toBe("/categories/light/all-products.jpg");
  });

  it("falls back gracefully for unknown categories", () => {
    expect(getCategoryVisualPath("custom-accessory", "dark")).toBe("/categories/dark/custom-accessory.jpg");
  });

  it("checks category slug validity correctly", () => {
    expect(isCategorySlug("chargers")).toBe(true);
    expect(isCategorySlug("watches")).toBe(true);
    expect(isCategorySlug("unknown-non-existent-123")).toBe(false);
  });
});

