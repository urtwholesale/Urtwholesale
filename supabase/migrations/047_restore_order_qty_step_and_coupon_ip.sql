-- ============================================================================
-- Migration: 047_restore_order_qty_step_and_coupon_ip.sql
-- Description: Pre-launch security hardening addressing:
--   1. Restores order_qty_step validation in create_verified_order & create_verified_order_guest
--      (preventing buyers from bypassing package multiplier / step constraints).
--   2. Hardens validate_coupon IP rate-limiting by extracting the proxy-appended
--      rightmost X-Forwarded-For IP when cf-connecting-ip is absent, neutralizing
--      client-injected rate limit spoofing.
-- Note: UNAPPLIED - Review before applying to staging.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Restore order_qty_step validation in create_verified_order
-- ----------------------------------------------------------------------------
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
  v_coupon public.coupons%ROWTYPE;
  v_has_coupon boolean := false;
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

    v_has_coupon := true;
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

    SELECT id, name, sku, category_id, price, images, is_active, stock, min_order_qty, order_qty_step
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

    IF COALESCE(v_product.order_qty_step, 1) > 1 AND (v_qty % v_product.order_qty_step <> 0) THEN
      RAISE EXCEPTION 'Quantity for "%" must be a multiple of % (requested % units)', v_product.name, v_product.order_qty_step, v_qty;
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
  IF v_has_coupon THEN
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

-- ----------------------------------------------------------------------------
-- 2. Restore order_qty_step validation in create_verified_order_guest
-- ----------------------------------------------------------------------------
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
  v_coupon public.coupons%ROWTYPE;
  v_has_coupon boolean := false;
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

    v_has_coupon := true;
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

    SELECT id, name, sku, category_id, price, images, is_active, stock, min_order_qty, order_qty_step
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

    IF COALESCE(v_product.order_qty_step, 1) > 1 AND (v_qty % v_product.order_qty_step <> 0) THEN
      RAISE EXCEPTION 'Quantity for "%" must be a multiple of % (requested % units)', v_product.name, v_product.order_qty_step, v_qty;
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
  IF v_has_coupon THEN
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
-- 3. Hardened validate_coupon IP extraction
-- ----------------------------------------------------------------------------
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
  v_coupon public.coupons%ROWTYPE;
  v_has_coupon boolean := false;
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
      -- Extract rightmost proxy-appended IP to prevent client-injected spoofing
      DECLARE
        v_xff text := current_setting('request.headers', true)::json->>'x-forwarded-for';
        v_xff_arr text[];
      BEGIN
        IF v_xff IS NOT NULL AND trim(v_xff) <> '' THEN
          v_xff_arr := regexp_split_to_array(v_xff, '\s*,\s*');
          IF array_length(v_xff_arr, 1) > 0 THEN
            v_ip := trim(v_xff_arr[array_length(v_xff_arr, 1)]);
          END IF;
        END IF;
      END;
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

COMMIT;
