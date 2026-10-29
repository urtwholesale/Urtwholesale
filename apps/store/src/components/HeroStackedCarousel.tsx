import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { m } from "../lib/motion";
import { triggerHaptic } from "../utils/haptics";
import { useTheme } from "../context/ThemeContext";
import type { Banner } from "@urbanrat/shared";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  ArrowRight,
  Zap,
  ShieldCheck,
} from "lucide-react";

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
    id: "offer-diamond-armor",
    badge: "URBANRAT PRO",
    title: "Urbanrat 9H Diamond Armor T...",
    subtitle: "Release: January 2026 · ₹199",
    rating: "4.8",
    image:
      "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&q=80&auto=format&fit=crop",
    ctaText: "Receive",
    ctaLink: "/categories",
  },
  {
    id: "offer-gan-65w",
    badge: "URBANRAT PRO",
    title: "Urbanrat 65W GaN Pro Super",
    subtitle: "Release: January 2026 · ₹340",
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&q=80&auto=format&fit=crop",
    ctaText: "Receive",
    ctaLink: "/urbanrat",
  },
  {
    id: "offer-cables",
    badge: "URBANRAT ORIGINAL",
    title: "Urbanrat 120W Super Cable",
    subtitle: "Release: January 2026 · ₹85",
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80&auto=format&fit=crop",
    ctaText: "Receive",
    ctaLink: "/urbanrat",
  },
  {
    id: "offer-tws-buds",
    badge: "URBANRAT PRO",
    title: "AirBass Pro Wireless TWS",
    subtitle: "Release: January 2026 · ₹290",
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&q=80&auto=format&fit=crop",
    ctaText: "Receive",
    ctaLink: "/marketplace",
  },
  {
    id: "offer-diwali-pack",
    badge: "PREMIERE PACK",
    title: "Dealers Wholesale Special",
    subtitle: "Release: January 2026 · ₹999",
    rating: "5.0",
    image:
      "https://images.unsplash.com/photo-1622445268069-450f68ff18cf?w=800&q=80&auto=format&fit=crop",
    ctaText: "Receive",
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
        const customRating =
          b.rating ||
          b.badges?.find((x) => x.icon === "Star" || x.label === "rating")?.text ||
          "4.9";

        list.push({
          id: b.id,
          badge: b.badge_text || "URBANRAT PRO",
          title: b.title,
          subtitle: b.subtitle || "Release: January 2026",
          rating: customRating,
          image: b.image_url!,
          ctaText: b.cta_text || "Receive",
          ctaLink: b.cta_link || b.link_url || "/urbanrat",
        });
      });

    // Append defaults to ensure stacked carousel has at least 5 rich cards
    DEFAULT_OFFER_CARDS.forEach((def) => {
      if (!list.some((existing) => existing.id === def.id)) {
        list.push(def);
      }
    });

    return list.slice(0, 5);
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

  // Autoplay with pause on hover/interaction
  useEffect(() => {
    if (isPaused || total <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, 5000);

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

  const activeCard = cards[activeIndex] || cards[0];

  return (
    <section
      aria-label="Wholesale Offers Showcase"
      className="relative w-full py-4 sm:py-6 select-none overflow-hidden lg:overflow-visible"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Ambient Radial Atmosphere Glow (Theme Aware) ── */}
      <div
        className="absolute top-1/2 left-1/2 lg:left-3/4 -translate-x-1/2 -translate-y-1/2 w-85 sm:w-130 lg:w-160 h-85 sm:h-105 rounded-full blur-3xl opacity-20 dark:opacity-35 pointer-events-none -z-10 transition-colors duration-500"
        style={{
          background: isDark
            ? "radial-gradient(circle, rgba(239, 68, 68, 0.18) 0%, rgba(15, 23, 42, 0.45) 65%, transparent 100%)"
            : "radial-gradient(circle, rgba(239, 68, 68, 0.14) 0%, rgba(90, 219, 229, 0.08) 65%, transparent 100%)",
        }}
      />

      {/* ── Split Layout Container: Left Headline + Right 3D Carousel on Desktop ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-12 w-full max-w-7xl mx-auto overflow-visible">
        {/* ── Left Column: Cinematic Headline & Premiere Gear Controls (Desktop View) ── */}
        <div className="hidden lg:flex flex-col justify-center flex-1 space-y-6 max-w-xl pl-2">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-black/90 backdrop-blur-md border border-slate-700/60 dark:border-white/10 text-[11px] font-bold text-white shadow-xs w-fit">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="tracking-wider uppercase text-slate-200">
              PREMIERES 2026 · URBANRAT CINEMATIC GEAR
            </span>
          </div>

          {/* Main Headline */}
          <div className="space-y-1">
            <h1 className="text-4xl xl:text-5xl 2xl:text-6xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-[1.05]">
              <div className="tracking-tight">MAJOR GEAR</div>
              <div className="text-red-500 dark:text-red-500 drop-shadow-[0_0_24px_rgba(239,68,68,0.55)]">
                OF PREMIERES
              </div>
              <div className="tracking-tight">2026</div>
            </h1>
          </div>

          {/* Subtitle / Paragraph */}
          <p className="text-sm xl:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg font-medium">
            Next-generation mobile & computer accessories engineered for supreme speed, diamond-grade protection, and 65W GaN ultra-fast charging.
          </p>

          {/* 3 Highlight Chips */}
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-2 text-xs font-bold">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 shadow-2xs">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>65W GaN Core</span>
            </div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
              <span>9H Sapphire Armor</span>
            </div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 shadow-2xs">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>4.9 Rated</span>
            </div>
          </div>

          {/* Controls & CTA Row */}
          <div className="flex items-center space-x-4 pt-2">
            <Link
              to={activeCard?.ctaLink || "/urbanrat"}
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl font-black text-xs sm:text-sm text-white bg-linear-to-r from-red-600 via-rose-600 to-orange-600 shadow-[0_0_24px_rgba(239,68,68,0.5)] hover:shadow-[0_0_32px_rgba(239,68,68,0.7)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              <span>Receive Premiere Gear</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </Link>

            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous slide"
              className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md flex items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.4]" />
            </button>

            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next slide"
              className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md flex items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.4]" />
            </button>

            <span className="font-mono text-sm font-extrabold text-slate-400 dark:text-slate-500 tabular-nums select-none">
              {String(activeIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* ── Right Column: 3D Stacked Carousel Cards ── */}
        <div className="w-full lg:w-120 xl:w-132.5 shrink-0 overflow-visible">
          <div className="relative w-full h-102.5 sm:h-117.5 md:h-125 lg:h-130 flex items-center justify-center overflow-visible">
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
                    x: isCenter ? "0%" : isLeft ? "-22%" : "22%",
                    scale: isCenter ? 1 : 0.88,
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
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-70 sm:w-82.5 md:w-87.5 lg:w-80 xl:w-86 h-95 sm:h-110 md:h-116.25 lg:h-115 xl:h-120 rounded-3xl overflow-hidden cursor-pointer transition-shadow duration-300 ${
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
                  <div
                    className={`absolute top-4 left-4 z-20 transition-opacity duration-300 ${
                      isCenter ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <span className="inline-flex items-center px-3 py-1 rounded-xl bg-black/60 dark:bg-black/75 backdrop-blur-md border border-white/15 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-white shadow-sm">
                      {card.badge}
                    </span>
                  </div>

                  {/* ── Floating Frosted Glass Bottom Pill Card (Only on front card) ── */}
                  <div
                    className={`absolute bottom-3.5 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 bg-[#0F172A]/92 dark:bg-[#070B12]/94 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-3 sm:p-3.5 shadow-2xl flex items-center justify-between gap-2.5 transition-opacity duration-300 ${
                      isCenter ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
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

                    {/* Right Action Button (Vibrant Glowing Blue Pill) */}
                    <Link
                      to={card.ctaLink}
                      onClick={(e) => {
                        // Only navigate if center card is clicked
                        if (!isCenter) {
                          e.preventDefault();
                          goToSlide(idx);
                        }
                      }}
                      className="shrink-0 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full font-black text-xs text-white bg-blue-600 shadow-[0_0_16px_rgba(37,99,235,0.6)] hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                    >
                      {card.ctaText}
                    </Link>
                  </div>
                </m.div>
              );
            })}

            {/* ── Mobile/Tablet Floating Navigation Chevrons ── */}
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous Offer"
              className="lg:hidden flex absolute left-3 top-1/2 -translate-y-1/2 z-35 w-9 h-9 rounded-full bg-white/95 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-md items-center justify-center text-slate-800 dark:text-white active:scale-95 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.4]" />
            </button>

            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next Offer"
              className="lg:hidden flex absolute right-3 top-1/2 -translate-y-1/2 z-35 w-9 h-9 rounded-full bg-white/95 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-md items-center justify-center text-slate-800 dark:text-white active:scale-95 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.4]" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Carousel Indicator Dots (Hidden on Desktop) ── */}
      <div className="flex lg:hidden items-center justify-center space-x-2 pt-3">
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

