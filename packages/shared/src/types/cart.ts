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

export interface CartSummary {
  itemsCount: number;
  subtotal: number;
  shipping: number;
  discountAmount: number;
  totalBeforeDiscount: number;
  total: number;
  coupon?: {
    code: string;
    discountAmount: number;
  };
}
