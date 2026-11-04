import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import {
  Truck,
  Zap,
  ShieldCheck,
  BadgePercent,
  PackageCheck,
  Flame,
  Sparkles,
  Layers,
  Award,
  Tag,
  Percent,
  Clock,
  Gift,
  Star,
  CheckCircle2,
  Headphones,
  BatteryCharging,
} from "lucide-react";
import type { StoreSettings, MarqueeAnnouncement } from "@urbanrat/shared";
import { fetchActiveMarqueeAnnouncements } from "../services/storeService";
import { useLanguage } from "../context/LanguageContext";

export interface WholesaleMarqueeProps {
  items?: MarqueeAnnouncement[] | null;
  settings?: StoreSettings | null;
  className?: string;
}

export interface MarqueeDisplayItem {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  iconComponent: React.ComponentType<{ className?: string }>;
  link_url?: string | null;
}

export const MARQUEE_ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  BadgePercent,
  Truck,
  Zap,
  ShieldCheck,
  Flame,
  PackageCheck,
  Layers,
  Sparkles,
  Award,
  Tag,
  Percent,
  Clock,
  Gift,
  Star,
  CheckCircle2,
  Headphones,
  BatteryCharging,
};

export const PRIMARY_OFFERS: MarqueeDisplayItem[] = [
  {
    id: "bulk-savings",
    badge: "WHOLESALE TIERS",
    title: "UP TO 35% BULK SAVINGS",
    subtitle: "Automatic tier volume discounts on 100+ pcs",
    iconComponent: BadgePercent,
    link_url: "/marketplace",
  },
  {
    id: "free-shipping",
    badge: "FREE DELIVERY",
    title: "₹0 SHIPPING ON ORDERS ₹999+",
    subtitle: "Pan-India express logistics across all states",
    iconComponent: Truck,
    link_url: "/marketplace",
  },
  {
    id: "fast-dispatch",
    badge: "EXPRESS DISPATCH",
    title: "SAME-DAY 24H DISPATCH",
    subtitle: "Direct surface & air cargo via SafeXpress / Delhivery",
    iconComponent: Zap,
    link_url: "/marketplace",
  },
  {
    id: "warranty",
    badge: "URT PROMISE",
    title: "1-YEAR REPLACEMENT WARRANTY",
    subtitle: "100% Quality Inspected • Instant DOA replacement",
    iconComponent: ShieldCheck,
    link_url: "/about",
  },
  {
    id: "factory-direct",
    badge: "DIRECT PRICING",
    title: "FACTORY-DIRECT WHOLESALE",
    subtitle: "Zero middlemen commissions • Maximum retail shop profit",
    iconComponent: Flame,
    link_url: "/marketplace",
  },
  {
    id: "low-moq",
    badge: "LOW MOQ",
    title: "START FROM JUST 10 PIECES",
    subtitle: "Flexible wholesale lot sizes for shop retailers",
    iconComponent: PackageCheck,
    link_url: "/marketplace",
  },
  {
    id: "catalog-scale",
    badge: "READY STOCK",
    title: "1,600+ ACTIVE PRODUCTS IN STOCK",
    subtitle: "Cables, Chargers, Earphones, TWS & Premium Accessories",
    iconComponent: Layers,
    link_url: "/marketplace",
  },
  {
    id: "dealer-benefits",
    badge: "DEALER PROGRAM",
    title: "EXCLUSIVE DEALER RATES & CREDIT",
    subtitle: "Apply for verified wholesale dealer net terms",
    iconComponent: Sparkles,
    link_url: "/dealer",
  },
];

