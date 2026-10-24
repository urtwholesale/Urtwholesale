import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type {
  Product,
  Category,
  CategoryNode,
  CategoryProductCounts,
  ProductListFilters,
} from "@urbanrat/shared";
import {
  buildCategoryTree,
  getCategoryPath,
  getCategoryBreadcrumbs,
} from "@urbanrat/shared";
import {
  fetchCategories,
  fetchCategoryCounts,
  fetchProductsPage,
  bulkMoveProducts,
  bulkUpdateProductStatus,
  deleteProduct,
  deleteProducts,
  adminBulkUpdateStock,
  fetchProductIdsForFilter,
  undoBulkOperation,
} from "../../lib/adminService";
import { triggerHaptic } from "../../utils/haptics";
import { ProductEditor } from "./ProductEditor";
import { CategorySidebarFilter } from "./components/CategorySidebarFilter";
import { CategoryMobileDrawer } from "./components/CategoryMobileDrawer";
import { CategoryMoveModal } from "./components/CategoryMoveModal";
import { BulkEditDrawer } from "./components/BulkEditDrawer";
import { BulkHistoryModal } from "./components/BulkHistoryModal";
import {
  History,
  Plus,
  Search,
  Package,
  Layers,
  AlertTriangle,
  Zap,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  Boxes,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Folder,
  Eye,
  EyeOff,
  RotateCcw,
  Sliders,
  CheckCircle2,
} from "lucide-react";

