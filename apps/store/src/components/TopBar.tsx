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
      {/* ── Main Simple & Flat Glassmorphic Top Bar ── */}
      <div className="relative w-full rounded-2xl md:rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 px-3 sm:px-4 md:px-5 lg:px-6 h-14 sm:h-15 md:h-16 flex items-center justify-between shadow-xs dark:shadow-md">
        
        {/* ── Left Zone: Back Button (Subpages) & Brand Logo Capsule ── */}
        <div className="flex items-center space-x-2 shrink-0 z-10">
          {!isHome && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer group"
            >
              <ArrowLeft className="w-4.5 h-4.5 stroke-[2.2] group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Simple & Flat Brand Logo Link */}
          <Link
            to="/"
            className="group flex items-center space-x-2.5 py-1 px-2 rounded-full hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="relative w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full overflow-hidden shrink-0">
              <img
                src="/logo.png"
                alt="Urbanrat"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              URT Wholesale
            </span>
          </Link>
        </div>

        {/* ── Center Zone: Flat Segmented Navigation Dock (Desktop View) ── */}
        <div className="hidden md:flex items-center justify-center z-10">
          <nav
            aria-label="Desktop Navigation"
            className="flex items-center space-x-1 p-1 rounded-full bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-xs"
          >
            {DESKTOP_NAV_ITEMS.map((item) =>
              item.isMenuAction ? (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onOpenMenu?.()}
                  className="px-3.5 lg:px-4 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer active:scale-95"
                >
                  {item.label}
                </button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `px-3.5 lg:px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-cyan-500 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60 active:scale-95"
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
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 z-20">
          {/* Integrated Flat Glass Search with Attached Dropdown */}
          <SearchDropdown popularSearches={popularSearches} />

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
          >
            {isDark ? (
              <Sun className="w-4.5 h-4.5 stroke-[2] text-amber-400 hover:rotate-45 transition-transform duration-300" />
            ) : (
              <Moon className="w-4.5 h-4.5 stroke-[2] text-slate-700 hover:text-cyan-600 transition-colors" />
            )}
          </button>

          {/* Cart Button with Flat Badge */}
          <Link
            to="/cart"
            aria-label={`View cart with ${cartCount} items`}
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
          >
            <ShoppingBag className="w-4.5 h-4.5 stroke-[2]" />

            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-bold text-white bg-cyan-500 flex items-center justify-center shadow-xs">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
