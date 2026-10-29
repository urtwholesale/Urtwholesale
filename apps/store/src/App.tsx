import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router";
import type { Product } from "@urbanrat/shared";
import {
  isSupabaseConfigured,
  searchProducts,
  PRODUCT_SELECT,
  formatProduct,
} from "./services/storeService";
import { supabase } from "./lib/supabase";
import { useSettings } from "./context/SettingsContext";
import { StoreNotConfigured } from "./components/StoreNotConfigured";
import { TopBar } from "./components/TopBar";
import { NavigationDock } from "./components/NavigationDock";
import { StoreMenuDrawer } from "./components/StoreMenuDrawer";
import { HomePage } from "./pages/HomePage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { UrbanratPage } from "./pages/UrbanratPage";
import { MenuPage } from "./pages/MenuPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { CartPage } from "./pages/CartPage";
import { OrderPage } from "./pages/OrderPage";
import { PolicyPage } from "./pages/PolicyPage";
import { MyOrdersPage } from "./pages/MyOrdersPage";
import { DealerApplicationPage } from "./pages/DealerApplicationPage";
import { LoginPage } from "./pages/LoginPage";
import { AccountPage } from "./pages/AccountPage";
import { AddressesPage } from "./pages/AddressesPage";
import { ReturnsPage } from "./pages/ReturnsPage";
import { ReturnDetailPage } from "./pages/ReturnDetailPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
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
  selectedColor?: string;
}

const GUEST_CART_KEY = "urt_guest_cart";

