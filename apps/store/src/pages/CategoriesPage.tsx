import { useState, useEffect } from "react";
import { Link } from "react-router";
import { fetchCategories, fetchProducts } from "../services/storeService";
import { ProductCard } from "../components/ProductCard";
import { CategoryTwoPaneSkeleton, ProductGridSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/EmptyState";
import type { Category, Product } from "@urbanrat/shared";
import {
  ChevronRight,
  ArrowLeft,
  Layers,
} from "lucide-react";

interface CategoriesPageProps {
  onAddToCart: (product: Product) => void;
}

export function CategoriesPage({ onAddToCart }: CategoriesPageProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeParentId, setActiveParentId] = useState<string>("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<Category | null>(null);
  const [subCategoryProducts, setSubCategoryProducts] = useState<Product[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);

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

  // When sub-category is tapped, load its product grid
  useEffect(() => {
    if (!selectedSubCategory) {
      setSubCategoryProducts([]);
      return;
    }

    let isMounted = true;
    async function loadSubProducts() {
      setLoadingProducts(true);
      try {
        const res = await fetchProducts({
          subCategoryId: selectedSubCategory!.id,
          limit: 20,
        });
        if (isMounted) {
          setSubCategoryProducts(res.products);
        }
      } catch (err) {
        console.error("Failed to load subcategory products:", err);
      } finally {
        if (isMounted) setLoadingProducts(false);
      }
    }

    loadSubProducts();
    return () => {
      isMounted = false;
    };
  }, [selectedSubCategory]);

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
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden flex min-h-[580px] sm:min-h-[640px]">
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
                        ? "border-[#5ADBE5] shadow-xs ring-2 ring-[#5ADBE5]/30"
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

          {/* ── Right Pane: Sub-Categories OR Filtered Product Grid ── */}
          <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto">
            {selectedSubCategory ? (
              /* Filtered Product Grid for the selected Subcategory */
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedSubCategory(null)}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0A82A8] hover:underline cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to {activeParent?.name}</span>
                  </button>

                  <Link
                    to={`/marketplace?category=${selectedSubCategory.slug}`}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                  >
                    Open in Marketplace →
                  </Link>
                </div>

                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-100 shrink-0">
                    <img
                      src={selectedSubCategory.image_url || ""}
                      alt={selectedSubCategory.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      {selectedSubCategory.name}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Showing matching products for this subcategory
                    </p>
                  </div>
                </div>

                {loadingProducts ? (
                  <ProductGridSkeleton count={4} />
                ) : subCategoryProducts.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {subCategoryProducts.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onAddToCart={onAddToCart}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No products in this subcategory"
                    description="Inventory for this subcategory is being restocked."
                    actionText="View all categories"
                    onAction={() => setSelectedSubCategory(null)}
                  />
                )}
              </div>
            ) : (
              /* Subcategory List with Thumbnails */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      {activeParent?.name || "Select Category"}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Select a sub-category below to view inventory
                    </p>
                  </div>

                  {activeParent && (
                    <Link
                      to={`/marketplace?category=${activeParent.slug}`}
                      className="text-xs font-bold text-[#0A82A8] hover:underline"
                    >
                      View All →
                    </Link>
                  )}
                </div>

                {subCategories.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {subCategories.map((sub) => (
                      <div
                        key={sub.id}
                        onClick={() => setSelectedSubCategory(sub)}
                        className="group p-3 rounded-2xl bg-slate-50/70 hover:bg-white border border-slate-100 hover:border-[#5ADBE5]/60 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-slate-100 shrink-0">
                            <img
                              src={sub.image_url || ""}
                              alt={sub.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>

                          <div className="min-w-0">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-[#0A82A8] truncate transition-colors">
                              {sub.name}
                            </h3>
                            <span className="text-[10px] font-semibold text-emerald-600">
                              Browse Products
                            </span>
                          </div>
                        </div>

                        <div className="w-6 h-6 rounded-full bg-white group-hover:bg-[#5ADBE5]/20 flex items-center justify-center text-slate-400 group-hover:text-[#0A82A8] shrink-0 transition-colors">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Layers className="w-7 h-7 text-[#0A82A8]" />}
                    title="No subcategories defined"
                    description="Explore all items in this parent category directly from the marketplace."
                    actionText="Browse Marketplace"
                    onAction={() => {}}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
