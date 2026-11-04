import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { ShoppingBag, ArrowLeft, Sun, Moon, Languages } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { SearchDropdown } from "./SearchDropdown";
import { CursorPhobicElement } from "./CursorPhobicElement";

interface TopBarProps {
  cartCount?: number;
  onOpenMenu?: () => void;
  popularSearches?: string[];
}

export function TopBar({
  cartCount = 0,
  onOpenMenu,
  popularSearches = [],
}: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const { isDark, toggleTheme } = useTheme();
  const { isHindi, toggleLanguage, t } = useLanguage();

  const desktopNavItems = [
    { label: t("nav.home", "Home"), to: "/" },
    { label: t("nav.marketplace", "Marketplace"), to: "/marketplace" },
    { label: t("nav.urbanrat", "Urbanrat"), to: "/urbanrat" },
    { label: t("nav.categories", "Categories"), to: "/categories" },
    { label: t("nav.account", "Account"), to: "/account" },
    { label: t("nav.menu", "Menu"), to: "/menu", isMenuAction: true },
  ];

  function handleBack() {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
  }

  return (
    <header className="fixed md:relative top-0 left-0 right-0 z-40 w-full px-2 min-[360px]:px-2.5 pt-2 pb-1 sm:px-4 md:px-6 md:py-3 max-w-7xl 2xl:max-w-[1780px] mx-auto transition-colors">
      {/* ── Main Simple & Flat Glassmorphic Top Bar ── */}
      <div className="relative w-full rounded-2xl md:rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 px-2 min-[360px]:px-2.5 sm:px-4 md:px-5 lg:px-6 h-13 sm:h-14 md:h-16 flex items-center justify-between shadow-xs dark:shadow-md">
        
        {/* ── Left Zone: Back Button (Subpages) & Brand Logo Capsule ── */}
        <div className="flex items-center space-x-1 min-[360px]:space-x-1.5 sm:space-x-2 shrink-0 z-10 min-w-0">
          {!isHome && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="w-8 h-8 min-[360px]:w-8.5 min-[360px]:h-8.5 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer group shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2] group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Simple & Flat Brand Logo Link with Cursor-Phobic Repulsion */}
          <Link
            to="/"
            className="group flex items-center space-x-1.5 sm:space-x-2.5 py-1 px-1 sm:px-2 rounded-full hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors shrink-0"
          >
            <CursorPhobicElement
              disabled={!isHome}
              repulsionRadius={120}
              maxDisplacement={14}
              maxTilt={4}
              className="relative w-7.5 h-7.5 min-[360px]:w-8 min-[360px]:h-8 sm:w-8.5 sm:h-8.5 rounded-full overflow-hidden shrink-0"
            >
              <img
                src="/logo.png"
                alt="Urbanrat"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </CursorPhobicElement>
            <CursorPhobicElement
              disabled={!isHome}
              repulsionRadius={130}
              maxDisplacement={16}
              maxTilt={3}
              as="span"
              className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap"
            >
              <span className={!isHome ? "hidden min-[480px]:inline" : "hidden min-[360px]:inline"}>
                URT Wholesale
              </span>
              <span className={!isHome ? "hidden" : "min-[360px]:hidden"}>
                URT
              </span>
            </CursorPhobicElement>
          </Link>
        </div>

        {/* ── Center Zone: Flat Segmented Navigation Dock (Desktop View) with Cursor-Phobic Repulsion ── */}
        <div className="hidden md:flex items-center justify-center z-10">
          <nav
            aria-label="Desktop Navigation"
            className="flex items-center space-x-1 p-1 rounded-full bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-xs"
          >
            {desktopNavItems.map((item) => (
              <CursorPhobicElement
                key={item.label}
                disabled={!isHome}
                repulsionRadius={100}
                maxDisplacement={12}
                maxTilt={4}
                className="inline-flex"
              >
                {item.isMenuAction ? (
                  <button
                    type="button"
                    onClick={() => onOpenMenu?.()}
                    className="px-3.5 lg:px-4 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer active:scale-95"
                  >
                    {item.label}
                  </button>
                ) : (
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `px-3.5 lg:px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-primary text-on-primary shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60 active:scale-95"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                )}
              </CursorPhobicElement>
            ))}
          </nav>
        </div>

        {/* ── Right Zone: Search Dropdown, Language Toggle, Theme Toggle & Cart Droplet ── */}
        <div className="flex items-center space-x-0.5 min-[360px]:space-x-1 sm:space-x-1.5 md:space-x-2 shrink-0 z-20">
          {/* Integrated Flat Glass Search with Attached Dropdown */}
          <SearchDropdown popularSearches={popularSearches} />

          {/* Language Switcher Pill */}
          <CursorPhobicElement
            disabled={!isHome}
            repulsionRadius={110}
            maxDisplacement={12}
            maxTilt={4}
            className="inline-flex"
          >
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={isHindi ? "Switch to English" : "हिन्दी में बदलें"}
              title={isHindi ? "Switch to English" : "हिन्दी में बदलें"}
              className="h-8 min-[360px]:h-8.5 sm:h-9 md:h-10 px-1.5 min-[360px]:px-2 sm:px-2.5 md:px-3 rounded-full flex items-center space-x-1 sm:space-x-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all border border-slate-200/70 dark:border-slate-700/70 cursor-pointer shadow-2xs shrink-0"
            >
              <Languages className="w-3 h-3 min-[360px]:w-3.5 min-[360px]:h-3.5 text-cyan-600 dark:text-orange-400 stroke-[2.2] shrink-0" />
              <span className="text-[10px] min-[360px]:text-[11px] sm:text-xs font-black tracking-tight text-slate-900 dark:text-white">
                {isHindi ? "English" : "हिन्दी"}
              </span>
            </button>
          </CursorPhobicElement>

          {/* Theme Toggle Button */}
          <CursorPhobicElement
            disabled={!isHome}
            repulsionRadius={110}
            maxDisplacement={12}
            maxTilt={4}
            className="inline-flex"
          >
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
              className="w-8 h-8 min-[360px]:w-8.5 min-[360px]:h-8.5 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-slate-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              {isDark ? (
                <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2] text-amber-400 hover:rotate-45 transition-transform duration-300" />
              ) : (
                <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2] text-slate-700 hover:text-cyan-600 transition-colors" />
              )}
            </button>
          </CursorPhobicElement>

          {/* Cart Button with Flat Badge */}
          <CursorPhobicElement
            disabled={!isHome}
            repulsionRadius={110}
            maxDisplacement={12}
            maxTilt={4}
            className="inline-flex"
          >
            <Link
              to="/cart"
              aria-label={`View cart with ${cartCount} items`}
              className="relative w-8 h-8 min-[360px]:w-8.5 min-[360px]:h-8.5 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all shrink-0"
            >
              <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2]" />

              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 sm:min-w-4.5 sm:h-4.5 px-1 rounded-full text-[9px] sm:text-[10px] font-bold text-white bg-primary flex items-center justify-center shadow-xs">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          </CursorPhobicElement>
        </div>
      </div>
    </header>
  );
}
