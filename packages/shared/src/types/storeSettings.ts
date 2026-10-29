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
