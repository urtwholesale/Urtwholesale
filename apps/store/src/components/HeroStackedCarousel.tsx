import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { m } from "../lib/motion";
import { triggerHaptic } from "../utils/haptics";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { CursorPhobicElement, CursorPhobicWords } from "./CursorPhobicElement";
import type { Banner } from "@urbanrat/shared";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  ArrowRight,
  Zap,
  ShieldCheck,
  Flame,
  Sparkles,
} from "lucide-react";

export interface OfferCard {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  rating?: string;
  image: string;
  darkImage?: string;
  lightImage?: string;
  ctaText: string;
  ctaLink: string;
  accentColor?: string;
  tagline?: string;
  headlineFirst?: string;
  headlineHighlight?: string;
  headlineSecond?: string;
  description?: string;
  highlights?: Array<{ icon: "Zap" | "ShieldCheck" | "Star" | "Flame" | "Sparkles"; text: string }>;
  badge_hi?: string;
  title_hi?: string;
  subtitle_hi?: string;
  tagline_hi?: string;
  headlineFirst_hi?: string;
  headlineHighlight_hi?: string;
  headlineSecond_hi?: string;
  description_hi?: string;
  highlights_hi?: Array<{ icon: "Zap" | "ShieldCheck" | "Star" | "Flame" | "Sparkles"; text: string }>;
  ctaText_hi?: string;
}

interface HeroStackedCarouselProps {
  dbBanners?: Banner[];
}

