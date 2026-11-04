export type CouponType = "percent" | "fixed";

export interface Coupon {
  id: string;
  code: string;
  description?: string | null;
  discount_type: CouponType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_value: number;
  starts_at?: string | null;
  expires_at?: string | null;
  usage_limit_total?: number | null;
  usage_limit_per_customer: number;
  used_count: number;
  first_order_only: boolean;
  category_ids: string[];
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CouponValidationResult {
  valid: boolean;
  discount_amount?: number;
  subtotal?: number;
  final_total?: number;
  code?: string;
  description?: string | null;
  message: string;
}

export interface CouponRedemption {
  id: string;
  coupon_id: string;
  order_id: string;
  user_id?: string | null;
  phone_hash?: string | null;
  discount_amount: number;
  status: "applied" | "released";
  created_at: string;
  released_at?: string | null;
}

export interface AdminCouponInput {
  id?: string;
  code: string;
  description?: string | null;
  discount_type: CouponType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_value?: number;
  starts_at?: string | null;
  expires_at?: string | null;
  usage_limit_total?: number | null;
  usage_limit_per_customer?: number;
  first_order_only?: boolean;
  category_ids?: string[];
  is_active?: boolean;
}

