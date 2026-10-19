export interface PriceTier {
  id?: string;
  product_id?: string;
  min_qty: number;
  unit_price: number;
  created_at?: string;
}
