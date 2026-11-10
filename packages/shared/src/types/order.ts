import type { ReturnRequest } from "./return";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "returned"
  | "on_hold"
  | string;

export type OrderSource = "website" | "whatsapp" | "manual" | string;
export type PaymentStatus = "pending" | "paid" | "unpaid" | "cod" | "failed" | "refunded" | "bad_debt" | string;

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  unit_price?: number;
  quantity: number;
  line_total?: number;
  tier_min_qty?: number;
  mrp?: number | null;
  sku?: string | null;
  image?: string | null;
  status?: string | null;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  address: string;
  pincode: string;
  business_name?: string | null;
  gstin?: string | null;
}

export interface OrderEvent {
  id?: string;
  order_id?: string;
  status: string;
  note?: string | null;
  customer_visible?: boolean;
  created_by?: string | null;
  created_at: string;
}

export interface CustomerLifetimeStats {
  total_orders: number;
  total_spend: number;
  delivered_orders?: number;
  first_order_date?: string | null;
  last_order_date?: string | null;
  is_bad_debt?: boolean;
  bad_debt_reason?: string | null;
  bad_debt_marked_at?: string | null;
  bad_debt_orders_count?: number;
  bad_debt_total_amount?: number;
}

export interface OrderNoticeCounts {
  delayed_pending_count: number;
  low_stock_count: number;
  ready_to_ship_count: number;
  on_hold_count: number;
}

export interface Order {
  id: string;
  user_id?: string | null;
  customer?: CustomerDetails;
  items: OrderItem[];
  subtotal?: number;
  savings?: number;
  shipping?: number;
  total: number;
  status: OrderStatus;
  source?: OrderSource;
  payment_status?: PaymentStatus;
  courier_name?: string | null;
  awb_number?: string | null;
  cancel_reason?: string | null;
  admin_note?: string | null;
  whatsapp_message?: string | null;
  public_token?: string | null;
  promo_code?: string | null;
  coupon_code?: string | null;
  couponCode?: string | null;
  discount_amount?: number;
  discountAmount?: number;
  subtotal_before_discount?: number | null;
  subtotalBeforeDiscount?: number | null;
  timeline?: OrderEvent[];
  events?: OrderEvent[];
  order_events?: OrderEvent[];
  returns?: ReturnRequest[];
  is_party_bad_debt?: boolean;
  party_bad_debt_reason?: string | null;
  created_at: string;
  updated_at?: string;
}
