-- ============================================================================
-- Migration 033: Promo Codes System with Min-Amount Thresholds & Admin Control
-- ============================================================================
-- Purpose:
--   1. Create public.promo_codes table with threshold amounts, percentage/fixed
--      discounts, caps, usage limits, and active status.
--   2. Add promo_code & discount_amount columns to public.orders.
--   3. Create public.validate_promo_code(p_code, p_order_amount) RPC for instant
--      storefront verification and shortfall feedback ("Add ₹X more to use").
--   4. Update create_verified_order & create_verified_order_guest to apply and
--      verify promo codes server-side, track usage, and deduct from order total.
--   5. Seed initial high-converting wholesale promo codes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CREATE PROMO CODES TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text NOT NULL DEFAULT '',
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(10, 2) NOT NULL CHECK (discount_value > 0),
  min_order_amount numeric(10, 2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  max_discount_amount numeric(10, 2) CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  start_date timestamptz,
  end_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique case-insensitive index on promo code
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_upper_code
  ON public.promo_codes (upper(trim(code)));

-- Index for ordering active codes
CREATE INDEX IF NOT EXISTS idx_promo_codes_active_min_order
  ON public.promo_codes (is_active, min_order_amount ASC);

-- ----------------------------------------------------------------------------
-- 2. ADD PROMO COLUMNS TO ORDERS
-- ----------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_promo_code ON public.orders (promo_code)
  WHERE promo_code IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active promo codes" ON public.promo_codes;
CREATE POLICY "Anyone can read active promo codes"
  ON public.promo_codes FOR SELECT
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage promo codes" ON public.promo_codes;
CREATE POLICY "Admins can manage promo codes"
  ON public.promo_codes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.promo_codes TO anon, authenticated;
GRANT ALL ON public.promo_codes TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. VALIDATE PROMO CODE RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_promo_code(
  p_code text,
  p_order_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_promo record;
  v_discount numeric(10, 2) := 0;
  v_clean_code text := upper(trim(COALESCE(p_code, '')));
  v_amount numeric(10, 2) := round(COALESCE(p_order_amount, 0), 2);
BEGIN
  IF v_clean_code = '' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Please enter a valid promo code'
    );
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE upper(trim(code)) = v_clean_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', format('Promo code "%s" does not exist', v_clean_code)
    );
  END IF;

  IF NOT v_promo.is_active THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', format('Promo code "%s" is inactive', v_promo.code)
    );
  END IF;

  IF v_promo.start_date IS NOT NULL AND now() < v_promo.start_date THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', format('Promo code "%s" starts on %s', v_promo.code, to_char(v_promo.start_date, 'DD Mon YYYY'))
    );
  END IF;

  IF v_promo.end_date IS NOT NULL AND now() > v_promo.end_date THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', format('Promo code "%s" has expired', v_promo.code)
    );
  END IF;

  IF v_promo.usage_limit IS NOT NULL AND v_promo.usage_count >= v_promo.usage_limit THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', format('Promo code "%s" has reached its usage limit', v_promo.code)
    );
  END IF;

  IF v_amount < v_promo.min_order_amount THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', format('Add ₹%s more to your cart to use code "%s"', round(v_promo.min_order_amount - v_amount, 2), v_promo.code),
      'code', v_promo.code,
      'min_order_amount', v_promo.min_order_amount,
      'shortfall', round(v_promo.min_order_amount - v_amount, 2)
    );
  END IF;

  IF v_promo.discount_type = 'percentage' THEN
    v_discount := round(v_amount * (v_promo.discount_value / 100.0), 2);
    IF v_promo.max_discount_amount IS NOT NULL THEN
      v_discount := least(v_discount, v_promo.max_discount_amount);
    END IF;
  ELSE
    v_discount := least(v_promo.discount_value, v_amount);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'message', format('Code "%s" applied! You save ₹%s', v_promo.code, v_discount),
    'code', v_promo.code,
    'description', v_promo.description,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value,
    'discount_amount', v_discount,
    'min_order_amount', v_promo.min_order_amount,
    'max_discount_amount', v_promo.max_discount_amount,
    'new_total', greatest(v_amount - v_discount, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, numeric) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. INITIAL SEED PROMO CODES
-- ----------------------------------------------------------------------------

