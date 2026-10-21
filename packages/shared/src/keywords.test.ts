import { describe, it, expect } from "vitest";
import { normalizeKeywords } from "./keywords";

describe("normalizeKeywords", () => {
  describe("empty and invalid inputs", () => {
    it("returns empty array for undefined or null", () => {
      expect(normalizeKeywords(undefined)).toEqual([]);
      expect(normalizeKeywords(null)).toEqual([]);
    });

    it("returns empty array for empty or whitespace-only string", () => {
      expect(normalizeKeywords("")).toEqual([]);
      expect(normalizeKeywords("   ")).toEqual([]);
      expect(normalizeKeywords("\n \t  \r\n")).toEqual([]);
    });

    it("returns empty array for empty array or array of empty strings", () => {
      expect(normalizeKeywords([])).toEqual([]);
      expect(normalizeKeywords(["", "   ", "\t\n"])).toEqual([]);
    });
  });

  describe("casing and whitespace normalization", () => {
    it("converts uppercase and mixed-case to lowercase", () => {
      expect(normalizeKeywords("IPHONE, Samsung, GoOgLe PiXeL")).toEqual([
        "iphone",
        "samsung",
        "google pixel",
      ]);
    });

    it("trims outer whitespace and collapses multiple inner whitespace to single space", () => {
      expect(
        normalizeKeywords("  super    fast   charging   adapter  ,  type   c  ")
      ).toEqual(["super fast charging adapter", "type c"]);
    });
  });

  describe("separator handling", () => {
    it("splits by comma", () => {
      expect(normalizeKeywords("phone,case,cover")).toEqual([
        "phone",
        "case",
        "cover",
      ]);
    });

    it("splits by semicolon", () => {
      expect(normalizeKeywords("wired;wireless;bluetooth")).toEqual([
        "wired",
        "wireless",
        "bluetooth",
      ]);
    });

    it("splits by pipe", () => {
      expect(normalizeKeywords("4k | oled | 120hz")).toEqual([
        "4k",
        "oled",
        "120hz",
      ]);
    });

    it("splits by newlines (\\n, \\r\\n)", () => {
      expect(normalizeKeywords("earbuds\nheadphones\r\nheadset")).toEqual([
        "earbuds",
        "headphones",
        "headset",
      ]);
    });

    it("handles mixed separators in single string", () => {
      expect(
        normalizeKeywords("smart watch, wearable; fitness band | oled\nwaterproof\r\ngps")
      ).toEqual([
        "smart watch",
        "wearable",
        "fitness band",
        "oled",
        "waterproof",
        "gps",
      ]);
    });

    it("handles array of strings with mixed separators", () => {
      expect(
        normalizeKeywords(["smart watch, wearable", "fitness; band | oled\nwaterproof"])
      ).toEqual([
        "smart watch",
        "wearable",
        "fitness",
        "band",
        "oled",
        "waterproof",
      ]);
    });
  });

  describe("duplicate removal", () => {
    it("removes duplicate keywords case-insensitively and preserves first seen order", () => {
      expect(
        normalizeKeywords("apple, Apple, APPLE,   apple  , banana, Banana, apple")
      ).toEqual(["apple", "banana"]);
    });

    it("preserves original appearance order across distinct items", () => {
      expect(normalizeKeywords("charlie, alpha, beta, alpha, charlie, delta")).toEqual([
        "charlie",
        "alpha",
        "beta",
        "delta",
      ]);
    });
  });

  describe("limits", () => {
    it("enforces max 50 characters per keyword", () => {
      const longKeyword = "a".repeat(80);
      const result = normalizeKeywords(longKeyword);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(50);
      expect(result[0]).toBe("a".repeat(50));
    });

    it("enforces max 30 keywords per product", () => {
      // 40 unique keywords
      const input = Array.from({ length: 40 }, (_, i) => `kw-${i}`).join(", ");
      const result = normalizeKeywords(input);
      expect(result).toHaveLength(30);
      expect(result[0]).toBe("kw-0");
      expect(result[29]).toBe("kw-29");
    });
  });
});
