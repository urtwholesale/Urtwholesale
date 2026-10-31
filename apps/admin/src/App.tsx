import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { AdminLogin } from "./features/auth/AdminLogin";
import { DashboardOverview } from "./features/dashboard/DashboardOverview";
import { ProductList } from "./features/products";
import { OrderList } from "./features/orders/OrderList";
import { ReturnsHome } from "./features/returns";
import { ContentEditor } from "./features/content/ContentEditor";
import { SettingsEditor } from "./features/settings/SettingsEditor";
import { CatalogUploadHome, CategoryManager, ImageBulkUploadPage } from "./features/catalog";
import { ReviewModerationList } from "./features/reviews/ReviewModerationList";
import {
  fetchPendingReturnsBadgeCount,
  fetchAdminReviewCounts,
} from "./lib/adminService";
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
  ChevronRight,
  FileSpreadsheet,
  FolderTree,
  RotateCcw,
  ImageIcon,
  Star,
} from "lucide-react";
import { AdminNavigationDock } from "./components/AdminNavigationDock";
import { initGlobalHaptics, triggerHaptic } from "./utils/haptics";

type NavTab =
  | "dashboard"
  | "categories"
  | "catalog"
  | "image_bulk_upload"
  | "products"
  | "orders"
  | "returns"
  | "reviews"
  | "content"
  | "settings";

