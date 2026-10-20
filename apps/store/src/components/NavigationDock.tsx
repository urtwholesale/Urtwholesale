import { NavLink } from "react-router";
import { Home, ShoppingBag, LayoutGrid, Menu } from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

interface NavigationDockProps {
  onOpenMenu?: () => void;
  isMenuOpen?: boolean;
}

export function NavigationDock({
  onOpenMenu,
  isMenuOpen = false,
}: NavigationDockProps = {}) {
  return (
    <div className="md:hidden fixed z-40 dock-bottom-offset left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[360px] transition-all duration-300">
      {/* ── Light Frosted Glass Capsule Dock ── */}
      <nav
        aria-label="Main Navigation"
        className="glass-dock rounded-full px-2 py-1.5 flex items-center justify-between"
      >
        {/* 1. Home */}
        <NavLink
          to="/"
          end
          aria-label="Home"
          onClick={() => triggerHaptic("selection")}
          className={({ isActive }) =>
            `group relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              isActive && !isMenuOpen
                ? "text-white shadow-[0_4px_16px_rgba(10,130,168,0.4)] scale-105"
                : "text-slate-600 hover:text-slate-900 hover:bg-black/5"
            }`
          }
          style={({ isActive }) =>
            isActive && !isMenuOpen
              ? {
                  background:
                    "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
                }
              : undefined
          }
        >
          {({ isActive }) => (
            <Home
              className={`w-5 h-5 transition-transform duration-200 ${
                isActive && !isMenuOpen
                  ? "text-white stroke-[2.4]"
                  : "text-slate-600 stroke-[2] group-hover:scale-110 group-hover:text-slate-900"
              }`}
            />
          )}
        </NavLink>

        {/* 2. Marketplace */}
        <NavLink
          to="/marketplace"
          aria-label="Marketplace"
          onClick={() => triggerHaptic("selection")}
          className={({ isActive }) =>
            `group relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              isActive && !isMenuOpen
                ? "text-white shadow-[0_4px_16px_rgba(10,130,168,0.4)] scale-105"
                : "text-slate-600 hover:text-slate-900 hover:bg-black/5"
            }`
          }
          style={({ isActive }) =>
            isActive && !isMenuOpen
              ? {
                  background:
                    "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
                }
              : undefined
          }
        >
          {({ isActive }) => (
            <ShoppingBag
              className={`w-5 h-5 transition-transform duration-200 ${
                isActive && !isMenuOpen
                  ? "text-white stroke-[2.4]"
                  : "text-slate-600 stroke-[2] group-hover:scale-110 group-hover:text-slate-900"
              }`}
            />
          )}
        </NavLink>

        {/* 3. Center Logo Button — Prominently Sized & Elevated Centerpiece */}
        <NavLink
          to="/urbanrat"
          aria-label="Urbanrat Flagship Collection"
          onClick={() => triggerHaptic("selection")}
          className={({ isActive }) =>
            `group relative w-14 h-14 sm:w-15 sm:h-15 -my-3 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
              isActive && !isMenuOpen
                ? "bg-white ring-3 ring-[#0A82A8] shadow-[0_6px_24px_rgba(10,130,168,0.45)] scale-110"
                : "bg-white ring-2 ring-slate-100/90 shadow-[0_4px_16px_rgba(0,0,0,0.12)] hover:scale-105 active:scale-95"
            }`
          }
        >
          <img
            src="/logo.png"
            alt="Urbanrat"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        </NavLink>

        {/* 4. Categories */}
        <NavLink
          to="/categories"
          aria-label="Categories"
          onClick={() => triggerHaptic("selection")}
          className={({ isActive }) =>
            `group relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              isActive && !isMenuOpen
                ? "text-white shadow-[0_4px_16px_rgba(10,130,168,0.4)] scale-105"
                : "text-slate-600 hover:text-slate-900 hover:bg-black/5"
            }`
          }
          style={({ isActive }) =>
            isActive && !isMenuOpen
              ? {
                  background:
                    "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
                }
              : undefined
          }
        >
          {({ isActive }) => (
            <LayoutGrid
              className={`w-5 h-5 transition-transform duration-200 ${
                isActive && !isMenuOpen
                  ? "text-white stroke-[2.4]"
                  : "text-slate-600 stroke-[2] group-hover:scale-110 group-hover:text-slate-900"
              }`}
            />
          )}
        </NavLink>

        {/* 5. Actual Menu Opener Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            onOpenMenu?.();
          }}
          aria-label="Open Navigation Menu"
          className={`group relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isMenuOpen
              ? "text-white shadow-[0_4px_16px_rgba(10,130,168,0.4)] scale-105"
              : "text-slate-600 hover:text-slate-900 hover:bg-black/5"
          }`}
          style={
            isMenuOpen
              ? {
                  background:
                    "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
                }
              : undefined
          }
        >
          <Menu
            className={`w-5 h-5 transition-transform duration-200 ${
              isMenuOpen
                ? "text-white stroke-[2.4]"
                : "text-slate-600 stroke-[2] group-hover:scale-110 group-hover:text-slate-900"
            }`}
          />
        </button>
      </nav>
    </div>
  );
}
