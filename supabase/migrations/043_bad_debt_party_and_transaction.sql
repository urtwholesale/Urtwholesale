-- Migration 043: Bad Debt Party and Transaction Management
-- Supports marking specific transactions (orders) as 'bad_debt'
-- and marking specific wholesale parties (profiles/customers) as Bad Debt accounts.

-- 1. Extend profiles with Bad Debt fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_bad_debt boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bad_debt_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bad_debt_marked_at timestamptz;

-- 2. Extend orders with denormalized party Bad Debt flag for lightning-fast queries
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_party_bad_debt boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS party_bad_debt_reason text;

CREATE INDEX IF NOT EXISTS idx_profiles_bad_debt ON public.profiles(is_bad_debt) WHERE is_bad_debt = true;
CREATE INDEX IF NOT EXISTS idx_orders_party_bad_debt ON public.orders(is_party_bad_debt) WHERE is_party_bad_debt = true;

-- 3. Update admin_update_order_payment_status RPC to support 'bad_debt'
CREATE OR REPLACE FUNCTION public.admin_update_order_payment_status(
  p_order_id text,
  p_payment_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_clean_status text;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_clean_status := lower(trim(p_payment_status));

  -- 2. Status validation (including bad_debt)
  IF v_clean_status NOT IN ('pending', 'paid', 'unpaid', 'cod', 'failed', 'refunded', 'bad_debt') THEN
    RAISE EXCEPTION 'Invalid payment status: %. Allowed: pending, paid, unpaid, cod, failed, refunded, bad_debt', p_payment_status;
  END IF;

  -- 3. Retrieve order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = trim(p_order_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- 4. Update orders table
  UPDATE public.orders
  SET
    payment_status = v_clean_status,
    updated_at = now()
  WHERE id = trim(p_order_id);

  -- 5. Insert audit event into order_events
  INSERT INTO public.order_events (order_id, status, note, created_by)
  VALUES (
    trim(p_order_id),
    v_order.status,
    coalesce(p_note, 'Payment status marked as ' || upper(v_clean_status) || ' by administrator'),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'order_id', trim(p_order_id),
    'previous_payment_status', v_order.payment_status,
    'payment_status', v_clean_status,
    'updated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_order_payment_status(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_payment_status(text, text, text) TO authenticated;

-- 4. Create admin_mark_party_bad_debt RPC for wholesale parties
CREATE OR REPLACE FUNCTION public.admin_mark_party_bad_debt(
  p_phone text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_is_bad_debt boolean DEFAULT true,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_phone text;
  v_affected_orders integer := 0;
  v_affected_profiles integer := 0;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_clean_phone := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  IF p_user_id IS NULL AND (v_clean_phone IS NULL OR v_clean_phone = '') THEN
    RAISE EXCEPTION 'Must provide either user_id or phone to mark party bad debt';
  END IF;

  -- 2. Update profiles table
  UPDATE public.profiles
  SET
    is_bad_debt = p_is_bad_debt,
    bad_debt_reason = CASE WHEN p_is_bad_debt THEN coalesce(p_reason, 'Defaulted wholesale account / bad debt') ELSE NULL END,
    bad_debt_marked_at = CASE WHEN p_is_bad_debt THEN now() ELSE NULL END,
    updated_at = now()
  WHERE (p_user_id IS NOT NULL AND id = p_user_id)
     OR (v_clean_phone <> '' AND right(regexp_replace(phone, '\D', '', 'g'), 10) = v_clean_phone);

  GET DIAGNOSTICS v_affected_profiles = ROW_COUNT;

  -- 3. Update orders table for instant denormalized lookup
  UPDATE public.orders
  SET
    is_party_bad_debt = p_is_bad_debt,
    party_bad_debt_reason = CASE WHEN p_is_bad_debt THEN coalesce(p_reason, 'Defaulted wholesale account / bad debt') ELSE NULL END,
    updated_at = now()
  WHERE (p_user_id IS NOT NULL AND user_id = p_user_id)
     OR (v_clean_phone <> '' AND right(regexp_replace(customer->>'phone', '\D', '', 'g'), 10) = v_clean_phone);

  GET DIAGNOSTICS v_affected_orders = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'is_bad_debt', p_is_bad_debt,
    'reason', p_reason,
    'affected_profiles', v_affected_profiles,
    'affected_orders', v_affected_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mark_party_bad_debt(text, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_party_bad_debt(text, uuid, boolean, text) TO authenticated;

-- 5. Update get_customer_lifetime_stats to include bad debt information
CREATE OR REPLACE FUNCTION public.get_customer_lifetime_stats(
  p_phone text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stats jsonb;
  v_clean_phone text;
  v_is_bad_debt boolean := false;
  v_bad_debt_reason text := null;
  v_bad_debt_marked_at timestamptz := null;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_clean_phone := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  -- Check if profile has bad debt flag
  SELECT is_bad_debt, bad_debt_reason, bad_debt_marked_at
  INTO v_is_bad_debt, v_bad_debt_reason, v_bad_debt_marked_at
  FROM public.profiles
  WHERE (p_user_id IS NOT NULL AND id = p_user_id)
     OR (v_clean_phone <> '' AND right(regexp_replace(phone, '\D', '', 'g'), 10) = v_clean_phone)
  LIMIT 1;

  -- Also check denormalized orders if profile had no flag
  IF coalesce(v_is_bad_debt, false) = false THEN
    SELECT is_party_bad_debt, party_bad_debt_reason
    INTO v_is_bad_debt, v_bad_debt_reason
    FROM public.orders
    WHERE ((p_user_id IS NOT NULL AND user_id = p_user_id)
       OR (v_clean_phone <> '' AND right(regexp_replace(customer->>'phone', '\D', '', 'g'), 10) = v_clean_phone))
      AND is_party_bad_debt = true
    LIMIT 1;
  END IF;

  SELECT jsonb_build_object(
    'total_orders', count(*),
    'total_spend', coalesce(sum(CASE WHEN status NOT IN ('cancelled', 'refunded') THEN total ELSE 0 END), 0),
    'delivered_orders', count(*) filter (WHERE status = 'delivered'),
    'first_order_date', min(created_at),
    'last_order_date', max(created_at),
    'is_bad_debt', coalesce(v_is_bad_debt, false),
    'bad_debt_reason', v_bad_debt_reason,
    'bad_debt_marked_at', v_bad_debt_marked_at,
    'bad_debt_orders_count', count(*) filter (WHERE payment_status = 'bad_debt'),
    'bad_debt_total_amount', coalesce(sum(CASE WHEN payment_status = 'bad_debt' THEN total ELSE 0 END), 0)
  ) INTO v_stats
  FROM public.orders
  WHERE (p_user_id IS NOT NULL AND user_id = p_user_id)
     OR (v_clean_phone <> '' AND right(regexp_replace(customer->>'phone', '\D', '', 'g'), 10) = v_clean_phone);

  RETURN coalesce(v_stats, jsonb_build_object(
    'total_orders', 0,
    'total_spend', 0,
    'delivered_orders', 0,
    'is_bad_debt', coalesce(v_is_bad_debt, false)
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_lifetime_stats(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_lifetime_stats(text, uuid) TO authenticated;

-- 6. Update get_order_by_id to include is_party_bad_debt and party_bad_debt_reason
CREATE OR REPLACE FUNCTION public.get_order_by_id(p_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_events jsonb;
  v_returns jsonb;
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  v_user_id := auth.uid();
  v_is_admin := public.is_admin();

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = trim(p_order_id);

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Access control: Only owner or admin can read
  IF NOT v_is_admin AND (v_order.user_id IS NULL OR v_order.user_id != v_user_id) THEN
    RETURN NULL;
  END IF;

  -- Fetch events
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'order_id', e.order_id,
      'status', e.status,
      'note', e.note,
      'created_at', e.created_at
    ) ORDER BY e.created_at ASC
  ), '[]'::jsonb)
  INTO v_events
  FROM public.order_events e
  WHERE e.order_id = trim(p_order_id);

  -- Fetch returns with items
  SELECT COALESCE(jsonb_agg(
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
        SELECT COALESCE(jsonb_agg(
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
        ), '[]'::jsonb)
        FROM public.return_items ri
        WHERE ri.return_id = r.id
      )
    ) ORDER BY r.created_at DESC
  ), '[]'::jsonb)
  INTO v_returns
  FROM public.return_requests r
  WHERE r.order_id = trim(p_order_id);

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
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_by_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_id(text) TO authenticated;
