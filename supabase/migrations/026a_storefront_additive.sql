-- ============================================================================
-- Migration: 026a_storefront_additive.sql
-- Description:
--   Phase 1 (Additive & Non-Breaking):
--   1. Stored generated column products.in_stock.
--   2. Safe storefront catalog view: public.products_public with embedded price_tiers.
--   3. Administrative catalog view: public.products_admin.
--   4. public_token (128-bit) column on orders and dealer_applications.
--   5. Token-gated get_order_by_id(text, text) & get_dealer_application_by_code(text, text).
--   6. create_verified_order & submit_dealer_application returning public_token.
--   7. max_order_qty store setting.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- 1. STORED GENERATED COLUMN: products.in_stock
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'products' 
      AND column_name = 'in_stock'
  ) THEN
    ALTER TABLE public.products 
      ADD COLUMN in_stock boolean 
      GENERATED ALWAYS AS (stock > 0) STORED;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. STOREFRONT SAFE VIEW: public.products_public
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.products_public
WITH (security_invoker = on)
AS
SELECT
  p.id,
  p.name,
  p.slug,
  p.description,
  p.short_description,
  p.price,
  p.mrp,
  p.sku,
  p.images,
  p.category_id,
  p.is_urbanrat_brand,
  p.is_active,
  p.is_featured,
  p.is_trending,
  p.specs,
  p.attributes,
  p.warranty_months,
  p.tags,
  p.keywords,
  p.brand,
  p.min_order_qty,
  p.order_qty_step,
  p.rating_avg,
  p.rating_count,
  p.in_stock,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', pt.id,
          'product_id', pt.product_id,
          'min_qty', pt.min_qty,
          'unit_price', pt.unit_price,
          'created_at', pt.created_at
        ) ORDER BY pt.min_qty ASC
      )
      FROM public.product_price_tiers pt
      WHERE pt.product_id = p.id
    ),
    '[]'::json
  ) AS price_tiers,
  p.created_at,
  p.updated_at
FROM public.products p
WHERE p.is_active = true;

COMMENT ON VIEW public.products_public IS 'Storefront-safe catalog view with in_stock boolean and embedded price tiers, omitting internal stock counts and cost fields.';
GRANT SELECT ON public.products_public TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. ADMINISTRATIVE VIEW: public.products_admin
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.products_admin
WITH (security_barrier = true)
AS
SELECT *
FROM public.products
WHERE public.is_admin();

