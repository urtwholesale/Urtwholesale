import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { CategoryChipsSkeleton } from "../components/Skeletons";
import { ErrorState } from "../components/ErrorState";
import { HeroStackedCarousel } from "../components/HeroStackedCarousel";
import { CategoryProductSlider } from "../components/CategoryProductSlider";
import {
  fetchCategories,
  fetchProducts,
  getBanners,
} from "../services/storeService";
import { getRecentlyViewed } from "../services/recentViews";
import { getCategoryThemeImage } from "../utils/categoryTheme";
import { useSettings } from "../context/SettingsContext";
import type { Product, Category, Banner } from "@urbanrat/shared";
import {
  ShieldCheck,
  Truck,
  ArrowRight,
  Zap,
  Flame,
  Award,
  Volume2,
  Clock,
  Layers,
} from "lucide-react";

interface HomePageProps {
  onAddToCart: (product: Product, quantity?: number) => void;
}

export function HomePage({ onAddToCart }: HomePageProps) {
  const { settings } = useSettings();

  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [cableProducts, setCableProducts] = useState<Product[]>([]);
  const [speakerProducts, setSpeakerProducts] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  const [cableCategory, setCableCategory] = useState<Category | null>(null);
  const [speakerCategory, setSpeakerCategory] = useState<Category | null>(null);

  const [allBanners, setAllBanners] = useState<Banner[]>([]);
  const [brandBanner, setBrandBanner] = useState<Banner | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHomeData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cats = await fetchCategories();
      const parents = cats.filter((c) => c.parent_id === null);
      setCategories(parents);

      // Locate Cables category (parent or top-level)
      const cableCat =
        cats.find(
          (c) =>
            c.slug === "cables" ||
            c.name.toLowerCase().includes("cable") ||
            c.name.toLowerCase().includes("cord")
        ) || null;
      setCableCategory(cableCat);

      // Locate Speakers & Audio category
      const speakerCat =
        cats.find(
          (c) =>
            c.slug === "audio" ||
            c.slug === "speakers" ||
            c.name.toLowerCase().includes("speaker") ||
            c.name.toLowerCase().includes("audio")
        ) || null;
      setSpeakerCategory(speakerCat);

      // Parallelize fetching curated collections
      const [featuredRes, arrivalsRes, cablesRes, speakersRes, banners] =
        await Promise.all([
          fetchProducts({ isFeatured: true, limit: 12 }),
          fetchProducts({ limit: 12, sort: "newest" }),
          cableCat
            ? fetchProducts({ categoryId: cableCat.id, limit: 12 })
            : Promise.resolve({ products: [], total: 0 }),
          speakerCat
            ? fetchProducts({ categoryId: speakerCat.id, limit: 12 })
            : Promise.resolve({ products: [], total: 0 }),
          getBanners(),
        ]);

      setFeaturedProducts(featuredRes.products);
      setNewArrivals(arrivalsRes.products);
      setCableProducts(cablesRes.products);
      setSpeakerProducts(speakersRes.products);
      setAllBanners(banners);

      const brand = banners.find((b) => b.placement === "home_brand") || null;
      setBrandBanner(brand);

      // Load recently viewed products from localStorage (with fallback to top picks)
      const recents = getRecentlyViewed();
      if (recents.length > 0) {
        setRecentlyViewed(recents);
      } else {
        setRecentlyViewed(featuredRes.products.slice(0, 5));
      }
    } catch (err: unknown) {
      console.error("Error loading home data:", err);
      setError(err instanceof Error ? err.message : "Failed to load store data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  // Sync recently viewed products whenever the window regains focus
  useEffect(() => {
    const handleFocus = () => {
      const recents = getRecentlyViewed();
      if (recents.length > 0) {
        setRecentlyViewed(recents);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  if (error && !loading) {
    return (
      <div className="py-8">
        <ErrorState
          title="Storefront Temporarily Unavailable"
          message={error}
          onRetry={loadHomeData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-12 animate-in fade-in duration-300 pb-16">
      {/* ── 1. Hero 3D Stacked Offer Cards Carousel ── */}
      {loading ? (
        <div className="h-102.5 sm:h-117.5 md:h-125 flex items-center justify-center">
          <div className="w-70 sm:w-82.5 md:w-87.5 h-95 sm:h-110 md:h-116.25 rounded-3xl bg-slate-100 dark:bg-slate-800/60 animate-pulse border border-slate-200/60 dark:border-slate-800 shadow-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <HeroStackedCarousel
            dbBanners={allBanners.filter((b) => b.placement === "home_hero")}
          />

          {/* Wholesale Trust Signals Bar */}
          {settings?.value_badges && settings.value_badges.length > 0 && (
            <div className="py-3 px-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 shadow-2xs grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-600 dark:text-slate-400 text-xs max-w-4xl mx-auto">
              {settings.value_badges.map((badge, idx) => (
                <div
                  key={idx}
                  className={`flex items-center space-x-2 ${
                    idx > 1 ? "hidden sm:flex" : ""
                  }`}
                >
                  {badge.icon === "Truck" ? (
                    <Truck className="w-4 h-4 text-brand-dark dark:text-orange-400 shrink-0" />
                  ) : badge.icon === "Zap" ? (
                    <Zap className="w-4 h-4 text-brand-dark dark:text-orange-400 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-brand-dark dark:text-orange-400 shrink-0" />
                  )}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {badge.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 2. Horizontal Browse by Category Rail (Vertical Rectangular Cards) ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Browse by Category
          </h2>
          <Link
            to="/categories"
            className="text-xs font-bold text-brand-dark dark:text-brand-light hover:underline flex items-center space-x-1"
          >
            <span>All Categories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <CategoryChipsSkeleton count={6} />
        ) : categories.length > 0 ? (
          <div className="flex items-center space-x-2 sm:space-x-2.5 overflow-x-auto scrollbar-none no-scrollbar py-0.5 px-0.5">
            {/* "All Products" Card */}
            <Link
              to="/marketplace"
              className="group relative shrink-0 w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 aspect-square rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all select-none text-left border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25 hover:shadow-md"
            >
              <img
                src={getCategoryThemeImage("all")}
                alt="All Products"
                className="w-full h-full object-cover rounded-xl sm:rounded-2xl group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
              <div className="absolute bottom-1.5 left-1.5 right-1.5 z-10">
                <Layers className="w-3 h-3 text-orange-400 mb-0.5 drop-shadow-xs" />
                <span className="text-[10px] sm:text-[11px] font-black text-white leading-tight drop-shadow-md line-clamp-2 block">
                  All Products
                </span>
              </div>
            </Link>

            {/* Parent Category Cards */}
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/marketplace?category=${cat.slug}`}
                className="group relative shrink-0 w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 aspect-square rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all select-none text-left border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25 hover:shadow-md"
              >
                <img
                  src={getCategoryThemeImage(cat)}
                  alt={cat.name}
                  className="w-full h-full object-cover rounded-xl sm:rounded-2xl group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-transparent pointer-events-none" />
                <div className="absolute bottom-1.5 left-1.5 right-1.5 z-10">
                  <span className="text-[10px] sm:text-[11px] font-black text-white leading-tight drop-shadow-md line-clamp-2 block">
                    {cat.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {/* ── 3. Bestsellers Slider (Single Card View, Gold/Amber Theme) ── */}
      <CategoryProductSlider
        title="Bestsellers"
        subtitle="Top-selling wholesale products with high retail margins"
        badgeTag="🏆 #1 Bestseller"
        icon={<Award className="w-4 h-4 stroke-[2.2]" />}
        products={featuredProducts}
        seeMoreUrl="/marketplace?sort=price_desc"
        themeColor="amber"
        onAddToCart={onAddToCart}
        isLoading={loading}
      />

      {/* ── 4. Cables & Cords Slider (Single Card View, Cyan Theme) ── */}
      <CategoryProductSlider
        title="Cables & Cords"
        subtitle="100W PD fast charging & reinforced ballistic braided cords"
        badgeTag="⚡ 100W PD & Fast Sync"
        icon={<Zap className="w-4 h-4 stroke-[2.2]" />}
        products={cableProducts}
        seeMoreUrl={
          cableCategory
            ? `/marketplace?category=${cableCategory.slug}`
            : "/marketplace?category=cables"
        }
        themeColor="cyan"
        onAddToCart={onAddToCart}
        isLoading={loading}
      />

      {/* ── 5. Brand Highlight Section from Live Database Banners ── */}
      {brandBanner && (
        <section className="relative overflow-hidden rounded-3xl p-5 sm:p-8 bg-linear-to-r from-slate-950 via-slate-900 to-cyan-950 dark:to-orange-950/60 text-white shadow-md border border-slate-800/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-lg">
              {brandBanner.badge_text && (
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-brand-light border border-white/10 shadow-xs">
                  <img
                    src="/logo.png"
                    alt="Urbanrat"
                    className="w-3.5 h-3.5 rounded-full object-cover"
                  />
                  <span>{brandBanner.badge_text}</span>
                </div>
              )}
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {brandBanner.title}
              </h2>
              {brandBanner.subtitle && (
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {brandBanner.subtitle}
                </p>
              )}
            </div>

            <div className="shrink-0">
              <Link
                to={brandBanner.cta_link || brandBanner.link_url || "/urbanrat"}
                className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl text-slate-950 dark:text-white font-black text-xs sm:text-sm hover:opacity-95 shadow-lg active:scale-95 transition"
                style={{
                  background: "var(--brand-gradient)",
                  boxShadow: "var(--brand-shadow)",
                }}
              >
                <span>{brandBanner.cta_text || "Explore Collection"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 6. Speakers & Audio Slider (Single Card View, Violet Theme) ── */}
      <CategoryProductSlider
        title="Speakers & Audio"
        subtitle="Hi-Fi acoustic drivers, deep bass & Bluetooth wireless audio"
        badgeTag="🔊 Studio Audio"
        icon={<Volume2 className="w-4 h-4 stroke-[2.2]" />}
        products={speakerProducts}
        seeMoreUrl={
          speakerCategory
            ? `/marketplace?category=${speakerCategory.slug}`
            : "/marketplace?category=audio"
        }
        themeColor="violet"
        onAddToCart={onAddToCart}
        isLoading={loading}
      />

      {/* ── 7. New Arrivals Slider (Single Card View, Rose Theme) ── */}
      <CategoryProductSlider
        title="New Arrivals"
        subtitle="Freshly stocked wholesale accessories direct from factory lines"
        badgeTag="🔥 Fresh Factory Drop"
        icon={<Flame className="w-4 h-4 stroke-[2.2]" />}
        products={newArrivals}
        seeMoreUrl="/marketplace?sort=newest"
        themeColor="rose"
        onAddToCart={onAddToCart}
        isLoading={loading}
      />

      {/* ── 8. Recently Viewed Slider (Single Card View, Obsidian/Slate Theme) ── */}
      {recentlyViewed.length > 0 && (
        <CategoryProductSlider
          title="Recently Viewed"
          subtitle="Quickly re-check wholesale items you previously inspected"
          badgeTag="👁️ Recently Viewed"
          icon={<Clock className="w-4 h-4 stroke-[2.2]" />}
          products={recentlyViewed}
          seeMoreUrl="/marketplace"
          themeColor="slate"
          onAddToCart={onAddToCart}
          isLoading={loading}
        />
      )}
    </div>
  );
}
