import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { ShoppingBag, ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { SearchDropdown } from "./SearchDropdown";

interface TopBarProps {
  cartCount?: number;
  onOpenMenu?: () => void;
  popularSearches?: string[];
}

const DESKTOP_NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "Marketplace", to: "/marketplace" },
  { label: "Urbanrat", to: "/urbanrat" },
  { label: "Categories", to: "/categories" },
  { label: "Account", to: "/account" },
  { label: "Menu", to: "/menu", isMenuAction: true },
];

export function TopBar({
  cartCount = 0,
  onOpenMenu,
  popularSearches = [],
}: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const { isDark, toggleTheme } = useTheme();

  function handleBack() {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
  }

  return (
    <header className="fixed md:relative top-0 left-0 right-0 z-40 w-full px-3 pt-2 pb-1 sm:px-4 md:px-6 md:py-3 max-w-7xl 2xl:max-w-[1780px] mx-auto transition-colors">
      {/* ── Main Liquid Glass Slab Console (Reference: Liquid Glass UI Kit) ── */}
      <div className="relative w-full rounded-2xl md:rounded-full liquid-glass-slab px-3 sm:px-4 md:px-5 lg:px-6 h-15 sm:h-16 flex items-center justify-between">
        {/* ── Liquid Glass Iridescent Refraction Caustics Container (Clipped to pill) ── */}
        <div className="absolute inset-0 rounded-2xl md:rounded-full overflow-hidden pointer-events-none">
          <div className="absolute -top-8 left-12 w-48 h-16 bg-cyan-400/25 dark:bg-cyan-500/15 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 right-16 w-52 h-16 bg-purple-500/20 dark:bg-purple-500/15 rounded-full blur-2xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-10 bg-rose-400/12 dark:bg-pink-500/10 rounded-full blur-3xl" />
          {/* Specular hairline light reflection along top rim */}
          <div className="absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-white/95 dark:via-white/40 to-transparent" />
        </div>

        {/* ── Left Zone: Back Button (Subpages) & Brand Logo Capsule ── */}
        <div className="flex items-center space-x-2 shrink-0 z-10">
          {!isHome && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="liquid-glass-orb w-10 h-10 rounded-full flex items-center justify-center text-slate-800 dark:text-slate-100 hover:text-cyan-600 dark:hover:text-cyan-400 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group"
            >
              <ArrowLeft className="w-4.5 h-4.5 stroke-[2.3] group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Liquid Glass Brand Capsule */}
          <Link
            to="/"
            className="group relative inline-flex items-center space-x-2.5 py-1.5 pl-1.5 pr-3.5 sm:pr-4 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/80 dark:border-white/15 shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.9),0_4px_14px_rgba(0,0,0,0.04)] hover:shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,1),0_6px_20px_rgba(6,182,212,0.25)] hover:scale-[1.02] active:scale-98 transition-all duration-200"
          >
            <div className="relative w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full p-0.5 bg-linear-to-br from-cyan-400 to-purple-500 shadow-xs">
              <img
                src="/logo.png"
                alt="Urbanrat"
                className="w-full h-full rounded-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              URT Wholesale
            </span>
          </Link>
        </div>

        {/* ── Center Zone: Segmented Liquid Navigation Dock (Desktop View) ── */}
        <div className="hidden md:flex items-center justify-center z-10">
          <nav
            aria-label="Desktop Navigation"
            className="liquid-glass-track relative flex items-center space-x-1 p-1 rounded-full overflow-hidden"
          >
            {/* Top specular hairline */}
            <div className="absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-white/90 dark:via-white/30 to-transparent pointer-events-none" />

            {DESKTOP_NAV_ITEMS.map((item) =>
              item.isMenuAction ? (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onOpenMenu?.()}
                  className="px-3.5 lg:px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10 active:scale-95"
                >
                  {item.label}
                </button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `relative px-3.5 lg:px-4 py-1.5 rounded-full text-xs font-black transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "text-white liquid-glass-active-pill"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10 active:scale-95"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>
        </div>

        {/* ── Right Zone: Search Dropdown, Theme Toggle & Cart Droplet ── */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0 z-20">
          {/* Integrated Liquid Glass Search with Attached Dropdown (No Pop-up Modal) */}
          <SearchDropdown popularSearches={popularSearches} />

          {/* Liquid Glass Theme Toggle Orb */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className="liquid-glass-orb w-10 h-10 rounded-full flex items-center justify-center text-slate-800 dark:text-amber-400 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group"
          >
            {isDark ? (
              <Sun className="w-4.5 h-4.5 stroke-[2.2] text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
            ) : (
              <Moon className="w-4.5 h-4.5 stroke-[2.2] text-slate-700 group-hover:text-cyan-600 group-hover:-rotate-12 transition-transform duration-300" />
            )}
          </button>

          {/* Liquid Glass Cart Droplet with Glowing Violet/Purple Pill Badge */}
          <Link
            to="/cart"
            aria-label={`View cart with ${cartCount} items`}
            className="relative liquid-glass-orb w-10 h-10 rounded-full flex items-center justify-center text-slate-800 dark:text-slate-100 hover:text-cyan-600 dark:hover:text-cyan-400 hover:scale-105 active:scale-95 transition-all duration-200 group"
          >
            <ShoppingBag className="w-4.5 h-4.5 stroke-[2.2] group-hover:scale-105 transition-transform" />

            {/* Glowing Liquid Violet Badge (Reference: Primary Button / Violet Pill) */}
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1.2 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_2px_10px_rgba(168,85,247,0.6)] border border-white/50 animate-in zoom-in-50"
                style={{
                  background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                }}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
