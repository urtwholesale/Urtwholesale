export interface StoreSettings {
  whatsapp_number: string;
  upi_id?: string;
  store_name?: string;
  free_delivery_min?: number;
  shipping_fee?: number;
  popular_searches: string[];
  value_badges: { icon: string; text: string }[];
  store_info: {
    name: string;
    tagline: string;
    currency: string;
  };
  return_window_days?: number;
  max_order_qty?: number;
  homepage_sections?: HomepageSection[];
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badge_text: string;
  image_url: string | null;
  link_url?: string | null;
  badges?: { icon?: string; text?: string; label?: string; value?: string }[];
  rating?: string;
  cta_text: string;
  cta_link: string;
  secondary_cta_text: string;
  secondary_cta_link: string;
  placement: "home_hero" | "home_brand" | "urbanrat_hero";
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorePage {
  slug: string;
  title: string;
  summary: string;
  content: string;
  is_published?: boolean;
  sort_order?: number;
  show_in_footer?: boolean;
  meta_description?: string;
  created_at: string;
  updated_at: string;
}

export interface MarqueeAnnouncement {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: string;
  link_url?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type MarqueeAnnouncementInput = Omit<
  MarqueeAnnouncement,
  "id" | "created_at" | "updated_at"
>;


export type HomepageSectionType =
  | "bestsellers"
  | "new_arrivals"
  | "deals"
  | "category"
  | "custom";

export type HomepageSectionTheme =
  | "amber"
  | "cyan"
  | "rose"
  | "violet"
  | "emerald"
  | "slate"
  | "blue"
  | "orange";

export interface HomepageSection {
  id: string;
  type: HomepageSectionType;
  title: string;
  title_hi?: string;
  subtitle: string;
  subtitle_hi?: string;
  badge_tag: string;
  badge_tag_hi?: string;
  icon: string;
  category_slug?: string;
  theme_color: HomepageSectionTheme;
  see_more_url: string;
  is_enabled: boolean;
  sort_order: number;
  product_limit?: number;
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSection[] = [
  {
    id: "sec-bestsellers",
    type: "bestsellers",
    title: "Bestsellers",
    title_hi: "बेस्टसेलर्स",
    subtitle: "Top-selling wholesale products with high retail margins",
    subtitle_hi: "उच्च रीसेल मार्जिन वाले सबसे अधिक बिकने वाले थोक उत्पाद",
    badge_tag: "🏆 #1 Bestseller",
    badge_tag_hi: "🏆 नंबर 1 बेस्टसेलर",
    icon: "Crown",
    theme_color: "amber",
    see_more_url: "/marketplace?bestseller=1",
    is_enabled: true,
    sort_order: 1,
    product_limit: 12,
  },
  {
    id: "sec-cables",
    type: "category",
    category_slug: "cables",
    title: "Fast Data & Charging Cables",
    title_hi: "फ़ास्ट डेटा एवं चार्जिंग केबल्स",
    subtitle: "Braided, silicone, fast charging cables at unbeatable wholesale rates",
    subtitle_hi: "ब्रेडेड और सिलिकॉन फ़ास्ट चार्जिंग केबल्स बेजोड़ थोक दरों पर",
    badge_tag: "100W PD & FAST SYNC",
    badge_tag_hi: "100W PD एवं फ़ास्ट सिंक",
    icon: "Zap",
    theme_color: "cyan",
    see_more_url: "/marketplace?category=cables",
    is_enabled: true,
    sort_order: 2,
    product_limit: 12,
  },
  {
    id: "sec-speakers",
    type: "category",
    category_slug: "speakers",
    title: "Speakers & Audio",
    title_hi: "स्पीकर्स एवं ऑडियो सिस्टम",
    subtitle: "Hi-Fi acoustic drivers, deep bass & Bluetooth wireless audio",
    subtitle_hi: "Hi-Fi साउंड ड्राइवर्स, गहरा बेस और वायरलेस ब्लूटूथ ऑडियो",
    badge_tag: "🔊 Studio Audio",
    badge_tag_hi: "🔊 स्टूडियो ऑडियो",
    icon: "Headphones",
    theme_color: "violet",
    see_more_url: "/marketplace?category=audio",
    is_enabled: true,
    sort_order: 3,
    product_limit: 12,
  },
  {
    id: "sec-new-arrivals",
    type: "new_arrivals",
    title: "New Arrivals",
    title_hi: "नया आगमन",
    subtitle: "Freshly stocked wholesale accessories across every category & collection",
    subtitle_hi: "हर श्रेणी और कलेक्शन में नए स्टॉक किए गए थोक एक्सेसरीज",
    badge_tag: "FRESH FACTORY DROP",
    badge_tag_hi: "नया फ़ैक्ट्री स्टॉक",
    icon: "Flame",
    theme_color: "rose",
    see_more_url: "/marketplace?sort=newest",
    is_enabled: true,
    sort_order: 4,
    product_limit: 24,
  },
  {
    id: "sec-deals",
    type: "deals",
    title: "Clearance Deals",
    title_hi: "क्लीयरेंस महासेल",
    subtitle: "Exclusive bulk volume discounts and liquidation pricing",
    subtitle_hi: "थोक खरीदारों के लिए विशेष वॉल्यूम डिस्काउंट और लिक्विडेशन डील्स",
    badge_tag: "EXTRA MARGIN DROP",
    badge_tag_hi: "अतिरिक्त मार्जिन ऑफर",
    icon: "Percent",
    theme_color: "emerald",
    see_more_url: "/marketplace?sort=price_asc",
    is_enabled: false,
    sort_order: 5,
    product_limit: 12,
  },
];
