import { describe, it, expect } from "vitest";
import {
  parseSkuFromFilename,
  parseImageIndex,
  sanitizeFileName,
  validateCatalogImageUrl,
  IMAGE_EXTENSIONS,
} from "./catalogImages";

describe("parseSkuFromFilename", () => {
  it("extracts SKU and index from filename with _N suffix", () => {
    expect(parseSkuFromFilename("CHG-001_1.jpg")).toEqual({
      sku: "CHG-001",
      index: 1,
    });
    expect(parseSkuFromFilename("CHG-001_2.webp")).toEqual({
      sku: "CHG-001",
      index: 2,
    });
    expect(parseSkuFromFilename("URT-CABLE-5M_3.png")).toEqual({
      sku: "URT-CABLE-5M",
      index: 3,
    });
    expect(parseSkuFromFilename("ABC-123_99.gif")).toEqual({
      sku: "ABC-123",
      index: 99,
    });
  });

  it("extracts SKU and index from filename with -N suffix", () => {
    expect(parseSkuFromFilename("CHG-001-1.jpg")).toEqual({
      sku: "CHG-001",
      index: 1,
    });
    expect(parseSkuFromFilename("URT-PRO-5.png")).toEqual({
      sku: "URT-PRO",
      index: 5,
    });
  });

  it("extracts SKU and index from filename with ' (N)' suffix", () => {
    expect(parseSkuFromFilename("CHG-001 (1).jpg")).toEqual({
      sku: "CHG-001",
      index: 1,
    });
    expect(parseSkuFromFilename("URT-HEADSET (2).webp")).toEqual({
      sku: "URT-HEADSET",
      index: 2,
    });
  });

  it("returns null sku and null index when no index pattern is present", () => {
    expect(parseSkuFromFilename("random-photo.jpg")).toEqual({
      sku: null,
      index: null,
    });
    expect(parseSkuFromFilename("hero-banner.webp")).toEqual({
      sku: null,
      index: null,
    });
  });

  it("handles directory paths", () => {
    expect(parseSkuFromFilename("uploads/batch-1/CHG-001_1.jpg")).toEqual({
      sku: "CHG-001",
      index: 1,
    });
    expect(parseSkuFromFilename("C:\\images\\URT-X-2.png")).toEqual({
      sku: "URT-X",
      index: 2,
    });
  });

  it("returns null sku and null index for empty / whitespace input", () => {
    expect(parseSkuFromFilename("")).toEqual({ sku: null, index: null });
    expect(parseSkuFromFilename("   ")).toEqual({ sku: null, index: null });
  });

  it("handles filename with no extension", () => {
    expect(parseSkuFromFilename("SKU-100_1")).toEqual({
      sku: "SKU-100",
      index: 1,
    });
    expect(parseSkuFromFilename("plain-name")).toEqual({
      sku: null,
      index: null,
    });
  });
});

describe("sanitizeFileName", () => {
  it("converts to lowercase and replaces spaces with hyphens", () => {
    expect(sanitizeFileName("My Product Photo.jpg")).toBe(
      "my-product-photo.jpg"
    );
  });

  it("strips parentheses and brackets", () => {
    expect(sanitizeFileName("CHG-001 (1).JPG")).toBe("chg-001-1.jpg");
    expect(sanitizeFileName("Item [2].PNG")).toBe("item-2.png");
  });

  it("strips unsafe characters while preserving underscores, hyphens, and extension", () => {
    expect(sanitizeFileName("Product #1 @ 50%.webp")).toBe("product-1-50.webp");
    expect(sanitizeFileName("CHG-001_1.jpg")).toBe("chg-001_1.jpg");
  });

  it("handles path prefixes by extracting the basename", () => {
    expect(sanitizeFileName("uploads/batch1/My File (1).png")).toBe(
      "my-file-1.png"
    );
    expect(sanitizeFileName("C:\\temp\\Item Photo.webp")).toBe(
      "item-photo.webp"
    );
  });

  it("provides fallback for empty input", () => {
    expect(sanitizeFileName("")).toBe("unnamed-file");
    expect(sanitizeFileName("   ")).toBe("unnamed-file");
  });
});

describe("parseImageIndex", () => {
  it("extracts the numeric index from _N, -N, or (N)", () => {
    expect(parseImageIndex("CHG-001_1.jpg")).toBe(1);
    expect(parseImageIndex("CHG-001-5.webp")).toBe(5);
    expect(parseImageIndex("X (99).png")).toBe(99);
  });

  it("returns 0 when no suffix is present", () => {
    expect(parseImageIndex("photo.jpg")).toBe(0);
    expect(parseImageIndex("hero.webp")).toBe(0);
  });

  it("returns 0 for empty input", () => {
    expect(parseImageIndex("")).toBe(0);
  });
});

