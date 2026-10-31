import {
  supabase,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
} from "../lib/supabase";
import type {
  Category,
  Product,
  Order,
  CustomerDetails,
  StoreSettings,
  Banner,
  StorePage,
  PriceTier,
  Address,
  Review,
} from "@urbanrat/shared";
import {
  normalizeSearchQuery,
  generateSearchVariants,
} from "@urbanrat/shared";
import * as addressService from "./addressService";

/**
 * Custom typed error class for store services
 */
export class StoreError extends Error {
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "StoreError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, StoreError.prototype);
  }
}

export interface ProductFilterOptions {
  categoryId?: string | null;
  subCategoryId?: string | null;
  categorySlug?: string | null;
  isUrbanratBrand?: boolean;
  isFeatured?: boolean;
  search?: string;
  sort?: "featured" | "price_asc" | "price_desc" | "newest" | "price-asc" | "price-desc";
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
}

export const PRODUCT_SELECT = "*, price_tiers:product_price_tiers(*)";

/**
 * Normalizes and sorts price tiers ascending by min_qty in one place
 */
export function formatProduct(raw: any): Product {
  const rawTiers = raw.price_tiers || raw.product_price_tiers || [];
  const price_tiers: PriceTier[] = Array.isArray(rawTiers)
    ? [...rawTiers].sort((a, b) => a.min_qty - b.min_qty)
    : [];

  return {
    ...raw,
    price_tiers,
  };
}

/**
 * Check if Supabase client has valid project configuration
 */
export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      !url.includes("your-project-id") &&
      !url.includes("placeholder") &&
      !key.includes("your-anon-key") &&
      !key.includes("placeholder")
  );
}

function ensureConfigured() {
  if (!isSupabaseConfigured()) {
    throw new StoreError(
      "Supabase connection is not configured.",
      "CONFIG_MISSING"
    );
  }
}

/**
 * Fetch all active categories from live database
 */
export async function fetchCategories(): Promise<Category[]> {
  ensureConfigured();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return (data as Category[]) || [];
}

/**
 * Fetches distinct category IDs of active products, optionally filtered by brand (e.g. Urbanrat).
 */
export async function fetchActiveProductCategoryIds(isUrbanratBrand?: boolean): Promise<Set<string>> {
  ensureConfigured();

  let query = supabase
    .from("products")
    .select("category_id")
    .eq("is_active", true)
    .limit(10000);

  if (isUrbanratBrand !== undefined) {
    query = query.eq("is_urbanrat_brand", isUrbanratBrand);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching active product category IDs:", error);
    return new Set<string>();
  }

  const ids = new Set<string>();
  if (data) {
    for (const item of data) {
      if (item.category_id) {
        ids.add(item.category_id);
      }
    }
  }
  return ids;
}

/**
 * Resolves category ID and all its recursive descendant subcategory IDs.
 * Ensures products filed under Level 3/4 categories appear when browsing parent categories.
 */
export async function getCategoryAndDescendantIds(targetId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc("get_category_descendant_ids", {
      p_category_id: targetId,
    });
    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((row: any) => row.id);
    }
  } catch {
    // Fall back to client-side traversal if RPC not yet deployed
  }

  try {
    const { data } = await supabase.from("categories").select("id, parent_id");
    if (!data) return [targetId];

    const result = new Set<string>([targetId]);
    let added = true;
    while (added) {
      added = false;
      for (const cat of data) {
        if (cat.parent_id && result.has(cat.parent_id) && !result.has(cat.id)) {
          result.add(cat.id);
          added = true;
        }
      }
    }
    return Array.from(result);
  } catch {
    return [targetId];
  }
}

/**
 * Fetch products with live filtering, sorting on products.price, and joined price tiers
 */
