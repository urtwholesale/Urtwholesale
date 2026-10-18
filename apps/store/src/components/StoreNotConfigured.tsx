import { Database, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";

export function StoreNotConfigured() {
  return (
    <div className="min-h-dvh bg-[#F8F9FB] flex flex-col font-sans text-slate-900 antialiased selection:bg-[#5ADBE5]/30">
      {/* ── Fixed Glassmorphism Top Bar ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-white/40 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="max-w-md md:max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="inline-flex items-center space-x-2 py-1.5 pl-2 pr-4 rounded-full bg-white border border-slate-100 shadow-2xs">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-xs"
              style={{
                background: "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
              }}
            >
              <Database className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-sm tracking-tight text-slate-900">
              URT Wholesale
            </span>
          </div>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60">
            Setup Required
          </span>
        </div>
      </header>

      {/* ── Main Message Container (Mobile-first 390px) ── */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-28 pb-16 flex flex-col justify-center text-center">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mx-auto shadow-xs">
            <AlertTriangle className="w-8 h-8 stroke-[2.2]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              Store Database Not Configured
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              This application is connected strictly to live Supabase data and does not use mock data. Supabase environment variables are missing or unconfigured.
            </p>
          </div>

          {/* Configuration Checklist */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-2.5 text-xs">
            <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              Required Environment Variables:
            </p>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="p-2 rounded-xl bg-white border border-slate-200/70 text-slate-700 flex items-center justify-between">
                <span>VITE_SUPABASE_URL</span>
                <span className="text-[10px] text-amber-600 font-sans font-bold">Missing / Placeholder</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200/70 text-slate-700 flex items-center justify-between">
                <span>VITE_SUPABASE_ANON_KEY</span>
                <span className="text-[10px] text-amber-600 font-sans font-bold">Missing / Placeholder</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Add your Supabase project parameters to <code className="bg-white px-1 rounded border border-slate-200">.env</code> locally or in your Vercel Project Settings.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 px-5 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-2"
              style={{
                background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
              }}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center space-x-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Urbanrat Store • Live Supabase Security Enforced</span>
        </div>
      </main>
    </div>
  );
}
