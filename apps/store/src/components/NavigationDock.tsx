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
    <div className="md:hidden fixed z-40 dock-bottom-offset left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-90 transition-all duration-300">
      {/* ── Frosted Glass Capsule Dock ── */}
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
                ? "text-white scale-105"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
            }`
          }
          style={({ isActive }) =>
            isActive && !isMenuOpen
              ? {
                  background: "var(--brand-gradient)",
                  boxShadow: "var(--brand-shadow)",
                }
              : undefined
          }
        >
          {({ isActive }) => (
            <Home
              className={`w-5 h-5 transition-transform duration-200 ${
                isActive && !isMenuOpen
                  ? "text-white stroke-[2.4]"
                  : "text-slate-600 dark:text-slate-400 stroke-2 group-hover:scale-110 group-hover:text-slate-900 dark:group-hover:text-white"
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
                ? "text-white scale-105"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
            }`
          }
          style={({ isActive }) =>
            isActive && !isMenuOpen
              ? {
                  background: "var(--brand-gradient)",
                  boxShadow: "var(--brand-shadow)",
                }
              : undefined
          }
        >
          {({ isActive }) => (
            <ShoppingBag
              className={`w-5 h-5 transition-transform duration-200 ${
                isActive && !isMenuOpen
                  ? "text-white stroke-[2.4]"
                  : "text-slate-600 dark:text-slate-400 stroke-2 group-hover:scale-110 group-hover:text-slate-900 dark:group-hover:text-white"
              }`}
            />
          )}
        </NavLink>

        {/* 3. Center Urbanrat Logo Button — Unified with Dock Buttons */}
        <NavLink
          to="/urbanrat"
          aria-label="Urbanrat Flagship Collection"
          onClick={() => triggerHaptic("selection")}
          className={({ isActive }) =>
            `group relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              isActive && !isMenuOpen
                ? "text-white scale-105"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
            }`
          }
          style={({ isActive }) =>
            isActive && !isMenuOpen
              ? {
                  background: "var(--brand-gradient)",
                  boxShadow: "var(--brand-shadow)",
                }
              : undefined
          }
        >
          {({ isActive }) => (
            <img
              src="/logo.png"
              alt="Urbanrat"
              className={`rounded-full object-cover transition-transform duration-200 ${
                isActive && !isMenuOpen
                  ? "w-7 h-7 sm:w-7.5 sm:h-7.5 scale-105 drop-shadow-sm"
                  : "w-6.5 h-6.5 sm:w-7 sm:h-7 group-hover:scale-110"
              }`}
            />
          )}
        </NavLink>

        {/* 4. Categories */}
        <NavLink
          to="/categories"
          aria-label="Categories"
          onClick={() => triggerHaptic("selection")}
          className={({ isActive }) =>
            `group relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              isActive && !isMenuOpen
                ? "text-white scale-105"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
            }`
          }
          style={({ isActive }) =>
            isActive && !isMenuOpen
              ? {
                  background: "var(--brand-gradient)",
                  boxShadow: "var(--brand-shadow)",
                }
              : undefined
          }
        >
          {({ isActive }) => (
            <LayoutGrid
              className={`w-5 h-5 transition-transform duration-200 ${
                isActive && !isMenuOpen
                  ? "text-white stroke-[2.4]"
                  : "text-slate-600 dark:text-slate-400 stroke-2 group-hover:scale-110 group-hover:text-slate-900 dark:group-hover:text-white"
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
              ? "text-white scale-105"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
          }`}
          style={
            isMenuOpen
              ? {
                  background: "var(--brand-gradient)",
                  boxShadow: "var(--brand-shadow)",
                }
              : undefined
          }
        >
          <Menu
            className={`w-5 h-5 transition-transform duration-200 ${
              isMenuOpen
                ? "text-white stroke-[2.4]"
                : "text-slate-600 dark:text-slate-400 stroke-2 group-hover:scale-110 group-hover:text-slate-900 dark:group-hover:text-white"
            }`}
          />
        </button>
      </nav>
    </div>
  );
}