export function ProductList() {
  // Category data & tree
  const [categories, setCategories] = useState<Category[]>([]);
  const [countsMap, setCountsMap] = useState<Record<string, CategoryProductCounts>>({});
  const [uncategorizedCounts, setUncategorizedCounts] = useState<CategoryProductCounts>({
    category_id: null,
    direct_count: 0,
    total_count: 0,
    active_count: 0,
  });
  const [isCategoryLoading, setIsCategoryLoading] = useState(true);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // URL query params initialization
  const initialParams = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  // Filter & pagination states
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    initialParams.get("cat") || null
  );
  const [uncategorizedOnly, setUncategorizedOnly] = useState<boolean>(
    initialParams.get("uncat") === "1"
  );
  const [includeDescendants, setIncludeDescendants] = useState<boolean>(
    initialParams.get("sub") !== "0"
  );
  const [search, setSearch] = useState<string>(initialParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialParams.get("q") || "");
  const [urbanratOnly, setUrbanratOnly] = useState<boolean>(
    initialParams.get("urbanrat") === "1"
  );
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(
    initialParams.get("lowstock") === "1"
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    (initialParams.get("status") as any) || "all"
  );
  const [page, setPage] = useState<number>(Number(initialParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState<number>(Number(initialParams.get("size")) || 25);
  const [sortOption, setSortOption] = useState<
    "updated_at_desc" | "name_asc" | "name_desc" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc"
  >((initialParams.get("sort") as any) || "updated_at_desc");

  // Selection states
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isSelectAllAcrossPages, setIsSelectAllAcrossPages] = useState<boolean>(false);
  const [isFetchingAllCategoryIds, setIsFetchingAllCategoryIds] = useState<boolean>(false);
  const [isCappedWarning, setIsCappedWarning] = useState<boolean>(false);

  // Bulk Edit Drawer state
  const [isBulkEditDrawerOpen, setIsBulkEditDrawerOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Bulk Edit Undo Toast
  const [bulkUndoToast, setBulkUndoToast] = useState<{
    show: boolean;
    message: string;
    opIds: string[];
  } | null>(null);

  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Modals
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null);
  const [confirmDeleteBulk, setConfirmDeleteBulk] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Stock Modal
  const [isBulkStockModalOpen, setIsBulkStockModalOpen] = useState(false);
  const [bulkStockMode, setBulkStockMode] = useState<"set" | "adjust">("set");
  const [bulkStockValue, setBulkStockValue] = useState<number | "">("");
  const [bulkStockReason, setBulkStockReason] = useState("Bulk stock update");
  const [isBulkStockSaving, setIsBulkStockSaving] = useState(false);

  // Editor Modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Undo Toast after bulk move
  const [undoToast, setUndoToast] = useState<{
    show: boolean;
    movedIds: string[];
    previousMap: Record<string, string | null>;
    targetCategoryName: string;
  } | null>(null);

  // Image load error tracking
  const [brokenThumbIds, setBrokenThumbIds] = useState<Set<string>>(new Set());

  // 300ms Debounce search input
  const searchTimeoutRef = useRef<any>(null);
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on new search
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search]);

  // Sync state to URL search params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (selectedCategoryId) params.set("cat", selectedCategoryId);
    if (uncategorizedOnly) params.set("uncat", "1");
    if (!includeDescendants) params.set("sub", "0");
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    if (urbanratOnly) params.set("urbanrat", "1");
    if (lowStockOnly) params.set("lowstock", "1");
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sortOption !== "updated_at_desc") params.set("sort", sortOption);
    if (page > 1) params.set("page", String(page));
    if (pageSize !== 25) params.set("size", String(pageSize));

    const queryStr = params.toString();
    const newUrl = queryStr ? `${window.location.pathname}?${queryStr}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [
    selectedCategoryId,
    uncategorizedOnly,
    includeDescendants,
    debouncedSearch,
    urbanratOnly,
    lowStockOnly,
    statusFilter,
    sortOption,
    page,
    pageSize,
  ]);

  // Load category tree and counts
  const loadCategoryData = useCallback(async () => {
    setIsCategoryLoading(true);
    try {
      const [cats, countsRes] = await Promise.all([
        fetchCategories(),
        fetchCategoryCounts(),
      ]);
      setCategories(cats);
      setCountsMap(countsRes.countsMap);
      setUncategorizedCounts(countsRes.uncategorized);
    } catch (err: any) {
      console.error("Failed to load category metadata:", err);
    } finally {
      setIsCategoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategoryData();
  }, [loadCategoryData]);

  // Memoized Category Tree
  const categoryTree = useMemo(() => {
    return buildCategoryTree(categories, countsMap);
  }, [categories, countsMap]);

  // Load paginated products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ProductListFilters = {
        categoryId: uncategorizedOnly ? null : selectedCategoryId,
        uncategorizedOnly,
        includeDescendants,
        search: debouncedSearch.trim() || undefined,
        isUrbanrat: urbanratOnly ? true : undefined,
        lowStock: lowStockOnly ? true : undefined,
        status: statusFilter,
        sort: sortOption,
        page,
        pageSize,
      };

      const res = await fetchProductsPage(filters);
      setProducts(res.products);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error("Failed to load products page:", err);
      setError(err?.message || "Failed to load products from database.");
    } finally {
      setLoading(false);
    }
  }, [
    selectedCategoryId,
    uncategorizedOnly,
    includeDescendants,
    debouncedSearch,
    urbanratOnly,
    lowStockOnly,
    statusFilter,
    sortOption,
    page,
    pageSize,
  ]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Total products across store
  const totalStoreProducts = useMemo(() => {
    let sum = uncategorizedCounts.total_count ?? 0;
    for (const root of categoryTree) {
      sum += root.total_count ?? 0;
    }
    return sum;
  }, [categoryTree, uncategorizedCounts]);

  // Breadcrumbs for current selected category
  const activeBreadcrumbs = useMemo(() => {
    if (uncategorizedOnly) {
      return [{ id: "uncat", name: "Uncategorized", level: 1 } as CategoryNode];
    }
    if (!selectedCategoryId) {
      return [];
    }
    return getCategoryBreadcrumbs(categoryTree, selectedCategoryId);
  }, [categoryTree, selectedCategoryId, uncategorizedOnly]);

  // Category selection handler
  function handleSelectCategory(catId: string | null, isUncat: boolean = false) {
    triggerHaptic("selection");
    setSelectedCategoryId(catId);
    setUncategorizedOnly(isUncat);
    setPage(1);
    setSelectedProductIds(new Set());
    setIsSelectAllAcrossPages(false);
  }

  // Clear category filter
  function handleClearCategoryFilter() {
    triggerHaptic("selection");
    setSelectedCategoryId(null);
    setUncategorizedOnly(false);
    setPage(1);
  }

  // Selection helpers
  const isAllCurrentPageSelected = useMemo(() => {
    return products.length > 0 && products.every((p) => selectedProductIds.has(p.id));
  }, [products, selectedProductIds]);

  function handleToggleSelectCurrentPage() {
    triggerHaptic("selection");
    if (isAllCurrentPageSelected) {
      setSelectedProductIds(new Set());
      setIsSelectAllAcrossPages(false);
    } else {
      setSelectedProductIds(new Set(products.map((p) => p.id)));
      setIsSelectAllAcrossPages(false);
    }
  }

  function handleToggleSelectOne(id: string) {
    triggerHaptic("selection");
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setIsSelectAllAcrossPages(false);
  }

  const selectedScopeName = useMemo(() => {
    if (selectedCategoryId) {
      return getCategoryPath(categoryTree, selectedCategoryId) || "Selected Category";
    }
    if (uncategorizedOnly) {
      return "Uncategorized";
    }
    return "All Products";
  }, [selectedCategoryId, uncategorizedOnly, categoryTree]);

  const selectedScopeLabel = useMemo(() => {
    const count = selectedProductIds.size;
    if (selectedCategoryId || uncategorizedOnly) {
      return `Applying to ${count} product${count === 1 ? "" : "s"} in ${selectedScopeName}`;
    }
    return `Applying to ${count} product${count === 1 ? "" : "s"} across all categories`;
  }, [selectedProductIds.size, selectedCategoryId, uncategorizedOnly, selectedScopeName]);

  async function handleSelectAllAcrossPages() {
    triggerHaptic("selection");
    setIsFetchingAllCategoryIds(true);
    try {
      const filters: ProductListFilters = {
        categoryId: selectedCategoryId || undefined,
        uncategorizedOnly: uncategorizedOnly || undefined,
        includeDescendants,
        search: debouncedSearch.trim() || undefined,
        isUrbanrat: urbanratOnly ? true : undefined,
        lowStock: lowStockOnly ? true : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      };
      const ids = await fetchProductIdsForFilter(filters, 5000);
      setSelectedProductIds(new Set(ids));
      setIsSelectAllAcrossPages(true);
      setIsCappedWarning(ids.length >= 5000);
      triggerHaptic("success");
    } catch (err: any) {
      alert(err?.message || "Failed to fetch all product IDs.");
    } finally {
      setIsFetchingAllCategoryIds(false);
    }
  }

  function handleClearSelection() {
    triggerHaptic("selection");
    setSelectedProductIds(new Set());
    setIsSelectAllAcrossPages(false);
    setIsCappedWarning(false);
  }

  function handleBulkSuccess(result: { applied: number; skipped: number; opIds: string[] }) {
    triggerHaptic("success");
    setSelectedProductIds(new Set());
    setIsSelectAllAcrossPages(false);
    setIsCappedWarning(false);
    setBulkUndoToast({
      show: true,
      message: `Bulk change applied to ${result.applied} product${result.applied === 1 ? "" : "s"}.`,
      opIds: result.opIds,
    });
    // Refresh table and counts
    loadCategoryData();
    loadProducts();
  }

  async function handleUndoBulkOperation() {
    if (!bulkUndoToast || bulkUndoToast.opIds.length === 0) return;
    triggerHaptic("selection");
    const opIds = [...bulkUndoToast.opIds];
    setBulkUndoToast(null);
    try {
      for (const opId of opIds) {
        await undoBulkOperation(opId);
      }
      triggerHaptic("success");
      await Promise.all([loadCategoryData(), loadProducts()]);
    } catch (err: any) {
      alert(err?.message || "Failed to undo bulk operation.");
    }
  }

  // Bulk Move products
  async function handleExecuteBulkMove(targetCategoryId: string | null) {
    const ids = Array.from(selectedProductIds);
    if (ids.length === 0) return;

    // Save previous category IDs in memory for Undo action
    const previousMap: Record<string, string | null> = {};
    for (const p of products) {
      if (selectedProductIds.has(p.id)) {
        previousMap[p.id] = p.category_id || null;
      }
    }

    await bulkMoveProducts(ids, targetCategoryId);

    const targetName = targetCategoryId
      ? getCategoryPath(categoryTree, targetCategoryId) || "Selected Category"
      : "Uncategorized";

    setSelectedProductIds(new Set());
    setIsSelectAllAcrossPages(false);

    // Refresh counts and product list
    await Promise.all([loadCategoryData(), loadProducts()]);

    // Show Undo toast
    setUndoToast({
      show: true,
      movedIds: ids,
      previousMap,
      targetCategoryName: targetName,
    });
  }

  // Undo bulk move action
  async function handleUndoMove() {
    if (!undoToast) return;
    triggerHaptic("selection");
    const { movedIds, previousMap } = undoToast;
    setUndoToast(null);

    // Group product IDs by their previous category
    const byCategory = new Map<string | null, string[]>();
    for (const id of movedIds) {
      const prevCat = previousMap[id] ?? null;
      const list = byCategory.get(prevCat) || [];
      list.push(id);
      byCategory.set(prevCat, list);
    }

    try {
      for (const [prevCat, pIds] of byCategory.entries()) {
        await bulkMoveProducts(pIds, prevCat);
      }
      triggerHaptic("success");
      await Promise.all([loadCategoryData(), loadProducts()]);
    } catch (err: any) {
      alert(err?.message || "Failed to undo move.");
    }
  }

  // Bulk Status update (Activate / Deactivate)
  async function handleBulkStatusChange(isActive: boolean) {
    const ids = Array.from(selectedProductIds);
    if (ids.length === 0) return;
    triggerHaptic("selection");
    try {
      await bulkUpdateProductStatus(ids, isActive);
      triggerHaptic("success");
      setSelectedProductIds(new Set());
      await Promise.all([loadCategoryData(), loadProducts()]);
    } catch (err: any) {
      alert(err?.message || "Failed to update status.");
    }
  }

  // Single delete
  async function handleExecuteSingleDelete() {
    if (!confirmDeleteProduct) return;
    setIsDeleting(true);
    triggerHaptic("selection");
    try {
      await deleteProduct(confirmDeleteProduct.id);
      setConfirmDeleteProduct(null);
      triggerHaptic("success");
      await Promise.all([loadCategoryData(), loadProducts()]);
    } catch (err: any) {
      alert(err?.message || "Failed to delete product.");
    } finally {
      setIsDeleting(false);
    }
  }

  // Bulk delete
  async function handleExecuteBulkDelete() {
    if (selectedProductIds.size === 0) return;
    setIsDeleting(true);
    triggerHaptic("selection");
    try {
      const ids = Array.from(selectedProductIds);
      const res = await deleteProducts(ids);
      setSelectedProductIds(new Set());
      setConfirmDeleteBulk(false);
      triggerHaptic("success");
      await Promise.all([loadCategoryData(), loadProducts()]);
      if (res.failedIds.length > 0) {
        alert(
          `Deleted ${res.deletedIds.length} product(s). ${res.failedIds.length} could not be deleted because they are referenced by return orders.`
        );
      }
    } catch (err: any) {
      alert(err?.message || "Failed to bulk delete products.");
    } finally {
      setIsDeleting(false);
    }
  }

  // Bulk Stock update
  async function handleExecuteBulkStockUpdate() {
    if (selectedProductIds.size === 0 || bulkStockValue === "") {
      alert("Please enter a stock value.");
      return;
    }
    const numVal = Number(bulkStockValue);
    if (isNaN(numVal)) {
      alert("Please enter a valid stock number.");
      return;
    }
    setIsBulkStockSaving(true);
    triggerHaptic("selection");
    try {
      const ids = Array.from(selectedProductIds);
      const res = await adminBulkUpdateStock({
        productIds: ids,
        mode: bulkStockMode,
        value: numVal,
        reason: bulkStockReason.trim() || "Bulk stock update",
      });

      triggerHaptic("success");
      setIsBulkStockModalOpen(false);
      setBulkStockValue("");
      setSelectedProductIds(new Set());
      await loadProducts();
      alert(`Successfully updated stock for ${res.updatedCount} product(s)!`);
    } catch (err: any) {
      alert(err?.message || "Failed to bulk update stock.");
    } finally {
      setIsBulkStockSaving(false);
    }
  }

  function handleEditorSaved() {
    setIsEditorOpen(false);
    setEditingProduct(null);
    loadCategoryData();
    loadProducts();
  }

  return (
    <div className="space-y-5">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Catalog &amp; Inventory Products
          </h2>
          <p className="text-xs text-slate-400">
            {totalCount} products found • {totalStoreProducts} total store catalog
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Mobile / Tablet Category Drawer Trigger */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setIsMobileDrawerOpen(true);
            }}
            className="lg:hidden inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-brand-dark" />
            <span>Browse Categories</span>
            {selectedCategoryId && (
              <span className="w-2 h-2 rounded-full bg-brand-dark" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setIsHistoryModalOpen(true);
            }}
            title="View bulk edit operations history & undo"
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Bulk History</span>
          </button>

          <button
            type="button"
            onClick={() => {
              loadCategoryData();
              loadProducts();
            }}
            aria-label="Refresh catalog"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-brand-dark" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setIsEditorOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md brand-gradient transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {/* ── Main Layout: Sidebar on Desktop + Product Content on Right ── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Desktop Left Sidebar (>= 1024px) */}
        <div className="hidden lg:block">
          <CategorySidebarFilter
            categoryTree={categoryTree}
            countsMap={countsMap}
            uncategorizedCounts={uncategorizedCounts}
            totalProductsCount={totalStoreProducts}
            selectedCategoryId={selectedCategoryId}
            uncategorizedOnly={uncategorizedOnly}
            includeDescendants={includeDescendants}
            isLoading={isCategoryLoading}
            onSelectCategory={handleSelectCategory}
            onToggleIncludeDescendants={(inc) => {
              setIncludeDescendants(inc);
              setPage(1);
            }}
          />
        </div>

        {/* Right Area: Breadcrumb, Filters & Products Table */}
        <div className="flex-1 w-full space-y-4 min-w-0">
          {/* Breadcrumb Bar with Clickable Nodes & Clear Button */}
          <div className="bg-white p-3.5 px-4 rounded-2xl border border-slate-100 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={handleClearCategoryFilter}
                className={`font-bold hover:underline transition cursor-pointer ${
                  !selectedCategoryId && !uncategorizedOnly
                    ? "text-slate-900 font-extrabold"
                    : "text-slate-500"
                }`}
              >
                All Products
              </button>

              {activeBreadcrumbs.map((crumb, idx) => (
                <div key={crumb.id || idx} className="flex items-center space-x-1.5">
                  <span className="text-slate-300">/</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (crumb.id === "uncat") {
                        handleSelectCategory(null, true);
                      } else {
                        handleSelectCategory(crumb.id, false);
                      }
                    }}
                    className={`font-bold hover:underline truncate max-w-44 transition cursor-pointer ${
                      idx === activeBreadcrumbs.length - 1
                        ? "text-brand-dark font-extrabold"
                        : "text-slate-500"
                    }`}
                    title={crumb.name}
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}

              <span className="text-slate-400 font-medium ml-1">
                ({totalCount} products)
              </span>
            </div>

            {(selectedCategoryId || uncategorizedOnly) && (
              <button
                type="button"
                onClick={handleClearCategoryFilter}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center space-x-1 shrink-0"
              >
                <X className="w-3 h-3" />
                <span>Clear filter</span>
              </button>
            )}
          </div>

          {/* Filter Bar (Search, Status, Urbanrat, Low Stock, Sort) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-wrap items-center gap-3 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, SKU, brand, keywords..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light/50 bg-slate-50/50"
              />
            </div>

            {/* Status Filter */}
            <div className="shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light/50 bg-white font-medium"
              >
                <option value="all">Status: All</option>
                <option value="active">Status: Active Only</option>
                <option value="inactive">Status: Inactive Only</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="shrink-0">
              <select
                value={sortOption}
                onChange={(e) => {
                  setSortOption(e.target.value as any);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light/50 bg-white font-medium"
              >
                <option value="updated_at_desc">Sort: Recently Updated</option>
                <option value="name_asc">Sort: Name (A-Z)</option>
                <option value="name_desc">Sort: Name (Z-A)</option>
                <option value="price_asc">Sort: Price (Low to High)</option>
                <option value="price_desc">Sort: Price (High to Low)</option>
                <option value="stock_asc">Sort: Stock (Low to High)</option>
                <option value="stock_desc">Sort: Stock (High to Low)</option>
              </select>
            </div>

            {/* Toggles */}
            <div className="flex items-center space-x-3 shrink-0">
              <label className="flex items-center space-x-1.5 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={urbanratOnly}
                  onChange={(e) => {
                    setUrbanratOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded text-brand-dark focus:ring-brand-light cursor-pointer"
                />
                <span>Urbanrat Only</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer font-bold text-rose-600">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => {
                    setLowStockOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded text-rose-500 focus:ring-rose-400 cursor-pointer"
                />
                <span>Low Stock</span>
              </label>
            </div>
          </div>

          {/* Cross-Page Select All Banner */}
          {isAllCurrentPageSelected && totalCount > products.length && !isSelectAllAcrossPages && (
            <div className="p-3 bg-brand-light/15 border border-brand-light/35 rounded-2xl flex items-center justify-between text-xs animate-fade-in">
              <span className="text-slate-700">
                All <strong>{products.length}</strong> products on this page are selected.
              </span>
              <button
                type="button"
                onClick={handleSelectAllAcrossPages}
                className="font-bold text-brand-dark hover:underline cursor-pointer"
              >
                Select all {totalCount} products in this view
              </button>
            </div>
          )}

          {isSelectAllAcrossPages && (
            <div className="p-3 bg-brand-light/20 border border-brand-light/40 rounded-2xl flex items-center justify-between text-xs animate-fade-in font-bold text-brand-dark">
              <span>All {totalCount} products in this view are selected.</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedProductIds(new Set());
                  setIsSelectAllAcrossPages(false);
                }}
                className="text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* ── Undo Toast after Bulk Move ── */}
          {undoToast?.show && (
            <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-lg flex items-center justify-between gap-3 text-xs animate-fade-in border border-slate-800">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Moved {undoToast.movedIds.length} products to <strong>{undoToast.targetCategoryName}</strong>.
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleUndoMove}
                  className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold flex items-center space-x-1 cursor-pointer transition active:scale-95"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUndoToast(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── Error Banner ── */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={loadProducts}
                className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* ── Product Table (Desktop & Tablet) ── */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            {loading && products.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-dark" />
                <span className="font-medium">Loading catalog products...</span>
              </div>
            ) : products.length > 0 ? (
              <>
                {/* ── Selection Scope Banner across category ── */}
                {selectedProductIds.size > 0 && isAllCurrentPageSelected && totalCount > products.length && !isSelectAllAcrossPages && (
                  <div className="bg-sky-50 border-b border-sky-100 py-2.5 px-4 text-center text-xs text-brand-dark flex flex-wrap items-center justify-center gap-2">
                    <span>
                      All <strong>{products.length}</strong> products on this page are selected.
                    </span>
                    <button
                      type="button"
                      disabled={isFetchingAllCategoryIds}
                      onClick={handleSelectAllAcrossPages}
                      className="font-black text-brand-dark underline flex items-center space-x-1 cursor-pointer hover:text-brand"
                    >
                      {isFetchingAllCategoryIds ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Selecting all {totalCount} products...</span>
                        </>
                      ) : (
                        <span>
                          Select all {totalCount.toLocaleString()} products in {selectedScopeName}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {isSelectAllAcrossPages && (
                  <div className="bg-sky-50 border-b border-sky-100 py-2.5 px-4 text-center text-xs text-brand-dark flex flex-wrap items-center justify-center gap-2">
                    <span>
                      All <strong>{selectedProductIds.size.toLocaleString()}</strong> products in{" "}
                      <strong>{selectedScopeName}</strong> are selected.
                    </span>
                    {isCappedWarning && (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                        Selection capped at 5,000 products
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="font-black text-slate-700 hover:text-slate-900 underline cursor-pointer ml-1"
                    >
                      Clear selection
                    </button>
                  </div>
                )}

                {/* ── Desktop Product Table (>= 1024px) ── */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold bg-slate-50/50">
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={isAllCurrentPageSelected}
                            onChange={handleToggleSelectCurrentPage}
                            className="rounded text-brand-dark focus:ring-brand-light cursor-pointer"
                            title={isAllCurrentPageSelected ? "Deselect All on Page" : "Select All on Page"}
                          />
                        </th>
                        <th className="py-3 px-4">Item &amp; Category</th>
                        <th className="py-3 px-3">SKU</th>
                        <th className="py-3 px-3">Stock Level</th>
                        <th className="py-3 px-3">Starting Price</th>
                        <th className="py-3 px-3">Price Tiers</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map((p) => {
                        const isLow = p.stock <= (p.low_stock_threshold || 5);
                        const tiers = p.price_tiers || [];
                        const isSelected = selectedProductIds.has(p.id);
                        const isBroken = brokenThumbIds.has(p.id);

                        const categoryPath =
                          getCategoryPath(categoryTree, p.category_id) ||
                          (p as any).category_name ||
                          "Uncategorized";

                        return (
                          <tr
                            key={p.id}
                            className={`hover:bg-slate-50/60 transition ${
                              isSelected ? "bg-sky-50/40" : ""
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectOne(p.id)}
                                className="rounded text-brand-dark focus:ring-brand-light cursor-pointer"
                              />
                            </td>

                            {/* Product Thumbnail & Category Path */}
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                                  {p.images && p.images[0] && !isBroken ? (
                                    <img
                                      src={p.images[0]}
                                      alt=""
                                      onError={() => setBrokenThumbIds((prev) => new Set(prev).add(p.id))}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Package className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                                <div className="min-w-0 max-w-xs sm:max-w-md">
                                  <p className="font-bold text-slate-900 truncate" title={p.name}>
                                    {p.name}
                                  </p>
                                  {/* Small muted category path */}
                                  <p
                                    className="text-[10px] text-slate-400 truncate mt-0.5"
                                    title={categoryPath}
                                  >
                                    {categoryPath}
                                  </p>
                                  {p.is_urbanrat_brand && (
                                    <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-cyan-50 text-brand-dark border border-cyan-200 mt-0.5">
                                      <Zap className="w-2.5 h-2.5" />
                                      <span>Urbanrat</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* SKU */}
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                              {p.sku || "—"}
                            </td>

                            {/* Stock */}
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  isLow
                                    ? "bg-rose-50 text-rose-700 border border-rose-200 animate-pulse"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                {p.stock} units
                              </span>
                            </td>

                            {/* Starting Price */}
                            <td className="py-3 px-3 font-bold text-slate-800">
                              ₹{p.price}
                            </td>

                            {/* Price Tiers */}
                            <td className="py-3 px-3">
                              {tiers.length > 0 ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                  <Layers className="w-3 h-3 text-sky-600" />
                                  <span>{tiers.length} Tiers</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">1 Base Price</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                  p.is_active
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                }`}
                              >
                                {p.is_active ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProduct(p);
                                    setIsEditorOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer flex items-center space-x-1 text-[11px] font-bold"
                                  title="Edit Product"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteProduct(p)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer flex items-center space-x-1 text-[11px] font-bold"
                                  title="Delete Product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Mobile / Tablet Product Cards (< 1024px) ── */}
                <div className="lg:hidden divide-y divide-slate-100">
                  {/* Select All on Page helper bar for mobile */}
                  <div className="p-3 bg-slate-50/80 flex items-center justify-between text-xs border-b border-slate-100">
                    <label className="flex items-center space-x-2 text-slate-600 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAllCurrentPageSelected}
                        onChange={handleToggleSelectCurrentPage}
                        className="rounded text-brand-dark focus:ring-brand-light cursor-pointer"
                      />
                      <span className="text-[11px]">Select all on this page</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Page {page} of {totalPages}
                    </span>
                  </div>

                  {products.map((p) => {
                    const isLow = p.stock <= (p.low_stock_threshold || 5);
                    const tiers = p.price_tiers || [];
                    const isSelected = selectedProductIds.has(p.id);
                    const isBroken = brokenThumbIds.has(p.id);

                    const categoryPath =
                      getCategoryPath(categoryTree, p.category_id) ||
                      (p as any).category_name ||
                      "Uncategorized";

                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 transition flex flex-col gap-2.5 ${
                          isSelected ? "bg-sky-50/50" : "bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start space-x-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(p.id)}
                              className="mt-1 rounded text-brand-dark focus:ring-brand-light cursor-pointer shrink-0"
                            />
                            <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                              {p.images && p.images[0] && !isBroken ? (
                                <img
                                  src={p.images[0]}
                                  alt=""
                                  onError={() => setBrokenThumbIds((prev) => new Set(prev).add(p.id))}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-xs line-clamp-2" title={p.name}>
                                {p.name}
                              </p>
                              {/* Small muted category path */}
                              <p className="text-[10px] text-slate-400 truncate mt-0.5" title={categoryPath}>
                                {categoryPath}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="font-mono text-[10px] text-slate-500">
                                  {p.sku || "No SKU"}
                                </span>
                                {p.is_urbanrat_brand && (
                                  <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-cyan-50 text-brand-dark border border-cyan-200">
                                    <Zap className="w-2 h-2" />
                                    <span>Urbanrat</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-50">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-slate-900 text-sm">
                              ₹{p.price}
                            </span>
                            {tiers.length > 0 ? (
                              <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                <Layers className="w-2.5 h-2.5 text-sky-600" />
                                <span>{tiers.length} Tiers</span>
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                isLow
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {p.stock} in stock
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase ${
                                p.is_active
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              }`}
                            >
                              {p.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>

                        {/* Edit and Delete Actions (kept reachable) */}
                        <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-50">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(p);
                              setIsEditorOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center space-x-1.5 text-xs font-bold"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProduct(p)}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/50 text-rose-600 hover:bg-rose-50 transition cursor-pointer flex items-center space-x-1.5 text-xs font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Pagination Footer ── */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-3 text-slate-500">
                    <span>
                      Showing <strong>{products.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> -{" "}
                      <strong>{Math.min(page * pageSize, totalCount)}</strong> of{" "}
                      <strong>{totalCount}</strong> products
                    </span>

                    <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
                      <span className="text-[11px] text-slate-400">Page size:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                        className="px-2 py-0.5 rounded-md border border-slate-200 bg-white text-xs font-semibold"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  {/* Page Controls */}
                  <div className="flex items-center space-x-1 self-end sm:self-auto">
                    <button
                      type="button"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center space-x-1 px-2 font-bold text-slate-700 text-xs">
                      <span>Page</span>
                      <span className="px-2 py-0.5 rounded-md bg-brand-light/20 text-brand-dark">
                        {page}
                      </span>
                      <span>of {totalPages}</span>
                    </div>

                    <button
                      type="button"
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-dashed border-slate-200 flex items-center justify-center text-slate-400">
                  <Package className="w-6 h-6 stroke-1.5" />
                </div>
                <div>
                  <p className="font-bold text-slate-700 text-sm">No products found</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                    No products match the selected category filter or search keywords.
                  </p>
                </div>
                {(selectedCategoryId || uncategorizedOnly || search.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClearCategoryFilter();
                      setSearch("");
                    }}
                    className="px-3.5 py-1.5 rounded-xl brand-gradient text-white font-bold text-xs shadow-2xs hover:shadow-md transition active:scale-95 cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky Bulk Action Toolbar (appears when products are selected) ── */}
      {selectedProductIds.size > 0 && (
        <div className="fixed bottom-6 z-50 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-2xl bg-slate-900/95 text-white p-3.5 sm:px-5 rounded-3xl shadow-2xl backdrop-blur-md border border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center space-x-2 text-xs">
            <span className="w-5 h-5 rounded-full bg-brand-light flex items-center justify-center text-slate-900 font-extrabold text-[10px]">
              {selectedProductIds.size}
            </span>
            <span className="font-bold text-slate-200">
              {selectedProductIds.size === 1
                ? "1 product selected"
                : `${selectedProductIds.size} products selected`}
            </span>
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-[11px] font-bold text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition cursor-pointer ml-1"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Bulk Edit button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setIsBulkEditDrawerOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl brand-gradient hover:opacity-95 text-white text-xs font-black flex items-center space-x-1.5 transition active:scale-95 cursor-pointer shadow-xs"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Bulk Edit</span>
            </button>

            {/* Move to Category button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setIsMoveModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5 text-brand-light" />
              <span>Move to category</span>
            </button>

            {/* Activate */}
            <button
              type="button"
              onClick={() => handleBulkStatusChange(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1 transition active:scale-95 cursor-pointer"
              title="Activate selected products"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Activate</span>
            </button>

            {/* Deactivate */}
            <button
              type="button"
              onClick={() => handleBulkStatusChange(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center space-x-1 transition active:scale-95 cursor-pointer"
              title="Deactivate selected products"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Deactivate</span>
            </button>

            {/* Bulk Stock */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setIsBulkStockModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-brand-light hover:bg-brand text-slate-900 text-xs font-black flex items-center space-x-1.5 transition active:scale-95 cursor-pointer shadow-xs"
            >
              <Boxes className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stock</span>
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setConfirmDeleteBulk(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center space-x-1 transition active:scale-95 cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Deselect all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile Category Drill-Down Drawer (< 1024px) ── */}
      <CategoryMobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        categoryTree={categoryTree}
        countsMap={countsMap}
        uncategorizedCounts={uncategorizedCounts}
        totalProductsCount={totalStoreProducts}
        selectedCategoryId={selectedCategoryId}
        uncategorizedOnly={uncategorizedOnly}
        onSelectCategory={handleSelectCategory}
      />

      {/* ── Category Move Modal ── */}
      <CategoryMoveModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        categoryTree={categoryTree}
        selectedProductCount={selectedProductIds.size}
        onConfirmMove={handleExecuteBulkMove}
      />

      {/* ── Single Delete Confirm Modal ── */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Delete Product?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete &quot;{confirmDeleteProduct.name}&quot;?
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteProduct(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteSingleDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Confirm Modal ── */}
      {confirmDeleteBulk && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Delete {selectedProductIds.size} Products?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                This will delete the selected products. Products referenced in active returns cannot be deleted.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteBulk(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteBulkDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete All Selected"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Stock Update Modal ── */}
      {isBulkStockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Boxes className="w-5 h-5 text-brand-dark" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Bulk Stock Update ({selectedProductIds.size} products)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkStockModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Update Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkStockMode("set")}
                    className={`py-2 rounded-xl border font-bold transition cursor-pointer ${
                      bulkStockMode === "set"
                        ? "bg-brand-light/20 border-brand-dark text-brand-dark"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    Set Exact Quantity
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkStockMode("adjust")}
                    className={`py-2 rounded-xl border font-bold transition cursor-pointer ${
                      bulkStockMode === "adjust"
                        ? "bg-brand-light/20 border-brand-dark text-brand-dark"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    Adjust Relative (+/-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  {bulkStockMode === "set" ? "New Stock Level" : "Stock Adjustment (+/-)"}
                </label>
                <input
                  type="number"
                  value={bulkStockValue}
                  onChange={(e) =>
                    setBulkStockValue(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder={bulkStockMode === "set" ? "e.g. 500" : "e.g. +50 or -20"}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={bulkStockReason}
                  onChange={(e) => setBulkStockReason(e.target.value)}
                  placeholder="Reason for adjustment"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkStockModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkStockSaving}
                onClick={handleExecuteBulkStockUpdate}
                className="px-5 py-2 rounded-xl brand-gradient text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                {isBulkStockSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update Stock</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Editor Modal ── */}
      {isEditorOpen && (
        <ProductEditor
          product={editingProduct}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingProduct(null);
          }}
          onSaved={handleEditorSaved}
        />
      )}

      {/* ── Bulk Edit Drawer ── */}
      <BulkEditDrawer
        isOpen={isBulkEditDrawerOpen}
        onClose={() => setIsBulkEditDrawerOpen(false)}
        selectedProductIds={Array.from(selectedProductIds)}
        selectedScopeLabel={selectedScopeLabel}
        categoryTree={categoryTree}
        onBulkSuccess={handleBulkSuccess}
      />

      {/* ── Bulk History Modal ── */}
      <BulkHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onUndoComplete={() => {
          loadProducts();
          loadCategoryData();
        }}
      />

      {/* ── Bulk Undo Toast ── */}
      {bulkUndoToast && bulkUndoToast.show && (
        <div className="fixed bottom-6 left-6 z-50 animate-bounce-in max-w-md">
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-3 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{bulkUndoToast.message}</span>
            {bulkUndoToast.opIds.length > 0 && (
              <button
                type="button"
                onClick={handleUndoBulkOperation}
                className="px-2.5 py-1 rounded-lg bg-brand-light text-slate-900 font-extrabold flex items-center space-x-1 cursor-pointer hover:bg-brand active:scale-95 transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setBulkUndoToast(null)}
              className="p-1 rounded-md text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
