import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { ProductCard } from "../components/ProductCard";
import { ProductGridSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import {
  fetchCategories,
  fetchProducts,
  searchProductsV2,
  logSearchClick,
} from "../services/storeService";
import type { Product, Category } from "@urbanrat/shared";
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Layers,
  X,
} from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

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
  const initialSubCat = searchParams.get("subcategory") || searchParams.get("sub") || null;
  const initialSort = (searchParams.get("sort") as "newest" | "price_asc" | "price_desc") || "newest";

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [categories, setCategories] = useState<Category[]>([]); // Parent categories
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCat);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(initialSubCat);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [searchMeta, setSearchMeta] = useState<{
    normalizedQuery: string;
    correctedQuery: string | null;
    didYouMean: string | null;
    matchType: "exact" | "fuzzy" | "related" | "popular";
    searchId?: string;
  } | null>(null);
  const [sortOption, setSortOption] = useState<"newest" | "price_asc" | "price_desc">(initialSort);
  const [priceBracketIndex, setPriceBracketIndex] = useState(0);

  const activeCategoryButtonRef = useRef<HTMLButtonElement | null>(null);

  // Smoothly center the active category card in the horizontal rail
  useEffect(() => {
    if (activeCategoryButtonRef.current) {
      activeCategoryButtonRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [selectedCategory]);

  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // Load all categories and resolve parent vs child
  useEffect(() => {
    async function loadCats() {
      try {
        const cats = await fetchCategories();
        setAllCategories(cats);
        const parents = cats.filter((c) => c.parent_id === null);
        setCategories(parents);

        // If initial category in URL was actually a subcategory slug, resolve parent
        if (initialCat && initialCat !== "all") {
          const sub = cats.find((c) => c.slug === initialCat && c.parent_id !== null);
          if (sub) {
            const parent = cats.find((p) => p.id === sub.parent_id);
            if (parent) {
              setSelectedCategory(parent.slug);
              setSelectedSubCategory(sub.slug);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load categories:", e);
      }
    }
    loadCats();
  }, []);

  // Sync category, subcategory and search query from URL params if changed externally
  useEffect(() => {
    const urlCat = searchParams.get("category") || "all";
    const urlSub = searchParams.get("subcategory") || searchParams.get("sub") || null;
    const urlQ = searchParams.get("q") || "";
    if (urlCat !== selectedCategory) {
      setSelectedCategory(urlCat);
    }
    if (urlSub !== selectedSubCategory) {
      setSelectedSubCategory(urlSub);
    }
    if (urlQ !== searchQuery) {
      setSearchQuery(urlQ);
    }
  }, [searchParams]);

  // Debounce syncing searchQuery to URL search params
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const currentQ = next.get("q") || "";
        const trimmed = searchQuery.trim();
        if (trimmed !== currentQ) {
          if (trimmed) {
            next.set("q", trimmed);
          } else {
            next.delete("q");
          }
          return next;
        }
        return prev;
      }, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, setSearchParams]);

  // Derived active parent and available subcategories
  const activeParent = categories.find((c) => c.slug === selectedCategory);
  const subCategories = activeParent
    ? allCategories.filter((c) => c.parent_id === activeParent.id)
    : allCategories.filter((c) => c.parent_id !== null);
  const activeSubCategory = allCategories.find((c) => c.slug === selectedSubCategory);

  const loadInitialProducts = async () => {
    setLoading(true);
    setError(null);
    setPage(1);
    try {
      const bracket = PRICE_BRACKETS[priceBracketIndex];
      const targetSlug = selectedSubCategory || (selectedCategory === "all" ? undefined : selectedCategory);

      if (searchQuery.trim()) {
        const res = await searchProductsV2({
          query: searchQuery.trim(),
          categorySlug: targetSlug,
          isUrbanratBrand: brandOnly ? true : undefined,
          minPrice: bracket?.min,
          maxPrice: bracket?.max,
          sort: sortOption === "newest" ? "relevance" : sortOption,
          limit: PAGE_SIZE,
          offset: 0,
        });

        setProducts(res.products);
        setTotalCount(res.total);
        setSearchMeta({
          normalizedQuery: res.normalizedQuery,
          correctedQuery: res.correctedQuery,
          didYouMean: res.didYouMean,
          matchType: res.matchType,
          searchId: res.searchId,
        });
      } else {
        setSearchMeta(null);
        const res = await fetchProducts({
          categorySlug: targetSlug,
          isUrbanratBrand: brandOnly ? true : undefined,
          search: undefined,
          sort: sortOption,
          priceMin: bracket?.min,
          priceMax: bracket?.max,
          limit: PAGE_SIZE,
          offset: 0,
        });

        setProducts(res.products);
        setTotalCount(res.total);
      }
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
  }, [selectedCategory, selectedSubCategory, searchQuery, sortOption, priceBracketIndex, brandOnly]);

  // Load more (pagination / infinite scroll button)
  async function handleLoadMore() {
    if (loadingMore || products.length >= totalCount) return;
    setLoadingMore(true);

    try {
      const bracket = PRICE_BRACKETS[priceBracketIndex];
      const nextPage = page + 1;
      const targetSlug = selectedSubCategory || (selectedCategory === "all" ? undefined : selectedCategory);

      if (searchQuery.trim()) {
        const res = await searchProductsV2({
          query: searchQuery.trim(),
          categorySlug: targetSlug,
          isUrbanratBrand: brandOnly ? true : undefined,
          minPrice: bracket?.min,
          maxPrice: bracket?.max,
          sort: sortOption === "newest" ? "relevance" : sortOption,
          limit: PAGE_SIZE,
          offset: products.length,
        });
        setProducts((prev) => [...prev, ...res.products]);
      } else {
        const res = await fetchProducts({
          categorySlug: targetSlug,
          isUrbanratBrand: brandOnly ? true : undefined,
          sort: sortOption,
          priceMin: bracket?.min,
          priceMax: bracket?.max,
          limit: PAGE_SIZE,
          offset: products.length,
        });
        setProducts((prev) => [...prev, ...res.products]);
      }
      setPage(nextPage);
    } catch (err) {
      console.error("Failed to load more products:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleCategoryChange(slug: string) {
    triggerHaptic("selection");
    setSelectedCategory(slug);
    setSelectedSubCategory(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (slug === "all") {
        next.delete("category");
        next.delete("subcategory");
        next.delete("sub");
      } else {
        next.set("category", slug);
        next.delete("subcategory");
        next.delete("sub");
      }
      return next;
    });
  }

  function handleSubCategoryChange(subSlug: string | null) {
    triggerHaptic("selection");
    setSelectedSubCategory(subSlug);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!subSlug) {
        next.delete("subcategory");
        next.delete("sub");
      } else {
        next.set("subcategory", subSlug);
      }
      return next;
    });
  }

  function handleResetFilters() {
    triggerHaptic("selection");
    setSelectedCategory("all");
    setSelectedSubCategory(null);
    setSearchQuery("");
    setSearchMeta(null);
    setSortOption("newest");
    setPriceBracketIndex(0);
    setSearchParams(new URLSearchParams());
  }

  const activeFilterCount =
    (selectedSubCategory ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (sortOption !== "newest" ? 1 : 0) +
    (priceBracketIndex !== 0 ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  // Reusable vertical rectangular category cards rail
  const categoryChips = (
    <div className="flex items-center space-x-2.5 sm:space-x-3.5 overflow-x-auto scrollbar-none no-scrollbar py-1 px-0.5">
      {/* "All Products" Vertical Card */}
      <button
        ref={selectedCategory === "all" ? activeCategoryButtonRef : null}
        type="button"
        onClick={() => handleCategoryChange("all")}
        className={`group relative shrink-0 w-24 sm:w-28 md:w-32 h-28 sm:h-34 rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all select-none text-left ${
          selectedCategory === "all"
            ? "ring-2 ring-orange-500 shadow-[0_0_16px_rgba(249,115,22,0.4)] border-transparent"
            : "border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25 hover:shadow-md opacity-85 hover:opacity-100"
        }`}
      >
        {/* Full-Bleed Catalog Image */}
        <img
          src="/hero-accessories.jpg"
          alt="All Products"
          className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          decoding="async"
        />

        {/* Ambient Dark Gradient Vignette for Text Contrast */}
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/10 pointer-events-none" />

        {/* Active Glowing Highlight Bar at Top */}
        {selectedCategory === "all" && (
          <div
            className="absolute top-2 left-2 right-2 h-1 rounded-full z-10 shadow-xs"
            style={{ background: "var(--brand-gradient)" }}
          />
        )}

        {/* Category Title Inside the Card at the Bottom */}
        <div className="absolute bottom-2 left-2 right-2 z-10">
          <Layers className="w-3.5 h-3.5 text-orange-400 mb-1 drop-shadow-sm" />
          <span className="text-[11px] sm:text-xs font-black text-white leading-tight drop-shadow-md line-clamp-2 block">
            All Products
          </span>
        </div>
      </button>

      {/* Parent Category Cards */}
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.slug;
        return (
          <button
            key={cat.id}
            ref={isSelected ? activeCategoryButtonRef : null}
            type="button"
            onClick={() => handleCategoryChange(cat.slug)}
            className={`group relative shrink-0 w-24 sm:w-28 md:w-32 h-28 sm:h-34 rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all select-none text-left ${
              isSelected
                ? "ring-2 ring-orange-500 shadow-[0_0_16px_rgba(249,115,22,0.4)] border-transparent"
                : "border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25 hover:shadow-md opacity-85 hover:opacity-100"
            }`}
          >
            {/* Category Full-Bleed Image */}
            <img
              src={cat.image_url || "/hero-accessories.jpg"}
              alt={cat.name}
              className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              decoding="async"
            />

            {/* Ambient Dark Gradient Vignette */}
            <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-black/5 pointer-events-none" />

            {/* Active Glowing Highlight Bar at Top */}
            {isSelected && (
              <div
                className="absolute top-2 left-2 right-2 h-1 rounded-full z-10 shadow-xs"
                style={{ background: "var(--brand-gradient)" }}
              />
            )}

            {/* Category Title Inside the Card at the Bottom */}
            <div className="absolute bottom-2 left-2 right-2 z-10">
              <span className="text-[11px] sm:text-xs font-black text-white leading-tight drop-shadow-md line-clamp-2 block">
                {cat.name}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-12">
      {/* ── Category & Subcategory Filter Rail (Sticky) ── */}
      <div className="sticky top-16 md:top-28 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 py-2.5 sm:py-3 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/80 shadow-[0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] space-y-2 transition-colors">
        {/* Row 1: Parent Category Vertical Cards */}
        {categoryChips}

        {/* Row 2: Subcategories (Dedicated strip for easy access) */}
        {subCategories.length > 0 && (
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none no-scrollbar pt-1.5 border-t border-slate-200/60 dark:border-slate-800 animate-in fade-in slide-in-from-top-1 duration-200">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 mr-1 flex items-center space-x-1">
              <Layers className="w-3.5 h-3.5 text-brand-dark dark:text-brand-light" />
              <span className="hidden sm:inline">Subcategories:</span>
            </span>

            {/* "All in Category" pill */}
            <button
              type="button"
              onClick={() => handleSubCategoryChange(null)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition active:scale-95 cursor-pointer ${
                selectedSubCategory === null
                  ? "text-white shadow-xs font-black"
                  : "bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-200/70 dark:hover:bg-slate-700"
              }`}
              style={
                selectedSubCategory === null
                  ? {
                      background: "var(--brand-gradient)",
                      boxShadow: "var(--brand-shadow)",
                    }
                  : {}
              }
            >
              All {activeParent ? activeParent.name : "Subcategories"}
            </button>

            {/* Subcategory individual pills */}
            {subCategories.map((sub) => {
              const isSelected = selectedSubCategory === sub.slug;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    if (selectedCategory === "all" && sub.parent_id) {
                      const p = allCategories.find((c) => c.id === sub.parent_id);
                      if (p) setSelectedCategory(p.slug);
                    }
                    handleSubCategoryChange(sub.slug);
                  }}
                  className={`shrink-0 inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[11px] font-semibold transition active:scale-95 cursor-pointer ${
                    isSelected
                      ? "text-white shadow-xs font-black"
                      : "bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-200/70 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                  style={
                    isSelected
                      ? { background: "var(--brand-gradient)" }
                      : {}
                  }
                >
                  {sub.image_url && (
                    <img
                      src={sub.image_url}
                      alt=""
                      className="w-3 h-3 rounded-full object-cover shrink-0"
                    />
                  )}
                  <span>{sub.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <span>{brandOnly ? "Urbanrat Original Collection" : "Marketplace"}</span>
            {brandOnly && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-light/20 dark:bg-orange-500/20 text-brand-dark dark:text-brand-light">
                Official
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {brandOnly
              ? "Signature high-spec mobile electronics engineered by Urbanrat"
              : activeSubCategory
              ? `Filtered by subcategory: ${activeSubCategory.name}`
              : activeParent
              ? `Browsing ${activeParent.name} & subcategories`
              : "Direct factory inventory of accessories & components"}
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Showing <span className="font-bold text-slate-900 dark:text-white">{products.length}</span> of{" "}
          <span className="font-bold text-slate-900 dark:text-white">{totalCount}</span> items
        </div>
      </div>

      {/* ── Desktop Search Bar & Filter Controls (Includes Subcategory Dropdown) ── */}
      <div className="hidden md:grid md:grid-cols-12 gap-2.5">
        {/* Search (5 cols) */}
        <div className="col-span-5 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by model, specs or SKU..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-brand-dark dark:focus:border-brand-light shadow-2xs transition"
          />
        </div>

        {/* Subcategory Dropdown (3 cols) */}
        <div className="col-span-3 relative">
          <div className="relative">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={selectedSubCategory || "all"}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "all") {
                  handleSubCategoryChange(null);
                } else {
                  const sub = allCategories.find((c) => c.slug === val);
                  if (sub && sub.parent_id) {
                    const parent = allCategories.find((p) => p.id === sub.parent_id);
                    if (parent && selectedCategory !== parent.slug) {
                      setSelectedCategory(parent.slug);
                    }
                  }
                  handleSubCategoryChange(val);
                }
              }}
              aria-label="Filter by subcategory"
              className="w-full pl-8 pr-8 py-2.5 text-xs bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl focus:outline-none focus:border-brand-dark dark:focus:border-brand-light shadow-2xs appearance-none font-semibold cursor-pointer truncate"
            >
              <option value="all">
                {selectedCategory === "all"
                  ? "All Subcategories"
                  : `All ${activeParent?.name || "Subcategories"}`}
              </option>

              {selectedCategory !== "all" && activeParent ? (
                subCategories.map((sub) => (
                  <option key={sub.id} value={sub.slug}>
                    {sub.name}
                  </option>
                ))
              ) : (
                categories.map((parent) => {
                  const children = allCategories.filter((c) => c.parent_id === parent.id);
                  if (children.length === 0) return null;
                  return (
                    <optgroup key={parent.id} label={parent.name}>
                      {children.map((sub) => (
                        <option key={sub.id} value={sub.slug}>
                          {sub.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })
              )}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Sort Dropdown (2 cols) */}
        <div className="col-span-2 relative">
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={sortOption}
              onChange={(e) =>
                setSortOption(e.target.value as "newest" | "price_asc" | "price_desc")
              }
              aria-label="Sort products"
              className="w-full pl-8 pr-8 py-2.5 text-xs bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl focus:outline-none focus:border-brand-dark dark:focus:border-brand-light shadow-2xs appearance-none font-semibold cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low</option>
              <option value="price_desc">Price: High</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Price Bracket Dropdown (2 cols) */}
        <div className="col-span-2 relative">
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={priceBracketIndex}
              onChange={(e) => setPriceBracketIndex(Number(e.target.value))}
              aria-label="Filter by price range"
              className="w-full pl-8 pr-8 py-2.5 text-xs bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl focus:outline-none focus:border-brand-dark dark:focus:border-brand-light shadow-2xs appearance-none font-semibold cursor-pointer"
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
        selectedSubCategory ||
        searchQuery ||
        priceBracketIndex > 0 ||
        sortOption !== "newest") && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 bg-white px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="font-bold text-slate-700 text-[11px]">Filters active:</span>

            {selectedCategory !== "all" && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-semibold text-[11px]">
                <span>Category: {activeParent?.name || selectedCategory}</span>
                <button
                  type="button"
                  onClick={() => handleCategoryChange("all")}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer ml-0.5"
                  title="Clear category"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedSubCategory && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-brand-light/15 text-brand-dark font-bold text-[11px] border border-brand-light/30">
                <Layers className="w-3 h-3 text-brand-dark" />
                <span>
                  Subcategory: {activeSubCategory?.name || selectedSubCategory}
                </span>
                <button
                  type="button"
                  onClick={() => handleSubCategoryChange(null)}
                  className="text-brand-dark hover:text-[#065A75] cursor-pointer ml-0.5"
                  title="Clear subcategory"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {priceBracketIndex > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                {PRICE_BRACKETS[priceBracketIndex]?.label}
              </span>
            )}

            {searchQuery && (
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px] truncate max-w-35">
                "{searchQuery}"
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center space-x-1 text-rose-600 hover:text-rose-700 font-bold text-xs cursor-pointer active:scale-95 transition shrink-0 ml-auto"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        </div>
      )}

      {/* ── Typo & Recommendation Banners ── */}
      {searchQuery.trim() && searchMeta && (
        <div className="space-y-2 animate-in fade-in duration-200">
          {/* Typo Correction Banner */}
          {searchMeta.correctedQuery &&
            searchMeta.correctedQuery.toLowerCase() !== searchQuery.toLowerCase().trim() && (
              <div className="p-3 sm:p-3.5 bg-brand-light/10 border border-brand-light/30 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2 text-slate-800">
                  <Sparkles className="w-4 h-4 text-brand-dark shrink-0" />
                  <span>
                    Showing results for{" "}
                    <span className="font-extrabold text-brand-dark">
                      "{searchMeta.correctedQuery}"
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(searchQuery);
                    triggerHaptic("selection");
                  }}
                  className="text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                >
                  Search instead for "{searchQuery}"
                </button>
              </div>
            )}

          {/* Related Products Fallback Banner */}
          {searchMeta.matchType === "related" && (
            <div className="p-3 sm:p-3.5 bg-amber-50/90 border border-amber-200/70 rounded-2xl flex items-center space-x-2 text-xs text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                No exact match for <span className="font-bold">"{searchQuery}"</span>. You may also like:
              </span>
            </div>
          )}

          {/* Popular Right Now Fallback Banner */}
          {searchMeta.matchType === "popular" && (
            <div className="p-3 sm:p-3.5 bg-slate-100/90 border border-slate-200/80 rounded-2xl flex items-center space-x-2 text-xs text-slate-700">
              <Sparkles className="w-4 h-4 text-brand-dark shrink-0" />
              <span className="font-bold">Popular right now</span>
            </div>
          )}
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
                onClick={(p) => logSearchClick(searchMeta?.searchId, p.id)}
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
          icon={<Sparkles className="w-8 h-8 text-brand-dark" />}
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
          <SlidersHorizontal className="w-4 h-4 stroke-[2.2] text-brand-light" />
          <span className="text-xs font-bold tracking-wide">Filter</span>
          {activeFilterCount > 0 && (
            <span
              className="min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-black text-slate-950 flex items-center justify-center shadow-xs"
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
                  className="w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-brand-dark transition"
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

            {/* 2. Subcategories Filter (Mobile Drawer) */}
            {subCategories.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-brand-dark" />
                    <span>Subcategories ({activeParent ? activeParent.name : "All"})</span>
                  </label>
                  {selectedSubCategory && (
                    <button
                      type="button"
                      onClick={() => handleSubCategoryChange(null)}
                      className="text-[11px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto no-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => handleSubCategoryChange(null)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedSubCategory === null
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    All {activeParent ? activeParent.name : "Subcategories"}
                  </button>
                  {subCategories.map((sub) => {
                    const isSelected = selectedSubCategory === sub.slug;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          if (selectedCategory === "all" && sub.parent_id) {
                            const p = allCategories.find((c) => c.id === sub.parent_id);
                            if (p) setSelectedCategory(p.slug);
                          }
                          handleSubCategoryChange(sub.slug);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? "text-white shadow-xs font-black"
                            : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                        }`}
                        style={
                          isSelected
                            ? { background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)" }
                            : {}
                        }
                      >
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Sort Options */}
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
