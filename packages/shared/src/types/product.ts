import type { PriceTier } from "./pricing";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description?: string | null;
  price: number;
  mrp: number | null;
  sku: string | null;
  stock: number;
  images: string[];
  category_id: string | null;
  is_urbanrat_brand: boolean;
  is_active: boolean;
  is_featured: boolean;
  specs?: Record<string, string | number | boolean>;
  warranty_months?: number | null;
  tags?: string[];
  keywords?: string[];
  min_order_qty?: number;
  order_qty_step?: number;
  rating_avg?: number;
  rating_count?: number;
  is_trending?: boolean;
  low_stock_threshold?: number;
  price_tiers?: PriceTier[];
  created_at: string;
  updated_at?: string;
}
