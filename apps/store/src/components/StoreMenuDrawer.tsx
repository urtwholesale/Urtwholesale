import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useSettings } from "../context/SettingsContext";
import { CustomerAuth } from "../features/auth/CustomerAuth";
import type { Profile } from "@urbanrat/shared";
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

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Sync session state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data) {
        setProfile(data as Profile);
      }
    } catch {
      // Ignored
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
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
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity cursor-pointer"
        aria-hidden="true"
      />

      {/* ── Slide-Up Menu Sheet ── */}
      <div
        className="relative z-10 w-full sm:max-w-md bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 border border-slate-100"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
      >
        {/* Drag handle pill (Mobile) */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* ── Header Bar ── */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          {showAuthForm ? (
            <button
              type="button"
              onClick={() => setShowAuthForm(false)}
              className="flex items-center space-x-2 text-xs font-bold text-[#0A82A8] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Menu</span>
            </button>
          ) : (
            <div className="flex items-center space-x-3">
              <img
                src="/logo.png"
                alt="Urbanrat"
                className="w-10 h-10 rounded-full object-cover shadow-xs border border-slate-100"
              />
              <div>
                <h3 className="font-black text-sm sm:text-base text-slate-900 leading-tight">
                  {settings?.store_info?.name || "URT Wholesale"}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Menu &amp; Navigation
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
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
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs"
                    style={{
                      background: "linear-gradient(135deg, #5ADBE5, #0A82A8)",
                    }}
                  >
                    {(profile?.full_name || user?.email || "U")[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {user
                        ? profile?.full_name || user.email || "Wholesale Customer"
                        : "Guest Visitor"}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center space-x-1">
                      {user ? (
                        <>
                          <ShieldCheck className="w-3 h-3 text-emerald-600 inline" />
                          <span className="text-emerald-700 font-semibold">
                            Verified Wholesale Account
                          </span>
                        </>
                      ) : (
                        <span>Sign in for wholesale pricing &amp; order history</span>
                      )}
                    </p>
                  </div>
                </div>

                {!user && (
                  <button
                    type="button"
                    onClick={() => setShowAuthForm(true)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white shadow-2xs hover:opacity-90 transition cursor-pointer shrink-0"
                    style={{
                      background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                    }}
                  >
                    Login
                  </button>
                )}
              </div>

              {/* ── Menu Section 1: Store Navigation ── */}
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 pb-1">
                  Storefront Navigation
                </p>

                <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                  {/* Home */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                        <Home className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        Home
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Marketplace */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/marketplace")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-50 text-[#0A82A8] flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Marketplace
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Bulk accessories &amp; volume deals
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Urbanrat Original */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/urbanrat")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src="/logo.png"
                        alt="Urbanrat"
                        className="w-8 h-8 rounded-xl object-cover shadow-2xs"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Urbanrat Original
                        </span>
                        <span className="text-[10px] text-[#0A82A8] font-semibold">
                          Flagship private-label collection
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Categories */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/categories")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                        <LayoutGrid className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        All Categories
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Shopping Cart */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/cart")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        Shopping Cart
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {cartCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#0A82A8] text-white">
                          {cartCount} items
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </button>

                  {/* My Orders */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/menu")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          My Orders &amp; Invoices
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Track dispatches &amp; downloads
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>
                </div>
              </div>

              {/* ── Menu Section 2: Wholesale Support & Policies ── */}
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 pb-1">
                  Support &amp; Wholesale Information
                </p>

                <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                  {/* WhatsApp Support */}
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          WhatsApp Wholesale Desk
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Direct chat with depot manager
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                  </a>

                  {/* About Us */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/menu")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Info className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        About Urbanrat Labs
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Terms & Conditions */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/menu")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        Terms &amp; Wholesale Policy
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Privacy Policy */}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/menu")}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        Privacy Policy
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Merchant Admin Portal */}
                  <a
                    href="http://localhost:5174"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Merchant Admin Portal
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Inventory, orders &amp; settings
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                  </a>
                </div>
              </div>

              {/* ── Login and Logout button at the very last ── */}
              <div className="pt-2">
                {user ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center space-x-2 border border-rose-200 transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
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
                      background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
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
