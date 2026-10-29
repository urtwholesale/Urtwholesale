import { describe, it, expect } from "vitest";
import {
  normalizeSearchQuery,
  tokenizeQuery,
  generateSearchVariants,
  highlightSearchMatch,
  COMMON_TYPO_CORRECTIONS,
} from "./search";

describe("Shared Search Logic — normalizeSearchQuery", () => {
  it("1. handles lowercase, trims, and collapses extra whitespace", () => {
    expect(normalizeSearchQuery("  Infinix   Hot  10i  ")).toBe("infinix hot 10i");
  });

  it("2. strips commas and parentheses to keep PostgREST .or() filters safe", () => {
    const raw = "Nothing Phone (4a), Case (Black), Glass";
    const res = normalizeSearchQuery(raw);
    expect(res).not.toContain(",");
    expect(res).not.toContain("(");
    expect(res).not.toContain(")");
    expect(res).toBe("nothing phone 4a case black glass");
  });

  it("3. handles slashes in compound model names like 'iPhone 17 Pro / 17 Pro Max'", () => {
    expect(normalizeSearchQuery("iPhone 17 Pro / 17 Pro Max")).toBe("iphone 17 pro 17 pro max");
  });

  it("4. handles plus signs like 'AR+AF Lens Ring' and 'G86 Power+'", () => {
    expect(normalizeSearchQuery("AR+AF Lens Ring")).toBe("ar+af lens ring");
    expect(normalizeSearchQuery("Edge 70 Pro+")).toBe("edge 70 pro+");
    expect(normalizeSearchQuery("Fast + Strong")).toBe("fast strong");
  });

  it("5. removes accents and diacritics", () => {
    expect(normalizeSearchQuery("café récréation")).toBe("cafe recreation");
  });

  it("6. returns empty string for empty, null, or undefined input", () => {
    expect(normalizeSearchQuery("")).toBe("");
    expect(normalizeSearchQuery("   ")).toBe("");
    expect(normalizeSearchQuery(null as any)).toBe("");
    expect(normalizeSearchQuery(undefined as any)).toBe("");
  });

  it("7. strips quotes and special symbols", () => {
    expect(normalizeSearchQuery('"Super-X" 9D Glass!')).toBe("super-x 9d glass");
  });
});

describe("Shared Search Logic — tokenizeQuery", () => {
  it("8. splits basic queries into distinct tokens", () => {
    const tokens = tokenizeQuery("apple iphone 16 pro");
    expect(tokens).toEqual(["apple", "iphone", "16", "pro"]);
  });

  it("9. extracts concatenated model numbers like 'iphone17' into ['iphone', '17']", () => {
    const tokens = tokenizeQuery("iphone17");
    expect(tokens).toContain("iphone17");
    expect(tokens).toContain("iphone");
    expect(tokens).toContain("17");
  });

  it("10. extracts measurement tokens like '3.5mm' into ['3.5', 'mm']", () => {
    const tokens = tokenizeQuery("3.5mm jack earphone");
    expect(tokens).toContain("3.5mm");
    expect(tokens).toContain("3.5");
    expect(tokens).toContain("mm");
    expect(tokens).toContain("jack");
    expect(tokens).toContain("earphone");
  });

  it("11. extracts wattage tokens like '65w' into ['65', 'w']", () => {
    const tokens = tokenizeQuery("65w fast charger");
    expect(tokens).toContain("65w");
    expect(tokens).toContain("65");
    expect(tokens).toContain("w");
  });

  it("12. deduplicates repeated tokens in a query", () => {
    const tokens = tokenizeQuery("case case cover cover");
    expect(tokens).toEqual(["case", "cover"]);
  });

  it("13. handles complex slash-separated catalog titles", () => {
    const tokens = tokenizeQuery("infinix gt 30/ 30 pro");
    expect(tokens).toContain("infinix");
    expect(tokens).toContain("gt");
    expect(tokens).toContain("30");
    expect(tokens).toContain("pro");
  });
});

