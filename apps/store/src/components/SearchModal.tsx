import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import type { Category } from "@urbanrat/shared";
import {
  highlightSearchMatch,
  normalizeSearchQuery,
} from "@urbanrat/shared";
import {
  searchProductsV2,
  logSearchClick,
  fetchCategories,
  type SearchProductsResult,
} from "../services/storeService";
import { triggerHaptic } from "../utils/haptics";
import {
  Search,
  X,
  Loader2,
  ArrowRight,
  Clock,
  Sparkles,
  Layers,
  Smartphone,
} from "lucide-react";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  popularSearches?: string[];
}

const RECENT_SEARCHES_KEY = "URT_RECENT_SEARCHES_V1";
const MAX_RECENT_SEARCHES = 8;

const POPULAR_BRANDS = [
  "Infinix",
  "Apple",
  "Samsung",
  "Realme",
  "boAt",
  "OnePlus",
  "Motorola",
  "Vivo",
  "OPPO",
];

export function SearchModal({
  isOpen,
  onClose,
  popularSearches = [],
}: SearchModalProps) {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchProductsResult | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Recent searches stored in localStorage
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const activeRequestIdRef = useRef<number>(0);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(-1);
    } else {
      setQuery("");
      setSearchResult(null);
    }
  }, [isOpen]);

  // Load categories for section suggestions
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    fetchCategories()
      .then((cats) => {
        if (isMounted) setCategories(cats);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Save recent search
  function saveRecentSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }

  function removeRecentSearch(term: string, e: React.MouseEvent) {
    e.stopPropagation();
    triggerHaptic("selection");
    setRecentSearches((prev) => {
      const updated = prev.filter((t) => t.toLowerCase() !== term.toLowerCase());
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }

  function clearAllRecentSearches() {
    triggerHaptic("selection");
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  }

  // 250ms debounced search with request-id race condition guard
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResult(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const requestId = ++activeRequestIdRef.current;

    const timer = setTimeout(async () => {
      try {
        const result = await searchProductsV2({
          query: trimmed,
          limit: 8,
        });

        // Guard against stale asynchronous responses
        if (activeRequestIdRef.current === requestId) {
          setSearchResult(result);
          setSelectedIndex(-1);
        }
      } catch (err) {
        if (activeRequestIdRef.current === requestId) {
          console.error("Instant search failed:", err);
        }
      } finally {
        if (activeRequestIdRef.current === requestId) {
          setSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Filter matching categories and brands
  const normQuery = normalizeSearchQuery(query);
  const matchingCategories = normQuery
    ? categories.filter((c) =>
        normalizeSearchQuery(c.name).includes(normQuery)
      ).slice(0, 3)
    : [];

  const matchingBrands = normQuery
    ? POPULAR_BRANDS.filter((b) =>
        normalizeSearchQuery(b).includes(normQuery)
      ).slice(0, 3)
    : [];

  const products = searchResult?.products || [];

  // Total navigable items count (Categories + Brands + Products)
  const totalNavItems = matchingCategories.length + matchingBrands.length + products.length;

  function executeSelection(index: number) {
    if (index < 0) {
      // Pressing enter with no item selected navigates to marketplace
      if (query.trim()) {
        saveRecentSearch(query);
        onClose();
        navigate(`/marketplace?q=${encodeURIComponent(query.trim())}`);
      }
      return;
    }

    triggerHaptic("selection");
    let currentIdx = 0;

    // 1. Categories
    if (index < matchingCategories.length) {
      const cat = matchingCategories[index];
      if (cat) {
        saveRecentSearch(cat.name);
        onClose();
        navigate(`/marketplace?category=${encodeURIComponent(cat.slug)}`);
      }
      return;
    }
    currentIdx += matchingCategories.length;

    // 2. Brands
    if (index < currentIdx + matchingBrands.length) {
      const brand = matchingBrands[index - currentIdx];
      if (brand) {
        saveRecentSearch(brand);
        onClose();
        navigate(`/marketplace?q=${encodeURIComponent(brand)}`);
      }
      return;
    }
    currentIdx += matchingBrands.length;

    // 3. Products
    const prodIdx = index - currentIdx;
    if (prodIdx >= 0 && prodIdx < products.length) {
      const prod = products[prodIdx];
      if (prod) {
        saveRecentSearch(prod.name);
        if (searchResult?.searchId) {
          logSearchClick(searchResult.searchId, prod.id);
        }
        onClose();
        navigate(`/product/${prod.slug}`);
      }
    }
  }

  // Keyboard navigation: ArrowUp, ArrowDown, Enter, Escape
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (totalNavItems === 0) {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault();
        saveRecentSearch(query);
        onClose();
        navigate(`/marketplace?q=${encodeURIComponent(query.trim())}`);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 >= totalNavItems ? 0 : prev + 1));
      triggerHaptic("selection");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 < 0 ? totalNavItems - 1 : prev - 1));
      triggerHaptic("selection");
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeSelection(selectedIndex);
    }
  }

  function handleSelectTerm(term: string) {
    triggerHaptic("selection");
    setQuery(term);
    saveRecentSearch(term);
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search catalog"
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 pt-14 sm:pt-20 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search products, chargers, lens rings..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 font-semibold text-slate-800 dark:text-slate-100"
          />

          {searching && <Loader2 className="w-4 h-4 text-brand-dark dark:text-brand-light animate-spin shrink-0" />}

          {query && !searching && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="w-6 h-6 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Results & Suggestions Area */}
        <div ref={resultsContainerRef} className="flex-1 overflow-y-auto space-y-4 py-3 divide-y divide-slate-100 dark:divide-slate-800">
          {/* EMPTY QUERY STATE: Recent Searches & Popular Searches */}
          {!query.trim() && (
            <div className="space-y-4 pt-1">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Recent Searches</span>
                    </div>
                    <button
                      type="button"
                      onClick={clearAllRecentSearches}
                      className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <span
                        key={term}
                        onClick={() => handleSelectTerm(term)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer group"
                      >
                        <span>{term}</span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(term, e)}
                          className="text-slate-300 dark:text-slate-500 hover:text-rose-500 transition cursor-pointer ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Searches */}
              {popularSearches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Trending Searches</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {popularSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => handleSelectTerm(term)}
                        className="px-3 py-1.5 rounded-full text-xs bg-brand-light/10 dark:bg-orange-500/15 hover:bg-brand-light/20 dark:hover:bg-orange-500/25 border border-brand-light/30 dark:border-orange-500/30 text-brand-dark dark:text-brand-light font-bold transition cursor-pointer active:scale-95"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NON-EMPTY QUERY STATE */}
          {query.trim() && (
            <div className="space-y-4 pt-1">
              {/* Typo Correction / Recommendation Notice Banner */}
              {searchResult?.correctedQuery && searchResult.correctedQuery !== normQuery && (
                <div className="p-3 rounded-2xl bg-sky-50 dark:bg-orange-950/30 border border-sky-100 dark:border-orange-500/30 text-xs text-sky-950 dark:text-orange-200 flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-slate-500 dark:text-slate-400">Showing results for </span>
                    <strong className="text-brand-dark dark:text-brand-light font-black">{searchResult.correctedQuery}</strong>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Search instead for{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(normQuery);
                          navigate(`/marketplace?q=${encodeURIComponent(normQuery)}`);
                          onClose();
                        }}
                        className="underline text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
                      >
                        "{normQuery}"
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {searchResult?.matchType === "related" && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 font-medium">
                  No exact match for "{query}". You may also like:
                </div>
              )}

              {searchResult?.matchType === "popular" && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Popular right now</span>
                </div>
              )}

              {/* SECTION 1: Matching Categories */}
              {matchingCategories.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 flex items-center space-x-1">
                    <Layers className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    <span>Categories</span>
                  </p>
                  <div className="space-y-1">
                    {matchingCategories.map((cat, idx) => {
                      const isSelected = selectedIndex === idx;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => {
                            saveRecentSearch(cat.name);
                            onClose();
                            navigate(`/marketplace?category=${encodeURIComponent(cat.slug)}`);
                          }}
                          className={`px-3 py-2 rounded-2xl flex items-center justify-between text-xs font-semibold cursor-pointer transition ${
                            isSelected
                              ? "bg-brand-light/20 dark:bg-orange-500/20 text-brand-dark dark:text-brand-light"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <span className="flex items-center space-x-2">
                            <span>{cat.name}</span>
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Browse category →</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 2: Matching Brands */}
              {matchingBrands.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 flex items-center space-x-1">
                    <Smartphone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    <span>Brands &amp; Series</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {matchingBrands.map((brand, bIdx) => {
                      const absoluteIdx = matchingCategories.length + bIdx;
                      const isSelected = selectedIndex === absoluteIdx;
                      return (
                        <button
                          key={brand}
                          type="button"
                          onClick={() => {
                            saveRecentSearch(brand);
                            onClose();
                            navigate(`/marketplace?q=${encodeURIComponent(brand)}`);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            isSelected
                              ? "bg-brand-dark dark:bg-brand text-white border-brand-dark dark:border-brand shadow-xs"
                              : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {brand}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 3: Matching Products */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2">
                  Products ({products.length})
                </p>

                {products.length > 0 ? (
                  <div className="space-y-1">
                    {products.map((product, pIdx) => {
                      const absoluteIdx = matchingCategories.length + matchingBrands.length + pIdx;
                      const isSelected = selectedIndex === absoluteIdx;
                      const titleFragments = highlightSearchMatch(product.name, query);

                      return (
                        <div
                          key={product.id}
                          onClick={() => {
                            saveRecentSearch(product.name);
                            if (searchResult?.searchId) {
                              logSearchClick(searchResult.searchId, product.id);
                            }
                            onClose();
                            navigate(`/product/${product.slug}`);
                          }}
                          className={`p-2 sm:p-2.5 rounded-2xl flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? "bg-brand-light/15 dark:bg-orange-500/15 border border-brand-light/30 dark:border-orange-500/30 shadow-xs"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/80"
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0 pr-2">
                            {product.images[0] ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-11 h-11 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-100 dark:border-slate-800"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center text-slate-400">
                                <Search className="w-4 h-4" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {titleFragments.map((frag, fi) => (
                                  <span
                                    key={fi}
                                    className={frag.highlight ? "text-brand-dark dark:text-brand-light font-black underline decoration-brand-light" : ""}
                                  >
                                    {frag.text}
                                  </span>
                                ))}
                              </p>
                              <div className="flex items-center space-x-2 mt-0.5">
                                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                  ₹{product.price.toLocaleString("en-IN")}
                                </span>
                                {product.is_urbanrat_brand && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-100 dark:bg-orange-950/40 text-cyan-800 dark:text-brand-light">
                                    Urbanrat
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                                  {product.sku}
                                </span>
                              </div>
                            </div>
                          </div>

                          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !searching && (
                    <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
                      <p>No products found for "{query}".</p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with View All & Keyboard Shortcuts hint */}
        {query.trim() && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="hidden sm:flex items-center space-x-2 text-slate-400 dark:text-slate-500 text-[11px]">
              <span className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">↓</kbd>
                <span>Navigate</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">↵</kbd>
                <span>Select</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                saveRecentSearch(query);
                onClose();
                navigate(`/marketplace?q=${encodeURIComponent(query.trim())}`);
              }}
              className="ml-auto inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-brand-dark dark:hover:bg-brand transition active:scale-95 cursor-pointer shadow-xs"
            >
              <span>View all matching results</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
