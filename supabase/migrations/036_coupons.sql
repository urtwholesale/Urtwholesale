-- ============================================================================
-- Migration: 030_coupons.sql
-- Description: Production-Ready Coupons & Redemptions Engine with Sliding-Window
--              Rate Limiting, Category Restrictions, Concurrency Row Locks,
--              Order Cancellation Auto-Release, and Administrative Tooling.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLE: public.coupons
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric NOT NULL CHECK (
    discount_value > 0 AND (discount_type <> 'percent' OR discount_value <= 100)
  ),
  max_discount_amount numeric NULL CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  min_order_value numeric NOT NULL DEFAULT 0 CHECK (min_order_value >= 0),
  starts_at timestamptz NULL,
  expires_at timestamptz NULL,
  usage_limit_total integer NULL CHECK (usage_limit_total IS NULL OR usage_limit_total > 0),
  usage_limit_per_customer integer NOT NULL DEFAULT 1 CHECK (usage_limit_per_customer > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  first_order_only boolean NOT NULL DEFAULT false,
  category_ids uuid[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_code_trim_upper_check CHECK (code = upper(trim(code)) AND length(code) > 0),
  CONSTRAINT coupons_dates_order_check CHECK (
    expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at
  )
);

-- Case-insensitive unique index on coupon code
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_upper_code ON public.coupons (upper(code));
CREATE INDEX IF NOT EXISTS idx_coupons_is_active_expires ON public.coupons (is_active, expires_at);

-- Attach standard set_updated_at trigger
DROP TRIGGER IF EXISTS trg_coupons_set_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_set_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. TABLE: public.coupon_redemptions
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_hash text NULL,
  discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  status text NOT NULL CHECK (status IN ('applied', 'released')) DEFAULT 'applied',
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz NULL
);

-- One redemption record per coupon per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_order
  ON public.coupon_redemptions (coupon_id, order_id);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user_status
  ON public.coupon_redemptions (coupon_id, user_id, status)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_phone_hash_status
  ON public.coupon_redemptions (coupon_id, phone_hash, status)
  WHERE phone_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order_id
  ON public.coupon_redemptions (order_id);

-- ----------------------------------------------------------------------------
-- 3. TABLE: public.coupon_audit_events
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coupon_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'toggle', 'delete')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_audit_events_coupon_id
  ON public.coupon_audit_events (coupon_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. TABLE: public.coupon_validation_attempts (Sliding-window rate limit)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coupon_validation_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_validation_attempts_ip_time
  ON public.coupon_validation_attempts (ip, created_at);

-- ----------------------------------------------------------------------------
-- 5. ALTER public.orders
-- ----------------------------------------------------------------------------

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_id uuid NULL REFERENCES public.coupons(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal_before_discount numeric NULL;

CREATE INDEX IF NOT EXISTS idx_orders_coupon_id ON public.orders (coupon_id) WHERE coupon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON public.orders (coupon_code) WHERE coupon_code IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. RLS POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_validation_attempts ENABLE ROW LEVEL SECURITY;

-- Revoke direct permissions from public / anon
REVOKE ALL ON TABLE public.coupons FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.coupon_redemptions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.coupon_audit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.coupon_validation_attempts FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coupons TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coupon_redemptions TO authenticated, service_role;
GRANT ALL ON TABLE public.coupon_audit_events TO service_role;
GRANT ALL ON TABLE public.coupon_validation_attempts TO service_role;

-- Coupons: Admins have full access. Regular customers have NO direct table access.
DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
CREATE POLICY "Admins manage coupons"
  ON public.coupons FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Redemptions: Admins have full access. Customers can view their own redemptions only.
DROP POLICY IF EXISTS "Admins manage coupon redemptions" ON public.coupon_redemptions;
CREATE POLICY "Admins manage coupon redemptions"
  ON public.coupon_redemptions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Customers view own redemptions" ON public.coupon_redemptions;
CREATE POLICY "Customers view own redemptions"
  ON public.coupon_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Audit events: Admins view audit log
DROP POLICY IF EXISTS "Admins view coupon audit events" ON public.coupon_audit_events;
CREATE POLICY "Admins view coupon audit events"
  ON public.coupon_audit_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. FUNCTION: validate_coupon (Public validation with sliding-window rate limit)
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.validate_coupon(text, jsonb, text);

CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code text,
  p_items jsonb,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ip text;
  v_attempts integer;
  v_code text;
  v_coupon record;
  v_caller_id uuid := auth.uid();
  v_raw_phone text;
  v_clean_phone text;
  v_phone_hash text;
  v_user_redemptions integer;

  v_item record;
  v_product record;
  v_unit_price numeric(10, 2);
  v_line_total numeric(10, 2);
  v_subtotal numeric(10, 2) := 0;
  v_eligible_subtotal numeric(10, 2) := 0;
  v_eligible_category_ids uuid[] := NULL;

  v_discount_amount numeric(10, 2) := 0;
  v_final_total numeric(10, 2) := 0;
BEGIN
  -- 1. Sliding-Window Rate Limit: 10 attempts per IP per 10 minutes
  BEGIN
    v_ip := current_setting('request.headers', true)::json->>'cf-connecting-ip';
    IF v_ip IS NULL OR trim(v_ip) = '' THEN
      v_ip := current_setting('request.headers', true)::json->>'x-real-ip';
    END IF;
    IF v_ip IS NULL OR trim(v_ip) = '' THEN
      v_ip := split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  IF v_ip IS NULL OR trim(v_ip) = '' THEN
    v_ip := inet_client_addr()::text;
  END IF;
  v_ip := COALESCE(trim(v_ip), '127.0.0.1');

  -- Lazy cleanup of old attempts older than 2 hours
  DELETE FROM public.coupon_validation_attempts WHERE created_at < (now() - interval '2 hours');

  SELECT count(*) INTO v_attempts
  FROM public.coupon_validation_attempts
  WHERE ip = v_ip AND created_at >= (now() - interval '10 minutes');

  IF v_attempts >= 10 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Too many attempts. Try again later.'
    );
  END IF;

  INSERT INTO public.coupon_validation_attempts (ip, created_at)
  VALUES (v_ip, now());

  -- 2. Code normalization & format checks
  v_code := upper(trim(COALESCE(p_code, '')));
  IF length(v_code) = 0 OR length(v_code) > 32 OR v_code !~ '^[A-Z0-9_-]+$' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This coupon is not valid for your cart'
    );
  END IF;

  -- 3. Retrieve coupon (Generic rejection if not found or inactive to prevent enumeration)
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE upper(code) = v_code;

  IF NOT FOUND OR NOT v_coupon.is_active THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This coupon is not valid for your cart'
    );
  END IF;

  -- 4. Date validity
  IF v_coupon.starts_at IS NOT NULL AND now() < v_coupon.starts_at THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This coupon is not valid for your cart'
    );
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND now() > v_coupon.expires_at THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Coupon expired'
    );
  END IF;

  -- 5. Total global usage limit
  IF v_coupon.usage_limit_total IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit_total THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This coupon is not valid for your cart'
    );
  END IF;

  -- 6. Customer identification & Per-customer usage limit
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    v_raw_phone := regexp_replace(p_phone, '\D', '', 'g');
    IF length(v_raw_phone) >= 10 THEN
      v_clean_phone := right(v_raw_phone, 10);
      v_phone_hash := encode(sha256(v_clean_phone::bytea), 'hex');
    END IF;
  END IF;

  IF v_caller_id IS NOT NULL OR v_phone_hash IS NOT NULL THEN
    SELECT count(*) INTO v_user_redemptions
    FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id
      AND status = 'applied'
      AND (
        (v_caller_id IS NOT NULL AND user_id = v_caller_id)
        OR (v_phone_hash IS NOT NULL AND phone_hash = v_phone_hash)
      );

    IF v_user_redemptions >= v_coupon.usage_limit_per_customer THEN
      RETURN jsonb_build_object(
        'valid', false,
        'message', 'You have already reached the redemption limit for this coupon'
      );
    END IF;
  END IF;

  -- 7. First order only restriction
  IF v_coupon.first_order_only THEN
    IF v_caller_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.orders
        WHERE user_id = v_caller_id AND status NOT IN ('cancelled', 'refunded')
      ) THEN
        RETURN jsonb_build_object(
          'valid', false,
          'message', 'This coupon is only valid for your first order'
        );
      END IF;
    END IF;

    IF v_clean_phone IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.orders
        WHERE customer->>'phone' LIKE '%' || v_clean_phone
          AND status NOT IN ('cancelled', 'refunded')
      ) THEN
        RETURN jsonb_build_object(
          'valid', false,
          'message', 'This coupon is only valid for your first order'
        );
      END IF;
    END IF;
  END IF;

  -- 8. Items validation & recompute subtotal using live database tier pricing
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Cart is empty'
    );
  END IF;

  -- Resolve category restrictions and descendant categories
  IF v_coupon.category_ids IS NOT NULL AND array_length(v_coupon.category_ids, 1) > 0 THEN
    SELECT array_agg(DISTINCT d.id) INTO v_eligible_category_ids
    FROM unnest(v_coupon.category_ids) AS cat_id
    CROSS JOIN LATERAL public.get_category_descendant_ids(cat_id) AS d;
  END IF;

  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      COALESCE(NULLIF(elem->>'quantity', '')::integer, NULLIF(elem->>'qty', '')::integer, 0) AS quantity
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id, name, category_id, price, is_active, min_order_qty, stock
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id;

    IF NOT FOUND OR NOT COALESCE(v_product.is_active, true) THEN
      CONTINUE;
    END IF;

    -- Reuse existing tier pricing helper
    BEGIN
      v_unit_price := public.get_unit_price(v_product.id, v_item.quantity);
    EXCEPTION WHEN OTHERS THEN
      v_unit_price := v_product.price;
    END;

    v_unit_price := COALESCE(v_unit_price, v_product.price, 0);
    v_line_total := round(v_unit_price * v_item.quantity, 2);
    v_subtotal := v_subtotal + v_line_total;

    -- Evaluate category restriction
    IF v_eligible_category_ids IS NULL OR v_product.category_id = ANY(v_eligible_category_ids) THEN
      v_eligible_subtotal := v_eligible_subtotal + v_line_total;
    END IF;
  END LOOP;

  IF v_subtotal <= 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Cart is empty or contains unavailable products'
    );
  END IF;

  -- 9. Check minimum order value against subtotal
  IF v_subtotal < v_coupon.min_order_value THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', format('Minimum order of ₹%s required', v_coupon.min_order_value)
    );
  END IF;

  -- 10. Check category eligibility
  IF v_eligible_subtotal <= 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This coupon is not valid for your cart'
    );
  END IF;

  -- 11. Compute discount amount
  IF v_coupon.discount_type = 'percent' THEN
    v_discount_amount := round(v_eligible_subtotal * (v_coupon.discount_value / 100.0), 2);
    IF v_coupon.max_discount_amount IS NOT NULL THEN
      v_discount_amount := least(v_discount_amount, v_coupon.max_discount_amount);
    END IF;
  ELSE
    v_discount_amount := least(v_coupon.discount_value, v_eligible_subtotal);
  END IF;

  v_discount_amount := least(v_discount_amount, v_eligible_subtotal);
  v_discount_amount := greatest(v_discount_amount, 0);
  v_final_total := greatest(v_subtotal - v_discount_amount, 0);

  RETURN jsonb_build_object(
    'valid', true,
    'discount_amount', v_discount_amount,
    'subtotal', v_subtotal,
    'final_total', v_final_total,
    'code', v_coupon.code,
    'description', v_coupon.description,
    'message', 'Coupon applied successfully'
  );