export const HINDI_PRIMARY_OFFERS: MarqueeDisplayItem[] = [
  {
    id: "bulk-savings",
    badge: "थोक बचत",
    title: "35% तक की थोक बचत",
    subtitle: "100+ पीस पर ऑटोमैटिक वॉल्यूम डिस्काउंट",
    iconComponent: BadgePercent,
    link_url: "/marketplace",
  },
  {
    id: "free-shipping",
    badge: "मुफ़्त डिलीवरी",
    title: "₹999+ के ऑर्डर पर मुफ़्त डिलीवरी",
    subtitle: "पूरे भारत के सभी राज्यों में एक्सप्रेस डिलीवरी",
    iconComponent: Truck,
    link_url: "/marketplace",
  },
  {
    id: "fast-dispatch",
    badge: "एक्सप्रेस डिस्पैच",
    title: "उसी दिन 24 घंटे में डिस्पैच",
    subtitle: "SafeXpress / Delhivery द्वारा सीधा एक्सप्रेस एयर एवं सर्फेस कार्गो",
    iconComponent: Zap,
    link_url: "/marketplace",
  },
  {
    id: "factory-pricing",
    badge: "फैक्ट्री रेट",
    title: "फैक्ट्री से सीधा थोक भाव",
    subtitle: "बिचौलियों का शून्य कमीशन • आपकी दुकान के लिए अधिकतम मुनाफा",
    iconComponent: Flame,
    link_url: "/marketplace",
  },
  {
    id: "flexible-moq",
    badge: "कम न्यूनतम ऑर्डर",
    title: "सिर्फ 10 पीस से शुरुआत",
    subtitle: "दुकानदारों के लिए लचीली थोक लॉट साइज",
    iconComponent: PackageCheck,
    link_url: "/marketplace",
  },
  {
    id: "qc-tested",
    badge: "100% जांची गई",
    title: "100% गुणवत्ता परीक्षण पास",
    subtitle: "हर चार्जिंग और ऑडियो एक्सेसरी पर डबल QC टेस्टिंग",
    iconComponent: ShieldCheck,
    link_url: "/marketplace",
  },
  {
    id: "ready-stock",
    badge: "रेडी स्टॉक",
    title: "1,600+ सक्रिय उत्पाद स्टॉक में",
    subtitle: "केबल्स, चार्जर, ईयरफोन, TWS बड्स एवं प्रीमियम मोबाइल एक्सेसरीज",
    iconComponent: Layers,
    link_url: "/marketplace",
  },
  {
    id: "dealer-benefits",
    badge: "डीलरशिप",
    title: "URT अधिकृत डीलर बनें",
    subtitle: "VIP फैक्ट्री रेट और क्षेत्र-वार वारंटी सपोर्ट अनलॉक करें",
    iconComponent: Sparkles,
    link_url: "/dealership",
  },
];

