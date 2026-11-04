-- ============================================================================
-- Migration 031: Fix Order Totals and Store Settings Lookup
-- ============================================================================
-- Purpose:
--   1. Ensure store_settings values (free_delivery_min, shipping_fee, max_order_qty)
--      are read accurately from individual key-value rows in public.store_settings.
--   2. Guard v_free_delivery_min, v_shipping_fee, v_max_order_qty, v_subtotal,
--      v_shipping, and v_total against NULL values so orders.total NOT NULL
--      constraint is never violated.
--   3. Apply to both create_verified_order (authenticated) and
--      create_verified_order_guest (guest checkout via service_role).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ensure fallback store_delivery and store_config composite keys exist in store_settings
-- ----------------------------------------------------------------------------

INSERT INTO public.store_settings (key, value, description)
VALUES (
  'store_delivery',
  jsonb_build_object('free_delivery_min', 999, 'shipping_fee', 49, 'max_order_qty', 500),
  'Store delivery thresholds composite configuration'
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_build_object(
  'free_delivery_min', COALESCE((SELECT (value::text)::numeric FROM public.store_settings WHERE key = 'free_delivery_min'), 999),
  'shipping_fee', COALESCE((SELECT (value::text)::numeric FROM public.store_settings WHERE key = 'shipping_fee'), 49),
  'max_order_qty', COALESCE((SELECT (value::text)::integer FROM public.store_settings WHERE key = 'max_order_qty'), 500)
);

INSERT INTO public.store_settings (key, value, description)
VALUES (
  'store_config',
  jsonb_build_object('free_delivery_min', 999, 'shipping_fee', 49, 'max_order_qty', 500),
  'Store configuration composite fallback'
)
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 1b. Ensure order_events compatibility columns
-- ----------------------------------------------------------------------------

ALTER TABLE public.order_events
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text;

-- ----------------------------------------------------------------------------
-- 2. Drop existing overloads
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order_guest(jsonb, jsonb, text, text);

-- ----------------------------------------------------------------------------
-- 3. Hardened create_verified_order (Authenticated Checkout)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_customer jsonb,
  p_items jsonb,
  p_whatsapp_message text DEFAULT NULL,
  p_honeypot text DEFAULT NULL
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

  -- Honeypot protection
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

  -- 2. Anti-Spam: Rate Limit Unconfirmed Pending Orders (Authenticated: 10 per hour)
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

  -- Safely read store thresholds from store_settings individually with hardcoded fallbacks
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

    -- Compute wholesale volume tier price from product_price_tiers
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

    -- Atomic stock deduction
    UPDATE public.products
    SET stock = stock - v_qty,
        updated_at = NOW()
    WHERE id = v_product.id;

    -- Record stock movement
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

  IF v_subtotal >= v_free_delivery_min THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_shipping_fee;
  END IF;

  v_shipping := COALESCE(v_shipping, 0);
  v_subtotal := COALESCE(v_subtotal, 0);
  v_total := v_subtotal + v_shipping;
  v_total_savings := COALESCE(v_total_savings, 0);

  -- 5. Collision-Resistant Order ID Generation
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
    format('URT Wholesale: Order %s placed. Subtotal: ₹%s, Shipping: ₹%s, Total: ₹%s for %s item line(s).',
      v_order_id, v_subtotal, v_shipping, v_total, v_item_count)
  );

  -- 6. Insert Order Record (Strict COALESCE guards against NULL values)
  INSERT INTO public.orders (
    id,
    user_id,
    customer,
    items,
    subtotal,
    savings,
    shipping,
    total,
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
    'Order created via storefront checkout',
    'Order Placed',
    'Order created via storefront checkout',
    true
  );

  RETURN v_created_order;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Hardened create_verified_order_guest (Guest Checkout via service_role)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_verified_order_guest(
  p_customer jsonb,
  p_items jsonb,
  p_whatsapp_message text DEFAULT NULL,
  p_honeypot text DEFAULT NULL
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

  -- 2. Anti-Spam: Rate Limit Unconfirmed Pending Orders Per Phone (Guest: 5 per hour)
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

  -- Safely read store thresholds from store_settings individually with hardcoded fallbacks
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

  IF v_subtotal >= v_free_delivery_min THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_shipping_fee;
  END IF;

  v_shipping := COALESCE(v_shipping, 0);
  v_subtotal := COALESCE(v_subtotal, 0);
  v_total := v_subtotal + v_shipping;
  v_total_savings := COALESCE(v_total_savings, 0);

  -- 5. Collision-Resistant Order ID
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
    format('URT Wholesale: Order %s placed. Subtotal: ₹%s, Shipping: ₹%s, Total: ₹%s for %s item line(s).',
      v_order_id, v_subtotal, v_shipping, v_total, v_item_count)
  );

  -- 6. Insert Order Record (Strict COALESCE guards against NULL values)
  INSERT INTO public.orders (
    id,
    user_id,
    customer,
    items,
    subtotal,
    savings,
    shipping,
    total,
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
    'Guest order created via storefront checkout',
    'Order Placed',
    'Guest order created via storefront checkout',
    true
  );

  RETURN v_created_order;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Permissions
-- ----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text) TO service_role;
