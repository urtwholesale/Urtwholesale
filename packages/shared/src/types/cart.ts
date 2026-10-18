import type { Product } from "./product";

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  updated_at?: string;
  product?: Product;
}

export interface Cart {
  items: CartItem[];
  total: number;
}
