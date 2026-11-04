-- ============================================================================
-- Migration 035: Fix Order Total Constraint & Sync Customer Names on Reviews
-- ============================================================================
-- Issues resolved:
--   1. "null value in column 'total' of relation 'orders' violates not-null constraint"
--      - Adds DEFAULT 0 to orders.total column.
--      - Hardens create_verified_order and create_verified_order_guest with strict
--        COALESCE guards around v_free_delivery_min, v_shipping_fee, v_subtotal,
--        v_shipping, and v_total so NULL is never inserted into orders.total.
--   2. Reviews showing "Verified Wholesale Buyer" instead of real customer name:
--      - Backfills all reviews in public.reviews with real author names from public.profiles
--        and auth.users metadata.
--      - Implements public.get_product_reviews(p_product_id) RPC (SECURITY DEFINER)
--        joining reviews with profiles so all visitors & customers see real customer names.
--      - Implements trg_sync_review_author trigger on public.reviews.
--   3. "permission denied for function is_admin" when querying reviews or products:
--      - Grants EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role.
--      - Restructures public.reviews SELECT RLS policies to cleanly allow public read
--        of approved reviews without evaluating admin functions for anonymous users.
--   4. Adds missing email column to public.profiles to prevent handle_new_user auth failures.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table Alterations & Defaults
-- ----------------------------------------------------------------------------

-- Guard orders.total against NULL
ALTER TABLE public.orders ALTER COLUMN total SET DEFAULT 0;

-- Ensure profiles.email exists so handle_new_user never fails
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- ----------------------------------------------------------------------------
-- 2. Grant Safe Execution on is_admin() Helper
-- ----------------------------------------------------------------------------
-- is_admin() returns false when auth.uid() is null (safe for anon & public)
GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Restructure public.reviews RLS Policies
-- ----------------------------------------------------------------------------

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Anyone can read approved reviews or own reviews or admin reads all" ON public.reviews;
DROP POLICY IF EXISTS "Users can read own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.reviews;

-- Approved reviews are readable by anyone (anon and authenticated) without calling is_admin()
CREATE POLICY "Anyone can read approved reviews"
  ON public.reviews FOR SELECT
  USING (status = 'approved');

-- Authenticated users can read their own reviews (including pending/rejected)
CREATE POLICY "Users can read own reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view and manage all reviews
CREATE POLICY "Admins can manage all reviews"
  ON public.reviews FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. Backfill Existing Reviews with Real Customer Names
-- ----------------------------------------------------------------------------

UPDATE public.reviews r
SET user_name = COALESCE(
  NULLIF(trim(p.full_name), ''),
  NULLIF(trim(p.business_name), ''),
  NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
  NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
  split_part(u.email, '@', 1),
  'Wholesale Customer'
)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE r.user_id = u.id
  AND (r.user_name IS NULL OR r.user_name = 'Verified Wholesale Buyer' OR trim(r.user_name) = '');

-- ----------------------------------------------------------------------------
-- 5. Trigger to Auto-Populate Customer Name on New / Updated Reviews
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_review_author_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_biz text;
BEGIN
  IF NEW.user_name IS NULL OR NEW.user_name = 'Verified Wholesale Buyer' OR trim(NEW.user_name) = '' THEN
    SELECT NULLIF(trim(full_name), ''), NULLIF(trim(business_name), '')
    INTO v_name, v_biz
    FROM public.profiles
    WHERE id = NEW.user_id;

    NEW.user_name := COALESCE(v_name, v_biz, 'Wholesale Customer');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_review_author ON public.reviews;
CREATE TRIGGER trg_sync_review_author
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.sync_review_author_name();

