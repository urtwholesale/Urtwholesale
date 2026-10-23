import { useState, useEffect, useCallback, useMemo } from "react";
import type { Product } from "@urbanrat/shared";
import {
  fetchAdminProducts,
  fetchAdminCategories,
  deleteProduct,
  deleteProducts,
  adminBulkUpdateStock,
} from "../../lib/adminService";
import { triggerHaptic } from "../../utils/haptics";
import { ProductEditor } from "./ProductEditor";
import {
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
  AlertCircle,
  X,
} from "lucide-react";

export function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [urbanratOnly, setUrbanratOnly] = useState<boolean>(false);
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);

  // Multi-selection
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Delete Modals
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, prods] = await Promise.all([
        fetchAdminCategories(),
        fetchAdminProducts({
          search,
          categoryId: selectedCategory || undefined,
          isUrbanrat: urbanratOnly ? true : undefined,
          lowStock: lowStockOnly ? true : undefined,
        }),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err: any) {
      console.error("Failed to load admin products:", err);
      setError(err?.message || "Failed to load products from database.");
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, urbanratOnly, lowStockOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Selection helpers
  const isAllSelected = useMemo(() => {
    return products.length > 0 && selectedProductIds.size === products.length;
  }, [products.length, selectedProductIds.size]);

  function handleToggleSelectAll() {
    triggerHaptic("selection");
    if (isAllSelected) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(products.map((p) => p.id)));
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
  }

  // Single delete
  async function handleExecuteSingleDelete() {
    if (!confirmDeleteProduct) return;
    setIsDeleting(true);
    triggerHaptic("selection");
    try {
      await deleteProduct(confirmDeleteProduct.id);
      setProducts((prev) => prev.filter((p) => p.id !== confirmDeleteProduct.id));
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        next.delete(confirmDeleteProduct.id);
        return next;
      });
      setConfirmDeleteProduct(null);
      triggerHaptic("success");
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
      const deletedSet = new Set(res.deletedIds);
      setProducts((prev) => prev.filter((p) => !deletedSet.has(p.id)));
      setSelectedProductIds(new Set());
      setConfirmDeleteBulk(false);
      triggerHaptic("success");
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

  // Bulk stock update
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
      await loadData();
      alert(`Successfully updated stock for ${res.updatedCount} product(s)!`);
    } catch (err: any) {
      alert(err?.message || "Failed to bulk update stock.");
    } finally {
      setIsBulkStockSaving(false);
    }
  }

  function handleOpenNew() {
    setEditingProduct(null);
    setIsEditorOpen(true);
  }

  function handleOpenEdit(prod: Product) {
    setEditingProduct(prod);
    setIsEditorOpen(true);
  }

  function handleEditorClose() {
    setIsEditorOpen(false);
    setEditingProduct(null);
  }

  function handleEditorSaved() {
    setIsEditorOpen(false);
    setEditingProduct(null);
    loadData();
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Catalog &amp; Inventory Products
          </h2>
          <p className="text-xs text-slate-400">
            {products.length} live products loaded from Supabase
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            aria-label="Refresh catalog"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-brand-dark" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
            style={{
              background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
            }}
          >
            <Plus className="w-4 h-4" />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light"
          />
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Toggles */}
        <div className="flex items-center space-x-4 sm:col-span-2">
          <label className="flex items-center space-x-1.5 cursor-pointer font-bold text-slate-700">
            <input
              type="checkbox"
              checked={urbanratOnly}
              onChange={(e) => setUrbanratOnly(e.target.checked)}
              className="rounded text-brand-dark focus:ring-brand-light cursor-pointer"
            />
            <span>Urbanrat Brand Only</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer font-bold text-slate-700">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded text-rose-500 focus:ring-rose-400 cursor-pointer"
            />
            <span className="text-rose-600">Low Stock Only</span>
          </label>
        </div>
      </div>

      {/* ── Floating Bulk Action Toolbar ── */}
      {selectedProductIds.size > 0 && (
        <div className="bg-slate-900 text-white p-3.5 sm:px-5 rounded-2xl shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center space-x-2 text-xs">
            <span className="w-5 h-5 rounded-full bg-brand-light flex items-center justify-center text-slate-900 font-extrabold text-[10px]">
              {selectedProductIds.size}
            </span>
            <span className="font-bold text-slate-200">
              {selectedProductIds.size === 1
                ? "1 product selected"
                : `${selectedProductIds.size} products selected`}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setIsBulkStockModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-brand-light hover:bg-brand text-slate-900 text-xs font-black flex items-center space-x-1.5 transition active:scale-95 cursor-pointer shadow-xs"
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Bulk Stock Update</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setConfirmDeleteBulk(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedProductIds.size})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setSelectedProductIds(new Set());
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Deselect all"
            >
              <X className="w-4 h-4" />
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
            onClick={loadData}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Products Table ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-brand-dark" />
            <span>Loading live catalog products...</span>
          </div>
        ) : products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold bg-slate-50/50">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded text-brand-dark focus:ring-brand-light cursor-pointer"
                      title={isAllSelected ? "Deselect All" : "Select All"}
                    />
                  </th>
                  <th className="py-3 px-4">Item</th>
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

                      {/* Product Thumbnail & Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                            {p.images && p.images[0] ? (
                              <img
                                src={p.images[0]}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <p className="font-bold text-slate-900 truncate">
                              {p.name}
                            </p>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              {p.is_urbanrat_brand && (
                                <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-cyan-50 text-brand-dark border border-cyan-200">
                                  <Zap className="w-2.5 h-2.5" />
                                  <span>Urbanrat</span>
                                </span>
                              )}
                              {p.is_featured && (
                                <span className="text-[9px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded">
                                  Featured
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                        {p.sku || "—"}
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-black ${
                            p.stock === 0
                              ? "bg-rose-100 text-rose-800"
                              : isLow
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3" />}
                          <span>{p.stock} units</span>
                        </span>
                      </td>

                      {/* Starting Price */}
                      <td className="py-3 px-3 font-black text-slate-900 text-sm">
                        ₹{p.price.toLocaleString("en-IN")}
                      </td>

                      {/* Price Tiers */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          <Layers className="w-3 h-3 text-brand-dark" />
                          <span>{tiers.length} {tiers.length === 1 ? "Tier" : "Tiers"}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            p.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {p.is_active ? "Active" : "Draft"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                            title="Edit product"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic("selection");
                              setConfirmDeleteProduct(p);
                            }}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 font-bold transition cursor-pointer"
                            title="Delete this product"
                          >
                            <Trash2 className="w-3 h-3" />
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
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">
            No products match your search or filter criteria.
          </div>
        )}
      </div>

      {/* ── Editor Modal ── */}
      {isEditorOpen && (
        <ProductEditor
          product={editingProduct}
          onClose={handleEditorClose}
          onSaved={handleEditorSaved}
        />
      )}

      {/* ── Single Delete Product Confirmation Modal ── */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="font-black text-sm text-slate-900">Delete Product?</h4>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                {confirmDeleteProduct.images && confirmDeleteProduct.images[0] ? (
                  <img
                    src={confirmDeleteProduct.images[0]}
                    alt={confirmDeleteProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-xs truncate">
                  {confirmDeleteProduct.name}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {confirmDeleteProduct.sku || "No SKU"} • {confirmDeleteProduct.stock} units in stock
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete this product? It will be removed from your active catalog and inventory.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteProduct(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteSingleDelete}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Confirmation Modal ── */}
      {confirmDeleteBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="font-black text-sm text-slate-900">
                Delete {selectedProductIds.size} Selected Products?
              </h4>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete these{" "}
              <span className="font-bold text-slate-900">{selectedProductIds.size}</span> selected products?
              They will be removed from your catalog and inventory.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteBulk(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteBulkDelete}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm Delete ({selectedProductIds.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Stock Update Modal ── */}
      {isBulkStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-brand-dark">
                <div className="w-8 h-8 rounded-xl bg-brand-light/30 flex items-center justify-center text-brand-dark">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">Bulk Stock Update</h4>
                  <p className="text-[11px] text-slate-400">
                    Updating inventory for {selectedProductIds.size} selected products
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkStockModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setBulkStockMode("set")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                  bulkStockMode === "set"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Set Exact Stock
              </button>
              <button
                type="button"
                onClick={() => setBulkStockMode("adjust")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                  bulkStockMode === "adjust"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Adjust Stock (+ / -)
              </button>
            </div>

            {/* Input Value */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {bulkStockMode === "set"
                  ? "New Stock Level (Units)"
                  : "Stock Adjustment Delta (e.g. +50 or -10)"}
              </label>
              <input
                type="number"
                min={bulkStockMode === "set" ? 0 : undefined}
                step="1"
                placeholder={bulkStockMode === "set" ? "e.g. 100" : "e.g. 50 or -10"}
                value={bulkStockValue}
                onChange={(e) =>
                  setBulkStockValue(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-brand-light focus:outline-none"
              />
              <p className="text-[11px] text-slate-400">
                {bulkStockMode === "set"
                  ? "Every selected product will have its stock set exactly to this amount."
                  : "This delta will be added to (or subtracted from) each product's current stock."}
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Audit Reason / Note</label>
              <input
                type="text"
                value={bulkStockReason}
                onChange={(e) => setBulkStockReason(e.target.value)}
                placeholder="e.g. New container restock, Physical count sync"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-light focus:outline-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isBulkStockSaving}
                onClick={() => setIsBulkStockModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkStockSaving || bulkStockValue === ""}
                onClick={handleExecuteBulkStockUpdate}
                className="px-5 py-2 rounded-xl text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-md transition active:scale-95 disabled:opacity-50"
                style={{
                  background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                }}
              >
                {isBulkStockSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Update Stock for {selectedProductIds.size} Products</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
