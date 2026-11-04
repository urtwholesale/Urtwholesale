import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { CategoryChipsSkeleton } from "../components/Skeletons";
import { ErrorState } from "../components/ErrorState";
import { HeroStackedCarousel } from "../components/HeroStackedCarousel";
import { CursorPhobicDots } from "../components/CursorPhobicDots";
import { WholesaleMarquee } from "../components/WholesaleMarquee";
import { CategoryProductSlider } from "../components/CategoryProductSlider";
import {
  fetchCategories,
  fetchProducts,
  fetchNewArrivalsAcrossCategories,
  getBanners,
} from "../services/storeService";
import { getRecentlyViewed } from "../services/recentViews";
import { getCategoryThemeImage } from "../utils/categoryTheme";
import { translateCategoryName } from "../locales/categoryTranslations";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { useLanguage } from "../context/LanguageContext";
import {
  type Product,
  type Category,
  type Banner,
  DEFAULT_HOMEPAGE_SECTIONS,
} from "@urbanrat/shared";
import {
  ArrowRight,
  Zap,
  Flame,
  Clock,
  Percent,
  Sparkles,
  ShieldCheck,
  Crown,
  Headphones,
  Trophy,
} from "lucide-react";

interface HomePageProps {
  onAddToCart: (product: Product, quantity?: number) => void;
}

function getSectionIcon(iconName: string) {
  switch (iconName) {
    case "Crown":
    case "Award":
      return (
        <Crown className="w-5 h-5 fill-amber-500 text-amber-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.55)] transition-transform duration-300 group-hover:scale-110" />
      );
    case "Trophy":
      return (
        <Trophy className="w-5 h-5 fill-amber-500 text-amber-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.55)] transition-transform duration-300 group-hover:scale-110" />
      );
    case "Zap":
      return (
        <Zap className="w-5 h-5 fill-cyan-400 text-cyan-300 stroke-[2] drop-shadow-[0_2px_8px_rgba(6,182,212,0.6)] transition-transform duration-300 group-hover:scale-110" />
      );
    case "Headphones":
    case "Volume2":
      return (
        <Headphones className="w-5 h-5 fill-violet-500 text-violet-400 drop-shadow-[0_2px_8px_rgba(139,92,246,0.55)] transition-transform duration-300 group-hover:scale-110" />
      );
    case "Flame":
      return (
        <Flame className="w-5 h-5 fill-rose-500 text-rose-500 drop-shadow-[0_2px_8px_rgba(244,63,94,0.6)] transition-transform duration-300 group-hover:scale-110" />
      );
    case "Sparkles":
      return (
        <Sparkles className="w-5 h-5 fill-cyan-400 text-cyan-300 drop-shadow-[0_2px_8px_rgba(34,211,238,0.55)] transition-transform duration-300 group-hover:scale-110" />
      );
    case "Percent":
      return (
        <Percent className="w-5 h-5 stroke-[2.8] text-emerald-500 drop-shadow-[0_2px_8px_rgba(16,185,129,0.55)] transition-transform duration-300 group-hover:scale-110" />
      );
    case "ShieldCheck":
      return (
        <ShieldCheck className="w-5 h-5 fill-cyan-500/25 text-cyan-500 stroke-[2.4] drop-shadow-[0_2px_8px_rgba(6,182,212,0.55)] transition-transform duration-300 group-hover:scale-110" />
      );
    case "Clock":
      return (
        <Clock className="w-5 h-5 text-slate-800 dark:text-orange-400 stroke-[2.4] drop-shadow-[0_2px_8px_rgba(249,115,22,0.4)] transition-transform duration-300 group-hover:scale-110" />
      );
    default:
      return (
        <Zap className="w-5 h-5 fill-cyan-400 text-cyan-300 stroke-[2] drop-shadow-[0_2px_8px_rgba(6,182,212,0.6)] transition-transform duration-300 group-hover:scale-110" />
      );
  }
}

