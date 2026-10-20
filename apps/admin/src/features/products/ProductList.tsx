import { useState, useEffect, useCallback } from "react";
import type { Product } from "@urbanrat/shared";
import {
  fetchAdminProducts,
  fetchAdminCategories,
} from "../../lib/adminService";
import { ProductEditor } from "./ProductEditor";
import {
  Plus,
  Search,
  Package,
  Layers,
  AlertTriangle,
  Zap,
  Edit2,
  RefreshCw,
  Loader2,
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
              className="rounded text-brand-dark focus:ring-brand-light"
            />
            <span>Urbanrat Brand Only</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer font-bold text-slate-700">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded text-rose-500 focus:ring-rose-400"
            />
            <span className="text-rose-600">Low Stock Only</span>
          </label>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold"
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

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
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

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
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
    </div>
  );
}