function MarqueeItem({ item }: { item: MarqueeDisplayItem }) {
  const Icon = item.iconComponent;
  const content = (
    <div className="flex items-center space-x-3 shrink-0 py-0.5 group/item transition-transform duration-200">
      {/* Visual Icon Chip */}
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center bg-brand/10 dark:bg-orange-500/15 border border-brand/20 dark:border-orange-500/30 text-brand-dark dark:text-orange-400 shrink-0 shadow-2xs group-hover/item:scale-105 transition-transform">
        <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
      </div>

      {/* Big Visible Text Block */}
      <div className="flex flex-col">
        <div className="flex items-center space-x-2">
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-brand-light/25 dark:bg-orange-500/20 text-brand-dark dark:text-orange-300 border border-brand/20 dark:border-orange-500/30 leading-none">
            {item.badge}
          </span>
          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight leading-tight whitespace-nowrap group-hover/item:text-brand-dark dark:group-hover/item:text-orange-400 transition-colors">
            {item.title}
          </h3>
        </div>
        <p className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-normal whitespace-nowrap mt-0.5">
          {item.subtitle}
        </p>
      </div>

      {/* Decorative Separator Dot */}
      <span
        className="pl-5 sm:pl-8 text-brand dark:text-orange-400 opacity-40 select-none text-xs sm:text-sm font-black"
        aria-hidden="true"
      >
        ✦
      </span>
    </div>
  );

  if (item.link_url) {
    if (item.link_url.startsWith("http://") || item.link_url.startsWith("https://")) {
      return (
        <a
          href={item.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="focus:outline-none"
        >
          {content}
        </a>
      );
    }
    return (
      <Link to={item.link_url} className="focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}

export function WholesaleMarquee({
  items: propItems,
  settings,
  className = "",
}: WholesaleMarqueeProps) {
  const { isHindi } = useLanguage();
  const defaultOffers = isHindi ? HINDI_PRIMARY_OFFERS : PRIMARY_OFFERS;
  const [dbAnnouncements, setDbAnnouncements] = useState<MarqueeAnnouncement[]>([]);

  // Fetch live marquee announcements from Supabase unless propItems is supplied
  useEffect(() => {
    if (propItems !== undefined && propItems !== null) return;
    let isMounted = true;
    fetchActiveMarqueeAnnouncements()
      .then((data) => {
        if (isMounted && data && data.length > 0) {
          setDbAnnouncements(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load marquee announcements from Supabase:", err);
      });
    return () => {
      isMounted = false;
    };
  }, [propItems]);

  // Compute final display items
  const displayItems = useMemo<MarqueeDisplayItem[]>(() => {
    const rawList = propItems ?? (dbAnnouncements.length > 0 ? dbAnnouncements : null);

    if (rawList && rawList.length > 0) {
      return rawList.map((ann) => {
        const Icon = MARQUEE_ICON_MAP[ann.icon] || Sparkles;
        return {
          id: ann.id,
          badge: ann.badge,
          title: ann.title,
          subtitle: ann.subtitle,
          iconComponent: Icon,
          link_url: ann.link_url,
        };
      });
    }

    // Secondary fallback: if settings has value_badges, incorporate them
    if (settings?.value_badges && settings.value_badges.length > 0) {
      const customItems: MarqueeDisplayItem[] = settings.value_badges.map((b, idx) => ({
        id: `custom-setting-${idx}`,
        badge: isHindi ? "सत्यापित" : "VERIFIED",
        title: b.text.toUpperCase(),
        subtitle: isHindi ? "URT थोक गारंटी" : "URT Wholesale Guarantee",
        iconComponent: MARQUEE_ICON_MAP[b.icon] || Award,
      }));

      const existingTitles = new Set(customItems.map((c) => c.title.toLowerCase()));
      const filteredDefaults = defaultOffers.filter(
        (o) => !existingTitles.has(o.title.toLowerCase())
      );
      return [...customItems, ...filteredDefaults];
    }

    return defaultOffers;
  }, [propItems, dbAnnouncements, settings?.value_badges, defaultOffers, isHindi]);

  return (
    <section
      aria-label="Live offers and wholesale benefits marquee"
      className={`relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen max-w-[100vw] overflow-hidden rounded-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-y border-slate-200/80 dark:border-slate-800/80 shadow-xs sm:shadow-sm py-3 sm:py-3.5 my-3 sm:my-4 transition-colors ${className}`}
    >
      {/* ── Gradient Edge Fade Masks for True Screen-Edge Blending ── */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 sm:w-28 bg-linear-to-r from-white dark:from-slate-900 via-white/80 dark:via-slate-900/80 to-transparent z-10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-28 bg-linear-to-l from-white dark:from-slate-900 via-white/80 dark:via-slate-900/80 to-transparent z-10"
        aria-hidden="true"
      />

      {/* ── Continuous Scrolling Marquee Track (Seamless Infinite Loop) ── */}
      <div className="flex animate-marquee-scroll hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] items-center cursor-default">
        {/* Set 1 */}
        <div className="flex shrink-0 items-center space-x-8 sm:space-x-12 pr-8 sm:pr-12">
          {displayItems.map((item) => (
            <MarqueeItem key={item.id} item={item} />
          ))}
        </div>

        {/* Set 2 (Cloned for seamless infinite loop without stutter) */}
        <div
          className="flex shrink-0 items-center space-x-8 sm:space-x-12 pr-8 sm:pr-12"
          aria-hidden="true"
        >
          {displayItems.map((item) => (
            <MarqueeItem key={`${item.id}-clone`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
