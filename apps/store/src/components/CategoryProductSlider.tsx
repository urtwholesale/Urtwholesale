import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router";
import type { Product } from "@urbanrat/shared";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Plus,
  Check,
} from "lucide-react";
import { triggerHaptic } from "../utils/haptics";
import { recordRecentlyViewed } from "../services/recentViews";
import { m, AnimatePresence } from "../lib/motion";
import { ProductCard } from "./ProductCard";

export type SliderThemeColor = "amber" | "rose" | "cyan" | "violet" | "slate";

interface CategoryProductSliderProps {
  title: string;
  subtitle?: string;
  badgeTag: string;
  icon: React.ReactNode;
  products: Product[];
  seeMoreUrl?: string;
  themeColor?: SliderThemeColor;
  onAddToCart?: (product: Product, quantity?: number) => void;
  isLoading?: boolean;
}

const THEME_STYLES: Record<
  SliderThemeColor,
  {
    iconBadge: string;
    iconText: string;
    cardBorder: string;
    cardGlow: string;
    activeDot: string;
    accentBg: string;
  }
> = {
  amber: {
    iconBadge: "bg-amber-500/10 dark:bg-amber-400/15 border border-amber-500/20",
    iconText: "text-amber-600 dark:text-amber-400",
    cardBorder: "border-amber-500/20 dark:border-amber-500/30",
    cardGlow: "shadow-[0_8px_32px_rgba(245,158,11,0.08)] dark:shadow-[0_8px_32px_rgba(245,158,11,0.18)]",
    activeDot: "bg-amber-500",
    accentBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  },
  rose: {
    iconBadge: "bg-rose-500/10 dark:bg-rose-400/15 border border-rose-500/20",
    iconText: "text-rose-600 dark:text-rose-400",
    cardBorder: "border-rose-500/20 dark:border-rose-500/30",
    cardGlow: "shadow-[0_8px_32px_rgba(244,63,94,0.08)] dark:shadow-[0_8px_32px_rgba(244,63,94,0.18)]",
    activeDot: "bg-rose-500",
    accentBg: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
  },
  cyan: {
    iconBadge: "bg-cyan-500/10 dark:bg-cyan-400/15 border border-cyan-500/20",
    iconText: "text-cyan-600 dark:text-cyan-400",
    cardBorder: "border-cyan-500/20 dark:border-cyan-500/30",
    cardGlow: "shadow-[0_8px_32px_rgba(6,182,212,0.08)] dark:shadow-[0_8px_32px_rgba(6,182,212,0.18)]",
    activeDot: "bg-cyan-500",
    accentBg: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300",
  },
  violet: {
    iconBadge: "bg-violet-500/10 dark:bg-violet-400/15 border border-violet-500/20",
    iconText: "text-violet-600 dark:text-violet-400",
    cardBorder: "border-violet-500/20 dark:border-violet-500/30",
    cardGlow: "shadow-[0_8px_32px_rgba(139,92,246,0.08)] dark:shadow-[0_8px_32px_rgba(139,92,246,0.18)]",
    activeDot: "bg-violet-500",
    accentBg: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
  },
  slate: {
    iconBadge: "bg-slate-500/10 dark:bg-orange-500/15 border border-slate-300 dark:border-orange-500/30",
    iconText: "text-slate-700 dark:text-orange-400",
    cardBorder: "border-slate-200 dark:border-slate-800",
    cardGlow: "shadow-[0_8px_32px_rgba(15,23,42,0.06)] dark:shadow-[0_8px_32px_rgba(249,115,22,0.15)]",
    activeDot: "bg-orange-500",
    accentBg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
  },
};

/**
 * Dynamically determines how many products to show per row based on viewport width:
 * - Mobile (< 768px): 1 card slider
 * - Tablet (768px - 1023px): 3 in a row
 * - Laptop (1024px - 1535px): 4 in a row (spacious, non-cramped cards)
 * - Desktop (1536px+): 5 in a row
 */