-- ----------------------------------------------------------------------------
-- 6. RPC: get_product_reviews (Returns Reviews with Real Customer Names)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_product_reviews(p_product_id uuid)
RETURNS TABLE (
  id uuid,
  product_id uuid,
  user_id uuid,
  rating smallint,
  title text,
  body text,
  status text,
  user_name text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT
    r.id,
    r.product_id,
    r.user_id,
    r.rating,
    r.title,
    r.body,
    r.status,
    COALESCE(
      NULLIF(trim(p.full_name), ''),
      NULLIF(trim(p.business_name), ''),
      NULLIF(trim(r.user_name), ''),
      'Wholesale Customer'
    ) AS user_name,
    r.created_at
  FROM public.reviews r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.product_id = p_product_id
    AND (
      r.status = 'approved'
      OR (auth.uid() IS NOT NULL AND r.user_id = auth.uid())
      OR public.is_admin()
    )
  ORDER BY r.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_product_reviews(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_reviews(uuid) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. Ensure Delivery Settings Fallback Composite Keys
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
-- 8. Hardened create_verified_order (Authenticated Checkout RPC)
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text, text);

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
  v_total_savings numeric(10, 2) := 0;
  v_shipping numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_free_delivery_min numeric(10, 2) := 999;
  v_shipping_fee numeric(10, 2) := 49;
  v_max_qty_per_item integer := 500;
  v_seen_product_ids uuid[] := '{}';
  v_order_items jsonb := '[]'::jsonb;

  v_applied_promo text := NULL;
  v_discount_amount numeric(10, 2) := 0;
  v_promo record;

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

  -- 3. Items Validation
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

  -- 4. Store Delivery Thresholds (Strictly fallback-guarded against NULL)
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

  -- 5. Process Line Items (Lock product rows FOR UPDATE)
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

    SELECT id, name, sku, price, images, is_active, stock, min_order_qty, price_tiers
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

    -- Calculate Wholesale Tier Pricing
    v_applied_price := NULL;
    v_applied_min_qty := 1;

    IF v_product.price_tiers IS NOT NULL AND jsonb_typeof(v_product.price_tiers) = 'array' AND jsonb_array_length(v_product.price_tiers) > 0 THEN
      SELECT
        COALESCE(NULLIF(tier->>'price', '')::numeric, v_product.price),
        COALESCE(NULLIF(tier->>'min_qty', '')::integer, 1)
      INTO v_applied_price, v_applied_min_qty
      FROM jsonb_array_elements(v_product.price_tiers) AS tier
      WHERE v_qty >= COALESCE(NULLIF(tier->>'min_qty', '')::integer, 1)
      ORDER BY COALESCE(NULLIF(tier->>'min_qty', '')::integer, 1) DESC
      LIMIT 1;

      SELECT COALESCE(NULLIF(tier->>'price', '')::numeric, v_product.price)
      INTO v_first_tier_price
      FROM jsonb_array_elements(v_product.price_tiers) AS tier
      ORDER BY COALESCE(NULLIF(tier->>'min_qty', '')::integer, 1) ASC
      LIMIT 1;
    END IF;

    IF v_applied_price IS NULL THEN
      v_applied_price := COALESCE(v_product.price, 0);
      v_applied_min_qty := COALESCE(v_product.min_order_qty, 1);
    END IF;
    IF v_first_tier_price IS NULL THEN
      v_first_tier_price := v_applied_price;
    END IF;

    v_line_total := round(v_applied_price * v_qty, 2);
    v_line_savings := greatest(round((v_first_tier_price - v_applied_price) * v_qty, 2), 0);

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

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
        'min_qty', v_applied_min_qty,
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

  -- 6. Validate & Apply Promo Code
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

  -- 7. Shipping & Grand Total Calculation
  IF v_subtotal >= v_free_delivery_min THEN
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

  -- 8. Order ID Generation (URT-YYMMDD-XXXX)
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

  -- 9. Insert Confirmed Order (Strict COALESCE guards guarantee total is never NULL)
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

REVOKE ALL ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. Hardened create_verified_order_guest (Guest Checkout via service_role)
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_verified_order_guest(jsonb, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.create_verified_order_guest(jsonb, jsonb, text, text);

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
  v_total_savings numeric(10, 2) := 0;
  v_shipping numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_free_delivery_min numeric(10, 2) := 999;
  v_shipping_fee numeric(10, 2) := 49;
  v_max_qty_per_item integer := 500;
  v_seen_product_ids uuid[] := '{}';
  v_order_items jsonb := '[]'::jsonb;

  v_applied_promo text := NULL;
  v_discount_amount numeric(10, 2) := 0;
  v_promo record;

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

  -- 3. Items Validation
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

  -- 4. Store Delivery Thresholds (Strictly fallback-guarded against NULL)
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

  -- 5. Process Line Items (Lock product rows FOR UPDATE)
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

    SELECT id, name, sku, price, images, is_active, stock, min_order_qty, price_tiers
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

    -- Calculate Wholesale Tier Pricing
    v_applied_price := NULL;
    v_applied_min_qty := 1;

    IF v_product.price_tiers IS NOT NULL AND jsonb_typeof(v_product.price_tiers) = 'array' AND jsonb_array_length(v_product.price_tiers) > 0 THEN
      SELECT
        COALESCE(NULLIF(tier->>'price', '')::numeric, v_product.price),
        COALESCE(NULLIF(tier->>'min_qty', '')::integer, 1)
      INTO v_applied_price, v_applied_min_qty
      FROM jsonb_array_elements(v_product.price_tiers) AS tier
      WHERE v_qty >= COALESCE(NULLIF(tier->>'min_qty', '')::integer, 1)
      ORDER BY COALESCE(NULLIF(tier->>'min_qty', '')::integer, 1) DESC
      LIMIT 1;

      SELECT COALESCE(NULLIF(tier->>'price', '')::numeric, v_product.price)
      INTO v_first_tier_price
      FROM jsonb_array_elements(v_product.price_tiers) AS tier
      ORDER BY COALESCE(NULLIF(tier->>'min_qty', '')::integer, 1) ASC
      LIMIT 1;
    END IF;

    IF v_applied_price IS NULL THEN
      v_applied_price := COALESCE(v_product.price, 0);
      v_applied_min_qty := COALESCE(v_product.min_order_qty, 1);
    END IF;
    IF v_first_tier_price IS NULL THEN
      v_first_tier_price := v_applied_price;
    END IF;

    v_line_total := round(v_applied_price * v_qty, 2);
    v_line_savings := greatest(round((v_first_tier_price - v_applied_price) * v_qty, 2), 0);

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

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
        'min_qty', v_applied_min_qty,
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
      reason
    )
    VALUES (
      v_product.id,
      -v_qty,
      'Storefront guest order checkout'
    );
  END LOOP;

  -- 6. Validate & Apply Promo Code
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

  -- 7. Shipping & Grand Total Calculation
  IF v_subtotal >= v_free_delivery_min THEN
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

  -- 8. Order ID Generation (URT-YYMMDD-XXXX)
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

  -- 9. Insert Confirmed Guest Order (user_id IS NULL)
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

REVOKE ALL ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text, text) TO service_role;

-- ----------------------------------------------------------------------------
-- 10. Refresh PostgREST Schema Cache
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

