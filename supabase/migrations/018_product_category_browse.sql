-- ============================================================================
-- Migration: 018_product_category_browse.sql
-- Description: Server-side category-wise product browsing, recursive product counts,
--              flexible filtering/pagination, and bulk product management RPCs.
-- ============================================================================

-- 1. Ensure indexes on foreign keys and lookup columns
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON public.products(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_urbanrat_brand ON public.products(is_urbanrat_brand);

-- ----------------------------------------------------------------------------
-- 2. RPC: admin_category_product_counts
-- Returns direct, total (recursive descendants), and active product counts for
-- every category, plus an extra row for uncategorized products (category_id = NULL).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_category_product_counts()
RETURNS TABLE (
  category_id uuid,
  direct_count bigint,
  total_count bigint,
  active_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  RETURN QUERY
  WITH RECURSIVE category_tree AS (
    -- Anchor member: every category is its own root ancestor
    SELECT
      c.id AS ancestor_id,
      c.id AS descendant_id
    FROM public.categories c

    UNION ALL

    -- Recursive member: traverse down children hierarchy
    SELECT
      ct.ancestor_id,
      child.id AS descendant_id
    FROM category_tree ct
    JOIN public.categories child ON child.parent_id = ct.descendant_id
  ),
  direct_counts AS (
    SELECT
      p.category_id AS cat_id,
      count(*)::bigint AS cnt
    FROM public.products p
    WHERE p.category_id IS NOT NULL
    GROUP BY p.category_id
  ),
  aggregated_counts AS (
    SELECT
      ct.ancestor_id AS cat_id,
      count(p.id)::bigint AS total_cnt,
      count(p.id) FILTER (WHERE p.is_active = TRUE)::bigint AS active_cnt
    FROM category_tree ct
    JOIN public.products p ON p.category_id = ct.descendant_id
    GROUP BY ct.ancestor_id
  )
  -- All categories from table
  SELECT
    c.id AS category_id,
    COALESCE(dc.cnt, 0)::bigint AS direct_count,
    COALESCE(ac.total_cnt, 0)::bigint AS total_count,
    COALESCE(ac.active_cnt, 0)::bigint AS active_count
  FROM public.categories c
  LEFT JOIN direct_counts dc ON dc.cat_id = c.id
  LEFT JOIN aggregated_counts ac ON ac.cat_id = c.id

  UNION ALL

  -- Uncategorized products row (category_id IS NULL)
  SELECT
    NULL::uuid AS category_id,
    count(*)::bigint AS direct_count,
    count(*)::bigint AS total_count,
    count(*) FILTER (WHERE p.is_active = TRUE)::bigint AS active_count
  FROM public.products p
  WHERE p.category_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = p.category_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. RPC: admin_list_products
-- Server-side filtering, searching (name, sku, brand, keywords), sorting,
-- and pagination. Returns product records with total_count.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_products(
  p_category_id uuid DEFAULT NULL,
  p_include_descendants boolean DEFAULT TRUE,
  p_uncategorized_only boolean DEFAULT FALSE,
  p_search text DEFAULT NULL,
  p_urbanrat_only boolean DEFAULT FALSE,
  p_low_stock_only boolean DEFAULT FALSE,
  p_status text DEFAULT 'all',
  p_sort text DEFAULT 'updated_at_desc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  sku text,
  price numeric,
  mrp numeric,
  stock integer,
  low_stock_threshold integer,
  min_order_qty integer,
  order_qty_step integer,
  warranty_months integer,
  short_description text,
  description text,
  category_id uuid,
  category_name text,
  images text[],
  brand text,
  attributes jsonb,
  keywords text[],
  specs jsonb,
  is_urbanrat_brand boolean,
  is_featured boolean,
  is_trending boolean,
  is_active boolean,
  price_tiers jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search text := NULLIF(TRIM(p_search), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  RETURN QUERY
  WITH RECURSIVE target_categories AS (
    -- If category_id specified and include_descendants requested:
    SELECT c.id AS cat_id
    FROM public.categories c
    WHERE c.id = p_category_id

    UNION ALL

    SELECT child.id AS cat_id
    FROM target_categories tc
    JOIN public.categories child ON child.parent_id = tc.cat_id
    WHERE p_include_descendants = TRUE
  ),
  filtered_products AS (
    SELECT
      p.id,
      p.name,
      p.slug,
      p.sku,
      p.price,
      p.mrp,
      p.stock,
      COALESCE(p.low_stock_threshold, 5) AS low_stock_threshold,
      COALESCE(p.min_order_qty, 1) AS min_order_qty,
      COALESCE(p.order_qty_step, 1) AS order_qty_step,
      COALESCE(p.warranty_months, 0) AS warranty_months,
      p.short_description,
      p.description,
      p.category_id,
      cat.name AS category_name,
      p.images,
      p.brand,
      p.attributes,
      p.keywords,
      p.specs,
      p.is_urbanrat_brand,
      p.is_featured,
      p.is_trending,
      p.is_active,
      p.created_at,
      p.updated_at
    FROM public.products p
    LEFT JOIN public.categories cat ON cat.id = p.category_id
    WHERE
      -- Category filter
      (
        CASE
          WHEN p_uncategorized_only = TRUE THEN p.category_id IS NULL
          WHEN p_category_id IS NOT NULL AND p_include_descendants = TRUE THEN
            p.category_id IN (SELECT cat_id FROM target_categories)
          WHEN p_category_id IS NOT NULL AND p_include_descendants = FALSE THEN
            p.category_id = p_category_id
          ELSE TRUE
        END
      )
      -- Search filter across name, sku, brand, and keywords
      AND (
        v_search IS NULL OR
        p.name ILIKE ('%' || v_search || '%') OR
        p.sku ILIKE ('%' || v_search || '%') OR
        COALESCE(p.brand, '') ILIKE ('%' || v_search || '%') OR
        EXISTS (
          SELECT 1 FROM unnest(COALESCE(p.keywords, '{}'::text[])) kw
          WHERE kw ILIKE ('%' || v_search || '%')
        )
      )
      -- Urbanrat brand filter
      AND (
        p_urbanrat_only = FALSE OR p.is_urbanrat_brand = TRUE
      )
      -- Low stock filter
      AND (
        p_low_stock_only = FALSE OR p.stock <= COALESCE(p.low_stock_threshold, 5)
      )
      -- Status filter
      AND (
        p_status IS NULL OR
        p_status = 'all' OR
        (p_status = 'active' AND p.is_active = TRUE) OR
        (p_status = 'inactive' AND p.is_active = FALSE)
      )
  ),
  counted_products AS (
    SELECT
      fp.*,
      count(*) OVER()::bigint AS total_count
    FROM filtered_products fp
  ),
  sorted_products AS (
    SELECT cp.*
    FROM counted_products cp
    ORDER BY
      CASE WHEN p_sort = 'name_asc' THEN cp.name END ASC,
      CASE WHEN p_sort = 'name_desc' THEN cp.name END DESC,
      CASE WHEN p_sort = 'price_asc' THEN cp.price END ASC,
      CASE WHEN p_sort = 'price_desc' THEN cp.price END DESC,
      CASE WHEN p_sort = 'stock_asc' THEN cp.stock END ASC,
      CASE WHEN p_sort = 'stock_desc' THEN cp.stock END DESC,
      CASE WHEN p_sort = 'updated_at_asc' THEN cp.updated_at END ASC,
      -- default sort: updated_at DESC
      cp.updated_at DESC,
      cp.id DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0)
  )
  SELECT
    sp.id,
    sp.name,
    sp.slug,
    sp.sku,
    sp.price,
    sp.mrp,
    sp.stock,
    sp.low_stock_threshold,
    sp.min_order_qty,
    sp.order_qty_step,
    sp.warranty_months,
    sp.short_description,
    sp.description,
    sp.category_id,
    sp.category_name,
    sp.images,
    sp.brand,
    sp.attributes,
    sp.keywords,
    sp.specs,
    sp.is_urbanrat_brand,
    sp.is_featured,
    sp.is_trending,
    sp.is_active,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'min_qty', pt.min_qty,
            'unit_price', pt.unit_price
          ) ORDER BY pt.min_qty ASC
        )
        FROM public.product_price_tiers pt
        WHERE pt.product_id = sp.id
      ),
      '[]'::jsonb
    ) AS price_tiers,
    sp.created_at,
    sp.updated_at,
    sp.total_count
  FROM sorted_products sp;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. RPC: admin_bulk_move_products
-- Moves a batch of products to a target category in one transaction.
-- If p_category_id IS NULL, products become uncategorized.
-- Validates target category exists and is active.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_move_products(
  p_product_ids uuid[],
  p_category_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_cat_exists boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Validate target category if not null
  IF p_category_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.categories
      WHERE id = p_category_id AND is_active = TRUE
    ) INTO v_cat_exists;

    IF NOT v_cat_exists THEN
      RAISE EXCEPTION 'Target category not found or inactive.';
    END IF;
  END IF;

  -- Perform bulk move
  UPDATE public.products
  SET
    category_id = p_category_id,
    updated_at = now()
  WHERE id = ANY(p_product_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Write audit log if an audit table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO public.audit_logs (action, details, created_at)
    VALUES (
      'bulk_move_products',
      jsonb_build_object(
        'count', v_count,
        'target_category_id', p_category_id,
        'product_ids', p_product_ids
      ),
      now()
    );
  END IF;

  RETURN v_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC: admin_bulk_update_product_status
-- Bulk activate or deactivate products.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_update_product_status(
  p_product_ids uuid[],
  p_is_active boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.products
  SET
    is_active = p_is_active,
    updated_at = now()
  WHERE id = ANY(p_product_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
