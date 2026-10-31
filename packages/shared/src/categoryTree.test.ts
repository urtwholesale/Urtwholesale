import { describe, it, expect } from "vitest";
import type { Category, CategoryProductCounts } from "./types/category";
import {
  buildCategoryTree,
  getCategoryPath,
  getCategoryBreadcrumbs,
  getCategoryAndDescendantIds,
  filterCategoriesByActiveProductCategoryIds,
} from "./categoryTree";

describe("categoryTree helpers", () => {
  const mockCategories4Levels: Category[] = [
    {
      id: "cat-l1",
      name: "Electronics",
      slug: "electronics",
      image_url: "https://example.com/l1.jpg",
      parent_id: null,
      sort_order: 1,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-l2",
      name: "Mobile Accessories",
      slug: "mobile-accessories",
      image_url: null,
      parent_id: "cat-l1",
      sort_order: 1,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-l3",
      name: "Tempered Glass",
      slug: "tempered-glass",
      image_url: null,
      parent_id: "cat-l2",
      sort_order: 1,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-l4",
      name: "UV Curved Glass",
      slug: "uv-curved-glass",
      image_url: null,
      parent_id: "cat-l3",
      sort_order: 1,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-l2-cables",
      name: "Cables & Cords",
      slug: "cables",
      image_url: null,
      parent_id: "cat-l1",
      sort_order: 2,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];

  const mockCounts: CategoryProductCounts[] = [
    {
      category_id: "cat-l1",
      direct_count: 5,
      total_count: 150,
      active_count: 140,
    },
    {
      category_id: "cat-l2",
      direct_count: 10,
      total_count: 100,
      active_count: 95,
    },
    {
      category_id: "cat-l3",
      direct_count: 20,
      total_count: 80,
      active_count: 75,
    },
    {
      category_id: "cat-l4",
      direct_count: 60,
      total_count: 60,
      active_count: 58,
    },
  ];

  it("builds a 4-level category tree with correct levels and counts", () => {
    const tree = buildCategoryTree(mockCategories4Levels, mockCounts);

    expect(tree).toHaveLength(1);
    const l1 = tree[0];
    expect(l1.id).toBe("cat-l1");
    expect(l1.level).toBe(1);
    expect(l1.total_count).toBe(150);
    expect(l1.direct_count).toBe(5);
    expect(l1.active_count).toBe(140);
    expect(l1.fullPath).toBe("Electronics");

    // L2
    expect(l1.children).toHaveLength(2);
    const l2 = l1.children.find((c) => c.id === "cat-l2")!;
    expect(l2).toBeDefined();
    expect(l2.level).toBe(2);
    expect(l2.total_count).toBe(100);
    expect(l2.fullPath).toBe("Electronics > Mobile Accessories");

    // L3
    expect(l2.children).toHaveLength(1);
    const l3 = l2.children[0];
    expect(l3.id).toBe("cat-l3");
    expect(l3.level).toBe(3);
    expect(l3.total_count).toBe(80);
    expect(l3.fullPath).toBe("Electronics > Mobile Accessories > Tempered Glass");

    // L4
    expect(l3.children).toHaveLength(1);
    const l4 = l3.children[0];
    expect(l4.id).toBe("cat-l4");
    expect(l4.level).toBe(4);
    expect(l4.total_count).toBe(60);
    expect(l4.fullPath).toBe("Electronics > Mobile Accessories > Tempered Glass > UV Curved Glass");
  });

  it("handles orphan categories whose parent_id does not exist by treating them as roots", () => {
    const categoriesWithOrphan: Category[] = [
      ...mockCategories4Levels,
      {
        id: "cat-orphan",
        name: "Discontinued Line",
        slug: "discontinued",
        image_url: null,
        parent_id: "missing-parent-uuid-999",
        sort_order: 5,
        is_active: false,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const tree = buildCategoryTree(categoriesWithOrphan, mockCounts);

    // Both "Electronics" and the orphan "Discontinued Line" should be at root level
    expect(tree).toHaveLength(2);
    const orphan = tree.find((c) => c.id === "cat-orphan");
    expect(orphan).toBeDefined();
    expect(orphan?.level).toBe(1);
    expect(orphan?.fullPath).toBe("Discontinued Line");
  });

  it("handles missing count statistics gracefully by defaulting to 0", () => {
    // Provide no counts at all
    const tree = buildCategoryTree(mockCategories4Levels);
    expect(tree).toHaveLength(1);

    const l1 = tree[0];
    expect(l1.direct_count).toBe(0);
    expect(l1.total_count).toBe(0);
    expect(l1.active_count).toBe(0);

    const l2Cables = l1.children.find((c) => c.id === "cat-l2-cables")!;
    expect(l2Cables.direct_count).toBe(0);
    expect(l2Cables.total_count).toBe(0);
  });

  it("getCategoryPath produces breadcrumb strings across all levels", () => {
    const tree = buildCategoryTree(mockCategories4Levels, mockCounts);

    expect(getCategoryPath(tree, "cat-l1")).toBe("Electronics");
    expect(getCategoryPath(tree, "cat-l2")).toBe("Electronics > Mobile Accessories");
    expect(getCategoryPath(tree, "cat-l3")).toBe(
      "Electronics > Mobile Accessories > Tempered Glass"
    );
    expect(getCategoryPath(tree, "cat-l4")).toBe(
      "Electronics > Mobile Accessories > Tempered Glass > UV Curved Glass"
    );
    expect(getCategoryPath(tree, "non-existent-cat")).toBe("");
    expect(getCategoryPath(tree, null)).toBe("");
    expect(getCategoryPath(tree, undefined)).toBe("");
  });

  it("getCategoryBreadcrumbs returns node array for interactive clickable breadcrumbs", () => {
    const tree = buildCategoryTree(mockCategories4Levels, mockCounts);
    const crumbs = getCategoryBreadcrumbs(tree, "cat-l4");

    expect(crumbs).toHaveLength(4);
    expect(crumbs.map((c) => c.name)).toEqual([
      "Electronics",
      "Mobile Accessories",
      "Tempered Glass",
      "UV Curved Glass",
    ]);
  });

  it("rolls up child product counts into parent and root categories (e.g. 820 + 172 + 202 = 1194)", () => {
    const categories: Category[] = [
      {
        id: "cat-root",
        name: "Tempered Glass & UV GLASS",
        slug: "tempered-glass-uv-glass",
        image_url: null,
        parent_id: null,
        sort_order: 1,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "cat-super-x",
        name: "super x",
        slug: "super-x",
        image_url: null,
        parent_id: "cat-root",
        sort_order: 1,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "cat-uv-glass",
        name: "UV GLASS",
        slug: "uv-glass",
        image_url: null,
        parent_id: "cat-root",
        sort_order: 2,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "cat-membrane",
        name: "membrane",
        slug: "membrane",
        image_url: null,
        parent_id: "cat-root",
        sort_order: 3,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "cat-cables",
        name: "Cables & Cords",
        slug: "cables",
        image_url: null,
        parent_id: null,
        sort_order: 2,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    // Counts with 0 direct products on the root category, and products on leaf nodes
    const counts: Record<string, CategoryProductCounts> = {
      "cat-root": { category_id: "cat-root", direct_count: 0, total_count: 0, active_count: 0 },
      "cat-super-x": { category_id: "cat-super-x", direct_count: 820, total_count: 820, active_count: 800 },
      "cat-uv-glass": { category_id: "cat-uv-glass", direct_count: 172, total_count: 172, active_count: 170 },
      "cat-membrane": { category_id: "cat-membrane", direct_count: 202, total_count: 202, active_count: 200 },
      "cat-cables": { category_id: "cat-cables", direct_count: 0, total_count: 0, active_count: 0 },
    };

    const tree = buildCategoryTree(categories, counts);
    const rootTempered = tree.find((c) => c.id === "cat-root")!;
    const rootCables = tree.find((c) => c.id === "cat-cables")!;

    // Root node must roll up descendants: 820 + 172 + 202 = 1194
    expect(rootTempered.direct_count).toBe(0);
    expect(rootTempered.total_count).toBe(1194);
    expect(rootTempered.active_count).toBe(1170);

    // Empty root shows 0
    expect(rootCables.total_count).toBe(0);

    // All products sum: root totals (1194 + 0) + 1 uncategorized = 1195
    const uncategorizedCount = 1;
    const totalStoreProducts = uncategorizedCount + tree.reduce((acc, r) => acc + r.total_count, 0);
    expect(totalStoreProducts).toBe(1195);
  });

  describe("getCategoryAndDescendantIds", () => {
    it("returns root and all recursive descendants from a CategoryNode tree", () => {
      const tree = buildCategoryTree(mockCategories4Levels);
      // Root Electronics (cat-l1) has cat-l2, cat-l3, cat-l4, and cat-l2-cables
      const ids = getCategoryAndDescendantIds(tree, "cat-l1");
      expect(ids).toContain("cat-l1");
      expect(ids).toContain("cat-l2");
      expect(ids).toContain("cat-l3");
      expect(ids).toContain("cat-l4");
      expect(ids).toContain("cat-l2-cables");
      expect(ids.length).toBe(5);
    });

    it("returns intermediate node and its subcategories only", () => {
      const tree = buildCategoryTree(mockCategories4Levels);
      // cat-l2 (Mobile Accessories) has cat-l3 and cat-l4
      const ids = getCategoryAndDescendantIds(tree, "cat-l2");
      expect(ids).toEqual(["cat-l2", "cat-l3", "cat-l4"]);
    });

    it("returns only the leaf node ID when target is a leaf", () => {
      const tree = buildCategoryTree(mockCategories4Levels);
      const ids = getCategoryAndDescendantIds(tree, "cat-l4");
      expect(ids).toEqual(["cat-l4"]);
    });

    it("returns targetId when targetId is not found in tree", () => {
      const tree = buildCategoryTree(mockCategories4Levels);
      const ids = getCategoryAndDescendantIds(tree, "non-existent-id");
      expect(ids).toEqual(["non-existent-id"]);
    });

    it("returns empty array when targetId or tree is empty", () => {
      expect(getCategoryAndDescendantIds([], "cat-1")).toEqual(["cat-1"]);
      expect(getCategoryAndDescendantIds([], null)).toEqual([]);
      expect(getCategoryAndDescendantIds([], undefined)).toEqual([]);
    });

    it("works correctly on flat Category array", () => {
      const ids = getCategoryAndDescendantIds(mockCategories4Levels, "cat-l1");
      expect(ids).toContain("cat-l1");
      expect(ids).toContain("cat-l2");
      expect(ids).toContain("cat-l3");
      expect(ids).toContain("cat-l4");
      expect(ids).toContain("cat-l2-cables");
      expect(ids.length).toBe(5);
    });
  });

  describe("filterCategoriesByActiveProductCategoryIds", () => {
    it("returns empty array if input categories or active IDs is empty", () => {
      expect(filterCategoriesByActiveProductCategoryIds([], new Set(["cat-1"]))).toEqual([]);
      expect(filterCategoriesByActiveProductCategoryIds(mockCategories4Levels, new Set())).toEqual([]);
      expect(filterCategoriesByActiveProductCategoryIds(mockCategories4Levels, [])).toEqual([]);
    });

    it("includes parent categories if descendant leaf subcategory has products", () => {
      // Products only in cat-l4 (UV Curved Glass)
      const filtered = filterCategoriesByActiveProductCategoryIds(
        mockCategories4Levels,
        new Set(["cat-l4"])
      );
      const filteredIds = filtered.map((c) => c.id);

      // cat-l1 (Electronics) -> cat-l2 (Mobile Accessories) -> cat-l3 (Tempered Glass) -> cat-l4
      expect(filteredIds).toContain("cat-l1");
      expect(filteredIds).toContain("cat-l2");
      expect(filteredIds).toContain("cat-l3");
      expect(filteredIds).toContain("cat-l4");
      // cat-l2-cables has no products and no children with products, so it should be excluded
      expect(filteredIds).not.toContain("cat-l2-cables");
    });

    it("excludes empty categories and subcategories when another subcategory has products", () => {
      // Products only in Cables & Cords
      const filtered = filterCategoriesByActiveProductCategoryIds(
        mockCategories4Levels,
        ["cat-l2-cables"]
      );
      const filteredIds = filtered.map((c) => c.id);

      expect(filteredIds).toContain("cat-l1");
      expect(filteredIds).toContain("cat-l2-cables");
      expect(filteredIds).not.toContain("cat-l2");
      expect(filteredIds).not.toContain("cat-l3");
      expect(filteredIds).not.toContain("cat-l4");
    });
  });
});