export function HomePage({ onAddToCart }: HomePageProps) {
  const { isDark } = useTheme();
  const { settings } = useSettings();
  const { t, isHindi } = useLanguage();

  const [categories, setCategories] = useState<Category[]>([]);
  const [sectionProductsMap, setSectionProductsMap] = useState<Record<string, Product[]>>({});
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [allBanners, setAllBanners] = useState<Banner[]>([]);
  const [brandBanner, setBrandBanner] = useState<Banner | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active homepage divisions derived from store_settings or factory defaults
  const activeSections = useMemo(() => {
    const list =
      settings?.homepage_sections &&
      Array.isArray(settings.homepage_sections) &&
      settings.homepage_sections.length > 0
        ? settings.homepage_sections
        : DEFAULT_HOMEPAGE_SECTIONS;

    return [...list]
      .filter((s) => s.is_enabled)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [settings?.homepage_sections]);

  const loadHomeData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cats = await fetchCategories();
      const parents = cats.filter((c) => c.parent_id === null);
      setCategories(parents);

      // Pre-fetch shared pools in parallel
      const [featuredRes, arrivalsProducts, banners] = await Promise.all([
        fetchProducts({ isFeatured: true, limit: 24 }),
        fetchNewArrivalsAcrossCategories(cats, 2, 24),
        getBanners(),
      ]);

      setAllBanners(banners);
      const brand = banners.find((b) => b.placement === "home_brand") || null;
      setBrandBanner(brand);

      // Fetch products for each active configured homepage division
      const productsMap: Record<string, Product[]> = {};

      await Promise.all(
        activeSections.map(async (sec) => {
          const limit = sec.product_limit || 12;

          if (sec.type === "bestsellers") {
            productsMap[sec.id] = featuredRes.products.slice(0, limit);
          } else if (sec.type === "new_arrivals") {
            productsMap[sec.id] = arrivalsProducts.slice(0, limit);
          } else if (sec.type === "deals") {
            try {
              const res = await fetchProducts({ sort: "price_asc", limit });
              productsMap[sec.id] = res.products;
            } catch {
              productsMap[sec.id] = [];
            }
          } else if (sec.type === "category" && sec.category_slug) {
            try {
              const res = await fetchProducts({ categorySlug: sec.category_slug, limit });
              productsMap[sec.id] = res.products;
            } catch {
              productsMap[sec.id] = [];
            }
          } else {
            // Custom or fallback
            try {
              const res = await fetchProducts({ limit });
              productsMap[sec.id] = res.products;
            } catch {
              productsMap[sec.id] = [];
            }
          }
        })
      );

      setSectionProductsMap(productsMap);

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
  }, [activeSections]);

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
    <div className="relative animate-in fade-in duration-300 pb-16">
      <div className="space-y-8 sm:space-y-12">
        {/* ── 1. Hero 3D Stacked Offer Cards Carousel (With Dots Matrix till Marquee) ── */}
        <div className="relative">
          {/* ── Cursor-Phobic Dots Matrix: From top of viewport & menu bar strictly down to the marquee line ── */}
          <div className="absolute -top-28 sm:-top-32 md:-top-40 left-1/2 -translate-x-1/2 w-screen bottom-0 pointer-events-none overflow-hidden z-0">
            <CursorPhobicDots className="w-full h-full" />
          </div>

          <div className="relative z-10">
            {loading ? (
              <div className="h-102.5 sm:h-117.5 md:h-125 flex items-center justify-center">
                <div className="w-70 sm:w-82.5 md:w-87.5 h-95 sm:h-110 md:h-116.25 rounded-3xl bg-slate-100 dark:bg-slate-800/60 animate-pulse border border-slate-200/60 dark:border-slate-800 shadow-xl" />
              </div>
            ) : (
              <HeroStackedCarousel
                dbBanners={allBanners.filter((b) => b.placement === "home_hero")}
              />
            )}
          </div>
        </div>

        {/* ── Wholesale Continuous Live Offers & Trust Signals Marquee (Boundary Line) ── */}
        <WholesaleMarquee settings={settings} />

        {/* ── 2. boAt Lifestyle Category Section Rail (Circular Icon Tiles - Clean Background, No Dots) ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              {t("home.all_categories", "Browse by Category")}
            </h2>
            <Link
              to="/categories"
              className="text-xs font-bold text-brand-dark dark:text-brand-light hover:underline flex items-center space-x-1"
            >
              <span>{t("nav.categories", "All Categories")}</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </Link>
          </div>

          {loading ? (
            <CategoryChipsSkeleton count={8} />
          ) : categories.length > 0 ? (
            <div className="w-full overflow-x-auto scrollbar-none no-scrollbar py-2 px-0.5">
              <div className="flex items-start space-x-4 sm:space-x-6 md:space-x-8 min-w-max">
                {/* "All Products" Circle Tile */}
                <Link
                  to="/marketplace"
                  className="group flex flex-col items-center shrink-0 w-22 sm:w-26 md:w-28 text-center cursor-pointer select-none"
                >
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <img
                      src={getCategoryThemeImage("all", isDark)}
                      alt={t("footer.all_products", "All Products")}
                      className="w-full h-full object-contain drop-shadow-sm group-hover:drop-shadow-md transition-all duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <span className="mt-2 text-xs sm:text-[13px] md:text-sm font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-brand-dark dark:group-hover:text-brand-light leading-snug line-clamp-2 max-w-22 sm:max-w-26 md:max-w-28 transition-colors">
                    {t("footer.all_products", "All Products")}
                  </span>
                </Link>

                {/* boAt Circular Category Tiles (Clean Transparent, High Visibility) */}
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/marketplace?category=${cat.slug}`}
                    className="group flex flex-col items-center shrink-0 w-22 sm:w-26 md:w-28 text-center cursor-pointer select-none"
                  >
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                      <img
                        src={getCategoryThemeImage(cat, isDark)}
                        alt={cat.name}
                        className="w-full h-full object-contain drop-shadow-sm group-hover:drop-shadow-md transition-all duration-300"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <span className="mt-2 text-xs sm:text-[13px] md:text-sm font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-brand-dark dark:group-hover:text-brand-light leading-snug line-clamp-2 max-w-22 sm:max-w-26 md:max-w-28 transition-colors">
                      {translateCategoryName(cat.name, isHindi)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* ── 3. Dynamic Configured Homepage Divisions ── */}
        {activeSections.map((sec, secIdx) => {
          const prods = sectionProductsMap[sec.id] || [];

          return (
            <div key={sec.id} className="space-y-8 sm:space-y-12">
              <CategoryProductSlider
                title={isHindi && sec.title_hi ? sec.title_hi : sec.title}
                subtitle={isHindi && sec.subtitle_hi ? sec.subtitle_hi : sec.subtitle}
                badgeTag={isHindi && sec.badge_tag_hi ? sec.badge_tag_hi : sec.badge_tag}
                icon={getSectionIcon(sec.icon)}
                products={prods}
                seeMoreUrl={sec.see_more_url}
                themeColor={sec.theme_color}
                onAddToCart={onAddToCart}
                isLoading={loading}
              />

              {/* ── Brand Highlight Banner placed after division #2 ── */}
              {secIdx === 1 && brandBanner && (
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
                        className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl text-on-primary bg-primary hover:bg-primary-hover active:bg-primary-active font-semibold text-xs sm:text-sm shadow-xs active:scale-95 transition"
                      >
                        <span>
                          {brandBanner.cta_text ||
                            t("home.explore_collection", "Explore Collection")}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </section>
              )}
            </div>
          );
        })}

        {/* Brand Banner fallback if fewer than 2 sections enabled */}
        {activeSections.length < 2 && brandBanner && (
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
                className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl text-on-primary bg-primary hover:bg-primary-hover active:bg-primary-active font-semibold text-xs sm:text-sm shadow-xs active:scale-95 transition"
              >
                <span>
                  {brandBanner.cta_text ||
                    t("home.explore_collection", "Explore Collection")}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Recently Viewed Slider (Single Card View, Obsidian/Slate Theme) ── */}
      {recentlyViewed.length > 0 && (
        <CategoryProductSlider
          title={t("home.recently_viewed", "Recently Viewed")}
          subtitle={t(
            "home.recently_viewed_sub",
            "Quickly re-check wholesale items you previously inspected"
          )}
          badgeTag={isHindi ? "👁️ हाल ही में देखा" : "👁️ Recently Viewed"}
          icon={<Clock className="w-4 h-4 stroke-[2.2]" />}
          products={recentlyViewed}
          seeMoreUrl="/marketplace"
          themeColor="slate"
          onAddToCart={onAddToCart}
          isLoading={loading}
        />
      )}
      </div>
    </div>
  );
}