export default function App() {
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [liveSyncEnabled, setLiveSyncEnabled] = useState(true);
  const [counts, setCounts] = useState<{
    products: number;
    pendingOrders: number;
    pendingReturns: number;
    pendingReviews: number;
  }>({
    products: 0,
    pendingOrders: 0,
    pendingReturns: 0,
    pendingReviews: 0,
  });

  useEffect(() => {
    const cleanup = initGlobalHaptics();
    return cleanup;
  }, []);

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
        const [{ count: prodCount }, { count: orderCount }, returnsBadge, reviewCounts] =
          await Promise.all([
            supabase
              .from("products")
              .select("id", { count: "exact", head: true }),
            supabase
              .from("orders")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending"),
            fetchPendingReturnsBadgeCount(),
            fetchAdminReviewCounts().catch(() => ({ pending: 0, approved: 0, rejected: 0, total: 0 })),
          ]);
        setCounts({
          products: prodCount ?? 0,
          pendingOrders: orderCount ?? 0,
          pendingReturns: returnsBadge?.total_pending ?? 0,
          pendingReviews: reviewCounts?.pending ?? 0,
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
    categories: {
      title: "Category Hierarchy & Attributes",
      subtitle: "Multi-level 4-tier tree browser, product specifications & ordering",
    },
    catalog: {
      title: "Upload Catalog",
      subtitle: "Category-wise Single & Bulk Onboarding with Real-time QC Verification",
    },
    image_bulk_upload: {
      title: "Image Bulk Upload",
      subtitle: "Upload product images, automatic SKU matching, WebP compression & CDN link generator",
    },
    products: {
      title: "Products & Inventory",
      subtitle: "B2B Catalog Management, Wholesale Price Tiers & Stock Adjustments",
    },
    orders: {
      title: "Orders & Fulfillment",
      subtitle: "Strict RPC Status Workflow, GST Tax Invoices & Order Timeline",
    },
    returns: {
      title: "Return & RTO Orders",
      subtitle: "Reverse Logistics, Customer RMA Inspection & Carrier Claims",
    },
    reviews: {
      title: "Review Approvals & Moderation",
      subtitle: "Verified Wholesale Buyer Feedback, Star Filtering & Single-Click Moderation",
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
    <div className="min-h-screen bg-[#ECEEED] text-slate-800 font-sans antialiased p-3 sm:p-4 lg:p-6 flex flex-col md:flex-row gap-4 lg:gap-6 pb-28 md:pb-6">
      {/* ── Mobile Top Header (Screens < md, Sticky Frosted Glass Capsule) ── */}
      <div className="md:hidden sticky top-2 z-30 flex items-center justify-between bg-white/90 backdrop-blur-md rounded-2xl p-2 sm:p-2.5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] mb-1">
        <div className="flex items-center space-x-2.5">
          <img
            src="/logo.png"
            alt="Urbanrat"
            className="w-9 h-9 rounded-full object-cover shadow-xs border border-slate-100"
          />
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-sm font-extrabold text-slate-900 leading-tight">
                Urbanrat Admin
              </h1>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand-light/20 text-brand-dark">
                Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Pan-India Wholesale Depot</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Live Storefront Link */}
          <a
            href={import.meta.env.PROD ? "/" : "http://localhost:5173"}
            target="_blank"
            rel="noreferrer"
            aria-label="View Customer Storefront"
            title="Open Customer Storefront"
            className="w-9 h-9 rounded-full bg-white border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center justify-center text-slate-700 hover:text-brand-dark hover:shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 stroke-2" />
          </a>

          {/* Quick Hub & Profile Menu Toggle */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            className={`h-9 px-3 rounded-full flex items-center space-x-1.5 text-xs font-bold border transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
              mobileMenuOpen
                ? "bg-brand-dark text-white border-brand-dark"
                : "bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50"
            }`}
            aria-label="Toggle Navigation Menu"
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white bg-brand-dark">
              SJ
            </div>
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Mobile Slide-Up Menu Drawer (Customer Store Style) ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center animate-in fade-in duration-200">
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity cursor-pointer"
            aria-hidden="true"
          />

          <div
            className="relative z-10 w-full bg-white rounded-t-4xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 border border-slate-100"
            role="dialog"
            aria-modal="true"
            aria-label="Admin Quick Menu"
          >
            {/* Drag Handle */}
            <div className="pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* Drawer Header */}
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src="/logo.png"
                  alt="Urbanrat"
                  className="w-10 h-10 rounded-full object-cover shadow-xs border border-slate-100"
                />
                <div>
                  <h2 className="text-sm font-black text-slate-900 tracking-tight">
                    Urbanrat Control Panel
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Depot management &amp; global workspace
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition cursor-pointer"
                aria-label="Close Menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {/* ── Wholesale Admin Workspace Navigation (Matching StoreMenuDrawer) ── */}
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 pb-1">
                  Workspace Views
                </p>

                <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                  {/* Dashboard */}
                  <button
                    type="button"
                    onClick={() => handleNavClick("dashboard")}
                    className={`w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer ${
                      activeTab === "dashboard" ? "bg-slate-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          activeTab === "dashboard"
                            ? "bg-brand-dark text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <LayoutDashboard className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Dashboard Overview
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Executive metrics &amp; sales charts
                        </span>
                      </div>
                    </div>
                    {activeTab === "dashboard" ? (
                      <span className="text-[10px] font-bold text-brand-dark bg-brand-light/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    )}
                  </button>

                  {/* Catalog Group with Sub-Items */}
                  <div className="bg-slate-50/70 border-y border-slate-100/80 px-3 py-1.5 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-3.5 h-3.5 text-brand-dark" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                        Catalog
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400">
                      Hierarchy &amp; Upload
                    </span>
                  </div>

                  {/* Sub-item: Categories */}
                  <button
                    type="button"
                    onClick={() => handleNavClick("categories")}
                    className={`w-full flex items-center justify-between p-3 pl-5 hover:bg-slate-50 transition text-left cursor-pointer border-b border-slate-100/60 ${
                      activeTab === "categories" ? "bg-slate-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          activeTab === "categories"
                            ? "bg-brand-dark text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <FolderTree className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Categories
                        </span>
                        <span className="text-[10px] text-slate-400">
                          4-Level tree, reorder &amp; attributes
                        </span>
                      </div>
                    </div>
                    {activeTab === "categories" ? (
                      <span className="text-[10px] font-bold text-brand-dark bg-brand-light/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    )}
                  </button>

                  {/* Sub-item: Upload Catalog */}
                  <button
                    type="button"
                    onClick={() => handleNavClick("catalog")}
                    className={`w-full flex items-center justify-between p-3 pl-5 hover:bg-slate-50 transition text-left cursor-pointer border-b border-slate-100/60 ${
                      activeTab === "catalog" ? "bg-slate-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          activeTab === "catalog"
                            ? "bg-brand-dark text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Upload Catalog
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Single &amp; bulk onboarding with QC checks
                        </span>
                      </div>
                    </div>
                    {activeTab === "catalog" ? (
                      <span className="text-[10px] font-bold text-brand-dark bg-brand-light/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        New
                      </span>
                    )}
                  </button>

                  {/* Sub-item: Image Bulk Upload */}
                  <button
                    type="button"
                    onClick={() => handleNavClick("image_bulk_upload")}
                    className={`w-full flex items-center justify-between p-3 pl-5 hover:bg-slate-50 transition text-left cursor-pointer ${
                      activeTab === "image_bulk_upload" ? "bg-slate-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          activeTab === "image_bulk_upload"
                            ? "bg-brand-dark text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Image Bulk Upload
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Bulk image links &amp; WebP optimization
                        </span>
                      </div>
                    </div>
                    {activeTab === "image_bulk_upload" ? (
                      <span className="text-[10px] font-bold text-brand-dark bg-brand-light/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase text-brand-dark bg-brand-light/20 border border-brand-light/40 px-1.5 py-0.5 rounded">
                        New
                      </span>
                    )}
                  </button>

                  {/* Products */}
                  <button
                    type="button"
                    onClick={() => handleNavClick("products")}
                    className={`w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer ${
                      activeTab === "products" ? "bg-slate-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          activeTab === "products"
                            ? "bg-brand-dark text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Products &amp; Inventory
                        </span>
                        <span className="text-[10px] text-slate-400">
                          B2B tiered pricing &amp; stock levels
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {counts.products > 0 && (
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          {counts.products}
                        </span>
                      )}
                      {activeTab === "products" ? (
                        <span className="text-[10px] font-bold text-brand-dark bg-brand-light/20 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </button>

                  {/* Orders */}
                  <button
                    type="button"
                    onClick={() => handleNavClick("orders")}
                    className={`w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer ${
                      activeTab === "orders" ? "bg-slate-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          activeTab === "orders"
                            ? "bg-brand-dark text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Orders &amp; Dispatch
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Strict RPC pipeline &amp; GST tax invoices
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {counts.pendingOrders > 0 && (
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-200 px-2 py-0.5 rounded-full">
                          {counts.pendingOrders} pending
                        </span>
                      )}
                      {activeTab === "orders" ? (
                        <span className="text-[10px] font-bold text-brand-dark bg-brand-light/20 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </button>

                  {/* Returns */}
                  <button
                    type="button"
                    onClick={() => handleNavClick("returns")}
                    className={`w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer ${
                      activeTab === "returns" ? "bg-slate-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          activeTab === "returns"
                            ? "bg-brand-dark text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Returns &amp; Quality
                        </span>
                        <span className="text-[10px] text-slate-400">
                          RMA inspection &amp; courier claims
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {counts.pendingReturns > 0 && (
                        <span className="text-[10px] font-bold text-rose-900 bg-rose-200 px-2 py-0.5 rounded-full">
                          {counts.pendingReturns} new
                        </span>
                      )}
                      {activeTab === "returns" ? (
                        <span className="text-[10px] font-bold text-brand-dark bg-brand-light/20 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </button>

                  {/* Reviews & Approvals */}
                  <button
                    type="button"
                    onClick={() => handleNavClick("reviews")}
                    className={`w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer ${
                      activeTab === "reviews" ? "bg-slate-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          activeTab === "reviews"
                            ? "bg-amber-500 text-white shadow-2xs"
                            : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Reviews &amp; Approvals
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Moderation &amp; star approval
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {counts.pendingReviews > 0 && (
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-200 px-2 py-0.5 rounded-full">
                          {counts.pendingReviews} pending
                        </span>
                      )}
                      {activeTab === "reviews" ? (
                        <span className="text-[10px] font-bold text-brand-dark bg-brand-light/20 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </button>

                  {/* Content */}
                  <button
                    type="button"
                    onClick={() => handleNavClick("content")}
                    className={`w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer ${
                      activeTab === "content" ? "bg-slate-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          activeTab === "content"
                            ? "bg-brand-dark text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Promotional Content
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Hero banners, pages &amp; trending tags
                        </span>
                      </div>
                    </div>
                    {activeTab === "content" ? (
                      <span className="text-[10px] font-bold text-brand-dark bg-brand-light/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    )}
                  </button>

                  {/* Settings */}
                  <button
                    type="button"
                    onClick={() => handleNavClick("settings")}
                    className={`w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer ${
                      activeTab === "settings" ? "bg-slate-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          activeTab === "settings"
                            ? "bg-brand-dark text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <Settings className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Store Settings &amp; Security
                        </span>
                        <span className="text-[10px] text-slate-400">
                          MOQs, free shipping, tax &amp; admin profile
                        </span>
                      </div>
                    </div>
                    {activeTab === "settings" ? (
                      <span className="text-[10px] font-bold text-brand-dark bg-brand-light/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    )}
                  </button>
                </div>
              </div>

              {/* Warehouse / Hub Switcher */}
              <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-brand-dark shadow-2xs shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      Main Wholesale Hub
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      Pan-India Central Depot • Active
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Primary
                </span>
              </div>

              {/* Live Cloud Sync Card */}
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
                      {liveSyncEnabled ? "Supabase Live • Real-time" : "Paused"}
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

              {/* Customer Storefront Link */}
              <a
                href={import.meta.env.PROD ? "/" : "http://localhost:5173"}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-800 transition cursor-pointer"
              >
                <div className="flex items-center space-x-2.5">
                  <ExternalLink className="w-4 h-4 text-brand-dark" />
                  <span>Open Customer Storefront</span>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">Live Site →</span>
              </a>

              {/* Admin Profile & Sign Out Card */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs"
                    style={{ background: "linear-gradient(135deg, #5ADBE5, #0A82A8)" }}
                  >
                    SJ
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {adminProfile.full_name || "Sjainthelegend"}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium flex items-center space-x-1">
                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 inline" />
                      <span>Super Admin</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Left Sidebar Navigation (Desktop >= md, LeaseFlow Inspired UI) ── */}
      <aside className="hidden md:flex md:sticky top-6 z-20 w-64 lg:w-72 shrink-0 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex-col justify-between h-[calc(100vh-3rem)]">
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

              {/* Group: Catalog with Sub-Items */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-3.5 py-1 text-xs font-bold text-slate-800">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-3.5 h-3.5 text-brand-dark" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">Catalog</span>
                  </div>
                </div>

                {/* Sub-item: Categories */}
                <button
                  type="button"
                  onClick={() => handleNavClick("categories")}
                  className={`w-full flex items-center justify-between pl-6 pr-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "categories"
                      ? "bg-[#0B1E28] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <FolderTree
                      className={`w-3.5 h-3.5 ${
                        activeTab === "categories" ? "text-brand-light" : "text-slate-400"
                      }`}
                    />
                    <span>Categories</span>
                  </div>
                  {activeTab === "categories" ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-brand-light/20 text-brand-light border border-brand-light/30">
                      Active
                    </span>
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </button>

                {/* Sub-item: Upload Catalog */}
                <button
                  type="button"
                  onClick={() => handleNavClick("catalog")}
                  className={`w-full flex items-center justify-between pl-6 pr-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "catalog"
                      ? "bg-[#0B1E28] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <FileSpreadsheet
                      className={`w-3.5 h-3.5 ${
                        activeTab === "catalog" ? "text-brand-light" : "text-slate-400"
                      }`}
                    />
                    <span>Upload Catalog</span>
                  </div>
                  {activeTab === "catalog" ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-brand-light/20 text-brand-light border border-brand-light/30">
                      Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                      New
                    </span>
                  )}
                </button>

                {/* Sub-item: Image Bulk Upload */}
                <button
                  type="button"
                  onClick={() => handleNavClick("image_bulk_upload")}
                  className={`w-full flex items-center justify-between pl-6 pr-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "image_bulk_upload"
                      ? "bg-[#0B1E28] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <ImageIcon
                      className={`w-3.5 h-3.5 ${
                        activeTab === "image_bulk_upload" ? "text-brand-light" : "text-slate-400"
                      }`}
                    />
                    <span>Image Bulk Upload</span>
                  </div>
                  {activeTab === "image_bulk_upload" ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-brand-light/20 text-brand-light border border-brand-light/30">
                      Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-black uppercase text-brand-dark bg-brand-light/20 border border-brand-light/40 px-1.5 py-0.2 rounded">
                      New
                    </span>
                  )}
                </button>
              </div>

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

              {/* Returns */}
              <button
                type="button"
                onClick={() => handleNavClick("returns")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "returns"
                    ? "bg-[#0B1E28] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <RotateCcw
                    className={`w-4 h-4 ${
                      activeTab === "returns" ? "text-brand-light" : "text-slate-500"
                    }`}
                  />
                  <span>Returns</span>
                </div>
                {counts.pendingReturns > 0 ? (
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      activeTab === "returns"
                        ? "bg-rose-400 text-slate-900"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {counts.pendingReturns} new
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeTab === "returns"
                        ? "bg-brand-light/20 text-brand-light"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    Desk
                  </span>
                )}
              </button>

              {/* Reviews & Approvals */}
              <button
                type="button"
                onClick={() => handleNavClick("reviews")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "reviews"
                    ? "bg-[#0B1E28] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Star
                    className={`w-4 h-4 ${
                      activeTab === "reviews"
                        ? "text-amber-400 fill-amber-400"
                        : "text-slate-500"
                    }`}
                  />
                  <span>Reviews</span>
                </div>
                {counts.pendingReviews > 0 ? (
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      activeTab === "reviews"
                        ? "bg-amber-400 text-slate-900"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {counts.pendingReviews} pending
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeTab === "reviews"
                        ? "bg-brand-light/20 text-brand-light"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    Desk
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
          {activeTab === "categories" && <CategoryManager />}
          {activeTab === "catalog" && <CatalogUploadHome />}
          {activeTab === "image_bulk_upload" && <ImageBulkUploadPage />}
          {activeTab === "products" && <ProductList />}
          {activeTab === "orders" && <OrderList />}
          {activeTab === "returns" && <ReturnsHome />}
          {activeTab === "reviews" && <ReviewModerationList />}
          {activeTab === "content" && <ContentEditor />}
          {activeTab === "settings" && <SettingsEditor />}
        </div>
      </main>

      {/* ── Floating Mobile Bottom Navigation Dock (Matching Customer Store App) ── */}
      <AdminNavigationDock
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setMobileMenuOpen(false);
        }}
        counts={counts}
        onOpenMenu={() => setMobileMenuOpen((prev) => !prev)}
        isMenuOpen={mobileMenuOpen}
      />
    </div>
  );
}
