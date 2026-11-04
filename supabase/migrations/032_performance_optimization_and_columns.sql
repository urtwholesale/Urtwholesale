-- ============================================================================
-- Migration 032: Website Performance Optimization & Schema Enhancement
-- ============================================================================
-- Purpose:
--   1. Add 'colors' (text[]) to public.products to back frontend color swatches.
--   2. Add 'views_count' & 'sales_count' (integer) to public.products for high-speed
--      trending and bestseller merchandising without expensive table joins.
--   3. Add 'verified_purchase' (boolean) & 'likes_count' (integer) to public.reviews.
--   4. Update public.products_public and public.products_admin views to include
--      the new columns (colors, views_count, sales_count).
--   5. Install high-performance partial composite indexes on active catalog rows,
--      user orders, review feeds, category hierarchy, and storefront banners.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD COLUMNS TO PRODUCTS
-- ----------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS colors text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_count integer DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 2. ADD COLUMNS TO REVIEWS
-- ----------------------------------------------------------------------------

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS verified_purchase boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 3. RECREATE STOREFRONT CATALOG VIEWS WITH NEW COLUMNS
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.products_public CASCADE;
CREATE OR REPLACE VIEW public.products_public
WITH (security_invoker = on)
AS
SELECT
  p.id,
  p.name,
  p.slug,
  p.description,
  p.short_description,
  p.price,
  p.mrp,
  p.sku,
  p.images,
  p.category_id,
  p.is_urbanrat_brand,
  p.is_active,
  p.is_featured,
  p.is_trending,
  p.specs,
  p.attributes,
  p.warranty_months,
  p.tags,
  p.keywords,
  p.brand,
  p.min_order_qty,
  p.order_qty_step,
  p.max_order_qty,
  p.rating_avg,
  p.rating_count,
  p.in_stock,
  p.colors,
  p.views_count,
  p.sales_count,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', pt.id,
          'product_id', pt.product_id,
          'min_qty', pt.min_qty,
          'unit_price', pt.unit_price,
          'created_at', pt.created_at
        ) ORDER BY pt.min_qty ASC
      )
      FROM public.product_price_tiers pt
      WHERE pt.product_id = p.id
    ),
    '[]'::json
  ) AS price_tiers,
  p.created_at,
  p.updated_at
FROM public.products p
WHERE p.is_active = true;

COMMENT ON VIEW public.products_public IS
  'High-performance safe storefront catalog view with embedded price tiers and color variants.';

GRANT SELECT ON public.products_public TO anon, authenticated;

-- Admin View
DROP VIEW IF EXISTS public.products_admin CASCADE;
CREATE OR REPLACE VIEW public.products_admin
WITH (security_barrier = true)
AS
SELECT *
FROM public.products
WHERE public.is_admin();

GRANT SELECT ON public.products_admin TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. HIGH-PERFORMANCE PARTIAL & COMPOSITE INDEXES
-- ----------------------------------------------------------------------------

-- A. Products: Partial indexes on active storefront rows (skips inactive products)
CREATE INDEX IF NOT EXISTS idx_products_active_category_sort
  ON public.products (category_id, created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_featured_sort
  ON public.products (is_featured, created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_trending_sort
  ON public.products (is_trending, created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_price_asc
  ON public.products (price ASC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_price_desc
  ON public.products (price DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_colors
  ON public.products USING gin (colors);

-- B. Orders: Accelerated customer portal lookups & anti-abuse checks
CREATE INDEX IF NOT EXISTS idx_orders_user_created_desc
  ON public.orders (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_rate_check
  ON public.orders ((customer->>'phone'), status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_created_desc
  ON public.orders (status, created_at DESC);

-- C. Reviews: Index-only scan for product page approved review feeds
CREATE INDEX IF NOT EXISTS idx_reviews_product_approved_created
  ON public.reviews (product_id, created_at DESC)
  WHERE status = 'approved';

-- D. Order Events: Order detail history timeline
CREATE INDEX IF NOT EXISTS idx_order_events_order_created_asc
  ON public.order_events (order_id, created_at ASC);

-- E. Categories: High-speed tree traversal for header/menu navigation
CREATE INDEX IF NOT EXISTS idx_categories_active_parent_sort
  ON public.categories (parent_id, sort_order ASC)
  WHERE is_active = true;

-- F. Banners: Instant banner delivery by placement & sort order
CREATE INDEX IF NOT EXISTS idx_banners_placement_active_sort
  ON public.banners (placement, sort_order ASC)
  WHERE is_active = true;

-- G. Marquee Announcements: Fast active ticker loading
CREATE INDEX IF NOT EXISTS idx_marquee_active_sort
  ON public.marquee_announcements (sort_order ASC)
  WHERE is_active = true;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