export async function fetchProducts(
  options: ProductFilterOptions = {}
): Promise<ProductsResponse> {
  ensureConfigured();

  const {
    categoryId,
    subCategoryId,
    categorySlug,
    isUrbanratBrand,
    isFeatured,
    search,
    sort = "featured",
    priceMin,
    priceMax,
    inStockOnly,
    limit = 50,
    offset = 0,
  } = options;

  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT, { count: "exact" })
    .eq("is_active", true);

  const targetCatId = categoryId || subCategoryId;
  if (targetCatId) {
    const matchedCategoryIds = await getCategoryAndDescendantIds(targetCatId);
    if (matchedCategoryIds.length === 1) {
      query = query.eq("category_id", matchedCategoryIds[0]);
    } else {
      query = query.in("category_id", matchedCategoryIds);
    }
  } else if (categorySlug) {
    const { data: catData, error: catError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();

    if (catError) {
      throw new StoreError(catError.message, catError.code, catError);
    }

    if (catData) {
      const matchedCategoryIds = await getCategoryAndDescendantIds(catData.id);
      if (matchedCategoryIds.length === 1) {
        query = query.eq("category_id", matchedCategoryIds[0]);
      } else {
        query = query.in("category_id", matchedCategoryIds);
      }
    } else {
      return { products: [], total: 0 };
    }
  }

  if (typeof isUrbanratBrand === "boolean") {
    query = query.eq("is_urbanrat_brand", isUrbanratBrand);
  }

  if (typeof isFeatured === "boolean") {
    query = query.eq("is_featured", isFeatured);
  }

  if (inStockOnly) {
    query = query.gt("stock", 0);
  }

  if (priceMin !== undefined && priceMin !== null) {
    query = query.gte("price", priceMin);
  }

  if (priceMax !== undefined && priceMax !== null) {
    query = query.lte("price", priceMax);
  }

  if (search && search.trim()) {
    // Sanitize search string so commas/parentheses don't break PostgREST .or() filter syntax
    const cleanSearch = search.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    if (cleanSearch) {
      query = query.or(
        `name.ilike.%${cleanSearch}%,sku.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%,specs->>brand_compatibility.ilike.%${cleanSearch}%,specs->>compatibility_group.ilike.%${cleanSearch}%`
      );
    }
  }

  // Sorting: featured (mixed discovery), price, or newest
  if (sort === "price_asc" || sort === "price-asc") {
    query = query.order("price", { ascending: true });
  } else if (sort === "price_desc" || sort === "price-desc") {
    query = query.order("price", { ascending: false });
  } else if (sort === "newest") {
    query = query.order("created_at", { ascending: false });
  } else {
    // Default "featured" / mixed distribution
    // Keeps highlighted products at top, then distributes evenly across categories & models via UUID distribution
    query = query
      .order("is_featured", { ascending: false })
      .order("id", { ascending: true });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  const products = (data || []).map(formatProduct);
  return {
    products,
    total: count || 0,
  };
}

/**
 * Fetch a single product by slug with price tiers
 */
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  ensureConfigured();

  let { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  // Resilient fallback: URL decoding, space/dash interchange, and case-insensitivity
  if (!data) {
    const decoded = decodeURIComponent(slug).trim();
    const withSpaces = decoded.replace(/-/g, " ");
    const withDashes = decoded.replace(/\s+/g, "-");

    const fallbackQueries = [decoded, withSpaces, withDashes].filter((s) => s !== slug);
    for (const altSlug of fallbackQueries) {
      const retry = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .ilike("slug", altSlug)
        .eq("is_active", true)
        .maybeSingle();

      if (retry.data) {
        data = retry.data;
        break;
      }
    }
  }

  return data ? formatProduct(data) : null;
}

/**
 * Fetch related accessories from same category or category family (sibling & parent categories)
 * with in-stock first ordering and active catalog fallback.
 */
export async function fetchRelatedProducts(
  productId: string,
  categoryId?: string | null,
  categoryIds?: string[],
  limit: number = 8
): Promise<Product[]> {
  ensureConfigured();
  if (!productId) return [];

  const collected: Product[] = [];
  const seenIds = new Set<string>([productId]);

  // 1. Gather all related category IDs: exact category + parent + siblings + children
  const targetCategoryIds = new Set<string>();
  if (categoryId) {
    targetCategoryIds.add(categoryId);
  }
  if (categoryIds && categoryIds.length > 0) {
    categoryIds.forEach((id) => {
      if (id) targetCategoryIds.add(id);
    });
  } else if (categoryId) {
    // Auto-discover sibling and parent categories if not explicitly provided
    try {
      const { data: currentCat } = await supabase
        .from("categories")
        .select("id, parent_id")
        .eq("id", categoryId)
        .maybeSingle();

      if (currentCat) {
        if (currentCat.parent_id) {
          targetCategoryIds.add(currentCat.parent_id);
          const { data: siblings } = await supabase
            .from("categories")
            .select("id")
            .eq("parent_id", currentCat.parent_id)
            .eq("is_active", true);
          siblings?.forEach((s) => targetCategoryIds.add(s.id));
        } else {
          const { data: children } = await supabase
            .from("categories")
            .select("id")
            .eq("parent_id", currentCat.id)
            .eq("is_active", true);
          children?.forEach((c) => targetCategoryIds.add(c.id));
        }
      }
    } catch (e) {
      console.warn("Failed to discover sibling categories:", e);
    }
  }

  // 2. Query exact category first (highest priority)
  if (categoryId) {
    try {
      const { data: exactData } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .neq("id", productId)
        .order("stock", { ascending: false })
        .limit(limit);

      if (exactData) {
        for (const item of exactData) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            collected.push(formatProduct(item));
          }
        }
      }
    } catch (e) {
      console.warn("Error fetching exact category products:", e);
    }
  }

  // 3. If below limit, query sibling and parent categories in the same category family
  const otherCatIds = Array.from(targetCategoryIds).filter((id) => id !== categoryId);
  if (collected.length < limit && otherCatIds.length > 0) {
    const needed = limit - collected.length;
    try {
      const { data: familyData } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .in("category_id", otherCatIds)
        .eq("is_active", true)
        .order("stock", { ascending: false })
        .limit(needed + seenIds.size);

      if (familyData) {
        for (const item of familyData) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            collected.push(formatProduct(item));
            if (collected.length >= limit) break;
          }
        }
      }
    } catch (e) {
      console.warn("Error fetching category family products:", e);
    }
  }

  // 4. Fallback: If still under 4 items, fetch active accessories so section is never empty
  if (collected.length < 4) {
    try {
      const { data: fallbackData } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("is_active", true)
        .order("stock", { ascending: false })
        .limit(limit + 4);

      if (fallbackData) {
        for (const item of fallbackData) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            collected.push(formatProduct(item));
            if (collected.length >= limit) break;
          }
        }
      }
    } catch (e) {
      console.warn("Error fetching fallback products:", e);
    }
  }

  return collected;
}