END;
$$;

-- Allow anon and authenticated callers (in line with 026b storefront public allowlist)
REVOKE ALL ON FUNCTION public.validate_coupon(text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, jsonb, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. ORDER STATUS RELEASE LOGIC (Trigger & RPC Integration)
-- ----------------------------------------------------------------------------

-- A. Auto-release trigger on orders (idempotent for cancelled / refunded status)
CREATE OR REPLACE FUNCTION public.trg_release_coupon_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_redemption record;
BEGIN
  IF NEW.status IN ('cancelled', 'refunded') AND (OLD.status IS NULL OR OLD.status NOT IN ('cancelled', 'refunded')) THEN
    FOR v_redemption IN
      SELECT id, coupon_id
      FROM public.coupon_redemptions
      WHERE order_id = NEW.id AND status = 'applied'
      FOR UPDATE
    LOOP
      UPDATE public.coupon_redemptions
      SET status = 'released',
          released_at = now()
      WHERE id = v_redemption.id;

      UPDATE public.coupons
      SET used_count = greatest(used_count - 1, 0),
          updated_at = now()
      WHERE id = v_redemption.coupon_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_release_coupon ON public.orders;
CREATE TRIGGER trg_orders_release_coupon
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_release_coupon_on_order_cancel();

-- B. Update admin_update_order_status RPC to maintain explicit release logic
CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id text,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_item record;
  v_should_restore boolean := false;
  v_items_restored integer := 0;
  v_redemption record;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 2. Status validation
  IF p_status NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'returned', 'on_hold') THEN
    RAISE EXCEPTION 'Invalid status: %. Allowed: pending, confirmed, processing, shipped, delivered, cancelled, refunded, returned, on_hold', p_status;
  END IF;

  -- 3. Retrieve order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = trim(p_order_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- 4. Check inventory restoration
  v_should_restore := (p_status IN ('cancelled', 'refunded'))
                  AND (v_order.status NOT IN ('cancelled', 'refunded'));

  IF v_should_restore AND v_order.items IS NOT NULL AND jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_item IN
      SELECT
        (elem->>'product_id')::uuid AS product_id,
        coalesce((elem->>'quantity')::integer, 0) AS quantity
      FROM jsonb_array_elements(v_order.items) AS elem
    LOOP
      IF v_item.product_id IS NOT NULL AND v_item.quantity > 0 THEN
        UPDATE public.products
        SET stock = stock + v_item.quantity, updated_at = now()
        WHERE id = v_item.product_id;

        IF FOUND THEN
          BEGIN
            INSERT INTO public.stock_movements (
              product_id,
              change,
              reason,
              order_id,
              admin_id
            )
            VALUES (
              v_item.product_id,
              v_item.quantity,
              'Order ' || p_order_id || ' status changed to ' || p_status || ' (stock returned to inventory)',
              p_order_id,
              auth.uid()
            );
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          v_items_restored := v_items_restored + 1;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 5. Idempotent Coupon Redemption Release
  IF p_status IN ('cancelled', 'refunded') AND v_order.status NOT IN ('cancelled', 'refunded') THEN
    FOR v_redemption IN
      SELECT id, coupon_id
      FROM public.coupon_redemptions
      WHERE order_id = trim(p_order_id) AND status = 'applied'
      FOR UPDATE
    LOOP
      UPDATE public.coupon_redemptions
      SET status = 'released',
          released_at = now()
      WHERE id = v_redemption.id;

      UPDATE public.coupons
      SET used_count = greatest(used_count - 1, 0),
          updated_at = now()
      WHERE id = v_redemption.coupon_id;
    END LOOP;
  END IF;

  -- 6. Update orders table
  UPDATE public.orders
  SET
    status = p_status,
    admin_note = coalesce(p_note, admin_note),
    cancel_reason = CASE WHEN p_status = 'cancelled' AND p_note IS NOT NULL THEN p_note ELSE cancel_reason END,
    updated_at = now()
  WHERE id = trim(p_order_id);

  -- 7. Insert audit event into order_events
  INSERT INTO public.order_events (order_id, status, note, created_by)
  VALUES (
    trim(p_order_id),
    p_status,
    p_note,
    auth.uid()
  );

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'previous_status', v_order.status,
    'new_status', p_status,
    'items_restored', v_items_restored,
    'note', p_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_order_status(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(text, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 9. CHECKOUT RPCS: create_verified_order & create_verified_order_guest
-- ----------------------------------------------------------------------------
-- Overload prevention: Drop all old parameter signatures first (avoid PGRST203)

DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text);
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb);

DROP FUNCTION IF EXISTS public.create_verified_order_guest(jsonb, jsonb, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order_guest(jsonb, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order_guest(jsonb, jsonb, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order_guest(jsonb, jsonb, text);
DROP FUNCTION IF EXISTS public.create_verified_order_guest(jsonb, jsonb);

-- A. Authenticated Checkout RPC
CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_customer jsonb,
  p_items jsonb,
  p_whatsapp_message text DEFAULT NULL,
  p_honeypot text DEFAULT NULL,
  p_promo_code text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cust_name text;
  v_raw_phone text;
  v_cust_phone text;
  v_cust_address text;
  v_cust_pincode text;
  v_sanitized_customer jsonb;

  v_item record;
  v_item_count integer;
  v_product record;
  v_qty integer;
  v_first_tier_price numeric(10, 2);
  v_applied_price numeric(10, 2);
  v_applied_min_qty integer;
  v_line_total numeric(10, 2);
  v_line_savings numeric(10, 2);

  v_subtotal numeric(10, 2) := 0;
  v_eligible_subtotal numeric(10, 2) := 0;
  v_total_savings numeric(10, 2) := 0;
  v_shipping numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_free_delivery_min numeric(10, 2) := 999;
  v_shipping_fee numeric(10, 2) := 49;
  v_max_qty_per_item integer := 500;
  v_seen_product_ids uuid[] := '{}';
  v_order_items jsonb := '[]'::jsonb;

  -- Coupon resolution
  v_input_code text;
  v_coupon record;
  v_applied_coupon_id uuid := NULL;
  v_applied_coupon_code text := NULL;
  v_discount_amount numeric(10, 2) := 0;
  v_phone_hash text;
  v_user_redemptions integer;
  v_eligible_category_ids uuid[] := NULL;

  v_order_id text;
  v_date_prefix text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_rand text;
  v_attempt integer;
  v_whatsapp_msg text;
  v_created_order public.orders;
BEGIN
  -- 1. Honeypot Anti-Bot Guard
  IF p_honeypot IS NOT NULL AND length(trim(p_honeypot)) > 0 THEN
    RAISE EXCEPTION 'Order submission rejected';
  END IF;

  -- 2. Customer Validation
  IF p_customer IS NULL OR jsonb_typeof(p_customer) <> 'object' THEN
    RAISE EXCEPTION 'Invalid customer details provided';
  END IF;

  v_cust_name := trim(COALESCE(p_customer->>'name', ''));
  IF length(v_cust_name) < 2 THEN
    RAISE EXCEPTION 'Customer name is required (minimum 2 characters)';
  END IF;

  v_raw_phone := regexp_replace(COALESCE(p_customer->>'phone', ''), '\D', '', 'g');
  IF length(v_raw_phone) = 12 AND v_raw_phone LIKE '91%' THEN
    v_cust_phone := substr(v_raw_phone, 3);
  ELSIF length(v_raw_phone) = 11 AND v_raw_phone LIKE '0%' THEN
    v_cust_phone := substr(v_raw_phone, 2);
  ELSE
    v_cust_phone := v_raw_phone;
  END IF;

  IF v_cust_phone !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid 10-digit mobile number: %. Must be a valid Indian mobile number', COALESCE(p_customer->>'phone', '');
  END IF;

  v_phone_hash := encode(sha256(v_cust_phone::bytea), 'hex');

  v_cust_address := trim(COALESCE(p_customer->>'address', ''));
  IF length(v_cust_address) < 5 THEN
    RAISE EXCEPTION 'Delivery address is required (minimum 5 characters)';
  END IF;

  v_cust_pincode := regexp_replace(COALESCE(p_customer->>'pincode', ''), '\D', '', 'g');
  IF length(v_cust_pincode) <> 6 THEN
    RAISE EXCEPTION 'PIN code must be exactly 6 digits';
  END IF;

  v_sanitized_customer := jsonb_build_object(
    'name', v_cust_name,
    'phone', v_cust_phone,
    'address', v_cust_address,
    'pincode', v_cust_pincode
  );

  -- 3. Items Payload Validation
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Items payload must be a non-empty array';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 THEN
    RAISE EXCEPTION 'Your order must contain at least 1 product';
  END IF;

  IF v_item_count > 50 THEN
    RAISE EXCEPTION 'Orders cannot contain more than 50 distinct items at once';
  END IF;

  -- 4. Store Delivery Thresholds
  v_free_delivery_min := 999;
  v_shipping_fee := 49;
  v_max_qty_per_item := 500;

  BEGIN
    SELECT
      COALESCE((value->>'free_delivery_min')::numeric, 999),
      COALESCE((value->>'shipping_fee')::numeric, 49),
      COALESCE((value->>'max_order_qty')::integer, 500)
    INTO v_free_delivery_min, v_shipping_fee, v_max_qty_per_item
    FROM public.store_settings
    WHERE key = 'store_delivery' OR key = 'store_config'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_free_delivery_min := 999;
    v_shipping_fee := 49;
    v_max_qty_per_item := 500;
  END;

  v_free_delivery_min := COALESCE(v_free_delivery_min, 999);
  v_shipping_fee := COALESCE(v_shipping_fee, 49);
  v_max_qty_per_item := COALESCE(v_max_qty_per_item, 500);

  -- 5. Lock Coupon row early if supplied to prevent race conditions
  v_input_code := upper(trim(COALESCE(NULLIF(p_coupon_code, ''), NULLIF(p_promo_code, ''), '')));
  IF length(v_input_code) > 0 THEN
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE upper(code) = v_input_code
    FOR UPDATE;

    IF NOT FOUND OR NOT v_coupon.is_active THEN
      RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" does not exist or is inactive', v_input_code;
    END IF;

    IF v_coupon.starts_at IS NOT NULL AND now() < v_coupon.starts_at THEN
      RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" is not yet active', v_input_code;
    END IF;

    IF v_coupon.expires_at IS NOT NULL AND now() > v_coupon.expires_at THEN
      RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" has expired', v_input_code;
    END IF;

    IF v_coupon.usage_limit_total IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit_total THEN
      RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" has reached its maximum redemption limit', v_input_code;
    END IF;

    -- Per-customer limit check
    SELECT count(*) INTO v_user_redemptions
    FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id
      AND status = 'applied'
      AND (
        (v_user_id IS NOT NULL AND user_id = v_user_id)
        OR (v_phone_hash IS NOT NULL AND phone_hash = v_phone_hash)
      );

    IF v_user_redemptions >= v_coupon.usage_limit_per_customer THEN
      RAISE EXCEPTION 'COUPON_INVALID: You have reached the redemption limit for coupon "%"', v_input_code;
    END IF;

    -- First order check
    IF v_coupon.first_order_only THEN
      IF v_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.orders WHERE user_id = v_user_id AND status NOT IN ('cancelled', 'refunded')
      ) THEN
        RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" is valid only for first-time orders', v_input_code;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.orders WHERE customer->>'phone' LIKE '%' || v_cust_phone AND status NOT IN ('cancelled', 'refunded')
      ) THEN
        RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" is valid only for first-time orders', v_input_code;
      END IF;
    END IF;

    IF v_coupon.category_ids IS NOT NULL AND array_length(v_coupon.category_ids, 1) > 0 THEN
      SELECT array_agg(DISTINCT d.id) INTO v_eligible_category_ids
      FROM unnest(v_coupon.category_ids) AS cat_id
      CROSS JOIN LATERAL public.get_category_descendant_ids(cat_id) AS d;
    END IF;
  END IF;

  -- 6. Process Line Items (Lock product rows FOR UPDATE)
  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      COALESCE(
        NULLIF(elem->>'quantity', '')::integer,
        NULLIF(elem->>'qty', '')::integer,
        0
      ) AS quantity,
      NULLIF(trim(COALESCE(elem->>'selected_color', elem->>'color', '')), '') AS selected_color
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'Every item must have a valid product_id';
    END IF;

    v_qty := v_item.quantity;
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be a positive integer';
    END IF;

    IF v_qty > v_max_qty_per_item THEN
      RAISE EXCEPTION 'Quantity of % exceeds maximum allowable limit of % per item', v_qty, v_max_qty_per_item;
    END IF;

    IF v_item.product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION 'Duplicate product in order: %. Consolidate quantities into a single line', v_item.product_id;
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, v_item.product_id);

    SELECT id, name, sku, category_id, price, images, is_active, stock, min_order_qty
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % does not exist', v_item.product_id;
    END IF;

    IF NOT COALESCE(v_product.is_active, true) THEN
      RAISE EXCEPTION 'Product "%" is currently unavailable', v_product.name;
    END IF;

    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%": requested %, available %', v_product.name, v_qty, v_product.stock;
    END IF;

    IF v_qty < COALESCE(v_product.min_order_qty, 1) THEN
      RAISE EXCEPTION 'Minimum order quantity for "%" is % units', v_product.name, COALESCE(v_product.min_order_qty, 1);
    END IF;

    -- Reuse existing tier pricing helper
    BEGIN
      v_applied_price := public.get_unit_price(v_product.id, v_qty);
    EXCEPTION WHEN OTHERS THEN
      v_applied_price := v_product.price;
    END;

    v_applied_price := COALESCE(v_applied_price, v_product.price, 0);
    v_first_tier_price := COALESCE(v_product.price, v_applied_price);

    v_line_total := round(v_applied_price * v_qty, 2);
    v_line_savings := greatest(round((v_first_tier_price - v_applied_price) * v_qty, 2), 0);

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

    IF v_eligible_category_ids IS NULL OR v_product.category_id = ANY(v_eligible_category_ids) THEN
      v_eligible_subtotal := v_eligible_subtotal + v_line_total;
    END IF;

    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'name', v_product.name,
        'sku', v_product.sku,
        'image', CASE WHEN array_length(v_product.images, 1) > 0 THEN v_product.images[1] ELSE NULL END,
        'quantity', v_qty,
        'unit_price', v_applied_price,
        'price', v_applied_price,
        'line_total', v_line_total,
        'first_tier_price', v_first_tier_price,
        'savings', v_line_savings,
        'min_qty', COALESCE(v_product.min_order_qty, 1),
        'selected_color', v_item.selected_color
      )
    );

    -- Stock deduction & movement audit
    UPDATE public.products
    SET stock = stock - v_qty,
        updated_at = now()
    WHERE id = v_product.id;

    INSERT INTO public.stock_movements (
      product_id,
      change,
      reason,
      created_by
    )
    VALUES (
      v_product.id,
      -v_qty,
      'Storefront order checkout',
      v_user_id
    );
  END LOOP;

  -- 7. Validate & Apply Coupon
  IF v_coupon.id IS NOT NULL THEN
    IF v_subtotal < v_coupon.min_order_value THEN
      RAISE EXCEPTION 'COUPON_INVALID: Minimum order value of ₹% required for coupon "%"', v_coupon.min_order_value, v_coupon.code;
    END IF;

    IF v_eligible_subtotal <= 0 THEN
      RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" is not valid for any items in your cart', v_coupon.code;
    END IF;

    IF v_coupon.discount_type = 'percent' THEN
      v_discount_amount := round(v_eligible_subtotal * (v_coupon.discount_value / 100.0), 2);
      IF v_coupon.max_discount_amount IS NOT NULL THEN
        v_discount_amount := least(v_discount_amount, v_coupon.max_discount_amount);
      END IF;
    ELSE
      v_discount_amount := least(v_coupon.discount_value, v_eligible_subtotal);
    END IF;

    v_discount_amount := least(v_discount_amount, v_eligible_subtotal);
    v_discount_amount := greatest(v_discount_amount, 0);

    v_applied_coupon_id := v_coupon.id;
    v_applied_coupon_code := v_coupon.code;

    UPDATE public.coupons
    SET used_count = used_count + 1,
        updated_at = now()
    WHERE id = v_coupon.id;
  END IF;

  -- 8. Shipping & Grand Total Calculation (Free delivery threshold evaluated after discount)
  IF (v_subtotal - v_discount_amount) >= v_free_delivery_min THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_shipping_fee;
  END IF;

  v_subtotal := COALESCE(v_subtotal, 0);
  v_discount_amount := COALESCE(v_discount_amount, 0);
  v_shipping := COALESCE(v_shipping, 0);
  v_total := greatest(v_subtotal - v_discount_amount, 0) + v_shipping;
  v_total := COALESCE(v_total, 0);
  v_total_savings := COALESCE(v_total_savings, 0) + v_discount_amount;

  -- 9. Order ID Generation (URT-YYMMDD-XXXX)
  v_date_prefix := 'URT-' || to_char(now(), 'YYMMDD') || '-';
  v_attempt := 0;

  LOOP
    v_attempt := v_attempt + 1;
    v_rand := '';
    FOR i IN 1..4 LOOP
      v_rand := v_rand || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;
    v_order_id := v_date_prefix || v_rand;

    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = v_order_id) THEN
      EXIT;
    END IF;

    IF v_attempt > 10 THEN
      v_order_id := v_date_prefix || upper(substr(gen_random_uuid()::text, 1, 6));
      EXIT;
    END IF;
  END LOOP;

  v_whatsapp_msg := COALESCE(
    p_whatsapp_message,
    format('URT Wholesale: Order %s placed. Subtotal: ₹%s, Discount: ₹%s, Shipping: ₹%s, Total: ₹%s for %s item line(s).',
      v_order_id, v_subtotal, v_discount_amount, v_shipping, v_total, v_item_count)
  );

  -- 10. Insert Confirmed Order Record
  INSERT INTO public.orders (
    id,
    user_id,
    customer,
    items,
    subtotal,
    subtotal_before_discount,
    savings,
    shipping,
    total,
    coupon_id,
    coupon_code,
    promo_code,
    discount_amount,
    status,
    source,
    payment_status,
    whatsapp_message
  )
  VALUES (
    v_order_id,
    v_user_id,
    v_sanitized_customer,
    v_order_items,
    v_subtotal,
    v_subtotal,
    COALESCE(v_total_savings, 0),
    COALESCE(v_shipping, 0),
    COALESCE(v_total, 0),
    v_applied_coupon_id,
    v_applied_coupon_code,
    v_applied_coupon_code,
    COALESCE(v_discount_amount, 0),
    'pending',
    'website',
    'pending',
    v_whatsapp_msg
  )
  RETURNING * INTO v_created_order;

  -- 11. Insert Coupon Redemption Record
  IF v_applied_coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (
      coupon_id,
      order_id,
      user_id,
      phone_hash,
      discount_amount,
      status,
      created_at
    )
    VALUES (
      v_applied_coupon_id,
      v_order_id,
      v_user_id,
      v_phone_hash,
      v_discount_amount,
      'applied',
      now()
    );
  END IF;

  -- Initial tracking event
  INSERT INTO public.order_events (order_id, status, note, created_by, title, description)
  VALUES (
    v_order_id,
    'pending',
    'Order created via wholesale storefront checkout',
    v_user_id,
    'Order Placed',
    'Wholesale order submitted. Pending payment verification & dispatch.'
  );

  RETURN v_created_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text, text, text) TO authenticated, service_role;

