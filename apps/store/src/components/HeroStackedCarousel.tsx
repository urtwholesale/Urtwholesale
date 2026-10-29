import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { m } from "../lib/motion";
import { triggerHaptic } from "../utils/haptics";
import { useTheme } from "../context/ThemeContext";
import type { Banner } from "@urbanrat/shared";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

export interface OfferCard {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  rating: string;
  image: string;
  ctaText: string;
  ctaLink: string;
  accentColor?: string;
}

interface HeroStackedCarouselProps {
  dbBanners?: Banner[];
}

// Curated high-converting wholesale offer cards matching the Urbanrat aesthetic
const DEFAULT_OFFER_CARDS: OfferCard[] = [
  {
    id: "offer-gan-65w",
    badge: "URBANRAT PRO",
    title: "Urbanrat 65W GaN Pro",
    subtitle: "Wholesale Deal: ₹340 / pc • Min 5 pcs",
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&q=80&auto=format&fit=crop",
    ctaText: "Receive",
    ctaLink: "/urbanrat",
  },
  {
    id: "offer-diwali-pack",
    badge: "FESTIVE MEGA DEAL",
    title: "Dealers Wholesale Special",
    subtitle: "Engineered 9H Glass & 65W Chargers Pack",
    rating: "5.0",
    image:
      "https://images.unsplash.com/photo-1622445268069-450f68ff18cf?w=800&q=80&auto=format&fit=crop",
    ctaText: "Claim Deal",
    ctaLink: "/marketplace",
  },
  {
    id: "offer-tempered-glass",
    badge: "HOT SELLER",
    title: "iPhone 17 AR+AF Lens & Glass",
    subtitle: "From ₹35 / pc • 95%+ Transparency",
    rating: "4.8",
    image:
      "https://images.unsplash.com/photo-1609081219090-a6d81d3085bf?w=800&q=80&auto=format&fit=crop",
    ctaText: "Order Bulk",
    ctaLink: "/categories",
  },
  {
    id: "offer-cables",
    badge: "URBANRAT ORIGINAL",
    title: "Urbanrat 120W Super Cable",
    subtitle: "Zinc-Alloy Joints • ₹85 / pc Box Pack",
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80&auto=format&fit=crop",
    ctaText: "Get Stock",
    ctaLink: "/urbanrat",
  },
  {
    id: "offer-tws-buds",
    badge: "HIGH TURNOVER",
    title: "AirBass Pro Wireless TWS",
    subtitle: "40h Playtime • ₹290 / pc Wholesale",
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&q=80&auto=format&fit=crop",
    ctaText: "View Deals",
    ctaLink: "/marketplace",
  },
];