// Curated high-converting wholesale offer cards matching the 3D Studio Premiere aesthetic
const DEFAULT_OFFER_CARDS: OfferCard[] = [
  {
    id: "offer-gan-65w",
    badge: "URBANRAT PRO",
    title: "Urbanrat 65W GaN Pro Fast Charger",
    subtitle: "Release: January 2026 · ₹340 / unit",
    rating: "4.9",
    image: "/hero/dark/offer-gan-65w.jpg",
    darkImage: "/hero/dark/offer-gan-65w.jpg",
    lightImage: "/hero/light/offer-gan-65w.jpg",
    ctaText: "Receive",
    ctaLink: "/marketplace?category=chargers",
    tagline: "PREMIERES 2026 · ULTRA-FAST GAN CHARGING",
    headlineFirst: "65W GAN TURBO",
    headlineHighlight: "POWER ADAPTER",
    headlineSecond: "2026",
    description:
      "Next-generation GaN III Turbo architecture delivering dual-port 65W ultra-fast charging with intelligent thermal regulation and whisper-cool operation.",
    highlights: [
      { icon: "Zap", text: "65W GaN Core" },
      { icon: "Flame", text: "Dual USB-C PD" },
      { icon: "Star", text: "4.9 Rated" },
    ],
    badge_hi: "URBANRAT प्रो",
    title_hi: "Urbanrat 65W GaN प्रो फ़ास्ट चार्जर",
    subtitle_hi: "रिलीज़: जनवरी 2026 · ₹340 / पीस",
    tagline_hi: "प्रीमियर 2026 · अल्ट्रा-फ़ास्ट GAN चार्जिंग",
    headlineFirst_hi: "65W GAN टर्बो",
    headlineHighlight_hi: "पावर एडेप्टर",
    headlineSecond_hi: "2026",
    description_hi:
      "नेक्स्ट-जेनरेशन GaN III टर्बो तकनीक, डुअल-पोर्ट 65W अल्ट्रा-फ़ास्ट चार्जिंग, स्मार्ट थर्मल प्रोटेक्शन और शांत कूल ऑपरेशन के साथ।",
    highlights_hi: [
      { icon: "Zap", text: "65W GaN कोर" },
      { icon: "Flame", text: "डुअल USB-C PD" },
      { icon: "Star", text: "4.9 रेटिंग" },
    ],
    ctaText_hi: "स्टॉक प्राप्त करें",
  },
  {
    id: "offer-diamond-armor",
    badge: "URBANRAT PRO",
    title: "Urbanrat 9H Diamond Armor Screen",
    subtitle: "Release: January 2026 · ₹35 / unit",
    rating: "4.8",
    image: "/hero/dark/offer-diamond-armor.jpg",
    darkImage: "/hero/dark/offer-diamond-armor.jpg",
    lightImage: "/hero/light/offer-diamond-armor.jpg",
    ctaText: "Receive",
    ctaLink: "/marketplace?category=tempered-glass",
    tagline: "PREMIERES 2026 · DISPLAY DEFENSE SYSTEM",
    headlineFirst: "9H SAPPHIRE",
    headlineHighlight: "GLASS ARMOR",
    headlineSecond: "2026",
    description:
      "Engineered from high-alumina tempered glass with 9H diamond hardness, electroplated oleophobic oil resistance, and seamless 2.5D curved arc edges.",
    highlights: [
      { icon: "ShieldCheck", text: "9H Sapphire Armor" },
      { icon: "Sparkles", text: "2.5D Curved Edge" },
      { icon: "Star", text: "4.8 Rated" },
    ],
    badge_hi: "URBANRAT प्रो",
    title_hi: "Urbanrat 9H डायमंड आर्मर स्क्रीन",
    subtitle_hi: "रिलीज़: जनवरी 2026 · ₹35 / पीस",
    tagline_hi: "प्रीमियर 2026 · डिस्प्ले सुरक्षा सिस्टम",
    headlineFirst_hi: "9H सफायर",
    headlineHighlight_hi: "ग्लास आर्मर",
    headlineSecond_hi: "2026",
    description_hi:
      "हाई-एल्युमिना टेम्पर्ड ग्लास, 9H डायमंड हार्डनेस, इलेक्ट्रोप्लेटेड ओलियोफोबिक कोटिंग और सीमलेस 2.5D कर्व्ड किनारों से निर्मित।",
    highlights_hi: [
      { icon: "ShieldCheck", text: "9H सफायर आर्मर" },
      { icon: "Sparkles", text: "2.5D कर्व्ड किनारे" },
      { icon: "Star", text: "4.8 रेटिंग" },
    ],
    ctaText_hi: "स्टॉक प्राप्त करें",
  },
  {
    id: "offer-tws-buds",
    badge: "URBANRAT PRO",
    title: "AirBass Pro Wireless ANC TWS",
    subtitle: "Release: January 2026 · ₹290 / unit",
    rating: "4.9",
    image: "/hero/dark/offer-tws-buds.jpg",
    darkImage: "/hero/dark/offer-tws-buds.jpg",
    lightImage: "/hero/light/offer-tws-buds.jpg",
    ctaText: "Receive",
    ctaLink: "/marketplace?category=buds-tws",
    tagline: "PREMIERES 2026 · ACOUSTIC MASTERY",
    headlineFirst: "AIRBASS PRO",
    headlineHighlight: "ANC WIRELESS",
    headlineSecond: "2026",
    description:
      "Acoustic chamber with 13mm titanium composite drivers delivering deep sub-bass resonance, active environmental noise cancellation, and 38-hour battery playback.",
    highlights: [
      { icon: "Zap", text: "13mm Ti Drivers" },
      { icon: "Sparkles", text: "38H Playtime" },
      { icon: "Star", text: "4.9 Rated" },
    ],
    badge_hi: "URBANRAT प्रो",
    title_hi: "AirBass प्रो वायरलेस ANC TWS",
    subtitle_hi: "रिलीज़: जनवरी 2026 · ₹290 / पीस",
    tagline_hi: "प्रीमियर 2026 · शानदार साउंड क्वालिटी",
    headlineFirst_hi: "AIRBASS प्रो",
    headlineHighlight_hi: "ANC वायरलेस",
    headlineSecond_hi: "2026",
    description_hi:
      "13mm टाइटेनियम कंपोजिट ड्राइवर्स, डीप सब-बास साउंड, एक्टिव नॉइज़ कैंसलेशन (ANC) और 38 घंटे की लंबी बैटरी प्लेबैक।",
    highlights_hi: [
      { icon: "Zap", text: "13mm Ti ड्राइवर्स" },
      { icon: "Sparkles", text: "38 घंटे प्लेबैक" },
      { icon: "Star", text: "4.9 रेटिंग" },
    ],
    ctaText_hi: "स्टॉक प्राप्त करें",
  },
  {
    id: "offer-cables",
    badge: "URBANRAT ORIGINAL",
    title: "Urbanrat 120W Titanium Super Cable",
    subtitle: "Release: January 2026 · ₹85 / unit",
    rating: "4.9",
    image: "/hero/dark/offer-cables.jpg",
    darkImage: "/hero/dark/offer-cables.jpg",
    lightImage: "/hero/light/offer-cables.jpg",
    ctaText: "Receive",
    ctaLink: "/marketplace?category=cables",
    tagline: "PREMIERES 2026 · INDESTRUCTIBLE SPEED",
    headlineFirst: "120W TITANIUM",
    headlineHighlight: "SUPER CORD",
    headlineSecond: "2026",
    description:
      "Kevlar-reinforced dual-braided ballistic nylon cable with aerospace titanium-finish connector shells and E-Marker smart power management chip.",
    highlights: [
      { icon: "Zap", text: "120W PD Delivery" },
      { icon: "ShieldCheck", text: "Kevlar Reinforced" },
      { icon: "Star", text: "4.9 Rated" },
    ],
    badge_hi: "URBANRAT ओरिजिनल",
    title_hi: "Urbanrat 120W टाइटेनियम सुपर केबल",
    subtitle_hi: "रिलीज़: जनवरी 2026 · ₹85 / पीस",
    tagline_hi: "प्रीमियर 2026 · अटूट मजबूती एवं सुपर स्पीड",
    headlineFirst_hi: "120W टाइटेनियम",
    headlineHighlight_hi: "सुपर कॉर्ड",
    headlineSecond_hi: "2026",
    description_hi:
      "केवलर-मजबूत डुअल-ब्रेडेड नायलॉन केबल, एयरोस्पेस टाइटेनियम मेटल शेल्स और E-Marker स्मार्ट पावर मैनेजमेंट चिप के साथ।",
    highlights_hi: [
      { icon: "Zap", text: "120W PD डिलीवरी" },
      { icon: "ShieldCheck", text: "केवलर रिइन्फ़ोर्स्ड" },
      { icon: "Star", text: "4.9 रेटिंग" },
    ],
    ctaText_hi: "स्टॉक प्राप्त करें",
  },
  {
    id: "offer-power-bank",
    badge: "PREMIERE PACK",
    title: "Urbanrat MagSafe Titanium Power Bank",
    subtitle: "Release: January 2026 · ₹540 / unit",
    rating: "5.0",
    image: "/hero/dark/offer-power-bank.jpg",
    darkImage: "/hero/dark/offer-power-bank.jpg",
    lightImage: "/hero/light/offer-power-bank.jpg",
    ctaText: "Receive",
    ctaLink: "/marketplace?category=power-banks",
    tagline: "PREMIERES 2026 · WIRELESS MAGNETIC DOCK",
    headlineFirst: "MAGSAFE SLIM",
    headlineHighlight: "TITANIUM PACK",
    headlineSecond: "2026",
    description:
      "Ultra-compact 10,000mAh magnetic wireless power bank featuring 15W MagSafe snap alignment, bidirectional 20W Type-C fast charging, and real-time LED percentage readout.",
    highlights: [
      { icon: "Zap", text: "15W MagSafe Wireless" },
      { icon: "Sparkles", text: "LED Digital Display" },
      { icon: "Star", text: "5.0 Rated" },
    ],
    badge_hi: "प्रीमियर पैक",
    title_hi: "Urbanrat MagSafe टाइटेनियम पावर बैंक",
    subtitle_hi: "रिलीज़: जनवरी 2026 · ₹540 / पीस",
    tagline_hi: "प्रीमियर 2026 · वायरलेस मैग्नेटिक डॉक",
    headlineFirst_hi: "MAGSAFE स्लिम",
    headlineHighlight_hi: "टाइटेनियम पैक",
    headlineSecond_hi: "2026",
    description_hi:
      "अल्ट्रा-कॉम्पैक्ट 10,000mAh मैग्नेटिक वायरलेस पावर बैंक, 15W MagSafe स्नैप चार्जिंग, 20W टाइप-C फ़ास्ट चार्जिंग और रीयल-टाइम LED डिजिटल डिस्प्ले।",
    highlights_hi: [
      { icon: "Zap", text: "15W MagSafe वायरलेस" },
      { icon: "Sparkles", text: "LED डिजिटल डिस्प्ले" },
      { icon: "Star", text: "5.0 रेटिंग" },
    ],
    ctaText_hi: "स्टॉक प्राप्त करें",
  },
];

