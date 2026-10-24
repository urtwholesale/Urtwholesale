import type { Category } from "@urbanrat/shared";

export type QCStatus =
  | "all"
  | "action_required"
  | "qc_in_progress"
  | "qc_error"
  | "qc_pass";

export type UploadType = "bulk" | "single";

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

export interface CatalogUploadItem {
  id: string;
  upload_id: string;
  row_number: number;
  title: string;
  sku?: string | null;
  status: "action_required" | "qc_in_progress" | "qc_error" | "qc_pass";
  error_message?: string | null;
  product_id?: string | null;
  payload: Record<string, any>;
  created_at: string;
}

export interface CategoryNode extends Category {
  level: number;
  fullPath: string;
  children: CategoryNode[];
}

export interface SingleCatalogFormData {
  categoryId: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  mrp: number | null;
  stock: number;
  minOrderQty: number;
  orderQtyStep: number;
  lowStockThreshold: number;
  warrantyMonths: number;
  description: string;
  shortDescription: string;
  specs: { key: string; val: string }[];
  images: string[];
  keywords?: string[];
  isUrbanrat: boolean;
  isFeatured: boolean;
  isTrending: boolean;
  isActive: boolean;
  tiers: { min_qty: number; unit_price: number }[];
}

export interface BulkCatalogParsedRow {
  rowNumber: number;
  name: string;
  slug: string;
  sku: string;
  suggestedSku?: string;
  suggestedSlug?: string;
  price: number;
  mrp?: number | null;
  stock: number;
  minOrderQty: number;
  orderQtyStep: number;
  lowStockThreshold: number;
  warrantyMonths?: number;
  tagline?: string;
  description?: string;
  categoryName?: string;
  subcategoryName?: string;
  selectedPath?: string;
  brand?: string;
  attributes?: Record<string, any>;
  keywords?: string[];
  specs?: Record<string, any>;
  images: string[];
  tiers: { min_qty: number; unit_price: number }[];
  isUrbanrat: boolean;
  isFeatured: boolean;
  isTrending: boolean;
  isActive: boolean;
  isValid: boolean;
  errors: string[];
}

