import { useState } from "react";
import { useNavigate } from "react-router";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { CustomerAuth } from "../features/auth/CustomerAuth";
import {
  X,
  Home,
  ShoppingBag,
  LayoutGrid,
  Package,
  ShoppingCart,
  MessageCircle,
  Shield,
  FileText,
  Info,
  ExternalLink,
  ChevronRight,
  LogOut,
  LogIn,
  ShieldCheck,
  ArrowLeft,
  User,
  MapPin,
  RotateCcw,
  Sun,
  Moon,
} from "lucide-react";

interface StoreMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartCount?: number;
}

export function StoreMenuDrawer({
  isOpen,
  onClose,
  cartCount = 0,
}: StoreMenuDrawerProps) {
  const navigate = useNavigate();
  const { settings, whatsappNumber } = useSettings();
  const { user, profile, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [showAuthForm, setShowAuthForm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      setShowAuthForm(false);
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setSigningOut(false);
    }
  }

  function handleNavigate(to: string) {
    onClose();
    setShowAuthForm(false);
    navigate(to);
  }

  if (!isOpen) return null;

  const targetWhatsApp =
    whatsappNumber || settings?.whatsapp_number || "919999999999";
  const whatsappUrl = `https://wa.me/${targetWhatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(
    "Hi Urbanrat Wholesale team, I would like to enquire about wholesale pricing and catalog accessories."
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      {/* ── Backdrop Overlay ── */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
        aria-hidden="true"
      />

      {/* ── Slide-Up Menu Sheet ── */}
      <div
        className="relative z-10 w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-4xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 border border-slate-100 dark:border-slate-800"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
      >
        {/* Drag handle pill (Mobile) */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>

        {/* ── Header Bar ── */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {showAuthForm ? (
            <button
              type="button"
              onClick={() => setShowAuthForm(false)}
              className="flex items-center space-x-2 text-xs font-bold text-brand-dark dark:text-brand-light hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Menu</span>
            </button>
          ) : (
            <div className="flex items-center space-x-3">
              <img
                src="/logo.png"
                alt="Urbanrat"
                className="w-10 h-10 rounded-full object-cover shadow-xs border border-slate-100 dark:border-slate-700"
              />
              <div>
                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                  {settings?.store_info?.name || "URT Wholesale"}
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  Menu &amp; Navigation
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {showAuthForm ? (
            /* ── Auth Form View ── */
            <div className="animate-in fade-in duration-200">
              <CustomerAuth
                onAuthSuccess={() => {
                  setShowAuthForm(false);
                }}
              />
            </div>
          ) : (
            /* ── Main Actual Menu View ── */
            <>
              {/* User Account Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/80 flex items-center justify-between">
                <div
                  onClick={() => {
                    if (user) handleNavigate("/account");
                  }}
                  className={`flex items-center space-x-3 min-w-0 ${
                    user ? "cursor-pointer hover:opacity-90" : ""
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs"
                    style={{
                      background: "var(--brand-gradient)",
                    }}
                  >
                    {(profile?.full_name || user?.email || "U")[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {user
                        ? profile?.full_name || user.email || "Wholesale Customer"
                        : "Guest Visitor"}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                      {user ? (
                        <>
                          <ShieldCheck className="w-3 h-3 text-emerald-600 inline" />
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                            Verified Wholesale Account
                          </span>
                        </>
                      ) : (
                        <span>Sign in for wholesale pricing &amp; order history</span>
                      )}
                    </p>
                  </div>
                </div>

                {user ? (
                  <button
                    type="button"
                    onClick={() => handleNavigate("/account")}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-brand-dark dark:text-brand-light bg-sky-50 dark:bg-orange-500/15 hover:bg-sky-100 dark:hover:bg-orange-500/25 transition cursor-pointer shrink-0 border border-sky-100 dark:border-orange-500/30"
                  >
                    Account
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAuthForm(true)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white shadow-2xs hover:opacity-90 transition cursor-pointer shrink-0"
                    style={{
                      background: "var(--brand-gradient)",
                    }}
                  >
                    Login
                  </button>
                )}
              </div>

              {/* ── Theme Switcher Option in Drawer ── */}
              <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/70 dark:border-slate-700/80 p-3 flex items-center justify-between shadow-2xs">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700/80 text-amber-500 dark:text-amber-400 flex items-center justify-center border border-slate-100 dark:border-slate-600 shadow-2xs">
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-slate-700" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      {isDark ? "Dark Theme Active" : "Light Theme Active"}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {isDark ? "Black & Gradient Orange" : "Blue & White"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white shadow-xs transition active:scale-95 cursor-pointer"
                  style={{
                    background: "var(--brand-gradient)",
                  }}
                >
                  {isDark ? "Light Mode" : "Dark Mode"}
                </button>
              </div>

              {/* ── Menu Section 1: Store Navigation ── */}
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pb-1">
                  Storefront Navigation
                </p>

                <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/80 overflow-hidden shadow-2xs">
                  {/* Account link for logged-in users */}
                  {user && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleNavigate("/account")}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-orange-500/15 text-brand-dark dark:text-brand-light flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                              My Account
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              Profile, business info &amp; security
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNavigate("/addresses")}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-orange-500/15 text-brand-dark dark:text-brand-light flex items-center justify-center">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                              Saved Addresses
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              Manage shops &amp; warehouse addresses
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNavigate("/returns")}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                            <RotateCcw className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                              Returns &amp; Replacements
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              Track claims, warranty &amp; refunds
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                      </button>
                    </>
                  )}

                  {/* Home */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                        <Home className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Home
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                  </button>

                  {/* Marketplace */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/marketplace")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-orange-500/15 text-brand-dark dark:text-brand-light flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                          Marketplace
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          Bulk accessories &amp; volume deals
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                  </button>

                  {/* Urbanrat Original */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/urbanrat")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src="/logo.png"
                        alt="Urbanrat"
                        className="w-8 h-8 rounded-xl object-cover shadow-2xs"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                          Urbanrat Original
                        </span>
                        <span className="text-[10px] text-brand-dark dark:text-brand-light font-semibold">
                          Flagship private-label collection
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                  </button>

                  {/* Categories */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/categories")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 flex items-center justify-center">
                        <LayoutGrid className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        All Categories
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                  </button>

                  {/* Shopping Cart */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/cart")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Shopping Cart
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {cartCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-dark dark:bg-brand text-white">
                          {cartCount} items
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                    </div>
                  </button>

                  {/* My Orders */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/orders")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                          My Orders &amp; Invoices
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          Track dispatches &amp; downloads
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                  </button>
                </div>
              </div>

              {/* ── Menu Section 2: Wholesale Support & Policies ── */}
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pb-1">
                  Support &amp; Wholesale Information
                </p>

                <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/80 overflow-hidden shadow-2xs">
                  {/* WhatsApp Support */}
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                          WhatsApp Wholesale Desk
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          Direct chat with depot manager
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300 dark:text-slate-500" />
                  </a>

                  {/* Authorized Dealer Network */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/dealers")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-orange-500/15 text-brand-dark dark:text-brand-light flex items-center justify-center group-hover:bg-brand-dark group-hover:text-white transition">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            Authorized Dealer Network
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-100 dark:bg-orange-950/40 text-brand-dark dark:text-brand-light">
                            Apply
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          Wholesale tier application &amp; credit terms
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition" />
                  </button>

                  {/* About Us */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/about")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Info className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        About Urbanrat Labs
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                  </button>

                  {/* Terms & Conditions */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/terms")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Terms &amp; Wholesale Policy
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                  </button>

                  {/* Privacy Policy */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/privacy")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Privacy Policy
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                  </button>
                </div>

                {/* ── Quick Store Policies Strip ── */}
                <div className="pt-2 px-1 flex flex-wrap gap-1.5 justify-center">
                  {[
                    { label: "Shipping Policy", to: "/shipping" },
                    { label: "Returns Policy", to: "/returns-policy" },
                    { label: "1-Yr Warranty", to: "/warranty" },
                    { label: "Contact Us", to: "/contact" },
                  ].map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => handleNavigate(item.to)}
                      className="text-[10px] font-semibold text-slate-400 hover:text-brand-dark dark:hover:text-brand-light px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-cyan-50/50 dark:hover:bg-orange-500/10 border border-slate-200/60 dark:border-slate-700 transition cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Login and Logout button at the very last ── */}
              <div className="pt-2">
                {user ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center space-x-2 border border-rose-200 dark:border-rose-800/60 transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{signingOut ? "Logging Out..." : "Log Out of Account"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAuthForm(true)}
                    className="w-full py-3.5 px-4 rounded-2xl text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-md hover:opacity-95 transition active:scale-[0.99] cursor-pointer"
                    style={{
                      background: "var(--brand-gradient, linear-gradient(to bottom, #5ADBE5, #0A82A8))",
                    }}
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Log In / Create Wholesale Account</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
