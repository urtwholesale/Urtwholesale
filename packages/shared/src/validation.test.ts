import { describe, it, expect } from "vitest";
import {
  isValidGSTIN,
  cleanIndianMobile,
  isValidIndianMobile,
  formatIndianMobile,
  isValidPincode,
  cleanPincode,
} from "./validation";

describe("GSTIN Validation", () => {
  it("accepts valid GSTINs", () => {
    expect(isValidGSTIN("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGSTIN("29ABCDE1234F2Z5")).toBe(true);
    expect(isValidGSTIN("07AAAAA0000A1Z5")).toBe(true);
    // Lowercase should be auto-uppercased in validation check
    expect(isValidGSTIN("27aapfu0939f1zv")).toBe(true);
  });

  it("rejects invalid GSTINs", () => {
    expect(isValidGSTIN("")).toBe(false);
    expect(isValidGSTIN("123")).toBe(false);
    expect(isValidGSTIN("27AAPFU0939F1Z")).toBe(false); // 14 chars
    expect(isValidGSTIN("27AAPFU0939F1ZVV")).toBe(false); // 16 chars
    expect(isValidGSTIN("Z7AAPFU0939F1ZV")).toBe(false); // non-numeric state code
    expect(isValidGSTIN("27AAPFU0939F0ZV")).toBe(false); // entity number is 0
  });
});

describe("Indian Mobile Validation and Cleaning", () => {
  it("cleans different formats properly", () => {
    expect(cleanIndianMobile("9876543210")).toBe("9876543210");
    expect(cleanIndianMobile("+91 98765 43210")).toBe("9876543210");
    expect(cleanIndianMobile("919876543210")).toBe("9876543210");
    expect(cleanIndianMobile("09876543210")).toBe("9876543210");
    expect(cleanIndianMobile("98765-43210")).toBe("9876543210");
  });

  it("validates mobile numbers correctly", () => {
    expect(isValidIndianMobile("9876543210")).toBe(true);
    expect(isValidIndianMobile("8876543210")).toBe(true);
    expect(isValidIndianMobile("7876543210")).toBe(true);
    expect(isValidIndianMobile("6876543210")).toBe(true);
    expect(isValidIndianMobile("+919876543210")).toBe(true);

    // Invalid numbers
    expect(isValidIndianMobile("5876543210")).toBe(false); // starts with 5
    expect(isValidIndianMobile("1234567890")).toBe(false); // starts with 1
    expect(isValidIndianMobile("987654321")).toBe(false); // 9 digits
    expect(isValidIndianMobile("98765432100")).toBe(false); // 11 digits
    expect(isValidIndianMobile("")).toBe(false);
  });

  it("formats mobile numbers consistently", () => {
    expect(formatIndianMobile("9876543210")).toBe("+919876543210");
    expect(formatIndianMobile("9876543210", true)).toBe("+91 98765 43210");
  });
});

describe("Pincode Validation and Cleaning", () => {
  it("accepts valid 6-digit Indian PIN codes", () => {
    expect(isValidPincode("400001")).toBe(true);
    expect(isValidPincode("110001")).toBe(true);
    expect(isValidPincode("560001")).toBe(true);
    expect(isValidPincode(" 400001 ")).toBe(true);
  });

  it("rejects invalid pincodes", () => {
    expect(isValidPincode("012345")).toBe(false); // cannot start with 0
    expect(isValidPincode("40000")).toBe(false); // 5 digits
    expect(isValidPincode("4000011")).toBe(false); // 7 digits
    expect(isValidPincode("40000A")).toBe(false);
    expect(isValidPincode("")).toBe(false);
  });

  it("cleans pincode input properly", () => {
    expect(cleanPincode("400-001")).toBe("400001");
    expect(cleanPincode("400001999")).toBe("400001");
  });
});
