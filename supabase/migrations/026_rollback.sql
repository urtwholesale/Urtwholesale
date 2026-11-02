-- ============================================================================
-- Migration: 026_rollback.sql
-- Description:
--   Rollback script for 026a and 026b.
--   Preserves orders.public_token and dealer_applications.public_token to prevent data loss.
--   Restores previous views, generated columns, and function definitions.
-- ============================================================================

BEGIN;

-- 1. Remove views
DROP VIEW IF EXISTS public.products_admin;
DROP VIEW IF EXISTS public.products_public;

-- 2. Drop generated in_stock column
ALTER TABLE public.products DROP COLUMN IF EXISTS in_stock;

-- 3. Restore table-wide SELECT grants to anon
GRANT SELECT ON TABLE public.products TO anon;
GRANT SELECT ON TABLE public.orders TO anon;
GRANT SELECT ON TABLE public.order_events TO anon;
GRANT SELECT ON TABLE public.dealer_applications TO anon;
GRANT SELECT ON TABLE public.dealer_events TO anon;

-- 4. Restore original single-argument get_order_by_id(text)
DROP FUNCTION IF EXISTS public.get_order_by_id(text, text);
DROP FUNCTION IF EXISTS public.get_order_by_id(text);

CREATE OR REPLACE FUNCTION public.get_order_by_id(p_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order jsonb;
BEGIN
  SELECT to_jsonb(o) INTO v_order
  FROM public.orders o
  WHERE o.id = trim(p_order_id);

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_id(text) TO anon, authenticated;

-- 5. Restore original search_products(text, integer) returning setof public.products
DROP FUNCTION IF EXISTS public.search_products(text, integer);

CREATE OR REPLACE FUNCTION public.search_products(
  q text,
  max_rows integer DEFAULT 8
)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.products
  WHERE is_active = true
    AND (
      name ILIKE ('%' || trim(q) || '%')
      OR (sku IS NOT NULL AND sku ILIKE ('%' || trim(q) || '%'))
      OR (
        CASE
          WHEN is_urbanrat_brand AND 'urbanrat' ILIKE ('%' || trim(q) || '%') THEN true
          WHEN specs IS NOT NULL AND (specs->>'brand') ILIKE ('%' || trim(q) || '%') THEN true
          ELSE false
        END
      )
      OR EXISTS (
        SELECT 1
        FROM unnest(keywords) kw
        WHERE kw ILIKE ('%' || trim(q) || '%')
      )
      OR similarity(name, trim(q)) > 0.15
    )
  ORDER BY
    CASE
      WHEN name ILIKE (trim(q) || '%') THEN 1
      WHEN name ILIKE ('%' || trim(q) || '%') THEN 2
      ELSE 3
    END ASC,
    is_featured DESC,
    created_at DESC
  LIMIT coalesce(max_rows, 8);
$$;

GRANT EXECUTE ON FUNCTION public.search_products(text, integer) TO anon, authenticated;

-- 6. Remove max_order_qty setting
DELETE FROM public.store_settings WHERE key = 'max_order_qty';

-- 7. Restore original order_events RLS policy & drop customer_visible
DROP POLICY IF EXISTS "Users can view events for own orders or admin views all" ON public.order_events;
CREATE POLICY "Users can view events for own orders or admin views all"
  ON public.order_events FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_events.order_id
        AND o.user_id = auth.uid()
    )
  );

ALTER TABLE public.order_events DROP COLUMN IF EXISTS customer_visible;

COMMIT;

