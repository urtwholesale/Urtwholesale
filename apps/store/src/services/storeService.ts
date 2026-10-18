import { supabase } from "../lib/supabase";
import type {
  Category,
  Product,
  Order,
  CustomerDetails,
  StoreSettings,
  Banner,
  StorePage,
} from "@urbanrat/shared";

export interface ProductFilterOptions {
  categoryId?: string | null;
  subCategoryId?: string | null;
  categorySlug?: string | null;
  isUrbanratBrand?: boolean;
  isFeatured?: boolean;
  search?: string;
  sort?: "price_asc" | "price_desc" | "newest";
  priceMin?: number;
  priceMax?: number;
  limit?: number;
  offset?: number;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
}

/**
 * Check if Supabase client has valid project configuration
 */
export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      !url.includes("your-project-id") &&
      !url.includes("placeholder") &&
      !key.includes("your-anon-key") &&
      !key.includes("placeholder")
  );
}

/**
 * Fetch all active categories (parents and subcategories) from live database
 */
export async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[Urbanrat Store] Error fetching categories:", error);
      return [];
    }

    return (data as Category[]) || [];
  } catch (err) {
    console.error("[Urbanrat Store] Exception fetching categories:", err);
    return [];
  }
}

/**
 * Fetch products with live filtering, search, sorting, and pagination
 */
export async function fetchProducts(
  options: ProductFilterOptions = {}
): Promise<ProductsResponse> {
  if (!isSupabaseConfigured()) {
    return { products: [], total: 0 };
  }

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
    limit = 50,
    offset = 0,
  } = options;

  try {
    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .eq("is_active", true);

    if (isUrbanratBrand !== undefined) {
      query = query.eq("is_urbanrat_brand", isUrbanratBrand);
    }

    if (isFeatured !== undefined) {
      query = query.eq("is_featured", isFeatured);
    }

    if (subCategoryId) {
      query = query.eq("category_id", subCategoryId);
    } else if (categoryId) {
      // Find category and its children
      const allCats = await fetchCategories();
      const childIds = allCats
        .filter((c) => c.parent_id === categoryId)
        .map((c) => c.id);
      const matchIds = [categoryId, ...childIds];
      query = query.in("category_id", matchIds);
    } else if (categorySlug && categorySlug !== "all") {
      const allCats = await fetchCategories();
      const target = allCats.find((c) => c.slug === categorySlug);
      if (target) {
        const childIds = allCats
          .filter((c) => c.parent_id === target.id)
          .map((c) => c.id);
        const matchIds = [target.id, ...childIds];
        query = query.in("category_id", matchIds);
      }
    }

    if (priceMin !== undefined && priceMin > 0) {
      query = query.gte("price", priceMin);
    }

    if (priceMax !== undefined && priceMax > 0) {
      query = query.lte("price", priceMax);
    }

    if (search && search.trim()) {
      query = query.ilike("name", `%${search.trim()}%`);
    }

    if (sort === "price_asc") {
      query = query.order("price", { ascending: true });
    } else if (sort === "price_desc") {
      query = query.order("price", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("[Urbanrat Store] Error fetching products:", error);
      return { products: [], total: 0 };
    }

    return {
      products: (data as Product[]) || [],
      total: count ?? (data?.length || 0),
    };
  } catch (err) {
    console.error("[Urbanrat Store] Exception fetching products:", err);
    return { products: [], total: 0 };
  }
}

/**
 * Fetch a single product by slug from live database
 */
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[Urbanrat Store] Error fetching product by slug:", error);
      return null;
    }

    return (data as Product) || null;
  } catch (err) {
    console.error("[Urbanrat Store] Exception fetching product by slug:", err);
    return null;
  }
}

/**
 * Fetch related products from same category or brand from live database
 */
export async function fetchRelatedProducts(
  productId: string,
  categoryId?: string | null
): Promise<Product[]> {
  if (!isSupabaseConfigured() || !categoryId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("category_id", categoryId)
      .eq("is_active", true)
      .neq("id", productId)
      .limit(4);

    if (error) {
      console.error("[Urbanrat Store] Error fetching related products:", error);
      return [];
    }

    return (data as Product[]) || [];
  } catch (err) {
    console.error("[Urbanrat Store] Exception fetching related products:", err);
    return [];
  }
}

/**
 * Fetch authenticated customer's orders from live database
 */
export async function fetchCustomerOrders(): Promise<Order[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return [];
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Urbanrat Store] Error fetching customer orders:", error);
      return [];
    }

    return (data as Order[]) || [];
  } catch (err) {
    console.error("[Urbanrat Store] Exception fetching customer orders:", err);
    return [];
  }
}

