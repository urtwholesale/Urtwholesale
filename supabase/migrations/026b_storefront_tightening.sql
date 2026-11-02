-- ============================================================================
-- Migration: 026b_storefront_tightening.sql
-- Description:
--   Phase 2 (Privilege Tightening & Overload Cleanup):
--   Apply ONLY after frontend and edge functions have shipped!
--   1. Drops legacy single-parameter get_order_by_id(text) & create_verified_order(jsonb, jsonb, text).
--   2. Updates create_verified_order & create_verified_order_guest with hardened store_settings JSON casts.
--   3. Re-implements bounded search_products(text, integer) with wildcard escaping.
--   4. Revokes anon table-wide SELECT on products, orders, order_events, dealer_applications.
--   5. Grants column-level SELECT on products matching products_public exactly.
--   6. Enforces ALTER DEFAULT PRIVILEGES revoking EXECUTE from anon and PUBLIC.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. DROP LEGACY FUNCTION OVERLOADS
-- ----------------------------------------------------------------------------

-- Drop 1-parameter overload so only (text, text) exists
DROP FUNCTION IF EXISTS public.get_order_by_id(text);

-- Drop 3-parameter overload so only (jsonb, jsonb, text, text) exists
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text);

-- ----------------------------------------------------------------------------
-- 1b. HARDENED ORDER RPCs (Explicit jsonb casts & atomic stock handling)
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
  END IF;
  IF length(v_cust_phone) <> 10 THEN
    RAISE EXCEPTION 'Customer phone number must be a valid 10-digit mobile number';
  END IF;

  v_cust_address := NULLIF(trim(COALESCE(p_customer->>'address', '')), '');
  IF v_cust_address IS NULL OR length(v_cust_address) < 5 OR length(v_cust_address) > 300 THEN
    RAISE EXCEPTION 'Customer address must be between 5 and 300 characters';
  END IF;

  v_cust_pincode := NULLIF(trim(COALESCE(p_customer->>'pincode', '')), '');
  IF v_cust_pincode IS NULL OR v_cust_pincode !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Customer pincode must be a valid 6-digit postal code';
  END IF;

  -- Second-layer rate limit: max 4 pending orders per phone in last 24 hours
  SELECT count(*) INTO v_recent_unconfirmed_count
  FROM public.orders
  WHERE (customer->>'phone') = v_cust_phone
    AND status = 'pending'
    AND created_at >= (NOW() - interval '24 hours');

  IF v_recent_unconfirmed_count >= 4 THEN
    RAISE EXCEPTION 'Too many pending orders for mobile %. Please contact support or await confirmation.', v_cust_phone;
  END IF;

  v_sanitized_customer := jsonb_build_object(
    'name', v_cust_name,
    'phone', v_cust_phone,
    'address', v_cust_address,
    'pincode', v_cust_pincode,
    'city', NULLIF(trim(COALESCE(p_customer->>'city', '')), ''),
    'state', NULLIF(trim(COALESCE(p_customer->>'state', '')), '')
  );

  -- 2. Read Store Settings (Safe text extraction from jsonb)
  SELECT COALESCE(NULLIF(value#>>'{}', '')::integer, 500) INTO v_max_order_qty
  FROM public.store_settings WHERE key = 'max_order_qty';
  IF v_max_order_qty IS NULL THEN v_max_order_qty := 500; END IF;

  SELECT COALESCE(NULLIF(value#>>'{}', '')::numeric, 999) INTO v_free_delivery_min
  FROM public.store_settings WHERE key = 'free_delivery_min';

  SELECT COALESCE(NULLIF(value#>>'{}', '')::numeric, 49) INTO v_shipping_fee
  FROM public.store_settings WHERE key = 'shipping_fee';

  -- 3. Validate Items Array
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Order items payload must be a JSON array';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Cart is empty. Please add products to your cart before checking out';
  END IF;
  IF v_item_count > 50 THEN
    RAISE EXCEPTION 'Exceeded maximum order items limit (maximum 50 line items per order)';
  END IF;

  -- 4. Process Each Cart Item with Row Locks
  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      COALESCE((elem->>'quantity')::integer, 0) AS quantity,
      NULLIF(trim(elem->>'selected_color'), '') AS selected_color
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'Each order item must specify a valid product_id';
    END IF;

    v_qty := v_item.quantity;
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be a positive integer';
    END IF;

    IF v_qty > v_max_order_qty THEN
      RAISE EXCEPTION 'Item quantity exceeds maximum allowed order limit of % units', v_max_order_qty;
    END IF;

    IF v_item.product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION 'Duplicate product in order items. Merge quantities for product %', v_item.product_id;
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
      RAISE EXCEPTION 'Product "%" is inactive and unavailable for ordering', v_product.name;
    END IF;

    IF v_qty < COALESCE(v_product.min_order_qty, 1) THEN
      RAISE EXCEPTION 'Minimum order quantity for "%" is % (requested %)',
        v_product.name, COALESCE(v_product.min_order_qty, 1), v_qty;
    END IF;

    IF COALESCE(v_product.order_qty_step, 1) > 1 AND (v_qty % v_product.order_qty_step <> 0) THEN
      RAISE EXCEPTION 'Order quantity for "%" must be a multiple of % (requested %)',
        v_product.name, v_product.order_qty_step, v_qty;
    END IF;

    IF v_qty > v_product.stock THEN
      RAISE EXCEPTION 'Insufficient stock for "%". Requested %, only % available',
        v_product.name, v_qty, v_product.stock;
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

    v_line_total := v_unit_price * v_qty;
    v_line_savings := greatest((v_first_tier_price - v_unit_price) * v_qty, 0);

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'name', v_product.name,
        'sku', v_product.sku,
        'image', CASE WHEN array_length(v_product.images, 1) > 0 THEN v_product.images[1] ELSE NULL END,
        'quantity', v_qty,
        'unit_price', v_unit_price,
        'total', v_line_total,
        'first_tier_price', v_first_tier_price,
        'savings', v_line_savings,
        'min_qty', v_applied_min_qty,
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
      'Storefront order checkout'
    );
  END LOOP;

  IF v_subtotal >= v_free_delivery_min THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_shipping_fee;
  END IF;

  v_total := v_subtotal + v_shipping;

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
    v_subtotal,
    v_total_savings,
    v_shipping,
    v_total,
    'pending',
    'website',
    'pending',
    v_whatsapp_msg
  )
  RETURNING * INTO v_created_order;

  INSERT INTO public.order_events (
    order_id,
    status,
    note,
    customer_visible
  )
  VALUES (
    v_order_id,
    'pending',
    'Order created via storefront checkout',
    true
  );

  RETURN v_created_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 1c. RPC: create_verified_order_guest (Restricted exclusively to service_role)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_verified_order_guest(
  p_customer jsonb,
  p_items jsonb,
  p_whatsapp_message text DEFAULT NULL,
  p_honeypot text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := NULL;
  v_cust_name text;
  v_cust_phone text;
  v_cust_address text;
  v_cust_pincode text;
  v_sanitized_customer jsonb;
  v_recent_unconfirmed_count integer;
  v_max_order_qty integer := 500;
  v_free_delivery_min numeric := 999;
  v_shipping_fee numeric := 49;
  v_item_count integer;
  v_item record;
  v_qty integer;
  v_product record;
  v_unit_price numeric;
  v_first_tier_price numeric;
  v_applied_min_qty integer;
  v_line_total numeric;
  v_line_savings numeric;
  v_subtotal numeric := 0;
  v_total_savings numeric := 0;
  v_shipping numeric;
  v_total numeric;
  v_order_items jsonb := '[]'::jsonb;
  v_order_id text;
  v_whatsapp_msg text;
  v_created_order jsonb;
  v_seen_product_ids uuid[] := ARRAY[]::uuid[];
  v_token text;
BEGIN
  IF p_honeypot IS NOT NULL AND trim(p_honeypot) <> '' THEN
    RAISE EXCEPTION 'Invalid submission detected';
  END IF;

  IF p_customer IS NULL OR jsonb_typeof(p_customer) <> 'object' THEN
    RAISE EXCEPTION 'Customer details must be provided as a JSON object';
  END IF;

  v_cust_name := NULLIF(trim(COALESCE(p_customer->>'name', '')), '');
  IF v_cust_name IS NULL OR length(v_cust_name) < 2 OR length(v_cust_name) > 100 THEN
    RAISE EXCEPTION 'Customer name must be between 2 and 100 characters';
  END IF;

  v_cust_phone := regexp_replace(COALESCE(p_customer->>'phone', ''), '\D', '', 'g');
  IF length(v_cust_phone) = 12 AND v_cust_phone LIKE '91%' THEN
    v_cust_phone := substr(v_cust_phone, 3);
  ELSIF length(v_cust_phone) = 11 AND v_cust_phone LIKE '0%' THEN
    v_cust_phone := substr(v_cust_phone, 2);
  END IF;

  IF length(v_cust_phone) <> 10 OR v_cust_phone !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid mobile number. Please provide a valid 10-digit Indian mobile number';
  END IF;

  v_cust_address := NULLIF(trim(COALESCE(p_customer->>'address', '')), '');
  IF v_cust_address IS NULL OR length(v_cust_address) < 5 OR length(v_cust_address) > 300 THEN
    RAISE EXCEPTION 'Delivery address must be between 5 and 300 characters';
  END IF;

  v_cust_pincode := NULLIF(trim(COALESCE(p_customer->>'pincode', '')), '');
  IF v_cust_pincode IS NULL OR v_cust_pincode !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Customer pincode must be a valid 6-digit postal code';
  END IF;

  SELECT count(*) INTO v_recent_unconfirmed_count
  FROM public.orders
  WHERE (customer->>'phone') = v_cust_phone
    AND status = 'pending'
    AND created_at >= (NOW() - interval '24 hours');

  IF v_recent_unconfirmed_count >= 4 THEN
    RAISE EXCEPTION 'Too many pending orders for mobile %. Please contact support or await confirmation.', v_cust_phone;
  END IF;

  v_sanitized_customer := jsonb_build_object(
    'name', v_cust_name,
    'phone', v_cust_phone,
    'address', v_cust_address,
    'pincode', v_cust_pincode,
    'city', NULLIF(trim(COALESCE(p_customer->>'city', '')), ''),
    'state', NULLIF(trim(COALESCE(p_customer->>'state', '')), '')
  );

  -- Store Settings (Safe text extraction from jsonb)
  SELECT COALESCE(NULLIF(value#>>'{}', '')::integer, 500) INTO v_max_order_qty
  FROM public.store_settings WHERE key = 'max_order_qty';
  IF v_max_order_qty IS NULL THEN v_max_order_qty := 500; END IF;

  SELECT COALESCE(NULLIF(value#>>'{}', '')::numeric, 999) INTO v_free_delivery_min
  FROM public.store_settings WHERE key = 'free_delivery_min';

  SELECT COALESCE(NULLIF(value#>>'{}', '')::numeric, 49) INTO v_shipping_fee
  FROM public.store_settings WHERE key = 'shipping_fee';

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Order items payload must be a JSON array';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Cart is empty. Please add products to your cart before checking out';
  END IF;
  IF v_item_count > 50 THEN
    RAISE EXCEPTION 'Exceeded maximum order items limit (maximum 50 line items per order)';
  END IF;

  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      COALESCE((elem->>'quantity')::integer, 0) AS quantity,
      NULLIF(trim(elem->>'selected_color'), '') AS selected_color
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'Each order item must specify a valid product_id';
    END IF;

    v_qty := v_item.quantity;
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be a positive integer';
    END IF;

    IF v_qty > v_max_order_qty THEN
      RAISE EXCEPTION 'Item quantity exceeds maximum allowed order limit of % units', v_max_order_qty;
    END IF;

    IF v_item.product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION 'Duplicate product in order items. Merge quantities for product %', v_item.product_id;
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
      RAISE EXCEPTION 'Product "%" is inactive and unavailable for ordering', v_product.name;
    END IF;

    IF v_qty < COALESCE(v_product.min_order_qty, 1) THEN
      RAISE EXCEPTION 'Minimum order quantity for "%" is % (requested %)',
        v_product.name, COALESCE(v_product.min_order_qty, 1), v_qty;
    END IF;

    IF COALESCE(v_product.order_qty_step, 1) > 1 AND (v_qty % v_product.order_qty_step <> 0) THEN
      RAISE EXCEPTION 'Order quantity for "%" must be a multiple of % (requested %)',
        v_product.name, v_product.order_qty_step, v_qty;
    END IF;

    IF v_qty > v_product.stock THEN
      RAISE EXCEPTION 'Insufficient stock for "%". Requested %, only % available',
        v_product.name, v_qty, v_product.stock;
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

    v_line_total := v_unit_price * v_qty;
    v_line_savings := GREATEST(0, (v_first_tier_price - v_unit_price) * v_qty);

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'name', v_product.name,
        'sku', v_product.sku,
        'image', CASE WHEN array_length(v_product.images, 1) > 0 THEN v_product.images[1] ELSE NULL END,
        'quantity', v_qty,
        'unit_price', v_unit_price,
        'price', v_unit_price,
        'line_total', v_line_total,
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

  v_total := v_subtotal + v_shipping;

  v_order_id := 'URT-' || to_char(NOW(), 'YYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  v_whatsapp_msg := NULLIF(trim(COALESCE(p_whatsapp_message, '')), '');
  IF v_whatsapp_msg IS NOT NULL AND length(v_whatsapp_msg) > 4000 THEN
    v_whatsapp_msg := substr(v_whatsapp_msg, 1, 4000);
  END IF;

  INSERT INTO public.orders (
    id,
    public_token,
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
    v_token,
    NULL,
    v_sanitized_customer,
    v_order_items,
    v_subtotal,
    v_total_savings,
    v_shipping,
    v_total,
    'pending',
    'website',
    'pending',
    v_whatsapp_msg
  )
  RETURNING jsonb_build_object(
    'id', id,
    'public_token', public_token,
    'customer', customer,
    'items', items,
    'subtotal', subtotal,
    'savings', savings,
    'shipping', shipping,
    'total', total,
    'status', status
  ) INTO v_created_order;

  INSERT INTO public.order_events (
    order_id,
    status,
    note,
    customer_visible
  )
  VALUES (
    v_order_id,
    'pending',
    'Guest order created via checkout gate',
    true
  );

  RETURN v_created_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. RE-IMPLEMENT BOUNDED search_products (Matching 009 Multi-Field Search)
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.search_products(text, integer);

CREATE OR REPLACE FUNCTION public.search_products(
  q text,
  max_rows integer DEFAULT 8
)
RETURNS SETOF public.products_public
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT *
  FROM public.products_public
  WHERE is_active = true
    AND (
      name ILIKE ('%' || replace(replace(substr(trim(coalesce(q, '')), 1, 60), '%', '\%'), '_', '\_') || '%')
      OR (sku IS NOT NULL AND sku ILIKE ('%' || replace(replace(substr(trim(coalesce(q, '')), 1, 60), '%', '\%'), '_', '\_') || '%'))
      OR (
        CASE
          WHEN is_urbanrat_brand AND 'urbanrat' ILIKE ('%' || replace(replace(substr(trim(coalesce(q, '')), 1, 60), '%', '\%'), '_', '\_') || '%') THEN true
          WHEN specs IS NOT NULL AND (specs->>'brand') ILIKE ('%' || replace(replace(substr(trim(coalesce(q, '')), 1, 60), '%', '\%'), '_', '\_') || '%') THEN true
          ELSE false
        END
      )
      OR EXISTS (
        SELECT 1
        FROM unnest(keywords) kw
        WHERE kw ILIKE ('%' || replace(replace(substr(trim(coalesce(q, '')), 1, 60), '%', '\%'), '_', '\_') || '%')
      )
      OR similarity(name, replace(replace(substr(trim(coalesce(q, '')), 1, 60), '%', '\%'), '_', '\_')) > 0.15
    )
  ORDER BY
    CASE
      WHEN name ILIKE (replace(replace(substr(trim(coalesce(q, '')), 1, 60), '%', '\%'), '_', '\_') || '%') THEN 1
      WHEN name ILIKE ('%' || replace(replace(substr(trim(coalesce(q, '')), 1, 60), '%', '\%'), '_', '\_') || '%') THEN 2
      ELSE 3
    END ASC,
    is_featured DESC,
    created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(max_rows, 8), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.search_products(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_products(text, integer) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. REVOKE TABLE-WIDE SELECT & LOCKDOWN COLUMN ACCESS ON PRODUCTS
-- ----------------------------------------------------------------------------

-- Revoke full-table SELECT from anon
REVOKE SELECT ON TABLE public.products FROM anon;

-- Grant column-level SELECT on the exact 27 columns exposed by public.products_public
GRANT SELECT (
  id,
  name,
  slug,
  description,
  short_description,
  price,
  mrp,
  sku,
  images,
  category_id,
  is_urbanrat_brand,
  is_active,
  is_featured,
  is_trending,
  specs,
  attributes,
  warranty_months,
  tags,
  keywords,
  brand,
  min_order_qty,
  order_qty_step,
  rating_avg,
  rating_count,
  in_stock,
  created_at,
  updated_at
) ON TABLE public.products TO anon, authenticated;

-- Grant column-level SELECT on product_price_tiers for subquery execution
GRANT SELECT (
  id,
  product_id,
  min_qty,
  unit_price,
  created_at
) ON TABLE public.product_price_tiers TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. REVOKE DIRECT TABLE ACCESS FROM ANON ON SENSITIVE TABLES
-- ----------------------------------------------------------------------------

REVOKE SELECT ON TABLE public.orders FROM anon;
REVOKE SELECT ON TABLE public.order_events FROM anon;
REVOKE SELECT ON TABLE public.dealer_applications FROM anon;
REVOKE SELECT ON TABLE public.dealer_events FROM anon;

-- SEC-02: Drop compatibility view without security_invoker and revoke anon from addresses
DROP VIEW IF EXISTS public.customer_addresses CASCADE;
REVOKE ALL ON TABLE public.addresses FROM anon;

-- SEC-03: Restrict review inserts to authenticated accounts & enforce admin moderation
DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can insert own reviews" ON public.reviews;
CREATE POLICY "Authenticated users can insert own reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.auto_moderate_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.status := 'pending';
  ELSE
    NEW.status := COALESCE(NEW.status, 'approved');
  END IF;
  RETURN NEW;
END;
$$;

-- RLS-01: Enable RLS and lock write access on search_vocabulary
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'search_vocabulary') THEN
    ALTER TABLE public.search_vocabulary ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can read search vocabulary" ON public.search_vocabulary;
    CREATE POLICY "Anyone can read search vocabulary" ON public.search_vocabulary FOR SELECT USING (true);
    REVOKE INSERT, UPDATE, DELETE ON public.search_vocabulary FROM anon, authenticated;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. EXPLICIT FUNCTION PRIVILEGE ALLOWLIST FOR ANON
-- ----------------------------------------------------------------------------

-- Revoke execute on create_verified_order from anon (must go through checkout-gate)
REVOKE ALL ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text) TO authenticated;

-- Revoke execute on non-allowlisted public functions from anon and grant on allowlisted functions
DO $$
DECLARE
  r record;
  v_allowlist text[] := ARRAY[
    'is_admin',
    'get_order_by_id',
    'get_dealer_application_by_code',
    'submit_dealer_application',
    'search_products',
    'search_products_v2',
    'get_category_descendant_ids',
    'get_new_arrivals_by_category',
    'get_unit_price',
    'normalize_keywords_array'
  ];
BEGIN
  -- 1. Revoke execute on non-allowlisted public functions from anon
  FOR r IN (
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
      AND p.prokind = 'f'
      AND NOT (p.proname = ANY(v_allowlist))
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.args);
  END LOOP;

  -- 2. Explicitly ensure allowlisted public functions are executable by anon and authenticated
  FOR r IN (
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
      AND p.prokind = 'f'
      AND (p.proname = ANY(v_allowlist))
  ) LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated;', r.proname, r.args);
  END LOOP;
END;
$$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

COMMIT;
