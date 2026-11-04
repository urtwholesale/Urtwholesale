import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router";
import { ProductCard } from "../components/ProductCard";
import { ProductGridSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import {
  fetchCategories,
  fetchActiveProductCategoryIds,
  fetchProducts,
  searchProductsV2,
  logSearchClick,
} from "../services/storeService";
import type { Product, Category } from "@urbanrat/shared";
import { filterCategoriesByActiveProductCategoryIds } from "@urbanrat/shared";
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Layers,
  X,
  Loader2,
} from "lucide-react";
import { triggerHaptic } from "../utils/haptics";
import { getCategoryThemeImage } from "../utils/categoryTheme";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { translateCategoryName } from "../locales/categoryTranslations";

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
  const { isDark } = useTheme();
  const { isHindi, t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const initialCat = searchParams.get("category") || "all";
  const initialSubCat = searchParams.get("subcategory") || searchParams.get("sub") || null;
  const initialSort = (searchParams.get("sort") as "featured" | "newest" | "price_asc" | "price_desc") || "featured";
  const initialBestseller = searchParams.get("bestseller") === "1" || searchParams.get("is_featured") === "true";

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [categories, setCategories] = useState<Category[]>([]); // Parent categories
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCat);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(initialSubCat);
  const [bestsellerOnly, setBestsellerOnly] = useState<boolean>(initialBestseller);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [searchMeta, setSearchMeta] = useState<{
    normalizedQuery: string;
    correctedQuery: string | null;
    didYouMean: string | null;
    matchType: "exact" | "fuzzy" | "related" | "popular";
    searchId?: string;
  } | null>(null);
  const [sortOption, setSortOption] = useState<"featured" | "newest" | "price_asc" | "price_desc">(initialSort);
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

        let displayCats = cats;
        if (brandOnly) {
          const activeCatIds = await fetchActiveProductCategoryIds(true);
          displayCats = filterCategoriesByActiveProductCategoryIds(cats, activeCatIds);
        }

        setAllCategories(displayCats);
        const parents = displayCats.filter((c) => c.parent_id === null);
        setCategories(parents);

        // If initial category in URL was actually a subcategory slug, resolve parent
        if (initialCat && initialCat !== "all") {
          const sub = displayCats.find((c) => c.slug === initialCat && c.parent_id !== null);
          if (sub) {
            const parent = displayCats.find((p) => p.id === sub.parent_id);
            if (parent) {
              setSelectedCategory(parent.slug);
              setSelectedSubCategory(sub.slug);
            }
          } else {
            const parent = parents.find((p) => p.slug === initialCat);
            if (!parent && brandOnly) {
              setSelectedCategory("all");
              setSelectedSubCategory(null);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("category");
                next.delete("subcategory");
                next.delete("sub");
                return next;
              }, { replace: true });
            }
          }
        }
      } catch (e) {
        console.error("Failed to load categories:", e);
      }
    }
    loadCats();
  }, [brandOnly]);

  // Sync category, subcategory and search query from URL params if changed externally
  useEffect(() => {
    const urlCat = searchParams.get("category") || "all";
    const urlSub = searchParams.get("subcategory") || searchParams.get("sub") || null;
    const urlQ = searchParams.get("q") || "";

    let targetCat = urlCat;
    let targetSub = urlSub;

    // In brand-only mode, protect against URLs pointing to categories without uploaded products
    if (brandOnly && allCategories.length > 0) {
      if (urlCat !== "all" && !allCategories.some((c) => c.slug === urlCat)) {
        targetCat = "all";
        targetSub = null;
      }
      if (targetSub && !allCategories.some((c) => c.slug === targetSub)) {
        targetSub = null;
      }
    }

    if (targetCat !== selectedCategory) {
      setSelectedCategory(targetCat);
    }
    if (targetSub !== selectedSubCategory) {
      setSelectedSubCategory(targetSub);
    }
    if (urlQ !== searchQuery) {
      setSearchQuery(urlQ);
    }
  }, [searchParams, brandOnly, allCategories]);

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
          sort: sortOption === "newest" ? "newest" : sortOption === "featured" ? "relevance" : sortOption,
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
          isFeatured: bestsellerOnly ? true : undefined,
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
  }, [selectedCategory, selectedSubCategory, searchQuery, sortOption, priceBracketIndex, brandOnly, bestsellerOnly]);

  // Infinite scroll auto-loader
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || products.length >= totalCount || loading) return;
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
          sort: sortOption === "newest" ? "newest" : sortOption === "featured" ? "relevance" : sortOption,
          limit: PAGE_SIZE,
          offset: products.length,
        });
        setProducts((prev) => [...prev, ...res.products]);
      } else {
        const res = await fetchProducts({
          categorySlug: targetSlug,
          isUrbanratBrand: brandOnly ? true : undefined,
          isFeatured: bestsellerOnly ? true : undefined,
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
  }, [loadingMore, products.length, totalCount, loading, priceBracketIndex, page, selectedSubCategory, selectedCategory, searchQuery, brandOnly, sortOption]);

  // Sentinel ref for infinite scroll
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore();
        }
      },
      {
        root: null,
        rootMargin: "350px", // Trigger 350px before reaching the bottom for seamless auto-loading
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [handleLoadMore]);

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
    setBestsellerOnly(false);
    setSearchQuery("");
    setSearchMeta(null);
    setSortOption("featured");
    setPriceBracketIndex(0);
    setSearchParams(new URLSearchParams());
  }

  const activeFilterCount =
    (bestsellerOnly ? 1 : 0) +
    (selectedSubCategory ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (sortOption !== "featured" ? 1 : 0) +
    (priceBracketIndex !== 0 ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  // Reusable category rail with boAt-style clean transparent floating cutouts and large visibility
  const categoryChips = (
    <div className="flex items-start space-x-4 sm:space-x-6 overflow-x-auto scrollbar-none no-scrollbar py-2 px-1">
      {/* "All Products" Card */}
      <button
        ref={selectedCategory === "all" ? activeCategoryButtonRef : null}
        type="button"
        onClick={() => handleCategoryChange("all")}
        className="group flex flex-col items-center shrink-0 w-22 sm:w-26 md:w-28 text-center cursor-pointer select-none"
      >
        <div
          className={`relative w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
            selectedCategory === "all"
              ? "scale-105 drop-shadow-[0_4px_12px_rgba(10,130,168,0.35)] dark:drop-shadow-[0_4px_12px_rgba(249,115,22,0.45)]"
              : "drop-shadow-xs group-hover:drop-shadow-md"
          }`}
        >
          <img
            src={getCategoryThemeImage("all", isDark)}
            alt={t("footer.all_products", "All Products")}
            className="w-full h-full object-contain transition-all duration-300"
            loading="lazy"
            decoding="async"
          />
        </div>

        <span
          className={`mt-2 text-xs sm:text-[13px] md:text-sm font-extrabold leading-snug line-clamp-2 max-w-22 sm:max-w-26 md:max-w-28 transition-colors ${
            selectedCategory === "all"
              ? "text-brand-dark dark:text-orange-400 font-black"
              : "text-slate-800 dark:text-slate-200 group-hover:text-brand-dark dark:group-hover:text-brand-light"
          }`}
        >
          {t("footer.all_products", "All Products")}
        </span>

        {selectedCategory === "all" && (
          <div
            className="w-8 h-1 rounded-full mt-1.5 bg-primary shadow-xs"
          />
        )}
      </button>

      {/* Parent Category Cards */}
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.slug;
        const displayName = translateCategoryName(cat.name, isHindi);
        return (
          <button
            key={cat.id}
            ref={isSelected ? activeCategoryButtonRef : null}
            type="button"
            onClick={() => handleCategoryChange(cat.slug)}
            className="group flex flex-col items-center shrink-0 w-22 sm:w-26 md:w-28 text-center cursor-pointer select-none"
          >
            <div
              className={`relative w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                isSelected
                  ? "scale-105 drop-shadow-[0_4px_12px_rgba(10,130,168,0.35)] dark:drop-shadow-[0_4px_12px_rgba(249,115,22,0.45)]"
                  : "drop-shadow-xs group-hover:drop-shadow-md"
              }`}
            >
              <img
                src={getCategoryThemeImage(cat, isDark)}
                alt={displayName}
                className="w-full h-full object-contain transition-all duration-300"
                loading="lazy"
                decoding="async"
              />
            </div>

            <span
              className={`mt-2 text-xs sm:text-[13px] md:text-sm font-extrabold leading-snug line-clamp-2 max-w-22 sm:max-w-26 md:max-w-28 transition-colors ${
                isSelected
                  ? "text-brand-dark dark:text-orange-400 font-black"
                  : "text-slate-800 dark:text-slate-200 group-hover:text-brand-dark dark:group-hover:text-brand-light"
              }`}
            >
              {displayName}
            </span>

            {isSelected && (
              <div
                className="w-8 h-1 rounded-full mt-1.5 shadow-xs bg-primary"
              />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-12">
      {/* ── Category & Subcategory Filter Console (Symmetric Container, Aligned with Page Grid) ── */}
      <div className="w-full rounded-2xl sm:rounded-3xl bg-white/85 dark:bg-slate-900/65 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-2.5 sm:p-3.5 shadow-xs transition-colors">
        <div className="w-full space-y-2">
          {/* Row 1: Parent Category Vertical Cards */}
          {categoryChips}

          {/* Row 2: Subcategories (Dedicated strip for easy access) */}
          {subCategories.length > 0 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none no-scrollbar pt-1.5 border-t border-slate-200/60 dark:border-slate-800 animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 mr-1 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-brand-dark dark:text-brand-light" />
                <span className="hidden sm:inline">{t("marketplace.subcategories", "Subcategories:")}</span>
              </span>

              {/* "All in Category" pill */}
              <button
                type="button"
                onClick={() => handleSubCategoryChange(null)}
                className={`shrink-0 px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer shadow-xs ${
                  selectedSubCategory === null
                    ? "bg-primary text-on-primary"
                    : "bg-transparent border border-surface-border text-slate-700 dark:text-slate-200 hover:bg-surface-card-subtle font-medium"
                }`}
              >
                {activeParent
                  ? `${t("marketplace.all_in_category", "All in Category")} (${translateCategoryName(activeParent.name, isHindi)})`
                  : t("marketplace.all_subcategories", "All Subcategories")}
              </button>

              {/* Subcategory individual pills */}
              {subCategories.map((sub) => {
                const isSelected = selectedSubCategory === sub.slug;
                const subDisplayName = translateCategoryName(sub.name, isHindi);
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
                    className={`shrink-0 inline-flex items-center space-x-1 px-3 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer shadow-xs ${
                      isSelected
                        ? "bg-primary text-on-primary"
                        : "bg-transparent border border-surface-border text-slate-700 dark:text-slate-200 hover:bg-surface-card-subtle font-medium"
                    }`}
                  >
                    {sub.image_url && (
                      <img
                        src={sub.image_url}
                        alt=""
                        className="w-3 h-3 rounded-full object-cover shrink-0"
                      />
                    )}
                    <span>{subDisplayName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <span>
              {brandOnly
                ? t("marketplace.urbanrat_title", "Urbanrat Original Collection")
                : t("marketplace.title", "Marketplace")}
            </span>
            {brandOnly && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-light/20 dark:bg-orange-500/20 text-brand-dark dark:text-brand-light">
                Official
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {brandOnly
              ? t("marketplace.urbanrat_sub", "Signature high-spec mobile electronics engineered by Urbanrat")
              : activeSubCategory
              ? `${t("marketplace.subcategories", "Subcategories:")} ${translateCategoryName(activeSubCategory.name, isHindi)}`
              : activeParent
              ? `${translateCategoryName(activeParent.name, isHindi)}`
              : t("marketplace.sub", "Direct factory inventory of accessories & components")}
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {t("marketplace.showing", "Showing")}{" "}
          <span className="font-bold text-slate-900 dark:text-white">{products.length}</span>{" "}
          {t("marketplace.of", "of")}{" "}
          <span className="font-bold text-slate-900 dark:text-white">{totalCount}</span>{" "}
          {t("marketplace.items", "items")}
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
            placeholder={t("marketplace.search_placeholder", "Search products by model, specs or SKU...")}
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
                  ? t("marketplace.all_subcategories", "All Subcategories")
                  : `${t("marketplace.all_in_category", "All in Category")} (${translateCategoryName(activeParent?.name || "Subcategories", isHindi)})`}
              </option>

              {selectedCategory !== "all" && activeParent ? (
                subCategories.map((sub) => (
                  <option key={sub.id} value={sub.slug}>
                    {translateCategoryName(sub.name, isHindi)}
                  </option>
                ))
              ) : (
                categories.map((parent) => {
                  const children = allCategories.filter((c) => c.parent_id === parent.id);
                  if (children.length === 0) return null;
                  return (
                    <optgroup key={parent.id} label={translateCategoryName(parent.name, isHindi)}>
                      {children.map((sub) => (
                        <option key={sub.id} value={sub.slug}>
                          {translateCategoryName(sub.name, isHindi)}
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
                setSortOption(e.target.value as "featured" | "newest" | "price_asc" | "price_desc")
              }
              aria-label="Sort products"
              className="w-full pl-8 pr-8 py-2.5 text-xs bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl focus:outline-none focus:border-brand-dark dark:focus:border-brand-light shadow-2xs appearance-none font-semibold cursor-pointer"
            >
              <option value="featured">{t("marketplace.sort_featured", "Featured (Mixed)")}</option>
              <option value="newest">{t("marketplace.sort_newest", "Newest First")}</option>
              <option value="price_asc">{t("marketplace.sort_price_asc", "Price: Low to High")}</option>
              <option value="price_desc">{t("marketplace.sort_price_desc", "Price: High to Low")}</option>
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
                  {idx === 0
                    ? t("marketplace.price_all", "All Prices")
                    : idx === 1
                    ? t("marketplace.price_under_299", "Under ₹299")
                    : idx === 4
                    ? t("marketplace.price_1000_plus", "₹1,000+")
                    : b.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Active Filters Bar (if active) ── */}
      {(bestsellerOnly ||
        selectedCategory !== "all" ||
        selectedSubCategory ||
        searchQuery ||
        priceBracketIndex > 0 ||
        sortOption !== "featured") && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-2xl border border-slate-100 dark:border-white/10 shadow-2xs">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">Filters active:</span>

            {bestsellerOnly && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-[11px] border border-amber-200 dark:border-amber-800/50">
                <span>🏆 Bestsellers</span>
                <button
                  type="button"
                  onClick={() => setBestsellerOnly(false)}
                  className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-200 cursor-pointer ml-0.5"
                  title="Clear bestsellers filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedCategory !== "all" && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                <span>Category: {activeParent?.name || selectedCategory}</span>
                <button
                  type="button"
                  onClick={() => handleCategoryChange("all")}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer ml-0.5"
                  title="Clear category"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedSubCategory && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-primary-soft text-primary font-bold text-[11px] border border-primary-border">
                <Layers className="w-3 h-3 text-brand-dark dark:text-teal-300" />
                <span>
                  Subcategory: {activeSubCategory?.name || selectedSubCategory}
                </span>
                <button
                  type="button"
                  onClick={() => handleSubCategoryChange(null)}
                  className="text-primary hover:text-primary-hover cursor-pointer ml-0.5"
                  title="Clear subcategory"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {priceBracketIndex > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                {PRICE_BRACKETS[priceBracketIndex]?.label}
              </span>
            )}

            {searchQuery && (
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] truncate max-w-35">
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

          {/* Infinite Scroll Auto-loader Sentinel */}
          {products.length < totalCount && (
            <div
              ref={loadMoreSentinelRef}
              className="py-6 flex flex-col items-center justify-center min-h-14"
            >
              {loadingMore && (
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-dark dark:text-cyan-400" />
                  <span>{t("marketplace.loading_more", "Loading more wholesale products...")}</span>
                </div>
              )}
            </div>
          )}

          {/* End of Catalog Indicator */}
          {products.length >= totalCount && totalCount > 0 && !loading && (
            <div className="py-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 select-none">
              {isHindi ? "सभी" : "Showing all"} {totalCount.toLocaleString("en-IN")}{" "}
              {isHindi ? "उत्पाद दिखाए गए" : "products"}
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<Sparkles className="w-8 h-8 text-brand-dark" />}
          title={t("marketplace.no_products", "No products match your filters")}
          description={
            isHindi
              ? "कृपया अपने खोज शब्द बदलें अथवा मूल्य और श्रेणी फ़िल्टर रीसेट करें।"
              : "Try broadening your search keywords or resetting price and category filters."
          }
          actionText={t("marketplace.reset_all", "Reset All Filters")}
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
          <span className="text-xs font-bold tracking-wide">{t("marketplace.filters", "Filter")}</span>
          {activeFilterCount > 0 && (
            <span
              className="min-w-4.5 h-4.5 px-1.5 rounded-full text-[10px] font-black text-on-primary bg-primary flex items-center justify-center shadow-xs"
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
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 dark:border-white/10 space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  {t("marketplace.filters", "Search & Filters")}
                </h3>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {totalCount} {isHindi ? "उत्पाद मिले" : "products matching"}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600 transition cursor-pointer px-2 py-1"
                  >
                    {t("marketplace.reset_all", "Reset")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFilterDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 1. Search Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isHindi ? "खोजें" : "Search"}
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("marketplace.search_placeholder", "Model, specs, or SKU...")}
                  className="w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-brand-dark dark:focus:border-brand-light transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-brand-dark dark:text-teal-300" />
                    <span>
                      {t("marketplace.subcategories", "Subcategories:")} (
                      {translateCategoryName(activeParent ? activeParent.name : "All", isHindi)})
                    </span>
                  </label>
                  {selectedSubCategory && (
                    <button
                      type="button"
                      onClick={() => handleSubCategoryChange(null)}
                      className="text-[11px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                    >
                      {t("marketplace.clear_filters", "Clear")}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto no-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => handleSubCategoryChange(null)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedSubCategory === null
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    {activeParent
                      ? `${t("marketplace.all_in_category", "All in Category")} (${translateCategoryName(activeParent.name, isHindi)})`
                      : t("marketplace.all_subcategories", "All Subcategories")}
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs ${
                          isSelected
                            ? "bg-primary text-on-primary"
                            : "bg-transparent border border-surface-border text-slate-700 dark:text-slate-200 hover:bg-surface-card-subtle font-medium"
                        }`}
                      >
                        {translateCategoryName(sub.name, isHindi)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Sort Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isHindi ? "क्रमबद्ध करें" : "Sort By"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "featured", label: isHindi ? "खास" : "Featured" },
                  { id: "newest", label: isHindi ? "नवीनतम" : "Newest" },
                  { id: "price_asc", label: isHindi ? "कीमत ↑" : "Price ↑" },
                  { id: "price_desc", label: isHindi ? "कीमत ↓" : "Price ↓" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSortOption(s.id as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer text-center shadow-xs ${
                      sortOption === s.id
                        ? "bg-primary text-on-primary"
                        : "bg-transparent border border-surface-border text-slate-700 dark:text-slate-200 hover:bg-surface-card-subtle font-medium"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Price Bracket */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isHindi ? "कीमत दायरा" : "Price Range"}
              </label>
              <div className="flex flex-wrap gap-2">
                {PRICE_BRACKETS.map((b, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPriceBracketIndex(idx)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs ${
                      priceBracketIndex === idx
                        ? "bg-primary text-on-primary"
                        : "bg-transparent border border-surface-border text-slate-700 dark:text-slate-200 hover:bg-surface-card-subtle font-medium"
                    }`}
                  >
                    {idx === 0
                      ? t("marketplace.price_all", "All Prices")
                      : idx === 1
                      ? t("marketplace.price_under_299", "Under ₹299")
                      : idx === 4
                      ? t("marketplace.price_1000_plus", "₹1,000+")
                      : b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(false)}
                className="w-full h-11 px-4 rounded-xl bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active font-semibold text-xs shadow-xs focus-visible:ring-2 ring-ring ring-offset-2 transition-all cursor-pointer flex items-center justify-center"
              >
                {isHindi ? `उत्पाद देखें (${totalCount})` : `Show ${totalCount} Products`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
