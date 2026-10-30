import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router";
import type { Product, Category } from "@urbanrat/shared";
import {
  ArrowLeft,
  ChevronRight,
  Layers,
  Search,
  X,
  Check,
} from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

interface ProductCatalogNavProps {
  currentProduct: Product;
  catalogProducts: Product[];
  categoryName?: string;
  allCategories?: Category[];
  onSelectProduct: (slug: string) => void;
  onBack: () => void;
}

export function ProductCatalogNav({
  currentProduct,
  catalogProducts = [],
  categoryName = "Catalog",
  allCategories = [],
  onSelectProduct,
  onBack,
}: ProductCatalogNavProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFilter, setModalFilter] = useState("");

  const activeRailRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Compute current index in current catalog
  const currentIndex = useMemo(() => {
    return catalogProducts.findIndex((p) => p.id === currentProduct.id);
  }, [catalogProducts, currentProduct.id]);

  // Auto-scroll the active product pill into center of the horizontal rail
  useEffect(() => {
    if (activeItemRef.current && activeRailRef.current) {
      const rail = activeRailRef.current;
      const item = activeItemRef.current;
      const railWidth = rail.offsetWidth;
      const itemOffset = item.offsetLeft;
      const itemWidth = item.offsetWidth;
      rail.scrollTo({
        left: itemOffset - railWidth / 2 + itemWidth / 2,
        behavior: "smooth",
      });
    }
  }, [currentProduct.id, catalogProducts]);

  function handleProductClick(slug: string) {
    triggerHaptic("selection");
    setModalOpen(false);
    onSelectProduct(slug);
  }

  // Filtered products inside the "Change Product" modal
  const filteredModalProducts = useMemo(() => {
    const list = catalogProducts;
    if (!modalFilter.trim()) return list;

    const query = modalFilter.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.specs?.brand_compatibility &&
          String(p.specs.brand_compatibility).toLowerCase().includes(query))
    );
  }, [catalogProducts, modalFilter]);

  return (
    <div className="space-y-2.5 animate-in fade-in duration-200">
      {/* ── 1. Symmetrical Top Navigation Bar ── */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-2 sm:p-2.5 shadow-2xs flex items-center justify-between gap-2">
        {/* Left Wing: Back Button */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Go Back"
          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 stroke-[2.2]" />
          <span className="hidden sm:inline">Back</span>
        </button>

        {/* Center Wing: Quick-Switch Hub */}
        <div className="flex items-center min-w-0">
          {/* Center Interactive Pill: Catalog & Position Switcher */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 active:scale-95 transition cursor-pointer max-w-52 sm:max-w-72 truncate shadow-2xs group"
          >
            <Layers className="w-3.5 h-3.5 text-brand-dark dark:text-brand-light shrink-0 group-hover:rotate-12 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold truncate">
              {currentIndex >= 0
                ? `${currentIndex + 1}/${catalogProducts.length} • ${categoryName}`
                : categoryName}
            </span>
            <span className="text-[9px] text-slate-400 dark:text-slate-400 font-extrabold uppercase bg-white dark:bg-slate-900 px-1 rounded border border-slate-200 dark:border-slate-700 shrink-0 hidden sm:inline">
              Switch ▾
            </span>
          </button>
        </div>

        {/* Right Wing: SKU Badge & Quick Switch Action */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/90 px-2 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700/70 truncate max-w-28 sm:max-w-none">
            {currentProduct.sku || "UR-ITEM"}
          </span>
        </div>
      </div>

      {/* ── 2. Catalog Siblings Horizontal Rail ── */}
      {catalogProducts.length > 1 && (
        <div className="relative group">
          {/* Rail Track with edge scroll */}
          <div
            ref={activeRailRef}
            className="flex items-center space-x-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 -mx-1"
          >
            {catalogProducts.map((p) => {
              const isCurrent = p.id === currentProduct.id;
              const img = p.images[0] || "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=200";

              return (
                <button
                  key={p.id}
                  ref={isCurrent ? activeItemRef : null}
                  type="button"
                  onClick={() => !isCurrent && handleProductClick(p.slug)}
                  className={`shrink-0 flex items-center space-x-2 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 text-left border ${
                    isCurrent
                      ? "bg-brand-light/15 border-brand-dark/40 dark:border-orange-500/40 shadow-xs ring-1 ring-brand-dark/30 dark:ring-orange-500/30"
                      : "bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-800/80 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <img
                    src={img}
                    alt=""
                    className="w-7 h-7 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                  />
                  <div className="min-w-0 pr-1">
                    <div className="flex items-center space-x-1">
                      <span
                        className={`text-[11px] font-bold truncate max-w-28 sm:max-w-40 block leading-tight ${
                          isCurrent ? "text-slate-950 dark:text-white font-black" : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {p.name}
                      </span>
                      {isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-dark dark:bg-brand-light shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] font-extrabold text-brand-dark dark:text-brand-light block leading-none mt-0.5">
                      ₹{p.price}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. "Change Product" Catalog Switcher Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 p-0 sm:p-4">
          <div
            className="fixed inset-0"
            onClick={() => setModalOpen(false)}
            aria-hidden="true"
          />

          <div className="relative z-10 w-full sm:max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-brand-light/20 dark:bg-orange-500/20 flex items-center justify-center text-brand-dark dark:text-brand-light">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Switch Product ({catalogProducts.length} in {categoryName})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Select any model to change product directly on this page
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search Filter */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={modalFilter}
                  onChange={(e) => setModalFilter(e.target.value)}
                  placeholder={`Search in ${categoryName}...`}
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-brand-dark dark:focus:border-brand-light"
                  autoFocus
                />
                {modalFilter && (
                  <button
                    type="button"
                    onClick={() => setModalFilter("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Catalog / Category Switcher Pills */}
              {allCategories.length > 0 && (
                <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pt-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase shrink-0">
                    Catalogs:
                  </span>
                  {allCategories.map((cat) => {
                    const isCurrent = cat.id === currentProduct.category_id;
                    return (
                      <Link
                        key={cat.id}
                        to={`/marketplace?category=${cat.slug}`}
                        onClick={() => setModalOpen(false)}
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                          isCurrent
                            ? "bg-brand-dark dark:bg-brand text-white shadow-2xs"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        {cat.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Product Grid */}
            <div className="p-3 sm:p-4 overflow-y-auto no-scrollbar divide-y divide-slate-100 dark:divide-slate-800 max-h-[60vh]">
              {filteredModalProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredModalProducts.map((p) => {
                    const isCurrent = p.id === currentProduct.id;
                    const img =
                      p.images[0] ||
                      "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=200";

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleProductClick(p.slug)}
                        className={`flex items-center space-x-3 p-2.5 rounded-2xl transition cursor-pointer text-left border ${
                          isCurrent
                            ? "bg-brand-light/10 dark:bg-orange-500/15 border-brand-dark/40 dark:border-orange-500/40 shadow-xs"
                            : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200/70 dark:border-slate-800"
                        }`}
                      >
                        <img
                          src={img}
                          alt=""
                          className="w-11 h-11 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-bold truncate leading-tight ${
                              isCurrent ? "text-brand-dark dark:text-brand-light font-black" : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {p.name}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              ₹{p.price}
                            </span>
                            {isCurrent ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold text-brand-dark dark:text-brand-light bg-brand-light/20 dark:bg-orange-500/20 px-1.5 py-0.5 rounded-md">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                <span>Viewing</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">
                                SKU: {p.sku || "UR"}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-slate-400">
                  <p className="font-bold text-slate-600 dark:text-slate-300">No matching products found</p>
                  <p className="text-[11px] mt-0.5">Try a different search keyword</p>
                </div>
              )}
            </div>

            {/* Modal Footer with Link to Full Marketplace */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Want to browse other catalogs?
              </span>
              <Link
                to="/marketplace"
                onClick={() => setModalOpen(false)}
                className="font-bold text-brand-dark dark:text-brand-light hover:underline flex items-center space-x-1"
              >
                <span>Browse All Catalogs</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