function useResponsiveItemsPerPage(): number {
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    if (typeof window === "undefined") return 4;
    const width = window.innerWidth;
    if (width >= 1536) return 5;
    if (width >= 1024) return 4;
    if (width >= 768) return 3;
    return 1;
  });

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      let newCount = 4;
      if (width >= 1536) {
        newCount = 5;
      } else if (width >= 1024) {
        newCount = 4;
      } else if (width >= 768) {
        newCount = 3;
      } else {
        newCount = 1;
      }
      setItemsPerPage((prev) => (prev !== newCount ? newCount : prev));
    }

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return itemsPerPage;
}

export function CategoryProductSlider({
  title,
  subtitle,
  badgeTag,
  icon,
  products,
  seeMoreUrl,
  themeColor = "cyan",
  onAddToCart,
  isLoading = false,
}: CategoryProductSliderProps) {
  // Mobile single card slide index
  const [currentIndex, setCurrentIndex] = useState(0);
  // Responsive products per row: 3 for tablet, 4 for laptop, 5 for desktop
  const itemsPerPage = useResponsiveItemsPerPage();
  const [desktopPage, setDesktopPage] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isAdded, setIsAdded] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const currentTheme = THEME_STYLES[themeColor];
  const count = products.length;
  const desktopTotalPages = Math.ceil(count / itemsPerPage) || 1;

  // Handle safe index wrap-around if products length updates
  useEffect(() => {
    if (currentIndex >= count && count > 0) {
      setCurrentIndex(0);
    }
    if (desktopPage >= desktopTotalPages && desktopTotalPages > 0) {
      setDesktopPage(0);
    }
  }, [count, currentIndex, desktopPage, desktopTotalPages]);

  const handleNext = useCallback(() => {
    if (count <= 1) return;
    triggerHaptic("selection");
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % count);
    if (desktopTotalPages > 1) {
      setDesktopPage((prev) => (prev + 1) % desktopTotalPages);
    }
  }, [count, desktopTotalPages]);

  const handlePrev = useCallback(() => {
    if (count <= 1) return;
    triggerHaptic("selection");
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + count) % count);
    if (desktopTotalPages > 1) {
      setDesktopPage((prev) => (prev - 1 + desktopTotalPages) % desktopTotalPages);
    }
  }, [count, desktopTotalPages]);

  // Touch Swipe Gesture Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0]?.clientX ?? null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45;

    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (isLoading) {
    return (
      <div className="space-y-3.5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-5 w-32 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-6 w-20 rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
        {/* Mobile Skeleton */}
        <div className="md:hidden w-full max-w-97.5 mx-auto h-95 rounded-3xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800" />
        {/* Desktop Skeleton: Responsive Columns (3 for tablet, 4 for laptop, 5 for desktop) */}
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-72 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 ${
                i >= 3 ? "hidden lg:block" : ""
              } ${i >= 4 ? "hidden 2xl:block" : ""}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (count === 0) return null;

  const currentProduct = products[currentIndex];
  if (!currentProduct) return null;

  const prevIndex = (currentIndex - 1 + count) % count;
  const nextIndex = (currentIndex + 1) % count;
  const prevProduct = products[prevIndex];
  const nextProduct = products[nextIndex];

  const tiers = currentProduct.price_tiers || [];
  const hasBulkDeals = tiers.length > 1;
  const bestPrice = hasBulkDeals
    ? Math.min(...tiers.map((t) => t.unit_price))
    : currentProduct.price;

  const discountPercent = currentProduct.mrp
    ? Math.round(((currentProduct.mrp - bestPrice) / currentProduct.mrp) * 100)
    : 0;

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!currentProduct) return;

    triggerHaptic("success");
    setIsAdded(true);
    const minQty = Math.max(10, currentProduct.min_order_qty || tiers[0]?.min_qty || 10);
    onAddToCart?.(currentProduct, minQty);

    setTimeout(() => {
      setIsAdded(false);
    }, 1800);
  }

  // Slice desktop products based on responsive columns (3 for tablet, 4 for laptop, 5 for desktop)
  const desktopProducts = products.slice(
    desktopPage * itemsPerPage,
    desktopPage * itemsPerPage + itemsPerPage
  );

  return (
    <section className="space-y-3.5">
      {/* ── Section Header: Title, "See more" Button & Slider Controls ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className={`p-1.5 rounded-xl ${currentTheme.iconBadge} ${currentTheme.iconText} shrink-0`}>
            {icon}
          </div>

          <div className="flex items-center space-x-2 min-w-0 flex-wrap gap-y-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
              {title}
            </h2>

            {/* "See more" button positioned directly adjacent to the category title */}
            {seeMoreUrl && (
              <Link
                to={seeMoreUrl}
                className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black text-white hover:opacity-95 active:scale-95 transition cursor-pointer shadow-xs shrink-0"
                style={{
                  background: "var(--brand-gradient)",
                  boxShadow: "var(--brand-shadow)",
                }}
              >
                <span>See more</span>
                <ArrowRight className="w-3 h-3 stroke-[2.5]" />
              </Link>
            )}
          </div>
        </div>

        {/* Counter & Prev / Next Arrows */}
        {count > 1 && (
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Mobile counter */}
            <span className="md:hidden text-[11px] font-extrabold text-slate-400 dark:text-slate-500 tabular-nums mr-1">
              {currentIndex + 1} / {count}
            </span>

            {/* Desktop counter */}
            <span className="hidden md:inline text-xs font-extrabold text-slate-400 dark:text-slate-500 tabular-nums mr-1">
              {desktopTotalPages > 1
                ? `${desktopPage * itemsPerPage + 1}–${Math.min(
                    (desktopPage + 1) * itemsPerPage,
                    count
                  )} of ${count}`
                : `Showing ${Math.min(count, itemsPerPage)} items`}
            </span>

            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous products"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-brand-dark dark:hover:text-orange-400 active:scale-90 transition cursor-pointer shadow-2xs ${
                desktopTotalPages <= 1 ? "md:hidden" : ""
              }`}
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next products"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-brand-dark dark:hover:text-orange-400 active:scale-90 transition cursor-pointer shadow-2xs ${
                desktopTotalPages <= 1 ? "md:hidden" : ""
              }`}
            >
              <ChevronRight className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>
        )}
      </div>

      {subtitle && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1.5">
          {subtitle}
        </p>
      )}

      {/* ── 1. Mobile View (< md): Single Card Carousel with Side Indicators & Peeks ── */}
      <div className="md:hidden relative w-full max-w-105 mx-auto select-none py-1">
        {/* Left Side Floating Indicator Button */}
        {count > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous product"
            className="absolute -left-2 top-[36%] -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border border-slate-200/90 dark:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.2)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)] flex items-center justify-center text-slate-800 dark:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer group"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5] text-slate-700 dark:text-slate-200 group-hover:text-orange-500 dark:group-hover:text-orange-400" />
          </button>
        )}

        {/* Right Side Floating Indicator Button */}
        {count > 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next product"
            className="absolute -right-2 top-[36%] -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border border-slate-200/90 dark:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.2)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)] flex items-center justify-center text-slate-800 dark:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer group"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5] text-slate-700 dark:text-slate-200 group-hover:text-orange-500 dark:group-hover:text-orange-400" />
          </button>
        )}

        {/* Peeking Previous Product Hint on Left Edge */}
        {count > 1 && prevProduct && (
          <div
            onClick={handlePrev}
            className="absolute -left-3 top-5 bottom-5 w-5 rounded-2xl overflow-hidden opacity-30 dark:opacity-20 scale-95 border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-900 pointer-events-auto cursor-pointer hover:opacity-50 transition-opacity z-10"
          >
            <img
              src={prevProduct.images[0] || "/hero-accessories.jpg"}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-r from-transparent to-black/70" />
          </div>
        )}

        {/* Peeking Next Product Hint on Right Edge */}
        {count > 1 && nextProduct && (
          <div
            onClick={handleNext}
            className="absolute -right-3 top-5 bottom-5 w-5 rounded-2xl overflow-hidden opacity-30 dark:opacity-20 scale-95 border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-900 pointer-events-auto cursor-pointer hover:opacity-50 transition-opacity z-10"
          >
            <img
              src={nextProduct.images[0] || "/hero-accessories.jpg"}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-l from-transparent to-black/70" />
          </div>
        )}

        {/* Center Active Single Card Viewport on Mobile */}
        <div
          className="relative w-full max-w-97.5 mx-auto overflow-hidden px-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={currentProduct.id}
              initial={{ opacity: 0, x: direction * 50, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -direction * 50, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={`relative bg-white dark:bg-[#0D131F] rounded-3xl border ${currentTheme.cardBorder} ${currentTheme.cardGlow} transition-colors flex flex-col justify-between overflow-hidden`}
            >
              {/* Top Image Spotlight - Container-sized with zero margins */}
              <Link
                to={`/product/${currentProduct.slug}`}
                onClick={() => recordRecentlyViewed(currentProduct)}
                className="block relative aspect-square sm:aspect-4/3 w-full overflow-hidden bg-slate-100 dark:bg-slate-900 group"
              >
                <img
                  src={
                    currentProduct.images[0] ||
                    "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600"
                  }
                  alt={currentProduct.name}
                  loading="eager"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />

                {/* Gradient Vignette at Top & Bottom */}
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                {/* Custom Category Theme Badge (Top Left) */}
                <div className="absolute top-2.5 left-2.5 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/75 backdrop-blur-md text-white border border-white/20 shadow-xs">
                  <span>{badgeTag}</span>
                </div>

                {/* Discount Badge (Top Right) */}
                {discountPercent > 0 && (
                  <div
                    className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[10px] font-black text-white shadow-xs tracking-wider"
                    style={{
                      background: "linear-gradient(135deg, #FF6B6B 0%, #E83A59 100%)",
                    }}
                  >
                    {discountPercent}% OFF
                  </div>
                )}
              </Link>

              {/* Product Details */}
              <div className="p-3.5 space-y-2.5">
                <Link
                  to={`/product/${currentProduct.slug}`}
                  onClick={() => recordRecentlyViewed(currentProduct)}
                  className="block hover:text-brand-dark dark:hover:text-orange-400 transition-colors"
                >
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2">
                    {currentProduct.name}
                  </h3>
                </Link>

                {/* Price & Free Shipping Row */}
                <div className="flex items-baseline justify-between flex-wrap gap-1">
                  <div className="flex items-baseline space-x-1.5">
                    {hasBulkDeals && (
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                        From
                      </span>
                    )}
                    <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      ₹{bestPrice.toLocaleString("en-IN")}
                    </span>
                    {currentProduct.mrp && currentProduct.mrp > bestPrice && (
                      <span className="text-xs text-slate-400 line-through">
                        ₹{currentProduct.mrp.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Free Shipping
                  </span>
                </div>

                {/* Bulk Tier Quick-Preview (Wholesale Highlight) */}
                {tiers.length > 0 && (
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      Wholesale Tiers:
                    </span>
                    <div className="flex items-center space-x-1.5 font-bold text-slate-700 dark:text-slate-300">
                      {tiers.slice(0, 2).map((tier, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-[10px] border border-slate-200 dark:border-slate-700 shadow-2xs"
                        >
                          {tier.min_qty}+ pcs: ₹{tier.unit_price}
                        </span>
                      ))}
                      {tiers.length > 2 && (
                        <span className="text-[10px] text-brand-dark dark:text-orange-400">
                          +{tiers.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                  <Link
                    to={`/product/${currentProduct.slug}`}
                    onClick={() => recordRecentlyViewed(currentProduct)}
                    className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-brand-dark dark:hover:text-orange-400 flex items-center space-x-1 transition"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  {/* Morphing Add to Cart Button */}
                  <button
                    type="button"
                    onClick={handleAdd}
                    aria-label={
                      isAdded
                        ? `Added ${currentProduct.name} to cart`
                        : `Add ${currentProduct.name} to cart`
                    }
                    className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-black text-white cursor-pointer transition-all duration-300 shadow-sm active:scale-95 ${
                      isAdded
                        ? "bg-emerald-600 shadow-[0_4px_16px_rgba(16,185,129,0.5)] ring-2 ring-emerald-300"
                        : "hover:shadow-md"
                    }`}
                    style={
                      isAdded
                        ? undefined
                        : {
                            background: "var(--brand-gradient)",
                            boxShadow: "var(--brand-shadow)",
                          }
                    }
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-4 h-4 stroke-3" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 stroke-2" />
                        <span>Add to Cart</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── 2. Desktop View (>= md): Responsive Columns Row (3 for tablet, 4 for laptop, 5 for desktop) ── */}
      <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
        {desktopProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </section>
  );
}
