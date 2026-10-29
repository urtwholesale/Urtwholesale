import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { Search, ShoppingBag, ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface TopBarProps {
  cartCount?: number;
  onOpenSearch?: () => void;
  onOpenMenu?: () => void;
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
  onOpenSearch,
  onOpenMenu,
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
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-colors">
      <div className="relative w-full max-w-7xl 2xl:max-w-[1780px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 h-16 flex items-center justify-between">
        {/* ── Left Corner: Search Button (+ Back Button on subpages) ── */}
        <div className="flex items-center space-x-2 shrink-0 z-10">
          {!isHome && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="w-10 h-10 rounded-full bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] flex items-center justify-center text-slate-800 dark:text-slate-100 hover:text-brand-dark dark:hover:text-brand-light hover:shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search accessories"
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] flex items-center justify-center text-slate-800 dark:text-slate-100 hover:text-brand-dark dark:hover:text-brand-light hover:shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Search className="w-4.5 h-4.5 stroke-[2.2]" />
          </button>
        </div>

        {/* ── Center: Brand Name & Logo ── */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto">
          <Link
            to="/"
            className="inline-flex items-center space-x-2 sm:space-x-2.5 py-1.5 pl-2 pr-3.5 sm:pr-4 rounded-full bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] hover:shadow-md transition-all active:scale-95 group"
          >
            <img
              src="/logo.png"
              alt="Urbanrat"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full object-cover shadow-xs group-hover:scale-105 transition-transform"
            />
            <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              URT Wholesale
            </span>
          </Link>
        </div>

        {/* ── Right Corner: Dark Mode Toggle & Cart Button ── */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0 z-10">
          {/* Symmetrical Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] flex items-center justify-center text-slate-800 dark:text-amber-400 hover:text-brand-dark dark:hover:text-amber-300 hover:shadow-md active:scale-95 transition-all cursor-pointer group"
          >
            {isDark ? (
              <Sun className="w-4.5 h-4.5 stroke-[2.2] text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
            ) : (
              <Moon className="w-4.5 h-4.5 stroke-[2.2] text-slate-700 group-hover:text-brand-dark group-hover:-rotate-12 transition-transform duration-300" />
            )}
          </button>

          {/* Circular Cart Button with Badge */}
          <Link
            to="/cart"
            aria-label={`View cart with ${cartCount} items`}
            className="relative w-10 h-10 rounded-full bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] flex items-center justify-center text-slate-800 dark:text-slate-100 hover:text-brand-dark dark:hover:text-brand-light hover:shadow-md active:scale-95 transition-all group"
          >
            <ShoppingBag className="w-4.5 h-4.5 stroke-[2.2] group-hover:scale-105 transition-transform" />

            {/* Item Count Badge */}
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-4.75 h-4.75 px-1 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-xs animate-in zoom-in-50"
                style={{
                  background: "var(--brand-gradient)",
                }}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* ── Sub Topbar: Centered Desktop Navigation Menu Below Logo ── */}
      <div className="hidden md:flex items-center justify-center pb-2.5 pt-1 border-t border-slate-100/80 dark:border-slate-800/80">
        <nav
          aria-label="Desktop Navigation"
          className="flex items-center space-x-1.5 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
        >
          {DESKTOP_NAV_ITEMS.map((item) =>
            item.isMenuAction ? (
              <button
                key={item.label}
                type="button"
                onClick={() => onOpenMenu?.()}
                className="px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
              >
                {item.label}
              </button>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        background: "var(--brand-gradient)",
                      }
                    : undefined
                }
              >
                {item.label}
              </NavLink>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
