import { NavLink } from "react-router";
import { Home, ShoppingBag, LayoutGrid, Menu } from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

function UrbanratNavIcon() {
  return (
    <img
      src="/logo.png"
      alt="Urbanrat"
      className="w-5 h-5 rounded-full object-cover shadow-2xs"
    />
  );
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/marketplace", icon: ShoppingBag, label: "Marketplace" },
  { to: "/urbanrat", icon: UrbanratNavIcon, label: "Urbanrat" },
  { to: "/categories", icon: LayoutGrid, label: "Categories" },
  { to: "/menu", icon: Menu, label: "Menu" },
];

export function NavigationDock() {
  return (
    <div className="md:hidden fixed z-40 dock-bottom-offset left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[360px] transition-all duration-300">
      {/* ── Light Frosted Glass Capsule Dock (Matching Reference Image) ── */}
      <nav
        aria-label="Main Navigation"
        className="glass-dock rounded-full px-2 py-1.5 flex items-center justify-between"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              aria-label={item.label}
              onClick={() => triggerHaptic("selection")}
              className={({ isActive }) =>
                `group relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "text-white shadow-[0_4px_16px_rgba(10,130,168,0.4)] scale-105"
                    : "text-slate-600 hover:text-slate-900 hover:bg-black/5"
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
              {({ isActive }) => (
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive
                      ? "text-white stroke-[2.4]"
                      : "text-slate-600 stroke-[2] group-hover:scale-110 group-hover:text-slate-900"
                  }`}
                />
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
