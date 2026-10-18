import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router";
import type { Product } from "@urbanrat/shared";
import {
  isSupabaseConfigured,
  fetchProducts,
  fetchStoreSettings,
} from "./services/storeService";
import { supabase } from "./lib/supabase";
import { StoreNotConfigured } from "./components/StoreNotConfigured";
import { TopBar } from "./components/TopBar";
import { NavigationDock } from "./components/NavigationDock";
import { HomePage } from "./pages/HomePage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { UrbanratPage } from "./pages/UrbanratPage";
import { MenuPage } from "./pages/MenuPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { CartPage } from "./pages/CartPage";
import { OrderPage } from "./pages/OrderPage";
import { Search, X, Loader2, ArrowRight } from "lucide-react";
import { initGlobalHaptics, triggerHaptic } from "./utils/haptics";

/**
 * Ensures whenever a user navigates or clicks a link from anywhere on a page,
 * the new route always opens cleanly scrolled to the very top.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.body.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

interface CartStateItem {
  product: Product;
  quantity: number;
}

const GUEST_CART_KEY = "urt_guest_cart";

export default function App() {
  const navigate = useNavigate();

  // If Supabase environment variables are missing, enforce configuration screen
  const configured = isSupabaseConfigured();

  // Initialize global haptics for all buttons, links, and navigation items
  useEffect(() => {
    const cleanup = initGlobalHaptics();
    return cleanup;
  }, []);

  // Cart starts completely empty [] (persisting guests in localStorage, syncs to DB for auth users)
  const [cartItems, setCartItems] = useState<CartStateItem[]>(() => {
    try {
      const saved = localStorage.getItem(GUEST_CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync guest cart changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cartItems));
    } catch {
      // Ignore storage write issues
    }
  }, [cartItems]);

  // Sync cart with Supabase public.cart_items when authenticated user is present
  useEffect(() => {
    if (!configured) return;

    let isMounted = true;
    async function syncAuthCart() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;

        const { data, error } = await supabase
          .from("cart_items")
          .select("quantity, products(*)")
          .eq("user_id", auth.user.id);

        if (!error && data && data.length > 0 && isMounted) {
          const dbItems: CartStateItem[] = data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((row: any) => row.products)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((row: any) => ({
              product: row.products as Product,
              quantity: row.quantity,
            }));
          if (dbItems.length > 0) {
            setCartItems(dbItems);
          }
        }
      } catch (err) {
        console.warn("[Urbanrat Store] Auth cart sync skipped:", err);
      }
    }

    syncAuthCart();
    return () => {
      isMounted = false;
    };
  }, [configured]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [popularSearches, setPopularSearches] = useState<string[]>([]);

  // Load dynamic popular search suggestions from store_settings
  useEffect(() => {
    if (!configured) return;
    fetchStoreSettings().then((settings) => {
      if (settings.popular_searches && settings.popular_searches.length > 0) {
        setPopularSearches(settings.popular_searches);
      }
    });
  }, [configured]);

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Debounced live search against Supabase
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchProducts({
          search: searchQuery.trim(),
          limit: 8,
        });
        setSearchResults(res.products);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function handleAddToCart(product: Product, quantity = 1) {
    triggerHaptic("success");
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });

    setToastMessage(`Added "${product.name.slice(0, 24)}..." to cart`);
    setTimeout(() => setToastMessage(null), 2500);
  }

  function handleUpdateQuantity(productId: string, quantity: number) {
    triggerHaptic("light");
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }

  function handleRemoveItem(productId: string) {
    triggerHaptic("medium");
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  }

  function handleClearCart() {
    setCartItems([]);
  }

  function handleSelectSearchResult(slug: string) {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(`/product/${slug}`);
  }

  // Enforce zero mock fallback: if Supabase is unconfigured, display StoreNotConfigured screen
  if (!configured) {
    return <StoreNotConfigured />;
  }

  return (
    <div className="min-h-dvh bg-[#F8F9FB] flex flex-col font-sans text-slate-900 antialiased selection:bg-[#5ADBE5]/30">
      {/* ── Auto Scroll to Top on every route change ── */}
      <ScrollToTop />

      {/* ── Glassmorphism Top Bar (relative on mobile, fixed on desktop) ── */}
      <TopBar
        cartCount={totalCartCount}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* ── Fixed Floating Navigation Dock (Mobile Only) ── */}
      <NavigationDock />

      {/* ── Main Content Container ── */}
      <main className="flex-1 w-full max-w-7xl 2xl:max-w-[1780px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 pt-20 sm:pt-22 md:pt-24 pb-28 sm:pb-32">
        <Routes>
          <Route path="/" element={<HomePage onAddToCart={handleAddToCart} />} />
          <Route
            path="/marketplace"
            element={
              <MarketplacePage
                onAddToCart={handleAddToCart}
                cartCount={totalCartCount}
              />
            }
          />
          <Route path="/categories" element={<CategoriesPage onAddToCart={handleAddToCart} />} />
          <Route
            path="/urbanrat"
            element={
              <UrbanratPage
                onAddToCart={handleAddToCart}
                cartCount={totalCartCount}
              />
            }
          />
          <Route path="/menu" element={<MenuPage />} />
          <Route
            path="/product/:slug"
            element={<ProductDetailPage onAddToCart={handleAddToCart} />}
          />
          <Route
            path="/cart"
            element={
              <CartPage
                cartItems={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onClearCart={handleClearCart}
              />
            }
          />
          <Route path="/order/:orderId" element={<OrderPage />} />
        </Routes>
      </main>

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-top-2 bg-[#0A82A8]">
          {toastMessage}
        </div>
      )}

      {/* ── Search Modal Drawer with Instant Supabase Results ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/45 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2.5 flex-1 mr-3">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, chargers, cables..."
                  className="w-full text-xs sm:text-sm bg-transparent outline-none placeholder:text-slate-400 font-medium"
                />
                {searching && <Loader2 className="w-3.5 h-3.5 text-[#0A82A8] animate-spin shrink-0" />}
              </div>

              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Popular Search Suggestions from store_settings */}
            {!searchQuery.trim() && popularSearches.length > 0 && (
              <div className="space-y-2 py-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Popular Searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {popularSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setSearchQuery(term)}
                      className="px-3 py-1.5 rounded-full text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 font-medium transition cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live Search Results */}
            <div className="max-h-80 overflow-y-auto space-y-2 no-scrollbar">
              {searchResults.length > 0 ? (
                searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleSelectSearchResult(product.slug)}
                    className="w-full flex items-center space-x-3 p-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition text-left cursor-pointer group"
                  >
                    <img
                      src={product.images[0] || ""}
                      alt={product.name}
                      className="w-12 h-12 rounded-xl object-contain bg-slate-100 border border-slate-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-[#0A82A8] truncate transition-colors">
                        {product.name}
                      </p>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-xs font-black text-slate-900">
                          ₹{product.price.toLocaleString("en-IN")}
                        </span>
                        {product.is_urbanrat_brand && (
                          <span className="text-[10px] font-bold text-[#0A82A8] bg-[#5ADBE5]/15 px-1.5 py-0.2 rounded">
                            Urbanrat
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0A82A8] group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))
              ) : searchQuery.trim() ? (
                <div className="text-center py-8">
                  {searching ? (
                    <p className="text-xs text-slate-400">Searching inventory...</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-700">No matching accessories found</p>
                      <p className="text-[11px] text-slate-400">Try searching "iPhone", "charger", or "cable"</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
