import type { Category, CategoryNode, CategoryProductCounts } from "./types/category";

/**
 * Normalizes category counts into a fast lookup map keyed by category_id.
 */
function normalizeCountsMap(
  counts?: Record<string, CategoryProductCounts> | CategoryProductCounts[]
): Map<string, CategoryProductCounts> {
  const map = new Map<string, CategoryProductCounts>();
  if (!counts) return map;

  if (Array.isArray(counts)) {
    for (const c of counts) {
      if (c && c.category_id) {
        map.set(c.category_id, c);
      }
    }
  } else if (typeof counts === "object") {
    for (const [key, val] of Object.entries(counts)) {
      if (val && key) {
        map.set(key, val);
      }
    }
  }

  return map;
}

/**
 * Builds a hierarchical CategoryNode tree from flat categories and product count stats.
 * Handles:
 * - Arbitrary depth (L1, L2, L3, L4, etc.)
 * - Orphan categories (parent_id pointing to a nonexistent category) by treating them as roots
 * - Missing count data by gracefully defaulting direct_count, total_count, and active_count to 0
 * - Deterministic sorting by sort_order ASC, then name ASC
 */
export function buildCategoryTree(
  flatCategories: Category[],
  counts?: Record<string, CategoryProductCounts> | CategoryProductCounts[]
): CategoryNode[] {
  if (!flatCategories || flatCategories.length === 0) {
    return [];
  }

  const countsMap = normalizeCountsMap(counts);
  const categoryIds = new Set(flatCategories.map((c) => c.id));

  // Group children by parent_id
  const childrenMap = new Map<string, Category[]>();
  const rootCategories: Category[] = [];

  for (const cat of flatCategories) {
    const parentId = cat.parent_id;
    // An orphan is any category with a parent_id that does not exist in the dataset
    if (!parentId || !categoryIds.has(parentId)) {
      rootCategories.push(cat);
    } else {
      const existing = childrenMap.get(parentId) || [];
      existing.push(cat);
      childrenMap.set(parentId, existing);
    }
  }

  // Recursive builder function
  function createNode(cat: Category, level: number, parentPath?: string): CategoryNode {
    const countInfo = countsMap.get(cat.id);
    const fullPath = parentPath ? `${parentPath} > ${cat.name}` : cat.name;

    const rawChildren = childrenMap.get(cat.id) || [];
    const sortedChildren = [...rawChildren].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
    );

    const children = sortedChildren.map((child) => createNode(child, level + 1, fullPath));

    const directCount = Number(countInfo?.direct_count ?? 0);
    const rawTotal = Number(countInfo?.total_count ?? 0);
    const rawActive = Number(countInfo?.active_count ?? 0);

    // Sum descendants from children (post-order traversal)
    const childrenTotal = children.reduce((sum, c) => sum + (c.total_count || 0), 0);
    const childrenActive = children.reduce((sum, c) => sum + (c.active_count || 0), 0);

    // If rawTotal is >= directCount + childrenTotal, it is already a pre-aggregated recursive count from RPC.
    // If rawTotal was 0 or direct-only (from fallback), roll up directCount + childrenTotal.
    const totalCount = Math.max(rawTotal, directCount + childrenTotal);
    const isPreAggregated = rawTotal > directCount && rawTotal >= directCount + childrenTotal;
    const activeCount = isPreAggregated
      ? Math.max(rawActive, childrenActive)
      : rawActive + childrenActive;

    return {
      ...cat,
      level,
      fullPath,
      direct_count: directCount,
      total_count: totalCount,
      active_count: activeCount,
      children,
    };
  }

  // Sort roots and build tree
  rootCategories.sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
  );

  return rootCategories.map((root) => createNode(root, 1));
}

/**
 * Searches the CategoryNode tree for a specific category ID and returns the
 * ancestor chain as an array of CategoryNode (from root down to the target).
 */
export function getCategoryBreadcrumbs(
  tree: CategoryNode[],
  categoryId: string | null | undefined
): CategoryNode[] {
  if (!categoryId || !tree || tree.length === 0) {
    return [];
  }

  function findPath(nodes: CategoryNode[]): CategoryNode[] | null {
    for (const node of nodes) {
      if (node.id === categoryId) {
        return [node];
      }
      if (node.children && node.children.length > 0) {
        const subPath = findPath(node.children);
        if (subPath) {
          return [node, ...subPath];
        }
      }
    }
    return null;
  }

  return findPath(tree) || [];
}

/**
 * Returns the human-readable breadcrumb path for a category ID (e.g. "Tempered Glass & UV GLASS > super x").
 * Returns empty string if category is null/undefined or not found in the tree.
 */
export function getCategoryPath(
  tree: CategoryNode[],
  categoryId: string | null | undefined
): string {
  const crumbs = getCategoryBreadcrumbs(tree, categoryId);
  if (crumbs.length === 0) return "";
  return crumbs.map((c) => c.name).join(" > ");
}
