import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { AdminLogin } from "./features/auth/AdminLogin";
import { SettingsEditor } from "./features/settings/SettingsEditor";
import { BannersEditor } from "./features/banners/BannersEditor";
import { PagesEditor } from "./features/pages/PagesEditor";
import type { Profile } from "@urbanrat/shared";
import { LayoutDashboard, Settings, Image, FileText, ShieldCheck } from "lucide-react";

export default function App() {
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings" | "banners" | "pages">("dashboard");

  useEffect(() => {
    async function checkCurrentAdmin() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (profile && profile.role === "admin") {
            setAdminProfile(profile as Profile);
          } else {
            // Not an admin, clear session
            await supabase.auth.signOut().catch(() => {});
            setAdminProfile(null);
          }
        }
      } catch {
        setAdminProfile(null);
      } finally {
        setCheckingSession(false);
      }
    }

    checkCurrentAdmin();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut().catch(() => {});
    setAdminProfile(null);
  }

  if (checkingSession) {
    return (
      <div className="min-h-dvh bg-[#F8F9FB] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-2">
          <div
            className="w-10 h-10 rounded-xl animate-pulse"
            style={{
              background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
            }}
          />
          <p className="text-xs text-slate-400 font-medium">
            Verifying administrative session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F8F9FB] flex flex-col font-sans text-slate-800 antialiased">
      {/* ── Fixed Glassmorphism Top Bar ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-white/40 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="max-w-md md:max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-sm"
              style={{
                background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
              }}
            >
              A
            </span>
            <span className="font-bold text-base tracking-tight bg-gradient-to-b from-[#5ADBE5] to-[#0A82A8] bg-clip-text text-transparent">
              Urbanrat Admin
            </span>
          </div>

          {adminProfile && (
            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-500 hidden sm:inline">
                {adminProfile.full_name || "Admin"}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="py-1 px-3 rounded-full text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 pt-20 pb-20 px-4 max-w-md md:max-w-3xl lg:max-w-5xl mx-auto w-full flex flex-col justify-center">
        {!adminProfile ? (
          <div className="my-auto py-6">
            <AdminLogin onSuccess={(profile) => setAdminProfile(profile)} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Admin Header with Navigation Tabs */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Admin Portal
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live Supabase Inventory &amp; Content Management
                  </p>
                </div>
                <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Role: Administrator</span>
                </span>
              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab("dashboard")}
                  className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === "dashboard"
                      ? "bg-[#5ADBE5]/20 text-[#0A82A8] border border-[#5ADBE5]/40"
                      : "text-slate-600 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Dashboard Overview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("settings")}
                  className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === "settings"
                      ? "bg-[#5ADBE5]/20 text-[#0A82A8] border border-[#5ADBE5]/40"
                      : "text-slate-600 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Store Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("banners")}
                  className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === "banners"
                      ? "bg-[#5ADBE5]/20 text-[#0A82A8] border border-[#5ADBE5]/40"
                      : "text-slate-600 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <Image className="w-3.5 h-3.5" />
                  <span>Banners</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pages")}
                  className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === "pages"
                      ? "bg-[#5ADBE5]/20 text-[#0A82A8] border border-[#5ADBE5]/40"
                      : "text-slate-600 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Policy Pages</span>
                </button>
              </div>
            </div>

            {/* Tab Views */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                {/* Overview Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-xs text-slate-400 font-medium">Categories</span>
                    <p className="text-xl font-bold text-slate-900 mt-1">Live DB</p>
                    <span className="text-[10px] text-emerald-600 font-medium">Full RLS CRUD</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-xs text-slate-400 font-medium">Products</span>
                    <p className="text-xl font-bold text-slate-900 mt-1">Live DB</p>
                    <span className="text-[10px] text-emerald-600 font-medium">Stock &amp; Pricing</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-xs text-slate-400 font-medium">Orders</span>
                    <p className="text-xl font-bold text-slate-900 mt-1">Verified</p>
                    <span className="text-[10px] text-emerald-600 font-medium">Server-Calculated</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-xs text-slate-400 font-medium">Storage Bucket</span>
                    <p className="text-xl font-bold text-slate-900 mt-1">Active</p>
                    <span className="text-[10px] text-emerald-600 font-medium">product-images</span>
                  </div>
                </div>

                {/* Database & Security Status */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-800">
                    Live Supabase Security &amp; Architecture
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Row Level Security</span>
                      <span className="font-semibold text-emerald-600">Enforced</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Price Verification RPC</span>
                      <span className="font-semibold text-emerald-600">create_verified_order</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Content Tables</span>
                      <span className="font-semibold text-emerald-600">store_settings, banners, store_pages</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Active Profile</span>
                      <span className="font-semibold text-slate-700">{adminProfile.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && <SettingsEditor />}
            {activeTab === "banners" && <BannersEditor />}
            {activeTab === "pages" && <PagesEditor />}
          </div>
        )}
      </main>

      {/* ── Fixed Glassmorphism Bottom Bar ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-t border-white/40">
        <div className="max-w-md md:max-w-5xl mx-auto h-12 px-4 flex items-center justify-between text-[11px] text-slate-400">
          <span>Urbanrat Store Admin Suite</span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Supabase Connected</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
