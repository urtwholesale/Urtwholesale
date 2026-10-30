import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
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
  ArrowLeft,
  Clock,
  Sparkles,
  Layers,
  Smartphone,
} from "lucide-react";

export interface SearchDropdownProps {
  popularSearches?: string[];
  className?: string;
}

const RECENT_SEARCHES_KEY = "URT_RECENT_SEARCHES_V1";
const MAX_RECENT_SEARCHES = 6;

const DEFAULT_TRENDING_SEARCHES = [
  "iPhone 16 Glass",
  "65W GaN",
  "100W Cable",
  "AirBass Pro",
  "MagSafe Car",
];

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

export function SearchDropdown({
  popularSearches = [],
  className = "",
}: SearchDropdownProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileActive, setIsMobileActive] = useState(false);
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

  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const activeRequestIdRef = useRef<number>(0);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const resolvedTrending = popularSearches.length > 0 ? popularSearches : DEFAULT_TRENDING_SEARCHES;

  // Close dropdown on route change
  useEffect(() => {
    setIsOpen(false);
    setIsMobileActive(false);
    setSelectedIndex(-1);
  }, [location.pathname]);

  // Load categories for suggestions
  useEffect(() => {
    let isMounted = true;
    fetchCategories()
      .then((cats) => {
        if (isMounted) setCategories(cats);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

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

  // Click outside listener for desktop and mobile
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const insideDesktop = desktopContainerRef.current?.contains(target);
      const insideMobile = mobileContainerRef.current?.contains(target);

      if (!insideDesktop && !insideMobile) {
        setIsOpen(false);
        setIsMobileActive(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global keyboard shortcuts (Cmd+K, Ctrl+K, or / to open)
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => desktopInputRef.current?.focus(), 50);
      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => desktopInputRef.current?.focus(), 50);
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // 250ms debounced search with race condition guard
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
      ).slice(0, 4)
    : [];

  const products = searchResult?.products || [];
  const totalNavItems = matchingCategories.length + matchingBrands.length + products.length;

  function closeAll() {
    setIsOpen(false);
    setIsMobileActive(false);
    setSelectedIndex(-1);
    desktopInputRef.current?.blur();
    mobileInputRef.current?.blur();
  }

  function executeSelection(index: number) {
    if (index < 0) {
      if (query.trim()) {
        saveRecentSearch(query);
        closeAll();
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
        closeAll();
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
        closeAll();
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
        closeAll();
        navigate(`/product/${prod.slug}`);
      }
    }
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAll();
      return;
    }

    if (totalNavItems === 0) {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault();
        saveRecentSearch(query);
        closeAll();
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
    setIsOpen(true);
    desktopInputRef.current?.focus();
    mobileInputRef.current?.focus();
  }

  /* ───────────────────────────────────────────────────────────────────
   * REUSABLE DROPDOWN PANEL CONTENT (Search Options)
   * Rendered directly below the input in both desktop & mobile views.
   * ─────────────────────────────────────────────────────────────────── */
  const renderDropdownContent = () => (
    <div
      ref={resultsContainerRef}
      className="relative flex flex-col max-h-[72vh] overflow-hidden"
    >
      <div className="relative z-10 flex-1 overflow-y-auto space-y-4 p-4 divide-y divide-slate-100/80 dark:divide-slate-800/80">
        {/* ── STATE 1: EMPTY QUERY (Recent Searches, Trending, Quick Categories) ── */}
        {!query.trim() && (
          <div className="space-y-4 pt-0.5">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Recent Searches</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearAllRecentSearches}
                    className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map((term) => (
                    <span
                      key={term}
                      onClick={() => handleSelectTerm(term)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/70 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700/90 border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer group active:scale-95"
                    >
                      <span>{term}</span>
                      <button
                        type="button"
                        onClick={(e) => removeRecentSearch(term, e)}
                        aria-label={`Remove ${term}`}
                        className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer ml-0.5 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Searches (Matching the User's Screenshot Design) */}
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                <span>Trending Searches</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {resolvedTrending.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleSelectTerm(term)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 dark:border-amber-500/40 shadow-[0_2px_8px_rgba(245,158,11,0.12)] hover:shadow-[0_4px_14px_rgba(245,158,11,0.25)] hover:scale-[1.02]"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Departments / Top Categories */}
            {categories.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  <span>Popular Departments</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {categories.slice(0, 6).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        saveRecentSearch(cat.name);
                        closeAll();
                        navigate(`/marketplace?category=${encodeURIComponent(cat.slug)}`);
                      }}
                      className="px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-300 bg-white/50 dark:bg-slate-800/40 hover:bg-cyan-50/80 dark:hover:bg-cyan-950/30 border border-slate-200/60 dark:border-slate-700/60 transition-all cursor-pointer flex items-center justify-between group truncate"
                    >
                      <span className="truncate">{cat.name}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-1.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STATE 2: ACTIVE QUERY RESULTS ── */}
        {query.trim() && (
          <div className="space-y-4 pt-1">
            {/* Typo Correction / Synonyms Banner */}
            {searchResult?.correctedQuery && searchResult.correctedQuery !== normQuery && (
              <div className="p-3 rounded-2xl bg-cyan-50/90 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-500/30 text-xs text-cyan-950 dark:text-cyan-200 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-slate-500 dark:text-slate-400">Showing results for </span>
                  <strong className="text-cyan-700 dark:text-cyan-300 font-extrabold">{searchResult.correctedQuery}</strong>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Search instead for{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(normQuery);
                        navigate(`/marketplace?q=${encodeURIComponent(normQuery)}`);
                        closeAll();
                      }}
                      className="underline text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
                    >
                      "{normQuery}"
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Related match badge */}
            {searchResult?.matchType === "related" && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 font-medium">
                No exact match for "{query}". You may also like:
              </div>
            )}

            {/* Section 1: Matching Categories */}
            {matchingCategories.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 flex items-center space-x-1">
                  <Layers className="w-3 h-3 text-cyan-500" />
                  <span>Matching Categories</span>
                </p>
                <div className="space-y-1">
                  {matchingCategories.map((cat, idx) => {
                    const isSelected = selectedIndex === idx;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => {
                          saveRecentSearch(cat.name);
                          closeAll();
                          navigate(`/marketplace?category=${encodeURIComponent(cat.slug)}`);
                        }}
                        className={`px-3 py-2 rounded-xl flex items-center justify-between text-xs font-semibold cursor-pointer transition ${
                          isSelected
                            ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300"
                            : "hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span>{cat.name}</span>
                        <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium">Browse category →</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Matching Brands */}
            {matchingBrands.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 flex items-center space-x-1">
                  <Smartphone className="w-3 h-3 text-purple-500" />
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
                          closeAll();
                          navigate(`/marketplace?q=${encodeURIComponent(brand)}`);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border ${
                          isSelected
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs"
                            : "bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {brand}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 3: Products */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Products ({products.length})
                </p>
                {searching && (
                  <span className="flex items-center space-x-1 text-[11px] text-cyan-600 dark:text-cyan-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Searching...</span>
                  </span>
                )}
              </div>

              {products.length > 0 ? (
                <div className="space-y-1.5">
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
                          closeAll();
                          navigate(`/product/${product.slug}`);
                        }}
                        className={`p-2 sm:p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer group ${
                          isSelected
                            ? "bg-cyan-500/15 border border-cyan-500/30 shadow-xs"
                            : "hover:bg-white/80 dark:hover:bg-slate-800/80 hover:shadow-2xs border border-transparent"
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 pr-2">
                          {product.images[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-11 h-11 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/50 dark:border-slate-700/50 group-hover:scale-105 transition-transform"
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
                                  className={frag.highlight ? "text-cyan-600 dark:text-cyan-400 font-extrabold underline decoration-cyan-400/60" : ""}
                                >
                                  {frag.text}
                                </span>
                              ))}
                            </p>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                ₹{product.price.toLocaleString("en-IN")}
                              </span>
                              {product.is_urbanrat_brand && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-cyan-100/80 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-300/40 dark:border-cyan-600/40">
                                  Urbanrat
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                                {product.sku}
                              </span>
                            </div>
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                !searching && (
                  <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1">
                    <p>No products found for "{query}".</p>
                    <p className="text-[11px] text-slate-400/80">Try searching for chargers, tempered glass, cables, or brands.</p>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dropdown Footer Action */}
      {query.trim() && (
        <div className="p-3 border-t border-slate-100/80 dark:border-slate-800/80 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-900/50">
          <div className="hidden sm:flex items-center space-x-2 text-slate-400 dark:text-slate-500 text-[11px]">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">↓</kbd>
              <span>Navigate</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">↵</kbd>
              <span>Select</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              saveRecentSearch(query);
              closeAll();
              navigate(`/marketplace?q=${encodeURIComponent(query.trim())}`);
            }}
            className="ml-auto inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-bold text-white shadow-md hover:shadow-cyan-500/25 transition-all active:scale-95 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
            }}
          >
            <span>View all matching results</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ───────────────────────────────────────────────────────────────────
       * DESKTOP & TABLET VIEW: Interactive Search Capsule in TopBar
       * ─────────────────────────────────────────────────────────────────── */}
      <div
        ref={desktopContainerRef}
        className={`relative hidden md:block ${className}`}
      >
        {/* The Search Bar in TopBar */}
        <div
          className={`group relative flex items-center h-9 sm:h-10 px-3 rounded-full bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 transition-all duration-200 ${
            isOpen
              ? "border-cyan-500 dark:border-cyan-400 bg-white dark:bg-slate-800 ring-2 ring-cyan-500/20 shadow-xs"
              : "hover:bg-slate-100 dark:hover:bg-slate-800/80"
          }`}
        >
          <Search className="w-4 h-4 stroke-[2.2] text-slate-500 dark:text-slate-400 group-hover:text-cyan-500 transition-colors shrink-0 mr-2" />

          <input
            ref={desktopInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search products, chargers, lens rings..."
            className="w-36 lg:w-48 xl:w-60 focus:w-48 focus:lg:w-64 focus:xl:w-80 bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all duration-300"
          />

          {searching && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500 shrink-0 ml-1.5" />
          )}

          {query && !searching && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                desktopInputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="w-5 h-5 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {!query && !searching && (
            <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 ml-1.5 rounded-md bg-white/70 dark:bg-slate-700/70 border border-slate-200/60 dark:border-slate-600/60 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-300 shadow-2xs pointer-events-none">
              ⌘K
            </kbd>
          )}
        </div>

        {/* ── DROPDOWN SEARCH OPTIONS PANEL (Desktop) ── */}
        {isOpen && (
          <div className="absolute top-full mt-2 right-0 w-110 lg:w-125 xl:w-135 max-w-[calc(100vw-32px)] z-50 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden">
            {renderDropdownContent()}
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────────
       * MOBILE VIEW: Search Orb in TopBar + Dropdown Menu Underneath
       * ─────────────────────────────────────────────────────────────────── */}
      <div ref={mobileContainerRef} className="md:hidden">
        {/* Compact Flat Search Button */}
        <button
          type="button"
          onClick={() => {
            setIsMobileActive((prev) => !prev);
            if (!isMobileActive) {
              setTimeout(() => mobileInputRef.current?.focus(), 80);
            }
          }}
          aria-label="Search accessories"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer group"
        >
          {isMobileActive ? (
            <X className="w-4.5 h-4.5 stroke-[2.2] text-rose-500" />
          ) : (
            <Search className="w-4.5 h-4.5 stroke-[2.2] group-hover:scale-105 transition-transform" />
          )}
        </button>

        {/* Mobile Dropdown Search Options Drawer (Anchored beneath TopBar) */}
        {isMobileActive && (
          <div className="fixed top-16 inset-x-2.5 z-50 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl animate-in fade-in slide-in-from-top-1 duration-200 overflow-hidden">
            {/* Mobile Top Search Input */}
            <div className="p-3 border-b border-slate-100/80 dark:border-slate-800/80 flex items-center space-x-2 bg-white/40 dark:bg-slate-900/40">
              <button
                type="button"
                onClick={() => setIsMobileActive(false)}
                aria-label="Close search"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="flex-1 flex items-center h-10 px-3 rounded-full bg-white/70 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70">
                <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search products, chargers, lens rings..."
                  className="flex-1 bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
                />
                {searching && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500 shrink-0 ml-1" />
                )}
                {query && !searching && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      mobileInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Dropdown Search Options List */}
            {renderDropdownContent()}
          </div>
        )}
      </div>
    </>
  );
}

