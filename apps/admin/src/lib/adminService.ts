import { supabase } from "./supabase";
import * as XLSX from "xlsx";
import type {
  Product,
  Order,
  OrderStatus,
  CustomerLifetimeStats,
  OrderNoticeCounts,
  OrderEvent,
  PriceTier,
  StorePage,
  Banner,
  StoreSettings,
  Category,
  CategoryProductCounts,
  ProductListFilters,
  CategoryAttribute,
  InheritedCategoryAttribute,
  ReturnRequest,
  ReturnStats,
  ProductReturnPerformance,
  AdminUpdateReturnStatusInput,
  AdminUpdateReturnClaimInput,
  CatalogImage,
  BulkOperationRecord,
  BulkProductPatch,
  BulkTierMode,
  BulkTierPayload,
  BulkStockMode,
  BulkStockItemPayload,
  BulkImageMode,
  BulkOpResult,
} from "@urbanrat/shared";
import {
  sanitizeFileName,
  parseSkuFromFilename,
  computeTierAdjustment,
  computeTiersFromBase,
  validateTiers,
  computeStockResult,
  computeImageUpdate,
} from "@urbanrat/shared";
import { compressImage, type CompressionResult } from "../utils/imageCompressor";

export interface DashboardStats {
  current: {
    revenue: number;
    order_count: number;
    avg_order_value: number;
    pending_count: number;
    low_stock_count: number;
    new_customers: number;
  };
  previous: {
    revenue: number;
    order_count: number;
    avg_order_value: number;
    pending_count: number;
    low_stock_count: number;
    new_customers: number;
  };
  period: {
    from: string;
    to: string;
    prev_from: string;
    prev_to: string;
    days: number;
  };
}

export interface DailySale {
  sale_date: string;
  revenue: number;
  order_count: number;
}

export interface StatusDistribution {
  status: string;
  order_count: number;
  total_amount: number;
}

export interface TopProduct {
  product_id: string;
  name: string;
  total_quantity: number;
  total_revenue: number;
  image: string | null;
}

export type { OrderEvent };

// ----------------------------------------------------------------------------
// 1. DASHBOARD RPC SERVICES
// ----------------------------------------------------------------------------

export async function fetchDashboardStats(
  fromDate: string,
  toDate: string
): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("admin_dashboard_stats", {
    p_from: fromDate,
    p_to: toDate,
  });

  if (error) throw error;
  return data as DashboardStats;
}

export async function fetchSalesByDay(
  fromDate: string,
  toDate: string
): Promise<DailySale[]> {
  const { data, error } = await supabase.rpc("admin_sales_by_day", {
    p_from: fromDate,
    p_to: toDate,
  });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    sale_date: row.sale_date,
    revenue: Number(row.revenue) || 0,
    order_count: Number(row.order_count) || 0,
  }));
}

export async function fetchOrdersByStatus(
  fromDate: string,
  toDate: string
): Promise<StatusDistribution[]> {
  const { data, error } = await supabase.rpc("admin_orders_by_status", {
    p_from: fromDate,
    p_to: toDate,
  });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    status: row.status,
    order_count: Number(row.order_count) || 0,
    total_amount: Number(row.total_amount) || 0,
  }));
}

export async function fetchTopProducts(
  fromDate: string,
  toDate: string,
  limit: number = 5
): Promise<TopProduct[]> {
  const { data, error } = await supabase.rpc("admin_top_products", {
    p_from: fromDate,
    p_to: toDate,
    p_limit: limit,
  });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    product_id: row.product_id,
    name: row.name,
    total_quantity: Number(row.total_quantity) || 0,
    total_revenue: Number(row.total_revenue) || 0,
    image: row.image,
  }));
}

// ----------------------------------------------------------------------------
// 2. PRODUCT SERVICES (Strict RPC writes for Stock and Tiers)
// ----------------------------------------------------------------------------

export async function fetchAdminProducts(options?: {
  search?: string;
  categoryId?: string;
  isUrbanrat?: boolean;
  lowStock?: boolean;
}): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("*, price_tiers:product_price_tiers(*)")
    .order("created_at", { ascending: false });

  if (options?.search?.trim()) {
    query = query.ilike("name", `%${options.search.trim()}%`);
  }

  if (options?.categoryId) {
    query = query.eq("category_id", options.categoryId);
  }

  if (options?.isUrbanrat !== undefined) {
    query = query.eq("is_urbanrat_brand", options.isUrbanrat);
  }

  const { data, error } = await query;
  if (error) throw error;

  let products = (data || []).map((p: any) => ({
    ...p,
    price_tiers: (p.price_tiers || []).sort(
      (a: PriceTier, b: PriceTier) => a.min_qty - b.min_qty
    ),
  })) as Product[];

  if (options?.lowStock) {
    products = products.filter(
      (p) => p.stock <= (p.low_stock_threshold || 5)
    );
  }

  return products;
}

export interface ProductsPageResult {
  products: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchCategoryCounts(): Promise<{
  countsMap: Record<string, CategoryProductCounts>;
  uncategorized: CategoryProductCounts;
  allCounts: CategoryProductCounts[];
}> {
  try {
    const { data, error } = await supabase.rpc("admin_category_product_counts");
    if (error) throw error;

    const list = (data || []) as CategoryProductCounts[];
    const countsMap: Record<string, CategoryProductCounts> = {};
    let uncategorized: CategoryProductCounts = {
      category_id: null,
      direct_count: 0,
      total_count: 0,
      active_count: 0,
    };

    for (const item of list) {
      if (item.category_id) {
        countsMap[item.category_id] = {
          category_id: item.category_id,
          direct_count: Number(item.direct_count || 0),
          total_count: Number(item.total_count || 0),
          active_count: Number(item.active_count || 0),
        };
      } else {
        uncategorized = {
          category_id: null,
          direct_count: Number(item.direct_count || 0),
          total_count: Number(item.total_count || 0),
          active_count: Number(item.active_count || 0),
        };
      }
    }

    return { countsMap, uncategorized, allCounts: list };
  } catch (err) {
    console.warn("admin_category_product_counts RPC failed or not deployed, falling back:", err);
    const { data: cats } = await supabase.from("categories").select("id");

    // Fetch all products across all pages in chunks to prevent PostgREST default 1,000-row limit truncation
    const prods: { id: string; category_id: string | null; is_active: boolean }[] = [];
    const CHUNK_SIZE = 1000;
    let from = 0;
    while (true) {
      const { data: chunk, error: chunkErr } = await supabase
        .from("products")
        .select("id, category_id, is_active")
        .range(from, from + CHUNK_SIZE - 1);
      if (chunkErr || !chunk || chunk.length === 0) break;
      prods.push(...chunk);
      if (chunk.length < CHUNK_SIZE) break;
      from += CHUNK_SIZE;
    }

    const validCatIds = new Set((cats || []).map((c) => c.id));
    const countsMap: Record<string, CategoryProductCounts> = {};

    // Initialize all existing categories with 0 counts
    if (cats) {
      for (const c of cats) {
        countsMap[c.id] = {
          category_id: c.id,
          direct_count: 0,
          total_count: 0,
          active_count: 0,
        };
      }
    }

    let uncategorizedCount = 0;
    let uncategorizedActive = 0;

    if (prods) {
      for (const p of prods) {
        if (!p.category_id || !validCatIds.has(p.category_id)) {
          uncategorizedCount++;
          if (p.is_active) uncategorizedActive++;
        } else {
          const cId = p.category_id;
          if (!countsMap[cId]) {
            countsMap[cId] = {
              category_id: cId,
              direct_count: 0,
              total_count: 0,
              active_count: 0,
            };
          }
          const item = countsMap[cId]!;
          item.direct_count++;
          item.total_count++;
          if (p.is_active) item.active_count++;
        }
      }
    }

    const uncategorized: CategoryProductCounts = {
      category_id: null,
      direct_count: uncategorizedCount,
      total_count: uncategorizedCount,
      active_count: uncategorizedActive,
    };

    return { countsMap, uncategorized, allCounts: Object.values(countsMap).concat(uncategorized) };
  }
}

export async function fetchProductsPage(
  filters: ProductListFilters = {}
): Promise<ProductsPageResult> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, filters.pageSize || 25);
  const offset = (page - 1) * pageSize;

  try {
    const { data, error } = await supabase.rpc("admin_list_products", {
      p_category_id: filters.categoryId || null,
      p_include_descendants: filters.includeDescendants !== false,
      p_uncategorized_only: Boolean(filters.uncategorizedOnly),
      p_search: filters.search?.trim() || null,
      p_urbanrat_only: Boolean(filters.isUrbanrat),
      p_low_stock_only: Boolean(filters.lowStock),
      p_status: filters.status || "all",
      p_sort: filters.sort || "updated_at_desc",
      p_limit: pageSize,
      p_offset: offset,
    });

    if (error) throw error;

    const rows = (data || []) as any[];
    const totalCount = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const products = rows.map((p) => ({
      ...p,
      price_tiers: Array.isArray(p.price_tiers)
        ? p.price_tiers.sort((a: PriceTier, b: PriceTier) => a.min_qty - b.min_qty)
        : [],
    })) as Product[];

    return {
      products,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  } catch (err) {
    console.warn("admin_list_products RPC failed, falling back to direct table query:", err);
    let query = supabase
      .from("products")
      .select("*, price_tiers:product_price_tiers(*)", { count: "exact" });

    if (filters.uncategorizedOnly) {
      query = query.is("category_id", null);
    } else if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId);
    }

    if (filters.search?.trim()) {
      query = query.ilike("name", `%${filters.search.trim()}%`);
    }

    if (filters.isUrbanrat !== undefined) {
      query = query.eq("is_urbanrat_brand", filters.isUrbanrat);
    }

    if (filters.status === "active") {
      query = query.eq("is_active", true);
    } else if (filters.status === "inactive") {
      query = query.eq("is_active", false);
    }

    if (filters.sort === "name_asc") query = query.order("name", { ascending: true });
    else if (filters.sort === "name_desc") query = query.order("name", { ascending: false });
    else if (filters.sort === "price_asc") query = query.order("price", { ascending: true });
    else if (filters.sort === "price_desc") query = query.order("price", { ascending: false });
    else if (filters.sort === "stock_asc") query = query.order("stock", { ascending: true });
    else if (filters.sort === "stock_desc") query = query.order("stock", { ascending: false });
    else query = query.order("updated_at", { ascending: false });

    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    let products = (data || []).map((p: any) => ({
      ...p,
      price_tiers: (p.price_tiers || []).sort(
        (a: PriceTier, b: PriceTier) => a.min_qty - b.min_qty
      ),
    })) as Product[];

    if (filters.lowStock) {
      products = products.filter((p) => p.stock <= (p.low_stock_threshold || 5));
    }

    const totalCount = count ?? products.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return {
      products,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }
}