-- B. Guest Checkout RPC (Service-Role Only, Invoked by Edge Function)
CREATE OR REPLACE FUNCTION public.create_verified_order_guest(
  p_customer jsonb,
  p_items jsonb,
  p_whatsapp_message text DEFAULT NULL,
  p_honeypot text DEFAULT NULL,
  p_promo_code text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cust_name text;
  v_raw_phone text;
  v_cust_phone text;
  v_cust_address text;
  v_cust_pincode text;
  v_sanitized_customer jsonb;

  v_item record;
  v_item_count integer;
  v_product record;
  v_qty integer;
  v_first_tier_price numeric(10, 2);
  v_applied_price numeric(10, 2);
  v_applied_min_qty integer;
  v_line_total numeric(10, 2);
  v_line_savings numeric(10, 2);

  v_subtotal numeric(10, 2) := 0;
  v_eligible_subtotal numeric(10, 2) := 0;
  v_total_savings numeric(10, 2) := 0;
  v_shipping numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_free_delivery_min numeric(10, 2) := 999;
  v_shipping_fee numeric(10, 2) := 49;
  v_max_qty_per_item integer := 500;
  v_seen_product_ids uuid[] := '{}';
  v_order_items jsonb := '[]'::jsonb;

  -- Coupon resolution
  v_input_code text;
  v_coupon record;
  v_applied_coupon_id uuid := NULL;
  v_applied_coupon_code text := NULL;
  v_discount_amount numeric(10, 2) := 0;
  v_phone_hash text;
  v_user_redemptions integer;
  v_eligible_category_ids uuid[] := NULL;

  v_order_id text;
  v_date_prefix text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_rand text;
  v_attempt integer;
  v_whatsapp_msg text;
  v_created_order public.orders;
BEGIN
  -- 1. Honeypot Anti-Bot Guard
  IF p_honeypot IS NOT NULL AND length(trim(p_honeypot)) > 0 THEN
    RAISE EXCEPTION 'Order submission rejected';
  END IF;

  -- 2. Customer Validation
  IF p_customer IS NULL OR jsonb_typeof(p_customer) <> 'object' THEN
    RAISE EXCEPTION 'Invalid customer details provided';
  END IF;

  v_cust_name := trim(COALESCE(p_customer->>'name', ''));
  IF length(v_cust_name) < 2 THEN
    RAISE EXCEPTION 'Customer name is required (minimum 2 characters)';
  END IF;

  v_raw_phone := regexp_replace(COALESCE(p_customer->>'phone', ''), '\D', '', 'g');
  IF length(v_raw_phone) = 12 AND v_raw_phone LIKE '91%' THEN
    v_cust_phone := substr(v_raw_phone, 3);
  ELSIF length(v_raw_phone) = 11 AND v_raw_phone LIKE '0%' THEN
    v_cust_phone := substr(v_raw_phone, 2);
  ELSE
    v_cust_phone := v_raw_phone;
  END IF;

  IF v_cust_phone !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid 10-digit mobile number: %. Must be a valid Indian mobile number', COALESCE(p_customer->>'phone', '');
  END IF;

  v_phone_hash := encode(sha256(v_cust_phone::bytea), 'hex');

  v_cust_address := trim(COALESCE(p_customer->>'address', ''));
  IF length(v_cust_address) < 5 THEN
    RAISE EXCEPTION 'Delivery address is required (minimum 5 characters)';
  END IF;

  v_cust_pincode := regexp_replace(COALESCE(p_customer->>'pincode', ''), '\D', '', 'g');
  IF length(v_cust_pincode) <> 6 THEN
    RAISE EXCEPTION 'PIN code must be exactly 6 digits';
  END IF;

  v_sanitized_customer := jsonb_build_object(
    'name', v_cust_name,
    'phone', v_cust_phone,
    'address', v_cust_address,
    'pincode', v_cust_pincode
  );

  -- 3. Items Payload Validation
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Items payload must be a non-empty array';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 THEN
    RAISE EXCEPTION 'Your order must contain at least 1 product';
  END IF;

  IF v_item_count > 50 THEN
    RAISE EXCEPTION 'Orders cannot contain more than 50 distinct items at once';
  END IF;

  -- 4. Store Delivery Thresholds
  v_free_delivery_min := 999;
  v_shipping_fee := 49;
  v_max_qty_per_item := 500;

  BEGIN
    SELECT
      COALESCE((value->>'free_delivery_min')::numeric, 999),
      COALESCE((value->>'shipping_fee')::numeric, 49),
      COALESCE((value->>'max_order_qty')::integer, 500)
    INTO v_free_delivery_min, v_shipping_fee, v_max_qty_per_item
    FROM public.store_settings
    WHERE key = 'store_delivery' OR key = 'store_config'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_free_delivery_min := 999;
    v_shipping_fee := 49;
    v_max_qty_per_item := 500;
  END;

  v_free_delivery_min := COALESCE(v_free_delivery_min, 999);
  v_shipping_fee := COALESCE(v_shipping_fee, 49);
  v_max_qty_per_item := COALESCE(v_max_qty_per_item, 500);

  -- 5. Lock Coupon row early if supplied
  v_input_code := upper(trim(COALESCE(NULLIF(p_coupon_code, ''), NULLIF(p_promo_code, ''), '')));
  IF length(v_input_code) > 0 THEN
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE upper(code) = v_input_code
    FOR UPDATE;

    IF NOT FOUND OR NOT v_coupon.is_active THEN
      RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" does not exist or is inactive', v_input_code;
    END IF;

    IF v_coupon.starts_at IS NOT NULL AND now() < v_coupon.starts_at THEN
      RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" is not yet active', v_input_code;
    END IF;

    IF v_coupon.expires_at IS NOT NULL AND now() > v_coupon.expires_at THEN
      RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" has expired', v_input_code;
    END IF;

    IF v_coupon.usage_limit_total IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit_total THEN
      RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" has reached its maximum redemption limit', v_input_code;
    END IF;

    -- Per-customer limit check via phone_hash
    SELECT count(*) INTO v_user_redemptions
    FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id
      AND status = 'applied'
      AND phone_hash = v_phone_hash;

    IF v_user_redemptions >= v_coupon.usage_limit_per_customer THEN
      RAISE EXCEPTION 'COUPON_INVALID: You have reached the redemption limit for coupon "%"', v_input_code;
    END IF;

    -- First order check via phone
    IF v_coupon.first_order_only THEN
      IF EXISTS (
        SELECT 1 FROM public.orders WHERE customer->>'phone' LIKE '%' || v_cust_phone AND status NOT IN ('cancelled', 'refunded')
      ) THEN
        RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" is valid only for first-time orders', v_input_code;
      END IF;
    END IF;

    IF v_coupon.category_ids IS NOT NULL AND array_length(v_coupon.category_ids, 1) > 0 THEN
      SELECT array_agg(DISTINCT d.id) INTO v_eligible_category_ids
      FROM unnest(v_coupon.category_ids) AS cat_id
      CROSS JOIN LATERAL public.get_category_descendant_ids(cat_id) AS d;
    END IF;
  END IF;

  -- 6. Process Line Items (Lock product rows FOR UPDATE)
  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      COALESCE(
        NULLIF(elem->>'quantity', '')::integer,
        NULLIF(elem->>'qty', '')::integer,
        0
      ) AS quantity,
      NULLIF(trim(COALESCE(elem->>'selected_color', elem->>'color', '')), '') AS selected_color
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'Every item must have a valid product_id';
    END IF;

    v_qty := v_item.quantity;
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be a positive integer';
    END IF;

    IF v_qty > v_max_qty_per_item THEN
      RAISE EXCEPTION 'Quantity of % exceeds maximum allowable limit of % per item', v_qty, v_max_qty_per_item;
    END IF;

    IF v_item.product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION 'Duplicate product in order: %. Consolidate quantities into a single line', v_item.product_id;
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, v_item.product_id);

    SELECT id, name, sku, category_id, price, images, is_active, stock, min_order_qty
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % does not exist', v_item.product_id;
    END IF;

    IF NOT COALESCE(v_product.is_active, true) THEN
      RAISE EXCEPTION 'Product "%" is currently unavailable', v_product.name;
    END IF;

    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%": requested %, available %', v_product.name, v_qty, v_product.stock;
    END IF;

    IF v_qty < COALESCE(v_product.min_order_qty, 1) THEN
      RAISE EXCEPTION 'Minimum order quantity for "%" is % units', v_product.name, COALESCE(v_product.min_order_qty, 1);
    END IF;

    BEGIN
      v_applied_price := public.get_unit_price(v_product.id, v_qty);
    EXCEPTION WHEN OTHERS THEN
      v_applied_price := v_product.price;
    END;

    v_applied_price := COALESCE(v_applied_price, v_product.price, 0);
    v_first_tier_price := COALESCE(v_product.price, v_applied_price);

    v_line_total := round(v_applied_price * v_qty, 2);
    v_line_savings := greatest(round((v_first_tier_price - v_applied_price) * v_qty, 2), 0);

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

    IF v_eligible_category_ids IS NULL OR v_product.category_id = ANY(v_eligible_category_ids) THEN
      v_eligible_subtotal := v_eligible_subtotal + v_line_total;
    END IF;

    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'name', v_product.name,
        'sku', v_product.sku,
        'image', CASE WHEN array_length(v_product.images, 1) > 0 THEN v_product.images[1] ELSE NULL END,
        'quantity', v_qty,
        'unit_price', v_applied_price,
        'price', v_applied_price,
        'line_total', v_line_total,
        'first_tier_price', v_first_tier_price,
        'savings', v_line_savings,
        'min_qty', COALESCE(v_product.min_order_qty, 1),
        'selected_color', v_item.selected_color
      )
    );

    UPDATE public.products
    SET stock = stock - v_qty,
        updated_at = now()
    WHERE id = v_product.id;

    INSERT INTO public.stock_movements (
      product_id,
      change,
      reason
    )
    VALUES (
      v_product.id,
      -v_qty,
      'Storefront guest order checkout'
    );
  END LOOP;

  -- 7. Validate & Apply Coupon
  IF v_coupon.id IS NOT NULL THEN
    IF v_subtotal < v_coupon.min_order_value THEN
      RAISE EXCEPTION 'COUPON_INVALID: Minimum order value of ₹% required for coupon "%"', v_coupon.min_order_value, v_coupon.code;
    END IF;

    IF v_eligible_subtotal <= 0 THEN
      RAISE EXCEPTION 'COUPON_INVALID: Coupon "%" is not valid for any items in your cart', v_coupon.code;
    END IF;

    IF v_coupon.discount_type = 'percent' THEN
      v_discount_amount := round(v_eligible_subtotal * (v_coupon.discount_value / 100.0), 2);
      IF v_coupon.max_discount_amount IS NOT NULL THEN
        v_discount_amount := least(v_discount_amount, v_coupon.max_discount_amount);
      END IF;
    ELSE
      v_discount_amount := least(v_coupon.discount_value, v_eligible_subtotal);
    END IF;

    v_discount_amount := least(v_discount_amount, v_eligible_subtotal);
    v_discount_amount := greatest(v_discount_amount, 0);

    v_applied_coupon_id := v_coupon.id;
    v_applied_coupon_code := v_coupon.code;

    UPDATE public.coupons
    SET used_count = used_count + 1,
        updated_at = now()
    WHERE id = v_coupon.id;
  END IF;

  -- 8. Shipping & Grand Total Calculation
  IF (v_subtotal - v_discount_amount) >= v_free_delivery_min THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_shipping_fee;
  END IF;

  v_subtotal := COALESCE(v_subtotal, 0);
  v_discount_amount := COALESCE(v_discount_amount, 0);
  v_shipping := COALESCE(v_shipping, 0);
  v_total := greatest(v_subtotal - v_discount_amount, 0) + v_shipping;
  v_total := COALESCE(v_total, 0);
  v_total_savings := COALESCE(v_total_savings, 0) + v_discount_amount;

  -- 9. Order ID Generation (URT-YYMMDD-XXXX)
  v_date_prefix := 'URT-' || to_char(now(), 'YYMMDD') || '-';
  v_attempt := 0;

  LOOP
    v_attempt := v_attempt + 1;
    v_rand := '';
    FOR i IN 1..4 LOOP
      v_rand := v_rand || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;
    v_order_id := v_date_prefix || v_rand;

    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = v_order_id) THEN
      EXIT;
    END IF;

    IF v_attempt > 10 THEN
      v_order_id := v_date_prefix || upper(substr(gen_random_uuid()::text, 1, 6));
      EXIT;
    END IF;
  END LOOP;

  v_whatsapp_msg := COALESCE(
    p_whatsapp_message,
    format('URT Wholesale: Order %s placed. Subtotal: ₹%s, Discount: ₹%s, Shipping: ₹%s, Total: ₹%s for %s item line(s).',
      v_order_id, v_subtotal, v_discount_amount, v_shipping, v_total, v_item_count)
  );

  -- 10. Insert Confirmed Guest Order (user_id IS NULL)
  INSERT INTO public.orders (
    id,
    user_id,
    customer,
    items,
    subtotal,
    subtotal_before_discount,
    savings,
    shipping,
    total,
    coupon_id,
    coupon_code,
    promo_code,
    discount_amount,
    status,
    source,
    payment_status,
    whatsapp_message
  )
  VALUES (
    v_order_id,
    NULL,
    v_sanitized_customer,
    v_order_items,
    v_subtotal,
    v_subtotal,
    COALESCE(v_total_savings, 0),
    COALESCE(v_shipping, 0),
    COALESCE(v_total, 0),
    v_applied_coupon_id,
    v_applied_coupon_code,
    v_applied_coupon_code,
    COALESCE(v_discount_amount, 0),
    'pending',
    'website',
    'pending',
    v_whatsapp_msg
  )
  RETURNING * INTO v_created_order;

  -- 11. Insert Coupon Redemption Record
  IF v_applied_coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (
      coupon_id,
      order_id,
      user_id,
      phone_hash,
      discount_amount,
      status,
      created_at
    )
    VALUES (
      v_applied_coupon_id,
      v_order_id,
      NULL,
      v_phone_hash,
      v_discount_amount,
      'applied',
      now()
    );
  END IF;

  -- Initial tracking event
  INSERT INTO public.order_events (order_id, status, note, created_by, title, description)
  VALUES (
    v_order_id,
    'pending',
    'Guest order created via wholesale storefront checkout',
    NULL,
    'Order Placed',
    'Wholesale order submitted. Pending payment verification & dispatch.'
  );

  RETURN v_created_order;
