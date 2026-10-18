export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  mrp: number | null;
  sku: string | null;
  stock: number;
  images: string[];
  category_id: string | null;
  is_urbanrat_brand: boolean;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at?: string;
}
