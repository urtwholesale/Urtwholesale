import { supabase } from "../lib/supabase";
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from "../data/mockData";
import type { Category, Product, Order, OrderItem, CustomerDetails } from "@urbanrat/shared";

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
function isSupabaseConfigured(): boolean {
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
 * Fetch all active categories (parents and subcategories)
 */
export async function fetchCategories(): Promise<Category[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        return data as Category[];
      }
    } catch (err) {
      console.warn("[Urbanrat Store] Supabase fetchCategories failed, using fallback data:", err);
    }
  }

  // Fallback to rich mock categories
  return MOCK_CATEGORIES.filter((c) => c.is_active);
}

/**
 * Fetch products with filtering, search, sorting, and pagination
 */
export async function fetchProducts(
  options: ProductFilterOptions = {}
): Promise<ProductsResponse> {
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

  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from("products").select("*", { count: "exact" }).eq("is_active", true);

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

      if (!error && data && data.length > 0) {
        return {
          products: data as Product[],
          total: count ?? data.length,
        };
      }
    } catch (err) {
      console.warn("[Urbanrat Store] Supabase fetchProducts failed, using fallback data:", err);
    }
  }

  // Fallback to mock data with identical filter/sort engine
  let filtered = [...MOCK_PRODUCTS].filter((p) => p.is_active);

  if (isUrbanratBrand !== undefined) {
    filtered = filtered.filter((p) => p.is_urbanrat_brand === isUrbanratBrand);
  }

  if (isFeatured !== undefined) {
    filtered = filtered.filter((p) => p.is_featured === isFeatured);
  }

  if (subCategoryId) {
    filtered = filtered.filter((p) => p.category_id === subCategoryId);
  } else if (categoryId) {
    const childIds = MOCK_CATEGORIES.filter((c) => c.parent_id === categoryId).map((c) => c.id);
    const validIds = new Set([categoryId, ...childIds]);
    filtered = filtered.filter((p) => p.category_id && validIds.has(p.category_id));
  } else if (categorySlug && categorySlug !== "all") {
    const target = MOCK_CATEGORIES.find((c) => c.slug === categorySlug);
    if (target) {
      const childIds = MOCK_CATEGORIES.filter((c) => c.parent_id === target.id).map((c) => c.id);
      const validIds = new Set([target.id, ...childIds]);
      filtered = filtered.filter((p) => p.category_id && validIds.has(p.category_id));
    }
  }

  if (priceMin !== undefined && priceMin > 0) {
    filtered = filtered.filter((p) => p.price >= priceMin);
  }

  if (priceMax !== undefined && priceMax > 0) {
    filtered = filtered.filter((p) => p.price <= priceMax);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    );
  }

  if (sort === "price_asc") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sort === "price_desc") {
    filtered.sort((a, b) => b.price - a.price);
  } else {
    filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    products: paginated,
    total,
  };
}

/**
 * Fetch a single product by slug
 */
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (!error && data) {
        return data as Product;
      }
    } catch (err) {
      console.warn("[Urbanrat Store] Supabase fetchProductBySlug failed, using fallback:", err);
    }
  }

  const found = MOCK_PRODUCTS.find((p) => p.slug === slug && p.is_active);
  return found || null;
}

/**
 * Fetch related products from same category or brand
 */
export async function fetchRelatedProducts(
  productId: string,
  categoryId?: string | null
): Promise<Product[]> {
  if (isSupabaseConfigured() && categoryId) {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .neq("id", productId)
        .limit(4);

      if (!error && data && data.length > 0) {
        return data as Product[];
      }
    } catch (err) {
      console.warn("[Urbanrat Store] Supabase fetchRelatedProducts failed, using fallback:", err);
    }
  }

  return MOCK_PRODUCTS.filter(
    (p) => p.id !== productId && (!categoryId || p.category_id === categoryId)
  ).slice(0, 4);
}

/**
 * Fetch authenticated customer's orders
 */
export async function fetchCustomerOrders(): Promise<Order[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", authData.user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          return data as Order[];
        }
      }
    } catch (err) {
      console.warn("[Urbanrat Store] Supabase fetchCustomerOrders failed:", err);
    }
  }

  // Demo order placeholder
  return [
    {
      id: "ord-demo-1029",
      user_id: "demo-user",
      items: [
        {
          product_id: "prod-1",
          name: "Urbanrat 9H Diamond Armor Tempered Glass",
          price: 199,
          quantity: 2,
          image: MOCK_PRODUCTS[0]?.images[0] || null,
        },
      ],
      total: 398,
      status: "delivered",
      whatsapp_message: "Hi Urbanrat, order ord-demo-1029 confirmed.",
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  ];
}

const LOCAL_ORDERS_KEY = "urt_orders";

export function getLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalOrder(order: Order): void {
  try {
    const orders = getLocalOrders();
    const updated = [order, ...orders.filter((o) => o.id !== order.id)];
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to persist order to localStorage:", err);
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

    const cached = getLocalOrders();
    if (cached.some((o) => o.id === candidateId)) {
      continue;
    }

    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase
          .from("orders")
          .select("id")
          .eq("id", candidateId)
          .maybeSingle();
        if (data) continue;
      } catch {
        // Table might be waiting on migration
      }
    }

    return candidateId;
  }

  return `URT-${yy}${mm}${dd}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export interface CreateOrderPayload {
  id: string;
  items: OrderItem[];
  subtotal: number;
  savings: number;
  shipping: number;
  total: number;
  customer: CustomerDetails;
  whatsapp_message?: string | null;
}

/**
 * Save new order to database (Supabase + localStorage dual-mode persistence)
 */
export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const newOrder: Order = {
    id: payload.id,
    customer: payload.customer,
    items: payload.items,
    subtotal: payload.subtotal,
    savings: payload.savings,
    shipping: payload.shipping,
    total: payload.total,
    status: "pending",
    whatsapp_message: payload.whatsapp_message || null,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const insertData = {
        id: newOrder.id,
        user_id: authData?.user?.id || null,
        customer: newOrder.customer,
        items: newOrder.items,
        subtotal: newOrder.subtotal,
        savings: newOrder.savings,
        shipping: newOrder.shipping,
        total: newOrder.total,
        status: newOrder.status,
        whatsapp_message: newOrder.whatsapp_message,
        created_at: newOrder.created_at,
      };

      const { data, error } = await supabase
        .from("orders")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const created = data as Order;
      saveLocalOrder(created);
      return created;
    } catch (err) {
      console.error("[Urbanrat Store] Supabase order creation failed:", err);
      throw err;
    }
  }

  // Fallback to local storage persistence when Supabase credentials are not configured
  saveLocalOrder(newOrder);
  return newOrder;
}

/**
 * Fetch a single order by ID (public access via RPC or table lookup)
 */
export async function fetchOrderById(orderId: string): Promise<Order | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc("get_order_by_id", { p_order_id: orderId });

      if (!rpcError && rpcData) {
        return rpcData as Order;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (!error && data) {
        return data as Order;
      }
    } catch (err) {
      console.warn("[Urbanrat Store] Supabase fetchOrderById failed:", err);
    }
  }

  const localOrders = getLocalOrders();
  const found = localOrders.find((o) => o.id === orderId);
  return found || null;
}