INSERT INTO public.promo_codes (
  code,
  description,
  discount_type,
  discount_value,
  min_order_amount,
  max_discount_amount,
  is_active
)
VALUES
  (
    'WELCOME100',
    'Flat ₹100 instant discount on orders above ₹2,000',
    'fixed',
    100,
    2000,
    NULL,
    true
  ),
  (
    'BULK500',
    'Flat ₹500 wholesale discount on orders above ₹6,000',
    'fixed',
    500,
    6000,
    NULL,
    true
  ),
  (
    'MEGA1000',
    'Flat ₹1,000 mega bulk savings on orders above ₹12,000',
    'fixed',
    1000,
    12000,
    NULL,
    true
  ),
  (
    'VIP5',
    'Extra 5% off wholesale orders above ₹15,000 (Max ₹1,500)',
    'percentage',
    5,
    15000,
    1500,
    true
  )
ON CONFLICT ((upper(trim(code)))) DO UPDATE
SET description = EXCLUDED.description,
    discount_type = EXCLUDED.discount_type,
    discount_value = EXCLUDED.discount_value,
    min_order_amount = EXCLUDED.min_order_amount,
    max_discount_amount = EXCLUDED.max_discount_amount,
    is_active = true;

-- ----------------------------------------------------------------------------
-- 6. HARDENED CHECKOUT RPCS WITH PROMO CODE SUPPORT
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order_guest(jsonb, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order_guest(jsonb, jsonb, text, text);

-- Authenticated Checkout with Promo Code
CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_customer jsonb,
  p_items jsonb,
  p_whatsapp_message text DEFAULT NULL,
  p_honeypot text DEFAULT NULL,
  p_promo_code text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
  v_first_tier_price numeric(10, 2);
  v_unit_price numeric(10, 2);
  v_applied_min_qty integer;
  v_qty integer;
  v_line_total numeric(10, 2);
  v_line_savings numeric(10, 2);
  v_subtotal numeric(10, 2) := 0;
  v_total_savings numeric(10, 2) := 0;
  v_shipping numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_free_delivery_min numeric(10, 2) := 999;
  v_shipping_fee numeric(10, 2) := 49;
  v_max_order_qty integer := 500;
  v_seen_product_ids uuid[] := '{}';
  v_order_items jsonb := '[]'::jsonb;

  v_promo record;
  v_applied_promo text := NULL;
  v_discount_amount numeric(10, 2) := 0;

  v_order_id text;
  v_date_prefix text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_rand text;
  v_attempt integer;
  v_user_id uuid := auth.uid();
  v_whatsapp_msg text;
  v_created_order public.orders;
  v_recent_unconfirmed_count integer;
BEGIN
  -- 1. Validate Customer Payload
  IF p_customer IS NULL OR jsonb_typeof(p_customer) <> 'object' THEN
    RAISE EXCEPTION 'Customer details payload must be a valid JSON object';
  END IF;

  IF p_honeypot IS NOT NULL AND length(trim(p_honeypot)) > 0 THEN
    RAISE EXCEPTION 'Order submission rejected by security filter';
  END IF;

  IF p_customer->>'website_url' IS NOT NULL AND length(trim(p_customer->>'website_url')) > 0 THEN
    RAISE EXCEPTION 'Order submission rejected by security filter';
  END IF;

  v_cust_name := NULLIF(trim(COALESCE(p_customer->>'name', '')), '');
  IF v_cust_name IS NULL OR length(v_cust_name) < 2 OR length(v_cust_name) > 120 THEN
    RAISE EXCEPTION 'Customer name must be between 2 and 120 characters';
  END IF;

  v_raw_phone := trim(COALESCE(p_customer->>'phone', ''));
  v_cust_phone := regexp_replace(v_raw_phone, '[^0-9]', '', 'g');
  IF length(v_cust_phone) = 12 AND v_cust_phone LIKE '91%' THEN
    v_cust_phone := substr(v_cust_phone, 3, 10);
  ELSIF length(v_cust_phone) = 11 AND v_cust_phone LIKE '0%' THEN
    v_cust_phone := substr(v_cust_phone, 2, 10);
  END IF;

  IF length(v_cust_phone) <> 10 OR v_cust_phone !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid mobile number: %. Must be a valid 10-digit Indian mobile number', v_raw_phone;
  END IF;

  v_cust_address := NULLIF(trim(COALESCE(p_customer->>'address', '')), '');
  IF v_cust_address IS NULL OR length(v_cust_address) < 5 OR length(v_cust_address) > 500 THEN
    RAISE EXCEPTION 'Delivery address must be between 5 and 500 characters';
  END IF;

  v_cust_pincode := trim(COALESCE(p_customer->>'pincode', ''));
  IF v_cust_pincode !~ '^[1-9][0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid PIN code: %. Must be a valid 6-digit Indian postal code', v_cust_pincode;
  END IF;

  v_sanitized_customer := jsonb_build_object(
    'name', v_cust_name,
    'phone', v_cust_phone,
    'address', v_cust_address,
    'pincode', v_cust_pincode,
    'city', NULLIF(trim(COALESCE(p_customer->>'city', '')), ''),
    'state', NULLIF(trim(COALESCE(p_customer->>'state', '')), '')
  );

  -- 2. Anti-Spam: Rate Limit Unconfirmed Pending Orders
  IF v_user_id IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_recent_unconfirmed_count
    FROM public.orders
    WHERE user_id = v_user_id
      AND status = 'pending'
      AND created_at >= NOW() - INTERVAL '1 hour';

    IF v_recent_unconfirmed_count >= 10 THEN
      RAISE EXCEPTION 'Too many unconfirmed pending orders. Please wait before creating another order.';
    END IF;
  END IF;

  -- 3. Validate Items Payload
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

  -- Safely read store thresholds
  BEGIN
    SELECT COALESCE(
      CASE 
        WHEN jsonb_typeof(value) = 'number' THEN (value::text)::numeric
        WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::numeric
        ELSE (value->>'free_delivery_min')::numeric
      END,
      999
    )
    INTO v_free_delivery_min
    FROM public.store_settings
    WHERE key = 'free_delivery_min';
  EXCEPTION WHEN OTHERS THEN
    v_free_delivery_min := 999;
  END;
  v_free_delivery_min := COALESCE(v_free_delivery_min, 999);

  BEGIN
    SELECT COALESCE(
      CASE 
        WHEN jsonb_typeof(value) = 'number' THEN (value::text)::numeric
        WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::numeric
        ELSE (value->>'shipping_fee')::numeric
      END,
      49
    )
    INTO v_shipping_fee
    FROM public.store_settings
    WHERE key = 'shipping_fee';
  EXCEPTION WHEN OTHERS THEN
    v_shipping_fee := 49;
  END;
  v_shipping_fee := COALESCE(v_shipping_fee, 49);

  BEGIN
    SELECT COALESCE(
      CASE 
        WHEN jsonb_typeof(value) = 'number' THEN (value::text)::integer
        WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::integer
        ELSE (value->>'max_order_qty')::integer
      END,
      500
    )
    INTO v_max_order_qty
    FROM public.store_settings
    WHERE key = 'max_order_qty';
  EXCEPTION WHEN OTHERS THEN
    v_max_order_qty := 500;
  END;
  v_max_order_qty := COALESCE(v_max_order_qty, 500);

  -- 4. Process Each Item (Lock rows FOR UPDATE)
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

    IF v_qty > v_max_order_qty THEN
      RAISE EXCEPTION 'Quantity % exceeds maximum allowed order limit of % units', v_qty, v_max_order_qty;
    END IF;

    IF v_item.product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION 'Duplicate product detected in order items. Merge quantities for product %', v_item.product_id;
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, v_item.product_id);

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found in catalog', v_item.product_id;
    END IF;

    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'Product "%" is currently inactive and cannot be ordered', v_product.name;
    END IF;

    IF v_qty < COALESCE(v_product.min_order_qty, 1) THEN
      RAISE EXCEPTION 'Minimum order quantity for "%" is % (requested %)',
        v_product.name, COALESCE(v_product.min_order_qty, 1), v_qty;
    END IF;

    IF v_product.max_order_qty IS NOT NULL AND v_qty > v_product.max_order_qty THEN
      RAISE EXCEPTION 'Maximum allowed quantity for "%" is % (requested %)',
        v_product.name, v_product.max_order_qty, v_qty;
    END IF;

    IF COALESCE(v_product.order_qty_step, 1) > 1 AND (v_qty % v_product.order_qty_step <> 0) THEN
      RAISE EXCEPTION 'Order quantity for "%" must be a multiple of % (requested %)',
        v_product.name, v_product.order_qty_step, v_qty;
    END IF;

    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%". Available: %, Requested: %',
        v_product.name, v_product.stock, v_qty;
    END IF;

    v_unit_price := public.get_unit_price(v_product.id, v_qty);

    SELECT unit_price INTO v_first_tier_price
    FROM public.product_price_tiers
    WHERE product_id = v_product.id
    ORDER BY min_qty ASC
    LIMIT 1;

    v_first_tier_price := COALESCE(v_first_tier_price, v_product.price);

    SELECT min_qty INTO v_applied_min_qty
    FROM public.product_price_tiers
    WHERE product_id = v_product.id AND min_qty <= v_qty
    ORDER BY min_qty DESC
    LIMIT 1;

    v_applied_min_qty := COALESCE(v_applied_min_qty, COALESCE(v_product.min_order_qty, 1));

    v_line_total := round(v_unit_price * v_qty, 2);
    v_line_savings := greatest(round((v_first_tier_price - v_unit_price) * v_qty, 2), 0);

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'name', v_product.name,
        'slug', v_product.slug,
        'sku', v_product.sku,
        'image', CASE WHEN array_length(v_product.images, 1) > 0 THEN v_product.images[1] ELSE NULL END,
        'quantity', v_qty,
        'qty', v_qty,
        'unit_price', v_unit_price,
        'price', v_unit_price,
        'total', v_line_total,
        'line_total', v_line_total,
        'first_tier_price', v_first_tier_price,
        'savings', v_line_savings,
        'min_qty', v_applied_min_qty,
        'tier_min_qty', v_applied_min_qty,
        'selected_color', v_item.selected_color
      )
    );

    UPDATE public.products
    SET stock = stock - v_qty,
        updated_at = NOW()
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

  -- 5. Validate & Apply Promo Code (Server-side Enforcement)
  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo
    FROM public.promo_codes
    WHERE upper(trim(code)) = upper(trim(p_promo_code))
    FOR UPDATE;

    IF FOUND AND v_promo.is_active
       AND (v_promo.start_date IS NULL OR now() >= v_promo.start_date)
       AND (v_promo.end_date IS NULL OR now() <= v_promo.end_date)
       AND (v_promo.usage_limit IS NULL OR v_promo.usage_count < v_promo.usage_limit)
       AND v_subtotal >= v_promo.min_order_amount THEN

      IF v_promo.discount_type = 'percentage' THEN
        v_discount_amount := round(v_subtotal * (v_promo.discount_value / 100.0), 2);
        IF v_promo.max_discount_amount IS NOT NULL THEN
          v_discount_amount := least(v_discount_amount, v_promo.max_discount_amount);
        END IF;
      ELSE
        v_discount_amount := least(v_promo.discount_value, v_subtotal);
      END IF;

      v_applied_promo := v_promo.code;

      UPDATE public.promo_codes
      SET usage_count = usage_count + 1,
          updated_at = now()
      WHERE id = v_promo.id;
    END IF;
  END IF;

  -- 6. Shipping & Total Calculation
  IF v_subtotal >= v_free_delivery_min THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_shipping_fee;
  END IF;

  v_shipping := COALESCE(v_shipping, 0);
  v_subtotal := COALESCE(v_subtotal, 0);
  v_discount_amount := COALESCE(v_discount_amount, 0);
  v_total := greatest(v_subtotal - v_discount_amount, 0) + v_shipping;
  v_total_savings := COALESCE(v_total_savings, 0) + v_discount_amount;

  -- 7. Collision-Resistant Order ID Generation
  v_date_prefix := 'URT-' || to_char(NOW(), 'YYMMDD') || '-';
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

  -- 8. Insert Order Record
  INSERT INTO public.orders (
    id,
    user_id,
    customer,
    items,
    subtotal,
    savings,
    shipping,
    total,
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
    COALESCE(v_subtotal, 0),
    COALESCE(v_total_savings, 0),
    COALESCE(v_shipping, 0),
    COALESCE(v_total, 0),
    v_applied_promo,
    COALESCE(v_discount_amount, 0),
    'pending',
    'website',
    'pending',
    v_whatsapp_msg
  )
  RETURNING * INTO v_created_order;

  -- Link order_id on stock_movements
  UPDATE public.stock_movements
  SET order_id = v_order_id,
      reference_id = v_order_id
  WHERE product_id = ANY(v_seen_product_ids)
    AND reason = 'Storefront order checkout'
    AND order_id IS NULL
    AND created_at >= NOW() - INTERVAL '30 seconds';

  -- Order event audit
  INSERT INTO public.order_events (
    order_id,
    status,
    note,
    title,
    description,
    customer_visible
  )
  VALUES (
    v_order_id,
    'pending',
    CASE 
      WHEN v_applied_promo IS NOT NULL THEN format('Order created via storefront checkout with promo code %s (-₹%s)', v_applied_promo, v_discount_amount)
      ELSE 'Order created via storefront checkout'
    END,
    'Order Placed',
    'Order created via storefront checkout',
    true
  );

  RETURN v_created_order;
