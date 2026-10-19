import { useState, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { Search, ShoppingBag, ArrowLeft } from "lucide-react";

interface TopBarProps {
  cartCount?: number;
  onOpenSearch?: () => void;
}

const DESKTOP_NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "Marketplace", to: "/marketplace" },
  { label: "Urbanrat", to: "/urbanrat" },
  { label: "Categories", to: "/categories" },
  { label: "Menu", to: "/menu" },
];

/**
 * Scroll direction hook for smart hide-on-scroll-down, reveal-on-scroll-up behavior
 */
function useScrollDirection() {
  const [isVisible, setIsVisible] = useState(true);
  const location = useLocation();

  // Reset to visible whenever user switches routes/pages
  useEffect(() => {
    setIsVisible(true);
  }, [location.pathname]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateScrollDir = () => {
      const scrollY = window.scrollY;

      // Always show near the very top of the page
      if (scrollY <= 20) {
        setIsVisible(true);
        lastScrollY = scrollY > 0 ? scrollY : 0;
        ticking = false;
        return;
      }

      // Small jitter filter to prevent flickering on micro movements
      const diff = scrollY - lastScrollY;
      if (Math.abs(diff) < 8) {
        ticking = false;
        return;
      }

      // Scroll down -> hide; Scroll up -> show
      if (diff > 0 && scrollY > 60) {
        setIsVisible(false);
      } else if (diff < 0) {
        setIsVisible(true);
      }

      lastScrollY = scrollY > 0 ? scrollY : 0;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDir);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return isVisible;
}

export function TopBar({ cartCount = 0, onOpenSearch }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const isVisible = useScrollDirection();

  function handleBack() {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/70 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-transform duration-300 ease-in-out ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="relative w-full max-w-7xl 2xl:max-w-[1780px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 h-16 flex items-center justify-between">
        {/* ── Left Corner: Search Button (+ Back Button on subpages) ── */}
        <div className="flex items-center space-x-2 shrink-0 z-10">
          {!isHome && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="w-10 h-10 rounded-full bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center justify-center text-slate-800 hover:text-[#0A82A8] hover:shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search accessories"
            className="w-10 h-10 rounded-full bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center justify-center text-slate-800 hover:text-[#0A82A8] hover:shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Search className="w-4.5 h-4.5 stroke-[2.2]" />
          </button>
        </div>

        {/* ── Center: Brand Name & Logo ── */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto">
          <Link
            to="/"
            className="inline-flex items-center space-x-2 sm:space-x-2.5 py-1.5 pl-2 pr-3.5 sm:pr-4 rounded-full bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-md transition-all active:scale-95 group"
          >
            <img
              src="/logo.png"
              alt="Urbanrat"
              className="w-7 h-7 rounded-full object-cover shadow-xs group-hover:scale-105 transition-transform"
            />
            <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 whitespace-nowrap">
              URT Wholesale
            </span>
          </Link>
        </div>

        {/* ── Right Corner: Cart Button ── */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0 z-10">
          {/* Circular Cart Button with Badge */}
          <Link
            to="/cart"
            aria-label={`View cart with ${cartCount} items`}
            className="relative w-10 h-10 rounded-full bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center justify-center text-slate-800 hover:text-[#0A82A8] hover:shadow-md active:scale-95 transition-all group"
          >
            <ShoppingBag className="w-4.5 h-4.5 stroke-[2.2] group-hover:scale-105 transition-transform" />

            {/* Item Count Badge */}
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-xs animate-in zoom-in-50"
                style={{
                  background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                }}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* ── Sub Topbar: Centered Desktop Navigation Menu Below Logo ── */}
      <div className="hidden md:flex items-center justify-center pb-2.5 pt-1 border-t border-slate-100/80">
        <nav
          aria-label="Desktop Navigation"
          className="flex items-center space-x-1.5 bg-slate-50/90 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-slate-200/70 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
        >
          {DESKTOP_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      background:
                        "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
                    }
                  : undefined
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
