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
  CategoryAttribute,
  InheritedCategoryAttribute,
  ReturnRequest,
  ReturnStats,
  ProductReturnPerformance,
  AdminUpdateReturnStatusInput,
  AdminUpdateReturnClaimInput,
  CatalogImage,
} from "@urbanrat/shared";
import { sanitizeFileName, parseSkuFromFilename } from "@urbanrat/shared";
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
    warranty_months: productData.warranty_months || 0,
    tags: productData.tags || [],
    is_urbanrat_brand: Boolean(productData.is_urbanrat_brand),
    is_featured: Boolean(productData.is_featured),
    is_trending: Boolean(productData.is_trending),
    is_active: productData.is_active !== undefined ? productData.is_active : true,
    low_stock_threshold: productData.low_stock_threshold || 5,
    min_order_qty: productData.min_order_qty || 1,
    order_qty_step: productData.order_qty_step || 1,
    updated_at: new Date().toISOString(),
  };

  // Only attach keywords if the schema supports it or hasn't been tested yet
  if (_supportsKeywordsColumn !== false) {
    payload.keywords = productData.keywords || [];
  }

  if (isNew) {
    // When creating product, provide initial price and stock
    payload.price = productData.price || 0;
    payload.stock = productData.stock || 0;

    let { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();

    // If keywords column is not yet migrated in Supabase, retry without keywords
    if (error && (error.message?.includes("'keywords'") || (error as any).details?.includes("keywords"))) {
      _supportsKeywordsColumn = false;
      const fallbackPayload = { ...payload };
      delete fallbackPayload.keywords;
      const retry = await supabase
        .from("products")
        .insert(fallbackPayload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    } else if (!error) {
      _supportsKeywordsColumn = true;
    }

    if (error) throw error;
    return data as Product;
  } else {
    // Update existing product metadata (stock and tiers updated via RPCs)
    let { data, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", productData.id!)
      .select()
      .single();

    // If keywords column is not yet migrated in Supabase, retry without keywords
    if (error && (error.message?.includes("'keywords'") || (error as any).details?.includes("keywords"))) {
      _supportsKeywordsColumn = false;
      const fallbackPayload = { ...payload };
      delete fallbackPayload.keywords;
      const retry = await supabase
        .from("products")
        .update(fallbackPayload)
        .eq("id", productData.id!)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    } else if (!error) {
      _supportsKeywordsColumn = true;
    }

    if (error) throw error;
    return data as Product;
  }
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

/**
 * Uploads and indexes a catalog image:
 * 1. Compresses via imageCompressor.ts (WebP, max 1200px, quality 0.84)
 * 2. Uploads to catalog-images bucket at catalog/{yyyy}/{mm}/{uuid}-{sanitizedName}.webp
 * 3. Inserts record into catalog_images table
 * 4. Returns the inserted row with public_url
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

  // 3. Upload to Supabase Storage
  const { error: uploadErr } = await supabase.storage
    .from("catalog-images")
    .upload(storagePath, compressionResult.file, {
      contentType: "image/webp",
      upsert: false,
    });

  if (uploadErr) throw uploadErr;

  options?.onProgress?.(80);

  // 4. Retrieve public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("catalog-images").getPublicUrl(storagePath);

  // 5. Extract SKU hint
  const parsedSku = parseSkuFromFilename(file.name);

  // 6. Insert catalog_images record
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id || null;

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

  if (insertErr) throw insertErr;

  options?.onProgress?.(100);
  return data as CatalogImage;
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
  if (error) throw error;

  const totalCount = count ?? 0;
  return {
    data: (data || []) as CatalogImage[],
    count: totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

/**
 * Deletes a catalog image:
 * Calls admin_delete_catalog_image RPC which blocks deletion if referenced by any
 * products or catalog_upload_items, then removes the file from Supabase Storage.
 */
export async function deleteCatalogImage(
  id: string
): Promise<{ success: boolean; storage_path?: string }> {
  const { data, error } = await supabase.rpc("admin_delete_catalog_image", {
    p_image_id: id,
  });

  if (error) throw error;

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

  if (res.storage_path) {
    const { error: storageErr } = await supabase.storage
      .from("catalog-images")
      .remove([res.storage_path]);
    if (storageErr) {
      console.warn("Soft-deleted database row, but could not remove storage object:", storageErr);
    }
  }

  return { success: true, storage_path: res.storage_path };
}

/**
 * Lists all images belonging to a specific batch.
 */
export async function listBatchImages(batchId: string): Promise<CatalogImage[]> {
  const { data, error } = await supabase
    .from("catalog_images")
    .select("*")
    .eq("batch_id", batchId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as CatalogImage[];
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
  if (error) throw error;
  return { data: (data || []) as CatalogImage[], count: count ?? 0 };
}

/**
 * Saves a record to the catalog_images table after a file is uploaded to storage.
 */
export async function saveCatalogImageRecord(
  record: Omit<CatalogImage, "id" | "created_at" | "deleted_at" | "created_by">
): Promise<CatalogImage> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id || null;

  const { data, error } = await supabase
    .from("catalog_images")
    .insert({
      ...record,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CatalogImage;
}

/**
 * Check whether a public_url exists in the catalog_images table.
 */
export async function checkCatalogImageUrlExists(url: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("catalog_images")
    .select("id", { count: "exact", head: true })
    .eq("public_url", url)
    .is("deleted_at", null);

  if (error) return false;
  return (count ?? 0) > 0;
}