END;
$$;


-- Guest Checkout with Promo Code (via service_role)
CREATE OR REPLACE FUNCTION public.create_verified_order_guest(
  p_customer jsonb,
  p_items jsonb,
  p_whatsapp_message text DEFAULT NULL,
  p_honeypot text DEFAULT NULL,
  p_promo_code text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
  v_first_tier_price numeric(10, 2);
  v_unit_price numeric(10, 2);
  v_applied_min_qty integer;
  v_qty integer;
  v_line_total numeric(10, 2);
  v_line_savings numeric(10, 2);
  v_subtotal numeric(10, 2) := 0;
  v_total_savings numeric(10, 2) := 0;
  v_shipping numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_free_delivery_min numeric(10, 2) := 999;
  v_shipping_fee numeric(10, 2) := 49;
  v_max_order_qty integer := 500;
  v_seen_product_ids uuid[] := '{}';
  v_order_items jsonb := '[]'::jsonb;

  v_promo record;
  v_applied_promo text := NULL;
  v_discount_amount numeric(10, 2) := 0;

  v_order_id text;
  v_date_prefix text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_rand text;
  v_attempt integer;
  v_whatsapp_msg text;
  v_created_order public.orders;
  v_recent_unconfirmed_count integer;
BEGIN
  -- 1. Validate Customer Payload
  IF p_customer IS NULL OR jsonb_typeof(p_customer) <> 'object' THEN
    RAISE EXCEPTION 'Customer details payload must be a valid JSON object';
  END IF;

  IF p_honeypot IS NOT NULL AND length(trim(p_honeypot)) > 0 THEN
    RAISE EXCEPTION 'Order submission rejected by security filter';
  END IF;

  IF p_customer->>'website_url' IS NOT NULL AND length(trim(p_customer->>'website_url')) > 0 THEN
    RAISE EXCEPTION 'Order submission rejected by security filter';
  END IF;

  v_cust_name := NULLIF(trim(COALESCE(p_customer->>'name', '')), '');
  IF v_cust_name IS NULL OR length(v_cust_name) < 2 OR length(v_cust_name) > 120 THEN
    RAISE EXCEPTION 'Customer name must be between 2 and 120 characters';
  END IF;

  v_raw_phone := trim(COALESCE(p_customer->>'phone', ''));
  v_cust_phone := regexp_replace(v_raw_phone, '[^0-9]', '', 'g');
  IF length(v_cust_phone) = 12 AND v_cust_phone LIKE '91%' THEN
    v_cust_phone := substr(v_cust_phone, 3, 10);
  ELSIF length(v_cust_phone) = 11 AND v_cust_phone LIKE '0%' THEN
    v_cust_phone := substr(v_cust_phone, 2, 10);
  END IF;

  IF length(v_cust_phone) <> 10 OR v_cust_phone !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid mobile number: %. Must be a valid 10-digit Indian mobile number', v_raw_phone;
  END IF;

  v_cust_address := NULLIF(trim(COALESCE(p_customer->>'address', '')), '');
  IF v_cust_address IS NULL OR length(v_cust_address) < 5 OR length(v_cust_address) > 500 THEN
    RAISE EXCEPTION 'Delivery address must be between 5 and 500 characters';
  END IF;

  v_cust_pincode := trim(COALESCE(p_customer->>'pincode', ''));
  IF v_cust_pincode !~ '^[1-9][0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid PIN code: %. Must be a valid 6-digit Indian postal code', v_cust_pincode;
  END IF;

  v_sanitized_customer := jsonb_build_object(
    'name', v_cust_name,
    'phone', v_cust_phone,
    'address', v_cust_address,
    'pincode', v_cust_pincode,
    'city', NULLIF(trim(COALESCE(p_customer->>'city', '')), ''),
    'state', NULLIF(trim(COALESCE(p_customer->>'state', '')), '')
  );

  -- 2. Anti-Spam: Rate Limit Unconfirmed Pending Orders Per Phone
  SELECT COUNT(*)
  INTO v_recent_unconfirmed_count
  FROM public.orders
  WHERE customer->>'phone' = v_cust_phone
    AND status = 'pending'
    AND created_at >= NOW() - INTERVAL '1 hour';

  IF v_recent_unconfirmed_count >= 5 THEN
    RAISE EXCEPTION 'Too many unconfirmed pending orders for this phone number. Please wait before creating another order.';
  END IF;

  -- 3. Validate Items Payload
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

  -- Safely read store delivery thresholds
  BEGIN
    SELECT COALESCE(
      CASE 
        WHEN jsonb_typeof(value) = 'number' THEN (value::text)::numeric
        WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::numeric
        ELSE (value->>'free_delivery_min')::numeric
      END,
      999
    )
    INTO v_free_delivery_min
    FROM public.store_settings
    WHERE key = 'free_delivery_min';
  EXCEPTION WHEN OTHERS THEN
    v_free_delivery_min := 999;
  END;
  v_free_delivery_min := COALESCE(v_free_delivery_min, 999);

  BEGIN
    SELECT COALESCE(
      CASE 
        WHEN jsonb_typeof(value) = 'number' THEN (value::text)::numeric
        WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::numeric
        ELSE (value->>'shipping_fee')::numeric
      END,
      49
    )
    INTO v_shipping_fee
    FROM public.store_settings
    WHERE key = 'shipping_fee';
  EXCEPTION WHEN OTHERS THEN
    v_shipping_fee := 49;
  END;
  v_shipping_fee := COALESCE(v_shipping_fee, 49);

  BEGIN
    SELECT COALESCE(
      CASE 
        WHEN jsonb_typeof(value) = 'number' THEN (value::text)::integer
        WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::integer
        ELSE (value->>'max_order_qty')::integer
      END,
      500
    )
    INTO v_max_order_qty
    FROM public.store_settings
    WHERE key = 'max_order_qty';
  EXCEPTION WHEN OTHERS THEN
    v_max_order_qty := 500;
  END;
  v_max_order_qty := COALESCE(v_max_order_qty, 500);

  -- 4. Process Each Item (Lock rows FOR UPDATE)
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

    IF v_qty > v_max_order_qty THEN
      RAISE EXCEPTION 'Quantity % exceeds maximum allowed order limit of % units', v_qty, v_max_order_qty;
    END IF;

    IF v_item.product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION 'Duplicate product detected in order items. Merge quantities for product %', v_item.product_id;
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, v_item.product_id);

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found in catalog', v_item.product_id;
    END IF;

    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'Product "%" is currently inactive and cannot be ordered', v_product.name;
    END IF;

    IF v_qty < COALESCE(v_product.min_order_qty, 1) THEN
      RAISE EXCEPTION 'Minimum order quantity for "%" is % (requested %)',
        v_product.name, COALESCE(v_product.min_order_qty, 1), v_qty;
    END IF;

    IF v_product.max_order_qty IS NOT NULL AND v_qty > v_product.max_order_qty THEN
      RAISE EXCEPTION 'Maximum allowed quantity for "%" is % (requested %)',
        v_product.name, v_product.max_order_qty, v_qty;
    END IF;

    IF COALESCE(v_product.order_qty_step, 1) > 1 AND (v_qty % v_product.order_qty_step <> 0) THEN
      RAISE EXCEPTION 'Order quantity for "%" must be a multiple of % (requested %)',
        v_product.name, v_product.order_qty_step, v_qty;
    END IF;

    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%". Available: %, Requested: %',
        v_product.name, v_product.stock, v_qty;
    END IF;

    v_unit_price := public.get_unit_price(v_product.id, v_qty);

    SELECT unit_price INTO v_first_tier_price
    FROM public.product_price_tiers
    WHERE product_id = v_product.id
    ORDER BY min_qty ASC
    LIMIT 1;

    v_first_tier_price := COALESCE(v_first_tier_price, v_product.price);

    SELECT min_qty INTO v_applied_min_qty
    FROM public.product_price_tiers
    WHERE product_id = v_product.id AND min_qty <= v_qty
    ORDER BY min_qty DESC
    LIMIT 1;

    v_applied_min_qty := COALESCE(v_applied_min_qty, COALESCE(v_product.min_order_qty, 1));

    v_line_total := round(v_unit_price * v_qty, 2);
    v_line_savings := greatest(round((v_first_tier_price - v_unit_price) * v_qty, 2), 0);

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'name', v_product.name,
        'slug', v_product.slug,
        'sku', v_product.sku,
        'image', CASE WHEN array_length(v_product.images, 1) > 0 THEN v_product.images[1] ELSE NULL END,
        'quantity', v_qty,
        'qty', v_qty,
        'unit_price', v_unit_price,
        'price', v_unit_price,
        'total', v_line_total,
        'line_total', v_line_total,
        'first_tier_price', v_first_tier_price,
        'savings', v_line_savings,
        'min_qty', v_applied_min_qty,
        'tier_min_qty', v_applied_min_qty,
        'selected_color', v_item.selected_color
      )
    );

    UPDATE public.products
    SET stock = stock - v_qty,
        updated_at = NOW()
    WHERE id = v_product.id;

    INSERT INTO public.stock_movements (
      product_id,
      change,
      reason
    )
    VALUES (
      v_product.id,
      -v_qty,
      'Guest storefront order checkout'
    );
  END LOOP;

  -- 5. Validate & Apply Promo Code (Server-side Enforcement)
  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo
    FROM public.promo_codes
    WHERE upper(trim(code)) = upper(trim(p_promo_code))
    FOR UPDATE;

    IF FOUND AND v_promo.is_active
       AND (v_promo.start_date IS NULL OR now() >= v_promo.start_date)
       AND (v_promo.end_date IS NULL OR now() <= v_promo.end_date)
       AND (v_promo.usage_limit IS NULL OR v_promo.usage_count < v_promo.usage_limit)
       AND v_subtotal >= v_promo.min_order_amount THEN

      IF v_promo.discount_type = 'percentage' THEN
        v_discount_amount := round(v_subtotal * (v_promo.discount_value / 100.0), 2);
        IF v_promo.max_discount_amount IS NOT NULL THEN
          v_discount_amount := least(v_discount_amount, v_promo.max_discount_amount);
        END IF;
      ELSE
        v_discount_amount := least(v_promo.discount_value, v_subtotal);
      END IF;

      v_applied_promo := v_promo.code;

      UPDATE public.promo_codes
      SET usage_count = usage_count + 1,
          updated_at = now()
      WHERE id = v_promo.id;
    END IF;
  END IF;

  -- 6. Shipping & Total Calculation
  IF v_subtotal >= v_free_delivery_min THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_shipping_fee;
  END IF;

  v_shipping := COALESCE(v_shipping, 0);
  v_subtotal := COALESCE(v_subtotal, 0);
  v_discount_amount := COALESCE(v_discount_amount, 0);
  v_total := greatest(v_subtotal - v_discount_amount, 0) + v_shipping;
  v_total_savings := COALESCE(v_total_savings, 0) + v_discount_amount;

  -- 7. Collision-Resistant Order ID
  v_date_prefix := 'URT-' || to_char(NOW(), 'YYMMDD') || '-';
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

  -- 8. Insert Order Record
  INSERT INTO public.orders (
    id,
    user_id,
    customer,
    items,
    subtotal,
    savings,
    shipping,
    total,
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
    COALESCE(v_subtotal, 0),
    COALESCE(v_total_savings, 0),
    COALESCE(v_shipping, 0),
    COALESCE(v_total, 0),
    v_applied_promo,
    COALESCE(v_discount_amount, 0),
    'pending',
    'website',
    'pending',
    v_whatsapp_msg
  )
  RETURNING * INTO v_created_order;

  UPDATE public.stock_movements
  SET order_id = v_order_id,
      reference_id = v_order_id
  WHERE product_id = ANY(v_seen_product_ids)
    AND reason = 'Guest storefront order checkout'
    AND order_id IS NULL
    AND created_at >= NOW() - INTERVAL '30 seconds';

  INSERT INTO public.order_events (
    order_id,
    status,
    note,
    title,
    description,
    customer_visible
  )
  VALUES (
    v_order_id,
    'pending',
    CASE 
      WHEN v_applied_promo IS NOT NULL THEN format('Guest order created via storefront checkout with promo code %s (-₹%s)', v_applied_promo, v_discount_amount)
      ELSE 'Guest order created via storefront checkout'
    END,
    'Order Placed',
    'Guest order created via storefront checkout',
    true
  );

  RETURN v_created_order;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. PERMISSIONS
-- ----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text, text) TO service_role;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