describe("Shared Search Logic — generateSearchVariants", () => {
  it("14. corrects common typo 'chargr' to 'charger'", () => {
    const variants = generateSearchVariants("chargr");
    expect(variants).toContain("charger");
  });

  it("15. corrects common typo 'tempred glass' to 'tempered glass'", () => {
    const variants = generateSearchVariants("tempred glass");
    expect(variants).toContain("tempered glass");
  });

  it("16. corrects common typo 'earfone' to 'earphone'", () => {
    const variants = generateSearchVariants("earfone");
    expect(variants).toContain("earphone");
  });

  it("17. corrects common typo 'type c cabel' to 'type c cable'", () => {
    const variants = generateSearchVariants("type c cabel");
    expect(variants.some((v) => v.includes("cable"))).toBe(true);
  });

  it("18. generates variants for 'type c' including 'type-c' and 'typec'", () => {
    const variants = generateSearchVariants("type c cable");
    expect(variants).toContain("type-c cable");
    expect(variants).toContain("typec cable");
    expect(variants).toContain("usb c cable");
  });

  it("19. generates variants for 'iphone17' including 'iphone 17'", () => {
    const variants = generateSearchVariants("iphone17");
    expect(variants).toContain("iphone 17");
  });

  it("20. generates variants for 'iphone 17' including 'iphone17'", () => {
    const variants = generateSearchVariants("iphone 17");
    expect(variants).toContain("iphone17");
  });

  it("21. handles '3.5mm' vs '3.5 mm'", () => {
    const variants1 = generateSearchVariants("3.5mm");
    expect(variants1).toContain("3.5 mm");

    const variants2 = generateSearchVariants("3.5 mm");
    expect(variants2).toContain("3.5mm");
  });

  it("22. handles 'ar af' vs 'ar+af'", () => {
    const variants = generateSearchVariants("ar af lens ring");
    expect(variants).toContain("ar+af lens ring");
  });

  it("23. handles 'power bank' vs 'powerbank'", () => {
    const variants1 = generateSearchVariants("power bank");
    expect(variants1).toContain("powerbank");

    const variants2 = generateSearchVariants("powerbank");
    expect(variants2).toContain("power bank");
  });

  it("24. handles 'neck band' vs 'neckband'", () => {
    const variants = generateSearchVariants("neck band");
    expect(variants).toContain("neckband");
  });

  it("25. expands synonyms: 'adapter' expands to 'charger'", () => {
    const variants = generateSearchVariants("adapter");
    expect(variants).toContain("charger");
  });

  it("26. expands synonyms: 'earbuds' expands to 'tws' and 'earphone'", () => {
    const variants = generateSearchVariants("earbuds");
    expect(variants.some((v) => v.includes("tws") || v.includes("earphone"))).toBe(true);
  });
});

describe("Shared Search Logic — highlightSearchMatch", () => {
  it("27. highlights matched words in search results", () => {
    const segments = highlightSearchMatch("boAt Buds X Prime Earbuds", "buds");
    const highlighted = segments.filter((s) => s.highlight).map((s) => s.text);
    expect(highlighted.some((h) => h.toLowerCase() === "buds")).toBe(true);
  });

  it("28. returns unhighlighted text if query is empty", () => {
    const segments = highlightSearchMatch("iPhone 17 Pro Max", "");
    expect(segments).toEqual([{ text: "iPhone 17 Pro Max", highlight: false }]);
  });

  it("29. correctly matches case-insensitively across multi-word queries", () => {
    const segments = highlightSearchMatch("Infinix Hot 10i Super X", "infinix 10i");
    const matches = segments.filter((s) => s.highlight).map((s) => s.text.toLowerCase());
    expect(matches).toContain("infinix");
    expect(matches).toContain("10i");
  });
});

describe("Shared Search Logic — Dictionary Completeness", () => {
  it("30. covers major vendor typos (infinex, samsng, relme, onplus)", () => {
    expect(COMMON_TYPO_CORRECTIONS["infinex"]).toBe("infinix");
    expect(COMMON_TYPO_CORRECTIONS["samsng"]).toBe("samsung");
    expect(COMMON_TYPO_CORRECTIONS["relme"]).toBe("realme");
    expect(COMMON_TYPO_CORRECTIONS["onplus"]).toBe("oneplus");
    expect(COMMON_TYPO_CORRECTIONS["iphne"]).toBe("iphone");
  });
});