/**
 * Fetch similar products from same category and compatible model, in stock first, excluding current product.
 * Returns products matching compatibility_group or brand_compatibility.
 */
export async function fetchSimilarProducts(
  currentProduct: Product,
  limit: number = 6
): Promise<Product[]> {
  ensureConfigured();
  if (!currentProduct?.id) return [];

  const compGroup = currentProduct.specs?.compatibility_group;
  const brandComp = currentProduct.specs?.brand_compatibility;

  // Only query similar products if there is a distinct compatibility model/brand
  if (!compGroup && !brandComp) {
    return [];
  }

  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .neq("id", currentProduct.id);

  if (currentProduct.category_id) {
    query = query.eq("category_id", currentProduct.category_id);
  }

  if (compGroup) {
    query = query.eq("specs->>compatibility_group", compGroup);
  } else if (brandComp) {
    query = query.eq("specs->>brand_compatibility", brandComp);
  }

  // In-stock first
  query = query.order("stock", { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return data.map(formatProduct);
}

/**
 * Fetch all active products in the same category/catalog for PDP quick-navigation
 */
export async function fetchCatalogProducts(
  categoryId: string,
  limit: number = 100
): Promise<Product[]> {
  ensureConfigured();
  if (!categoryId) return [];

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    return [];
  }

  return (data || []).map(formatProduct);
}

/**
 * Fetch authenticated customer's orders from live database with timeline events
 */
export async function fetchCustomerOrders(): Promise<Order[]> {
  ensureConfigured();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw new StoreError(authError.message, "AUTH_ERROR", authError);
  }
  if (!authData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_events(*)")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return ((data || []) as Order[]).map((order) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawEvents = (order as any).order_events || order.events || [];
    const sortedEvents = [...rawEvents].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return {
      ...order,
      events: sortedEvents,
      order_events: sortedEvents,
    };
  });
}

/**
 * Fetch a single order by ID via secure RPC with timeline events
 */
export async function fetchOrderById(orderId: string): Promise<Order | null> {
  ensureConfigured();
  if (!orderId) return null;

  const { data, error } = await supabase.rpc("get_order_by_id", {
    p_order_id: orderId.trim(),
  });

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  if (!data) return null;

  const order = data as Order;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawEvents = order.events || (order as any).order_events || [];
  const sortedEvents = [...rawEvents].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return {
    ...order,
    events: sortedEvents,
    order_events: sortedEvents,
  };
}

