import { describe, it, expect } from "vitest";
import {
  getProductColors,
  isColorSelectionEnabled,
  cleanColorArray,
  parseColorString,
  getColorHex,
} from "./colors";

describe("colors shared helper", () => {
  it("extracts colors from specs.colors array", () => {
    const prod = {
      specs: {
        colors: ["Black", "Silver", "Gold"],
      },
    };
    expect(getProductColors(prod)).toEqual(["Black", "Silver", "Gold"]);
    expect(isColorSelectionEnabled(prod)).toBe(true);
  });

  it("extracts colors from attributes.colors array or string", () => {
    const prod = {
      attributes: {
        colors: ["Mint Green", "Magenta Pink"],
      },
    };
    expect(getProductColors(prod)).toEqual(["Mint Green", "Magenta Pink"]);

    const prodString = {
      attributes: {
        colors: "Navy Blue, Titanium, White",
      },
    };
    expect(getProductColors(prodString)).toEqual(["Navy Blue", "Titanium", "White"]);
  });

  it("extracts colors from specs.colorways fallback", () => {
    const prod = {
      specs: {
        colorways: "Jet Black, Forest Emerald, Crimson Ruby",
      },
    };
    expect(getProductColors(prod)).toEqual(["Jet Black", "Forest Emerald", "Crimson Ruby"]);
    expect(isColorSelectionEnabled(prod)).toBe(true);
  });

  it("returns empty array and disabled when has_colors is explicitly false", () => {
    const prod = {
      specs: {
        colors: ["Black", "Silver"],
        has_colors: false,
      },
    };
    expect(getProductColors(prod)).toEqual([]);
    expect(isColorSelectionEnabled(prod)).toBe(false);

    const prodAttr = {
      attributes: {
        colors: ["Black", "Silver"],
        has_colors: false,
      },
    };
    expect(getProductColors(prodAttr)).toEqual([]);
    expect(isColorSelectionEnabled(prodAttr)).toBe(false);
  });

  it("returns empty array when product has no colors", () => {
    expect(getProductColors(null)).toEqual([]);
    expect(getProductColors({})).toEqual([]);
    expect(getProductColors({ specs: {} })).toEqual([]);
    expect(isColorSelectionEnabled({})).toBe(false);
  });

  it("deduplicates and cleans color arrays", () => {
    expect(cleanColorArray(["Red", " red ", "RED", "Blue", ""])).toEqual(["Red", "Blue"]);
  });

  it("parses delimited color strings", () => {
    expect(parseColorString("Black, White | Blue / Gold; Silver")).toEqual([
      "Black",
      "White",
      "Blue",
      "Gold",
      "Silver",
    ]);
  });

  it("resolves accurate color hexes for varied naming styles", () => {
    expect(getColorHex("Jet Black")).toBe("#18181b");
    expect(getColorHex("Pure White")).toBe("#ffffff");
    expect(getColorHex("Forest Emerald")).toBe("#10b981");
    expect(getColorHex("Mint Green")).toBe("#6ee7b7");
    expect(getColorHex("Crimson Ruby")).toBe("#be123c");
    expect(getColorHex("Navy Blue")).toBe("#1e3a8a");
    expect(getColorHex("Titanium")).toBe("#71717a");
    expect(getColorHex("Rainbow")).toContain("linear-gradient");
  });
});

