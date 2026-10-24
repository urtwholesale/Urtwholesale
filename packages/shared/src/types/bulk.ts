export type BulkOperationType = "details" | "tiers" | "stock" | "images";

export type BulkOperationStatus = "applied" | "undone" | "failed";

export interface BulkOperationRecord {
  id: string;
  op_type: BulkOperationType;
  params: Record<string, any>;
  product_ids: string[];
  before_snapshot: any[];
  affected_count: number;
  status: BulkOperationStatus;
  created_by: string | null;
  created_at: string;
  undone_at: string | null;
}

export type BulkMrpPatch =
  | number
  | {
      mode: "set" | "increase_pct" | "decrease_pct" | "increase_amt" | "decrease_amt";
      value: number;
    };

export interface BulkProductPatch {
  category_id?: string | null;
  brand?: string | null;
  tagline?: string | null;
  description?: string | null;
  warranty_months?: number | null;
  mrp?: BulkMrpPatch;
  moq?: number | null;
  order_step?: number | null;
  low_stock_threshold?: number | null;
  is_active?: boolean;
  is_featured?: boolean;
  is_trending?: boolean;
  is_urbanrat_brand?: boolean;
  keywords_add?: string[];
  keywords_remove?: string[];
  keywords_replace?: string[];
}

export type BulkTierMode = "replace" | "adjust" | "from_base" | "copy_from" | "clear";

export interface BulkTierAdjustmentPayload {
  type: "pct" | "amount";
  direction: "up" | "down";
  value: number;
  round_to?: number;
}

export interface BulkTierFromBasePayload {
  min_qty: number;
  discount_pct: number;
}

export type BulkTierPayload =
  | Array<{ min_qty: number; price: number }> // replace mode
  | BulkTierAdjustmentPayload // adjust mode
  | BulkTierFromBasePayload[] // from_base mode
  | string // copy_from (source product ID)
  | null; // clear mode

export type BulkStockMode = "add" | "subtract" | "set" | "zero";

export interface BulkStockSheetRow {
  sku: string;
  product_name?: string;
  current_stock?: number;
  new_stock?: number;
  delta?: number;
  reason?: string;
}

export interface BulkStockItemPayload {
  product_id: string;
  mode: BulkStockMode | "delta";
  qty: number;
  reason?: string;
}

export type BulkImageMode =
  | "append"
  | "prepend"
  | "replace_all"
  | "set_primary"
  | "remove_url"
  | "clear";

export interface BulkPreviewRow {
  product_id: string;
  product_name: string;
  sku?: string | null;
  before: any;
  after: any;
  errors?: string[];
  warnings?: string[];
}

export interface BulkOpResult {
  success: boolean;
  dry_run: boolean;
  op_id?: string;
  affected_count: number;
  total_count: number;
  items: BulkPreviewRow[];
  errors?: string[];
}
