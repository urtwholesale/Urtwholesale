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
  sort?: "price_asc" | "price_desc" | "newest" | "price-asc" | "price-desc";
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
    sort = "newest",
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

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  } else if (subCategoryId) {
    query = query.eq("category_id", subCategoryId);
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
      query = query.eq("category_id", catData.id);
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
    query = query.ilike("name", `%${search.trim()}%`);
  }

  // Sorting based on products.price (starting price) or created_at
  if (sort === "price_asc" || sort === "price-asc") {
    query = query.order("price", { ascending: true });
  } else if (sort === "price_desc" || sort === "price-desc") {
    query = query.order("price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
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

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return data ? formatProduct(data) : null;
}

/**
 * Fetch related products from same category with price tiers
 */
export async function fetchRelatedProducts(
  productId: string,
  categoryId?: string | null
): Promise<Product[]> {
  ensureConfigured();
  if (!categoryId) return [];

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .neq("id", productId)
    .limit(4);

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return (data || []).map(formatProduct);
}

/**
 * Fetch authenticated customer's orders from live database
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
    .select("*")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return (data as Order[]) || [];
}

/**
 * Fetch a single order by ID via secure RPC
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

  return (data as Order) || null;
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

/**
 * Perform server-side search using search_products RPC with pg_trgm
 */
export async function searchProducts(
  query: string,
  maxRows: number = 8
): Promise<Product[]> {
  ensureConfigured();
  if (!query || !query.trim()) return [];

  const { data, error } = await supabase.rpc("search_products", {
    q: query.trim(),
    max_rows: maxRows,
  });

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return (data || []).map(formatProduct);
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
  ensureConfigured();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    throw new StoreError("User must be logged in to create address.", "UNAUTHENTICATED");
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert({
      ...address,
      user_id: authData.user.id,
    })
    .select()
    .single();

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return data as Address;
}

export async function updateAddress(
  id: string,
  updates: Partial<Address>
): Promise<Address> {
  ensureConfigured();

  const { data, error } = await supabase
    .from("addresses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return data as Address;
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

export async function submitReview(input: {
  productId: string;
  rating: number;
  title?: string;
  body?: string;
}): Promise<Review> {
  ensureConfigured();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    throw new StoreError("User must be logged in to submit a review.", "UNAUTHENTICATED");
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      product_id: input.productId,
      user_id: authData.user.id,
      rating: input.rating,
      title: input.title || null,
      body: input.body || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return data as Review;
}

export async function getApprovedReviews(productId: string): Promise<Review[]> {
  ensureConfigured();

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    throw new StoreError(error.message, error.code, error);
  }

  return (data as Review[]) || [];
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

