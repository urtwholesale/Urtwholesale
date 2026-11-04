import { describe, it, expect } from "vitest";
import { TRANSLATIONS } from "./translations";

describe("Hindi & English Translations Dictionary", () => {
  it("has both en and hi translation dictionaries configured", () => {
    expect(TRANSLATIONS).toHaveProperty("en");
    expect(TRANSLATIONS).toHaveProperty("hi");
  });

  it("contains essential navigation keys in both languages", () => {
    const essentialKeys = [
      "nav.home",
      "nav.marketplace",
      "nav.urbanrat",
      "nav.categories",
      "nav.account",
      "nav.cart",
      "nav.orders",
      "nav.dealership",
      "nav.search_placeholder",
    ];

    essentialKeys.forEach((key) => {
      expect(TRANSLATIONS.en[key]).toBeDefined();
      expect(TRANSLATIONS.hi[key]).toBeDefined();
      expect(TRANSLATIONS.en[key]!.length).toBeGreaterThan(0);
      expect(TRANSLATIONS.hi[key]!.length).toBeGreaterThan(0);
    });
  });

  it("contains essential home and wholesale value keys in Hindi", () => {
    expect(TRANSLATIONS.hi["home.all_categories"]).toBe("सभी श्रेणियां");
    expect(TRANSLATIONS.hi["marquee.factory_direct"]).toBe("फैक्ट्री से सीधा थोक भाव");
    expect(TRANSLATIONS.hi["footer.quality_inspected"]).toBe("100% गुणवत्ता परीक्षण पास");
    expect(TRANSLATIONS.hi["dealership.normal_customer"]).toBe("सामान्य ग्राहक");
    expect(TRANSLATIONS.hi["dealership.urt_dealer"]).toBe("URT अधिकृत डीलर");
  });

  it("ensures every English key has a corresponding Hindi translation", () => {
    const enKeys = Object.keys(TRANSLATIONS.en);
    const hiKeys = new Set(Object.keys(TRANSLATIONS.hi));

    const missingInHindi = enKeys.filter((k) => !hiKeys.has(k));
    expect(missingInHindi).toEqual([]);
  });
});

