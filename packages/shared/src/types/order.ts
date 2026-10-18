export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  address: string;
  pincode: string;
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
  whatsapp_message?: string | null;
  created_at: string;
  updated_at?: string;
}