export function HeroStackedCarousel({ dbBanners = [] }: HeroStackedCarouselProps) {
  const { isDark } = useTheme();
  const { isHindi } = useLanguage();

  // Merge live database banners with curated offer cards and resolve Hindi localization
  const cards: OfferCard[] = (() => {
    const list: OfferCard[] = [];

    // Map database banners into OfferCard format
    dbBanners
      .filter((b) => b.is_active && b.image_url)
      .forEach((b) => {
        const customRating =
          b.rating ||
          b.badges?.find((x) => x.icon === "Star" || x.label === "rating")?.text ||
          undefined;

        // Fuzzy match with curated default cards by id, title keywords, or image url
        const bTitleClean = b.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        const matchedDef = DEFAULT_OFFER_CARDS.find((d) => {
          if (d.id === b.id) return true;
          const dTitleClean = d.title.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (dTitleClean === bTitleClean) return true;
          if (bTitleClean.includes("airbass") && d.id === "offer-tws-buds") return true;
          if (bTitleClean.includes("gan") && d.id === "offer-gan-65w") return true;
          if (bTitleClean.includes("diamond") && d.id === "offer-diamond-armor") return true;
          if (bTitleClean.includes("120w") && d.id === "offer-cables") return true;
          if (bTitleClean.includes("magsafe") && d.id === "offer-power-bank") return true;
          if (b.image_url && (b.image_url.includes(d.id) || d.image.includes(b.image_url))) return true;
          return false;
        });

        const fallbackDesc = isHindi
          ? "नेक्स्ट-जेनरेशन मोबाइल एवं कंप्यूटर एक्सेसरीज, सुपर स्पीड, डायमंड-ग्रेड सुरक्षा और अधिकतम थोक मार्जिन के लिए निर्मित।"
          : "Next-generation mobile & computer accessories engineered for supreme speed, diamond-grade protection, and maximum wholesale margins.";

        const productDescription =
          (isHindi && matchedDef?.description_hi) ||
          (b.subtitle && b.subtitle.trim().length > 30 ? b.subtitle.trim() : null) ||
          (isHindi ? matchedDef?.description_hi : matchedDef?.description) ||
          b.subtitle ||
          fallbackDesc;

        const fallbackSub = isHindi
          ? "रिलीज़: जनवरी 2026 · थोक मूल्य"
          : "Release: January 2026 · Wholesale Pricing";

        const cardPillSubtitle =
          (isHindi && matchedDef?.subtitle_hi) ||
          matchedDef?.subtitle ||
          (b.subtitle && b.subtitle.trim().length <= 30
            ? b.subtitle.trim()
            : fallbackSub);

        const cardHighlights =
          (isHindi && matchedDef?.highlights_hi) ||
          (b.badges && Array.isArray(b.badges) && b.badges.length > 0
            ? b.badges.map((badge: any) => ({
                icon: (["Zap", "ShieldCheck", "Star", "Flame", "Sparkles"].includes(badge.icon)
                  ? badge.icon
                  : "Zap") as "Zap" | "ShieldCheck" | "Star" | "Flame" | "Sparkles",
                text: badge.text || badge.label || (isHindi ? "थोक विनिर्देश" : "Wholesale Grade"),
              }))
            : (isHindi && matchedDef?.highlights_hi) || matchedDef?.highlights || [
                { icon: "Zap", text: isHindi ? "थोक विनिर्देश" : "Wholesale Spec" },
                { icon: "ShieldCheck", text: isHindi ? "गुणवत्ता प्रमाणित" : "Quality Certified" },
                { icon: "Star", text: isHindi ? `${customRating || "5.0"} रेटिंग` : `${customRating || "5.0"} Rated` },
              ]);

        const localizedBadge = isHindi
          ? (matchedDef?.badge_hi || b.badge_text || "URBANRAT प्रो")
          : (b.badge_text || matchedDef?.badge || "URBANRAT PRO");

        const localizedTitle = isHindi
          ? (matchedDef?.title_hi || b.title)
          : b.title;

        const localizedTagline = isHindi
          ? (matchedDef?.tagline_hi || `प्रीमियर 2026 · ${b.badge_text || "URT सिनेमैटिक गियर"}`)
          : (matchedDef?.tagline || `PREMIERES 2026 · ${b.badge_text || "URBANRAT CINEMATIC GEAR"}`);

        const localizedHeadlineFirst = isHindi
          ? (matchedDef?.headlineFirst_hi || matchedDef?.headlineFirst || b.title.split(" ").slice(0, 2).join(" ").toUpperCase())
          : (matchedDef?.headlineFirst || b.title.split(" ").slice(0, 2).join(" ").toUpperCase());

        const localizedHeadlineHighlight = isHindi
          ? (matchedDef?.headlineHighlight_hi || matchedDef?.headlineHighlight || b.title.split(" ").slice(2, 4).join(" ").toUpperCase() || "PREMIERE GEAR")
          : (matchedDef?.headlineHighlight || b.title.split(" ").slice(2, 4).join(" ").toUpperCase() || "PREMIERE GEAR");

        const localizedHeadlineSecond = isHindi
          ? (matchedDef?.headlineSecond_hi || matchedDef?.headlineSecond || "2026")
          : (matchedDef?.headlineSecond || "2026");

        const localizedCta = isHindi
          ? (matchedDef?.ctaText_hi || "स्टॉक प्राप्त करें")
          : (b.cta_text || matchedDef?.ctaText || "Receive");

        list.push({
          id: b.id,
          badge: localizedBadge,
          title: localizedTitle,
          subtitle: cardPillSubtitle,
          rating: customRating,
          image: b.image_url!,
          darkImage: matchedDef?.darkImage || b.image_url!,
          lightImage: matchedDef?.lightImage || b.image_url!,
          ctaText: localizedCta,
          ctaLink: b.cta_link || b.link_url || matchedDef?.ctaLink || "/urbanrat",
          tagline: localizedTagline,
          headlineFirst: localizedHeadlineFirst,
          headlineHighlight: localizedHeadlineHighlight,
          headlineSecond: localizedHeadlineSecond,
          description: productDescription,
          highlights: cardHighlights,
          badge_hi: matchedDef?.badge_hi,
          title_hi: matchedDef?.title_hi,
          subtitle_hi: matchedDef?.subtitle_hi,
          tagline_hi: matchedDef?.tagline_hi,
          headlineFirst_hi: matchedDef?.headlineFirst_hi,
          headlineHighlight_hi: matchedDef?.headlineHighlight_hi,
          headlineSecond_hi: matchedDef?.headlineSecond_hi,
          description_hi: matchedDef?.description_hi,
          highlights_hi: matchedDef?.highlights_hi,
          ctaText_hi: matchedDef?.ctaText_hi,
        });
      });

    // Append defaults to ensure stacked carousel has at least 5 rich cards
    DEFAULT_OFFER_CARDS.forEach((def) => {
      const defClean = def.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      const alreadyPresent = list.some((existing) => {
        if (existing.id === def.id) return true;
        const exClean = existing.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (exClean === defClean) return true;
        if (exClean.includes("airbass") && def.id === "offer-tws-buds") return true;
        if (exClean.includes("gan") && def.id === "offer-gan-65w") return true;
        if (exClean.includes("diamond") && def.id === "offer-diamond-armor") return true;
        if (exClean.includes("120w") && def.id === "offer-cables") return true;
        if (exClean.includes("magsafe") && def.id === "offer-power-bank") return true;
        return false;
      });
      if (!alreadyPresent) {
        list.push({
          ...def,
          badge: isHindi ? (def.badge_hi || def.badge) : def.badge,
          title: isHindi ? (def.title_hi || def.title) : def.title,
          subtitle: isHindi ? (def.subtitle_hi || def.subtitle) : def.subtitle,
          tagline: isHindi ? (def.tagline_hi || def.tagline) : def.tagline,
          headlineFirst: isHindi ? (def.headlineFirst_hi || def.headlineFirst) : def.headlineFirst,
          headlineHighlight: isHindi ? (def.headlineHighlight_hi || def.headlineHighlight) : def.headlineHighlight,
          headlineSecond: isHindi ? (def.headlineSecond_hi || def.headlineSecond) : def.headlineSecond,
          description: isHindi ? (def.description_hi || def.description) : def.description,
          highlights: isHindi ? (def.highlights_hi || def.highlights) : def.highlights,
          ctaText: isHindi ? (def.ctaText_hi || "स्टॉक प्राप्त करें") : def.ctaText,
        });
      }
    });

    return list.slice(0, 5);
  })();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const isHoveredRef = useRef(false);
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

  // Sync autoplay with Page Visibility API & Window Focus:
  // Prevents the carousel from advancing or freezing when the user switches browser tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab backgrounded: pause carousel so timers don't queue or desync
        setIsPaused(true);
      } else {
        // Tab restored: check if user's cursor is physically over the carousel
        const isCurrentlyHovered = Boolean(
          sectionRef.current &&
            typeof sectionRef.current.matches === "function" &&
            sectionRef.current.matches(":hover")
        );
        isHoveredRef.current = isCurrentlyHovered;
        setIsPaused(isCurrentlyHovered);
      }
    };

    const handleWindowBlur = () => {
      // User switched to another window/app/tab
      setIsPaused(true);
    };

    const handleWindowFocus = () => {
      // Window regained focus
      if (!document.hidden) {
        const isCurrentlyHovered = Boolean(
          sectionRef.current &&
            typeof sectionRef.current.matches === "function" &&
            sectionRef.current.matches(":hover")
        );
        isHoveredRef.current = isCurrentlyHovered;
        setIsPaused(isCurrentlyHovered);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  // Smooth Auto-Play Loop: Advances every 4.8s unless hovered, tab hidden or window blurred
  useEffect(() => {
    if (isPaused || total <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, 4800);

    return () => clearInterval(interval);
  }, [isPaused, total]);

  // Touch Swipe Gesture Handling (Mobile / Tablet)
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
    touchStartTimeRef.current = Date.now();
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const currentX = e.touches[0]?.clientX ?? 0;
    const currentY = e.touches[0]?.clientY ?? 0;
    const diffX = touchStartXRef.current - currentX;
    const diffY = touchStartYRef.current - currentY;

    // If horizontal swipe is clearly dominant over vertical scroll, lock it in
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
      if (e.cancelable) {
        // Prevent accidental page bounce during crisp carousel flick
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) {
      setIsPaused(false);
      return;
    }

    const endX = e.changedTouches[0]?.clientX ?? 0;
    const endY = e.changedTouches[0]?.clientY ?? 0;
    const diffX = touchStartXRef.current - endX;
    const diffY = (touchStartYRef.current ?? 0) - endY;
    const elapsedTime = Date.now() - touchStartTimeRef.current;

    // Minimum swipe threshold (50px) or quick velocity flick (>30px under 250ms)
    const isQuickFlick = elapsedTime < 250 && Math.abs(diffX) > 30;
    const isSubstantialSwipe = Math.abs(diffX) > 50;

    if ((isQuickFlick || isSubstantialSwipe) && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        // Swiped Left -> Advance to next slide
        nextSlide();
      } else {
        // Swiped Right -> Return to previous slide
        prevSlide();
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    setIsPaused(false);
  };

  const handleTouchCancel = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    setIsPaused(false);
  };

  // Keyboard Arrow Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is focused inside an input/textarea
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      if (e.key === "ArrowLeft") {
        prevSlide();
      } else if (e.key === "ArrowRight") {
        nextSlide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide]);

  const activeCard = cards[activeIndex] || cards[0];

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    setIsPaused(false);
  };

  return (
    <section
      ref={sectionRef}
      aria-label={isHindi ? "थोक ऑफर्स शोकेस" : "Wholesale Offers Showcase"}
      className="relative w-full py-4 sm:py-6 select-none overflow-hidden lg:overflow-visible"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
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
          {/* Top Pill Badge (Cursor-Phobic Repulsion) */}
          <CursorPhobicElement
            as="div"
            repulsionRadius={140}
            maxDisplacement={16}
            maxTilt={4}
            className="w-fit"
          >
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-black/90 backdrop-blur-md border border-slate-700/60 dark:border-white/10 text-[11px] font-bold text-white shadow-xs w-fit">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="tracking-wider uppercase text-slate-200">
                {(isHindi && activeCard?.tagline_hi) ? activeCard.tagline_hi : (activeCard?.tagline || (isHindi ? "प्रीमियर 2026 · URT सिनेमैटिक गियर" : "PREMIERES 2026 · URBANRAT CINEMATIC GEAR"))}
              </span>
            </div>
          </CursorPhobicElement>

          {/* Main Headline (Every Word Parts and Diverges from Cursor) */}
          <div className="space-y-1">
            <h1 className="text-4xl xl:text-5xl 2xl:text-6xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-[1.05] transition-all duration-300">
              <div className="tracking-tight">
                <CursorPhobicWords
                  text={(isHindi && activeCard?.headlineFirst_hi) ? activeCard.headlineFirst_hi : (activeCard?.headlineFirst || (isHindi ? "प्रमुख गियर" : "MAJOR GEAR"))}
                  repulsionRadius={170}
                  maxDisplacement={28}
                  maxTilt={8}
                />
              </div>
              <div className="text-red-500 dark:text-red-500 drop-shadow-[0_0_24px_rgba(239,68,68,0.55)]">
                <CursorPhobicWords
                  text={(isHindi && activeCard?.headlineHighlight_hi) ? activeCard.headlineHighlight_hi : (activeCard?.headlineHighlight || (isHindi ? "प्रीमियर का" : "OF PREMIERES"))}
                  repulsionRadius={170}
                  maxDisplacement={32}
                  maxTilt={8}
                />
              </div>
              <div className="tracking-tight">
                <CursorPhobicWords
                  text={(isHindi && activeCard?.headlineSecond_hi) ? activeCard.headlineSecond_hi : (activeCard?.headlineSecond || "2026")}
                  repulsionRadius={170}
                  maxDisplacement={28}
                  maxTilt={8}
                />
              </div>
            </h1>
          </div>

          {/* Subtitle / Paragraph (Smooth Magnetic Spring Divergence) */}
          <CursorPhobicElement
            as="p"
            repulsionRadius={160}
            maxDisplacement={16}
            maxTilt={3}
            className="text-sm xl:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg font-medium min-h-12 transition-all duration-300"
          >
            {(isHindi && activeCard?.description_hi) ? activeCard.description_hi : (activeCard?.description || (isHindi ? "नेक्स्ट-जेनरेशन मोबाइल एवं कंप्यूटर एक्सेसरीज, सुपर स्पीड, डायमंड-ग्रेड सुरक्षा और 65W GaN अल्ट्रा-फ़ास्ट चार्जिंग के लिए निर्मित।" : "Next-generation mobile & computer accessories engineered for supreme speed, diamond-grade protection, and 65W GaN ultra-fast charging."))}
          </CursorPhobicElement>

          {/* 3 Highlight Chips (Each chip repels away from cursor) */}
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-2 text-xs font-bold transition-all duration-300">
            {((isHindi && activeCard?.highlights_hi) ? activeCard.highlights_hi : (activeCard?.highlights || [
              { icon: "Zap", text: isHindi ? "65W GaN कोर" : "65W GaN Core" },
              { icon: "ShieldCheck", text: isHindi ? "9H सफायर आर्मर" : "9H Sapphire Armor" },
              { icon: "Star", text: isHindi ? "4.9 रेटिंग" : "4.9 Rated" },
            ])).map((h, i) => (
              <CursorPhobicElement
                key={i}
                as="div"
                repulsionRadius={140}
                maxDisplacement={18}
                maxTilt={6}
                className="inline-block"
              >
                <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 shadow-2xs">
                  {h.icon === "Zap" && <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                  {h.icon === "ShieldCheck" && <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />}
                  {h.icon === "Flame" && <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />}
                  {h.icon === "Sparkles" && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                  {h.icon === "Star" && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                  <span>{h.text}</span>
                </div>
              </CursorPhobicElement>
            ))}
          </div>

          {/* Controls & CTA Row (Interactive Cursor Divergence) */}
          <div className="flex items-center space-x-4 pt-2">
            <CursorPhobicElement
              as="div"
              repulsionRadius={150}
              maxDisplacement={14}
              maxTilt={4}
            >
              <Link
                to={activeCard?.ctaLink || "/urbanrat"}
                className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl font-semibold text-xs sm:text-sm text-on-primary bg-primary hover:bg-primary-hover active:bg-primary-active shadow-xs hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <span>{(isHindi && activeCard?.ctaText_hi) ? activeCard.ctaText_hi : (activeCard?.ctaText || (isHindi ? "स्टॉक प्राप्त करें" : "Receive"))}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </Link>
            </CursorPhobicElement>

            <CursorPhobicElement
              as="div"
              repulsionRadius={130}
              maxDisplacement={12}
              maxTilt={4}
            >
              <button
                type="button"
                onClick={prevSlide}
                aria-label={isHindi ? "पिछला ऑफर" : "Previous slide"}
                className="w-10 h-10 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/60 dark:border-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.6)] hover:bg-white/60 dark:hover:bg-white/10 flex items-center justify-center text-slate-800 dark:text-slate-100 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.4]" />
              </button>
            </CursorPhobicElement>

            <CursorPhobicElement
              as="div"
              repulsionRadius={130}
              maxDisplacement={12}
              maxTilt={4}
            >
              <button
                type="button"
                onClick={nextSlide}
                aria-label={isHindi ? "अगला ऑफर" : "Next slide"}
                className="w-10 h-10 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/60 dark:border-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.6)] hover:bg-white/60 dark:hover:bg-white/10 flex items-center justify-center text-slate-800 dark:text-slate-100 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 stroke-[2.4]" />
              </button>
            </CursorPhobicElement>

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

              const cardImgSrc = isDark
                ? card.darkImage || card.image
                : card.lightImage || card.image;

              return (
                <m.div
                  key={card.id}
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
                    stiffness: 260,
                    damping: 28,
                    mass: 0.8,
                    restDelta: 0.001,
                  }}
                  onClick={() => {
                    if (isLeft) prevSlide();
                    if (isRight) nextSlide();
                  }}
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-70 sm:w-82.5 md:w-87.5 lg:w-80 xl:w-86 h-95 sm:h-110 md:h-116.25 lg:h-115 xl:h-120 rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 ${
                    isCenter
                      ? "shadow-[0_20px_45px_rgba(15,23,42,0.15)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.7)] ring-1 ring-slate-200/90 dark:ring-white/15 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xl"
                      : "shadow-md hover:opacity-80 transition-opacity bg-slate-50/70 dark:bg-slate-950/70"
                  }`}
                >
                  {/* Cursor-Phobic Repulsion & 3D Tilt for Hero Card */}
                  <CursorPhobicElement
                    as="div"
                    repulsionRadius={isCenter ? 340 : 200}
                    maxDisplacement={isCenter ? 36 : 14}
                    maxTilt={isCenter ? 9 : 3}
                    scaleOnRepel={isCenter ? 1.02 : 1}
                    className="w-full h-full relative"
                  >
                    {/* Card Background Hero Image (With Secondary Parallax Cursor Repulsion) */}
                    <CursorPhobicElement
                      as="div"
                      repulsionRadius={isCenter ? 280 : 180}
                      maxDisplacement={isCenter ? 24 : 8}
                      maxTilt={isCenter ? 5 : 0}
                      className="w-full h-full"
                    >
                      <img
                        src={cardImgSrc}
                        alt={card.title}
                        className="w-full h-full object-cover rounded-3xl transition-transform duration-700"
                        loading={isCenter ? "eager" : "lazy"}
                        decoding="async"
                      />
                    </CursorPhobicElement>

                    {/* Gradient Vignette Overlay for High Legibility (Dual Theme) */}
                    <div className="absolute inset-0 bg-linear-to-t from-white/95 via-transparent to-white/15 dark:from-black/95 dark:via-black/35 dark:to-black/15 pointer-events-none transition-colors" />

                    {/* ── Top Pill Badge (e.g. URBANRAT PRO / प्रीमियर पैक) ── */}
                    <div
                      className={`absolute top-4 left-4 z-20 transition-opacity duration-300 ${
                        isCenter ? "opacity-100" : "opacity-40"
                      }`}
                    >
                      <span className="inline-flex items-center px-3 py-1 rounded-xl bg-white/90 dark:bg-black/75 backdrop-blur-md border border-slate-200/80 dark:border-white/15 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white shadow-sm">
                        {(isHindi && card.badge_hi) ? card.badge_hi : card.badge}
                      </span>
                    </div>

                    {/* ── Minimalist Premium Title Capsule (Only on front card) ── */}
                    <Link
                      to={card.ctaLink}
                      onClick={(e) => {
                        if (!isCenter) {
                          e.preventDefault();
                          goToSlide(idx);
                        }
                      }}
                      className={`absolute bottom-3.5 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 bg-white/95 dark:bg-[#070B12]/92 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 rounded-2xl py-2.5 sm:py-3 px-3.5 sm:px-4 shadow-xl dark:shadow-2xl flex items-center justify-center text-center hover:bg-white dark:hover:bg-[#0d131f] hover:scale-[1.01] active:scale-98 transition-all duration-300 cursor-pointer ${
                        isCenter ? "opacity-100" : "opacity-0 pointer-events-none"
                      }`}
                    >
                      <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white tracking-tight truncate max-w-full">
                        {(isHindi && card.title_hi) ? card.title_hi : card.title}
                      </h3>
                    </Link>
                  </CursorPhobicElement>
                </m.div>
              );
            })}

            {/* ── Mobile/Tablet Floating Navigation Chevrons (Glassmorphic Theme) ── */}
            <button
              type="button"
              onClick={prevSlide}
              aria-label={isHindi ? "पिछला ऑफर" : "Previous Offer"}
              className="lg:hidden flex absolute left-3 top-1/2 -translate-y-1/2 z-35 w-9.5 h-9.5 rounded-full bg-white/35 dark:bg-black/40 backdrop-blur-xl border border-white/70 dark:border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.7)] items-center justify-center text-slate-900 dark:text-white hover:bg-white/55 dark:hover:bg-white/15 active:scale-90 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4.5 h-4.5 stroke-[2.5] drop-shadow-xs" />
            </button>

            <button
              type="button"
              onClick={nextSlide}
              aria-label={isHindi ? "अगला ऑफर" : "Next Offer"}
              className="lg:hidden flex absolute right-3 top-1/2 -translate-y-1/2 z-35 w-9.5 h-9.5 rounded-full bg-white/35 dark:bg-black/40 backdrop-blur-xl border border-white/70 dark:border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.7)] items-center justify-center text-slate-900 dark:text-white hover:bg-white/55 dark:hover:bg-white/15 active:scale-90 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4.5 h-4.5 stroke-[2.5] drop-shadow-xs" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Active Card Title & Full Description (With Touch/Cursor Repulsion) ── */}
      {activeCard && (
        <div className="lg:hidden px-4 pt-3 text-center space-y-1.5 animate-in fade-in duration-200">
          <CursorPhobicElement as="h2" repulsionRadius={140} maxDisplacement={14} maxTilt={4} className="text-base font-black text-slate-900 dark:text-white tracking-tight">
            {(isHindi && activeCard.title_hi) ? activeCard.title_hi : activeCard.title}
          </CursorPhobicElement>
          <CursorPhobicElement as="p" repulsionRadius={130} maxDisplacement={10} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto font-medium">
            {(isHindi && activeCard.description_hi) ? activeCard.description_hi : activeCard.description}
          </CursorPhobicElement>
        </div>
      )}

      {/* ── Mobile Carousel Indicator Dots (Hidden on Desktop) ── */}
      <div className="flex lg:hidden items-center justify-center space-x-2 pt-3">
        {cards.map((card, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => goToSlide(idx)}
              aria-label={isHindi ? `ऑफर स्लाइड ${idx + 1} पर जाएं` : `Go to offer slide ${idx + 1}`}
              className={`transition-all duration-300 rounded-full cursor-pointer ${
                isActive
                  ? "w-7 h-2 bg-primary shadow-xs"
                  : "w-2 h-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}