export interface CreateOrderInput {
  customer: CustomerDetails;
  items: { product_id: string; qty?: number; quantity?: number }[];
  whatsapp_message?: string | null;
}

/**
 * Create order via RPC create_verified_order sending product_id and qty only
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  ensureConfigured();

  const itemsPayload = input.items.map((item) => ({
    product_id: item.product_id,
    qty: item.qty ?? item.quantity ?? 1,
  }));

  const { data, error } = await supabase.rpc("create_verified_order", {
    p_customer: input.customer,
    p_items: itemsPayload,
    p_whatsapp_message: input.whatsapp_message || null,
  });

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return data as Order;
}

// Backward-compatible alias for existing cart call
export const createVerifiedOrder = createOrder;

/**
 * Fetch promotional banners from database
 */
export async function getBanners(placement?: string): Promise<Banner[]> {
  ensureConfigured();

  let query = supabase
    .from("banners")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (placement) {
    query = query.eq("placement", placement);
  }

  const { data, error } = await query;

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return (data as Banner[]) || [];
}

export const fetchBanners = getBanners;

// In-memory cache for store_settings per app load
let cachedSettings: StoreSettings | null = null;
let settingsFetchPromise: Promise<StoreSettings> | null = null;

/**
 * Fetch dynamic store settings (cached once per app load)
 */
export async function getSettings(): Promise<StoreSettings> {
  if (cachedSettings) {
    return cachedSettings;
  }

  if (settingsFetchPromise) {
    return settingsFetchPromise;
  }

  settingsFetchPromise = (async () => {
    ensureConfigured();

    const { data, error } = await supabase
      .from("store_settings")
      .select("key, value");

    if (error) {
      settingsFetchPromise = null;
      throw new StoreError(error.message, error.code, error);
    }

    const defaultSettings: StoreSettings = {
      whatsapp_number: "",
      upi_id: "7000947033-1@okbizaxis",
      store_name: "URT Wholesale",
      free_delivery_min: 999,
      shipping_fee: 49,
      popular_searches: [
        "iPhone 16 Glass",
        "65W GaN",
        "100W Cable",
        "AirBass Pro",
        "MagSafe Car",
      ],
      value_badges: [
        { icon: "ShieldCheck", text: "100% Quality Inspected" },
        { icon: "Truck", text: "Pan-India Express Dispatch" },
        { icon: "Zap", text: "Wholesale Bulk Margin Ready" },
      ],
      store_info: {
        name: "URT Wholesale",
        tagline: "Factory Direct Wholesale Mobile Gear",
        currency: "₹",
      },
    };

    if (data) {
      data.forEach((row: { key: string; value: any }) => {
        if (row.key === "whatsapp_number" && typeof row.value === "string") {
          defaultSettings.whatsapp_number = row.value;
        } else if (row.key === "upi_id" && typeof row.value === "string") {
          defaultSettings.upi_id = row.value;
        } else if (row.key === "store_name" && typeof row.value === "string") {
          defaultSettings.store_name = row.value;
          defaultSettings.store_info.name = row.value;
        } else if (row.key === "free_delivery_min" && typeof row.value === "number") {
          defaultSettings.free_delivery_min = row.value;
        } else if (row.key === "shipping_fee" && typeof row.value === "number") {
          defaultSettings.shipping_fee = row.value;
        } else if (row.key === "popular_searches" && Array.isArray(row.value)) {
          defaultSettings.popular_searches = row.value;
        } else if (row.key === "value_badges" && Array.isArray(row.value)) {
          defaultSettings.value_badges = row.value;
        } else if (row.key === "store_info" && typeof row.value === "object" && row.value !== null) {
          defaultSettings.store_info = {
            ...defaultSettings.store_info,
            ...row.value,
          };
        }
      });
    }

    cachedSettings = defaultSettings;
    return cachedSettings;
  })();

  return settingsFetchPromise;
}

export const fetchStoreSettings = getSettings;

/**
 * Fetch a single legal/content page by slug
 */