export default function App() {
  const navigate = useNavigate();
  const { settings } = useSettings();

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

  // On load: re-fetch each cart product and re-price/re-validate against live data
  useEffect(() => {
    if (!configured) return;
    let isMounted = true;

    async function revalidateCart() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        let itemsToValidate = cartItems;

        // If user is authenticated, check for items saved in public.cart_items
        if (auth?.user) {
          // If guest had local items, merge them into public.cart_items
          if (cartItems.length > 0) {
            for (const item of cartItems) {
              await supabase.from("cart_items").upsert(
                {
                  user_id: auth.user.id,
                  product_id: item.product.id,
                  quantity: item.quantity,
                },
                { onConflict: "user_id,product_id" }
              );
            }
          }

          const { data: dbCart, error: dbError } = await supabase
            .from("cart_items")
            .select(`quantity, products(${PRODUCT_SELECT})`)
            .eq("user_id", auth.user.id);

          if (!dbError && dbCart && dbCart.length > 0) {
            itemsToValidate = dbCart
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((row: any) => row.products)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((row: any) => ({
                product: formatProduct(row.products),
                quantity: row.quantity,
              }));
          }
        }

        if (itemsToValidate.length === 0) return;

        // Extract product IDs to query fresh live data
        const productIds = Array.from(
          new Set(itemsToValidate.map((item) => item.product.id))
        );

        const { data: freshProducts, error: prodError } = await supabase
          .from("products")
          .select(PRODUCT_SELECT)
          .in("id", productIds)
          .eq("is_active", true);

        if (prodError || !freshProducts) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liveMap = new Map<string, Product>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        freshProducts.forEach((p: any) => {
          liveMap.set(p.id, formatProduct(p));
        });

        const validated: CartStateItem[] = [];
        for (const item of itemsToValidate) {
          const live = liveMap.get(item.product.id);
          // If product was deleted, inactive, or stock is 0, drop it
          if (!live || live.stock <= 0) continue;

          const firstTierMin = live.price_tiers?.[0]?.min_qty;
          const minQty = Math.max(1, live.min_order_qty || firstTierMin || 1);
          const step = live.order_qty_step || 1;
          let qty = item.quantity;

          // Clamp to available stock
          if (qty > live.stock) qty = live.stock;
          // Ensure min_order_qty
          if (qty < minQty) qty = minQty;
          // Align with order_qty_step
          if (step > 1) {
            const remainder = qty % step;
            if (remainder !== 0) {
              qty = Math.max(minQty, qty - remainder);
            }
          }

          validated.push({
            product: live,
            quantity: qty,
          });
        }

        if (isMounted) {
          setCartItems(validated);
        }
      } catch (err) {
        console.warn("[Urbanrat Store] Cart live re-validation skipped:", err);
      }
    }

    revalidateCart();
    return () => {
      isMounted = false;
    };
  }, [configured]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  // Read popular searches dynamically from store_settings
  const popularSearches = settings?.popular_searches || [];

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Debounced live search against Supabase using trigram RPC searchProducts
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchProducts(searchQuery.trim(), 8);
        setSearchResults(results);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function handleAddToCart(product: Product, quantity?: number, selectedColor?: string) {
    triggerHaptic("success");
    const firstTierMin = product.price_tiers?.[0]?.min_qty;
    const resolvedMin = Math.max(10, product.min_order_qty || firstTierMin || 10);
    const qtyToAdd = quantity !== undefined ? quantity : resolvedMin;
    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && (item.selectedColor || "") === (selectedColor || "")
      );
      let newQty = qtyToAdd;
      if (existingIndex > -1) {
        const updated = [...prev];
        const existing = updated[existingIndex]!;
        newQty = existing.quantity + qtyToAdd;
        const clampedQty = product.stock ? Math.min(newQty, product.stock) : newQty;
        updated[existingIndex] = {
          ...existing,
          quantity: clampedQty,
        };
        syncDbCart(product.id, clampedQty);
        return updated;
      }
      syncDbCart(product.id, newQty);
      return [...prev, { product, quantity: newQty, selectedColor }];
    });

    const colorLabel = selectedColor ? ` (${selectedColor})` : "";
    setToastMessage(`Added ${qtyToAdd} × ${product.name}${colorLabel} to cart`);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  }

  function syncDbCart(productId: string, quantity: number) {
    supabase.auth.getUser().then(({ data: auth }) => {
      if (!auth?.user) return;
      if (quantity <= 0) {
        supabase
          .from("cart_items")
          .delete()
          .match({ user_id: auth.user.id, product_id: productId })
          .then(() => {});
      } else {
        supabase
          .from("cart_items")
          .upsert(
            { user_id: auth.user.id, product_id: productId, quantity },
            { onConflict: "user_id,product_id" }
          )
          .then(() => {});
      }
    }).catch(() => {});
  }

  function handleUpdateQuantity(productId: string, quantity: number, selectedColor?: string) {
    if (quantity <= 0) {
      handleRemoveItem(productId, selectedColor);
      return;
    }
    syncDbCart(productId, quantity);
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === productId && (item.selectedColor || "") === (selectedColor || "")
          ? { ...item, quantity }
          : item
      )
    );
  }

  function handleRemoveItem(productId: string, selectedColor?: string) {
    syncDbCart(productId, 0);
    setCartItems((prev) =>
      prev.filter(
        (item) => !(item.product.id === productId && (item.selectedColor || "") === (selectedColor || ""))
      )
    );
  }

  function handleClearCart() {
    setCartItems([]);
    try {
      localStorage.removeItem(GUEST_CART_KEY);
    } catch {
      // Ignore
    }
    supabase.auth.getUser().then(({ data: auth }) => {
      if (!auth?.user) return;
      supabase.from("cart_items").delete().eq("user_id", auth.user.id).then(() => {});
    }).catch(() => {});
  }

  if (!configured) {
    return <StoreNotConfigured />;
  }

  return (
    <div className="min-h-screen bg-surface text-slate-800 flex flex-col font-sans antialiased pb-24 selection:bg-brand-light/30">
      <ScrollToTop />

      {/* ── Fixed Glassmorphism Top Navigation Bar ── */}
      <TopBar
        cartCount={totalCartCount}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenMenu={() => setMenuDrawerOpen(true)}
      />

      {/* ── Main Routed Page Content ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-36">
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
          <Route
            path="/categories"
            element={<CategoriesPage onAddToCart={handleAddToCart} />}
          />
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

          {/* ── Customer Auth, Account & Saved Addresses ── */}
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/addresses"
            element={
              <ProtectedRoute>
                <AddressesPage />
              </ProtectedRoute>
            }
          />

          {/* ── Independent Customer Order Tracking & Invoices ── */}
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <MyOrdersPage onAddToCart={handleAddToCart} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-orders"
            element={
              <ProtectedRoute>
                <MyOrdersPage onAddToCart={handleAddToCart} />
              </ProtectedRoute>
            }
          />

          {/* ── Wholesale Returns & Replacements (Customer Portal) ── */}
          <Route
            path="/returns"
            element={
              <ProtectedRoute>
                <ReturnsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/returns/:returnId"
            element={
              <ProtectedRoute>
                <ReturnDetailPage />
              </ProtectedRoute>
            }
          />

          {/* ── Independent Authorized Dealer Program ── */}
          <Route path="/dealers" element={<DealerApplicationPage />} />
          <Route path="/become-a-dealer" element={<DealerApplicationPage />} />

          {/* ── Independent Policy & Information Pages ── */}
          <Route path="/about" element={<PolicyPage initialSlug="about" />} />
          <Route path="/terms" element={<PolicyPage initialSlug="terms" />} />
          <Route path="/privacy" element={<PolicyPage initialSlug="privacy" />} />
          <Route path="/shipping" element={<PolicyPage initialSlug="shipping" />} />
          <Route path="/returns-policy" element={<PolicyPage initialSlug="returns" />} />
          <Route path="/warranty" element={<PolicyPage initialSlug="warranty" />} />
          <Route path="/wholesale-terms" element={<PolicyPage initialSlug="wholesale-terms" />} />
          <Route path="/contact" element={<PolicyPage initialSlug="contact" />} />
          <Route path="/page/:slug" element={<PolicyPage />} />

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
          <Route path="/order/:orderId" element={<OrderPage onAddToCart={handleAddToCart} />} />
          <Route path="/order" element={<OrderPage onAddToCart={handleAddToCart} />} />
        </Routes>
      </main>

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-top-2 bg-brand-dark">
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
                {searching && <Loader2 className="w-3.5 h-3.5 text-brand-dark animate-spin shrink-0" />}
              </div>

              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Popular Search Suggestions from store_settings (hidden if empty) */}
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
            {searchQuery.trim() && (
              <div className="max-h-80 overflow-y-auto space-y-2 pt-1 divide-y divide-slate-100">
                {searchResults.length > 0 ? (
                  searchResults.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                        navigate(`/product/${product.slug}`);
                      }}
                      className="pt-2 pb-2 first:pt-0 flex items-center justify-between hover:bg-slate-50 rounded-xl p-2 transition cursor-pointer"
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        {product.images[0] && (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {product.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            ₹{product.price.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                  ))
                ) : (
                  !searching && (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No matching products found for "{searchQuery}"
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Fixed Glassmorphism Bottom Navigation Dock ── */}
      <NavigationDock
        onOpenMenu={() => setMenuDrawerOpen((prev) => !prev)}
        isMenuOpen={menuDrawerOpen}
      />

      {/* ── Actual Navigation Menu Drawer with Auth Actions ── */}
      <StoreMenuDrawer
        isOpen={menuDrawerOpen}
        onClose={() => setMenuDrawerOpen(false)}
        cartCount={totalCartCount}
      />
    </div>
  );
}
