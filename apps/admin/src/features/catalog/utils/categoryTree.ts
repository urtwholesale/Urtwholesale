import type { Category } from "@urbanrat/shared";
import type { CategoryNode } from "../types";

/**
 * Builds a hierarchical nested tree from flat category rows.
 * Enforces max depth of 4 levels.
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const categoryMap = new Map<string, CategoryNode>();

  // Initialize nodes
  categories.forEach((cat) => {
    categoryMap.set(cat.id, {
      ...cat,
      level: 1,
      fullPath: cat.name,
      children: [],
    });
  });

  const roots: CategoryNode[] = [];

  categories.forEach((cat) => {
    const node = categoryMap.get(cat.id)!;
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      const parent = categoryMap.get(cat.parent_id)!;
      node.level = Math.min((parent.level || 1) + 1, 4);
      node.fullPath = `${parent.fullPath} > ${cat.name}`;
      parent.children.push(node);
    } else {
      node.level = 1;
      node.fullPath = cat.name;
      roots.push(node);
    }
  });

  // Sort children by sort_order then name
  const sortRecursive = (list: CategoryNode[]) => {
    list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
    list.forEach((item) => sortRecursive(item.children));
  };

  sortRecursive(roots);
  return roots;
}

/**
 * Resolves full breadcrumb path for a given category ID (e.g. "Electronics > Audio > Headphones")
 */
export function getCategoryBreadcrumb(categoryId: string, categories: Category[]): string {
  const catMap = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const path: string[] = [];
  let curr = catMap.get(categoryId);
  let guard = 0;

  while (curr && guard < 10) {
    path.unshift(curr.name);
    curr = curr.parent_id ? catMap.get(curr.parent_id) : undefined;
    guard++;
  }

  return path.join(" / ");
}

/**
 * Calculates current nesting depth of a category (1 = root, 4 = leaf)
 */
export function getCategoryDepth(categoryId: string | null, categories: Category[]): number {
  if (!categoryId) return 0;
  const catMap = new Map<string, Category>(categories.map((c) => [c.id, c]));
  let depth = 0;
  let curr = catMap.get(categoryId);
  let guard = 0;

  while (curr && guard < 10) {
    depth++;
    curr = curr.parent_id ? catMap.get(curr.parent_id) : undefined;
    guard++;
  }

  return depth;
}
