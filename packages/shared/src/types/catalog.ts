export type QCStatus =
  | "all"
  | "action_required"
  | "qc_in_progress"
  | "qc_error"
  | "qc_pass";

export type UploadType = "bulk" | "single";

export interface CatalogItemPayload {
  name?: string;
  sku?: string;
  price?: number;
  mrp?: number | null;
  stock?: number;
  category_id?: string | null;
  keywords?: string[];
  images?: string[];
  specs?: Record<string, any>;
  description?: string;
  short_description?: string;
  min_order_qty?: number;
  order_qty_step?: number;
  [key: string]: any;
}

export interface CatalogUploadItem {
  id: string;
  upload_id: string;
  row_number: number;
  title: string;
  sku?: string | null;
  status: "action_required" | "qc_in_progress" | "qc_error" | "qc_pass";
  error_message?: string | null;
  product_id?: string | null;
  payload: CatalogItemPayload;
  created_at: string;
}

export interface CatalogUpload {
  id: string;
  upload_type: UploadType;
  category_id: string | null;
  category_path?: string | null;
  file_name: string | null;
  total_items: number;
  passed_items: number;
  failed_items: number;
  status: "action_required" | "qc_in_progress" | "qc_error" | "qc_pass";
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}
