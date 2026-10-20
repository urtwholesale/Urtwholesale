import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Layers,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

export type NavTab = "dashboard" | "products" | "orders" | "content" | "settings";

interface AdminNavigationDockProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  counts: { products: number; pendingOrders: number };
  onOpenMenu: () => void;
  isMenuOpen: boolean;
}

export function AdminNavigationDock({
  activeTab,
  onTabChange,
  counts,
  onOpenMenu,
  isMenuOpen,
}: AdminNavigationDockProps) {
  function handleTabSelect(tab: NavTab) {
    triggerHaptic("selection");
    onTabChange(tab);
  }

  return (
    <div className="md:hidden fixed z-40 dock-bottom-offset left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-90 transition-all duration-300">
      <nav
        aria-label="Admin Navigation Dock"
        className="glass-dock rounded-full px-2 py-1.5 flex items-center justify-between"
      >
        {/* 1. Dashboard Overview */}
        <button
          type="button"
          onClick={() => handleTabSelect("dashboard")}
          aria-label="Dashboard Overview"
          className={`group relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
            activeTab === "dashboard" && !isMenuOpen
              ? "text-white shadow-[0_4px_16px_rgba(10,130,168,0.4)] scale-105"
              : "text-slate-600 hover:text-slate-900 hover:bg-black/5"
          }`}
          style={
            activeTab === "dashboard" && !isMenuOpen
              ? {
                  background: "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
                }
              : undefined
          }
        >
          <LayoutDashboard
            className={`w-5 h-5 transition-transform duration-200 ${
              activeTab === "dashboard" && !isMenuOpen
                ? "text-white stroke-[2.4]"
                : "text-slate-600 stroke-2 group-hover:scale-110 group-hover:text-slate-900"
            }`}
          />
        </button>

        {/* 2. Products Catalog */}
        <button
          type="button"
          onClick={() => handleTabSelect("products")}
          aria-label="Products Catalog"
          className={`group relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
            activeTab === "products" && !isMenuOpen
              ? "text-white shadow-[0_4px_16px_rgba(10,130,168,0.4)] scale-105"
              : "text-slate-600 hover:text-slate-900 hover:bg-black/5"
          }`}
          style={
            activeTab === "products" && !isMenuOpen
              ? {
                  background: "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
                }
              : undefined
          }
        >
          <Package
            className={`w-5 h-5 transition-transform duration-200 ${
              activeTab === "products" && !isMenuOpen
                ? "text-white stroke-[2.4]"
                : "text-slate-600 stroke-2 group-hover:scale-110 group-hover:text-slate-900"
            }`}
          />
          {counts.products > 0 && (
            <span
              className={`absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-black shadow-xs ${
                activeTab === "products" && !isMenuOpen
                  ? "bg-slate-900 text-white"
                  : "bg-brand-dark text-white"
              }`}
            >
              {counts.products}
            </span>
          )}
        </button>

        {/* 3. Orders Pipeline */}
        <button
          type="button"
          onClick={() => handleTabSelect("orders")}
          aria-label="Orders & Dispatch"
          className={`group relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
            activeTab === "orders" && !isMenuOpen
              ? "text-white shadow-[0_4px_16px_rgba(10,130,168,0.4)] scale-105"
              : "text-slate-600 hover:text-slate-900 hover:bg-black/5"
          }`}
          style={
            activeTab === "orders" && !isMenuOpen
              ? {
                  background: "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
                }
              : undefined
          }
        >
          <ShoppingBag
            className={`w-5 h-5 transition-transform duration-200 ${
              activeTab === "orders" && !isMenuOpen
                ? "text-white stroke-[2.4]"
                : "text-slate-600 stroke-2 group-hover:scale-110 group-hover:text-slate-900"
            }`}
          />
          {counts.pendingOrders > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-400 text-slate-950 shadow-xs animate-pulse">
              {counts.pendingOrders}
            </span>
          )}
        </button>

        {/* 4. Content & Banners */}
        <button
          type="button"
          onClick={() => handleTabSelect("content")}
          aria-label="Content & Pages"
          className={`group relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
            activeTab === "content" && !isMenuOpen
              ? "text-white shadow-[0_4px_16px_rgba(10,130,168,0.4)] scale-105"
              : "text-slate-600 hover:text-slate-900 hover:bg-black/5"
          }`}
          style={
            activeTab === "content" && !isMenuOpen
              ? {
                  background: "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
                }
              : undefined
          }
        >
          <Layers
            className={`w-5 h-5 transition-transform duration-200 ${
              activeTab === "content" && !isMenuOpen
                ? "text-white stroke-[2.4]"
                : "text-slate-600 stroke-2 group-hover:scale-110 group-hover:text-slate-900"
            }`}
          />
        </button>

        {/* 5. Settings / Full Admin Hub Drawer */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            onOpenMenu();
          }}
          aria-label="Admin Hub & Quick Settings"
          className={`group relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isMenuOpen || (activeTab === "settings" && !isMenuOpen)
              ? "text-white shadow-[0_4px_16px_rgba(10,130,168,0.4)] scale-105"
              : "text-slate-600 hover:text-slate-900 hover:bg-black/5"
          }`}
          style={
            isMenuOpen || (activeTab === "settings" && !isMenuOpen)
              ? {
                  background: "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
                }
              : undefined
          }
        >
          {isMenuOpen ? (
            <X className="w-5 h-5 text-white stroke-[2.4]" />
          ) : activeTab === "settings" ? (
            <Settings className="w-5 h-5 text-white stroke-[2.4]" />
          ) : (
            <Menu className="w-5 h-5 text-slate-600 stroke-2 group-hover:scale-110 group-hover:text-slate-900" />
          )}
        </button>
      </nav>
    </div>
  );
}
