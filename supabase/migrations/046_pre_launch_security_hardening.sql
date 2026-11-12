-- ============================================================================
-- Migration: 046_pre_launch_security_hardening.sql
-- Description: Pre-launch security hardening addressing:
--   1. Drop conflicting 1-argument get_order_by_id(text) from migration 043 (PGRST203)
--      and update canonical 2-argument get_order_by_id(text, text) from body in 043,
--      preserving guest public_token verification and PII masking from 041/026.
--   2. Drop obsolete public.rate_limits table (created in 025, unreferenced in code).
--      Ensure checkout_rate_limits and coupon_validation_attempts have strict RLS.
--   3. Restrict legacy public.promo_codes table (033) from anonymous enumeration.
--   4. Grant column-level SELECT on products(colors, views_count) to anon and authenticated.
-- Note: DO NOT EXECUTE DIRECTLY AGAINST PRODUCTION DATABASE. Review before applying.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Fix get_order_by_id PostgREST Overload Conflict (PGRST203) & Guest Masking
-- ----------------------------------------------------------------------------

-- Drop 1-parameter signature introduced in 043 to eliminate PostgREST ambiguity
DROP FUNCTION IF EXISTS public.get_order_by_id(text);

-- Recreate canonical 2-parameter get_order_by_id:
-- Starts from body in 043, preserves token check and guest masking from 041/026
CREATE OR REPLACE FUNCTION public.get_order_by_id(
  p_order_id text,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_events jsonb;
  v_returns jsonb;
  v_is_admin boolean := public.is_admin();
  v_caller_uid uuid := auth.uid();
  v_is_owner boolean := false;
  v_clean_token text := trim(COALESCE(p_token, ''));
BEGIN
  IF p_order_id IS NULL OR trim(p_order_id) = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = trim(p_order_id);

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_caller_uid IS NOT NULL AND v_order.user_id = v_caller_uid THEN
    v_is_owner := true;
  END IF;

  -- Non-owners and non-admins must supply a valid matching public_token
  IF NOT v_is_admin AND NOT v_is_owner THEN
    IF v_clean_token = '' OR v_order.public_token IS NULL OR v_order.public_token <> v_clean_token THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Timeline events
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'order_id', e.order_id,
        'status', e.status,
        'note', CASE WHEN (v_is_admin OR v_is_owner OR e.customer_visible) THEN e.note ELSE NULL END,
        'created_at', e.created_at
      ) ORDER BY e.created_at ASC
    ), '[]'::jsonb
  ) INTO v_events
  FROM public.order_events e
  WHERE e.order_id = v_order.id
    AND (v_is_admin OR v_is_owner OR e.customer_visible = true);

  -- Return requests for this order
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'order_id', r.order_id,
        'type', r.type,
        'status', r.status,
        'reason_code', r.reason_code,
        'reason', r.reason,
        'description', r.description,
        'evidence_urls', r.evidence_urls,
        'resolution_notes', r.resolution_notes,
        'created_at', r.created_at,
        'updated_at', r.updated_at,
        'items', (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', ri.id,
                'return_id', ri.return_id,
                'product_id', ri.product_id,
                'sku', ri.sku,
                'name', ri.name,
                'quantity', ri.quantity,
                'unit_price', ri.unit_price,
                'total_price', ri.total_price
              )
            ), '[]'::jsonb
          )
          FROM public.return_items ri
          WHERE ri.return_id = r.id OR ri.return_request_id = r.id
        )
      ) ORDER BY r.created_at DESC
    ), '[]'::jsonb
  ) INTO v_returns
  FROM public.return_requests r
  WHERE r.order_id = v_order.id;

  -- Owner / Admin View: Full order record including 042 (payment_status) and 043 (bad debt) fields
  IF v_is_admin OR v_is_owner THEN
    RETURN jsonb_build_object(
      'id', v_order.id,
      'user_id', v_order.user_id,
      'customer', v_order.customer,
      'items', v_order.items,
      'subtotal', v_order.subtotal,
      'subtotal_before_discount', v_order.subtotal_before_discount,
      'savings', v_order.savings,
      'shipping', v_order.shipping,
      'total', v_order.total,
      'coupon_code', v_order.coupon_code,
      'discount_amount', COALESCE(v_order.discount_amount, 0),
      'status', v_order.status,
      'source', COALESCE(v_order.source, 'website'),
      'payment_status', COALESCE(v_order.payment_status, 'pending'),
      'courier_name', v_order.courier_name,
      'awb_number', v_order.awb_number,
      'cancel_reason', v_order.cancel_reason,
      'admin_note', CASE WHEN v_is_admin THEN v_order.admin_note ELSE NULL END,
      'whatsapp_message', v_order.whatsapp_message,
      'public_token', v_order.public_token,
      'is_party_bad_debt', COALESCE(v_order.is_party_bad_debt, false),
      'party_bad_debt_reason', v_order.party_bad_debt_reason,
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at,
      'events', v_events,
      'returns', v_returns
    );
  END IF;

  -- Minimal Guest View: Strict PII masking (masked phone only; no shipping address, email, or GSTIN)
  RETURN jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'courier_name', v_order.courier_name,
    'awb_number', v_order.awb_number,
    'cancel_reason', v_order.cancel_reason,
    'coupon_code', v_order.coupon_code,
    'discount_amount', COALESCE(v_order.discount_amount, 0),
    'customer', jsonb_build_object(
      'phone', CASE 
        WHEN length(COALESCE(v_order.customer->>'phone', '')) >= 4 
        THEN '******' || right(v_order.customer->>'phone', 4) 
        ELSE '******' 
      END
    ),
    'items', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'product_id', COALESCE(elem->>'product_id', elem->'product'->>'id'),
            'name', COALESCE(elem->>'name', elem->'product'->>'name', 'Item'),
            'quantity', CASE 
              WHEN (elem->>'quantity') ~ '^\d+$' THEN (elem->>'quantity')::integer 
              ELSE 1 
            END,
            'price', COALESCE((elem->>'price')::numeric, 0),
            'unit_price', COALESCE((elem->>'unit_price')::numeric, 0),
            'sku', elem->>'sku'
          )
        ), '[]'::jsonb
      )
      FROM jsonb_array_elements(v_order.items) AS elem
    ),
    'timeline', v_events,
    'returns', v_returns
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_by_id(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_id(text, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Clean up / harden rate limiting tables
-- ----------------------------------------------------------------------------

-- Drop obsolete rate_limits table if present (unreferenced in application code)
DO $$
BEGIN
  IF to_regclass('public.rate_limits') IS NOT NULL THEN
    DROP TABLE public.rate_limits CASCADE;
  END IF;
END $$;

-- Verify checkout_rate_limits RLS and privileges
DO $$
BEGIN
  IF to_regclass('public.checkout_rate_limits') IS NOT NULL THEN
    ALTER TABLE public.checkout_rate_limits ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.checkout_rate_limits FROM PUBLIC, anon, authenticated;
    GRANT ALL ON TABLE public.checkout_rate_limits TO service_role;
  END IF;
END $$;

-- Verify coupon_validation_attempts RLS and privileges
DO $$
BEGIN
  IF to_regclass('public.coupon_validation_attempts') IS NOT NULL THEN
    ALTER TABLE public.coupon_validation_attempts ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.coupon_validation_attempts FROM PUBLIC, anon, authenticated;
    GRANT ALL ON TABLE public.coupon_validation_attempts TO service_role;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Lock down legacy promo_codes table (migration 033)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.promo_codes') IS NOT NULL THEN
    -- Revoke from anon only; keep authenticated limited by an is_admin() policy
    REVOKE ALL ON TABLE public.promo_codes FROM anon;
    DROP POLICY IF EXISTS "Anyone can read active promo codes" ON public.promo_codes;
    DROP POLICY IF EXISTS "Admin only promo_codes" ON public.promo_codes;
    CREATE POLICY "Admin only promo_codes" ON public.promo_codes
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Grant column-level SELECT on products(colors, views_count) to anon and authenticated
--    (Do NOT grant sales_count or stock to anon)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'colors'
  ) THEN
    GRANT SELECT (colors) ON public.products TO anon, authenticated;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'views_count'
  ) THEN
    GRANT SELECT (views_count) ON public.products TO anon, authenticated;
  END IF;
END $$;

COMMIT;