export async function bulkMoveProducts(
  productIds: string[],
  categoryId: string | null
): Promise<number> {
  if (!productIds || productIds.length === 0) return 0;

  try {
    const { data, error } = await supabase.rpc("admin_bulk_move_products", {
      p_product_ids: productIds,
      p_category_id: categoryId,
    });
    if (error) throw error;
    return typeof data === "number" ? data : productIds.length;
  } catch (err) {
    console.warn("admin_bulk_move_products RPC error, falling back to update:", err);
    const { error } = await supabase
      .from("products")
      .update({ category_id: categoryId, updated_at: new Date().toISOString() })
      .in("id", productIds);
    if (error) throw error;
    return productIds.length;
  }
}

export async function bulkUpdateProductStatus(
  productIds: string[],
  isActive: boolean
): Promise<number> {
  if (!productIds || productIds.length === 0) return 0;

  try {
    const { data, error } = await supabase.rpc("admin_bulk_update_product_status", {
      p_product_ids: productIds,
      p_is_active: isActive,
    });
    if (error) throw error;
    return typeof data === "number" ? data : productIds.length;
  } catch (err) {
    console.warn("admin_bulk_update_product_status RPC error, falling back to update:", err);
    const { error } = await supabase
      .from("products")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .in("id", productIds);
    if (error) throw error;
    return productIds.length;
  }
}

// ----------------------------------------------------------------------------
// BULK OPERATIONS WRAPPERS (Details, Tiers, Stock, Images, Filter, Undo)
// ----------------------------------------------------------------------------