describe("validateCatalogImageUrl", () => {
  it("accepts valid HTTPS URLs with image extensions", () => {
    const result = validateCatalogImageUrl("https://cdn.example.com/img.jpg");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.isCatalogBucketUrl).toBe(false);
  });

  it("accepts all recognised image extensions", () => {
    for (const ext of IMAGE_EXTENSIONS) {
      const result = validateCatalogImageUrl(`https://cdn.example.com/file.${ext}`);
      expect(result.valid).toBe(true);
    }
  });

  it("rejects empty strings", () => {
    const result = validateCatalogImageUrl("");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("empty");
  });

  it("rejects non-https URLs", () => {
    const result = validateCatalogImageUrl("ftp://example.com/img.jpg");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("https");
  });

  it("rejects URLs without image extensions (non-bucket)", () => {
    const result = validateCatalogImageUrl("https://example.com/document.pdf");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("extension");
  });

  it("rejects completely invalid URLs", () => {
    const result = validateCatalogImageUrl("not-a-url");
    expect(result.valid).toBe(false);
  });

  it("accepts catalog-images bucket URLs without extension check", () => {
    const url =
      "https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/catalog-images/img123";
    const result = validateCatalogImageUrl(url);
    expect(result.valid).toBe(true);
    expect(result.isCatalogBucketUrl).toBe(true);
  });

  it("accepts catalog-images bucket URLs matched via supabaseUrl param", () => {
    const supabaseUrl = "https://mmuuqzgclrdhcvrcavgi.supabase.co";
    const url = `${supabaseUrl}/storage/v1/object/public/catalog-images/my-photo.webp`;
    const result = validateCatalogImageUrl(url, supabaseUrl);
    expect(result.valid).toBe(true);
    expect(result.isCatalogBucketUrl).toBe(true);
  });

  it("correctly identifies non-catalog bucket Supabase URLs", () => {
    const url =
      "https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/product-images/prod_123.webp";
    const result = validateCatalogImageUrl(url);
    // It's a Supabase URL but NOT catalog-images bucket, so extension check applies
    expect(result.valid).toBe(true); // .webp is a valid extension
    expect(result.isCatalogBucketUrl).toBe(false);
  });

  it("rejects non-catalog bucket Supabase URL without image extension", () => {
    const url =
      "https://mmuuqzgclrdhcvrcavgi.supabase.co/storage/v1/object/public/product-images/noext";
    const result = validateCatalogImageUrl(url);
    expect(result.valid).toBe(false);
    expect(result.isCatalogBucketUrl).toBe(false);
  });

  it("trims whitespace from URL before validating", () => {
    const result = validateCatalogImageUrl("  https://cdn.example.com/img.png  ");
    expect(result.valid).toBe(true);
  });

  it("accepts HTTP URLs only for localhost/dev environments", () => {
    expect(validateCatalogImageUrl("http://localhost:3000/test.jpg").valid).toBe(true);
    expect(validateCatalogImageUrl("http://127.0.0.1:8080/test.webp").valid).toBe(true);
    // Non-localhost HTTP must fail
    const nonLocalHttp = validateCatalogImageUrl("http://example.com/test.jpg");
    expect(nonLocalHttp.valid).toBe(false);
    expect(nonLocalHttp.errors[0]).toContain("https");
  });

  it("accepts image URLs with query parameters", () => {
    const result = validateCatalogImageUrl("https://cdn.example.com/photo.jpg?w=800&q=80");
    expect(result.valid).toBe(true);
  });

  it("accepts image URLs with uppercase extensions", () => {
    expect(validateCatalogImageUrl("https://cdn.example.com/photo.JPG").valid).toBe(true);
    expect(validateCatalogImageUrl("https://cdn.example.com/photo.PNG").valid).toBe(true);
    expect(validateCatalogImageUrl("https://cdn.example.com/photo.WEBP").valid).toBe(true);
  });

  it("accepts image URLs with hash anchors", () => {
    const result = validateCatalogImageUrl("https://cdn.example.com/photo.png#main");
    expect(result.valid).toBe(true);
  });

  it("rejects non-image URLs with query params disguised as images", () => {
    const result = validateCatalogImageUrl("https://example.com/page?img=pic.jpg");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("extension");
  });

  it("rejects javascript: and data: schemes", () => {
    expect(validateCatalogImageUrl("javascript:alert(1)").valid).toBe(false);
    expect(validateCatalogImageUrl("data:image/png;base64,iVBORw0KGgo=").valid).toBe(false);
  });
});

