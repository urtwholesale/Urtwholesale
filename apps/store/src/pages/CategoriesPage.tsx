import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { fetchCategories, fetchProducts } from "../services/storeService";
import { ProductCard } from "../components/ProductCard";
import { CategoryTwoPaneSkeleton, ProductGridSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/EmptyState";
import type { Category, Product } from "@urbanrat/shared";
import {
  ArrowLeft,
  Layers,
  Sparkles,
} from "lucide-react";

interface CategoriesPageProps {
  onAddToCart: (product: Product) => void;
}

const PAGE_SIZE = 24;

export function CategoriesPage({ onAddToCart }: CategoriesPageProps) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeParentId, setActiveParentId] = useState<string>("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Load all categories
  useEffect(() => {
    async function loadData() {
      setLoadingCats(true);
      try {
        const all = await fetchCategories();
        setCategories(all);
        const firstParent = all.find((c) => c.parent_id === null);
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

  const parentCategories = categories.filter((c) => c.parent_id === null);
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

  // Load more pagination
  async function handleLoadMore() {
    if (loadingMore || products.length >= totalCount || !activeParentId) return;
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
  }

  function handleSelectParent(parentId: string) {
    setActiveParentId(parentId);
    setSelectedSubCategory(null);
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Categories &amp; Subcategories
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Two-pane department navigator for mobile electronics
        </p>
      </div>

      {loadingCats ? (
        <CategoryTwoPaneSkeleton />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden flex min-h-145 sm:min-h-160">
          {/* ── Left Pane: Main Categories ── */}
          <div className="w-24 sm:w-36 md:w-44 bg-slate-50/90 border-r border-slate-100 flex flex-col shrink-0 overflow-y-auto no-scrollbar py-2">
            {parentCategories.map((parent) => {
              const isActive = parent.id === activeParentId;
              return (
                <button
                  key={parent.id}
                  type="button"
                  onClick={() => handleSelectParent(parent.id)}
                  className={`relative p-2.5 sm:p-3 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-1.5 ${
                    isActive
                      ? "bg-white text-slate-900 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium"
                  }`}
                >
                  {/* Active highlight indicator bar */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
                      style={{
                        background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                      }}
                    />
                  )}

                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl overflow-hidden border transition-all ${
                      isActive
                        ? "border-brand-light shadow-xs ring-2 ring-brand-light/30"
                        : "border-slate-200/80 bg-white"
                    }`}
                  >
                    <img
                      src={parent.image_url || ""}
                      alt={parent.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <span className="text-[11px] sm:text-xs leading-tight line-clamp-2">
                    {parent.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Right Pane: Sub-Categories Strip + Product Grid ── */}
          <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto space-y-4">
            {/* Top Bar with Navigation & Marketplace Link */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div className="min-w-0">
                {selectedSubCategory ? (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSubCategory(null)}
                      className="inline-flex items-center space-x-1 text-xs font-bold text-brand-dark hover:underline cursor-pointer shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">All {activeParent?.name}</span>
                      <span className="sm:hidden">All</span>
                    </button>
                    <span className="text-slate-300 font-normal">/</span>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                      {selectedSubCategory.name}
                    </h2>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                      {activeParent?.name || "Select Category"}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {totalCount > 0
                        ? `Showing ${products.length} of ${totalCount} products in this category`
                        : "Browse direct inventory"}
                    </p>
                  </div>
                )}
              </div>

              {activeParent && (
                <Link
                  to={`/marketplace?category=${activeParent.slug}${
                    selectedSubCategory ? `&subcategory=${selectedSubCategory.slug}` : ""
                  }`}
                  className="text-[11px] font-bold text-brand-dark hover:underline shrink-0"
                >
                  Open in Marketplace →
                </Link>
              )}
            </div>

            {/* Subcategories Filter Chips */}
            {subCategories.length > 0 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none no-scrollbar pb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center space-x-1">
                  <Layers className="w-3.5 h-3.5 text-brand-dark" />
                  <span className="hidden sm:inline">Subcategories:</span>
                </span>

                {/* "All Products in Category" Pill */}
                <button
                  type="button"
                  onClick={() => setSelectedSubCategory(null)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition active:scale-95 cursor-pointer ${
                    selectedSubCategory === null
                      ? "text-white shadow-xs font-black"
                      : "bg-slate-50 text-slate-600 border border-slate-200/90 hover:bg-slate-100"
                  }`}
                  style={
                    selectedSubCategory === null
                      ? { background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)" }
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
                      onClick={() => setSelectedSubCategory(sub)}
                      className={`shrink-0 inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[11px] font-semibold transition active:scale-95 cursor-pointer ${
                        isSelected
                          ? "text-white shadow-xs font-black"
                          : "bg-slate-50 text-slate-700 border border-slate-200/90 hover:bg-slate-100"
                      }`}
                      style={
                        isSelected
                          ? { background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)" }
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

            {/* Product Grid or Loading / Empty States */}
            {loadingProducts ? (
              <ProductGridSkeleton count={6} />
            ) : products.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {products.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onAddToCart={onAddToCart}
                    />
                  ))}
                </div>

                {/* Load More Pagination */}
                {products.length < totalCount && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-6 py-2 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-800 shadow-xs hover:bg-slate-50 active:scale-95 disabled:opacity-50 transition cursor-pointer"
                    >
                      {loadingMore
                        ? "Loading more products..."
                        : `Load More Products (${products.length} of ${totalCount})`}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<Sparkles className="w-8 h-8 text-brand-dark" />}
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
        </div>
      )}
    </div>
  );
}