END;
$$;

-- Enforce strict service_role exclusive access for guest order placement
REVOKE ALL ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text, text, text) TO service_role;

-- ----------------------------------------------------------------------------
-- 10. RPC: get_order_by_id (Exposes coupon_code & discount_amount safely)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_order_by_id(
  p_order_id text,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_order record;
  v_events jsonb;
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

  -- Non-owners and non-admins must supply a valid matching token
  IF NOT v_is_admin AND NOT v_is_owner THEN
    IF v_clean_token = '' OR v_order.public_token <> v_clean_token THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Events timeline
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'order_id', e.order_id,
        'status', e.status,
        'note', e.note,
        'created_at', e.created_at
      ) ORDER BY e.created_at ASC
    ), '[]'::jsonb
  ) INTO v_events
  FROM public.order_events e
  WHERE e.order_id = v_order.id
    AND (v_is_admin OR e.customer_visible = true);

  -- Owner / Admin View
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
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at,
      'events', v_events
    );
  END IF;

  -- Minimal Guest View with coupon summary (no sensitive customer/internal fields)
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
            'name', COALESCE(elem->>'name', elem->'product'->>'name', 'Item'),
            'quantity', CASE 
              WHEN (elem->>'quantity') ~ '^\d+$' THEN (elem->>'quantity')::integer 
              ELSE 1 
            END
          )
        ), '[]'::jsonb
      )
      FROM jsonb_array_elements(v_order.items) AS elem
    ),
    'timeline', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'status', e.status,
            'note', CASE WHEN e.customer_visible THEN e.note ELSE NULL END,
            'created_at', e.created_at
          ) ORDER BY e.created_at ASC
        ), '[]'::jsonb
      )
      FROM public.order_events e
      WHERE e.order_id = v_order.id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_id(text, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. ADMIN RPCS: Management & Analytics Tooling
-- ----------------------------------------------------------------------------

-- A. admin_list_coupons
CREATE OR REPLACE FUNCTION public.admin_list_coupons(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coupons jsonb;
  v_total_count integer;
  v_search text := trim(COALESCE(p_search, ''));
  v_limit integer := least(greatest(COALESCE(p_limit, 50), 1), 200);
  v_offset integer := greatest(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_total_count
  FROM public.coupons c
  WHERE (
    v_search = ''
    OR upper(c.code) LIKE '%' || upper(v_search) || '%'
    OR c.description ILIKE '%' || v_search || '%'
  )
  AND (
    p_status = 'all'
    OR (p_status = 'active' AND c.is_active = true AND (c.expires_at IS NULL OR c.expires_at > now()))
    OR (p_status = 'inactive' AND c.is_active = false)
    OR (p_status = 'expired' AND c.expires_at IS NOT NULL AND c.expires_at <= now())
  );

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'code', c.code,
        'description', c.description,
        'discount_type', c.discount_type,
        'discount_value', c.discount_value,
        'max_discount_amount', c.max_discount_amount,
        'min_order_value', c.min_order_value,
        'starts_at', c.starts_at,
        'expires_at', c.expires_at,
        'usage_limit_total', c.usage_limit_total,
        'usage_limit_per_customer', c.usage_limit_per_customer,
        'used_count', c.used_count,
        'first_order_only', c.first_order_only,
        'category_ids', c.category_ids,
        'is_active', c.is_active,
        'created_at', c.created_at,
        'updated_at', c.updated_at
      ) ORDER BY c.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_coupons
  FROM (
    SELECT *
    FROM public.coupons c
    WHERE (
      v_search = ''
      OR upper(c.code) LIKE '%' || upper(v_search) || '%'
      OR c.description ILIKE '%' || v_search || '%'
    )
    AND (
      p_status = 'all'
      OR (p_status = 'active' AND c.is_active = true AND (c.expires_at IS NULL OR c.expires_at > now()))
      OR (p_status = 'inactive' AND c.is_active = false)
      OR (p_status = 'expired' AND c.expires_at IS NOT NULL AND c.expires_at <= now())
    )
    ORDER BY c.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) c;

  RETURN jsonb_build_object(
    'coupons', v_coupons,
    'total_count', v_total_count,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

-- B. admin_upsert_coupon
CREATE OR REPLACE FUNCTION public.admin_upsert_coupon(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_code text;
  v_description text;
  v_discount_type text;
  v_discount_value numeric;
  v_max_discount numeric;
  v_min_order numeric;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_limit_total integer;
  v_limit_per_cust integer;
  v_first_order boolean;
  v_category_ids uuid[];
  v_is_active boolean;
  v_result public.coupons;
  v_action text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid coupon payload object';
  END IF;

  v_id := NULLIF(p_payload->>'id', '')::uuid;
  v_code := upper(trim(COALESCE(p_payload->>'code', '')));

  IF length(v_code) = 0 OR length(v_code) > 32 OR v_code !~ '^[A-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Invalid coupon code format. Use 1-32 alphanumeric characters, dashes, or underscores.';
  END IF;

  -- Unique code conflict check
  IF EXISTS (
    SELECT 1 FROM public.coupons
    WHERE upper(code) = v_code AND (v_id IS NULL OR id <> v_id)
  ) THEN
    RAISE EXCEPTION 'Coupon code "%" is already in use.', v_code;
  END IF;

  v_description := trim(COALESCE(p_payload->>'description', ''));
  v_discount_type := COALESCE(p_payload->>'discount_type', 'percent');
  IF v_discount_type NOT IN ('percent', 'fixed') THEN
    RAISE EXCEPTION 'discount_type must be either "percent" or "fixed"';
  END IF;

  v_discount_value := (p_payload->>'discount_value')::numeric;
  IF v_discount_value IS NULL OR v_discount_value <= 0 THEN
    RAISE EXCEPTION 'discount_value must be greater than 0';
  END IF;

  IF v_discount_type = 'percent' AND v_discount_value > 100 THEN
    RAISE EXCEPTION 'Percentage discount cannot exceed 100%%';
  END IF;

  v_max_discount := NULLIF(p_payload->>'max_discount_amount', '')::numeric;
  IF v_max_discount IS NOT NULL AND v_max_discount <= 0 THEN
    RAISE EXCEPTION 'max_discount_amount must be greater than 0 if provided';
  END IF;

  v_min_order := COALESCE(NULLIF(p_payload->>'min_order_value', '')::numeric, 0);
  IF v_min_order < 0 THEN
    RAISE EXCEPTION 'min_order_value cannot be negative';
  END IF;

  v_starts_at := NULLIF(p_payload->>'starts_at', '')::timestamptz;
  v_expires_at := NULLIF(p_payload->>'expires_at', '')::timestamptz;

  IF v_starts_at IS NOT NULL AND v_expires_at IS NOT NULL AND v_expires_at <= v_starts_at THEN
    RAISE EXCEPTION 'expires_at must be later than starts_at';
  END IF;

  v_limit_total := NULLIF(p_payload->>'usage_limit_total', '')::integer;
  v_limit_per_cust := COALESCE(NULLIF(p_payload->>'usage_limit_per_customer', '')::integer, 1);
  IF v_limit_per_cust < 1 THEN
    RAISE EXCEPTION 'usage_limit_per_customer must be at least 1';
  END IF;

  v_first_order := COALESCE((p_payload->>'first_order_only')::boolean, false);
  v_is_active := COALESCE((p_payload->>'is_active')::boolean, true);

  -- Category restriction parsing
  IF p_payload->'category_ids' IS NOT NULL AND jsonb_typeof(p_payload->'category_ids') = 'array' THEN
    SELECT COALESCE(array_agg(elem::text::uuid), '{}'::uuid[])
    INTO v_category_ids
    FROM jsonb_array_elements_text(p_payload->'category_ids') AS elem
    WHERE elem ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  ELSE
    v_category_ids := '{}';
  END IF;

  IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.coupons WHERE id = v_id) THEN
    v_action := 'update';
    UPDATE public.coupons
    SET
      code = v_code,
      description = NULLIF(v_description, ''),
      discount_type = v_discount_type,
      discount_value = v_discount_value,
      max_discount_amount = v_max_discount,
      min_order_value = v_min_order,
      starts_at = v_starts_at,
      expires_at = v_expires_at,
      usage_limit_total = v_limit_total,
      usage_limit_per_customer = v_limit_per_cust,
      first_order_only = v_first_order,
      category_ids = v_category_ids,
      is_active = v_is_active,
      updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_result;
  ELSE
    v_action := 'create';
    INSERT INTO public.coupons (
      code,
      description,
      discount_type,
      discount_value,
      max_discount_amount,
      min_order_value,
      starts_at,
      expires_at,
      usage_limit_total,
      usage_limit_per_customer,
      first_order_only,
      category_ids,
      is_active,
      created_by
    )
    VALUES (
      v_code,
      NULLIF(v_description, ''),
      v_discount_type,
      v_discount_value,
      v_max_discount,
      v_min_order,
      v_starts_at,
      v_expires_at,
      v_limit_total,
      v_limit_per_cust,
      v_first_order,
      v_category_ids,
      v_is_active,
      auth.uid()
    )
    RETURNING * INTO v_result;
  END IF;

  -- Write audit event
  INSERT INTO public.coupon_audit_events (
    coupon_id,
    action,
    actor_id,
    details
  )
  VALUES (
    v_result.id,
    v_action,
    auth.uid(),
    jsonb_build_object(
      'code', v_result.code,
      'discount_type', v_result.discount_type,
      'discount_value', v_result.discount_value,
      'is_active', v_result.is_active
    )
  );

  RETURN to_jsonb(v_result);
END;
$$;

-- C. admin_toggle_coupon
CREATE OR REPLACE FUNCTION public.admin_toggle_coupon(
  p_id uuid,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coupon public.coupons;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.coupons
  SET is_active = p_active,
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_coupon;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon not found: %', p_id;
  END IF;

  INSERT INTO public.coupon_audit_events (
    coupon_id,
    action,
    actor_id,
    details
  )
  VALUES (
    p_id,
    'toggle',
    auth.uid(),
    jsonb_build_object('code', v_coupon.code, 'is_active', p_active)
  );

  RETURN to_jsonb(v_coupon);
END;
$$;

-- D. admin_delete_coupon
CREATE OR REPLACE FUNCTION public.admin_delete_coupon(
  p_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coupon public.coupons;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon not found: %', p_id;
  END IF;

  IF v_coupon.used_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete a coupon that has been redeemed (% time(s)). Deactivate the coupon instead.', v_coupon.used_count;
  END IF;

  DELETE FROM public.coupons WHERE id = p_id;

  INSERT INTO public.coupon_audit_events (
    coupon_id,
    action,
    actor_id,
    details
  )
  VALUES (
    p_id,
    'delete',
    auth.uid(),
    jsonb_build_object('code', v_coupon.code, 'used_count', v_coupon.used_count)
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', p_id,
    'code', v_coupon.code
  );
END;
$$;

-- E. admin_coupon_stats
CREATE OR REPLACE FUNCTION public.admin_coupon_stats(
  p_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coupon public.coupons;
  v_stats record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon not found: %', p_id;
  END IF;

  SELECT
    count(*) FILTER (WHERE r.status = 'applied') AS total_redemptions,
    count(*) FILTER (WHERE r.status = 'released') AS released_redemptions,
    COALESCE(sum(r.discount_amount) FILTER (WHERE r.status = 'applied'), 0) AS total_discount_given,
    COALESCE(sum(o.total) FILTER (WHERE r.status = 'applied'), 0) AS revenue_influenced,
    max(r.created_at) FILTER (WHERE r.status = 'applied') AS last_used
  INTO v_stats
  FROM public.coupon_redemptions r
  LEFT JOIN public.orders o ON o.id = r.order_id
  WHERE r.coupon_id = p_id;

  RETURN jsonb_build_object(
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'is_active', v_coupon.is_active,
    'used_count', v_coupon.used_count,
    'total_redemptions', COALESCE(v_stats.total_redemptions, 0),
    'released_redemptions', COALESCE(v_stats.released_redemptions, 0),
    'total_discount_given', COALESCE(v_stats.total_discount_given, 0),
    'revenue_influenced', COALESCE(v_stats.revenue_influenced, 0),
    'last_used', v_stats.last_used
  );
END;
$$;

-- F. admin_list_coupon_redemptions
CREATE OR REPLACE FUNCTION public.admin_list_coupon_redemptions(
  p_coupon_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_redemptions jsonb;
  v_total_count integer;
  v_limit integer := least(greatest(COALESCE(p_limit, 50), 1), 200);
  v_offset integer := greatest(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_total_count
  FROM public.coupon_redemptions
  WHERE coupon_id = p_coupon_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'coupon_id', r.coupon_id,
        'order_id', r.order_id,
        'user_id', r.user_id,
        'customer_name', COALESCE(o.customer->>'name', p.full_name, 'Wholesale Customer'),
        'phone_masked', CASE 
          WHEN length(COALESCE(o.customer->>'phone', '')) >= 4 
          THEN '******' || right(o.customer->>'phone', 4) 
          ELSE '******' 
        END,
        'discount_amount', r.discount_amount,
        'order_total', o.total,
        'order_status', o.status,
        'status', r.status,
        'created_at', r.created_at,
        'released_at', r.released_at
      ) ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_redemptions
  FROM (
    SELECT r.*
    FROM public.coupon_redemptions r
    WHERE r.coupon_id = p_coupon_id
    ORDER BY r.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) r
  LEFT JOIN public.orders o ON o.id = r.order_id
  LEFT JOIN public.profiles p ON p.id = r.user_id;

  RETURN jsonb_build_object(
    'redemptions', v_redemptions,
    'total_count', v_total_count,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

-- Revoke execute from public/anon on all administrative RPCs
REVOKE ALL ON FUNCTION public.admin_list_coupons(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_coupon(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_toggle_coupon(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_coupon(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_coupon_stats(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_coupon_redemptions(uuid, integer, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_list_coupons(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_coupon(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_coupon(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_coupon(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_coupon_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_coupon_redemptions(uuid, integer, integer) TO authenticated;

-- ============================================================================
-- ROLLBACK SCRIPT (Commented)
-- ============================================================================
/*
-- 1. Drop administrative functions
DROP FUNCTION IF EXISTS public.admin_list_coupon_redemptions(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.admin_coupon_stats(uuid);
DROP FUNCTION IF EXISTS public.admin_delete_coupon(uuid);
DROP FUNCTION IF EXISTS public.admin_toggle_coupon(uuid, boolean);
DROP FUNCTION IF EXISTS public.admin_upsert_coupon(jsonb);
DROP FUNCTION IF EXISTS public.admin_list_coupons(text, text, integer, integer);

-- 2. Drop validation function & auto-release trigger
DROP FUNCTION IF EXISTS public.validate_coupon(text, jsonb, text);
DROP TRIGGER IF EXISTS trg_orders_release_coupon ON public.orders;
DROP FUNCTION IF EXISTS public.trg_release_coupon_on_order_cancel();

-- 3. Drop tables in dependency order
DROP TABLE IF EXISTS public.coupon_validation_attempts;
DROP TABLE IF EXISTS public.coupon_audit_events;
DROP TABLE IF EXISTS public.coupon_redemptions;
DROP TABLE IF EXISTS public.coupons;

-- 4. Revert orders columns (Optional)
ALTER TABLE public.orders DROP COLUMN IF EXISTS coupon_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS coupon_code;
ALTER TABLE public.orders DROP COLUMN IF EXISTS subtotal_before_discount;
*/