/**
 * Fetch a single order by ID via RPC or secure lookup
 */
export async function fetchOrderById(orderId: string): Promise<Order | null> {
  if (!isSupabaseConfigured() || !orderId) {
    return null;
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_order_by_id",
      { p_order_id: orderId.trim() }
    );

    if (!rpcError && rpcData) {
      return rpcData as Order;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId.trim())
      .maybeSingle();

    if (error) {
      console.error("[Urbanrat Store] Error fetching order by ID:", error);
      return null;
    }

    return (data as Order) || null;
  } catch (err) {
    console.error("[Urbanrat Store] Exception fetching order by ID:", err);
    return null;
  }
}

/**
 * Generate collision-checked order ID in URT-YYMMDD-XXXX format
 */
export async function generateUniqueOrderId(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let attempt = 0; attempt < 5; attempt++) {
    let rand = "";
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const candidateId = `URT-${yy}${mm}${dd}-${rand}`;

    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase
          .from("orders")
          .select("id")
          .eq("id", candidateId)
          .maybeSingle();
        if (data) continue;
      } catch {
        // Continue
      }
    }

    return candidateId;
  }

  return `URT-${yy}${mm}${dd}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export interface CreateOrderInput {
  id: string;
  items: { product_id: string; quantity: number }[];
  customer: CustomerDetails;
  whatsapp_message?: string | null;
}

/**
 * Create order with server-verified prices via RPC create_verified_order
 */
export async function createVerifiedOrder(input: CreateOrderInput): Promise<Order> {
  if (!isSupabaseConfigured()) {
    throw new Error("Cannot place order: Supabase connection is not configured.");
  }

  const { data, error } = await supabase.rpc("create_verified_order", {
    p_order_id: input.id,
    p_customer: input.customer,
    p_items: input.items,
    p_whatsapp_message: input.whatsapp_message || null,
  });

  if (error) {
    console.error("[Urbanrat Store] create_verified_order RPC failed:", error);
    throw new Error(error.message || "Failed to create verified order.");
  }

  return data as Order;
}

/**
 * Fetch dynamic store settings (WhatsApp number, popular searches, badges, store info)
 */
export async function fetchStoreSettings(): Promise<StoreSettings> {
  const defaultSettings: StoreSettings = {
    whatsapp_number: "917000947033",
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

  if (!isSupabaseConfigured()) {
    return defaultSettings;
  }

  try {
    const { data, error } = await supabase.from("store_settings").select("key, value");

    if (error || !data || data.length === 0) {
      return defaultSettings;
    }

    const settings: Partial<StoreSettings> = {};
    for (const row of data) {
      if (row.key === "whatsapp_number" && typeof row.value === "string") {
        settings.whatsapp_number = row.value;
      } else if (row.key === "popular_searches" && Array.isArray(row.value)) {
        settings.popular_searches = row.value;
      } else if (row.key === "value_badges" && Array.isArray(row.value)) {
        settings.value_badges = row.value;
      } else if (row.key === "store_info" && typeof row.value === "object") {
        settings.store_info = row.value;
      }
    }

    return { ...defaultSettings, ...settings };
  } catch (err) {
    console.error("[Urbanrat Store] Error fetching store settings:", err);
    return defaultSettings;
  }
}

/**
 * Fetch active promotional banners from database
 */
export async function fetchBanners(
  placement?: "home_hero" | "home_brand" | "urbanrat_hero"
): Promise<Banner[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
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
      console.error("[Urbanrat Store] Error fetching banners:", error);
      return [];
    }

    return (data as Banner[]) || [];
  } catch (err) {
    console.error("[Urbanrat Store] Exception fetching banners:", err);
    return [];
  }
}

/**
 * Fetch legal policy / informational pages (About, Terms, Privacy) from database
 */
export async function fetchStorePage(slug: string): Promise<StorePage | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("store_pages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("[Urbanrat Store] Error fetching store page:", error);
      return null;
    }

    return (data as StorePage) || null;
  } catch (err) {
    console.error("[Urbanrat Store] Exception fetching store page:", err);
    return null;
  }
}

/**
 * Fetch all legal / informational pages
 */
export async function fetchAllStorePages(): Promise<StorePage[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase.from("store_pages").select("*");
    if (error) {
      console.error("[Urbanrat Store] Error fetching store pages:", error);
      return [];
    }
    return (data as StorePage[]) || [];
  } catch (err) {
    console.error("[Urbanrat Store] Exception fetching store pages:", err);
    return [];
  }
}
