export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export type CategoryAttributeType = "text" | "number" | "select" | "multiselect" | "boolean";

export interface CategoryAttribute {
  id: string;
  category_id: string;
  label: string;
  key: string;
  type: CategoryAttributeType;
  options: string[];
  required: boolean;
  apply_to_all_products: boolean;
  help_text?: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface InheritedCategoryAttribute extends CategoryAttribute {
  inherited_from_category_id: string;
  inherited_from_category_name: string;
}

export interface CategoryProductCounts {
  category_id: string | null;
  direct_count: number;
  total_count: number;
  active_count: number;
}

export interface CategoryNode extends Category {
  level: number;
  fullPath?: string;
  direct_count: number;
  total_count: number;
  active_count: number;
  children: CategoryNode[];
}

export interface ProductListFilters {
  categoryId?: string | null;
  categoryIds?: string[];
  includeDescendants?: boolean;
  uncategorizedOnly?: boolean;
  search?: string;
  isUrbanrat?: boolean;
  lowStock?: boolean;
  status?: "all" | "active" | "inactive";
  sort?:
    | "updated_at_desc"
    | "name_asc"
    | "name_desc"
    | "price_asc"
    | "price_desc"
    | "stock_asc"
    | "stock_desc";
  page?: number;
  pageSize?: number;
}
