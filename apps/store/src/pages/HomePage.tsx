import { useState, useEffect } from "react";
import { Link } from "react-router";
import { ProductCard } from "../components/ProductCard";
import { ProductGridSkeleton, CategoryChipsSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/EmptyState";
import { fetchCategories, fetchProducts } from "../services/storeService";
import type { Product, Category } from "@urbanrat/shared";
import {
  ShieldCheck,
  Truck,
  Sparkles,
  ArrowRight,
  Zap,
  Flame,
  Award,
} from "lucide-react";

interface HomePageProps {
  onAddToCart: (product: Product) => void;
}

export function HomePage({ onAddToCart }: HomePageProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadHomeData() {
      setLoading(true);
      try {
        const [cats, featuredRes, arrivalsRes] = await Promise.all([
          fetchCategories(),
          fetchProducts({ isFeatured: true, limit: 6 }),
          fetchProducts({ limit: 6, sort: "newest" }),
        ]);

        if (isMounted) {
          // Parent categories for chips
          setCategories(cats.filter((c) => c.parent_id === null));
          setFeaturedProducts(featuredRes.products);
          setNewArrivals(arrivalsRes.products);
        }
      } catch (err) {
        console.error("Error loading home data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHomeData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-7 sm:space-y-10 animate-in fade-in duration-300 pb-8">
      {/* ── 1. Hero Banner Area with Brand Gradient & Accessories Showcase ── */}
      <section className="relative overflow-hidden rounded-3xl p-5 sm:p-8 md:p-10 lg:p-12 bg-gradient-to-br from-[#5ADBE5]/15 via-white to-[#0A82A8]/10 border border-[#5ADBE5]/30 shadow-xs">
        {/* Ambient radial glow */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{
            background: "radial-gradient(circle, #5ADBE5 0%, #0A82A8 100%)",
          }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Headlines & CTA */}
          <div className="lg:col-span-7 xl:col-span-7 text-left space-y-4">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-[#0A82A8] bg-white shadow-xs border border-[#5ADBE5]/30">
              <Sparkles className="w-3.5 h-3.5 text-[#5ADBE5]" />
              <span>URP Wholesale Direct</span>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
              Next-Gen Mobile Gear,{" "}
              <span className="bg-gradient-to-b from-[#5ADBE5] to-[#0A82A8] bg-clip-text text-transparent">
                Factory Direct
              </span>
            </h1>

            <p className="text-xs sm:text-sm md:text-base lg:text-lg text-slate-600 max-w-xl leading-relaxed">
              Engineered 9H tempered glass, 65W GaN fast chargers, and indestructible braided cables. Premium retail quality at wholesale prices.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                to="/marketplace"
                className="inline-flex items-center space-x-2 py-3 px-6 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg active:scale-95 transition-all"
                style={{
                  background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                }}
              >
                <span>Explore Marketplace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/urbanrat"
                className="py-3 px-5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-50 transition shadow-xs"
              >
                Urbanrat Original
              </Link>
            </div>
          </div>

          {/* Right Column: Hero Wholesale Product Image Showcase */}
          <div className="lg:col-span-5 xl:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none rounded-3xl overflow-hidden shadow-xl border border-white/80 bg-white/60 backdrop-blur-md group hover:shadow-2xl transition-all duration-300">
              <img
                src="/hero-accessories.jpg"
                alt="Wholesale Mobile Accessories - 9H Tempered Glass, GaN Fast Chargers, Indestructible Cables, Car Mounts"
                className="w-full h-auto object-cover rounded-3xl group-hover:scale-105 transition-transform duration-500 aspect-[4/3]"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

              {/* Floating Quality Badge */}
              <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-white shadow-md flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-slate-800 tracking-tight">
                  Commercial Retail Ready
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Value Badges */}
        <div className="mt-8 pt-5 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-3 gap-4 text-slate-600 text-xs">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#0A82A8] shrink-0" />
            <span className="font-semibold">100% Quality Inspected</span>
          </div>
          <div className="flex items-center space-x-2">
            <Truck className="w-4 h-4 text-[#0A82A8] shrink-0" />
            <span className="font-semibold">Pan-India Express Dispatch</span>
          </div>
          <div className="hidden sm:flex items-center space-x-2">
            <Zap className="w-4 h-4 text-[#0A82A8] shrink-0" />
            <span className="font-semibold">Wholesale Bulk Margin Ready</span>
          </div>
        </div>
      </section>

      {/* ── 2. Horizontal Category Chips ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Browse by Category
          </h2>
          <Link
            to="/categories"
            className="text-xs font-bold text-[#0A82A8] hover:underline flex items-center space-x-1"
          >
            <span>All Categories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <CategoryChipsSkeleton count={5} />
        ) : (
          <div className="flex space-x-2.5 overflow-x-auto pb-2 scrollbar-none no-scrollbar -mx-1 px-1">
            <Link
              to="/marketplace"
              className="px-4 py-2 rounded-full text-xs font-bold text-white shrink-0 shadow-xs hover:opacity-95 transition"
              style={{
                background: "linear-gradient(180deg, #5ADBE5 0%, #0A82A8 100%)",
              }}
            >
              All Categories
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/marketplace?category=${cat.slug}`}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-bold bg-white border border-slate-200/90 text-slate-800 hover:border-[#5ADBE5] hover:text-[#0A82A8] shrink-0 shadow-xs transition"
              >
                {cat.image_url && (
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                )}
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── 3. "Featured" Product Row ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded-lg bg-amber-50 text-amber-600">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Featured Highlights
              </h2>
              <p className="text-[11px] text-slate-500">
                Top rated accessories chosen by tech retailers
              </p>
            </div>
          </div>

          <Link
            to="/marketplace"
            className="text-xs font-bold text-[#0A82A8] hover:underline"
          >
            View More
          </Link>
        </div>

        {loading ? (
          <ProductGridSkeleton count={6} />
        ) : featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No featured products right now"
            description="Explore our full catalog in the marketplace."
          />
        )}
      </section>

      {/* ── 4. Urbanrat Brand Highlight Section ── */}
      <section className="relative overflow-hidden rounded-3xl p-5 sm:p-8 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-lg">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-[#5ADBE5] border border-white/10">
              <Zap className="w-3 h-3 text-[#5ADBE5]" />
              <span>In-House Engineering</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Urbanrat Original Gear
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Designed from scratch with high-density ballistic nylon, Gallium Nitride internals, and sapphire-infused glass. Built for heavy commercial and daily use.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                ✓ 9H Sapphire Hardness
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                ✓ 50,000+ Bend Testing
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                ✓ 1-Year Swap Guarantee
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <Link
              to="/urbanrat"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl text-slate-950 font-black text-xs sm:text-sm bg-gradient-to-r from-[#5ADBE5] to-[#1EAFC7] hover:opacity-95 shadow-lg active:scale-95 transition"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 5. "New Arrivals" Grid ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded-lg bg-rose-50 text-rose-600">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                New Arrivals
              </h2>
              <p className="text-[11px] text-slate-500">
                Freshly stocked wholesale accessories
              </p>
            </div>
          </div>

          <Link
            to="/marketplace?sort=newest"
            className="text-xs font-bold text-[#0A82A8] hover:underline"
          >
            See All
          </Link>
        </div>

        {loading ? (
          <ProductGridSkeleton count={6} />
        ) : newArrivals.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {newArrivals.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No new arrivals found"
            description="Check back soon for new inventory arrivals."
          />
        )}
      </section>
    </div>
  );
}
