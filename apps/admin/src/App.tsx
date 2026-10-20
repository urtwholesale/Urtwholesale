import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { AdminLogin } from "./features/auth/AdminLogin";
import { DashboardOverview } from "./features/dashboard/DashboardOverview";
import { ProductList } from "./features/products/ProductList";
import { OrderList } from "./features/orders/OrderList";
import { ContentEditor } from "./features/content/ContentEditor";
import { SettingsEditor } from "./features/settings/SettingsEditor";
import type { Profile } from "@urbanrat/shared";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Layers,
  Settings,
  LogOut,
  Building2,
  ChevronDown,
  Search,
  ExternalLink,
  Menu,
  X,
  Radio,
  ShieldCheck,
} from "lucide-react";

type NavTab = "dashboard" | "products" | "orders" | "content" | "settings";

export default function App() {
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [liveSyncEnabled, setLiveSyncEnabled] = useState(true);
  const [counts, setCounts] = useState<{ products: number; pendingOrders: number }>({
    products: 0,
    pendingOrders: 0,
  });

  useEffect(() => {
    async function checkCurrentAdmin() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (profile && profile.role === "admin") {
            setAdminProfile(profile as Profile);
          } else {
            // Not an admin, clear session
            await supabase.auth.signOut().catch(() => {});
            setAdminProfile(null);
          }
        }
      } catch {
        setAdminProfile(null);
      } finally {
        setCheckingSession(false);
      }
    }

    checkCurrentAdmin();
  }, []);

  // Fetch live counts for sidebar badges
  useEffect(() => {
    async function loadCounts() {
      try {
        const [{ count: prodCount }, { count: orderCount }] = await Promise.all([
          supabase.from("products").select("id", { count: "exact", head: true }),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
        ]);
        setCounts({
          products: prodCount ?? 0,
          pendingOrders: orderCount ?? 0,
        });
      } catch {
        // silently fallback
      }
    }

    if (adminProfile) {
      loadCounts();
    }
  }, [adminProfile, activeTab]);

  async function handleSignOut() {
    await supabase.auth.signOut().catch(() => {});
    setAdminProfile(null);
  }

  function handleNavClick(tab: NavTab) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  }

  if (checkingSession) {
    return (
      <div className="min-h-dvh bg-[#ECEEED] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-3 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80">
          <img
            src="/logo.png"
            alt="Urbanrat Admin"
            className="w-12 h-12 rounded-full object-cover shadow-sm animate-pulse"
          />
          <p className="text-xs text-slate-500 font-semibold tracking-wide">
            Verifying Administrator Session...
          </p>
        </div>
      </div>
    );
  }

  if (!adminProfile) {
    return (
      <div className="min-h-dvh bg-[#ECEEED] flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md">
          <AdminLogin onSuccess={(profile) => setAdminProfile(profile)} />
        </div>
      </div>
    );
  }

  const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: "Dashboard Overview",
      subtitle: "Executive Analytics, RPC Revenue Metrics & Live Trajectory",
    },
    products: {
      title: "Products & Inventory",
      subtitle: "B2B Catalog Management, Wholesale Price Tiers & Stock Adjustments",
    },
    orders: {
      title: "Orders & Fulfillment",
      subtitle: "Strict RPC Status Workflow, GST Tax Invoices & Order Timeline",
    },
    content: {
      title: "Promotional Content",
      subtitle: "Hero Banners, Policy Store Pages & Trending Search Keywords",
    },
    settings: {
      title: "Store Settings & Security",
      subtitle: "Admin Credentials, Wholesale MOQs, Free Shipping & GST Configuration",
    },
  };

  return (
    <div className="min-h-screen bg-[#ECEEED] text-slate-800 font-sans antialiased p-3 sm:p-4 lg:p-6 flex flex-col md:flex-row gap-4 lg:gap-6">
      {/* ── Mobile Top Header (Screens < md) ── */}
      <div className="md:hidden flex items-center justify-between bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <img
            src="/logo.png"
            alt="Urbanrat"
            className="w-8 h-8 rounded-full object-cover shadow-xs"
          />
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 leading-tight">
              Urbanrat Admin
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Pan-India Wholesale</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ── Left Sidebar Navigation (LeaseFlow Inspired UI) ── */}
      <aside
        className={`fixed md:sticky top-3 md:top-6 z-50 md:z-20 w-[calc(100%-1.5rem)] sm:w-80 md:w-64 lg:w-72 shrink-0 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 md:h-[calc(100vh-3rem)] ${
          mobileMenuOpen
            ? "left-3 right-3 max-h-[92vh] overflow-y-auto"
            : "-left-full md:left-auto hidden md:flex"
        }`}
      >
        <div className="space-y-5">
          {/* ── Brand Header ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <img
                src="/logo.png"
                alt="Urbanrat"
                className="w-10 h-10 rounded-full object-cover shadow-xs"
              />
              <div>
                <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-tight">
                  Urbanrat
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  Wholesale Suite
                </span>
              </div>
            </div>

            <div className="md:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Warehouse / Hub Switcher Dropdown Card (Like Harborline in reference) ── */}
          <div className="bg-slate-50 hover:bg-slate-100/90 border border-slate-200/70 p-2.5 rounded-2xl flex items-center justify-between cursor-pointer transition group">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-brand-dark shadow-2xs shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-800 truncate leading-tight group-hover:text-slate-900">
                  Main Wholesale Hub
                </p>
                <p className="text-[10px] text-slate-400 font-medium truncate">
                  Pan-India Central • Live
                </p>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 group-hover:text-slate-600" />
          </div>

          {/* ── Navigation Links (Matching Reference Active Pill Treatment) ── */}
          <nav className="space-y-4">
            {/* Main Item: Dashboard */}
            <div>
              <button
                type="button"
                onClick={() => handleNavClick("dashboard")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-[#0B1E28] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <LayoutDashboard
                    className={`w-4 h-4 ${
                      activeTab === "dashboard" ? "text-brand-light" : "text-slate-500"
                    }`}
                  />
                  <span>Dashboard</span>
                </div>
              </button>
            </div>

            {/* Category 1: COMMERCE & SALES */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 pt-1 pb-1">
                Commerce &amp; Sales
              </p>

              {/* Products */}
              <button
                type="button"
                onClick={() => handleNavClick("products")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "products"
                    ? "bg-[#0B1E28] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Package
                    className={`w-4 h-4 ${
                      activeTab === "products" ? "text-brand-light" : "text-slate-500"
                    }`}
                  />
                  <span>Products</span>
                </div>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    activeTab === "products"
                      ? "bg-brand-light/20 text-brand-light border border-brand-light/30"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {counts.products > 0 ? counts.products : "—"}
                </span>
              </button>

              {/* Orders */}
              <button
                type="button"
                onClick={() => handleNavClick("orders")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "orders"
                    ? "bg-[#0B1E28] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <ShoppingBag
                    className={`w-4 h-4 ${
                      activeTab === "orders" ? "text-brand-light" : "text-slate-500"
                    }`}
                  />
                  <span>Orders</span>
                </div>
                {counts.pendingOrders > 0 ? (
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      activeTab === "orders"
                        ? "bg-amber-400 text-slate-900"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {counts.pendingOrders} new
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeTab === "orders"
                        ? "bg-brand-light/20 text-brand-light"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    Live
                  </span>
                )}
              </button>
            </div>

            {/* Category 2: STOREFRONT & WORKSPACE */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 pt-1 pb-1">
                Storefront &amp; Workspace
              </p>

              {/* Content */}
              <button
                type="button"
                onClick={() => handleNavClick("content")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "content"
                    ? "bg-[#0B1E28] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Layers
                    className={`w-4 h-4 ${
                      activeTab === "content" ? "text-brand-light" : "text-slate-500"
                    }`}
                  />
                  <span>Content</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activeTab === "content"
                      ? "bg-brand-light/20 text-brand-light"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Media
                </span>
              </button>

              {/* Store Settings */}
              <button
                type="button"
                onClick={() => handleNavClick("settings")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-[#0B1E28] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Settings
                    className={`w-4 h-4 ${
                      activeTab === "settings" ? "text-brand-light" : "text-slate-500"
                    }`}
                  />
                  <span>Store Settings</span>
                </div>
              </button>
            </div>
          </nav>
        </div>

        {/* ── Bottom Sidebar Elements (Status Card & Profile) ── */}
        <div className="pt-4 space-y-3 border-t border-slate-100 mt-4">
          {/* Live Sync Badge Pill (Matching the reference's LeaseFlow AI status card) */}
          <div
            className="p-3 rounded-2xl border transition-all flex items-center justify-between"
            style={{
              background: liveSyncEnabled
                ? "linear-gradient(135deg, rgba(90,219,229,0.18), rgba(10,130,168,0.14))"
                : "#F8F9FA",
              borderColor: liveSyncEnabled ? "rgba(90,219,229,0.4)" : "#E2E8F0",
            }}
          >
            <div className="flex items-center space-x-2.5">
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-white shadow-2xs ${
                  liveSyncEnabled ? "bg-brand-dark" : "bg-slate-400"
                }`}
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-900 leading-tight">
                  Urbanrat Cloud
                </p>
                <p className="text-[9px] text-slate-500 font-medium">
                  {liveSyncEnabled ? "Supabase Live • Active" : "Paused"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLiveSyncEnabled(!liveSyncEnabled)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                liveSyncEnabled ? "bg-brand-dark" : "bg-slate-300"
              }`}
              aria-label="Toggle live sync status"
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${
                  liveSyncEnabled ? "right-1" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Admin Profile Row */}
          <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 border border-slate-200/60">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs"
                style={{ background: "linear-gradient(135deg, #5ADBE5, #0A82A8)" }}
              >
                SJ
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                  {adminProfile.full_name || "Sjainthelegend"}
                </p>
                <p className="text-[10px] text-slate-400 font-medium truncate flex items-center space-x-1">
                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 inline" />
                  <span>Super Admin</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              title="Sign Out"
              className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Workspace Content Area (Right Side) ── */}
      <main className="flex-1 flex flex-col gap-4 sm:gap-5 min-w-0 overflow-hidden">
        {/* Top Header Bar (Matching the search & action bar in reference) */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {tabTitles[activeTab].title}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {tabTitles[activeTab].subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Pill */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Global admin lookup..."
                className="pl-8 pr-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs w-44 sm:w-52 focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white transition"
              />
            </div>

            {/* Hub Pill */}
            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
              <Building2 className="w-3.5 h-3.5 text-brand-dark" />
              <span>All Depots</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>

            {/* Live Storefront Link */}
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs transition"
            >
              <ExternalLink className="w-3 h-3 text-brand-dark" />
              <span className="hidden sm:inline">View Store</span>
            </a>
          </div>
        </header>

        {/* Tab Content Views */}
        <div className="flex-1">
          {activeTab === "dashboard" && <DashboardOverview />}
          {activeTab === "products" && <ProductList />}
          {activeTab === "orders" && <OrderList />}
          {activeTab === "content" && <ContentEditor />}
          {activeTab === "settings" && <SettingsEditor />}
        </div>
      </main>
    </div>
  );
}