COMMENT ON VIEW public.products_admin IS 'Admin-only view granting full access to all columns of public.products including stock and internal notes. Re-create if columns on products change.';
ALTER VIEW public.products_admin OWNER TO postgres;
GRANT SELECT ON public.products_admin TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. 128-BIT PUBLIC TOKENS FOR ORDERS & DEALER APPLICATIONS
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'public_token'
  ) THEN
    ALTER TABLE public.orders 
      ADD COLUMN public_token text NOT NULL 
      DEFAULT encode(extensions.gen_random_bytes(16), 'hex');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'dealer_applications' 
      AND column_name = 'public_token'
  ) THEN
    ALTER TABLE public.dealer_applications 
      ADD COLUMN public_token text NOT NULL 
      DEFAULT encode(extensions.gen_random_bytes(16), 'hex');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_public_token 
  ON public.orders (public_token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dealer_applications_public_token 
  ON public.dealer_applications (public_token);

-- Add customer_visible boolean on order_events (default false for existing rows to hide internal notes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'order_events' 
      AND column_name = 'customer_visible'
  ) THEN
    ALTER TABLE public.order_events 
      ADD COLUMN customer_visible boolean NOT NULL DEFAULT false;
  END IF;
END;
$$;

-- Filter events for non-admin owners to customer_visible rows only
DROP POLICY IF EXISTS "Users can view events for own orders or admin views all" ON public.order_events;
CREATE POLICY "Users can view events for own orders or admin views all"
  ON public.order_events FOR SELECT
  USING (
    public.is_admin()
    OR (
      customer_visible = true
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_events.order_id
          AND o.user_id = auth.uid()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 5. STORE SETTINGS: max_order_qty
-- ----------------------------------------------------------------------------

INSERT INTO public.store_settings (key, value, description)
VALUES ('max_order_qty', '500', 'Maximum allowed purchase quantity per line item')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. RPC: create_verified_order (Enforces MOQ/step/max_order_qty & returns public_token)
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

  -- 2. Read Store Settings
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
-- 6b. RPC: create_verified_order_guest (Restricted exclusively to service_role)
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
  v_user_id uuid := NULL; -- Strictly null for guest checkouts
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
  -- Honeypot bot check
  IF p_honeypot IS NOT NULL AND trim(p_honeypot) <> '' THEN
    RAISE EXCEPTION 'Invalid submission detected';
  END IF;

  -- Validate customer payload
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

  -- Store Settings
  SELECT COALESCE(NULLIF(value#>>'{}', '')::integer, 500) INTO v_max_order_qty
  FROM public.store_settings WHERE key = 'max_order_qty';
  IF v_max_order_qty IS NULL THEN v_max_order_qty := 500; END IF;

  SELECT COALESCE(NULLIF(value#>>'{}', '')::numeric, 999) INTO v_free_delivery_min
  FROM public.store_settings WHERE key = 'free_delivery_min';

  SELECT COALESCE(NULLIF(value#>>'{}', '')::numeric, 49) INTO v_shipping_fee
  FROM public.store_settings WHERE key = 'shipping_fee';

  -- Validate Items
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

  -- Process Items
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
    NULL, -- Guest checkout: strictly null user_id
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
-- 7. RPC: submit_dealer_application (With field length caps and public_token)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_dealer_application(
  p_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_business_name text;
  v_owner_name text;
  v_mobile text;
  v_whatsapp text;
  v_email text;
  v_gstin text;
  v_business_type text;
  v_address text;
  v_city text;
  v_state text;
  v_pincode text;
  v_volume text;
  v_categories text[];
  v_message text;
  v_accepted_terms boolean;
  v_recent_app_count integer;
  v_date_prefix text;
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_rand text;
  v_app_no text;
  v_attempt integer;
  v_token text;
  v_inserted_id uuid;
  v_created_at timestamptz;
BEGIN
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'Application submission payload must be a valid JSON object';
  END IF;

  IF p_data->>'website_url' IS NOT NULL AND length(trim(p_data->>'website_url')) > 0 THEN
    RETURN jsonb_build_object('application_no', 'DLR-REJECTED', 'created_at', NOW());
  END IF;

  v_business_name := NULLIF(trim(COALESCE(p_data->>'business_name', '')), '');
  IF v_business_name IS NULL OR length(v_business_name) < 2 OR length(v_business_name) > 120 THEN
    RAISE EXCEPTION 'Business name must be between 2 and 120 characters';
  END IF;

  v_owner_name := NULLIF(trim(COALESCE(p_data->>'owner_name', '')), '');
  IF v_owner_name IS NULL OR length(v_owner_name) < 2 OR length(v_owner_name) > 120 THEN
    RAISE EXCEPTION 'Owner name must be between 2 and 120 characters';
  END IF;

  v_mobile := regexp_replace(trim(COALESCE(p_data->>'mobile', '')), '[^0-9]', '', 'g');
  IF length(v_mobile) = 12 AND v_mobile LIKE '91%' THEN
    v_mobile := substr(v_mobile, 3, 10);
  END IF;
  IF length(v_mobile) <> 10 THEN
    RAISE EXCEPTION 'Valid 10-digit mobile number is required';
  END IF;

  v_whatsapp := regexp_replace(trim(COALESCE(p_data->>'whatsapp', '')), '[^0-9]', '', 'g');
  IF length(v_whatsapp) = 12 AND v_whatsapp LIKE '91%' THEN
    v_whatsapp := substr(v_whatsapp, 3, 10);
  END IF;
  IF length(v_whatsapp) > 0 AND length(v_whatsapp) <> 10 THEN
    RAISE EXCEPTION 'Valid 10-digit WhatsApp number is required if provided';
  END IF;

  v_email := NULLIF(lower(trim(COALESCE(p_data->>'email', ''))), '');
  IF v_email IS NOT NULL AND v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email address format';
  END IF;

  v_gstin := NULLIF(upper(trim(COALESCE(p_data->>'gstin', ''))), '');
  IF v_gstin IS NOT NULL AND v_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' THEN
    RAISE EXCEPTION 'Invalid GSTIN format';
  END IF;

  v_business_type := lower(trim(COALESCE(p_data->>'business_type', 'retailer')));
  IF v_business_type NOT IN ('retailer', 'distributor', 'online_seller', 'wholesaler', 'other') THEN
    v_business_type := 'retailer';
  END IF;

  v_address := NULLIF(trim(COALESCE(p_data->>'address', '')), '');
  IF length(v_address) > 300 THEN
    RAISE EXCEPTION 'Address must not exceed 300 characters';
  END IF;

  v_city := NULLIF(trim(COALESCE(p_data->>'city', '')), '');
  IF length(v_city) > 80 THEN
    RAISE EXCEPTION 'City must not exceed 80 characters';
  END IF;

  v_state := NULLIF(trim(COALESCE(p_data->>'state', '')), '');
  IF length(v_state) > 80 THEN
    RAISE EXCEPTION 'State must not exceed 80 characters';
  END IF;

  v_pincode := NULLIF(trim(COALESCE(p_data->>'pincode', '')), '');
  IF v_pincode IS NOT NULL AND v_pincode !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Pincode must be 6 digits';
  END IF;

  v_volume := COALESCE(p_data->>'expected_monthly_volume', '25k_1l');
  IF v_volume NOT IN ('under_25k', '25k_1l', '1l_5l', 'above_5l') THEN
    RAISE EXCEPTION 'Invalid expected monthly volume selection';
  END IF;

  v_categories := '{}';
  IF p_data->'categories_interest' IS NOT NULL AND jsonb_typeof(p_data->'categories_interest') = 'array' THEN
    SELECT COALESCE(array_agg(elem.val::text), '{}'::text[]) INTO v_categories
    FROM (
      SELECT DISTINCT trim(both '"' from value::text) AS val
      FROM jsonb_array_elements(p_data->'categories_interest')
      WHERE trim(both '"' from value::text) <> ''
    ) AS elem;
  END IF;

  v_message := NULLIF(trim(COALESCE(p_data->>'message', '')), '');
  IF length(v_message) > 1000 THEN
    RAISE EXCEPTION 'Message must not exceed 1000 characters';
  END IF;

  v_accepted_terms := COALESCE((p_data->>'accepted_terms')::boolean, false);
  IF NOT v_accepted_terms THEN
    RAISE EXCEPTION 'You must review and accept the dealer terms to proceed';
  END IF;

  SELECT count(*) INTO v_recent_app_count
  FROM public.dealer_applications
  WHERE mobile = v_mobile AND created_at >= (NOW() - interval '24 hours');
  IF v_recent_app_count >= 3 THEN
    RAISE EXCEPTION 'Too many dealer applications submitted for mobile % in the last 24 hours', v_mobile;
  END IF;

  v_date_prefix := 'DLR-' || to_char(NOW(), 'YYMMDD') || '-';
  FOR v_attempt IN 1..10 LOOP
    v_rand := '';
    FOR i IN 1..4 LOOP
      v_rand := v_rand || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;
    v_app_no := v_date_prefix || v_rand;
    IF NOT EXISTS (SELECT 1 FROM public.dealer_applications WHERE application_no = v_app_no) THEN
      EXIT;
    END IF;
  END LOOP;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  INSERT INTO public.dealer_applications (
    application_no,
    business_name,
    owner_name,
    mobile,
    whatsapp,
    email,
    gstin,
    business_type,
    address,
    city,
    state,
    pincode,
    expected_monthly_volume,
    categories_interest,
    message,
    status,
    user_id,
    public_token,
    accepted_terms_at,
    created_at,
    updated_at
  ) VALUES (
    v_app_no,
    v_business_name,
    v_owner_name,
    v_mobile,
    v_whatsapp,
    v_email,
    v_gstin,
    v_business_type,
    v_address,
    v_city,
    v_state,
    v_pincode,
    v_volume,
    v_categories,
    v_message,
    'new',
    auth.uid(),
    v_token,
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id, created_at INTO v_inserted_id, v_created_at;

  INSERT INTO public.dealer_events (
    application_id,
    status,
    note,
    created_by,
    created_at
  ) VALUES (
    v_inserted_id,
    'new',
    'Dealer application submitted online',
    auth.uid(),
    NOW()
  );

  RETURN jsonb_build_object(
    'application_no', v_app_no,
    'created_at', v_created_at,
    'public_token', v_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_dealer_application(jsonb) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7b. CHECKOUT RATE LIMIT TABLE & SLIDING WINDOW COUNTER
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.checkout_rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.checkout_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.checkout_rate_limits TO service_role;

CREATE INDEX IF NOT EXISTS idx_checkout_rate_limits_ip_created_at
  ON public.checkout_rate_limits(ip, created_at);

CREATE OR REPLACE FUNCTION public.check_and_record_checkout_rate_limit(
  p_ip text,
  p_max_requests integer DEFAULT 5,
  p_window_minutes integer DEFAULT 10
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz := now() - (p_window_minutes || ' minutes')::interval;
BEGIN
  -- Lazy prune records older than 2 hours to keep table compact
  DELETE FROM public.checkout_rate_limits WHERE created_at < (now() - interval '2 hours');

  SELECT count(*) INTO v_count
  FROM public.checkout_rate_limits
  WHERE ip = p_ip AND created_at >= v_window_start;

  IF v_count >= p_max_requests THEN
    RETURN false; -- Rate limit exceeded
  END IF;

  INSERT INTO public.checkout_rate_limits (ip, created_at)
  VALUES (p_ip, now());

  RETURN true; -- Allowed
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_record_checkout_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_record_checkout_rate_limit(text, integer, integer) TO service_role;

-- Hardened search_path on recursive category descendant helper (SEC-DEF-01)
CREATE OR REPLACE FUNCTION public.get_category_descendant_ids(p_category_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  WITH RECURSIVE category_tree AS (
    SELECT c.id
    FROM public.categories c
    WHERE c.id = p_category_id
    UNION ALL
    SELECT c.id
    FROM public.categories c
    JOIN category_tree ct ON c.parent_id = ct.id
  )
  SELECT id FROM category_tree;
$$;

GRANT EXECUTE ON FUNCTION public.get_category_descendant_ids(uuid) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. RPC: get_order_by_id(text, text) & get_dealer_application_by_code(text, text)
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

  -- Owner / Admin View: filter events for non-admin owners to customer_visible rows only
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

  -- Privileged Owner / Admin View: returns exact 024 response keys + public_token
  IF v_is_admin OR v_is_owner THEN
    RETURN jsonb_build_object(
      'id', v_order.id,
      'user_id', v_order.user_id,
      'customer', v_order.customer,
      'items', v_order.items,
      'subtotal', v_order.subtotal,
      'savings', v_order.savings,
      'shipping', v_order.shipping,
      'total', v_order.total,
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

  -- Minimal Guest View: id, status, created_at, courier_name, awb_number, cancel_reason, timeline (status, note, created_at), item name + quantity, masked phone
  RETURN jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'courier_name', v_order.courier_name,
    'awb_number', v_order.awb_number,
    'cancel_reason', v_order.cancel_reason,
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

CREATE OR REPLACE FUNCTION public.get_dealer_application_by_code(
  p_code text,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_app record;
  v_is_admin boolean := public.is_admin();
  v_clean_token text := trim(COALESCE(p_token, ''));
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_app
  FROM public.dealer_applications
  WHERE application_no = trim(p_code);

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT v_is_admin THEN
    IF v_clean_token = '' OR v_app.public_token <> v_clean_token THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'application_no', v_app.application_no,
    'status', v_app.status,
    'created_at', v_app.created_at,
    'business_name', v_app.business_name,
    'owner_name', v_app.owner_name,
    'city', v_app.city,
    'state', v_app.state,
    'categories_interest', v_app.categories_interest,
    'public_token', CASE WHEN v_is_admin THEN v_app.public_token ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dealer_application_by_code(text, text) TO anon, authenticated;

COMMIT;

