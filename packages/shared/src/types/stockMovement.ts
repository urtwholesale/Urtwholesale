export interface StockMovement {
  id: string;
  product_id: string;
  change: number;
  reason: string;
  order_id?: string | null;
  admin_id?: string | null;
  created_at: string;
}