export function HeroStackedCarousel({ dbBanners = [] }: HeroStackedCarouselProps) {
  // Merge live database banners with curated offer cards
  const cards: OfferCard[] = (() => {
    const list: OfferCard[] = [];

    // Map database banners into OfferCard format
    dbBanners
      .filter((b) => b.is_active && b.image_url)
      .forEach((b) => {
        // Support custom rating from column, badges jsonb, or default
        const customRating =
          b.rating ||
          b.badges?.find((x) => x.icon === "Star" || x.label === "rating")?.text ||
          "4.9";

        list.push({
          id: b.id,
          badge: b.badge_text || "FEATURED DEAL",
          title: b.title,
          subtitle: b.subtitle || "Premium wholesale deal at bulk rates",
          rating: customRating,
          image: b.image_url!,
          ctaText: b.cta_text || "Explore",
          ctaLink: b.cta_link || b.link_url || "/marketplace",
        });
      });

    // Append defaults to ensure stacked carousel has at least 5 rich cards
    DEFAULT_OFFER_CARDS.forEach((def) => {
      if (!list.some((existing) => existing.id === def.id)) {
        list.push(def);
      }
    });

    return list.slice(0, 7);
  })();

  const { isDark } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const total = cards.length;

  const nextSlide = useCallback(() => {
    triggerHaptic("selection");
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    triggerHaptic("selection");
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const goToSlide = useCallback((idx: number) => {
    triggerHaptic("selection");
    setActiveIndex(idx);
  }, []);

  // Autoplay with pause on hover/interaction and visibilitychange
  useEffect(() => {
    if (isPaused || total <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, 4500);

    return () => clearInterval(interval);
  }, [isPaused, total]);

  // Touch drag tracking for mobile swipe gesture
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    setIsPaused(true);
    if (e.targetTouches[0]) {
      touchStartX.current = e.targetTouches[0].clientX;
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.targetTouches[0]) {
      touchEndX.current = e.targetTouches[0].clientX;
    }
  }

  function handleTouchEnd() {
    setIsPaused(false);
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 45;
    const isRightSwipe = distance < -45;

    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  }

  return (
    <section
      aria-label="Wholesale Offers Showcase"
      className="relative w-full py-2 sm:py-4 select-none overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Ambient Radial Atmosphere Glow (Theme Aware) ── */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-85 sm:w-130 h-85 sm:h-105 rounded-full blur-3xl opacity-20 dark:opacity-35 pointer-events-none -z-10 transition-colors duration-500"
        style={{
          background: isDark
            ? "radial-gradient(circle, rgba(249, 115, 22, 0.22) 0%, rgba(15, 23, 42, 0.4) 65%, transparent 100%)"
            : "radial-gradient(circle, rgba(90, 219, 229, 0.22) 0%, rgba(10, 130, 168, 0.08) 65%, transparent 100%)",
        }}
      />

      {/* ── 3D Stacked Carousel Viewport ── */}
      <div className="relative w-full h-102.5 sm:h-117.5 md:h-125 flex items-center justify-center">
        {cards.map((card, idx) => {
          // Calculate relative circular offset: -1 = left, 0 = center, 1 = right, others = hidden
          let offset = idx - activeIndex;
          if (offset < -Math.floor(total / 2)) offset += total;
          if (offset > Math.floor(total / 2)) offset -= total;

          const isCenter = offset === 0;
          const isLeft = offset === -1;
          const isRight = offset === 1;
          const isVisible = isCenter || isLeft || isRight;

          if (!isVisible) return null;

          return (
            <m.div
              key={card.id}
              layout
              initial={false}
              animate={{
                x: isCenter ? "0%" : isLeft ? "-54%" : "54%",
                scale: isCenter ? 1 : 0.85,
                rotate: isCenter ? 0 : isLeft ? -2.5 : 2.5,
                zIndex: isCenter ? 30 : 15,
                opacity: isCenter ? 1 : isDark ? 0.45 : 0.65,
                filter: isCenter
                  ? "brightness(1)"
                  : isDark
                  ? "brightness(0.65) contrast(1.05)"
                  : "brightness(0.88) contrast(0.95)",
              }}
              transition={{
                type: "spring",
                stiffness: 220,
                damping: 26,
                mass: 0.9,
              }}
              onClick={() => {
                if (isLeft) prevSlide();
                if (isRight) nextSlide();
              }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-70 sm:w-82.5 md:w-87.5 h-95 sm:h-110 md:h-116.25 rounded-3xl overflow-hidden cursor-pointer transition-shadow duration-300 ${
                isCenter
                  ? "shadow-[0_20px_45px_rgba(15,23,42,0.22)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.7)] ring-1 ring-slate-900/10 dark:ring-white/15"
                  : "shadow-md hover:opacity-80 transition-opacity"
              }`}
            >
              {/* Card Background Image */}
              <img
                src={card.image}
                alt={card.title}
                className="w-full h-full object-cover rounded-3xl"
                loading={isCenter ? "eager" : "lazy"}
                decoding="async"
              />

              {/* Gradient Vignette Overlay for High Legibility */}
              <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/35 to-black/15 pointer-events-none" />

              {/* ── Top Pill Badge (e.g. URBANRAT PRO) ── */}
              <div className="absolute top-4 left-4 z-20">
                <span className="inline-flex items-center px-3 py-1 rounded-xl bg-black/60 dark:bg-black/75 backdrop-blur-md border border-white/15 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-white shadow-sm">
                  {card.badge}
                </span>
              </div>

              {/* ── Floating Frosted Glass Bottom Pill Card ── */}
              <div className="absolute bottom-3.5 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 bg-[#0F172A]/90 dark:bg-[#070B12]/92 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-3 sm:p-3.5 shadow-2xl flex items-center justify-between gap-2.5">
                {/* Left Metadata: Title, Star Rating, Subtitle */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5">
                    <h3 className="font-black text-xs sm:text-sm text-white truncate tracking-tight">
                      {card.title}
                    </h3>
                    <div className="flex items-center space-x-0.5 text-amber-400 font-black text-[11px] shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{card.rating}</span>
                    </div>
                  </div>

                  <p className="text-[10px] sm:text-[11px] font-medium text-slate-300 dark:text-slate-400 truncate mt-0.5">
                    {card.subtitle}
                  </p>
                </div>

                {/* Right Action Button (e.g. Receive / Claim Deal) */}
                <Link
                  to={card.ctaLink}
                  onClick={(e) => {
                    // Only navigate if center card is clicked
                    if (!isCenter) {
                      e.preventDefault();
                      goToSlide(idx);
                    }
                  }}
                  className="shrink-0 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-black text-xs text-white shadow-md active:scale-95 transition-transform flex items-center justify-center cursor-pointer"
                  style={{
                    background: "var(--brand-gradient)",
                    boxShadow: "var(--brand-shadow)",
                  }}
                >
                  {card.ctaText}
                </Link>
              </div>
            </m.div>
          );
        })}

        {/* ── Desktop & Tablet Navigation Chevrons ── */}
        <button
          type="button"
          onClick={prevSlide}
          aria-label="Previous Offer"
          className="hidden sm:flex absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-35 w-11 h-11 rounded-full bg-white/95 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-md hover:shadow-lg items-center justify-center text-slate-800 dark:text-white hover:scale-105 active:scale-95 transition cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
        </button>

        <button
          type="button"
          onClick={nextSlide}
          aria-label="Next Offer"
          className="hidden sm:flex absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-35 w-11 h-11 rounded-full bg-white/95 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-md hover:shadow-lg items-center justify-center text-slate-800 dark:text-white hover:scale-105 active:scale-95 transition cursor-pointer"
        >
          <ChevronRight className="w-5 h-5 stroke-[2.4]" />
        </button>
      </div>

      {/* ── Carousel Indicator Dots with Elongated Active Pill ── */}
      <div className="flex items-center justify-center space-x-2 pt-3">
        {cards.map((card, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => goToSlide(idx)}
              aria-label={`Go to offer slide ${idx + 1}`}
              className={`transition-all duration-300 rounded-full cursor-pointer ${
                isActive
                  ? "w-7 h-2 shadow-sm"
                  : "w-2 h-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
              }`}
              style={
                isActive
                  ? {
                      background: "var(--brand-gradient)",
                      boxShadow: "var(--brand-shadow)",
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}