export async function getStorePage(slug: string): Promise<StorePage | null> {
  ensureConfigured();

  const { data, error } = await supabase
    .from("store_pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return (data as StorePage) || null;
}

/**
 * Fetch all legal / policy pages (used by MenuPage)
 */
export async function fetchAllStorePages(): Promise<StorePage[]> {
  ensureConfigured();

  const { data, error } = await supabase
    .from("store_pages")
    .select("*");

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return (data as StorePage[]) || [];
}

export interface SearchProductsOptions {
  query: string;
  categoryIds?: string[];
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  isUrbanratBrand?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest" | "price-asc" | "price-desc";
  limit?: number;
  offset?: number;
}

export interface SearchProductsResult {
  normalizedQuery: string;
  correctedQuery: string | null;
  didYouMean: string | null;
  matchType: "exact" | "fuzzy" | "related" | "popular";
  total: number;
  products: Product[];
  searchId?: string;
}

/**
 * Typo-tolerant, synonym-aware search powered by search_products_v2 with resilient fallback
 */
export async function searchProductsV2(
  options: SearchProductsOptions
): Promise<SearchProductsResult> {
  ensureConfigured();
  const rawQuery = options.query || "";
  const norm = normalizeSearchQuery(rawQuery);

  // If a category slug was passed without categoryIds, resolve category ID and descendants
  let resolvedCategoryIds = options.categoryIds;
  if (!resolvedCategoryIds && options.categorySlug) {
    try {
      const { data: catData } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", options.categorySlug)
        .maybeSingle();
      if (catData?.id) {
        resolvedCategoryIds = await getCategoryAndDescendantIds(catData.id);
      }
    } catch {
      // ignore
    }
  }

  // 1. Attempt server-side search_products_v2 RPC
  try {
    const { data, error } = await supabase.rpc("search_products_v2", {
      p_query: rawQuery,
      p_category_ids: resolvedCategoryIds || null,
      p_min_price: options.minPrice ?? null,
      p_max_price: options.maxPrice ?? null,
      p_urbanrat_only: options.isUrbanratBrand || false,
      p_sort: options.sort === "relevance" ? "relevance" : options.sort || "relevance",
      p_limit: options.limit || 24,
      p_offset: options.offset || 0,
    });

    if (!error && data) {
      const res = data as {
        normalized_query: string;
        corrected_query: string | null;
        did_you_mean: string | null;
        match_type: "exact" | "fuzzy" | "related" | "popular";
        total: number;
        products: any[];
      };

      const products = (res.products || []).map(formatProduct);

      // Fire-and-forget log search event
      let searchId: string | undefined;
      if (norm.length > 0) {
        supabase
          .rpc("log_search_event", {
            p_query: rawQuery,
            p_normalized_query: res.normalized_query || norm,
            p_result_count: res.total,
            p_match_type: res.match_type,
          })
          .then(
            ({ data: logId }) => {
              if (logId) searchId = logId;
            },
            () => {}
          );
      }

      return {
        normalizedQuery: res.normalized_query || norm,
        correctedQuery: res.corrected_query,
        didYouMean: res.did_you_mean,
        matchType: res.match_type,
        total: res.total,
        products,
        searchId,
      };
    }
  } catch (rpcErr) {
    console.warn("[Urbanrat Store] search_products_v2 RPC unavailable, falling back:", rpcErr);
  }

  // 2. Resilient Client-Side Fallback using fetchProducts
  const sortParam =
    options.sort === "price-asc" || options.sort === "price_asc"
      ? "price_asc"
      : options.sort === "price-desc" || options.sort === "price_desc"
      ? "price_desc"
      : options.sort === "newest"
      ? "newest"
      : "newest";

  const fetchRes = await fetchProducts({
    search: norm || rawQuery,
    categorySlug: options.categorySlug,
    isUrbanratBrand: options.isUrbanratBrand,
    sort: sortParam,
    priceMin: options.minPrice,
    priceMax: options.maxPrice,
    limit: options.limit || 24,
    offset: options.offset || 0,
  });

  // If 0 results on original query, try generated variants (typos & synonyms)
  if (fetchRes.total === 0 && norm.length >= 2) {
    const variants = generateSearchVariants(norm);
    for (const variant of variants) {
      if (variant !== norm) {
        const altRes = await fetchProducts({
          search: variant,
          categorySlug: options.categorySlug,
          isUrbanratBrand: options.isUrbanratBrand,
          sort: sortParam,
          priceMin: options.minPrice,
          priceMax: options.maxPrice,
          limit: options.limit || 24,
          offset: options.offset || 0,
        });

        if (altRes.total > 0) {
          return {
            normalizedQuery: norm,
            correctedQuery: variant,
            didYouMean: variant,
            matchType: "fuzzy",
            total: altRes.total,
            products: altRes.products,
          };
        }
      }
    }

    // Still 0? Return popular items fallback so customer never sees empty dead-end
    const popRes = await fetchProducts({
      isFeatured: true,
      categorySlug: options.categorySlug,
      isUrbanratBrand: options.isUrbanratBrand,
      limit: options.limit || 24,
      offset: 0,
    });

    return {
      normalizedQuery: norm,
      correctedQuery: null,
      didYouMean: null,
      matchType: "popular",
      total: popRes.total,
      products: popRes.products,
    };
  }

  return {
    normalizedQuery: norm,
    correctedQuery: null,
    didYouMean: null,
    matchType: "exact",
    total: fetchRes.total,
    products: fetchRes.products,
  };
}

/**
 * Fire-and-forget search click logger
 */
export async function logSearchClick(searchId?: string, productId?: string): Promise<void> {
  if (!searchId || !productId) return;
  try {
    await supabase.rpc("log_search_click", {
      p_search_id: searchId,
      p_product_id: productId,
    });
  } catch {
    // Ignore logging errors in client
  }
}

/**
 * Perform server-side search using search_products RPC with pg_trgm
 */
export async function searchProducts(
  query: string,
  maxRows: number = 8
): Promise<Product[]> {
  ensureConfigured();
  if (!query || !query.trim()) return [];

  const res = await searchProductsV2({
    query,
    limit: maxRows,
  });
  return res.products;
}

// ----------------------------------------------------------------------------
// WISHLIST SERVICES
// ----------------------------------------------------------------------------

/**
 * Fetch current authenticated user's wishlist
 */
export async function fetchWishlist(): Promise<Product[]> {
  ensureConfigured();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];

  const { data, error } = await supabase
    .from("wishlist_items")
    .select(`product_id, products(${PRODUCT_SELECT})`)
    .eq("user_id", authData.user.id);

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return (data || [])
    .map((row: any) => row.products)
    .filter(Boolean)
    .map(formatProduct);
}

