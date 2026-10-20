import { useState, useEffect, useCallback } from "react";
import { MarketplacePage } from "./MarketplacePage";
import { getBanners } from "../services/storeService";
import { ErrorState } from "../components/ErrorState";
import type { Product, Banner } from "@urbanrat/shared";
import { ShieldCheck, Award, Flame, Star } from "lucide-react";

interface UrbanratPageProps {
  onAddToCart: (product: Product) => void;
  cartCount?: number;
}

export function UrbanratPage({ onAddToCart, cartCount = 0 }: UrbanratPageProps) {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBanner = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const banners = await getBanners("urbanrat_hero");
      if (banners.length > 0) {
        setBanner(banners[0]!);
      } else {
        setBanner(null);
      }
    } catch (err: any) {
      console.error("Failed to load Urbanrat banner:", err);
      setError(err?.message || "Failed to load Urbanrat brand details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBanner();
  }, [loadBanner]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* ── Branded Header Banner from Live Database ── */}
      {loading ? (
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-10 bg-slate-900 border border-cyan-900/40 animate-pulse">
          <div className="max-w-2xl space-y-4">
            <div className="h-6 w-36 bg-slate-800 rounded-full" />
            <div className="h-9 w-3/4 bg-slate-800 rounded-2xl" />
            <div className="h-4 w-full bg-slate-800 rounded-lg" />
            <div className="h-4 w-2/3 bg-slate-800 rounded-lg" />
            <div className="pt-4 grid grid-cols-3 gap-3">
              <div className="h-16 bg-slate-800/60 rounded-2xl" />
              <div className="h-16 bg-slate-800/60 rounded-2xl" />
              <div className="h-16 bg-slate-800/60 rounded-2xl" />
            </div>
          </div>
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load brand highlight"
          message={error}
          onRetry={loadBanner}
        />
      ) : banner ? (
        <section className="relative overflow-hidden rounded-3xl p-6 sm:p-10 bg-slate-950 text-white shadow-xl border border-cyan-900/40">
          {/* Ambient Gradient Glow */}
          <div
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-35 pointer-events-none"
            style={{
              background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
            }}
          />

          <div className="relative z-10 max-w-2xl lg:max-w-3xl">
            {banner.badge_text && (
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold text-white bg-white/10 backdrop-blur-md border border-white/15 mb-4 shadow-sm">
                <img
                  src="/logo.png"
                  alt="Urbanrat"
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span className="text-brand-light">{banner.badge_text}</span>
              </div>
            )}

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              {banner.title}
            </h1>

            {banner.subtitle && (
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                {banner.subtitle}
              </p>
            )}

            {banner.badges && banner.badges.length > 0 && (
              <div className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
                {banner.badges.map((b, idx) => (
                  <div
                    key={idx}
                    className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-xs"
                  >
                    {b.icon === "Flame" ? (
                      <Flame className="w-5 h-5 text-brand-light mx-auto mb-1" />
                    ) : b.icon === "Award" ? (
                      <Award className="w-5 h-5 text-brand-light mx-auto mb-1" />
                    ) : b.icon === "Star" ? (
                      <Star className="w-5 h-5 text-brand-light mx-auto mb-1" />
                    ) : (
                      <ShieldCheck className="w-5 h-5 text-brand-light mx-auto mb-1" />
                    )}
                    {b.label && (
                      <p className="text-[10px] text-slate-400 font-medium">{b.label}</p>
                    )}
                    <p className="text-xs font-black text-white">{b.value || b.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* ── Marketplace Experience with brandOnly={true} ── */}
      <MarketplacePage
        onAddToCart={onAddToCart}
        brandOnly={true}
        cartCount={cartCount}
      />
    </div>
  );
}
