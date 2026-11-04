export type DiscountType = "percentage" | "fixed";

export interface PromoCode {
  id: string;
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number | null;
  usage_limit?: number | null;
  usage_count: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromoCodeInput {
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number | null;
  usage_limit?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
}

export interface ValidatePromoCodeResult {
  valid: boolean;
  message: string;
  code?: string;
  description?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  discount_amount?: number;
  min_order_amount?: number;
  max_discount_amount?: number | null;
  shortfall?: number;
  new_total?: number;
}