/**
 * Add a product to the authenticated user's wishlist
 */
export async function addToWishlist(productId: string): Promise<void> {
  ensureConfigured();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    throw new StoreError("User must be logged in to modify wishlist.", "UNAUTHENTICATED");
  }

  const { error } = await supabase.from("wishlist_items").insert({
    user_id: authData.user.id,
    product_id: productId,
  });

  if (error && error.code !== "23505") { // Ignore unique conflict
    throw new StoreError(error.message, error.code, error);
  }
}

/**
 * Remove a product from the authenticated user's wishlist
 */
export async function removeFromWishlist(productId: string): Promise<void> {
  ensureConfigured();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    throw new StoreError("User must be logged in to modify wishlist.", "UNAUTHENTICATED");
  }

  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("user_id", authData.user.id)
    .eq("product_id", productId);

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }
}

/**
 * Check if a product is in the user's wishlist
 */
export async function isInWishlist(productId: string): Promise<boolean> {
  ensureConfigured();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return false;

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("user_id", authData.user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return Boolean(data);
}

// ----------------------------------------------------------------------------
// ADDRESSES SERVICES
// ----------------------------------------------------------------------------

export async function fetchAddresses(): Promise<Address[]> {
  ensureConfigured();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];

  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", authData.user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return (data as Address[]) || [];
}

export async function createAddress(
  address: Omit<Address, "id" | "user_id" | "created_at" | "updated_at">
): Promise<Address> {
  return addressService.createAddress(address as any);
}

export async function updateAddress(
  id: string,
  updates: Partial<Address>
): Promise<Address> {
  return addressService.updateAddress(id, updates as any);
}

export async function deleteAddress(id: string): Promise<void> {
  ensureConfigured();

  const { error } = await supabase.from("addresses").delete().eq("id", id);

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }
}

export async function setDefaultAddress(id: string): Promise<void> {
  ensureConfigured();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    throw new StoreError("User must be logged in.", "UNAUTHENTICATED");
  }

  // Set all to false, then set target to true
  const { error: resetError } = await supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", authData.user.id);

  if (resetError) {
    throw new StoreError(resetError.message, resetError.code, resetError);
  }

  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", id);

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }
}

// ----------------------------------------------------------------------------
// REVIEWS SERVICES
// ----------------------------------------------------------------------------

export const LOCAL_REVIEWS_KEY_PREFIX = "urt_customer_reviews_";

