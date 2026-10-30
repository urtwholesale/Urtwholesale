import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { fetchCategories, fetchProducts } from "../services/storeService";
import { ProductCard } from "../components/ProductCard";
import { CategoryTopRailSkeleton, ProductGridSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/EmptyState";
import { triggerHaptic } from "../utils/haptics";
import { getCategoryThemeImage } from "../utils/categoryTheme";
import { useTheme } from "../context/ThemeContext";
import type { Category, Product } from "@urbanrat/shared";
import {
  ArrowLeft,
  Layers,
  Sparkles,
  Loader2,
} from "lucide-react";

interface CategoriesPageProps {
  onAddToCart: (product: Product) => void;
}

const PAGE_SIZE = 24;

export function CategoriesPage({ onAddToCart }: CategoriesPageProps) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeParentId, setActiveParentId] = useState<string>("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const activeCategoryButtonRef = useRef<HTMLButtonElement | null>(null);

  // Smoothly center active category button in the horizontal strip on change
  useEffect(() => {
    if (activeCategoryButtonRef.current) {
      activeCategoryButtonRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [activeParentId]);

  // Load all categories
  useEffect(() => {
    async function loadData() {
      setLoadingCats(true);
      try {
        const all = await fetchCategories();
        setCategories(all);
        const firstParent = all.find((c) => !c.parent_id);
        if (firstParent) {
          setActiveParentId(firstParent.id);
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
      } finally {
        setLoadingCats(false);
      }
    }
    loadData();
  }, []);

  const parentCategories = categories.filter((c) => !c.parent_id);
  const activeParent = parentCategories.find((c) => c.id === activeParentId);
  const subCategories = categories.filter((c) => c.parent_id === activeParentId);

  // Load products whenever active parent or selected subcategory changes
  useEffect(() => {
    if (!activeParentId) return;

    let isMounted = true;
    async function loadCategoryProducts() {
      setLoadingProducts(true);
      try {
        // If a subcategory is picked, query that subcategory;
        // otherwise query the active parent category (which recursively resolves all descendant products)
        const targetId = selectedSubCategory ? selectedSubCategory.id : activeParentId;
        const res = await fetchProducts({
          categoryId: targetId,
          limit: PAGE_SIZE,
          offset: 0,
        });

        if (isMounted) {
          setProducts(res.products);
          setTotalCount(res.total);
        }
      } catch (err) {
        console.error("Failed to load category products:", err);
      } finally {
        if (isMounted) setLoadingProducts(false);
      }
    }

    loadCategoryProducts();
    return () => {
      isMounted = false;
    };
  }, [activeParentId, selectedSubCategory]);

  // Infinite scroll auto-loader
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || products.length >= totalCount || !activeParentId || loadingProducts) return;
    setLoadingMore(true);

    try {
      const targetId = selectedSubCategory ? selectedSubCategory.id : activeParentId;
      const res = await fetchProducts({
        categoryId: targetId,
        limit: PAGE_SIZE,
        offset: products.length,
      });

      setProducts((prev) => [...prev, ...res.products]);
    } catch (err) {
      console.error("Failed to load more products:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, products.length, totalCount, activeParentId, loadingProducts, selectedSubCategory]);

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

  function handleSelectParent(parentId: string) {
    triggerHaptic("selection");
    setActiveParentId(parentId);
    setSelectedSubCategory(null);
    // Smoothly scroll back to top of product list if scrolled down
    if (window.scrollY > 120) {
      window.scrollTo({ top: 90, behavior: "smooth" });
    }
  }

  function handleSelectSub(sub: Category | null) {
    triggerHaptic("selection");
    setSelectedSubCategory(sub);
    // Smoothly scroll back to top of product list if scrolled down
    if (window.scrollY > 120) {
      window.scrollTo({ top: 90, behavior: "smooth" });
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300 pb-16">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Categories &amp; Catalog
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Browse wholesale mobile electronics by department
          </p>
        </div>

        {activeParent && (
          <Link
            to={`/marketplace?category=${activeParent.slug}${
              selectedSubCategory ? `&subcategory=${selectedSubCategory.slug}` : ""
            }`}
            className="inline-flex items-center space-x-1 text-xs font-bold text-brand-dark dark:text-orange-400 hover:underline self-start sm:self-auto cursor-pointer"
          >
            <span>Open in Marketplace</span>
            <span>&rarr;</span>
          </Link>
        )}
      </div>

      {loadingCats ? (
        <CategoryTopRailSkeleton />
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {/* ── Top Category Navigation Rail & Subcategories Bar (Expanded to Borders, Non-Sticky on Desktop) ── */}
          <div className="sticky md:relative top-16 md:top-auto z-30 w-screen left-1/2 -translate-x-1/2 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-2 sm:py-2.5 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-y border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.45)] transition-colors">
            <div className="w-full max-w-[1780px] mx-auto space-y-2">
              {/* Horizontal Parent Categories Cards Rail */}
              <div className="flex items-center space-x-2 sm:space-x-2.5 overflow-x-auto scrollbar-none no-scrollbar py-0.5 px-0.5">
                {parentCategories.map((parent) => {
                  const isActive = parent.id === activeParentId;
                  return (
                    <button
                      key={parent.id}
                      ref={isActive ? activeCategoryButtonRef : null}
                      type="button"
                      onClick={() => handleSelectParent(parent.id)}
                      className={`group relative shrink-0 w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 aspect-square rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all select-none text-left bg-white dark:bg-slate-900 ${
                        isActive
                          ? "ring-2 ring-orange-500 shadow-[0_0_16px_rgba(249,115,22,0.4)] border-transparent"
                          : "border border-slate-200/90 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25 hover:shadow-md shadow-xs opacity-95 hover:opacity-100"
                      }`}
                    >
                      {/* Category Themed Studio Image (Light / Dark Adaptive) */}
                      <img
                        src={getCategoryThemeImage(parent, isDark)}
                        alt={parent.name}
                        className="w-full h-full object-cover rounded-xl sm:rounded-2xl group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        decoding="async"
                      />

                      {/* Active Glowing Highlight Bar at Top */}
                      {isActive && (
                        <div
                          className="absolute top-1 left-1.5 right-1.5 h-0.5 rounded-full z-10 shadow-xs"
                          style={{ background: "var(--brand-gradient)" }}
                        />
                      )}

                      {/* Clean Frosted Floating Caption (Dual Theme) */}
                      <div className="absolute inset-x-1 bottom-1 z-10 py-0.5 px-1 rounded-lg bg-white/92 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-white/15 shadow-xs text-center transition-colors">
                        <span className="text-[9.5px] sm:text-[10px] font-black text-slate-800 dark:text-slate-100 leading-tight truncate block">
                          {parent.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Subcategories Filter Chips */}
              {subCategories.length > 0 && (
                <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto scrollbar-none no-scrollbar pt-1.5 border-t border-slate-100/90 dark:border-slate-800/80">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 shrink-0 mr-1 flex items-center space-x-1">
                    <Layers className="w-3.5 h-3.5 text-brand-dark dark:text-orange-400" />
                    <span>Subcategories:</span>
                  </span>

                  {/* "All Products in Category" Pill */}
                  <button
                    type="button"
                    onClick={() => handleSelectSub(null)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer ${
                      selectedSubCategory === null
                        ? "text-white shadow-xs font-black"
                        : "bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700"
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
                    All {activeParent ? activeParent.name : "Products"}
                  </button>

                  {/* Individual Subcategory Pills */}
                  {subCategories.map((sub) => {
                    const isSelected = selectedSubCategory?.id === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSelectSub(sub)}
                        className={`shrink-0 inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer ${
                          isSelected
                            ? "text-white shadow-xs font-black"
                            : "bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700"
                        }`}
                        style={
                          isSelected
                            ? {
                                background: "var(--brand-gradient)",
                                boxShadow: "var(--brand-shadow)",
                              }
                            : {}
                        }
                      >
                        {sub.image_url && (
                          <img
                            src={sub.image_url}
                            alt=""
                            className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                          />
                        )}
                        <span>{sub.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Active Department Header & Count ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 pb-1 gap-1">
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {selectedSubCategory ? selectedSubCategory.name : activeParent?.name || "All Products"}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {totalCount > 0
                  ? `(${totalCount.toLocaleString("en-IN")} products)`
                  : ""}
              </span>
            </div>

            {selectedSubCategory && (
              <button
                type="button"
                onClick={() => handleSelectSub(null)}
                className="inline-flex items-center space-x-1 text-xs font-bold text-brand-dark dark:text-orange-400 hover:underline cursor-pointer self-start sm:self-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>View All {activeParent?.name}</span>
              </button>
            )}
          </div>

          {/* ── Product Grid (Full Width, Spacious Cards) ── */}
          {loadingProducts ? (
            <ProductGridSkeleton count={8} />
          ) : products.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4.5">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onAddToCart={onAddToCart}
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
                      <span>Loading more products...</span>
                    </div>
                  )}
                </div>
              )}

              {/* End of Catalog Indicator */}
              {products.length >= totalCount && totalCount > 0 && (
                <div className="py-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 select-none">
                  Showing all {totalCount.toLocaleString("en-IN")} products
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<Sparkles className="w-8 h-8 text-brand-dark dark:text-orange-400" />}
              title={
                selectedSubCategory
                  ? `No products in ${selectedSubCategory.name}`
                  : `No products in ${activeParent?.name || "this category"}`
              }
              description="Inventory for this category is currently being restocked or updated."
              actionText={selectedSubCategory ? "View all in category" : "Browse Marketplace"}
              onAction={() => {
                if (selectedSubCategory) {
                  setSelectedSubCategory(null);
                } else {
                  navigate("/marketplace");
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
