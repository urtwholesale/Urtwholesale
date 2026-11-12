-- ============================================================================
-- Migration: 046_pre_launch_security_hardening.sql
-- Description: Pre-launch security hardening addressing:
--   1. Drop conflicting 1-argument get_order_by_id(text) from migration 043 (PGRST203)
--      and restore unified get_order_by_id(text, text) with token support and embedded returns.
--   2. Enforce Row Level Security (RLS) on public.rate_limits table (created in 025).
--   3. Restrict legacy public.promo_codes table and RPC to admin/service_role to prevent coupon enumeration.
--   4. Grant SELECT on products (colors, views_count, sales_count) to anon and authenticated
--      so public.products_public view (recreated in 032 with security_invoker=on) does not fail.
-- Note: DO NOT EXECUTE DIRECTLY AGAINST PRODUCTION DATABASE. Review before applying.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fix get_order_by_id PostgREST Overload Conflict (PGRST203) & Guest Access
-- ----------------------------------------------------------------------------

-- Drop 1-parameter signature introduced in 043 to eliminate PostgREST resolution conflict
DROP FUNCTION IF EXISTS public.get_order_by_id(text);

-- Recreate canonical get_order_by_id with guest token validation and return embedding
CREATE OR REPLACE FUNCTION public.get_order_by_id(
  p_order_id text,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_order record;
  v_items jsonb;
  v_returns jsonb;
BEGIN
  v_user_id := auth.uid();

  -- Allow access if:
  -- 1) Order matches valid unguessable public_token (guest tracking)
  -- 2) User is authenticated owner of the order
  -- 3) Caller is an admin
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND (
      (p_token IS NOT NULL AND public_token = p_token)
      OR (v_user_id IS NOT NULL AND user_id = v_user_id)
      OR public.is_admin()
    );

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Aggregate order items
  SELECT COALESCE(jsonb_agg(to_jsonb(oi)), '[]'::jsonb)
  INTO v_items
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  -- Aggregate associated returns with line items
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'order_id', r.order_id,
      'status', r.status,
      'reason', r.reason,
      'created_at', r.created_at,
      'items', (
        SELECT COALESCE(jsonb_agg(to_jsonb(ri)), '[]'::jsonb)
        FROM public.return_items ri
        WHERE ri.return_id = r.id
      )
    )
  ), '[]'::jsonb)
  INTO v_returns
  FROM public.returns r
  WHERE r.order_id = p_order_id;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'user_id', v_order.user_id,
    'customer', jsonb_build_object(
      'name', v_order.customer_name,
      'phone', v_order.customer_phone,
      'email', v_order.customer_email,
      'address', v_order.shipping_address
    ),
    'items', v_items,
    'returns', v_returns,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'total', v_order.total_amount,
    'subtotal', v_order.subtotal_amount,
    'discount', v_order.discount_amount,
    'coupon_code', v_order.coupon_code,
    'created_at', v_order.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_by_id(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_id(text, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Enforce RLS on public.rate_limits (created in 025 without RLS)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'rate_limits'
  ) THEN
    ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated;
    GRANT ALL ON TABLE public.rate_limits TO service_role;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Lock down legacy promo_codes table (migration 033) against public enumeration
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'promo_codes'
  ) THEN
    REVOKE ALL ON TABLE public.promo_codes FROM anon, authenticated;
    DROP POLICY IF EXISTS "Anyone can read active promo codes" ON public.promo_codes;
    DROP POLICY IF EXISTS "Admin only promo_codes" ON public.promo_codes;
    CREATE POLICY "Admin only promo_codes" ON public.promo_codes
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- Revoke legacy validate_promo_code RPC from public/anon
REVOKE ALL ON FUNCTION public.validate_promo_code(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, numeric) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. Grant column-level SELECT on products.colors, views_count, sales_count
--    to prevent permission errors when querying products_public view
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'colors'
  ) THEN
    GRANT SELECT (colors, views_count, sales_count) ON public.products TO anon, authenticated;
  END IF;
END $$;
