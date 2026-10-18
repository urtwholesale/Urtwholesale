export interface StoreSettings {
  whatsapp_number: string;
  popular_searches: string[];
  value_badges: { icon: string; text: string }[];
  store_info: {
    name: string;
    tagline: string;
    currency: string;
  };
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badge_text: string;
  image_url: string | null;
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
  created_at: string;
  updated_at: string;
}