export function getLocalReviews(productId: string): Review[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(`${LOCAL_REVIEWS_KEY_PREFIX}${productId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const GLOBAL_REVIEWS_STORAGE_KEY = "urt_global_customer_reviews";

export function saveGlobalReview(review: Review): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(GLOBAL_REVIEWS_STORAGE_KEY);
    const existing: Review[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((r) => r.id !== review.id);
    window.localStorage.setItem(
      GLOBAL_REVIEWS_STORAGE_KEY,
      JSON.stringify([review, ...filtered])
    );
  } catch (err) {
    console.error("Failed to save review to global storage:", err);
  }
}

export function saveLocalReview(review: Review): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const existing = getLocalReviews(review.product_id);
    const filtered = existing.filter((r) => r.id !== review.id);
    const updated = [review, ...filtered];
    window.localStorage.setItem(
      `${LOCAL_REVIEWS_KEY_PREFIX}${review.product_id}`,
      JSON.stringify(updated)
    );
  } catch (err) {
    console.error("Failed to save review to localStorage:", err);
  }
}

export async function submitReview(input: {
  productId: string;
  productName?: string;
  productImage?: string;
  rating: number;
  title?: string;
  body?: string;
  authorName?: string;
}): Promise<Review> {
  ensureConfigured();

  // Rule:
  // Rating >= 4: auto-approved ("approved") and immediately shows on the product without admin approval.
  // Rating < 4: requires admin approval ("pending") and does NOT show on product until approved.
  const isAutoApproved = input.rating >= 4;
  const initialStatus: "approved" | "pending" = isAutoApproved ? "approved" : "pending";

  let authUser: any = null;
  try {
    const { data: authData } = await supabase.auth.getUser();
    authUser = authData?.user;
  } catch {
    authUser = null;
  }

  const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const authorName =
    input.authorName ||
    authUser?.user_metadata?.full_name ||
    "Verified Wholesale Buyer";

  const fullReview: Review = {
    id: reviewId,
    product_id: input.productId,
    product_name: input.productName || null,
    product_image: input.productImage || null,
    user_id: authUser?.id || "wholesale_buyer",
    user_name: authorName,
    rating: input.rating,
    title: input.title || null,
    body: input.body || null,
    status: initialStatus,
    created_at: new Date().toISOString(),
  };

  // If user is authenticated, attempt remote Supabase insertion
  if (authUser?.id) {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .insert({
          product_id: input.productId,
          user_id: authUser.id,
          rating: input.rating,
          title: input.title || null,
          body: input.authorName
            ? `${input.body || ""}\n\n-- Reviewer: ${input.authorName}`
            : input.body || null,
          status: initialStatus,
        })
        .select()
        .single();

      if (!error && data) {
        fullReview.id = data.id;
      }
    } catch (err) {
      console.warn("Supabase review insert failed, using local persistence:", err);
    }
  }

  // Save to product local storage
  saveLocalReview(fullReview);

  // Save to global review queue so Admin Panel can moderate it
  saveGlobalReview(fullReview);

  return fullReview;
}

export async function getApprovedReviews(productId: string): Promise<Review[]> {
  ensureConfigured();

  let remoteReviews: Review[] = [];
  try {
    // Select all reviews that are STRICTLY approved
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (!error && data) {
      remoteReviews = (data as any[]).map((r) => {
        let cleanBody = r.body;
        let author = "Verified Wholesale Buyer";
        if (cleanBody) {
          const match = cleanBody.match(/\n\n-- Reviewer:\s*(.+)$/);
          if (match) {
            author = match[1].trim();
            cleanBody = cleanBody.replace(/\n\n-- Reviewer:\s*.+$/, "").trim();
          }
        }
        return {
          ...r,
          body: cleanBody,
          user_name: r.user_name || author,
        };
      });
    }
  } catch (err) {
    console.warn("Could not fetch remote reviews, using local fallback:", err);
  }

  // Merge with locally stored reviews that are STRICTLY approved
  const localReviews = getLocalReviews(productId).filter((r) => r.status === "approved");
  const map = new Map<string, Review>();

  for (const r of remoteReviews) {
    map.set(r.id, r);
  }
  for (const l of localReviews) {
    if (!map.has(l.id)) {
      map.set(l.id, l);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Submit authorized dealer application via secure RPC
 */
export async function submitDealerApplication(formData: Record<string, any>): Promise<{
  application_no: string;
  created_at: string;
}> {
  ensureConfigured();

  const { data, error } = await supabase.rpc("submit_dealer_application", {
    p_data: formData,
  });

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return data as { application_no: string; created_at: string };
}

