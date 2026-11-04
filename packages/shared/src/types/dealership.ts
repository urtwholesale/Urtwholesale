export interface DealershipTierMargin {
  id: string;
  item_type: "branded" | "copy";
  category: string;
  item_name: string;
  lot_size: string;
  cost_price: number;
  retail_price_range: string;
  margin_percentage: string;
  profit_per_lot: string;
  description?: string;
  image_url?: string | null;
  badge_text?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DealershipTierMarginInput = Omit<
  DealershipTierMargin,
  "id" | "created_at" | "updated_at"
>;

export interface DealershipItemShowcase {
  id: string;
  item_type: "branded" | "copy";
  title: string;
  subtitle?: string;
  image_url: string;
  packaging_type?: string;
  warranty_type?: string;
  quality_grade?: string;
  target_customer?: string;
  dealer_margin?: string;
  features: string[];
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DealershipItemShowcaseInput = Omit<
  DealershipItemShowcase,
  "id" | "created_at" | "updated_at"
>;

export interface DealershipBenefitComparison {
  id: string;
  feature_name: string;
  normal_person_benefit: string;
  urt_dealer_benefit: string;
  category?: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DealershipBenefitComparisonInput = Omit<
  DealershipBenefitComparison,
  "id" | "created_at" | "updated_at"
>;

export interface DealershipArticle {
  id: string;
  article_type: "branded" | "copy";
  title: string;
  short_summary: string;
  content: string;
  badge: string;
  key_points: string[];
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DealershipArticleInput = Omit<
  DealershipArticle,
  "id" | "created_at" | "updated_at"
>;

