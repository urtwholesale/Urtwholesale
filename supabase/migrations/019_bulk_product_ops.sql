-- ============================================================================
-- Migration: 019_bulk_product_ops.sql
-- Description: Bulk product editing database layer with transactional dry-run,
--              before-snapshot auditing, selective error resilience, and undo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLE: bulk_operations
-- Audit log and undo snapshot store for all admin bulk operations.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bulk_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_type text NOT NULL CHECK (op_type IN ('details', 'tiers', 'stock', 'images')),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  before_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  affected_count integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('applied', 'undone', 'failed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_bulk_operations_created_at
  ON public.bulk_operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_status
  ON public.bulk_operations(status);

ALTER TABLE public.bulk_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view bulk operations" ON public.bulk_operations;
CREATE POLICY "Admins can view bulk operations"
  ON public.bulk_operations FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert bulk operations" ON public.bulk_operations;
CREATE POLICY "Admins can insert bulk operations"
  ON public.bulk_operations FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update bulk operations" ON public.bulk_operations;
CREATE POLICY "Admins can update bulk operations"
  ON public.bulk_operations FOR UPDATE
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. RPC: admin_list_product_ids
-- Returns all product IDs matching current filter criteria across pages.
-- Used for "Select all N products in this category".
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_product_ids(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE (product_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_category_id uuid;
  v_include_descendants boolean;
  v_uncategorized_only boolean;
  v_search text;
  v_urbanrat_only boolean;
  v_low_stock_only boolean;
  v_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  v_category_id := (p_filters->>'categoryId')::uuid;
  v_include_descendants := COALESCE((p_filters->>'includeDescendants')::boolean, TRUE);
  v_uncategorized_only := COALESCE((p_filters->>'uncategorizedOnly')::boolean, FALSE);
  v_search := NULLIF(trim(p_filters->>'search'), '');
  v_urbanrat_only := COALESCE((p_filters->>'isUrbanrat')::boolean, FALSE);
  v_low_stock_only := COALESCE((p_filters->>'lowStock')::boolean, FALSE);
  v_status := COALESCE(p_filters->>'status', 'all');

  RETURN QUERY
  WITH RECURSIVE target_category_ids AS (
    SELECT c.id
    FROM public.categories c
    WHERE v_category_id IS NOT NULL AND c.id = v_category_id

    UNION ALL

    SELECT child.id
    FROM public.categories child
    JOIN target_category_ids tc ON child.parent_id = tc.id
    WHERE v_include_descendants = TRUE
  )
  SELECT p.id AS product_id
  FROM public.products p
  WHERE
    (
      v_uncategorized_only = TRUE
      AND (p.category_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = p.category_id))
    )
    OR
    (
      v_uncategorized_only = FALSE
      AND (
        v_category_id IS NULL
        OR (
          v_include_descendants = TRUE
          AND p.category_id IN (SELECT tc.id FROM target_category_ids tc)
        )
        OR (
          v_include_descendants = FALSE
          AND p.category_id = v_category_id
        )
      )
    )
    AND (
      v_search IS NULL
      OR p.name ILIKE ('%' || v_search || '%')
      OR p.sku ILIKE ('%' || v_search || '%')
      OR COALESCE(p.brand, '') ILIKE ('%' || v_search || '%')
      OR (p.keywords IS NOT NULL AND v_search = ANY(p.keywords))
    )
    AND (v_urbanrat_only = FALSE OR p.is_urbanrat_brand = TRUE)
    AND (v_low_stock_only = FALSE OR p.stock <= COALESCE(p.low_stock_threshold, 5))
    AND (
      v_status = 'all'
      OR (v_status = 'active' AND p.is_active = TRUE)
      OR (v_status = 'inactive' AND p.is_active = FALSE)
    )
  ORDER BY p.name ASC
  LIMIT COALESCE(p_limit, 5000);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_product_ids(jsonb, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. RPC: admin_bulk_update_products
-- Bulk updates allowlisted product attributes with transactional dry-run,
-- MRP delta calculations, keyword normalization, and before-snapshots.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_update_products(
  p_product_ids uuid[],
  p_patch jsonb,
  p_dry_run boolean DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod record;
  v_op_id uuid;
  v_before_snapshot jsonb := '[]'::jsonb;
  v_preview_items jsonb := '[]'::jsonb;
  v_errors text[];
  v_affected integer := 0;

  -- Patch values
  v_has_category boolean := p_patch ? 'category_id';
  v_new_category_id uuid;
  v_has_brand boolean := p_patch ? 'brand';
  v_new_brand text;
  v_has_tagline boolean := p_patch ? 'tagline';
  v_new_tagline text;
  v_has_description boolean := p_patch ? 'description';
  v_new_description text;
  v_has_warranty boolean := p_patch ? 'warranty_months';
  v_new_warranty integer;
  v_has_moq boolean := p_patch ? 'moq';
  v_new_moq integer;
  v_has_order_step boolean := p_patch ? 'order_step';
  v_new_order_step integer;
  v_has_low_stock boolean := p_patch ? 'low_stock_threshold';
  v_new_low_stock integer;
  v_has_active boolean := p_patch ? 'is_active';
  v_new_active boolean;
  v_has_featured boolean := p_patch ? 'is_featured';
  v_new_featured boolean;
  v_has_trending boolean := p_patch ? 'is_trending';
  v_new_trending boolean;
  v_has_urbanrat boolean := p_patch ? 'is_urbanrat_brand';
  v_new_urbanrat boolean;

  v_has_mrp boolean := p_patch ? 'mrp';
  v_mrp_val numeric;
  v_mrp_mode text;
  v_calculated_mrp numeric;

  v_has_kw_add boolean := p_patch ? 'keywords_add';
  v_has_kw_remove boolean := p_patch ? 'keywords_remove';
  v_has_kw_replace boolean := p_patch ? 'keywords_replace';
  v_kw_result text[];
  v_kw_tok text;
  v_kw_seen text[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one product ID is required.';
  END IF;

  IF array_length(p_product_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Maximum 500 products per bulk operation.';
  END IF;

  -- Validate category exists if category_id is being patched
  IF v_has_category AND (p_patch->>'category_id') IS NOT NULL THEN
    v_new_category_id := (p_patch->>'category_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = v_new_category_id) THEN
      RAISE EXCEPTION 'Target category % does not exist.', v_new_category_id;
    END IF;
  END IF;

  IF v_has_brand THEN v_new_brand := p_patch->>'brand'; END IF;
  IF v_has_tagline THEN v_new_tagline := p_patch->>'tagline'; END IF;
  IF v_has_description THEN v_new_description := p_patch->>'description'; END IF;
  IF v_has_warranty THEN v_new_warranty := (p_patch->>'warranty_months')::integer; END IF;
  IF v_has_moq THEN v_new_moq := (p_patch->>'moq')::integer; END IF;
  IF v_has_order_step THEN v_new_order_step := (p_patch->>'order_step')::integer; END IF;
  IF v_has_low_stock THEN v_new_low_stock := (p_patch->>'low_stock_threshold')::integer; END IF;
  IF v_has_active THEN v_new_active := (p_patch->>'is_active')::boolean; END IF;
  IF v_has_featured THEN v_new_featured := (p_patch->>'is_featured')::boolean; END IF;
  IF v_has_trending THEN v_new_trending := (p_patch->>'is_trending')::boolean; END IF;
  IF v_has_urbanrat THEN v_new_urbanrat := (p_patch->>'is_urbanrat_brand')::boolean; END IF;

  v_op_id := gen_random_uuid();

  FOR v_prod IN
    SELECT *
    FROM public.products
    WHERE id = ANY(p_product_ids)
  LOOP
    v_errors := '{}';
    v_calculated_mrp := v_prod.mrp;

    -- Compute MRP according to mode
    IF v_has_mrp THEN
      IF jsonb_typeof(p_patch->'mrp') = 'number' THEN
        v_calculated_mrp := (p_patch->>'mrp')::numeric;
      ELSIF jsonb_typeof(p_patch->'mrp') = 'object' THEN
        v_mrp_mode := p_patch->'mrp'->>'mode';
        v_mrp_val := (p_patch->'mrp'->>'value')::numeric;
        CASE v_mrp_mode
          WHEN 'set' THEN v_calculated_mrp := v_mrp_val;
          WHEN 'increase_pct' THEN v_calculated_mrp := round(COALESCE(v_prod.mrp, v_prod.price) * (1.0 + v_mrp_val / 100.0), 2);
          WHEN 'decrease_pct' THEN v_calculated_mrp := greatest(0, round(COALESCE(v_prod.mrp, v_prod.price) * (1.0 - v_mrp_val / 100.0), 2));
          WHEN 'increase_amt' THEN v_calculated_mrp := COALESCE(v_prod.mrp, v_prod.price) + v_mrp_val;
          WHEN 'decrease_amt' THEN v_calculated_mrp := greatest(0, COALESCE(v_prod.mrp, v_prod.price) - v_mrp_val);
          ELSE v_calculated_mrp := v_prod.mrp;
        END CASE;
      END IF;

      IF v_calculated_mrp IS NOT NULL AND v_calculated_mrp < v_prod.price THEN
        v_errors := array_append(v_errors, format('MRP (₹%s) cannot be lower than selling price (₹%s).', v_calculated_mrp, v_prod.price));
      END IF;
    END IF;

    -- Compute Keywords
    v_kw_result := COALESCE(v_prod.keywords, '{}'::text[]);
    IF v_has_kw_replace THEN
      v_kw_result := public.normalize_keywords_array(p_patch->'keywords_replace');
    ELSE
      IF v_has_kw_remove THEN
        SELECT array_agg(k) INTO v_kw_result
        FROM unnest(v_kw_result) k
        WHERE NOT (k = ANY(public.normalize_keywords_array(p_patch->'keywords_remove')));
        v_kw_result := COALESCE(v_kw_result, '{}'::text[]);
      END IF;
      IF v_has_kw_add THEN
        v_kw_seen := v_kw_result;
        FOREACH v_kw_tok IN ARRAY public.normalize_keywords_array(p_patch->'keywords_add')
        LOOP
          IF NOT (v_kw_tok = ANY(v_kw_seen)) THEN
            v_kw_seen := array_append(v_kw_seen, v_kw_tok);
          END IF;
        END LOOP;
        v_kw_result := v_kw_seen[1:30];
      END IF;
    END IF;

    IF array_length(v_errors, 1) IS NULL THEN
      -- Valid product update
      v_affected := v_affected + 1;

      -- Capture snapshot
      v_before_snapshot := v_before_snapshot || jsonb_build_object(
        'product_id', v_prod.id,
        'category_id', v_prod.category_id,
        'brand', v_prod.brand,
        'tagline', v_prod.short_tagline,
        'description', v_prod.description,
        'warranty_months', v_prod.warranty_months,
        'mrp', v_prod.mrp,
        'moq', v_prod.min_order_qty,
        'order_step', v_prod.order_qty_step,
        'low_stock_threshold', v_prod.low_stock_threshold,
        'is_active', v_prod.is_active,
        'is_featured', v_prod.is_featured,
        'is_trending', v_prod.is_trending,
        'is_urbanrat_brand', v_prod.is_urbanrat_brand,
        'keywords', v_prod.keywords
      );

      IF NOT p_dry_run THEN
        UPDATE public.products
        SET
          category_id = CASE WHEN v_has_category THEN v_new_category_id ELSE category_id END,
          brand = CASE WHEN v_has_brand THEN v_new_brand ELSE brand END,
          short_tagline = CASE WHEN v_has_tagline THEN v_new_tagline ELSE short_tagline END,
          description = CASE WHEN v_has_description THEN v_new_description ELSE description END,
          warranty_months = CASE WHEN v_has_warranty THEN v_new_warranty ELSE warranty_months END,
          mrp = CASE WHEN v_has_mrp THEN v_calculated_mrp ELSE mrp END,
          min_order_qty = CASE WHEN v_has_moq THEN v_new_moq ELSE min_order_qty END,
          order_qty_step = CASE WHEN v_has_order_step THEN v_new_order_step ELSE order_qty_step END,
          low_stock_threshold = CASE WHEN v_has_low_stock THEN v_new_low_stock ELSE low_stock_threshold END,
          is_active = CASE WHEN v_has_active THEN v_new_active ELSE is_active END,
          is_featured = CASE WHEN v_has_featured THEN v_new_featured ELSE is_featured END,
          is_trending = CASE WHEN v_has_trending THEN v_new_trending ELSE is_trending END,
          is_urbanrat_brand = CASE WHEN v_has_urbanrat THEN v_new_urbanrat ELSE is_urbanrat_brand END,
          keywords = CASE WHEN (v_has_kw_add OR v_has_kw_remove OR v_has_kw_replace) THEN v_kw_result ELSE keywords END,
          updated_at = now()
        WHERE id = v_prod.id;
      END IF;
    END IF;

    -- Add preview item
    v_preview_items := v_preview_items || jsonb_build_object(
      'product_id', v_prod.id,
      'product_name', v_prod.name,
      'sku', v_prod.sku,
      'before', jsonb_build_object('mrp', v_prod.mrp, 'is_active', v_prod.is_active, 'brand', v_prod.brand),
      'after', jsonb_build_object('mrp', v_calculated_mrp, 'is_active', COALESCE(v_new_active, v_prod.is_active), 'brand', COALESCE(v_new_brand, v_prod.brand)),
      'errors', to_jsonb(v_errors)
    );
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.bulk_operations (
      id, op_type, params, product_ids, before_snapshot, affected_count, status, created_by
    ) VALUES (
      v_op_id, 'details', p_patch, p_product_ids, v_before_snapshot, v_affected, 'applied', auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'op_id', CASE WHEN NOT p_dry_run THEN v_op_id ELSE NULL END,
    'total_count', array_length(p_product_ids, 1),
    'affected_count', v_affected,
    'items', v_preview_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_update_products(uuid[], jsonb, boolean) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPC: admin_bulk_save_tiers
-- Bulk updates wholesale price tiers across products.
-- Modes: 'replace', 'adjust', 'from_base', 'copy_from', 'clear'.
-- Validates per product (quantities strictly increasing, prices > 0 and
-- non-increasing, mrp bounds). Skipped invalid products do not fail batch.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_save_tiers(
  p_product_ids uuid[],
  p_mode text,
  p_payload jsonb,
  p_dry_run boolean DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod record;
  v_op_id uuid;
  v_before_snapshot jsonb := '[]'::jsonb;
  v_preview_items jsonb := '[]'::jsonb;
  v_errors text[];
  v_warnings text[];
  v_affected integer := 0;

  v_source_tiers jsonb;
  v_computed_tiers jsonb;
  v_elem jsonb;
  v_min_qty integer;
  v_unit_price numeric;
  v_prev_qty integer;
  v_prev_price numeric;

  -- adjust mode payload vars
  v_adj_type text;
  v_adj_dir text;
  v_adj_val numeric;
  v_adj_factor numeric;

  -- from_base spec element
  v_discount_pct numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one product ID is required.';
  END IF;

  IF array_length(p_product_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Maximum 500 products per bulk operation.';
  END IF;

  IF p_mode NOT IN ('replace', 'adjust', 'from_base', 'copy_from', 'clear') THEN
    RAISE EXCEPTION 'Invalid tier bulk mode: %', p_mode;
  END IF;

  -- Pre-fetch source tiers for copy_from mode
  IF p_mode = 'copy_from' THEN
    SELECT jsonb_agg(jsonb_build_object('min_qty', min_qty, 'unit_price', unit_price) ORDER BY min_qty ASC)
    INTO v_source_tiers
    FROM public.product_price_tiers
    WHERE product_id = (p_payload->>'source_product_id')::uuid;

    IF v_source_tiers IS NULL OR jsonb_array_length(v_source_tiers) = 0 THEN
      RAISE EXCEPTION 'Source product has no volume tiers to copy.';
    END IF;
  END IF;

  v_op_id := gen_random_uuid();

  FOR v_prod IN
    SELECT p.*, COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('min_qty', t.min_qty, 'unit_price', t.unit_price) ORDER BY t.min_qty ASC)
       FROM public.product_price_tiers t WHERE t.product_id = p.id), '[]'::jsonb
    ) as existing_tiers
    FROM public.products p
    WHERE p.id = ANY(p_product_ids)
  LOOP
    v_errors := '{}';
    v_warnings := '{}';
    v_computed_tiers := '[]'::jsonb;

    CASE p_mode
      WHEN 'replace' THEN
        v_computed_tiers := p_payload;

      WHEN 'copy_from' THEN
        v_computed_tiers := v_source_tiers;

      WHEN 'clear' THEN
        v_computed_tiers := '[]'::jsonb;

      WHEN 'from_base' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payload)
        LOOP
          v_min_qty := (v_elem->>'min_qty')::integer;
          v_discount_pct := (v_elem->>'discount_pct')::numeric;
          v_unit_price := greatest(0.01, round(v_prod.price * (1.0 - v_discount_pct / 100.0), 2));
          v_computed_tiers := v_computed_tiers || jsonb_build_object('min_qty', v_min_qty, 'unit_price', v_unit_price);
        END LOOP;

      WHEN 'adjust' THEN
        v_adj_type := p_payload->>'type';
        v_adj_dir := p_payload->>'direction';
        v_adj_val := (p_payload->>'value')::numeric;
        v_adj_factor := CASE WHEN v_adj_dir = 'up' THEN 1.0 ELSE -1.0 END;

        IF jsonb_array_length(v_prod.existing_tiers) = 0 THEN
          v_errors := array_append(v_errors, 'Product has no existing tiers to adjust.');
        ELSE
          FOR v_elem IN SELECT * FROM jsonb_array_elements(v_prod.existing_tiers)
          LOOP
            v_min_qty := (v_elem->>'min_qty')::integer;
            v_unit_price := (v_elem->>'unit_price')::numeric;
            IF v_adj_type = 'pct' THEN
              v_unit_price := round(v_unit_price * (1.0 + v_adj_factor * (v_adj_val / 100.0)), 2);
            ELSE
              v_unit_price := v_unit_price + (v_adj_factor * v_adj_val);
            END IF;
            v_unit_price := greatest(0.01, v_unit_price);
            v_computed_tiers := v_computed_tiers || jsonb_build_object('min_qty', v_min_qty, 'unit_price', v_unit_price);
          END LOOP;
        END IF;
    END CASE;

    -- Validate computed tiers (unless clear mode)
    IF p_mode <> 'clear' AND array_length(v_errors, 1) IS NULL THEN
      IF jsonb_array_length(v_computed_tiers) = 0 THEN
        v_errors := array_append(v_errors, 'At least one tier required.');
      ELSE
        v_prev_qty := 0;
        v_prev_price := NULL;

        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_computed_tiers)
        LOOP
          v_min_qty := (v_elem->>'min_qty')::integer;
          v_unit_price := (v_elem->>'unit_price')::numeric;

          IF v_min_qty <= 0 THEN
            v_errors := array_append(v_errors, 'Tier minimum quantity must be greater than 0.');
          END IF;
          IF v_unit_price <= 0 THEN
            v_errors := array_append(v_errors, 'Tier unit price must be greater than ₹0.');
          END IF;
          IF v_prev_qty > 0 AND v_min_qty <= v_prev_qty THEN
            v_errors := array_append(v_errors, format('Tier quantity (%s) must be strictly greater than previous tier (%s).', v_min_qty, v_prev_qty));
          END IF;
          IF v_prev_price IS NOT NULL AND v_unit_price > v_prev_price THEN
            v_errors := array_append(v_errors, format('Tier unit price (₹%s) cannot exceed previous tier price (₹%s).', v_unit_price, v_prev_price));
          END IF;
          IF v_prod.mrp IS NOT NULL AND v_unit_price > v_prod.mrp THEN
            v_errors := array_append(v_errors, format('Tier price (₹%s) exceeds product MRP (₹%s).', v_unit_price, v_prod.mrp));
          END IF;

          v_prev_qty := v_min_qty;
          v_prev_price := v_unit_price;
        END LOOP;

        -- Warn if tier 1 unit price is above base price
        IF (v_computed_tiers->0->>'unit_price')::numeric > v_prod.price THEN
          v_warnings := array_append(v_warnings, format('Tier 1 price (₹%s) is above base price (₹%s).', v_computed_tiers->0->>'unit_price', v_prod.price));
        END IF;
      END IF;
    END IF;

    IF array_length(v_errors, 1) IS NULL THEN
      v_affected := v_affected + 1;
      v_before_snapshot := v_before_snapshot || jsonb_build_object(
        'product_id', v_prod.id,
        'tiers', v_prod.existing_tiers
      );

      IF NOT p_dry_run THEN
        DELETE FROM public.product_price_tiers WHERE product_id = v_prod.id;
        IF jsonb_array_length(v_computed_tiers) > 0 THEN
          INSERT INTO public.product_price_tiers (product_id, min_qty, unit_price)
          SELECT v_prod.id, (t->>'min_qty')::integer, (t->>'unit_price')::numeric(10, 2)
          FROM jsonb_array_elements(v_computed_tiers) t;
        END IF;
      END IF;
    END IF;

    v_preview_items := v_preview_items || jsonb_build_object(
      'product_id', v_prod.id,
      'product_name', v_prod.name,
      'sku', v_prod.sku,
      'before', v_prod.existing_tiers,
      'after', v_computed_tiers,
      'errors', to_jsonb(v_errors),
      'warnings', to_jsonb(v_warnings)
    );
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.bulk_operations (
      id, op_type, params, product_ids, before_snapshot, affected_count, status, created_by
    ) VALUES (
      v_op_id, 'tiers', jsonb_build_object('mode', p_mode, 'payload', p_payload), p_product_ids, v_before_snapshot, v_affected, 'applied', auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'op_id', CASE WHEN NOT p_dry_run THEN v_op_id ELSE NULL END,
    'total_count', array_length(p_product_ids, 1),
    'affected_count', v_affected,
    'items', v_preview_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_save_tiers(uuid[], text, jsonb, boolean) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. RPC: admin_bulk_adjust_stock
-- Bulk inventory stock adjustments. Modes: 'add', 'subtract', 'set', 'zero'.
-- Stock can never fall below 0. Writes one stock_movements row per product.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_adjust_stock(
  p_product_ids uuid[],
  p_mode text,
  p_qty integer,
  p_reason text,
  p_dry_run boolean DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod record;
  v_op_id uuid;
  v_before_snapshot jsonb := '[]'::jsonb;
  v_preview_items jsonb := '[]'::jsonb;
  v_errors text[];
  v_affected integer := 0;

  v_new_stock integer;
  v_change integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one product ID is required.';
  END IF;

  IF array_length(p_product_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Maximum 500 products per bulk operation.';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Adjustment reason is required.';
  END IF;

  IF p_mode NOT IN ('add', 'subtract', 'set', 'zero') THEN
    RAISE EXCEPTION 'Invalid stock mode: %', p_mode;
  END IF;

  v_op_id := gen_random_uuid();

  FOR v_prod IN
    SELECT id, name, sku, stock
    FROM public.products
    WHERE id = ANY(p_product_ids)
  LOOP
    v_errors := '{}';
    v_new_stock := v_prod.stock;

    CASE p_mode
      WHEN 'add' THEN
        v_new_stock := v_prod.stock + greatest(0, p_qty);
      WHEN 'subtract' THEN
        v_new_stock := v_prod.stock - greatest(0, p_qty);
      WHEN 'set' THEN
        v_new_stock := greatest(0, p_qty);
      WHEN 'zero' THEN
        v_new_stock := 0;
    END CASE;

    IF v_new_stock < 0 THEN
      v_errors := array_append(v_errors, format('Stock cannot drop below 0 (current: %s, delta: -%s).', v_prod.stock, p_qty));
    ELSE
      v_change := v_new_stock - v_prod.stock;
      v_affected := v_affected + 1;

      v_before_snapshot := v_before_snapshot || jsonb_build_object(
        'product_id', v_prod.id,
        'previous_stock', v_prod.stock,
        'new_stock', v_new_stock,
        'change', v_change
      );

      IF NOT p_dry_run THEN
        UPDATE public.products
        SET stock = v_new_stock, updated_at = now()
        WHERE id = v_prod.id;

        INSERT INTO public.stock_movements (product_id, change, reason, admin_id)
        VALUES (
          v_prod.id,
          v_change,
          trim(p_reason) || ' [Bulk Op: ' || v_op_id || ']',
          auth.uid()
        );
      END IF;
    END IF;

    v_preview_items := v_preview_items || jsonb_build_object(
      'product_id', v_prod.id,
      'product_name', v_prod.name,
      'sku', v_prod.sku,
      'before', jsonb_build_object('stock', v_prod.stock),
      'after', jsonb_build_object('stock', v_new_stock, 'change', v_new_stock - v_prod.stock),
      'errors', to_jsonb(v_errors)
    );
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.bulk_operations (
      id, op_type, params, product_ids, before_snapshot, affected_count, status, created_by
    ) VALUES (
      v_op_id, 'stock', jsonb_build_object('mode', p_mode, 'qty', p_qty, 'reason', p_reason), p_product_ids, v_before_snapshot, v_affected, 'applied', auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'op_id', CASE WHEN NOT p_dry_run THEN v_op_id ELSE NULL END,
    'total_count', array_length(p_product_ids, 1),
    'affected_count', v_affected,
    'items', v_preview_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_adjust_stock(uuid[], text, integer, text, boolean) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. RPC: admin_bulk_update_images
-- Bulk image management. Modes: 'append', 'prepend', 'replace_all',
-- 'set_primary', 'remove_url', 'clear'. De-duplicates URLs, enforces max 10
-- images per product, HTTPS only. Does not delete files from storage.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_update_images(
  p_product_ids uuid[],
  p_mode text,
  p_urls text[] DEFAULT '{}'::text[],
  p_dry_run boolean DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod record;
  v_op_id uuid;
  v_before_snapshot jsonb := '[]'::jsonb;
  v_preview_items jsonb := '[]'::jsonb;
  v_errors text[];
  v_affected integer := 0;

  v_cleaned_urls text[] := '{}'::text[];
  v_u text;
  v_curr text[];
  v_new_images text[];
  v_url_to_promote text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one product ID is required.';
  END IF;

  IF array_length(p_product_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Maximum 500 products per bulk operation.';
  END IF;

  IF p_mode NOT IN ('append', 'prepend', 'replace_all', 'set_primary', 'remove_url', 'clear') THEN
    RAISE EXCEPTION 'Invalid image bulk mode: %', p_mode;
  END IF;

  -- Validate HTTPS URLs if provided
  IF p_urls IS NOT NULL THEN
    FOREACH v_u IN ARRAY p_urls
    LOOP
      v_u := trim(v_u);
      IF length(v_u) > 0 THEN
        IF v_u !~* '^https://' THEN
          RAISE EXCEPTION 'Image URL % is invalid. Only secure https:// URLs are allowed.', v_u;
        END IF;
        IF NOT (v_u = ANY(v_cleaned_urls)) THEN
          v_cleaned_urls := array_append(v_cleaned_urls, v_u);
        END IF;
      END IF;
    END LOOP;
  END IF;

  v_op_id := gen_random_uuid();

  FOR v_prod IN
    SELECT id, name, sku, COALESCE(images, '{}'::text[]) as images
    FROM public.products
    WHERE id = ANY(p_product_ids)
  LOOP
    v_errors := '{}';
    v_curr := v_prod.images;
    v_new_images := v_curr;

    CASE p_mode
      WHEN 'clear' THEN
        v_new_images := '{}'::text[];

      WHEN 'replace_all' THEN
        v_new_images := v_cleaned_urls[1:10];

      WHEN 'append' THEN
        FOREACH v_u IN ARRAY v_cleaned_urls
        LOOP
          IF NOT (v_u = ANY(v_new_images)) THEN
            v_new_images := array_append(v_new_images, v_u);
          END IF;
        END LOOP;
        v_new_images := v_new_images[1:10];

      WHEN 'prepend' THEN
        FOREACH v_u IN ARRAY v_cleaned_urls
        LOOP
          -- Remove if already exists so it moves to front
          SELECT array_agg(img) INTO v_new_images FROM unnest(v_new_images) img WHERE img <> v_u;
          v_new_images := array_prepend(v_u, COALESCE(v_new_images, '{}'::text[]));
        END LOOP;
        v_new_images := v_new_images[1:10];

      WHEN 'set_primary' THEN
        IF array_length(v_cleaned_urls, 1) IS NULL OR array_length(v_cleaned_urls, 1) = 0 THEN
          v_errors := array_append(v_errors, 'Target URL to set as primary is required.');
        ELSE
          v_url_to_promote := v_cleaned_urls[1];
          IF NOT (v_url_to_promote = ANY(v_curr)) THEN
            v_errors := array_append(v_errors, format('URL %s is not among the product existing images.', v_url_to_promote));
          ELSE
            SELECT array_agg(img) INTO v_new_images FROM unnest(v_curr) img WHERE img <> v_url_to_promote;
            v_new_images := array_prepend(v_url_to_promote, COALESCE(v_new_images, '{}'::text[]));
          END IF;
        END IF;

      WHEN 'remove_url' THEN
        SELECT array_agg(img) INTO v_new_images
        FROM unnest(v_curr) img
        WHERE NOT (img = ANY(v_cleaned_urls));
        v_new_images := COALESCE(v_new_images, '{}'::text[]);
    END CASE;

    IF array_length(v_errors, 1) IS NULL THEN
      v_affected := v_affected + 1;
      v_before_snapshot := v_before_snapshot || jsonb_build_object(
        'product_id', v_prod.id,
        'images', v_prod.images
      );

      IF NOT p_dry_run THEN
        UPDATE public.products
        SET images = v_new_images, updated_at = now()
        WHERE id = v_prod.id;
      END IF;
    END IF;

    v_preview_items := v_preview_items || jsonb_build_object(
      'product_id', v_prod.id,
      'product_name', v_prod.name,
      'sku', v_prod.sku,
      'before', jsonb_build_object('images', v_prod.images),
      'after', jsonb_build_object('images', v_new_images),
      'errors', to_jsonb(v_errors)
    );
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.bulk_operations (
      id, op_type, params, product_ids, before_snapshot, affected_count, status, created_by
    ) VALUES (
      v_op_id, 'images', jsonb_build_object('mode', p_mode, 'urls', p_urls), p_product_ids, v_before_snapshot, v_affected, 'applied', auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'op_id', CASE WHEN NOT p_dry_run THEN v_op_id ELSE NULL END,
    'total_count', array_length(p_product_ids, 1),
    'affected_count', v_affected,
    'items', v_preview_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_update_images(uuid[], text, text[], boolean) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. RPC: admin_undo_bulk_operation
-- Reverts a previously applied bulk operation from its before_snapshot.
-- For details, tiers, and images: restores prior states.
-- For stock: writes reverse stock_movements rows. Refuses if any product had
-- subsequent stock changes after the operation timestamp to prevent audit corruption.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_undo_bulk_operation(
  p_op_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op record;
  v_elem jsonb;
  v_prod_id uuid;
  v_prev_stock integer;
  v_orig_change integer;
  v_curr_stock integer;
  v_conflicts text[] := '{}'::text[];
  v_subsequent_count integer;
  v_undone_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  SELECT * INTO v_op
  FROM public.bulk_operations
  WHERE id = p_op_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bulk operation % not found.', p_op_id;
  END IF;

  IF v_op.status <> 'applied' THEN
    RAISE EXCEPTION 'Bulk operation is already % (must be "applied" to undo).', v_op.status;
  END IF;

  -- 1. Undo Stock Operation
  IF v_op.op_type = 'stock' THEN
    -- Safety Check: Verify whether any affected product was modified after this op
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_op.before_snapshot)
    LOOP
      v_prod_id := (v_elem->>'product_id')::uuid;
      SELECT count(*) INTO v_subsequent_count
      FROM public.stock_movements
      WHERE product_id = v_prod_id
        AND created_at > v_op.created_at;

      IF v_subsequent_count > 0 THEN
        v_conflicts := array_append(v_conflicts, (
          SELECT format('%s (SKU: %s)', name, COALESCE(sku, '—'))
          FROM public.products WHERE id = v_prod_id
        ));
      END IF;
    END LOOP;

    IF array_length(v_conflicts, 1) > 0 THEN
      RAISE EXCEPTION 'Cannot undo stock operation: The following % product(s) have subsequent stock movements: %',
        array_length(v_conflicts, 1),
        array_to_string(v_conflicts, ', ');
    END IF;

    -- Apply reverse stock movements
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_op.before_snapshot)
    LOOP
      v_prod_id := (v_elem->>'product_id')::uuid;
      v_prev_stock := (v_elem->>'previous_stock')::integer;
      v_orig_change := (v_elem->>'change')::integer;

      UPDATE public.products
      SET stock = v_prev_stock, updated_at = now()
      WHERE id = v_prod_id;

      INSERT INTO public.stock_movements (product_id, change, reason, admin_id)
      VALUES (
        v_prod_id,
        -v_orig_change,
        format('Undo bulk stock adjustment [Op: %s]', p_op_id),
        auth.uid()
      );
      v_undone_count := v_undone_count + 1;
    END LOOP;

  -- 2. Undo Details Operation
  ELSIF v_op.op_type = 'details' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_op.before_snapshot)
    LOOP
      v_prod_id := (v_elem->>'product_id')::uuid;
      UPDATE public.products
      SET
        category_id = (v_elem->>'category_id')::uuid,
        brand = v_elem->>'brand',
        short_tagline = v_elem->>'tagline',
        description = COALESCE(v_elem->>'description', ''),
        warranty_months = (v_elem->>'warranty_months')::integer,
        mrp = (v_elem->>'mrp')::numeric,
        min_order_qty = COALESCE((v_elem->>'moq')::integer, 1),
        order_qty_step = COALESCE((v_elem->>'order_step')::integer, 1),
        low_stock_threshold = COALESCE((v_elem->>'low_stock_threshold')::integer, 5),
        is_active = COALESCE((v_elem->>'is_active')::boolean, TRUE),
        is_featured = COALESCE((v_elem->>'is_featured')::boolean, FALSE),
        is_trending = COALESCE((v_elem->>'is_trending')::boolean, FALSE),
        is_urbanrat_brand = COALESCE((v_elem->>'is_urbanrat_brand')::boolean, FALSE),
        keywords = (
          SELECT COALESCE(array_agg(k.value::text), '{}'::text[])
          FROM jsonb_array_elements_text(COALESCE(v_elem->'keywords', '[]'::jsonb)) AS k
        ),
        updated_at = now()
      WHERE id = v_prod_id;
      v_undone_count := v_undone_count + 1;
    END LOOP;

  -- 3. Undo Tiers Operation
  ELSIF v_op.op_type = 'tiers' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_op.before_snapshot)
    LOOP
      v_prod_id := (v_elem->>'product_id')::uuid;
      DELETE FROM public.product_price_tiers WHERE product_id = v_prod_id;

      IF jsonb_array_length(COALESCE(v_elem->'tiers', '[]'::jsonb)) > 0 THEN
        INSERT INTO public.product_price_tiers (product_id, min_qty, unit_price)
        SELECT v_prod_id, (t->>'min_qty')::integer, (t->>'unit_price')::numeric(10, 2)
        FROM jsonb_array_elements(v_elem->'tiers') t;
      END IF;
      v_undone_count := v_undone_count + 1;
    END LOOP;

  -- 4. Undo Images Operation
  ELSIF v_op.op_type = 'images' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_op.before_snapshot)
    LOOP
      v_prod_id := (v_elem->>'product_id')::uuid;
      UPDATE public.products
      SET
        images = (
          SELECT COALESCE(array_agg(img.value::text), '{}'::text[])
          FROM jsonb_array_elements_text(COALESCE(v_elem->'images', '[]'::jsonb)) AS img
        ),
        updated_at = now()
      WHERE id = v_prod_id;
      v_undone_count := v_undone_count + 1;
    END LOOP;
  END IF;

  -- Mark operation as undone
  UPDATE public.bulk_operations
  SET status = 'undone', undone_at = now()
  WHERE id = p_op_id;

  RETURN jsonb_build_object(
    'success', true,
    'op_id', p_op_id,
    'undone_count', v_undone_count,
    'status', 'undone'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_undo_bulk_operation(uuid) TO authenticated;
