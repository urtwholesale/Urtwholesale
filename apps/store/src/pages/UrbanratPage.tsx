import { useState, useEffect } from "react";
import { MarketplacePage } from "./MarketplacePage";
import { fetchBanners } from "../services/storeService";
import type { Product, Banner } from "@urbanrat/shared";
import { Zap, ShieldCheck, Award, Flame } from "lucide-react";

interface UrbanratPageProps {
  onAddToCart: (product: Product) => void;
  cartCount?: number;
}

export function UrbanratPage({ onAddToCart, cartCount = 0 }: UrbanratPageProps) {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    fetchBanners("urbanrat_hero").then((banners) => {
      if (banners.length > 0) {
        setBanner(banners[0]!);
      }
    });
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* ── Branded Header Banner from Live Database ── */}
      <section className="relative overflow-hidden rounded-3xl p-6 sm:p-10 bg-slate-950 text-white shadow-xl border border-cyan-900/40">
        {/* Ambient Gradient Glow */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-35 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
          }}
        />

        <div className="relative z-10 max-w-2xl lg:max-w-3xl">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-[#5ADBE5] bg-white/10 backdrop-blur-md border border-white/10 mb-4">
            <Zap className="w-3.5 h-3.5 text-[#5ADBE5]" />
            <span>{banner?.badge_text || "Urbanrat In-House Labs"}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            {banner?.title || "The Urbanrat Standard."}
          </h1>

          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            {banner?.subtitle ||
              "Engineered exclusively for extreme durability, daily drops, and maximum power delivery. Certified for commercial retail quality with hassle-free wholesale warranty."}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-[#5ADBE5] mx-auto mb-1" />
              <p className="text-[10px] text-slate-400 font-medium">Hardness</p>
              <p className="text-xs font-black text-white">9H Sapphire</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-xs">
              <Award className="w-5 h-5 text-[#5ADBE5] mx-auto mb-1" />
              <p className="text-[10px] text-slate-400 font-medium">Conductors</p>
              <p className="text-xs font-black text-white">Pure Copper</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-xs">
              <Flame className="w-5 h-5 text-[#5ADBE5] mx-auto mb-1" />
              <p className="text-[10px] text-slate-400 font-medium">Thermal QA</p>
              <p className="text-xs font-black text-white">GaN III Turbo</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marketplace Experience with brandOnly={true} ── */}
      <MarketplacePage
        onAddToCart={onAddToCart}
        brandOnly={true}
        cartCount={cartCount}
      />
    </div>
  );
}
