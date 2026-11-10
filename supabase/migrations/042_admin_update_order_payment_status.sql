-- Migration 042: Admin RPC to update order payment status & log order events + dashboard stats enhancement

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

  -- 2. Status validation
  IF v_clean_status NOT IN ('pending', 'paid', 'unpaid', 'cod', 'failed', 'refunded') THEN
    RAISE EXCEPTION 'Invalid payment status: %. Allowed: pending, paid, unpaid, cod, failed, refunded', p_payment_status;
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

-- Enhanced admin_dashboard_stats to include paid revenue and paid order count
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats(
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
  v_prev_to date;
  v_prev_from date;

  -- Current period stats
  v_curr_rev numeric(10, 2);
  v_curr_paid_rev numeric(10, 2);
  v_curr_orders bigint;
  v_curr_paid_orders bigint;
  v_curr_aov numeric(10, 2);
  v_curr_pending bigint;
  v_curr_customers bigint;
  v_low_stock bigint;

  -- Previous period stats
  v_prev_rev numeric(10, 2);
  v_prev_paid_rev numeric(10, 2);
  v_prev_orders bigint;
  v_prev_paid_orders bigint;
  v_prev_aov numeric(10, 2);
  v_prev_pending bigint;
  v_prev_customers bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only an administrator can view dashboard analytics';
  END IF;

  v_days := (p_to - p_from) + 1;
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - (v_days - 1);

  -- 1. Current period metrics
  SELECT
    coalesce(sum(case when status not in ('cancelled', 'refunded') then total else 0 end), 0),
    coalesce(sum(case when status not in ('cancelled', 'refunded') and payment_status = 'paid' then total else 0 end), 0),
    count(*),
    count(*) filter (where status not in ('cancelled', 'refunded') and payment_status = 'paid'),
    coalesce(round(avg(case when status not in ('cancelled', 'refunded') then total else null end)::numeric, 2), 0),
    count(*) filter (where status = 'pending')
  INTO
    v_curr_rev,
    v_curr_paid_rev,
    v_curr_orders,
    v_curr_paid_orders,
    v_curr_aov,
    v_curr_pending
  FROM public.orders
  WHERE created_at::date >= p_from AND created_at::date <= p_to;

  -- Current new customers
  SELECT count(*) INTO v_curr_customers
  FROM public.profiles
  WHERE role = 'customer'
    AND created_at::date >= p_from
    AND created_at::date <= p_to;

  -- Low stock inventory count
  SELECT count(*) INTO v_low_stock
  FROM public.products
  WHERE is_active = true
    AND stock <= coalesce(low_stock_threshold, 5);

  -- 2. Previous period metrics
  SELECT
    coalesce(sum(case when status not in ('cancelled', 'refunded') then total else 0 end), 0),
    coalesce(sum(case when status not in ('cancelled', 'refunded') and payment_status = 'paid' then total else 0 end), 0),
    count(*),
    count(*) filter (where status not in ('cancelled', 'refunded') and payment_status = 'paid'),
    coalesce(round(avg(case when status not in ('cancelled', 'refunded') then total else null end)::numeric, 2), 0),
    count(*) filter (where status = 'pending')
  INTO
    v_prev_rev,
    v_prev_paid_rev,
    v_prev_orders,
    v_prev_paid_orders,
    v_prev_aov,
    v_prev_pending
  FROM public.orders
  WHERE created_at::date >= v_prev_from AND created_at::date <= v_prev_to;

  -- Previous new customers
  SELECT count(*) INTO v_prev_customers
  FROM public.profiles
  WHERE role = 'customer'
    AND created_at::date >= v_prev_from
    AND created_at::date <= v_prev_to;

  RETURN jsonb_build_object(
    'current', jsonb_build_object(
      'revenue', v_curr_rev,
      'paid_revenue', v_curr_paid_rev,
      'order_count', v_curr_orders,
      'paid_order_count', v_curr_paid_orders,
      'avg_order_value', v_curr_aov,
      'pending_count', v_curr_pending,
      'low_stock_count', v_low_stock,
      'new_customers', v_curr_customers
    ),
    'previous', jsonb_build_object(
      'revenue', v_prev_rev,
      'paid_revenue', v_prev_paid_rev,
      'order_count', v_prev_orders,
      'paid_order_count', v_prev_paid_orders,
      'avg_order_value', v_prev_aov,
      'pending_count', v_prev_pending,
      'low_stock_count', v_low_stock,
      'new_customers', v_prev_customers
    ),
    'period', jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'prev_from', v_prev_from,
      'prev_to', v_prev_to,
      'days', v_days
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats(date, date) TO authenticated;