export async function fetchProductIdsForFilter(
  filters: ProductListFilters = {},
  limit: number = 5000
): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc("admin_list_product_ids", {
      p_filters: filters,
      p_limit: limit,
    });
    if (error) throw error;
    return (data || []).map((row: any) => row.product_id);
  } catch (err) {
    console.warn("admin_list_product_ids RPC error, falling back to query:", err);
    let query = supabase.from("products").select("id").limit(limit);

    if (filters.uncategorizedOnly) {
      query = query.is("category_id", null);
    } else if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId);
    }
    if (filters.isUrbanrat) {
      query = query.eq("is_urbanrat_brand", true);
    }
    if (filters.status === "active") {
      query = query.eq("is_active", true);
    } else if (filters.status === "inactive") {
      query = query.eq("is_active", false);
    }
    if (filters.search) {
      query = query.ilike("name", `%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any) => row.id);
  }
}

export async function bulkUpdateProducts(
  productIds: string[],
  patch: BulkProductPatch,
  dryRun: boolean = false
): Promise<BulkOpResult> {
  try {
    const { data, error } = await supabase.rpc("admin_bulk_update_products", {
      p_product_ids: productIds,
      p_patch: patch,
      p_dry_run: dryRun,
    });
    if (error) throw error;
    return data as BulkOpResult;
  } catch (rpcErr) {
    console.warn("admin_bulk_update_products RPC unavailable, running client fallback:", rpcErr);
    const { data: prods, error: pErr } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);

    if (pErr) throw pErr;

    const items: any[] = [];
    let affectedCount = 0;

    for (const prod of (prods || [])) {
      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      const errors: string[] = [];

      if (patch.category_id !== undefined) {
        before.category_id = prod.category_id;
        after.category_id = patch.category_id;
        updateData.category_id = patch.category_id;
      }
      if (patch.brand !== undefined) {
        before.brand = prod.brand;
        after.brand = patch.brand;
        updateData.brand = patch.brand;
      }
      if (patch.tagline !== undefined) {
        before.tagline = prod.short_tagline;
        after.tagline = patch.tagline;
        updateData.short_tagline = patch.tagline;
      }
      if (patch.description !== undefined) {
        before.description = prod.description;
        let finalDesc = patch.description;
        if (typeof patch.description === "string" && patch.description.startsWith("__APPEND__")) {
          const appendText = patch.description.replace("__APPEND__", "");
          finalDesc = prod.description ? `${prod.description}\n${appendText}` : appendText;
        }
        after.description = finalDesc;
        updateData.description = finalDesc;
      }
      if (patch.warranty_months !== undefined) {
        before.warranty_months = prod.warranty_months;
        after.warranty_months = patch.warranty_months;
        updateData.warranty_months = patch.warranty_months;
      }
      if (patch.mrp !== undefined) {
        before.mrp = prod.mrp;
        let calculatedMrp = prod.mrp;
        if (typeof patch.mrp === "number") {
          calculatedMrp = patch.mrp;
        } else if (typeof patch.mrp === "object") {
          const { mode, value } = patch.mrp;
          if (mode === "set") calculatedMrp = value;
          else if (mode === "increase_pct") calculatedMrp = Math.round((prod.mrp || prod.price) * (1 + value / 100) * 100) / 100;
          else if (mode === "decrease_pct") calculatedMrp = Math.max(0, Math.round((prod.mrp || prod.price) * (1 - value / 100) * 100) / 100);
          else if (mode === "increase_amt") calculatedMrp = (prod.mrp || prod.price) + value;
          else if (mode === "decrease_amt") calculatedMrp = Math.max(0, (prod.mrp || prod.price) - value);
        }
        if (calculatedMrp !== null && calculatedMrp < prod.price) {
          errors.push(`MRP (₹${calculatedMrp}) cannot be lower than price (₹${prod.price}).`);
        }
        after.mrp = calculatedMrp;
        updateData.mrp = calculatedMrp;
      }
      if (patch.moq !== undefined) {
        before.moq = prod.min_order_qty;
        after.moq = patch.moq;
        updateData.min_order_qty = patch.moq;
      }
      if (patch.order_step !== undefined) {
        before.order_step = prod.order_qty_step;
        after.order_step = patch.order_step;
        updateData.order_qty_step = patch.order_step;
      }
      if (patch.low_stock_threshold !== undefined) {
        before.low_stock_threshold = prod.low_stock_threshold;
        after.low_stock_threshold = patch.low_stock_threshold;
        updateData.low_stock_threshold = patch.low_stock_threshold;
      }
      if (patch.is_active !== undefined) {
        before.is_active = prod.is_active;
        after.is_active = patch.is_active;
        updateData.is_active = patch.is_active;
      }
      if (patch.is_featured !== undefined) {
        before.is_featured = prod.is_featured;
        after.is_featured = patch.is_featured;
        updateData.is_featured = patch.is_featured;
      }
      if (patch.is_trending !== undefined) {
        before.is_trending = prod.is_trending;
        after.is_trending = patch.is_trending;
        updateData.is_trending = patch.is_trending;
      }
      if (patch.is_urbanrat_brand !== undefined) {
        before.is_urbanrat_brand = prod.is_urbanrat_brand;
        after.is_urbanrat_brand = patch.is_urbanrat_brand;
        updateData.is_urbanrat_brand = patch.is_urbanrat_brand;
      }

      // Keywords handling
      if (patch.keywords_replace !== undefined) {
        before.keywords = prod.keywords;
        after.keywords = patch.keywords_replace;
        updateData.keywords = patch.keywords_replace;
      } else if (patch.keywords_add || patch.keywords_remove) {
        before.keywords = prod.keywords;
        let kwList = [...(prod.keywords || [])];
        if (patch.keywords_remove) {
          kwList = kwList.filter((k) => !patch.keywords_remove?.includes(k));
        }
        if (patch.keywords_add) {
          for (const k of patch.keywords_add) {
            if (!kwList.includes(k)) kwList.push(k);
          }
        }
        after.keywords = kwList;
        updateData.keywords = kwList;
      }

      if (errors.length === 0) {
        affectedCount++;
      }

      items.push({
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        before,
        after,
        errors: errors.length > 0 ? errors : undefined,
      });

      if (!dryRun && errors.length === 0) {
        await supabase.from("products").update(updateData).eq("id", prod.id);
      }
    }

    return {
      success: true,
      dry_run: dryRun,
      op_id: crypto.randomUUID(),
      affected_count: affectedCount,
      total_count: productIds.length,
      items,
    };
  }
}

export async function bulkSaveTiers(
  productIds: string[],
  mode: BulkTierMode,
  payload: BulkTierPayload,
  dryRun: boolean = false
): Promise<BulkOpResult> {
  try {
    const { data, error } = await supabase.rpc("admin_bulk_save_tiers", {
      p_product_ids: productIds,
      p_mode: mode,
      p_payload: payload,
      p_dry_run: dryRun,
    });
    if (error) throw error;
    return data as BulkOpResult;
  } catch (rpcErr) {
    console.warn("admin_bulk_save_tiers RPC unavailable, running client fallback:", rpcErr);

    const { data: prods, error: pErr } = await supabase
      .from("products")
      .select("id, name, sku, price, mrp, price_tiers:product_price_tiers(*)")
      .in("id", productIds);

    if (pErr) throw pErr;

    // If mode is copy_from, fetch source product tiers
    let copySourceTiers: Array<{ min_qty: number; price: number }> = [];
    if (mode === "copy_from" && typeof payload === "string") {
      const { data: src } = await supabase
        .from("product_price_tiers")
        .select("min_qty, unit_price")
        .eq("product_id", payload)
        .order("min_qty", { ascending: true });
      copySourceTiers = (src || []).map((t: any) => ({
        min_qty: t.min_qty,
        price: Number(t.unit_price),
      }));
    }

    const items: any[] = [];
    let affectedCount = 0;

    for (const prod of (prods || [])) {
      const currentTiers: Array<{ min_qty: number; price: number }> = (
        prod.price_tiers || []
      )
        .sort((a: any, b: any) => a.min_qty - b.min_qty)
        .map((t: any) => ({
          min_qty: t.min_qty,
          price: Number(t.unit_price),
        }));

      let newTiers: Array<{ min_qty: number; price: number }> = [];

      if (mode === "replace") {
        newTiers = (payload as Array<{ min_qty: number; price: number }>) || [];
      } else if (mode === "adjust") {
        newTiers = computeTierAdjustment(currentTiers, payload as any);
      } else if (mode === "from_base") {
        newTiers = computeTiersFromBase(prod.price, payload as any);
      } else if (mode === "copy_from") {
        newTiers = copySourceTiers;
      } else if (mode === "clear") {
        newTiers = [];
      }

      const val = validateTiers(newTiers, prod.mrp, prod.price);
      const hasErrors = val.errors.length > 0;

      if (!hasErrors) {
        affectedCount++;
      }

      items.push({
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        before: currentTiers,
        after: newTiers,
        errors: hasErrors ? val.errors : undefined,
        warnings: val.warnings.length > 0 ? val.warnings : undefined,
      });

      // Apply changes if not dry run
      if (!dryRun && !hasErrors) {
        await supabase
          .from("product_price_tiers")
          .delete()
          .eq("product_id", prod.id);

        if (newTiers.length > 0) {
          const insertPayload = newTiers.map((t) => ({
            product_id: prod.id,
            min_qty: t.min_qty,
            unit_price: t.price,
          }));
          await supabase.from("product_price_tiers").insert(insertPayload);
        }
      }
    }

    return {
      success: true,
      dry_run: dryRun,
      op_id: crypto.randomUUID(),
      affected_count: affectedCount,
      total_count: productIds.length,
      items,
    };
  }
}

export async function bulkAdjustStock(
  productIds: string[],
  mode: BulkStockMode | "sheet",
  qty: number,
  reason: string,
  dryRun: boolean = false,
  sheetItems?: BulkStockItemPayload[]
): Promise<BulkOpResult> {
  // If not sheet mode and RPC is available, attempt RPC first
  if (mode !== "sheet") {
    try {
      const { data, error } = await supabase.rpc("admin_bulk_adjust_stock", {
        p_product_ids: productIds,
        p_mode: mode,
        p_qty: qty,
        p_reason: reason,
        p_dry_run: dryRun,
      });
      if (error) throw error;
      return data as BulkOpResult;
    } catch (rpcErr) {
      console.warn("admin_bulk_adjust_stock RPC unavailable, running client fallback:", rpcErr);
    }
  }

  // Client Fallback (and sheet handling)
  const { data: prods, error: pErr } = await supabase
    .from("products")
    .select("id, name, sku, stock, low_stock_threshold")
    .in("id", productIds);

  if (pErr) throw pErr;

  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id || null;
  const opId = crypto.randomUUID();

  const items: any[] = [];
  const beforeSnapshot: any[] = [];
  let affectedCount = 0;

  const sheetItemMap = new Map<string, BulkStockItemPayload>();
  if (sheetItems) {
    for (const item of sheetItems) {
      sheetItemMap.set(item.product_id, item);
    }
  }

  for (const prod of (prods || [])) {
    const errors: string[] = [];
    const warnings: string[] = [];
    let newStock = prod.stock;
    let change = 0;
    let finalReason = reason;

    if (mode === "sheet" || sheetItemMap.has(prod.id)) {
      const item = sheetItemMap.get(prod.id);
      if (!item) {
        errors.push("No update data for this product in uploaded sheet.");
      } else {
        finalReason = item.reason?.trim() || reason;
        if (item.mode === "delta") {
          newStock = prod.stock + item.qty;
          change = item.qty;
        } else if (item.mode === "set") {
          newStock = item.qty;
          change = newStock - prod.stock;
        } else {
          const comp = computeStockResult(prod.stock, item.mode as BulkStockMode, item.qty);
          newStock = comp.newStock;
          change = comp.change;
          if (!comp.isValid && comp.error) errors.push(comp.error);
        }
      }
    } else {
      const comp = computeStockResult(prod.stock, mode as BulkStockMode, qty);
      newStock = comp.newStock;
      change = comp.change;
      if (!comp.isValid && comp.error) {
        errors.push(comp.error);
      }
    }

    if (newStock < 0) {
      errors.push(`Stock cannot drop below 0 (current: ${prod.stock}, change: ${change}).`);
    }

    const threshold = prod.low_stock_threshold ?? 5;
    if (newStock <= threshold && newStock >= 0) {
      warnings.push(`Stock (${newStock}) is at or below low stock threshold (${threshold}).`);
    }

    const isValid = errors.length === 0;
    if (isValid) {
      affectedCount++;
      beforeSnapshot.push({
        product_id: prod.id,
        previous_stock: prod.stock,
        new_stock: newStock,
        change,
      });

      if (!dryRun) {
        await supabase
          .from("products")
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq("id", prod.id);

        await supabase.from("stock_movements").insert({
          product_id: prod.id,
          change,
          reason: `${finalReason} [Bulk Op: ${opId}]`,
          admin_id: userId,
        });
      }
    }

    items.push({
      product_id: prod.id,
      product_name: prod.name,
      sku: prod.sku,
      before: { stock: prod.stock },
      after: { stock: newStock, change },
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  if (!dryRun && affectedCount > 0) {
    try {
      await supabase.from("bulk_operations").insert({
        id: opId,
        op_type: "stock",
        params: { mode, qty, reason },
        product_ids: productIds,
        before_snapshot: beforeSnapshot,
        affected_count: affectedCount,
        status: "applied",
        created_by: userId,
      });
    } catch (opErr) {
      console.warn("Could not insert bulk_operations record:", opErr);
    }
  }

  return {
    success: true,
    dry_run: dryRun,
    op_id: !dryRun ? opId : undefined,
    total_count: productIds.length,
    affected_count: affectedCount,
    items,
  };
}

export async function bulkUpdateImages(
  productIds: string[],
  mode: BulkImageMode,
  urls: string[] = [],
  dryRun: boolean = false
): Promise<BulkOpResult> {
  try {
    const { data, error } = await supabase.rpc("admin_bulk_update_images", {
      p_product_ids: productIds,
      p_mode: mode,
      p_urls: urls,
      p_dry_run: dryRun,
    });
    if (error) throw error;
    return data as BulkOpResult;
  } catch (rpcErr) {
    console.warn("admin_bulk_update_images RPC unavailable, running client fallback:", rpcErr);

    const { data: prods, error: pErr } = await supabase
      .from("products")
      .select("id, name, sku, images")
      .in("id", productIds);

    if (pErr) throw pErr;

    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id || null;
    const opId = crypto.randomUUID();

    const items: any[] = [];
    const beforeSnapshot: any[] = [];
    let affectedCount = 0;

    for (const prod of (prods || [])) {
      const currentImages = prod.images || [];
      const comp = computeImageUpdate(currentImages, mode, urls);
      const errors: string[] = comp.error ? [comp.error] : [];

      if (errors.length === 0) {
        affectedCount++;
        beforeSnapshot.push({
          product_id: prod.id,
          images: currentImages,
        });

        if (!dryRun) {
          await supabase
            .from("products")
            .update({ images: comp.newImages, updated_at: new Date().toISOString() })
            .eq("id", prod.id);
        }
      }

      items.push({
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        before: { images: currentImages },
        after: { images: comp.newImages },
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    if (!dryRun && affectedCount > 0) {
      try {
        await supabase.from("bulk_operations").insert({
          id: opId,
          op_type: "images",
          params: { mode, urls },
          product_ids: productIds,
          before_snapshot: beforeSnapshot,
          affected_count: affectedCount,
          status: "applied",
          created_by: userId,
        });
      } catch (opErr) {
        console.warn("Could not insert bulk_operations record:", opErr);
      }
    }

    return {
      success: true,
      dry_run: dryRun,
      op_id: !dryRun ? opId : undefined,
      total_count: productIds.length,
      affected_count: affectedCount,
      items,
    };
  }
}

export async function previewUndoBulkOperation(op: BulkOperationRecord): Promise<{
  canUndo: boolean;
  unrestorableCount: number;
  unrestorableItems: Array<{
    product_id: string;
    product_name?: string;
    sku?: string;
    reason: string;
  }>;
  items: Array<{
    product_id: string;
    product_name: string;
    sku?: string;
    before: any;
    after: any;
  }>;
}> {
  const unrestorableItems: Array<{
    product_id: string;
    product_name?: string;
    sku?: string;
    reason: string;
  }> = [];

  const { data: prods } = await supabase
    .from("products")
    .select("id, name, sku, stock, images")
    .in("id", op.product_ids);

  const prodMap = new Map((prods || []).map((p) => [p.id, p]));
  const previewItems: any[] = [];

  for (const snapshotItem of op.before_snapshot || []) {
    const prodId = snapshotItem.product_id;
    const prod = prodMap.get(prodId);

    if (!prod) {
      unrestorableItems.push({
        product_id: prodId,
        reason: "Product was deleted and cannot be restored.",
      });
      continue;
    }

    if (op.op_type === "stock") {
      // Check subsequent stock movements
      const { data: movements } = await supabase
        .from("stock_movements")
        .select("id")
        .eq("product_id", prodId)
        .gt("created_at", op.created_at)
        .limit(1);

      if (movements && movements.length > 0) {
        unrestorableItems.push({
          product_id: prodId,
          product_name: prod.name,
          sku: prod.sku,
          reason: "Stock was modified by another operation after this one.",
        });
      }

      previewItems.push({
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        before: { stock: prod.stock },
        after: { stock: snapshotItem.previous_stock },
      });
    } else if (op.op_type === "images") {
      previewItems.push({
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        before: { images: prod.images || [] },
        after: { images: snapshotItem.images || [] },
      });
    } else if (op.op_type === "tiers") {
      previewItems.push({
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        before: "Current Tiers",
        after: snapshotItem.tiers || [],
      });
    } else {
      // details
      previewItems.push({
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        before: "Current Attributes",
        after: snapshotItem.before || snapshotItem,
      });
    }
  }

  return {
    canUndo: unrestorableItems.length === 0,
    unrestorableCount: unrestorableItems.length,
    unrestorableItems,
    items: previewItems,
  };
}

export async function undoBulkOperation(
  opId: string
): Promise<{ success: boolean; undone_count: number; op_id: string; status: string }> {
  try {
    const { data, error } = await supabase.rpc("admin_undo_bulk_operation", {
      p_op_id: opId,
    });
    if (error) throw error;
    return data;
  } catch (rpcErr) {
    console.warn("admin_undo_bulk_operation RPC failed, running client fallback:", rpcErr);

    const { data: op, error: opErr } = await supabase
      .from("bulk_operations")
      .select("*")
      .eq("id", opId)
      .single();

    if (opErr || !op) throw opErr || new Error("Operation not found");
    if (op.status !== "applied") throw new Error(`Operation status is ${op.status}, must be applied`);

    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id || null;
    let undoneCount = 0;

    for (const snap of op.before_snapshot || []) {
      const prodId = snap.product_id;
      if (op.op_type === "stock") {
        await supabase
          .from("products")
          .update({ stock: snap.previous_stock, updated_at: new Date().toISOString() })
          .eq("id", prodId);

        await supabase.from("stock_movements").insert({
          product_id: prodId,
          change: -snap.change,
          reason: `Undo bulk stock adjustment [Op: ${opId}]`,
          admin_id: userId,
        });
        undoneCount++;
      } else if (op.op_type === "images") {
        await supabase
          .from("products")
          .update({ images: snap.images, updated_at: new Date().toISOString() })
          .eq("id", prodId);
        undoneCount++;
      } else if (op.op_type === "tiers") {
        await supabase.from("product_price_tiers").delete().eq("product_id", prodId);
        if (snap.tiers && snap.tiers.length > 0) {
          const insertRows = snap.tiers.map((t: any) => ({
            product_id: prodId,
            min_qty: t.min_qty,
            unit_price: t.unit_price || t.price,
          }));
          await supabase.from("product_price_tiers").insert(insertRows);
        }
        undoneCount++;
      } else if (op.op_type === "details") {
        const patchData = snap.before || snap;
        const cleanPatch = { ...patchData };
        delete cleanPatch.product_id;
        delete cleanPatch.id;
        cleanPatch.updated_at = new Date().toISOString();
        await supabase.from("products").update(cleanPatch).eq("id", prodId);
        undoneCount++;
      }
    }

    await supabase
      .from("bulk_operations")
      .update({ status: "undone", undone_at: new Date().toISOString() })
      .eq("id", opId);

    return {
      success: true,
      undone_count: undoneCount,
      op_id: opId,
      status: "undone",
    };
  }
}

export async function listBulkOperations(
  limit: number = 20
): Promise<BulkOperationRecord[]> {
  const { data, error } = await supabase
    .from("bulk_operations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as BulkOperationRecord[];
}

export async function fetchAdminCategories(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Creates or updates non-stock, non-tier product metadata.
 * Price, stock, and tiers are synced through RPCs/triggers.
 */
let _supportsKeywordsColumn: boolean | null = null;
let _supportsBrandAndAttributes: boolean | null = null;

export async function saveProductMetadata(
  productData: Partial<Product> & { id?: string }
): Promise<Product> {
  const isNew = !productData.id;

  const payload: any = {
    name: productData.name,
    slug: productData.slug,
    sku: productData.sku || null,
    category_id: productData.category_id || null,
    mrp: productData.mrp ?? null,
    images: productData.images || [],
    description: productData.description || "",
    short_description: productData.short_description || "",
    specs: productData.specs || {},
    warranty_months: productData.warranty_months !== undefined ? productData.warranty_months : 0,
    tags: productData.tags || [],
    is_urbanrat_brand: productData.is_urbanrat_brand !== undefined ? Boolean(productData.is_urbanrat_brand) : true,
    is_featured: Boolean(productData.is_featured),
    is_trending: Boolean(productData.is_trending),
    is_active: productData.is_active !== undefined ? Boolean(productData.is_active) : true,
    low_stock_threshold: productData.low_stock_threshold !== undefined ? productData.low_stock_threshold : 5,
    min_order_qty: productData.min_order_qty !== undefined ? productData.min_order_qty : 1,
    order_qty_step: productData.order_qty_step !== undefined ? productData.order_qty_step : 1,
    updated_at: new Date().toISOString(),
  };

  if (_supportsBrandAndAttributes !== false) {
    if (productData.brand !== undefined) payload.brand = productData.brand || null;
    if (productData.attributes !== undefined) payload.attributes = productData.attributes || {};
  }

  // Only attach keywords if the schema supports it or hasn't been tested yet
  if (_supportsKeywordsColumn !== false) {
    payload.keywords = productData.keywords || [];
  }

  if (isNew) {
    // When creating product, provide initial price and stock
    payload.price = productData.price !== undefined ? productData.price : 0;
    payload.stock = productData.stock !== undefined ? productData.stock : 0;

    let { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();

    // If keywords/brand/attributes columns are not yet migrated in Supabase, retry without them
    if (error && (error.message?.includes("brand") || error.message?.includes("attributes") || (error as any).details?.includes("brand") || (error as any).details?.includes("attributes"))) {
      _supportsBrandAndAttributes = false;
      const fallbackPayload = { ...payload };
      delete fallbackPayload.brand;
      delete fallbackPayload.attributes;
      const retry = await supabase
        .from("products")
        .insert(fallbackPayload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error && (error.message?.includes("'keywords'") || (error as any).details?.includes("keywords"))) {
      _supportsKeywordsColumn = false;
      const fallbackPayload = { ...payload };
      delete fallbackPayload.keywords;
      delete fallbackPayload.brand;
      delete fallbackPayload.attributes;
      const retry = await supabase
        .from("products")
        .insert(fallbackPayload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    } else if (!error) {
      if (_supportsKeywordsColumn === null) _supportsKeywordsColumn = true;
      if (_supportsBrandAndAttributes === null) _supportsBrandAndAttributes = true;
    }

    if (error) throw error;

    // Log opening stock movement if stock was provided
    if (data?.id && (data.stock > 0 || (payload.stock && payload.stock > 0))) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        await supabase.from("stock_movements").insert({
          product_id: data.id,
          change: data.stock || payload.stock,
          reason: "Opening inventory batch upload",
          admin_id: authData?.user?.id || null,
        });
      } catch (smErr) {
        console.warn("Could not insert opening stock movement:", smErr);
      }
    }

    return data as Product;
  } else {
    // When updating, also update price and stock if explicitly passed
    if (productData.price !== undefined) payload.price = productData.price;
    if (productData.stock !== undefined) payload.stock = productData.stock;

    let { data, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", productData.id!)
      .select()
      .single();

    // If brand or attributes columns are missing, retry without them
    if (error && (error.message?.includes("brand") || error.message?.includes("attributes") || (error as any).details?.includes("brand") || (error as any).details?.includes("attributes"))) {
      _supportsBrandAndAttributes = false;
      const fallbackPayload = { ...payload };
      delete fallbackPayload.brand;
      delete fallbackPayload.attributes;
      const retry = await supabase
        .from("products")
        .update(fallbackPayload)
        .eq("id", productData.id!)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    // If keywords column is not yet migrated in Supabase, retry without keywords
    if (error && (error.message?.includes("'keywords'") || (error as any).details?.includes("keywords"))) {
      _supportsKeywordsColumn = false;
      const fallbackPayload = { ...payload };
      delete fallbackPayload.keywords;
      delete fallbackPayload.brand;
      delete fallbackPayload.attributes;
      const retry = await supabase
        .from("products")
        .update(fallbackPayload)
        .eq("id", productData.id!)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    } else if (!error) {
      if (_supportsKeywordsColumn === null) _supportsKeywordsColumn = true;
      if (_supportsBrandAndAttributes === null) _supportsBrandAndAttributes = true;
    }

    if (error) throw error;
    return data as Product;
  }
}

/**
 * Deletes a product by ID.
 * If product cannot be hard-deleted due to foreign key restrictions (e.g. historical return items),
 * it gracefully soft-deactivates the product so it is removed from catalog & inventory.
 */
export async function deleteProduct(productId: string): Promise<{ success: boolean; softDeleted?: boolean }> {
  // 1. Clean up product price tiers first
  try {
    await supabase.from("product_price_tiers").delete().eq("product_id", productId);
  } catch (tierErr) {
    console.warn("Clean up price tiers warning:", tierErr);
  }

  // 2. Delete product from database
  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) {
    // If foreign key constraint exists (e.g. returns or order history references product_id)
    if (error.code === "23503" || error.message?.includes("foreign key") || error.message?.includes("violates")) {
      const { error: updateErr } = await supabase
        .from("products")
        .update({ is_active: false, stock: 0 })
        .eq("id", productId);
      if (updateErr) throw updateErr;
      return { success: true, softDeleted: true };
    }
    throw error;
  }

  return { success: true, softDeleted: false };
}

/**
 * Bulk deletes multiple products by ID.
 */
export async function deleteProducts(
  productIds: string[]
): Promise<{ deletedIds: string[]; failedIds: string[]; errors: string[] }> {
  const deletedIds: string[] = [];
  const failedIds: string[] = [];
  const errors: string[] = [];

  for (const id of productIds) {
    try {
      await deleteProduct(id);
      deletedIds.push(id);
    } catch (err: any) {
      failedIds.push(id);
      errors.push(err.message || `Failed to delete product ${id}`);
    }
  }

  return { deletedIds, failedIds, errors };
}

/**
 * Stock edits MUST go strictly through admin_adjust_stock RPC
 */
export async function adminAdjustStock(
  productId: string,
  change: number,
  reason: string
): Promise<any> {
  const { data, error } = await supabase.rpc("admin_adjust_stock", {
    p_product_id: productId,
    p_change: change,
    p_reason: reason,
  });

  if (error) throw error;
  return data;
}

/**
 * Bulk updates stock for multiple products.
 * Mode: "set" (sets all selected products to exact stock value)
 *       "adjust" (adds or subtracts delta from current stock)
 */
export async function adminBulkUpdateStock(params: {
  productIds: string[];
  mode: "set" | "adjust";
  value: number;
  reason: string;
}): Promise<{ updatedCount: number; errors: string[] }> {
  const { productIds, mode, value, reason } = params;
  let updatedCount = 0;
  const errors: string[] = [];

  for (const id of productIds) {
    try {
      if (mode === "adjust") {
        if (value !== 0) {
          await adminAdjustStock(id, value, reason || "Bulk stock adjustment");
        }
      } else {
        const newStock = Math.max(0, Math.round(value));
        const { error: updateErr } = await supabase
          .from("products")
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (updateErr) throw updateErr;

        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from("stock_movements").insert({
            product_id: id,
            change: 0,
            reason: `${reason || "Bulk stock update"} (Set to ${newStock})`,
            admin_id: user?.id || null,
          });
        } catch {
          // ignore audit movement log error
        }
      }
      updatedCount++;
    } catch (err: any) {
      errors.push(err.message || `Failed to update product ${id}`);
    }
  }

  return { updatedCount, errors };
}

/**
 * Tier saves MUST go strictly through admin_save_product_tiers RPC
 */
export async function adminSaveProductTiers(
  productId: string,
  tiers: { min_qty: number; unit_price: number }[]
): Promise<any> {
  const { data, error } = await supabase.rpc("admin_save_product_tiers", {
    p_product_id: productId,
    p_tiers: tiers,
  });

  if (error) throw error;
  return data;
}

/**
 * Compresses and uploads image directly to 'product-images' storage bucket.
 * Automatically resizes & converts to high-performance WebP for fast mobile storefront loading.
 */
export async function uploadProductImage(
  file: File,
  onCompressed?: (result: CompressionResult) => void
): Promise<string> {
  const compResult = await compressImage(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.84,
  });

  onCompressed?.(compResult);

  const fileToUpload = compResult.file;
  const ext = fileToUpload.name.split(".").pop() || "webp";
  const uniqueName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(uniqueName, fileToUpload, {
      cacheControl: "31536000",
      contentType: fileToUpload.type || "image/webp",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(uniqueName);

  return data.publicUrl;
}

/**
 * Compresses and uploads banner image directly to 'banners' (or 'product-images') storage bucket.
 * Automatically resizes & converts to high-performance WebP for instant hero rendering.
 */
export async function uploadBannerImage(
  file: File,
  onCompressed?: (result: CompressionResult) => void
): Promise<string> {
  const compResult = await compressImage(file, {
    maxWidth: 1920,
    maxHeight: 1600,
    quality: 0.84,
  });

  onCompressed?.(compResult);

  const fileToUpload = compResult.file;
  const ext = fileToUpload.name.split(".").pop() || "webp";
  const uniqueName = `banner_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

  // Try banners bucket first
  const { error: uploadError } = await supabase.storage
    .from("banners")
    .upload(uniqueName, fileToUpload, {
      cacheControl: "31536000",
      contentType: fileToUpload.type || "image/webp",
      upsert: false,
    });

  let bucket = "banners";
  if (uploadError) {
    console.warn("Upload to banners failed, trying product-images bucket:", uploadError);
    const { error: fallbackError } = await supabase.storage
      .from("product-images")
      .upload(uniqueName, fileToUpload, {
        cacheControl: "31536000",
        contentType: fileToUpload.type || "image/webp",
        upsert: false,
      });
    if (fallbackError) throw uploadError;
    bucket = "product-images";
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(uniqueName);

  return data.publicUrl;
}

// ----------------------------------------------------------------------------
// 3. ORDER SERVICES (Seller Hub Strict RPC write & Analytics)
// ----------------------------------------------------------------------------

export async function fetchAdminOrders(options?: {
  status?: string;
  search?: string;
  source?: string;
  paymentStatus?: string;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Order[]> {
  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (options?.status && options.status !== "all") {
    if (options.status === "ready_to_ship") {
      query = query.in("status", ["confirmed", "processing"]);
    } else if (options.status === "cancelled") {
      query = query.in("status", ["cancelled", "refunded"]);
    } else {
      query = query.eq("status", options.status);
    }
  }

  if (options?.source && options.source !== "all") {
    query = query.eq("source", options.source);
  }

  if (options?.paymentStatus && options.paymentStatus !== "all") {
    query = query.eq("payment_status", options.paymentStatus);
  }

  if (options?.search?.trim()) {
    const s = options.search.trim();
    query = query.or(
      `id.ilike.%${s}%,customer->>name.ilike.%${s}%,customer->>phone.ilike.%${s}%,customer->>business_name.ilike.%${s}%`
    );
  }

  // Date range filter
  if (options?.dateRange && options.dateRange !== "all") {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    switch (options.dateRange) {
      case "today":
        query = query.gte("created_at", startOfToday);
        break;
      case "yesterday":
        query = query.gte("created_at", startOfYesterday).lt("created_at", startOfToday);
        break;
      case "7_days":
        query = query.gte("created_at", sevenDaysAgo);
        break;
      case "30_days":
        query = query.gte("created_at", thirtyDaysAgo);
        break;
      case "this_month":
        query = query.gte("created_at", startOfMonth);
        break;
      case "custom":
        if (options.startDate) query = query.gte("created_at", options.startDate);
        if (options.endDate) query = query.lte("created_at", options.endDate);
        break;
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  const orders = (data as Order[]) || [];

  // In-memory SKU search check for line items if search term is provided
  if (options?.search?.trim()) {
    const s = options.search.trim().toLowerCase();
    return orders.filter((o) => {
      const idMatch = o.id.toLowerCase().includes(s);
      const nameMatch = (o.customer?.name || "").toLowerCase().includes(s);
      const phoneMatch = (o.customer?.phone || "").toLowerCase().includes(s);
      const bizMatch = (o.customer?.business_name || "").toLowerCase().includes(s);
      const skuMatch = (o.items || []).some(
        (i) => (i.sku || "").toLowerCase().includes(s) || (i.name || "").toLowerCase().includes(s)
      );
      return idMatch || nameMatch || phoneMatch || bizMatch || skuMatch;
    });
  }

  return orders;
}

export async function fetchAdminOrderCounts(): Promise<{
  all: number;
  pending: number;
  ready_to_ship: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  on_hold: number;
}> {
  const { data, error } = await supabase.from("orders").select("status");
  if (error) {
    console.error("Error fetching order counts:", error);
    return { all: 0, pending: 0, ready_to_ship: 0, shipped: 0, delivered: 0, cancelled: 0, on_hold: 0 };
  }

  const counts = {
    all: data?.length || 0,
    pending: 0,
    ready_to_ship: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    on_hold: 0,
  };

  for (const o of data || []) {
    const st = (o.status || "").toLowerCase();
    if (st === "pending") counts.pending++;
    else if (st === "confirmed" || st === "processing") counts.ready_to_ship++;
    else if (st === "shipped") counts.shipped++;
    else if (st === "delivered") counts.delivered++;
    else if (st === "cancelled" || st === "refunded") counts.cancelled++;
    else if (st === "on_hold") counts.on_hold++;
  }

  return counts;
}

export async function fetchOrderNoticeCounts(): Promise<OrderNoticeCounts> {
  try {
    const { data, error } = await supabase.rpc("admin_get_order_notice_counts");
    if (!error && data) {
      return data as OrderNoticeCounts;
    }
  } catch {
    // Graceful fallback below
  }

  try {
    const now = new Date();
    const yesterdayIso = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

    const [pendingOlderRes, lowStockRes, readyRes, onHoldRes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending").lt("created_at", yesterdayIso),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true).lte("stock", 10),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["confirmed", "processing"]),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "on_hold"),
    ]);

    return {
      delayed_pending_count: pendingOlderRes.count || 0,
      low_stock_count: lowStockRes.count || 0,
      ready_to_ship_count: readyRes.count || 0,
      on_hold_count: onHoldRes.count || 0,
    };
  } catch {
    return {
      delayed_pending_count: 0,
      low_stock_count: 0,
      ready_to_ship_count: 0,
      on_hold_count: 0,
    };
  }
}

export async function fetchCustomerLifetimeStats(
  phone?: string,
  userId?: string
): Promise<CustomerLifetimeStats> {
  try {
    const { data, error } = await supabase.rpc("get_customer_lifetime_stats", {
      p_phone: phone || null,
      p_user_id: userId || null,
    });
    if (!error && data && typeof data === "object") {
      return data as CustomerLifetimeStats;
    }
  } catch {
    // Fallback below
  }

  try {
    let query = supabase.from("orders").select("total, status, created_at");
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);

    if (userId) {
      query = query.eq("user_id", userId);
    } else if (cleanPhone) {
      query = query.ilike("customer->>phone", `%${cleanPhone}%`);
    } else {
      return { total_orders: 0, total_spend: 0, delivered_orders: 0 };
    }

    const { data } = await query;
    if (!data || data.length === 0) {
      return { total_orders: 0, total_spend: 0, delivered_orders: 0 };
    }

    const validSpend = data
      .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const delivered = data.filter((o) => o.status === "delivered").length;
    const dates = data.map((o) => new Date(o.created_at).getTime()).sort((a, b) => a - b);

    return {
      total_orders: data.length,
      total_spend: validSpend,
      delivered_orders: delivered,
      first_order_date:
        dates.length > 0 && typeof dates[0] === "number"
          ? new Date(dates[0]).toISOString()
          : null,
      last_order_date:
        dates.length > 0 && typeof dates[dates.length - 1] === "number"
          ? new Date(dates[dates.length - 1] as number).toISOString()
          : null,
    };
  } catch {
    return { total_orders: 0, total_spend: 0, delivered_orders: 0 };
  }
}

export async function fetchOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const { data, error } = await supabase
    .from("order_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as OrderEvent[]) || [];
}

/**
 * Status changes MUST go through admin_update_order_status RPC.
 */
export async function adminUpdateOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string
): Promise<any> {
  const { data, error } = await supabase.rpc("admin_update_order_status", {
    p_order_id: orderId,
    p_status: status,
    p_note: note || null,
  });

  if (error) throw error;
  return data;
}

/**
 * Update order courier, AWB, and tracking information
 */
export async function adminUpdateOrderShipping(
  orderId: string,
  courierName: string,
  awbNumber: string,
  note?: string
): Promise<any> {
  try {
    const { data, error } = await supabase.rpc("admin_update_order_shipping", {
      p_order_id: orderId,
      p_courier_name: courierName,
      p_awb_number: awbNumber,
      p_note: note || null,
    });
    if (!error) return data;
  } catch {
    // Fallback below
  }

  const { error: updErr } = await supabase
    .from("orders")
    .update({
      courier_name: courierName.trim() || null,
      awb_number: awbNumber.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (updErr) throw updErr;

  await supabase.from("order_events").insert({
    order_id: orderId,
    status: "shipped",
    note: note || `Dispatched via ${courierName || "Courier"} (AWB: ${awbNumber || "—"})`,
  });

  return { success: true };
}

/**
 * Bulk updates order statuses
 */
export async function adminBulkUpdateOrderStatus(
  orderIds: string[],
  newStatus: OrderStatus,
  note?: string
): Promise<{ succeeded: string[]; failed: { id: string; error: string }[] }> {
  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of orderIds) {
    try {
      await adminUpdateOrderStatus(id, newStatus, note);
      succeeded.push(id);
    } catch (err: any) {
      failed.push({ id, error: err?.message || "Failed to update status" });
    }
  }

  return { succeeded, failed };
}

/**
 * Export orders to Excel (XLSX) via SheetJS
 */
export function exportOrdersToExcel(orders: Order[], filename = "urt_orders_export.xlsx") {
  const rows = orders.map((o) => ({
    "Order Code": `#${o.id}`,
    "Order Date": new Date(o.created_at).toLocaleString("en-IN"),
    "Customer Name": o.customer?.name || "Customer",
    "Business Name": o.customer?.business_name || "—",
    "Customer Phone": o.customer?.phone ? `+91 ${o.customer.phone}` : "—",
    "Address": o.customer?.address || "—",
    "Pincode": o.customer?.pincode || "—",
    "Total Items": (o.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0),
    "Items Summary": (o.items || []).map((i) => `${i.name} (x${i.quantity})`).join("; "),
    "Subtotal (INR)": o.subtotal || o.total,
    "Wholesale Savings (INR)": o.savings || 0,
    "Shipping (INR)": o.shipping || 0,
    "Total Amount (INR)": o.total,
    "Order Status": o.status,
    "Order Source": o.source || "website",
    "Payment Status": o.payment_status || "pending",
    "Courier Name": o.courier_name || "—",
    "AWB Number": o.awb_number || "—",
    "Admin Note": o.admin_note || "—",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, filename);
}

/**
 * Export orders to CSV via SheetJS
 */
export function exportOrdersToCSV(orders: Order[], filename = "urt_orders_export.csv") {
  const rows = orders.map((o) => ({
    "Order Code": `#${o.id}`,
    "Order Date": new Date(o.created_at).toLocaleString("en-IN"),
    "Customer Name": o.customer?.name || "Customer",
    "Business Name": o.customer?.business_name || "—",
    "Customer Phone": o.customer?.phone ? `+91 ${o.customer.phone}` : "—",
    "Address": o.customer?.address || "—",
    "Pincode": o.customer?.pincode || "—",
    "Total Items": (o.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0),
    "Items Summary": (o.items || []).map((i) => `${i.name} (x${i.quantity})`).join("; "),
    "Subtotal (INR)": o.subtotal || o.total,
    "Wholesale Savings (INR)": o.savings || 0,
    "Shipping (INR)": o.shipping || 0,
    "Total Amount (INR)": o.total,
    "Order Status": o.status,
    "Order Source": o.source || "website",
    "Payment Status": o.payment_status || "pending",
    "Courier Name": o.courier_name || "—",
    "AWB Number": o.awb_number || "—",
    "Admin Note": o.admin_note || "—",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, filename, { bookType: "csv" });
}

// ----------------------------------------------------------------------------
// 4. CONTENT SERVICES (store_pages, popular_searches, banners by placement)
// ----------------------------------------------------------------------------

export async function fetchStoreSettings(): Promise<StoreSettings> {
  const { data, error } = await supabase.from("store_settings").select("*");
  if (error) throw error;

  const settings: any = {
    whatsapp_number: "",
    upi_id: "7000947033-1@okbizaxis",
    store_name: "URT Wholesale",
    free_delivery_min: 999,
    shipping_fee: 49,
    popular_searches: [],
    value_badges: [],
    store_info: {
      name: "URT Wholesale",
      tagline: "Factory Direct Wholesale Mobile Gear",
      currency: "₹",
    },
  };

  (data || []).forEach((row: any) => {
    if (row.key in settings) {
      settings[row.key] = row.value;
    }
  });

  return settings as StoreSettings;
}

export async function updateStoreSetting(key: string, value: any): Promise<void> {
  const { error } = await supabase
    .from("store_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) throw error;
}

export async function fetchStorePages(): Promise<StorePage[]> {
  const { data, error } = await supabase
    .from("store_pages")
    .select("*")
    .order("slug", { ascending: true });

  if (error) throw error;
  return (data as StorePage[]) || [];
}

export async function saveStorePage(page: {
  slug: string;
  title: string;
  summary: string;
  content: string;
}): Promise<StorePage> {
  const { data, error } = await supabase
    .from("store_pages")
    .upsert({
      ...page,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as StorePage;
}

export async function fetchBanners(): Promise<Banner[]> {
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data as Banner[]) || [];
}

export async function saveBanner(banner: Partial<Banner> & { id: string }): Promise<void> {
  const { error } = await supabase
    .from("banners")
    .update({
      title: banner.title,
      subtitle: banner.subtitle,
      badge_text: banner.badge_text,
      image_url: banner.image_url,
      badges: banner.badges,
      cta_text: banner.cta_text,
      cta_link: banner.cta_link,
      secondary_cta_text: banner.secondary_cta_text,
      secondary_cta_link: banner.secondary_cta_link,
      placement: banner.placement,
      sort_order: banner.sort_order,
      is_active: banner.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", banner.id);

  if (error) throw error;
}

// ----------------------------------------------------------------------------
// 6. CATEGORY SERVICES
// ----------------------------------------------------------------------------

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data as Category[]) || [];
}

export async function fetchCategoryById(id: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Category;
}

export function slugifyCategoryName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createCategory(cat: {
  name: string;
  slug?: string;
  parent_id?: string | null;
  image_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
}): Promise<Category> {
  let slug = cat.slug?.trim() || slugifyCategoryName(cat.name);
  if (!slug) slug = `cat-${Date.now()}`;

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .limit(1);

  if (existing && existing.length > 0) {
    slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
  }

  let sortOrder = cat.sort_order;
  if (sortOrder === undefined) {
    let query = supabase
      .from("categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);

    if (cat.parent_id) {
      query = query.eq("parent_id", cat.parent_id);
    } else {
      query = query.is("parent_id", null);
    }

    const { data: siblings } = await query;
    sortOrder = siblings && siblings[0] ? (siblings[0].sort_order || 0) + 1 : 0;
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: cat.name.trim(),
      slug,
      parent_id: cat.parent_id || null,
      image_url: cat.image_url || null,
      is_active: cat.is_active ?? true,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  id: string,
  updates: Partial<Category>
): Promise<Category> {
  const payload: any = { ...updates };
  delete payload.id;
  delete payload.created_at;

  const { data, error } = await supabase
    .from("categories")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export interface CategoryDeletionCheck {
  canDelete: boolean;
  childrenCount: number;
  productCount: number;
  reason?: string;
}

export async function checkCategoryDeletion(id: string): Promise<CategoryDeletionCheck> {
  const [childrenRes, productsRes] = await Promise.all([
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", id),
  ]);

  const childrenCount = childrenRes.count || 0;
  const productCount = productsRes.count || 0;

  if (childrenCount > 0 && productCount > 0) {
    return {
      canDelete: false,
      childrenCount,
      productCount,
      reason: `Cannot delete this category because it contains ${childrenCount} subcategories and ${productCount} assigned products. Reassign or delete them first.`,
    };
  }

  if (childrenCount > 0) {
    return {
      canDelete: false,
      childrenCount,
      productCount: 0,
      reason: `Cannot delete this category because it contains ${childrenCount} subcategories. Move or delete child categories first.`,
    };
  }

  if (productCount > 0) {
    return {
      canDelete: false,
      childrenCount: 0,
      productCount,
      reason: `Cannot delete this category because ${productCount} products are currently assigned to it. Move products to another category first.`,
    };
  }

  return {
    canDelete: true,
    childrenCount: 0,
    productCount: 0,
  };
}

export async function deleteCategory(id: string): Promise<void> {
  const check = await checkCategoryDeletion(id);
  if (!check.canDelete) {
    throw new Error(check.reason || "Category cannot be deleted because it is in use.");
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderCategories(
  updates: { id: string; sort_order: number }[]
): Promise<void> {
  const promises = updates.map(({ id, sort_order }) =>
    supabase.from("categories").update({ sort_order }).eq("id", id)
  );
  await Promise.all(promises);
}

export async function toggleCategoryActive(
  id: string,
  is_active: boolean
): Promise<void> {
  const { error } = await supabase
    .from("categories")
    .update({ is_active })
    .eq("id", id);

  if (error) throw error;
}

export async function uploadCategoryImage(
  file: File,
  onCompressed?: (result: CompressionResult) => void
): Promise<string> {
  const compResult = await compressImage(file, {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.85,
  });

  onCompressed?.(compResult);

  const fileToUpload = compResult.file;
  const uniqueName = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.webp`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(`categories/${uniqueName}`, fileToUpload, {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(`categories/${uniqueName}`);

  return data.publicUrl;
}

// ----------------------------------------------------------------------------
// 7. CATEGORY ATTRIBUTES SERVICES
// ----------------------------------------------------------------------------

export async function fetchCategoryAttributes(
  categoryId: string
): Promise<CategoryAttribute[]> {
  const { data, error } = await supabase
    .from("category_attributes")
    .select("*")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    options: Array.isArray(row.options) ? row.options : [],
  }));
}

export async function fetchInheritedCategoryAttributes(
  categoryId: string
): Promise<InheritedCategoryAttribute[]> {
  const { data: allCategories, error: catError } = await supabase
    .from("categories")
    .select("id, name, parent_id");

  if (catError || !allCategories) return [];

  const catMap = new Map<string, { id: string; name: string; parent_id: string | null }>();
  for (const c of allCategories) {
    catMap.set(c.id, c);
  }

  // Collect ancestors from immediate parent up to root
  const ancestorIds: { id: string; name: string }[] = [];
  let curr = catMap.get(categoryId);
  while (curr && curr.parent_id) {
    const parent = catMap.get(curr.parent_id);
    if (!parent) break;
    ancestorIds.push({ id: parent.id, name: parent.name });
    curr = parent;
  }

  if (ancestorIds.length === 0) return [];

  const { data: attrs, error: attrError } = await supabase
    .from("category_attributes")
    .select("*")
    .in("category_id", ancestorIds.map((a) => a.id))
    .order("sort_order", { ascending: true });

  if (attrError || !attrs) return [];

  const ancestorMap = new Map(ancestorIds.map((a) => [a.id, a.name]));

  return attrs.map((row: any) => ({
    ...row,
    options: Array.isArray(row.options) ? row.options : [],
    inherited_from_category_id: row.category_id,
    inherited_from_category_name: ancestorMap.get(row.category_id) || "Parent Category",
  }));
}

export async function saveCategoryAttribute(
  attribute: Partial<CategoryAttribute> & {
    category_id: string;
    label: string;
    key: string;
  }
): Promise<CategoryAttribute> {
  const payload: any = {
    category_id: attribute.category_id,
    label: attribute.label.trim(),
    key: attribute.key.trim().toLowerCase().replace(/[^\w-]/g, "_"),
    type: attribute.type || "text",
    options: attribute.options || [],
    required: attribute.required ?? false,
    apply_to_all_products: attribute.apply_to_all_products ?? false,
    help_text: attribute.help_text?.trim() || null,
    sort_order: attribute.sort_order ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (attribute.id) {
    payload.id = attribute.id;
  }

  const { data, error } = await supabase
    .from("category_attributes")
    .upsert(payload)
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    options: Array.isArray(data.options) ? data.options : [],
  } as CategoryAttribute;
}

export async function deleteCategoryAttribute(id: string): Promise<void> {
  const { error } = await supabase
    .from("category_attributes")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function reorderCategoryAttributes(
  categoryId: string,
  orderedIds: string[]
): Promise<void> {
  const promises = orderedIds.map((id, index) =>
    supabase
      .from("category_attributes")
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("category_id", categoryId)
  );

  await Promise.all(promises);
}

// ----------------------------------------------------------------------------
// 6. RETURNS & CLAIMS MANAGEMENT SERVICES
// ----------------------------------------------------------------------------

export interface FetchAdminReturnsFilter {
  status?: string;
  type?: string;
  claim_status?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export async function fetchAdminReturns(
  filter?: FetchAdminReturnsFilter
): Promise<ReturnRequest[]> {
  let query = supabase
    .from("return_requests")
    .select(`
      *,
      items:return_items(
        id,
        return_id,
        order_item_id,
        product_id,
        quantity,
        reason_code,
        condition,
        product:products(id, name, sku, images, price)
      ),
      events:return_events(*),
      order:orders(id, customer, total, status, created_at)
    `)
    .order("requested_at", { ascending: false });

  if (filter?.status && filter.status !== "all") {
    query = query.eq("status", filter.status);
  }

  if (filter?.type && filter.type !== "all") {
    query = query.eq("type", filter.type);
  }

  if (filter?.claim_status && filter.claim_status !== "all") {
    if (filter.claim_status === "has_claim") {
      query = query.neq("claim_status", "none");
    } else {
      query = query.eq("claim_status", filter.claim_status);
    }
  }

  if (filter?.fromDate) {
    query = query.gte("requested_at", new Date(filter.fromDate).toISOString());
  }

  if (filter?.toDate) {
    const end = new Date(filter.toDate);
    end.setHours(23, 59, 59, 999);
    query = query.lte("requested_at", end.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  let results: ReturnRequest[] = (data || []).map((row: any) => {
    const orderCustomer = row.order?.customer;
    return {
      ...row,
      customer: orderCustomer
        ? {
            name: orderCustomer.name,
            phone: orderCustomer.phone,
            business_name: orderCustomer.business_name,
            email: orderCustomer.email,
          }
        : undefined,
    } as ReturnRequest;
  });

  if (filter?.search && filter.search.trim()) {
    const q = filter.search.trim().toLowerCase();
    results = results.filter((r) => {
      const matchCode = r.return_code?.toLowerCase().includes(q);
      const matchOrder = r.order_id?.toLowerCase().includes(q);
      const matchCustName = r.customer?.name?.toLowerCase().includes(q);
      const matchCustPhone = r.customer?.phone?.toLowerCase().includes(q);
      const matchCustBiz = r.customer?.business_name?.toLowerCase().includes(q);
      const matchSku = r.items?.some(
        (it) =>
          it.product?.sku?.toLowerCase().includes(q) ||
          it.product?.name?.toLowerCase().includes(q)
      );
      return matchCode || matchOrder || matchCustName || matchCustPhone || matchCustBiz || matchSku;
    });
  }

  return results;
}

export async function fetchAdminReturnById(
  returnId: string
): Promise<ReturnRequest | null> {
  const { data, error } = await supabase
    .from("return_requests")
    .select(`
      *,
      items:return_items(
        id,
        return_id,
        order_item_id,
        product_id,
        quantity,
        reason_code,
        condition,
        product:products(id, name, sku, images, price)
      ),
      events:return_events(*),
      order:orders(id, customer, total, status, created_at)
    `)
    .eq("id", returnId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  const orderCustomer = data.order?.customer;
  const events = (data.events || []).sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return {
    ...data,
    events,
    customer: orderCustomer
      ? {
          name: orderCustomer.name,
          phone: orderCustomer.phone,
          business_name: orderCustomer.business_name,
          email: orderCustomer.email,
        }
      : undefined,
  } as ReturnRequest;
}

export async function adminUpdateReturnStatus(
  input: AdminUpdateReturnStatusInput
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_return_status", {
    p_return_id: input.return_id,
    p_new_status: input.new_status,
    p_note: input.note || null,
    p_refund_amount: input.refund_amount ?? 0,
  });

  if (error) throw error;
}

export async function adminUpdateReturnClaim(
  input: AdminUpdateReturnClaimInput
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_return_claim", {
    p_return_id: input.return_id,
    p_claim_status: input.claim_status,
    p_claim_amount: input.claim_amount || 0,
    p_claim_type: input.claim_type || null,
    p_claim_reference: input.claim_reference || null,
    p_claim_notes: input.claim_notes || null,
  });

  if (error) throw error;
}

export async function fetchReturnStats(days: number = 30): Promise<ReturnStats> {
  const { data, error } = await supabase.rpc("get_return_stats", {
    p_days: days,
  });

  if (error) throw error;
  return data as ReturnStats;
}

export async function fetchProductReturnPerformance(
  days: number = 30,
  categoryId?: string | null
): Promise<ProductReturnPerformance[]> {
  const { data, error } = await supabase.rpc("get_product_return_performance", {
    p_days: days,
    p_category_id: categoryId || null,
  });

  if (error) throw error;
  return (data as ProductReturnPerformance[]) || [];
}

export async function fetchPendingReturnsBadgeCount(): Promise<{
  total_pending: number;
  requested_count: number;
  received_count: number;
  qc_failed_count: number;
  pending_claims_count: number;
}> {
  try {
    const { data, error } = await supabase.rpc("admin_get_returns_pending_count");
    if (error || !data) {
      const { count } = await supabase
        .from("return_requests")
        .select("*", { count: "exact", head: true })
        .in("status", ["requested", "received"]);
      return {
        total_pending: count || 0,
        requested_count: count || 0,
        received_count: 0,
        qc_failed_count: 0,
        pending_claims_count: 0,
      };
    }
    return data;
  } catch {
    return {
      total_pending: 0,
      requested_count: 0,
      received_count: 0,
      qc_failed_count: 0,
      pending_claims_count: 0,
    };
  }
}

export async function getReturnEvidenceUrl(path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from("return-evidence")
      .createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch {
    // fallback
  }
  const { data } = supabase.storage.from("return-evidence").getPublicUrl(path);
  return data.publicUrl;
}

export function exportReturnsToExcel(
  returns: ReturnRequest[],
  filename: string = "URT_Returns_Data.xlsx"
): void {
  const rows = returns.map((r) => ({
    "Return Code": r.return_code,
    "Requested Date": new Date(r.requested_at).toLocaleDateString("en-IN"),
    "Order Code": r.order_id,
    "Customer Name": r.customer?.name || "Customer",
    "Business Name": r.customer?.business_name || "—",
    "Customer Phone": r.customer?.phone || "—",
    Type: r.type.toUpperCase(),
    Reason: r.reason_code,
    Status: r.status,
    "Items Count": r.items?.length || 0,
    "Total Returned Units":
      r.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0,
    "Refund Amount (₹)": r.refund_amount || 0,
    "Claim Status": r.claim_status || "none",
    "Claim Type": r.claim_type || "—",
    "Claim Amount (₹)": r.claim_amount || 0,
    "Claim Ref": r.claim_reference || "—",
    "Admin Note": r.admin_note || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Returns");
  XLSX.writeFile(workbook, filename);
}

export function exportClaimsToExcel(
  claims: ReturnRequest[],
  filename: string = "URT_Claims_Data.xlsx"
): void {
  const rows = claims.map((c) => ({
    "Return Code": c.return_code,
    "Order Code": c.order_id,
    Customer: c.customer?.name || "Customer",
    Phone: c.customer?.phone || "—",
    "Return Status": c.status,
    Reason: c.reason_code,
    "Claim Status": (c.claim_status || "none").toUpperCase(),
    "Claim Type": c.claim_type || "—",
    "Claim Amount (₹)": c.claim_amount || 0,
    "Claim Reference": c.claim_reference || "—",
    "Filed Date": c.claim_filed_at
      ? new Date(c.claim_filed_at).toLocaleDateString("en-IN")
      : "—",
    "Settled Date": c.claim_settled_at
      ? new Date(c.claim_settled_at).toLocaleDateString("en-IN")
      : "—",
    "Claim Notes": c.claim_notes || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Claims");
  XLSX.writeFile(workbook, filename);
}

export function exportProductPerformanceToExcel(
  products: ProductReturnPerformance[],
  filename: string = "URT_Product_Return_Performance.xlsx"
): void {
  const rows = products.map((p) => ({
    SKU: p.sku,
    "Product Name": p.product_name,
    Category: p.category_name || "—",
    "Orders Delivered": p.orders_delivered,
    "Quantity Delivered": p.quantity_delivered,
    "Returns Count": p.returns_count,
    "Quantity Returned": p.quantity_returned,
    "Return Rate (%)": p.return_rate_percentage + "%",
    "High Returns Flag": p.is_high_return ? "YES (>5%)" : "Normal",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Performance");
  XLSX.writeFile(workbook, filename);
}


// ============================================================================
// CATALOG IMAGE LIBRARY
// ============================================================================

export type { CatalogImage };

// ----------------------------------------------------------------------------
// Local Storage Cache for Catalog Images (resilience when catalog_images table
// is pending migration or schema cache is warming)
// ----------------------------------------------------------------------------
const CATALOG_IMAGES_CACHE_KEY = "urbanrat_catalog_images_cache_v1";

function getLocalCachedCatalogImages(): CatalogImage[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CATALOG_IMAGES_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CatalogImage[]) : [];
  } catch (e) {
    console.warn("Failed to read catalog images cache:", e);
    return [];
  }
}

function saveCatalogImageToLocalCache(image: CatalogImage): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const list = getLocalCachedCatalogImages();
    const filtered = list.filter(
      (item: CatalogImage) => item.id !== image.id && item.public_url !== image.public_url
    );
    const updated = [image, ...filtered].slice(0, 500);
    window.localStorage.setItem(CATALOG_IMAGES_CACHE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to save catalog image to cache:", e);
  }
}

function removeCatalogImageFromLocalCache(id: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const list = getLocalCachedCatalogImages();
    const updated = list.filter((item: CatalogImage) => item.id !== id);
    window.localStorage.setItem(CATALOG_IMAGES_CACHE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to remove catalog image from cache:", e);
  }
}

function getFilteredCachedImages(options?: {
  search?: string;
  page?: number;
  pageSize?: number;
  batchId?: string;
}) {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = options?.pageSize ?? 50;
  let items = getLocalCachedCatalogImages();

  if (options?.batchId) {
    items = items.filter((img: CatalogImage) => img.batch_id === options.batchId);
  }

  if (options?.search) {
    const s = options.search.trim().toLowerCase();
    items = items.filter(
      (img: CatalogImage) =>
        img.original_name.toLowerCase().includes(s) ||
        (img.sku_hint && img.sku_hint.toLowerCase().includes(s))
    );
  }

  const count = items.length;
  const start = (page - 1) * pageSize;
  const sliced = items.slice(start, start + pageSize);

  return {
    data: sliced,
    count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize) || 1,
  };
}

/**
 * Uploads and indexes a catalog image:
 * 1. Compresses via imageCompressor.ts (WebP, max 1200px, quality 0.84)
 * 2. Uploads to catalog-images bucket (with product-images fallback)
 * 3. Inserts record into catalog_images table (with resilient local cache fallback)
 * 4. Returns the record with public_url
 */
export async function uploadCatalogImage(
  file: File,
  options?: {
    batchId?: string;
    onProgress?: (percent: number) => void;
  }
): Promise<CatalogImage> {
  options?.onProgress?.(10);

  // 1. Client-side compression
  const compressionResult = await compressImage(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.84,
    mimeType: "image/webp",
  });

  options?.onProgress?.(45);

  // 2. Build storage path: catalog/{yyyy}/{mm}/{uuid}-{sanitizedName}.webp
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  const rawBaseName = file.name.replace(/\.[^/.]+$/, "");
  const cleanName = sanitizeFileName(rawBaseName);
  const storagePath = `catalog/${yyyy}/${mm}/${uuid}-${cleanName}.webp`;

  // 3. Upload to Supabase Storage (try catalog-images first, fallback to product-images)
  let bucket = "catalog-images";
  let uploadErr: any = null;

  const firstAttempt = await supabase.storage
    .from(bucket)
    .upload(storagePath, compressionResult.file, {
      contentType: "image/webp",
      upsert: false,
    });

  if (firstAttempt.error) {
    console.warn(
      `Upload to ${bucket} failed (${firstAttempt.error.message}), falling back to product-images`
    );
    bucket = "product-images";
    const secondAttempt = await supabase.storage
      .from(bucket)
      .upload(storagePath, compressionResult.file, {
        contentType: "image/webp",
        upsert: false,
      });
    uploadErr = secondAttempt.error;
  } else {
    uploadErr = null;
  }

  if (uploadErr) {
    console.error("Storage upload failed on all buckets:", uploadErr);
    const msg = uploadErr.message || "";
    if (msg.includes("row-level security") || uploadErr.statusCode === "403") {
      throw new Error(
        "Upload permission denied. Please sign in with an Administrator account."
      );
    }
    throw new Error(`Upload failed: ${msg || "Storage error"}`);
  }

  options?.onProgress?.(80);

  // 4. Retrieve public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  // 5. Extract SKU hint
  const parsedSku = parseSkuFromFilename(file.name);

  // 6. Insert catalog_images record (with graceful fallback if table not yet migrated)
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id || null;

  const fallbackRecord: CatalogImage = {
    id: uuid,
    original_name: file.name,
    storage_path: storagePath,
    public_url: publicUrl,
    mime_type: "image/webp",
    width: compressionResult.width || null,
    height: compressionResult.height || null,
    original_size_bytes: file.size,
    compressed_size_bytes: compressionResult.compressedSize,
    sku_hint: parsedSku.sku,
    batch_id: options?.batchId || null,
    created_by: userId,
    created_at: now.toISOString(),
    deleted_at: null,
  };

  try {
    const { data, error: insertErr } = await supabase
      .from("catalog_images")
      .insert({
        original_name: file.name,
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: "image/webp",
        width: compressionResult.width || null,
        height: compressionResult.height || null,
        original_size_bytes: file.size,
        compressed_size_bytes: compressionResult.compressedSize,
        sku_hint: parsedSku.sku,
        batch_id: options?.batchId || null,
        created_by: userId,
      })
      .select()
      .single();

    if (insertErr) {
      console.warn("catalog_images insert warning (using resilient local cache):", insertErr.message);
      saveCatalogImageToLocalCache(fallbackRecord);
      options?.onProgress?.(100);
      return fallbackRecord;
    }

    const savedRecord = (data as CatalogImage) || fallbackRecord;
    saveCatalogImageToLocalCache(savedRecord);
    options?.onProgress?.(100);
    return savedRecord;
  } catch (dbErr: any) {
    console.warn("catalog_images table operation caught:", dbErr?.message);
    saveCatalogImageToLocalCache(fallbackRecord);
    options?.onProgress?.(100);
    return fallbackRecord;
  }
}

/**
 * Lists catalog images with pagination, search, and batch filtering.
 */
export async function listCatalogImages(options?: {
  search?: string;
  page?: number;
  pageSize?: number;
  batchId?: string;
}): Promise<{
  data: CatalogImage[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = options?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  try {
    let query = supabase
      .from("catalog_images")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (options?.batchId) {
      query = query.eq("batch_id", options.batchId);
    }

    if (options?.search) {
      const s = options.search.trim();
      query = query.or(`original_name.ilike.%${s}%,sku_hint.ilike.%${s}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      console.warn("Query catalog_images table failed, reading local cache:", error.message);
      return getFilteredCachedImages(options);
    }

    const remoteData = (data || []) as CatalogImage[];
    const cached = getLocalCachedCatalogImages();
    const merged = [...remoteData];
    for (const c of cached) {
      if (!merged.some((m) => m.public_url === c.public_url || m.id === c.id)) {
        merged.push(c);
      }
    }

    const totalCount = Math.max(count ?? 0, merged.length);
    return {
      data: merged,
      count: totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize) || 1,
    };
  } catch (err) {
    console.warn("Error listing catalog images, using cache fallback:", err);
    return getFilteredCachedImages(options);
  }
}

/**
 * Deletes a catalog image:
 * Calls admin_delete_catalog_image RPC which blocks deletion if referenced by any
 * products or catalog_upload_items, then removes the file from Supabase Storage.
 */
export async function deleteCatalogImage(
  id: string
): Promise<{ success: boolean; storage_path?: string }> {
  let storagePath: string | undefined;

  // 1. Try admin_delete_catalog_image RPC
  try {
    const { data, error } = await supabase.rpc("admin_delete_catalog_image", {
      p_image_id: id,
    });

    if (error) {
      // If image is in use by products, throw the usage guard error
      if (
        error.message?.includes("used by") ||
        error.message?.includes("Cannot delete") ||
        error.message?.includes("in use")
      ) {
        throw new Error(error.message);
      }
      console.warn("admin_delete_catalog_image RPC error, attempting fallback update:", error.message);
      const { error: updateErr } = await supabase
        .from("catalog_images")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (updateErr) {
        console.warn("Fallback soft-delete error:", updateErr.message);
      }
    } else if (data) {
      const res = data as {
        success: boolean;
        in_use?: boolean;
        used_by?: string[];
        storage_path?: string;
        message?: string;
      };

      if (!res.success) {
        throw new Error(
          res.message ||
            `Cannot delete image: in use by ${(res.used_by || []).join(", ")}`
        );
      }
      storagePath = res.storage_path;
    }
  } catch (err: any) {
    if (
      err.message?.includes("used by") ||
      err.message?.includes("Cannot delete") ||
      err.message?.includes("in use")
    ) {
      throw err;
    }
    console.warn("admin_delete_catalog_image error:", err?.message);
    try {
      await supabase
        .from("catalog_images")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
    } catch {
      // Ignore fallback error
    }
  }

  // Remove from local cache
  removeCatalogImageFromLocalCache(id);

  // If storage path exists, attempt deletion from storage
  if (storagePath) {
    await supabase.storage.from("catalog-images").remove([storagePath]).catch(() => {});
    await supabase.storage.from("product-images").remove([storagePath]).catch(() => {});
  }

  return { success: true, storage_path: storagePath };
}

/**
 * Bulk deletes multiple catalog images by ID.
 * Returns arrays of successfully deleted IDs and failed IDs.
 */
export async function deleteCatalogImages(
  ids: string[]
): Promise<{ deletedIds: string[]; failedIds: string[]; errors: string[] }> {
  const deletedIds: string[] = [];
  const failedIds: string[] = [];
  const errors: string[] = [];

  for (const id of ids) {
    try {
      await deleteCatalogImage(id);
      deletedIds.push(id);
    } catch (err: any) {
      failedIds.push(id);
      errors.push(err.message || `Failed to delete ${id}`);
    }
  }

  return { deletedIds, failedIds, errors };
}

/**
 * Lists all images belonging to a specific batch.
 */
export async function listBatchImages(batchId: string): Promise<CatalogImage[]> {
  try {
    const { data, error } = await supabase
      .from("catalog_images")
      .select("*")
      .eq("batch_id", batchId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (!error && data) {
      return data as CatalogImage[];
    }
  } catch {
    // ignore
  }

  const cached = getLocalCachedCatalogImages();
  return cached.filter((img: CatalogImage) => img.batch_id === batchId);
}

/**
 * Fetches catalog images from the library (legacy wrapper for backwards compatibility).
 */
export async function fetchCatalogImages(opts?: {
  search?: string;
  batchId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: CatalogImage[]; count: number }> {
  const limit = opts?.limit ?? 100;
  const offset = opts?.offset ?? 0;

  try {
    let query = supabase
      .from("catalog_images")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (opts?.batchId) {
      query = query.eq("batch_id", opts.batchId);
    }

    if (opts?.search) {
      const s = opts.search.trim();
      query = query.or(`original_name.ilike.%${s}%,sku_hint.ilike.%${s}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      const cached = getFilteredCachedImages({
        search: opts?.search,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        batchId: opts?.batchId,
      });
      return { data: cached.data, count: cached.count };
    }
    return { data: (data || []) as CatalogImage[], count: count ?? 0 };
  } catch {
    const cached = getFilteredCachedImages({
      search: opts?.search,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      batchId: opts?.batchId,
    });
    return { data: cached.data, count: cached.count };
  }
}

/**
 * Saves a record to the catalog_images table after a file is uploaded to storage.
 */
export async function saveCatalogImageRecord(
  record: Omit<CatalogImage, "id" | "created_at" | "deleted_at" | "created_by">
): Promise<CatalogImage> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id || null;
  const now = new Date().toISOString();
  const uuid = crypto.randomUUID();

  const fallback: CatalogImage = {
    ...record,
    id: uuid,
    created_by: userId,
    created_at: now,
    deleted_at: null,
  };

  try {
    const { data, error } = await supabase
      .from("catalog_images")
      .insert({
        ...record,
        created_by: userId,
      })
      .select()
      .single();

    if (!error && data) {
      saveCatalogImageToLocalCache(data as CatalogImage);
      return data as CatalogImage;
    }
  } catch (e) {
    console.warn("saveCatalogImageRecord warning:", e);
  }

  saveCatalogImageToLocalCache(fallback);
  return fallback;
}

/**
 * Check whether a public_url exists in the catalog_images table.
 */
export async function checkCatalogImageUrlExists(url: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from("catalog_images")
      .select("id", { count: "exact", head: true })
      .eq("public_url", url)
      .is("deleted_at", null);

    if (!error && (count ?? 0) > 0) return true;
  } catch {
    // ignore
  }

  const cached = getLocalCachedCatalogImages();
  return cached.some((img: CatalogImage) => img.public_url === url);
}
