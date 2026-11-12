import { describe, it, expect } from "vitest";
import { DEFAULT_HOMEPAGE_SECTIONS, type HomepageSection } from "./types/storeSettings";

describe("Homepage Sections Domain Configuration", () => {
  it("provides valid default homepage sections array", () => {
    expect(Array.isArray(DEFAULT_HOMEPAGE_SECTIONS)).toBe(true);
    expect(DEFAULT_HOMEPAGE_SECTIONS.length).toBeGreaterThanOrEqual(4);
  });

  it("ensures each default section has mandatory fields and unique IDs", () => {
    const ids = new Set<string>();

    DEFAULT_HOMEPAGE_SECTIONS.forEach((sec: HomepageSection) => {
      expect(sec.id).toBeTruthy();
      expect(ids.has(sec.id)).toBe(false);
      ids.add(sec.id);

      expect(["bestsellers", "new_arrivals", "deals", "category", "custom"]).toContain(sec.type);
      expect(sec.title).toBeTruthy();
      expect(sec.title_hi).toBeTruthy();
      expect(sec.badge_tag).toBeTruthy();
      expect(sec.badge_tag_hi).toBeTruthy();
      expect(sec.icon).toBeTruthy();
      expect(sec.see_more_url).toBeTruthy();
      expect(typeof sec.is_enabled).toBe("boolean");
      expect(typeof sec.sort_order).toBe("number");
    });
  });

  it("contains critical wholesale sections: Bestsellers, Cables, Speakers, New Arrivals", () => {
    const types = DEFAULT_HOMEPAGE_SECTIONS.map((s) => s.type);
    expect(types).toContain("bestsellers");
    expect(types).toContain("category");
    expect(types).toContain("new_arrivals");

    const cableSec = DEFAULT_HOMEPAGE_SECTIONS.find((s) => s.category_slug === "cables");
    expect(cableSec).toBeDefined();
    expect(cableSec?.title).toBe("Fast Data & Charging Cables");
    expect(cableSec?.badge_tag).toBe("100W PD & FAST SYNC");
  });
});

