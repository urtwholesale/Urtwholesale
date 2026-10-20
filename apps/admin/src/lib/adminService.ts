import { supabase } from "./supabase";
import type { Product, Order, PriceTier, StorePage, Banner, StoreSettings } from "@urbanrat/shared";
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

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
}

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

  if (isNew) {
    // When creating product, provide initial price and stock
    payload.price = productData.price || 0;
    payload.stock = productData.stock || 0;

    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  } else {
    // Update existing product metadata (stock and tiers updated via RPCs)
    const { data, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", productData.id!)
      .select()
      .single();

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
// 3. ORDER SERVICES (Strict RPC write for status transitions)
// ----------------------------------------------------------------------------

export async function fetchAdminOrders(options?: {
  status?: string;
  search?: string;
}): Promise<Order[]> {
  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (options?.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  if (options?.search?.trim()) {
    const s = options.search.trim();
    query = query.or(`id.ilike.%${s}%,customer->>name.ilike.%${s}%,customer->>phone.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Order[]) || [];
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
 * Allowed: pending, confirmed, processing, shipped, delivered, cancelled, refunded.
 */
export async function adminUpdateOrderStatus(
  orderId: string,
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded",
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
