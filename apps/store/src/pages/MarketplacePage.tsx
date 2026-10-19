import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { ProductCard } from "../components/ProductCard";
import { ProductGridSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { fetchCategories, fetchProducts } from "../services/storeService";
import type { Product, Category } from "@urbanrat/shared";
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
  ChevronDown,
  X,
} from "lucide-react";

interface MarketplacePageProps {
  onAddToCart: (product: Product) => void;
  brandOnly?: boolean;
  cartCount?: number;
}

const PRICE_BRACKETS = [
  { label: "All Prices", min: undefined, max: undefined },
  { label: "Under ₹299", min: 0, max: 299 },
  { label: "₹299 - ₹499", min: 299, max: 499 },
  { label: "₹500 - ₹999", min: 500, max: 999 },
  { label: "₹1,000+", min: 1000, max: undefined },
];

export function MarketplacePage({
  onAddToCart,
  brandOnly = false,
}: MarketplacePageProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const initialCat = searchParams.get("category") || "all";
  const initialSort = (searchParams.get("sort") as "newest" | "price_asc" | "price_desc") || "newest";

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCat);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [sortOption, setSortOption] = useState<"newest" | "price_asc" | "price_desc">(initialSort);
  const [priceBracketIndex, setPriceBracketIndex] = useState(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // Load categories
  useEffect(() => {
    async function loadCats() {
      try {
        const cats = await fetchCategories();
        // Show main parent categories in top sticky chip bar
        setCategories(cats.filter((c) => c.parent_id === null));
      } catch (e) {
        console.error("Failed to load categories:", e);
      }
    }
    loadCats();
  }, []);

  // Sync category from URL param if changed externally
  useEffect(() => {
    const urlCat = searchParams.get("category");
    if (urlCat && urlCat !== selectedCategory) {
      setSelectedCategory(urlCat);
    }
  }, [searchParams]);

  const loadInitialProducts = async () => {
    setLoading(true);
    setError(null);
    setPage(1);
    try {
      const bracket = PRICE_BRACKETS[priceBracketIndex];
      const res = await fetchProducts({
        categorySlug: selectedCategory === "all" ? undefined : selectedCategory,
        isUrbanratBrand: brandOnly ? true : undefined,
        search: searchQuery,
        sort: sortOption,
        priceMin: bracket?.min,
        priceMax: bracket?.max,
        limit: PAGE_SIZE,
        offset: 0,
      });

      setProducts(res.products);
      setTotalCount(res.total);
    } catch (err: any) {
      console.error("Failed to load products:", err);
      setError(err?.message || "Failed to load products. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Load products whenever filters change
  useEffect(() => {
    loadInitialProducts();
  }, [selectedCategory, searchQuery, sortOption, priceBracketIndex, brandOnly]);

  // Load more (pagination / infinite scroll button)
  async function handleLoadMore() {
    if (loadingMore || products.length >= totalCount) return;
    setLoadingMore(true);

    try {
      const bracket = PRICE_BRACKETS[priceBracketIndex];
      const nextPage = page + 1;
      const res = await fetchProducts({
        categorySlug: selectedCategory === "all" ? undefined : selectedCategory,
        isUrbanratBrand: brandOnly ? true : undefined,
        search: searchQuery,
        sort: sortOption,
        priceMin: bracket?.min,
        priceMax: bracket?.max,
        limit: PAGE_SIZE,
        offset: products.length,
      });

      setProducts((prev) => [...prev, ...res.products]);
      setPage(nextPage);
    } catch (err) {
      console.error("Failed to load more products:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleCategoryChange(slug: string) {
    setSelectedCategory(slug);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (slug === "all") next.delete("category");
      else next.set("category", slug);
      return next;
    });
  }

  function handleResetFilters() {
    setSelectedCategory("all");
    setSearchQuery("");
    setSortOption("newest");
    setPriceBracketIndex(0);
    setSearchParams(new URLSearchParams());
  }

  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    (sortOption !== "newest" ? 1 : 0) +
    (priceBracketIndex !== 0 ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  // Reusable category chips strip
  const categoryChips = (
    <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none no-scrollbar">
      <button
        type="button"
        onClick={() => handleCategoryChange("all")}
        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer ${
          selectedCategory === "all"
            ? "text-white shadow-xs"
            : "bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50"
        }`}
        style={
          selectedCategory === "all"
            ? { background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)" }
            : {}
        }
      >
        All Products
      </button>

      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.slug;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryChange(cat.slug)}
            className={`shrink-0 inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition active:scale-95 cursor-pointer ${
              isSelected
                ? "text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50 hover:border-slate-300"
            }`}
            style={
              isSelected
                ? { background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)" }
                : {}
            }
          >
            {cat.image_url && (
              <img
                src={cat.image_url}
                alt=""
                className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
              />
            )}
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-12">
      {/* ── Category Filter Chips Strip (Mobile & Desktop) ── */}
      <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 py-2 bg-[#F8F9FB]/90 backdrop-blur-md border-b border-slate-200/60 shadow-2xs">
        {categoryChips}
      </div>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>{brandOnly ? "Urbanrat Original Collection" : "Marketplace"}</span>
            {brandOnly && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#5ADBE5]/20 text-[#0A82A8]">
                Official
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {brandOnly
              ? "Signature high-spec mobile electronics engineered by Urbanrat"
              : "Direct factory inventory of accessories & components"}
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <span className="font-bold text-slate-900">{products.length}</span> of{" "}
          <span className="font-bold text-slate-900">{totalCount}</span> items
        </div>
      </div>

      {/* ── Desktop Search Bar & Filter Controls (Hidden on mobile per user request) ── */}
      <div className="hidden md:grid md:grid-cols-12 gap-2.5">
        {/* Search */}
        <div className="col-span-6 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by model, specs or SKU..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-[#0A82A8] shadow-2xs transition"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="col-span-3 relative">
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={sortOption}
              onChange={(e) =>
                setSortOption(e.target.value as "newest" | "price_asc" | "price_desc")
              }
              aria-label="Sort products"
              className="w-full pl-8 pr-8 py-2.5 text-xs bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-[#0A82A8] shadow-2xs appearance-none font-semibold text-slate-700 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Price Bracket Dropdown */}
        <div className="col-span-3 relative">
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={priceBracketIndex}
              onChange={(e) => setPriceBracketIndex(Number(e.target.value))}
              aria-label="Filter by price range"
              className="w-full pl-8 pr-8 py-2.5 text-xs bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-[#0A82A8] shadow-2xs appearance-none font-semibold text-slate-700 cursor-pointer"
            >
              {PRICE_BRACKETS.map((b, idx) => (
                <option key={idx} value={idx}>
                  {b.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Active Filters Bar (if active) ── */}
      {(selectedCategory !== "all" ||
        searchQuery ||
        priceBracketIndex > 0 ||
        sortOption !== "newest") && (
        <div className="flex items-center justify-between text-xs text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700">Filters active:</span>
            {selectedCategory !== "all" && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                Category: {selectedCategory}
              </span>
            )}
            {priceBracketIndex > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                {PRICE_BRACKETS[priceBracketIndex]?.label}
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium truncate max-w-[120px]">
                "{searchQuery}"
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center space-x-1 text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* ── 2-Column Mobile, 3-4 Tablet, 5-6 Desktop Grid ── */}
      {loading ? (
        <ProductGridSkeleton count={8} />
      ) : error ? (
        <ErrorState
          title="Failed to load products"
          message={error}
          onRetry={loadInitialProducts}
        />
      ) : products.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>

          {/* Load More Pagination */}
          {products.length < totalCount && (
            <div className="text-center pt-4">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-800 shadow-xs hover:bg-slate-50 active:scale-95 disabled:opacity-50 transition cursor-pointer"
              >
                {loadingMore ? "Loading more products..." : "Load More Products"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<Sparkles className="w-8 h-8 text-[#0A82A8]" />}
          title="No products match your filters"
          description="Try broadening your search keywords or resetting price and category filters."
          actionText="Reset All Filters"
          onAction={handleResetFilters}
        />
      )}

      {/* ── Mobile Floating Filter Button (Bottom Right above bottom menu) ── */}
      <div className="fixed right-4 bottom-22 sm:bottom-24 z-30 md:hidden animate-in fade-in zoom-in-95">
        <button
          type="button"
          onClick={() => setFilterDrawerOpen(true)}
          aria-label="Search and filter products"
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 active:scale-95 transition-all cursor-pointer border border-slate-700/60"
        >
          <SlidersHorizontal className="w-4 h-4 stroke-[2.2] text-[#5ADBE5]" />
          <span className="text-xs font-bold tracking-wide">Filter</span>
          {activeFilterCount > 0 && (
            <span
              className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black text-slate-950 flex items-center justify-center shadow-xs"
              style={{
                background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Mobile Slide-up Search & Filter Drawer ── */}
      {filterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-xs animate-in fade-in duration-200 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            onClick={() => setFilterDrawerOpen(false)}
          />

          {/* Drawer Card */}
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Search &amp; Filters
                </h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  {totalCount} products matching
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600 transition cursor-pointer px-2 py-1"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFilterDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 1. Search Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Search</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Model, specs, or SKU..."
                  className="w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#0A82A8] transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Sort Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Sort By</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "newest", label: "Newest" },
                  { id: "price_asc", label: "Price ↑" },
                  { id: "price_desc", label: "Price ↓" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSortOption(s.id as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                      sortOption === s.id
                        ? "text-white shadow-xs"
                        : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                    style={
                      sortOption === s.id
                        ? { background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)" }
                        : {}
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Price Bracket */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Price Range</label>
              <div className="flex flex-wrap gap-2">
                {PRICE_BRACKETS.map((b, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPriceBracketIndex(idx)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      priceBracketIndex === idx
                        ? "text-white shadow-xs"
                        : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                    style={
                      priceBracketIndex === idx
                        ? { background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)" }
                        : {}
                    }
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(false)}
                className="w-full py-3 rounded-2xl text-white font-black text-xs tracking-wide shadow-md transition active:scale-98 cursor-pointer"
                style={{
                  background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                }}
              >
                Show {totalCount} Products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
