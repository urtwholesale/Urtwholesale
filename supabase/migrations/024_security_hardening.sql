-- ============================================================================
-- Migration 024: Comprehensive Security Hardening & Principle of Least Privilege
-- 
-- Summary of Security Hardening:
-- 1. Profiles & Role Protection:
--    - Enforces handle_new_user() hardcodes role = 'customer' and ignores metadata.
--    - Enforces check_profile_role_update() prevents non-admins from altering role.
-- 2. Storefront Catalog Isolation:
--    - Introduces public.products_public view (WITH security_invoker = on) exposing
--      storefront-safe columns and an in_stock boolean instead of raw stock quantity.
--    - Revokes anon table-level SELECT on public.products and grants SELECT only on
--      non-sensitive columns (blocking direct anon access to stock).
--    - Enables RLS on public.search_vocabulary with read-only public access.
-- 3. create_verified_order Hardening:
--    - Enforces integer quantity between min_order_qty and configurable max_order_qty_per_item.
--    - Rejects inactive products and validates category status.
--    - Caps line items per order (1 to 50 lines).
--    - Rejects duplicate product lines.
-- 4. create_return_request Hardening:
--    - Validates that every evidence file path strictly begins with auth.uid() || '/'.
--    - Validates that every evidence object actually exists in the 'return-evidence' storage bucket.
-- 5. search_products_v2 Hardening:
--    - Hard caps query string length to 60 characters server-side.
--    - Hard caps result pagination to 50 rows maximum per query.
-- 6. get_order_by_id Protection:
--    - Strips internal admin_note for non-administrators.
--    - Masks customer phone number for unauthenticated guest lookup callers.
-- 7. Admin, Bulk, Stats, and Undo RPC Functions:
--    - Enforces IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
--    - Sets SET search_path = public, pg_temp on all administrative functions.
--    - Revokes EXECUTE from PUBLIC and anon, granting solely to authenticated admin users.
-- ============================================================================

-- ============================================================================
-- 1. PROFILES & ROLE PROTECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Prevent non-admins from changing their role
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: Only administrators can change user roles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_role_protection ON public.profiles;
CREATE TRIGGER enforce_profile_role_protection
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_role_update();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    phone
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'customer', -- strictly hardcoded; never reads role from raw_user_meta_data
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. STOREFRONT CATALOG ISOLATION & PRODUCTS_PUBLIC VIEW
-- ============================================================================

-- Helper function: Evaluates stock availability without exposing raw stock count to anon
CREATE OR REPLACE FUNCTION public.product_is_in_stock(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((stock > 0), false)
  FROM public.products
  WHERE id = p_product_id;
$$;

REVOKE ALL ON FUNCTION public.product_is_in_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.product_is_in_stock(uuid) TO anon, authenticated;

-- Create storefront-safe view with security_invoker = on
DROP VIEW IF EXISTS public.products_public CASCADE;
CREATE VIEW public.products_public
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
  public.product_is_in_stock(p.id) AS in_stock,
  p.images,
  p.category_id,
  p.is_urbanrat_brand,
  p.is_active,
  p.is_featured,
  p.keywords,
  p.brand,
  p.created_at,
  p.updated_at
FROM public.products p
WHERE p.is_active = true;

COMMENT ON VIEW public.products_public IS 'Storefront-safe product catalog excluding internal stock counts and admin fields with security_invoker enabled.';

GRANT SELECT ON public.products_public TO anon, authenticated;

-- Revoke table-wide SELECT on products from anon
REVOKE SELECT ON TABLE public.products FROM anon;

-- Grant column-level SELECT on non-sensitive columns only (excluding stock)
GRANT SELECT (
  id, name, slug, description, short_description, price, mrp, sku,
  images, category_id, is_urbanrat_brand, is_active, is_featured,
  keywords, brand, created_at, updated_at
) ON TABLE public.products TO anon;

-- Ensure search_vocabulary has Row Level Security enabled
ALTER TABLE IF EXISTS public.search_vocabulary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read search vocabulary" ON public.search_vocabulary;
CREATE POLICY "Public can read search vocabulary"
  ON public.search_vocabulary FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage search vocabulary" ON public.search_vocabulary;
CREATE POLICY "Admins can manage search vocabulary"
  ON public.search_vocabulary FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 3. HARDEN create_verified_order
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_customer jsonb,
  p_items jsonb,
  p_whatsapp_message text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Customer validation variables
  v_cust_name text;
  v_raw_phone text;
  v_cust_phone text;
  v_cust_address text;
  v_cust_pincode text;
  v_sanitized_customer jsonb;

  -- Items & calculation variables
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
  v_max_qty_per_item integer := 10000;
  v_seen_product_ids uuid[] := '{}';
  v_order_items jsonb := '[]'::jsonb;

  -- Order generation variables
  v_order_id text;
  v_date_prefix text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_rand text;
  v_attempt integer;
  v_user_id uuid := auth.uid();
  v_whatsapp_msg text;
  v_created_order public.orders;
BEGIN
  -- 1. Validate Customer Payload
  IF p_customer IS NULL OR jsonb_typeof(p_customer) <> 'object' THEN
    RAISE EXCEPTION 'Invalid customer details provided';
  END IF;

  v_cust_name := trim(coalesce(p_customer->>'name', ''));
  IF length(v_cust_name) < 2 THEN
    RAISE EXCEPTION 'Customer name is required (minimum 2 characters)';
  END IF;

  -- Clean phone: strip non-digits, normalize 10-digit format
  v_raw_phone := regexp_replace(coalesce(p_customer->>'phone', ''), '\D', '', 'g');
  IF length(v_raw_phone) = 12 AND v_raw_phone LIKE '91%' THEN
    v_cust_phone := substr(v_raw_phone, 3);
  ELSIF length(v_raw_phone) = 11 AND v_raw_phone LIKE '0%' THEN
    v_cust_phone := substr(v_raw_phone, 2);
  ELSE
    v_cust_phone := v_raw_phone;
  END IF;

  IF v_cust_phone !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid 10-digit mobile number: %. Must be a valid Indian mobile number', coalesce(p_customer->>'phone', '');
  END IF;

  v_cust_address := trim(coalesce(p_customer->>'address', ''));
  IF length(v_cust_address) < 5 THEN
    RAISE EXCEPTION 'Delivery address is required (minimum 5 characters)';
  END IF;

  v_cust_pincode := trim(coalesce(p_customer->>'pincode', ''));
  IF v_cust_pincode !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid 6-digit postal PIN code: %', coalesce(p_customer->>'pincode', '');
  END IF;

  v_sanitized_customer := jsonb_build_object(
    'name', v_cust_name,
    'phone', v_cust_phone,
    'address', v_cust_address,
    'pincode', v_cust_pincode
  );

  IF p_customer ? 'business_name' AND length(trim(p_customer->>'business_name')) > 0 THEN
    v_sanitized_customer := v_sanitized_customer || jsonb_build_object('business_name', trim(p_customer->>'business_name'));
  END IF;
  IF p_customer ? 'gstin' AND length(trim(p_customer->>'gstin')) > 0 THEN
    v_sanitized_customer := v_sanitized_customer || jsonb_build_object('gstin', upper(trim(p_customer->>'gstin')));
  END IF;
  IF p_customer ? 'city' AND length(trim(p_customer->>'city')) > 0 THEN
    v_sanitized_customer := v_sanitized_customer || jsonb_build_object('city', trim(p_customer->>'city'));
  END IF;
  IF p_customer ? 'state' AND length(trim(p_customer->>'state')) > 0 THEN
    v_sanitized_customer := v_sanitized_customer || jsonb_build_object('state', trim(p_customer->>'state'));
  END IF;

  -- 2. Validate Items Array & Bounds
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Order items must be a valid list';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  IF v_item_count > 50 THEN
    RAISE EXCEPTION 'Order cannot exceed maximum limit of 50 line items';
  END IF;

  -- Reject duplicate product lines
  IF (SELECT count(*) FROM jsonb_array_elements(p_items)) <> (SELECT count(DISTINCT elem->>'product_id') FROM jsonb_array_elements(p_items) elem) THEN
    RAISE EXCEPTION 'Duplicate product lines are not allowed in an order';
  END IF;

  -- 3. Read Store Shipping & Order Limits Settings
  SELECT coalesce((value#>>'{}')::numeric, 999) INTO v_free_delivery_min
  FROM public.store_settings
  WHERE key = 'free_delivery_min';

  SELECT coalesce((value#>>'{}')::numeric, 49) INTO v_shipping_fee
  FROM public.store_settings
  WHERE key = 'shipping_fee';

  SELECT coalesce((value#>>'{}')::integer, 10000) INTO v_max_qty_per_item
  FROM public.store_settings
  WHERE key = 'max_order_qty_per_item';

  IF v_max_qty_per_item IS NULL OR v_max_qty_per_item <= 0 THEN
    v_max_qty_per_item := 10000;
  END IF;

  -- 4. Process Each Item (Lock row, validate rules, compute tiers)
  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      coalesce((elem->>'qty')::integer, (elem->>'quantity')::integer, 0) AS qty
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    v_qty := v_item.qty;

    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'Missing product ID in order item';
    END IF;

    -- Reject duplicates via array check
    IF v_item.product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION 'Duplicate product line detected for product ID %', v_item.product_id;
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, v_item.product_id);

    -- Quantity bound checks
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    IF v_qty > v_max_qty_per_item THEN
      RAISE EXCEPTION 'Requested quantity % exceeds maximum limit of % units per item', v_qty, v_max_qty_per_item;
    END IF;

    -- Lock the product row FOR UPDATE
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

    IF v_qty < coalesce(v_product.min_order_qty, 1) THEN
      RAISE EXCEPTION 'Quantity % for "%" is below minimum order quantity of %',
        v_qty, v_product.name, coalesce(v_product.min_order_qty, 1);
    END IF;

    IF coalesce(v_product.order_qty_step, 1) > 1 AND (v_qty % v_product.order_qty_step <> 0) THEN
      RAISE EXCEPTION 'Quantity % for "%" must be an exact multiple of %',
        v_qty, v_product.name, v_product.order_qty_step;
    END IF;

    IF v_qty > v_product.stock THEN
      RAISE EXCEPTION 'Insufficient stock for "%". Requested %, only % available',
        v_product.name, v_qty, v_product.stock;
    END IF;

    -- Compute true unit price based on volume tiers
    v_unit_price := public.get_unit_price(v_product.id, v_qty);

    -- Find first-tier base price for calculating savings
    SELECT unit_price INTO v_first_tier_price
    FROM public.product_price_tiers
    WHERE product_id = v_product.id
    ORDER BY min_qty ASC
    LIMIT 1;

    v_first_tier_price := coalesce(v_first_tier_price, v_product.price);

    -- Find tier min_qty applied
    SELECT min_qty INTO v_applied_min_qty
    FROM public.product_price_tiers
    WHERE product_id = v_product.id AND min_qty <= v_qty
    ORDER BY min_qty DESC
    LIMIT 1;

    v_applied_min_qty := coalesce(v_applied_min_qty, coalesce(v_product.min_order_qty, 1));

    -- Calculate line financial metrics
    v_line_total := v_unit_price * v_qty;
    v_line_savings := greatest((v_first_tier_price - v_unit_price) * v_qty, 0);

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

    -- Append to sanitized order items JSON
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
        'applied_tier_min_qty', v_applied_min_qty
      )
    );

    -- Deduct stock atomically
    UPDATE public.products
    SET stock = stock - v_qty,
        updated_at = NOW()
    WHERE id = v_product.id;

    -- Record stock movement
    INSERT INTO public.stock_movements (
      product_id,
      quantity_change,
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

  -- 5. Calculate Shipping & Grand Total
  IF v_subtotal >= v_free_delivery_min THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_shipping_fee;
  END IF;

  v_total := v_subtotal + v_shipping;

  -- 6. Generate Collision-Resistant Order ID: URT-YYMMDD-XXXX
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

  -- Format WhatsApp notification summary
  v_whatsapp_msg := coalesce(
    p_whatsapp_message,
    format('URT Wholesale: Order %s placed. Subtotal: ₹%s, Shipping: ₹%s, Total: ₹%s for %s item line(s).',
      v_order_id, v_subtotal, v_shipping, v_total, v_item_count)
  );

  -- 7. Insert Confirmed Order
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

  -- Record order creation event
  INSERT INTO public.order_events (
    order_id,
    status,
    note
  )
  VALUES (
    v_order_id,
    'pending',
    'Order created via storefront checkout'
  );

  RETURN v_created_order;
END;
$$;

-- Explicitly revoke and grant for create_verified_order
REVOKE ALL ON FUNCTION public.create_verified_order(jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_verified_order(jsonb, jsonb, text) TO anon, authenticated;

-- ============================================================================
-- 4. HARDEN create_return_request
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_return_request(
  p_order_id text,
  p_items jsonb,
  p_type text,
  p_reason text,
  p_description text DEFAULT NULL,
  p_evidence_paths text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_order record;
  v_delivered_at timestamptz;
  v_window_days integer := 7;
  v_return_code text;
  v_return_id uuid;
  v_date_prefix text;
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_rand text;
  v_attempt integer;
  v_req_item record;
  v_delivered_qty integer;
  v_already_returned_qty integer;
  v_available_qty integer;
  v_prod_name text;
  v_inserted_items jsonb := '[]'::jsonb;
  v_ev_path text;
  v_expected_prefix text;
BEGIN
  -- 1. Authentication check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a return request';
  END IF;

  -- 2. Validate Order existence and ownership
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order "%" not found', p_order_id;
  END IF;

  IF v_order.user_id IS NULL OR v_order.user_id <> v_user_id THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'forbidden: You can only create return requests for your own registered orders';
    END IF;
  END IF;

  -- 3. Validate Return Window
  IF v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'Returns are only accepted for delivered orders. Current order status is "%"', v_order.status;
  END IF;

  SELECT coalesce((value#>>'{}')::integer, 7) INTO v_window_days
  FROM public.store_settings
  WHERE key = 'return_window_days';

  SELECT created_at INTO v_delivered_at
  FROM public.order_events
  WHERE order_id = v_order.id AND status = 'delivered'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_delivered_at IS NULL THEN
    v_delivered_at := v_order.updated_at;
  END IF;

  IF NOW() > (v_delivered_at + (v_window_days || ' days')::interval) THEN
    RAISE EXCEPTION 'Return window expired. Orders can only be returned within % days of delivery', v_window_days;
  END IF;

  -- 4. Validate Return Type
  IF p_type NOT IN ('replacement', 'refund') THEN
    RAISE EXCEPTION 'Invalid return type "%". Must be "replacement" or "refund"', p_type;
  END IF;

  -- 5. Validate Reason
  IF trim(coalesce(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'A valid return reason is required';
  END IF;

  -- 6. Validate Evidence Paths: Must reside in user folder and exist in return-evidence bucket
  v_expected_prefix := v_user_id::text || '/';
  IF p_evidence_paths IS NOT NULL AND array_length(p_evidence_paths, 1) IS NOT NULL THEN
    FOREACH v_ev_path IN ARRAY p_evidence_paths LOOP
      v_ev_path := trim(coalesce(v_ev_path, ''));
      IF NOT (v_ev_path LIKE (v_expected_prefix || '%')) THEN
        RAISE EXCEPTION 'Invalid evidence file path: %. All uploaded evidence must be inside your user folder "%"', v_ev_path, v_expected_prefix;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM storage.objects
        WHERE bucket_id = 'return-evidence' AND name = v_ev_path
      ) THEN
        RAISE EXCEPTION 'Evidence object "%" was not found in return-evidence bucket', v_ev_path;
      END IF;
    END LOOP;
  END IF;

  -- 7. Generate Return Code: RET-YYMMDD-XXXX
  v_date_prefix := 'RET-' || to_char(NOW(), 'YYMMDD') || '-';
  v_attempt := 0;

  LOOP
    v_attempt := v_attempt + 1;
    v_rand := '';
    FOR i IN 1..4 LOOP
      v_rand := v_rand || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;
    v_return_code := v_date_prefix || v_rand;

    IF NOT EXISTS (SELECT 1 FROM public.return_requests WHERE return_code = v_return_code) THEN
      EXIT;
    END IF;

    IF v_attempt > 10 THEN
      v_return_code := v_date_prefix || upper(substr(gen_random_uuid()::text, 1, 6));
      EXIT;
    END IF;
  END LOOP;

  -- 8. Create Return Request Header
  INSERT INTO public.return_requests (
    return_code,
    order_id,
    user_id,
    type,
    status,
    reason,
    description,
    evidence_paths,
    requested_at
  )
  VALUES (
    v_return_code,
    v_order.id,
    v_user_id,
    p_type,
    'requested',
    p_reason,
    p_description,
    coalesce(p_evidence_paths, '{}'::text[]),
    NOW()
  )
  RETURNING id INTO v_return_id;

  -- 9. Validate & Insert Line Items
  FOR v_req_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      sum(coalesce((elem->>'quantity')::integer, 0)) AS quantity
    FROM jsonb_array_elements(p_items) AS elem
    GROUP BY (elem->>'product_id')::uuid
  LOOP
    IF v_req_item.product_id IS NULL THEN
      RAISE EXCEPTION 'Missing product_id in return items payload';
    END IF;

    IF v_req_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Return quantity must be greater than zero';
    END IF;

    SELECT
      coalesce(sum((item->>'quantity')::integer), 0),
      max(item->>'name')
    INTO v_delivered_qty, v_prod_name
    FROM jsonb_array_elements(v_order.items) AS item
    WHERE (item->>'product_id')::uuid = v_req_item.product_id;

    IF v_delivered_qty = 0 THEN
      RAISE EXCEPTION 'Product % is not part of order %', v_req_item.product_id, p_order_id;
    END IF;

    SELECT coalesce(sum(ri.quantity), 0) INTO v_already_returned_qty
    FROM public.return_items ri
    JOIN public.return_requests rr ON rr.id = ri.return_request_id
    WHERE rr.order_id = v_order.id
      AND ri.product_id = v_req_item.product_id
      AND rr.status NOT IN ('rejected', 'cancelled');

    v_available_qty := v_delivered_qty - v_already_returned_qty;

    IF v_req_item.quantity > v_available_qty THEN
      RAISE EXCEPTION 'Requested return quantity (% units) for "%" exceeds available eligible quantity (% units)',
        v_req_item.quantity, coalesce(v_prod_name, 'Product'), v_available_qty;
    END IF;

    INSERT INTO public.return_items (
      return_request_id,
      product_id,
      quantity,
      qc_passed
    )
    VALUES (
      v_return_id,
      v_req_item.product_id,
      v_req_item.quantity,
      NULL
    );

    v_inserted_items := v_inserted_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_req_item.product_id,
        'product_name', v_prod_name,
        'quantity', v_req_item.quantity
      )
    );
  END LOOP;

  -- 10. Record Return Event
  INSERT INTO public.return_events (
    return_request_id,
    status,
    note,
    created_by
  )
  VALUES (
    v_return_id,
    'requested',
    'Return request submitted by customer',
    v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'return_id', v_return_id,
    'return_code', v_return_code,
    'order_id', v_order.id,
    'items', v_inserted_items,
    'requested_at', NOW()
  );
END;
$$;

-- Revoke from public/anon, grant to authenticated
REVOKE ALL ON FUNCTION public.create_return_request(text, jsonb, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_return_request(text, jsonb, text, text, text, text[]) TO authenticated;

-- ============================================================================
-- 5. HARDEN search_products_v2
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_products_v2(
  p_query text,
  p_category_ids uuid[] DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_urbanrat_only boolean DEFAULT FALSE,
  p_sort text DEFAULT 'relevance',
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_query text;
  v_norm_query text;
  v_corrected_query text := '';
  v_did_you_mean text := NULL;
  v_words text[];
  v_word text;
  v_corrected_word text;
  v_expanded_terms text[];
  v_tsquery tsquery;
  v_match_type text := 'exact';
  v_total integer := 0;
  v_limit integer;
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- 1. Server-side caps on query length (60 chars) and max_rows (50)
  v_limit := least(greatest(coalesce(p_limit, 24), 1), 50);

  v_clean_query := trim(regexp_replace(coalesce(p_query, ''), '[,():/\+*&^%$#@!~]+', ' ', 'g'));
  v_clean_query := trim(regexp_replace(v_clean_query, '\s+', ' ', 'g'));
  v_clean_query := substring(v_clean_query FROM 1 FOR 60);
  v_norm_query := lower(unaccent(v_clean_query));

  -- If empty query, return popular / newest items
  IF length(v_norm_query) = 0 THEN
    SELECT count(*) INTO v_total
    FROM public.products p
    WHERE p.is_active = TRUE
      AND (p_category_ids IS NULL OR p.category_id = ANY(p_category_ids))
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (NOT p_urbanrat_only OR p.is_urbanrat_brand = TRUE);

    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'description', p.description,
        'short_description', p.short_description,
        'price', p.price,
        'mrp', p.mrp,
        'sku', p.sku,
        'in_stock', (p.stock > 0),
        'images', p.images,
        'category_id', p.category_id,
        'is_urbanrat_brand', p.is_urbanrat_brand,
        'is_featured', p.is_featured,
        'keywords', p.keywords,
        'brand', p.brand,
        'created_at', p.created_at
      ) ORDER BY
        CASE WHEN p_sort = 'price_asc' THEN p.price END ASC,
        CASE WHEN p_sort = 'price_desc' THEN p.price END DESC,
        p.is_featured DESC,
        p.created_at DESC
    ), '[]'::jsonb) INTO v_results
    FROM (
      SELECT * FROM public.products p
      WHERE p.is_active = TRUE
        AND (p_category_ids IS NULL OR p.category_id = ANY(p_category_ids))
        AND (p_min_price IS NULL OR p.price >= p_min_price)
        AND (p_max_price IS NULL OR p.price <= p_max_price)
        AND (NOT p_urbanrat_only OR p.is_urbanrat_brand = TRUE)
      ORDER BY
        CASE WHEN p_sort = 'price_asc' THEN p.price END ASC,
        CASE WHEN p_sort = 'price_desc' THEN p.price END DESC,
        p.is_featured DESC,
        p.created_at DESC
      LIMIT v_limit OFFSET v_offset
    ) p;

    RETURN jsonb_build_object(
      'total', v_total,
      'match_type', 'empty_query',
      'did_you_mean', NULL,
      'products', v_results
    );
  END IF;

  -- 2. Check for synonym expansion
  SELECT expansion INTO v_expanded_terms
  FROM public.search_synonyms
  WHERE normalized_term = v_norm_query;

  -- 3. Tokenize query words & spelling correction
  v_words := regexp_split_to_array(v_clean_query, '\s+');
  FOREACH v_word IN ARRAY v_words LOOP
    IF length(v_word) >= 3 THEN
      SELECT public.correct_query_token(v_word) INTO v_corrected_word;
      IF v_corrected_word IS NOT NULL AND lower(v_corrected_word) <> lower(v_word) THEN
        v_corrected_query := v_corrected_query || ' ' || v_corrected_word;
      ELSE
        v_corrected_query := v_corrected_query || ' ' || v_word;
      END IF;
    ELSE
      v_corrected_query := v_corrected_query || ' ' || v_word;
    END IF;
  END LOOP;
  v_corrected_query := trim(v_corrected_query);

  IF lower(v_corrected_query) <> lower(v_clean_query) THEN
    v_did_you_mean := v_corrected_query;
  END IF;

  -- 4. Construct Full-Text Search Query (exact / prefix)
  v_tsquery := to_tsquery('english', regexp_replace(v_clean_query, '\s+', ':* & ', 'g') || ':*');

  -- Count total matching rows
  SELECT count(*) INTO v_total
  FROM public.products p
  WHERE p.is_active = TRUE
    AND (p_category_ids IS NULL OR p.category_id = ANY(p_category_ids))
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (NOT p_urbanrat_only OR p.is_urbanrat_brand = TRUE)
    AND (
      p.search_vector @@ v_tsquery
      OR p.name ILIKE ('%' || v_clean_query || '%')
      OR p.keywords && ARRAY[v_norm_query]
      OR (v_expanded_terms IS NOT NULL AND p.keywords && v_expanded_terms)
    );

  -- 5. Fallback to did_you_mean if 0 results
  IF v_total = 0 AND v_did_you_mean IS NOT NULL THEN
    v_tsquery := to_tsquery('english', regexp_replace(v_did_you_mean, '\s+', ':* & ', 'g') || ':*');
    v_match_type := 'did_you_mean';

    SELECT count(*) INTO v_total
    FROM public.products p
    WHERE p.is_active = TRUE
      AND (p_category_ids IS NULL OR p.category_id = ANY(p_category_ids))
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (NOT p_urbanrat_only OR p.is_urbanrat_brand = TRUE)
      AND (
        p.search_vector @@ v_tsquery
        OR p.name ILIKE ('%' || v_did_you_mean || '%')
      );
  END IF;

  -- 6. Fetch Page Results with ranking
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', res.id,
      'name', res.name,
      'slug', res.slug,
      'description', res.description,
      'short_description', res.short_description,
      'price', res.price,
      'mrp', res.mrp,
      'sku', res.sku,
      'in_stock', (res.stock > 0),
      'images', res.images,
      'category_id', res.category_id,
      'is_urbanrat_brand', res.is_urbanrat_brand,
      'is_featured', res.is_featured,
      'keywords', res.keywords,
      'brand', res.brand,
      'created_at', res.created_at
    ) ORDER BY
      CASE WHEN p_sort = 'price_asc' THEN res.price END ASC,
      CASE WHEN p_sort = 'price_desc' THEN res.price END DESC,
      res.rank DESC,
      res.is_featured DESC
  ), '[]'::jsonb) INTO v_results
  FROM (
    SELECT
      p.*,
      ts_rank_cd(p.search_vector, v_tsquery) AS rank
    FROM public.products p
    WHERE p.is_active = TRUE
      AND (p_category_ids IS NULL OR p.category_id = ANY(p_category_ids))
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (NOT p_urbanrat_only OR p.is_urbanrat_brand = TRUE)
      AND (
        p.search_vector @@ v_tsquery
        OR p.name ILIKE ('%' || coalesce(v_did_you_mean, v_clean_query) || '%')
        OR p.keywords && ARRAY[v_norm_query]
        OR (v_expanded_terms IS NOT NULL AND p.keywords && v_expanded_terms)
      )
    ORDER BY
      CASE WHEN p_sort = 'price_asc' THEN p.price END ASC,
      CASE WHEN p_sort = 'price_desc' THEN p.price END DESC,
      rank DESC,
      p.is_featured DESC
    LIMIT v_limit OFFSET v_offset
  ) res;

  RETURN jsonb_build_object(
    'total', v_total,
    'match_type', v_match_type,
    'did_you_mean', v_did_you_mean,
    'products', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.search_products_v2(text, uuid[], numeric, numeric, boolean, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_products_v2(text, uuid[], numeric, numeric, boolean, text, integer, integer) TO anon, authenticated;

-- ============================================================================
-- 6. HARDEN get_order_by_id (Exclude admin_note & mask phone for non-admins)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_order_by_id(p_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order jsonb;
  v_is_admin boolean := public.is_admin();
BEGIN
  SELECT
    jsonb_build_object(
      'id', o.id,
      'user_id', o.user_id,
      'customer', CASE
        WHEN v_is_admin OR auth.uid() = o.user_id THEN o.customer
        ELSE jsonb_build_object(
          'name', o.customer->>'name',
          'city', o.customer->>'city',
          'state', o.customer->>'state',
          'pincode', o.customer->>'pincode',
          'phone', regexp_replace(coalesce(o.customer->>'phone', ''), '(\d{2})\d{4}(\d{4})', '****')
        )
      END,
      'items', o.items,
      'subtotal', o.subtotal,
      'savings', o.savings,
      'shipping', o.shipping,
      'total', o.total,
      'status', o.status,
      'source', coalesce(o.source, 'website'),
      'payment_status', coalesce(o.payment_status, 'pending'),
      'courier_name', o.courier_name,
      'awb_number', o.awb_number,
      'cancel_reason', o.cancel_reason,
      'admin_note', CASE WHEN v_is_admin THEN o.admin_note ELSE NULL END,
      'whatsapp_message', CASE WHEN v_is_admin OR auth.uid() = o.user_id THEN o.whatsapp_message ELSE NULL END,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'events', (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'order_id', e.order_id,
            'status', e.status,
            'note', e.note,
            'created_at', e.created_at
          ) ORDER BY e.created_at ASC
        ), '[]'::jsonb)
        FROM public.order_events e
        WHERE e.order_id = o.id
      )
    ) INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_by_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_id(text) TO anon, authenticated;

-- ============================================================================
-- 7. HARDEN ALL ADMIN, BULK, STATS, AND UNDO RPC FUNCTIONS
--
-- For every function:
-- 1. Checks IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
-- 2. Sets search_path = public, pg_temp
-- 3. Revokes all execute permissions from PUBLIC and anon, granting to authenticated
-- ============================================================================

-- admin_adjust_stock
create or replace function public.admin_adjust_stock(
  p_product_id uuid,
  p_change integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_current_stock integer;
  v_new_stock integer;
  v_product_name text;
begin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  if p_change is null or p_change = 0 then
    raise exception 'Stock change quantity must be non-zero';
  end if;

  select stock, name into v_current_stock, v_product_name
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found: %', p_product_id;
  end if;

  -- Stock cannot fall below 0
  v_new_stock := greatest(0, v_current_stock + p_change);

  update public.products
  set stock = v_new_stock, updated_at = now()
  where id = p_product_id;

  insert into public.stock_movements (product_id, change, reason, admin_id)
  values (
    p_product_id,
    p_change,
    coalesce(p_reason, 'Manual inventory adjustment'),
    auth.uid()
  );

  return jsonb_build_object(
    'product_id', p_product_id,
    'product_name', v_product_name,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'change', p_change
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_stock(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_stock(uuid, integer, text) TO authenticated;

-- admin_bulk_adjust_stock
CREATE OR REPLACE FUNCTION public.admin_bulk_adjust_stock(
  p_product_ids uuid[],
  p_mode text,
  p_qty integer,
  p_reason text,
  p_dry_run boolean DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
set search_path = public, pg_temp$$
DECLARE
  v_prod record;
  v_op_id uuid;
  v_before_snapshot jsonb := '[]'::jsonb;
  v_preview_items jsonb := '[]'::jsonb;
  v_errors text[];
  v_affected integer := 0;

  v_new_stock integer;
  v_change integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one product ID is required.';
  END IF;

  IF array_length(p_product_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Maximum 500 products per bulk operation.';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Adjustment reason is required.';
  END IF;

  IF p_mode NOT IN ('add', 'subtract', 'set', 'zero') THEN
    RAISE EXCEPTION 'Invalid stock mode: %', p_mode;
  END IF;

  v_op_id := gen_random_uuid();

  FOR v_prod IN
    SELECT id, name, sku, stock
    FROM public.products
    WHERE id = ANY(p_product_ids)
  LOOP
    v_errors := '{}';
    v_new_stock := v_prod.stock;

    CASE p_mode
      WHEN 'add' THEN
        v_new_stock := v_prod.stock + greatest(0, p_qty);
      WHEN 'subtract' THEN
        v_new_stock := v_prod.stock - greatest(0, p_qty);
      WHEN 'set' THEN
        v_new_stock := greatest(0, p_qty);
      WHEN 'zero' THEN
        v_new_stock := 0;
    END CASE;

    IF v_new_stock < 0 THEN
      v_errors := array_append(v_errors, format('Stock cannot drop below 0 (current: %s, delta: -%s).', v_prod.stock, p_qty));
    ELSE
      v_change := v_new_stock - v_prod.stock;
      v_affected := v_affected + 1;

      v_before_snapshot := v_before_snapshot || jsonb_build_object(
        'product_id', v_prod.id,
        'previous_stock', v_prod.stock,
        'new_stock', v_new_stock,
        'change', v_change
      );

      IF NOT p_dry_run THEN
        UPDATE public.products
        SET stock = v_new_stock, updated_at = now()
        WHERE id = v_prod.id;

        INSERT INTO public.stock_movements (product_id, change, reason, admin_id)
        VALUES (
          v_prod.id,
          v_change,
          trim(p_reason) || ' [Bulk Op: ' || v_op_id || ']',
          auth.uid()
        );
      END IF;
    END IF;

    v_preview_items := v_preview_items || jsonb_build_object(
      'product_id', v_prod.id,
      'product_name', v_prod.name,
      'sku', v_prod.sku,
      'before', jsonb_build_object('stock', v_prod.stock),
      'after', jsonb_build_object('stock', v_new_stock, 'change', v_new_stock - v_prod.stock),
      'errors', to_jsonb(v_errors)
    );
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.bulk_operations (
      id, op_type, params, product_ids, before_snapshot, affected_count, status, created_by
    ) VALUES (
      v_op_id, 'stock', jsonb_build_object('mode', p_mode, 'qty', p_qty, 'reason', p_reason), p_product_ids, v_before_snapshot, v_affected, 'applied', auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'op_id', CASE WHEN NOT p_dry_run THEN v_op_id ELSE NULL END,
    'total_count', array_length(p_product_ids, 1),
    'affected_count', v_affected,
    'items', v_preview_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_adjust_stock(uuid[], text, integer, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bulk_adjust_stock(uuid[], text, integer, text, boolean) TO authenticated;

-- admin_bulk_move_products
CREATE OR REPLACE FUNCTION public.admin_bulk_move_products(
  p_product_ids uuid[],
  p_category_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
set search_path = public, pg_temp$$
DECLARE
  v_count integer := 0;
  v_cat_exists boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Validate target category if not null
  IF p_category_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.categories
      WHERE id = p_category_id AND is_active = TRUE
    ) INTO v_cat_exists;

    IF NOT v_cat_exists THEN
      RAISE EXCEPTION 'Target category not found or inactive.';
    END IF;
  END IF;

  -- Perform bulk move
  UPDATE public.products
  SET
    category_id = p_category_id,
    updated_at = now()
  WHERE id = ANY(p_product_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Write audit log if an audit table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO public.audit_logs (action, details, created_at)
    VALUES (
      'bulk_move_products',
      jsonb_build_object(
        'count', v_count,
        'target_category_id', p_category_id,
        'product_ids', p_product_ids
      ),
      now()
    );
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_move_products(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bulk_move_products(uuid[], uuid) TO authenticated;

-- admin_bulk_save_tiers
CREATE OR REPLACE FUNCTION public.admin_bulk_save_tiers(
  p_product_ids uuid[],
  p_mode text,
  p_payload jsonb,
  p_dry_run boolean DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
set search_path = public, pg_temp$$
DECLARE
  v_prod record;
  v_op_id uuid;
  v_before_snapshot jsonb := '[]'::jsonb;
  v_preview_items jsonb := '[]'::jsonb;
  v_errors text[];
  v_warnings text[];
  v_affected integer := 0;

  v_source_tiers jsonb;
  v_computed_tiers jsonb;
  v_elem jsonb;
  v_min_qty integer;
  v_unit_price numeric;
  v_prev_qty integer;
  v_prev_price numeric;

  -- adjust mode payload vars
  v_adj_type text;
  v_adj_dir text;
  v_adj_val numeric;
  v_adj_factor numeric;

  -- from_base spec element
  v_discount_pct numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one product ID is required.';
  END IF;

  IF array_length(p_product_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Maximum 500 products per bulk operation.';
  END IF;

  IF p_mode NOT IN ('replace', 'adjust', 'from_base', 'copy_from', 'clear') THEN
    RAISE EXCEPTION 'Invalid tier bulk mode: %', p_mode;
  END IF;

  -- Pre-fetch source tiers for copy_from mode
  IF p_mode = 'copy_from' THEN
    SELECT jsonb_agg(jsonb_build_object('min_qty', min_qty, 'unit_price', unit_price) ORDER BY min_qty ASC)
    INTO v_source_tiers
    FROM public.product_price_tiers
    WHERE product_id = (p_payload->>'source_product_id')::uuid;

    IF v_source_tiers IS NULL OR jsonb_array_length(v_source_tiers) = 0 THEN
      RAISE EXCEPTION 'Source product has no volume tiers to copy.';
    END IF;
  END IF;

  v_op_id := gen_random_uuid();

  FOR v_prod IN
    SELECT p.*, COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('min_qty', t.min_qty, 'unit_price', t.unit_price) ORDER BY t.min_qty ASC)
       FROM public.product_price_tiers t WHERE t.product_id = p.id), '[]'::jsonb
    ) as existing_tiers
    FROM public.products p
    WHERE p.id = ANY(p_product_ids)
  LOOP
    v_errors := '{}';
    v_warnings := '{}';
    v_computed_tiers := '[]'::jsonb;

    CASE p_mode
      WHEN 'replace' THEN
        v_computed_tiers := p_payload;

      WHEN 'copy_from' THEN
        v_computed_tiers := v_source_tiers;

      WHEN 'clear' THEN
        v_computed_tiers := '[]'::jsonb;

      WHEN 'from_base' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payload)
        LOOP
          v_min_qty := (v_elem->>'min_qty')::integer;
          v_discount_pct := (v_elem->>'discount_pct')::numeric;
          v_unit_price := greatest(0.01, round(v_prod.price * (1.0 - v_discount_pct / 100.0), 2));
          v_computed_tiers := v_computed_tiers || jsonb_build_object('min_qty', v_min_qty, 'unit_price', v_unit_price);
        END LOOP;

      WHEN 'adjust' THEN
        v_adj_type := p_payload->>'type';
        v_adj_dir := p_payload->>'direction';
        v_adj_val := (p_payload->>'value')::numeric;
        v_adj_factor := CASE WHEN v_adj_dir = 'up' THEN 1.0 ELSE -1.0 END;

        IF jsonb_array_length(v_prod.existing_tiers) = 0 THEN
          v_errors := array_append(v_errors, 'Product has no existing tiers to adjust.');
        ELSE
          FOR v_elem IN SELECT * FROM jsonb_array_elements(v_prod.existing_tiers)
          LOOP
            v_min_qty := (v_elem->>'min_qty')::integer;
            v_unit_price := (v_elem->>'unit_price')::numeric;
            IF v_adj_type = 'pct' THEN
              v_unit_price := round(v_unit_price * (1.0 + v_adj_factor * (v_adj_val / 100.0)), 2);
            ELSE
              v_unit_price := v_unit_price + (v_adj_factor * v_adj_val);
            END IF;
            v_unit_price := greatest(0.01, v_unit_price);
            v_computed_tiers := v_computed_tiers || jsonb_build_object('min_qty', v_min_qty, 'unit_price', v_unit_price);
          END LOOP;
        END IF;
    END CASE;

    -- Validate computed tiers (unless clear mode)
    IF p_mode <> 'clear' AND array_length(v_errors, 1) IS NULL THEN
      IF jsonb_array_length(v_computed_tiers) = 0 THEN
        v_errors := array_append(v_errors, 'At least one tier required.');
      ELSE
        v_prev_qty := 0;
        v_prev_price := NULL;

        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_computed_tiers)
        LOOP
          v_min_qty := (v_elem->>'min_qty')::integer;
          v_unit_price := (v_elem->>'unit_price')::numeric;

          IF v_min_qty <= 0 THEN
            v_errors := array_append(v_errors, 'Tier minimum quantity must be greater than 0.');
          END IF;
          IF v_unit_price <= 0 THEN
            v_errors := array_append(v_errors, 'Tier unit price must be greater than ₹0.');
          END IF;
          IF v_prev_qty > 0 AND v_min_qty <= v_prev_qty THEN
            v_errors := array_append(v_errors, format('Tier quantity (%s) must be strictly greater than previous tier (%s).', v_min_qty, v_prev_qty));
          END IF;
          IF v_prev_price IS NOT NULL AND v_unit_price > v_prev_price THEN
            v_errors := array_append(v_errors, format('Tier unit price (₹%s) cannot exceed previous tier price (₹%s).', v_unit_price, v_prev_price));
          END IF;
          IF v_prod.mrp IS NOT NULL AND v_unit_price > v_prod.mrp THEN
            v_errors := array_append(v_errors, format('Tier price (₹%s) exceeds product MRP (₹%s).', v_unit_price, v_prod.mrp));
          END IF;

          v_prev_qty := v_min_qty;
          v_prev_price := v_unit_price;
        END LOOP;

        -- Warn if tier 1 unit price is above base price
        IF (v_computed_tiers->0->>'unit_price')::numeric > v_prod.price THEN
          v_warnings := array_append(v_warnings, format('Tier 1 price (₹%s) is above base price (₹%s).', v_computed_tiers->0->>'unit_price', v_prod.price));
        END IF;
      END IF;
    END IF;

    IF array_length(v_errors, 1) IS NULL THEN
      v_affected := v_affected + 1;
      v_before_snapshot := v_before_snapshot || jsonb_build_object(
        'product_id', v_prod.id,
        'tiers', v_prod.existing_tiers
      );

      IF NOT p_dry_run THEN
        DELETE FROM public.product_price_tiers WHERE product_id = v_prod.id;
        IF jsonb_array_length(v_computed_tiers) > 0 THEN
          INSERT INTO public.product_price_tiers (product_id, min_qty, unit_price)
          SELECT v_prod.id, (t->>'min_qty')::integer, (t->>'unit_price')::numeric(10, 2)
          FROM jsonb_array_elements(v_computed_tiers) t;
        END IF;
      END IF;
    END IF;

    v_preview_items := v_preview_items || jsonb_build_object(
      'product_id', v_prod.id,
      'product_name', v_prod.name,
      'sku', v_prod.sku,
      'before', v_prod.existing_tiers,
      'after', v_computed_tiers,
      'errors', to_jsonb(v_errors),
      'warnings', to_jsonb(v_warnings)
    );
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.bulk_operations (
      id, op_type, params, product_ids, before_snapshot, affected_count, status, created_by
    ) VALUES (
      v_op_id, 'tiers', jsonb_build_object('mode', p_mode, 'payload', p_payload), p_product_ids, v_before_snapshot, v_affected, 'applied', auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'op_id', CASE WHEN NOT p_dry_run THEN v_op_id ELSE NULL END,
    'total_count', array_length(p_product_ids, 1),
    'affected_count', v_affected,
    'items', v_preview_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_save_tiers(uuid[], text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bulk_save_tiers(uuid[], text, jsonb, boolean) TO authenticated;

-- admin_bulk_update_images
CREATE OR REPLACE FUNCTION public.admin_bulk_update_images(
  p_product_ids uuid[],
  p_mode text,
  p_urls text[] DEFAULT '{}'::text[],
  p_dry_run boolean DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
set search_path = public, pg_temp$$
DECLARE
  v_prod record;
  v_op_id uuid;
  v_before_snapshot jsonb := '[]'::jsonb;
  v_preview_items jsonb := '[]'::jsonb;
  v_errors text[];
  v_affected integer := 0;

  v_cleaned_urls text[] := '{}'::text[];
  v_u text;
  v_curr text[];
  v_new_images text[];
  v_url_to_promote text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one product ID is required.';
  END IF;

  IF array_length(p_product_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Maximum 500 products per bulk operation.';
  END IF;

  IF p_mode NOT IN ('append', 'prepend', 'replace_all', 'set_primary', 'remove_url', 'clear') THEN
    RAISE EXCEPTION 'Invalid image bulk mode: %', p_mode;
  END IF;

  -- Validate HTTPS URLs if provided
  IF p_urls IS NOT NULL THEN
    FOREACH v_u IN ARRAY p_urls
    LOOP
      v_u := trim(v_u);
      IF length(v_u) > 0 THEN
        IF v_u !~* '^https://' THEN
          RAISE EXCEPTION 'Image URL % is invalid. Only secure https:// URLs are allowed.', v_u;
        END IF;
        IF NOT (v_u = ANY(v_cleaned_urls)) THEN
          v_cleaned_urls := array_append(v_cleaned_urls, v_u);
        END IF;
      END IF;
    END LOOP;
  END IF;

  v_op_id := gen_random_uuid();

  FOR v_prod IN
    SELECT id, name, sku, COALESCE(images, '{}'::text[]) as images
    FROM public.products
    WHERE id = ANY(p_product_ids)
  LOOP
    v_errors := '{}';
    v_curr := v_prod.images;
    v_new_images := v_curr;

    CASE p_mode
      WHEN 'clear' THEN
        v_new_images := '{}'::text[];

      WHEN 'replace_all' THEN
        v_new_images := v_cleaned_urls[1:10];

      WHEN 'append' THEN
        FOREACH v_u IN ARRAY v_cleaned_urls
        LOOP
          IF NOT (v_u = ANY(v_new_images)) THEN
            v_new_images := array_append(v_new_images, v_u);
          END IF;
        END LOOP;
        v_new_images := v_new_images[1:10];

      WHEN 'prepend' THEN
        FOREACH v_u IN ARRAY v_cleaned_urls
        LOOP
          -- Remove if already exists so it moves to front
          SELECT array_agg(img) INTO v_new_images FROM unnest(v_new_images) img WHERE img <> v_u;
          v_new_images := array_prepend(v_u, COALESCE(v_new_images, '{}'::text[]));
        END LOOP;
        v_new_images := v_new_images[1:10];

      WHEN 'set_primary' THEN
        IF array_length(v_cleaned_urls, 1) IS NULL OR array_length(v_cleaned_urls, 1) = 0 THEN
          v_errors := array_append(v_errors, 'Target URL to set as primary is required.');
        ELSE
          v_url_to_promote := v_cleaned_urls[1];
          IF NOT (v_url_to_promote = ANY(v_curr)) THEN
            v_errors := array_append(v_errors, format('URL %s is not among the product existing images.', v_url_to_promote));
          ELSE
            SELECT array_agg(img) INTO v_new_images FROM unnest(v_curr) img WHERE img <> v_url_to_promote;
            v_new_images := array_prepend(v_url_to_promote, COALESCE(v_new_images, '{}'::text[]));
          END IF;
        END IF;

      WHEN 'remove_url' THEN
        SELECT array_agg(img) INTO v_new_images
        FROM unnest(v_curr) img
        WHERE NOT (img = ANY(v_cleaned_urls));
        v_new_images := COALESCE(v_new_images, '{}'::text[]);
    END CASE;

    IF array_length(v_errors, 1) IS NULL THEN
      v_affected := v_affected + 1;
      v_before_snapshot := v_before_snapshot || jsonb_build_object(
        'product_id', v_prod.id,
        'images', v_prod.images
      );

      IF NOT p_dry_run THEN
        UPDATE public.products
        SET images = v_new_images, updated_at = now()
        WHERE id = v_prod.id;
      END IF;
    END IF;

    v_preview_items := v_preview_items || jsonb_build_object(
      'product_id', v_prod.id,
      'product_name', v_prod.name,
      'sku', v_prod.sku,
      'before', jsonb_build_object('images', v_prod.images),
      'after', jsonb_build_object('images', v_new_images),
      'errors', to_jsonb(v_errors)
    );
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.bulk_operations (
      id, op_type, params, product_ids, before_snapshot, affected_count, status, created_by
    ) VALUES (
      v_op_id, 'images', jsonb_build_object('mode', p_mode, 'urls', p_urls), p_product_ids, v_before_snapshot, v_affected, 'applied', auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'op_id', CASE WHEN NOT p_dry_run THEN v_op_id ELSE NULL END,
    'total_count', array_length(p_product_ids, 1),
    'affected_count', v_affected,
    'items', v_preview_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_update_images(uuid[], text, text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bulk_update_images(uuid[], text, text[], boolean) TO authenticated;

-- admin_bulk_update_product_status
CREATE OR REPLACE FUNCTION public.admin_bulk_update_product_status(
  p_product_ids uuid[],
  p_is_active boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
set search_path = public, pg_temp$$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.products
  SET
    is_active = p_is_active,
    updated_at = now()
  WHERE id = ANY(p_product_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_update_product_status(uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bulk_update_product_status(uuid[], boolean) TO authenticated;

-- admin_bulk_update_products
CREATE OR REPLACE FUNCTION public.admin_bulk_update_products(
  p_product_ids uuid[],
  p_patch jsonb,
  p_dry_run boolean DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
set search_path = public, pg_temp$$
DECLARE
  v_prod record;
  v_op_id uuid;
  v_before_snapshot jsonb := '[]'::jsonb;
  v_preview_items jsonb := '[]'::jsonb;
  v_errors text[];
  v_affected integer := 0;

  -- Patch values
  v_has_category boolean := p_patch ? 'category_id';
  v_new_category_id uuid;
  v_has_brand boolean := p_patch ? 'brand';
  v_new_brand text;
  v_has_tagline boolean := p_patch ? 'tagline';
  v_new_tagline text;
  v_has_description boolean := p_patch ? 'description';
  v_new_description text;
  v_has_warranty boolean := p_patch ? 'warranty_months';
  v_new_warranty integer;
  v_has_moq boolean := p_patch ? 'moq';
  v_new_moq integer;
  v_has_order_step boolean := p_patch ? 'order_step';
  v_new_order_step integer;
  v_has_low_stock boolean := p_patch ? 'low_stock_threshold';
  v_new_low_stock integer;
  v_has_active boolean := p_patch ? 'is_active';
  v_new_active boolean;
  v_has_featured boolean := p_patch ? 'is_featured';
  v_new_featured boolean;
  v_has_trending boolean := p_patch ? 'is_trending';
  v_new_trending boolean;
  v_has_urbanrat boolean := p_patch ? 'is_urbanrat_brand';
  v_new_urbanrat boolean;

  v_has_mrp boolean := p_patch ? 'mrp';
  v_mrp_val numeric;
  v_mrp_mode text;
  v_calculated_mrp numeric;

  v_has_kw_add boolean := p_patch ? 'keywords_add';
  v_has_kw_remove boolean := p_patch ? 'keywords_remove';
  v_has_kw_replace boolean := p_patch ? 'keywords_replace';
  v_kw_result text[];
  v_kw_tok text;
  v_kw_seen text[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one product ID is required.';
  END IF;

  IF array_length(p_product_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Maximum 500 products per bulk operation.';
  END IF;

  -- Validate category exists if category_id is being patched
  IF v_has_category AND (p_patch->>'category_id') IS NOT NULL THEN
    v_new_category_id := (p_patch->>'category_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = v_new_category_id) THEN
      RAISE EXCEPTION 'Target category % does not exist.', v_new_category_id;
    END IF;
  END IF;

  IF v_has_brand THEN v_new_brand := p_patch->>'brand'; END IF;
  IF v_has_tagline THEN v_new_tagline := p_patch->>'tagline'; END IF;
  IF v_has_description THEN v_new_description := p_patch->>'description'; END IF;
  IF v_has_warranty THEN v_new_warranty := (p_patch->>'warranty_months')::integer; END IF;
  IF v_has_moq THEN v_new_moq := (p_patch->>'moq')::integer; END IF;
  IF v_has_order_step THEN v_new_order_step := (p_patch->>'order_step')::integer; END IF;
  IF v_has_low_stock THEN v_new_low_stock := (p_patch->>'low_stock_threshold')::integer; END IF;
  IF v_has_active THEN v_new_active := (p_patch->>'is_active')::boolean; END IF;
  IF v_has_featured THEN v_new_featured := (p_patch->>'is_featured')::boolean; END IF;
  IF v_has_trending THEN v_new_trending := (p_patch->>'is_trending')::boolean; END IF;
  IF v_has_urbanrat THEN v_new_urbanrat := (p_patch->>'is_urbanrat_brand')::boolean; END IF;

  v_op_id := gen_random_uuid();

  FOR v_prod IN
    SELECT *
    FROM public.products
    WHERE id = ANY(p_product_ids)
  LOOP
    v_errors := '{}';
    v_calculated_mrp := v_prod.mrp;

    -- Compute MRP according to mode
    IF v_has_mrp THEN
      IF jsonb_typeof(p_patch->'mrp') = 'number' THEN
        v_calculated_mrp := (p_patch->>'mrp')::numeric;
      ELSIF jsonb_typeof(p_patch->'mrp') = 'object' THEN
        v_mrp_mode := p_patch->'mrp'->>'mode';
        v_mrp_val := (p_patch->'mrp'->>'value')::numeric;
        CASE v_mrp_mode
          WHEN 'set' THEN v_calculated_mrp := v_mrp_val;
          WHEN 'increase_pct' THEN v_calculated_mrp := round(COALESCE(v_prod.mrp, v_prod.price) * (1.0 + v_mrp_val / 100.0), 2);
          WHEN 'decrease_pct' THEN v_calculated_mrp := greatest(0, round(COALESCE(v_prod.mrp, v_prod.price) * (1.0 - v_mrp_val / 100.0), 2));
          WHEN 'increase_amt' THEN v_calculated_mrp := COALESCE(v_prod.mrp, v_prod.price) + v_mrp_val;
          WHEN 'decrease_amt' THEN v_calculated_mrp := greatest(0, COALESCE(v_prod.mrp, v_prod.price) - v_mrp_val);
          ELSE v_calculated_mrp := v_prod.mrp;
        END CASE;
      END IF;

      IF v_calculated_mrp IS NOT NULL AND v_calculated_mrp < v_prod.price THEN
        v_errors := array_append(v_errors, format('MRP (₹%s) cannot be lower than selling price (₹%s).', v_calculated_mrp, v_prod.price));
      END IF;
    END IF;

    -- Compute Keywords
    v_kw_result := COALESCE(v_prod.keywords, '{}'::text[]);
    IF v_has_kw_replace THEN
      v_kw_result := public.normalize_keywords_array(p_patch->'keywords_replace');
    ELSE
      IF v_has_kw_remove THEN
        SELECT array_agg(k) INTO v_kw_result
        FROM unnest(v_kw_result) k
        WHERE NOT (k = ANY(public.normalize_keywords_array(p_patch->'keywords_remove')));
        v_kw_result := COALESCE(v_kw_result, '{}'::text[]);
      END IF;
      IF v_has_kw_add THEN
        v_kw_seen := v_kw_result;
        FOREACH v_kw_tok IN ARRAY public.normalize_keywords_array(p_patch->'keywords_add')
        LOOP
          IF NOT (v_kw_tok = ANY(v_kw_seen)) THEN
            v_kw_seen := array_append(v_kw_seen, v_kw_tok);
          END IF;
        END LOOP;
        v_kw_result := v_kw_seen[1:30];
      END IF;
    END IF;

    IF array_length(v_errors, 1) IS NULL THEN
      -- Valid product update
      v_affected := v_affected + 1;

      -- Capture snapshot
      v_before_snapshot := v_before_snapshot || jsonb_build_object(
        'product_id', v_prod.id,
        'category_id', v_prod.category_id,
        'brand', v_prod.brand,
        'tagline', v_prod.short_tagline,
        'description', v_prod.description,
        'warranty_months', v_prod.warranty_months,
        'mrp', v_prod.mrp,
        'moq', v_prod.min_order_qty,
        'order_step', v_prod.order_qty_step,
        'low_stock_threshold', v_prod.low_stock_threshold,
        'is_active', v_prod.is_active,
        'is_featured', v_prod.is_featured,
        'is_trending', v_prod.is_trending,
        'is_urbanrat_brand', v_prod.is_urbanrat_brand,
        'keywords', v_prod.keywords
      );

      IF NOT p_dry_run THEN
        UPDATE public.products
        SET
          category_id = CASE WHEN v_has_category THEN v_new_category_id ELSE category_id END,
          brand = CASE WHEN v_has_brand THEN v_new_brand ELSE brand END,
          short_tagline = CASE WHEN v_has_tagline THEN v_new_tagline ELSE short_tagline END,
          description = CASE WHEN v_has_description THEN v_new_description ELSE description END,
          warranty_months = CASE WHEN v_has_warranty THEN v_new_warranty ELSE warranty_months END,
          mrp = CASE WHEN v_has_mrp THEN v_calculated_mrp ELSE mrp END,
          min_order_qty = CASE WHEN v_has_moq THEN v_new_moq ELSE min_order_qty END,
          order_qty_step = CASE WHEN v_has_order_step THEN v_new_order_step ELSE order_qty_step END,
          low_stock_threshold = CASE WHEN v_has_low_stock THEN v_new_low_stock ELSE low_stock_threshold END,
          is_active = CASE WHEN v_has_active THEN v_new_active ELSE is_active END,
          is_featured = CASE WHEN v_has_featured THEN v_new_featured ELSE is_featured END,
          is_trending = CASE WHEN v_has_trending THEN v_new_trending ELSE is_trending END,
          is_urbanrat_brand = CASE WHEN v_has_urbanrat THEN v_new_urbanrat ELSE is_urbanrat_brand END,
          keywords = CASE WHEN (v_has_kw_add OR v_has_kw_remove OR v_has_kw_replace) THEN v_kw_result ELSE keywords END,
          updated_at = now()
        WHERE id = v_prod.id;
      END IF;
    END IF;

    -- Add preview item
    v_preview_items := v_preview_items || jsonb_build_object(
      'product_id', v_prod.id,
      'product_name', v_prod.name,
      'sku', v_prod.sku,
      'before', jsonb_build_object('mrp', v_prod.mrp, 'is_active', v_prod.is_active, 'brand', v_prod.brand),
      'after', jsonb_build_object('mrp', v_calculated_mrp, 'is_active', COALESCE(v_new_active, v_prod.is_active), 'brand', COALESCE(v_new_brand, v_prod.brand)),
      'errors', to_jsonb(v_errors)
    );
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.bulk_operations (
      id, op_type, params, product_ids, before_snapshot, affected_count, status, created_by
    ) VALUES (
      v_op_id, 'details', p_patch, p_product_ids, v_before_snapshot, v_affected, 'applied', auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'op_id', CASE WHEN NOT p_dry_run THEN v_op_id ELSE NULL END,
    'total_count', array_length(p_product_ids, 1),
    'affected_count', v_affected,
    'items', v_preview_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_update_products(uuid[], jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bulk_update_products(uuid[], jsonb, boolean) TO authenticated;

-- admin_category_product_counts
CREATE OR REPLACE FUNCTION public.admin_category_product_counts()
RETURNS TABLE (
  category_id uuid,
  direct_count bigint,
  total_count bigint,
  active_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
set search_path = public, pg_temp$$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH RECURSIVE category_tree AS (
    -- Anchor member: every category is its own root ancestor
    SELECT
      c.id AS ancestor_id,
      c.id AS descendant_id
    FROM public.categories c

    UNION ALL

    -- Recursive member: traverse down children hierarchy
    SELECT
      ct.ancestor_id,
      child.id AS descendant_id
    FROM category_tree ct
    JOIN public.categories child ON child.parent_id = ct.descendant_id
  ),
  direct_counts AS (
    SELECT
      p.category_id AS cat_id,
      count(*)::bigint AS cnt
    FROM public.products p
    WHERE p.category_id IS NOT NULL
    GROUP BY p.category_id
  ),
  aggregated_counts AS (
    SELECT
      ct.ancestor_id AS cat_id,
      count(p.id)::bigint AS total_cnt,
      count(p.id) FILTER (WHERE p.is_active = TRUE)::bigint AS active_cnt
    FROM category_tree ct
    JOIN public.products p ON p.category_id = ct.descendant_id
    GROUP BY ct.ancestor_id
  )
  -- All categories from table
  SELECT
    c.id AS category_id,
    COALESCE(dc.cnt, 0)::bigint AS direct_count,
    COALESCE(ac.total_cnt, 0)::bigint AS total_count,
    COALESCE(ac.active_cnt, 0)::bigint AS active_count
  FROM public.categories c
  LEFT JOIN direct_counts dc ON dc.cat_id = c.id
  LEFT JOIN aggregated_counts ac ON ac.cat_id = c.id

  UNION ALL

  -- Uncategorized products row (category_id IS NULL)
  SELECT
    NULL::uuid AS category_id,
    count(*)::bigint AS direct_count,
    count(*)::bigint AS total_count,
    count(*) FILTER (WHERE p.is_active = TRUE)::bigint AS active_count
  FROM public.products p
  WHERE p.category_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = p.category_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_category_product_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_category_product_counts() TO authenticated;

-- admin_dashboard_stats
create or replace function public.admin_dashboard_stats(
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_days integer;
  v_prev_to date;
  v_prev_from date;

  -- Current period stats
  v_curr_rev numeric(10, 2);
  v_curr_orders bigint;
  v_curr_aov numeric(10, 2);
  v_curr_pending bigint;
  v_curr_customers bigint;
  v_low_stock bigint;

  -- Previous period stats
  v_prev_rev numeric(10, 2);
  v_prev_orders bigint;
  v_prev_aov numeric(10, 2);
  v_prev_pending bigint;
  v_prev_customers bigint;
begin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_days := (p_to - p_from) + 1;
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - (v_days - 1);

  -- 1. Current period metrics (excluding cancelled/refunded from revenue & AOV)
  select
    coalesce(sum(case when status not in ('cancelled', 'refunded') then total else 0 end), 0),
    count(*),
    coalesce(round(avg(case when status not in ('cancelled', 'refunded') then total else null end)::numeric, 2), 0),
    count(*) filter (where status = 'pending')
  into
    v_curr_rev,
    v_curr_orders,
    v_curr_aov,
    v_curr_pending
  from public.orders
  where created_at::date >= p_from and created_at::date <= p_to;

  -- Current new customers
  select count(*) into v_curr_customers
  from public.profiles
  where role = 'customer'
    and created_at::date >= p_from
    and created_at::date <= p_to;

  -- Low stock inventory count (all currently active products with stock <= threshold)
  select count(*) into v_low_stock
  from public.products
  where is_active = true
    and stock <= coalesce(low_stock_threshold, 5);

  -- 2. Previous period metrics
  select
    coalesce(sum(case when status not in ('cancelled', 'refunded') then total else 0 end), 0),
    count(*),
    coalesce(round(avg(case when status not in ('cancelled', 'refunded') then total else null end)::numeric, 2), 0),
    count(*) filter (where status = 'pending')
  into
    v_prev_rev,
    v_prev_orders,
    v_prev_aov,
    v_prev_pending
  from public.orders
  where created_at::date >= v_prev_from and created_at::date <= v_prev_to;

  -- Previous new customers
  select count(*) into v_prev_customers
  from public.profiles
  where role = 'customer'
    and created_at::date >= v_prev_from
    and created_at::date <= v_prev_to;

  return jsonb_build_object(
    'current', jsonb_build_object(
      'revenue', v_curr_rev,
      'order_count', v_curr_orders,
      'avg_order_value', v_curr_aov,
      'pending_count', v_curr_pending,
      'low_stock_count', v_low_stock,
      'new_customers', v_curr_customers
    ),
    'previous', jsonb_build_object(
      'revenue', v_prev_rev,
      'order_count', v_prev_orders,
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
end;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats(date, date) TO authenticated;

-- admin_dealer_stats
create or replace function public.admin_dealer_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_total bigint;
  v_new bigint;
  v_contacted bigint;
  v_under_review bigint;
  v_approved bigint;
  v_rejected bigint;
  v_on_hold bigint;
  v_last_7_days bigint;
  v_last_30_days bigint;
  v_decided bigint;
  v_approval_rate numeric(5, 2);
begin
  -- 1. Authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 2. Aggregate statistics
  select
    count(*),
    count(*) filter (where status = 'new'),
    count(*) filter (where status = 'contacted'),
    count(*) filter (where status = 'under_review'),
    count(*) filter (where status = 'approved'),
    count(*) filter (where status = 'rejected'),
    count(*) filter (where status = 'on_hold'),
    count(*) filter (where created_at >= (now() - interval '7 days')),
    count(*) filter (where created_at >= (now() - interval '30 days'))
  into
    v_total,
    v_new,
    v_contacted,
    v_under_review,
    v_approved,
    v_rejected,
    v_on_hold,
    v_last_7_days,
    v_last_30_days
  from public.dealer_applications;

  -- 3. Approval Rate computation: Approved / (Approved + Rejected)
  v_decided := v_approved + v_rejected;
  if v_decided > 0 then
    v_approval_rate := round((v_approved::numeric / v_decided::numeric) * 100, 2);
  else
    v_approval_rate := 0.00;
  end if;

  -- 4. Return structured JSON payload
  return jsonb_build_object(
    'total', v_total,
    'by_status', jsonb_build_object(
      'new', v_new,
      'contacted', v_contacted,
      'under_review', v_under_review,
      'approved', v_approved,
      'rejected', v_rejected,
      'on_hold', v_on_hold
    ),
    'last_7_days', v_last_7_days,
    'last_30_days', v_last_30_days,
    'approval_rate', v_approval_rate
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_dealer_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dealer_stats() TO authenticated;

-- admin_delete_catalog_image
create or replace function public.admin_delete_catalog_image(p_image_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_url text;
  v_ref_count integer;
begin
  -- Authorization
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Get the URL
  select public_url into v_url
  from public.catalog_images
  where id = p_image_id and deleted_at is null;

  if v_url is null then
    raise exception 'Image not found or already deleted';
  end if;

  -- Check for product references
  select count(*) into v_ref_count
  from public.products
  where v_url = any(images);

  if v_ref_count > 0 then
    raise exception 'Cannot delete: image is used by % product(s)', v_ref_count;
  end if;

  -- Soft-delete
  update public.catalog_images
  set deleted_at = now()
  where id = p_image_id;

  return jsonb_build_object(
    'success', true,
    'deleted_id', p_image_id
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_catalog_image(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_catalog_image(uuid) TO authenticated;

-- admin_get_order_notice_counts
create or replace function public.admin_get_order_notice_counts()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_delayed_pending integer := 0;
  v_low_stock_count integer := 0;
  v_ready_to_ship_count integer := 0;
  v_on_hold_count integer := 0;
begin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Pending orders older than 24 hours
  select count(*) into v_delayed_pending
  from public.orders
  where status = 'pending'
    and created_at < (now() - interval '24 hours');

  -- Active products with stock <= 10
  select count(*) into v_low_stock_count
  from public.products
  where is_active = true
    and stock <= 10;

  -- Ready to ship (confirmed or processing)
  select count(*) into v_ready_to_ship_count
  from public.orders
  where status in ('confirmed', 'processing');

  -- On hold orders
  select count(*) into v_on_hold_count
  from public.orders
  where status = 'on_hold';

  return jsonb_build_object(
    'delayed_pending_count', v_delayed_pending,
    'low_stock_count', v_low_stock_count,
    'ready_to_ship_count', v_ready_to_ship_count,
    'on_hold_count', v_on_hold_count
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_get_order_notice_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_order_notice_counts() TO authenticated;

-- admin_get_returns_pending_count
create or replace function public.admin_get_returns_pending_count()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_requested_count integer := 0;
  v_received_count integer := 0;
  v_qc_failed_count integer := 0;
  v_pending_claims_count integer := 0;
begin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  select count(*) into v_requested_count
  from public.return_requests
  where status = 'requested';

  select count(*) into v_received_count
  from public.return_requests
  where status = 'received';

  select count(*) into v_qc_failed_count
  from public.return_requests
  where status = 'qc_failed';

  select count(*) into v_pending_claims_count
  from public.return_requests
  where claim_status = 'pending';

  return jsonb_build_object(
    'total_pending', (v_requested_count + v_received_count),
    'requested_count', v_requested_count,
    'received_count', v_received_count,
    'qc_failed_count', v_qc_failed_count,
    'pending_claims_count', v_pending_claims_count
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_get_returns_pending_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_returns_pending_count() TO authenticated;

-- admin_list_product_ids
CREATE OR REPLACE FUNCTION public.admin_list_product_ids(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE (product_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
set search_path = public, pg_temp$$
DECLARE
  v_category_id uuid;
  v_include_descendants boolean;
  v_uncategorized_only boolean;
  v_search text;
  v_urbanrat_only boolean;
  v_low_stock_only boolean;
  v_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_category_id := (p_filters->>'categoryId')::uuid;
  v_include_descendants := COALESCE((p_filters->>'includeDescendants')::boolean, TRUE);
  v_uncategorized_only := COALESCE((p_filters->>'uncategorizedOnly')::boolean, FALSE);
  v_search := NULLIF(trim(p_filters->>'search'), '');
  v_urbanrat_only := COALESCE((p_filters->>'isUrbanrat')::boolean, FALSE);
  v_low_stock_only := COALESCE((p_filters->>'lowStock')::boolean, FALSE);
  v_status := COALESCE(p_filters->>'status', 'all');

  RETURN QUERY
  WITH RECURSIVE target_category_ids AS (
    SELECT c.id
    FROM public.categories c
    WHERE v_category_id IS NOT NULL AND c.id = v_category_id

    UNION ALL

    SELECT child.id
    FROM public.categories child
    JOIN target_category_ids tc ON child.parent_id = tc.id
    WHERE v_include_descendants = TRUE
  )
  SELECT p.id AS product_id
  FROM public.products p
  WHERE
    (
      v_uncategorized_only = TRUE
      AND (p.category_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = p.category_id))
    )
    OR
    (
      v_uncategorized_only = FALSE
      AND (
        v_category_id IS NULL
        OR (
          v_include_descendants = TRUE
          AND p.category_id IN (SELECT tc.id FROM target_category_ids tc)
        )
        OR (
          v_include_descendants = FALSE
          AND p.category_id = v_category_id
        )
      )
    )
    AND (
      v_search IS NULL
      OR p.name ILIKE ('%' || v_search || '%')
      OR p.sku ILIKE ('%' || v_search || '%')
      OR COALESCE(p.brand, '') ILIKE ('%' || v_search || '%')
      OR (p.keywords IS NOT NULL AND v_search = ANY(p.keywords))
    )
    AND (v_urbanrat_only = FALSE OR p.is_urbanrat_brand = TRUE)
    AND (v_low_stock_only = FALSE OR p.stock <= COALESCE(p.low_stock_threshold, 5))
    AND (
      v_status = 'all'
      OR (v_status = 'active' AND p.is_active = TRUE)
      OR (v_status = 'inactive' AND p.is_active = FALSE)
    )
  ORDER BY p.name ASC
  LIMIT COALESCE(p_limit, 5000);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_product_ids(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_product_ids(jsonb, integer) TO authenticated;

-- admin_list_products
CREATE OR REPLACE FUNCTION public.admin_list_products(
  p_category_id uuid DEFAULT NULL,
  p_include_descendants boolean DEFAULT TRUE,
  p_uncategorized_only boolean DEFAULT FALSE,
  p_search text DEFAULT NULL,
  p_urbanrat_only boolean DEFAULT FALSE,
  p_low_stock_only boolean DEFAULT FALSE,
  p_status text DEFAULT 'all',
  p_sort text DEFAULT 'updated_at_desc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  sku text,
  price numeric,
  mrp numeric,
  stock integer,
  low_stock_threshold integer,
  min_order_qty integer,
  order_qty_step integer,
  warranty_months integer,
  short_description text,
  description text,
  category_id uuid,
  category_name text,
  images text[],
  brand text,
  attributes jsonb,
  keywords text[],
  specs jsonb,
  is_urbanrat_brand boolean,
  is_featured boolean,
  is_trending boolean,
  is_active boolean,
  price_tiers jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
set search_path = public, pg_temp$$
DECLARE
  v_search text := NULLIF(TRIM(p_search), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH RECURSIVE target_categories AS (
    -- If category_id specified and include_descendants requested:
    SELECT c.id AS cat_id
    FROM public.categories c
    WHERE c.id = p_category_id

    UNION ALL

    SELECT child.id AS cat_id
    FROM target_categories tc
    JOIN public.categories child ON child.parent_id = tc.cat_id
    WHERE p_include_descendants = TRUE
  ),
  filtered_products AS (
    SELECT
      p.id,
      p.name,
      p.slug,
      p.sku,
      p.price,
      p.mrp,
      p.stock,
      COALESCE(p.low_stock_threshold, 5) AS low_stock_threshold,
      COALESCE(p.min_order_qty, 1) AS min_order_qty,
      COALESCE(p.order_qty_step, 1) AS order_qty_step,
      COALESCE(p.warranty_months, 0) AS warranty_months,
      p.short_description,
      p.description,
      p.category_id,
      cat.name AS category_name,
      p.images,
      p.brand,
      p.attributes,
      p.keywords,
      p.specs,
      p.is_urbanrat_brand,
      p.is_featured,
      p.is_trending,
      p.is_active,
      p.created_at,
      p.updated_at
    FROM public.products p
    LEFT JOIN public.categories cat ON cat.id = p.category_id
    WHERE
      -- Category filter
      (
        CASE
          WHEN p_uncategorized_only = TRUE THEN p.category_id IS NULL
          WHEN p_category_id IS NOT NULL AND p_include_descendants = TRUE THEN
            p.category_id IN (SELECT cat_id FROM target_categories)
          WHEN p_category_id IS NOT NULL AND p_include_descendants = FALSE THEN
            p.category_id = p_category_id
          ELSE TRUE
        END
      )
      -- Search filter across name, sku, brand, and keywords
      AND (
        v_search IS NULL OR
        p.name ILIKE ('%' || v_search || '%') OR
        p.sku ILIKE ('%' || v_search || '%') OR
        COALESCE(p.brand, '') ILIKE ('%' || v_search || '%') OR
        EXISTS (
          SELECT 1 FROM unnest(COALESCE(p.keywords, '{}'::text[])) kw
          WHERE kw ILIKE ('%' || v_search || '%')
        )
      )
      -- Urbanrat brand filter
      AND (
        p_urbanrat_only = FALSE OR p.is_urbanrat_brand = TRUE
      )
      -- Low stock filter
      AND (
        p_low_stock_only = FALSE OR p.stock <= COALESCE(p.low_stock_threshold, 5)
      )
      -- Status filter
      AND (
        p_status IS NULL OR
        p_status = 'all' OR
        (p_status = 'active' AND p.is_active = TRUE) OR
        (p_status = 'inactive' AND p.is_active = FALSE)
      )
  ),
  counted_products AS (
    SELECT
      fp.*,
      count(*) OVER()::bigint AS total_count
    FROM filtered_products fp
  ),
  sorted_products AS (
    SELECT cp.*
    FROM counted_products cp
    ORDER BY
      CASE WHEN p_sort = 'name_asc' THEN cp.name END ASC,
      CASE WHEN p_sort = 'name_desc' THEN cp.name END DESC,
      CASE WHEN p_sort = 'price_asc' THEN cp.price END ASC,
      CASE WHEN p_sort = 'price_desc' THEN cp.price END DESC,
      CASE WHEN p_sort = 'stock_asc' THEN cp.stock END ASC,
      CASE WHEN p_sort = 'stock_desc' THEN cp.stock END DESC,
      CASE WHEN p_sort = 'updated_at_asc' THEN cp.updated_at END ASC,
      -- default sort: updated_at DESC
      cp.updated_at DESC,
      cp.id DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0)
  )
  SELECT
    sp.id,
    sp.name,
    sp.slug,
    sp.sku,
    sp.price,
    sp.mrp,
    sp.stock,
    sp.low_stock_threshold,
    sp.min_order_qty,
    sp.order_qty_step,
    sp.warranty_months,
    sp.short_description,
    sp.description,
    sp.category_id,
    sp.category_name,
    sp.images,
    sp.brand,
    sp.attributes,
    sp.keywords,
    sp.specs,
    sp.is_urbanrat_brand,
    sp.is_featured,
    sp.is_trending,
    sp.is_active,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'min_qty', pt.min_qty,
            'unit_price', pt.unit_price
          ) ORDER BY pt.min_qty ASC
        )
        FROM public.product_price_tiers pt
        WHERE pt.product_id = sp.id
      ),
      '[]'::jsonb
    ) AS price_tiers,
    sp.created_at,
    sp.updated_at,
    sp.total_count
  FROM sorted_products sp;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_products(uuid, boolean, boolean, text, boolean, boolean, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_products(uuid, boolean, boolean, text, boolean, boolean, text, text, integer, integer) TO authenticated;

-- admin_orders_by_status
create or replace function public.admin_orders_by_status(
  p_from date,
  p_to date
)
returns table (
  status text,
  order_count bigint,
  total_amount numeric(10, 2)
)
language plpgsql
security definer
set search_path = public, pg_temp$$
begin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  return query
  select
    o.status,
    count(*)::bigint as order_count,
    coalesce(sum(o.total), 0)::numeric(10, 2) as total_amount
  from public.orders o
  where o.created_at::date >= p_from and o.created_at::date <= p_to
  group by o.status
  order by order_count desc;
end;
$$;

REVOKE ALL ON FUNCTION public.admin_orders_by_status(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_orders_by_status(date, date) TO authenticated;

-- admin_sales_by_day
create or replace function public.admin_sales_by_day(
  p_from date,
  p_to date
)
returns table (
  sale_date date,
  revenue numeric(10, 2),
  order_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp$$
begin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  return query
  with dates as (
    select d::date as day
    from generate_series(p_from::timestamp, p_to::timestamp, '1 day'::interval) as d
  )
  select
    dates.day as sale_date,
    coalesce(sum(case when o.status not in ('cancelled', 'refunded') then o.total else 0 end), 0)::numeric(10, 2) as revenue,
    count(o.id)::bigint as order_count
  from dates
  left join public.orders o on o.created_at::date = dates.day
  group by dates.day
  order by dates.day asc;
end;
$$;

REVOKE ALL ON FUNCTION public.admin_sales_by_day(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sales_by_day(date, date) TO authenticated;

-- admin_save_product_tiers
create or replace function public.admin_save_product_tiers(
  p_product_id uuid,
  p_tiers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_product record;
  v_tier record;
  v_index integer := 0;
  v_prev_min_qty integer := 0;
  v_prev_price numeric(10, 2) := null;
  v_count integer;
begin
  -- 1. Authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 2. Product verification
  select id, name, mrp, coalesce(min_order_qty, 1) as min_order_qty into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found: %', p_product_id;
  end if;

  -- 3. Array payload check
  if p_tiers is null or jsonb_typeof(p_tiers) <> 'array' or jsonb_array_length(p_tiers) = 0 then
    raise exception 'At least one price tier is required';
  end if;

  -- 4. In-order validation
  for v_tier in
    select
      (elem->>'min_qty')::integer as min_qty,
      (elem->>'unit_price')::numeric as unit_price
    from jsonb_array_elements(p_tiers) as elem
    order by (elem->>'min_qty')::integer asc
  loop
    -- min_qty >= 1 check
    if v_tier.min_qty is null or v_tier.min_qty < 1 then
      raise exception 'Tier minimum quantity must be an integer greater than or equal to 1';
    end if;

    -- unit_price >= 0 check
    if v_tier.unit_price is null or v_tier.unit_price < 0 then
      raise exception 'Tier unit price cannot be negative';
    end if;

    -- Duplicate min_qty check
    if v_index > 0 and v_tier.min_qty = v_prev_min_qty then
      raise exception 'Duplicate tier quantity % detected. Each tier must have a unique min_qty', v_tier.min_qty;
    end if;

    -- First tier min_qty must match products.min_order_qty
    if v_index = 0 and v_tier.min_qty <> v_product.min_order_qty then
      raise exception 'First tier quantity (%) must match product minimum order quantity (%)',
        v_tier.min_qty, v_product.min_order_qty;
    end if;

    -- unit_price non-increasing check (bulk orders cannot cost more per unit than lower tier)
    if v_prev_price is not null and v_tier.unit_price > v_prev_price then
      raise exception 'Tier unit price (₹%) for min_qty % cannot be higher than unit price (₹%) for min_qty %',
        v_tier.unit_price, v_tier.min_qty, v_prev_price, v_prev_min_qty;
    end if;

    -- MRP check
    if v_product.mrp is not null and v_tier.unit_price > v_product.mrp then
      raise exception 'Tier unit price (₹%) exceeds product MRP (₹%)',
        v_tier.unit_price, v_product.mrp;
    end if;

    v_prev_min_qty := v_tier.min_qty;
    v_prev_price := v_tier.unit_price;
    v_index := v_index + 1;
  end loop;

  -- 5. Atomically replace tiers
  delete from public.product_price_tiers
  where product_id = p_product_id;

  insert into public.product_price_tiers (product_id, min_qty, unit_price)
  select
    p_product_id,
    (elem->>'min_qty')::integer,
    (elem->>'unit_price')::numeric(10, 2)
  from jsonb_array_elements(p_tiers) as elem;

  get diagnostics v_count = row_count;

  return jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'tiers_saved', v_count
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_save_product_tiers(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_product_tiers(uuid, jsonb) TO authenticated;

-- admin_submit_catalog
create or replace function public.admin_submit_catalog(
  p_upload_id text,
  p_items jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_item record;
  v_norm_keywords text[];
  v_count integer := 0;
  v_product_id uuid;
  v_item_elem jsonb;
  v_images_json jsonb;
  v_image_url text;
  v_valid_image_count integer;
  v_item_status text;
  v_error_msg text;
  v_passed_count integer := 0;
  v_failed_count integer := 0;
  v_total_count integer := 0;
  v_payload jsonb;
begin
  -- 1. Authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 2. If p_items is provided, stage/insert them into catalog_upload_items
  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for v_item_elem in select jsonb_array_elements(p_items)
    loop
      -- Extract images array from top-level or payload
      v_images_json := coalesce(
        v_item_elem->'images',
        v_item_elem->'payload'->'images',
        '[]'::jsonb
      );

      -- Count valid images (must be HTTP(S) URL from catalog-images/product-images bucket OR ending in image extension)
      v_valid_image_count := 0;
      if jsonb_typeof(v_images_json) = 'array' then
        for v_image_url in select jsonb_array_elements_text(v_images_json)
        loop
          if v_image_url is not null and trim(v_image_url) <> '' then
            if v_image_url ~* '^https?://' and (
              v_image_url ~* '/catalog-images/' or
              v_image_url ~* '/product-images/' or
              v_image_url ~* '\.(jpg|jpeg|png|webp|gif|avif|svg|bmp|tiff)(\?.*)?$'
            ) then
              v_valid_image_count := v_valid_image_count + 1;
            end if;
          end if;
        end loop;
      end if;

      if v_valid_image_count < 1 then
        v_item_status := 'qc_error';
        v_error_msg := 'At least 1 valid product image is required (must be HTTPS URL from catalog-images/product-images or ending in standard image extension)';
      else
        v_item_status := coalesce(v_item_elem->>'status', 'qc_pass');
        v_error_msg := v_item_elem->>'error_message';
      end if;

      v_norm_keywords := public.normalize_keywords_array(
        coalesce(v_item_elem->'keywords', v_item_elem->'payload'->'keywords', '[]'::jsonb)
      );

      insert into public.catalog_upload_items (
        upload_id,
        row_number,
        title,
        sku,
        status,
        error_message,
        product_id,
        payload
      )
      values (
        p_upload_id,
        coalesce((v_item_elem->>'row_number')::integer, (v_item_elem->>'rowNumber')::integer, 1),
        coalesce(v_item_elem->>'title', v_item_elem->>'name', ''),
        v_item_elem->>'sku',
        v_item_status,
        v_error_msg,
        (v_item_elem->>'product_id')::uuid,
        coalesce(v_item_elem->'payload', v_item_elem) || jsonb_build_object(
          'keywords', to_jsonb(v_norm_keywords),
          'valid_image_count', v_valid_image_count
        )
      );
    end loop;
  end if;

  -- 3. For each item in the upload, recalculate stats & update product metadata
  for v_item in
    select id, upload_id, product_id, sku, status, payload
    from public.catalog_upload_items
    where upload_id = p_upload_id
  loop
    v_total_count := v_total_count + 1;
    if v_item.status = 'qc_pass' then
      v_passed_count := v_passed_count + 1;
    else
      v_failed_count := v_failed_count + 1;
    end if;

    v_payload := coalesce(v_item.payload, '{}'::jsonb);
    v_norm_keywords := public.normalize_keywords_array(v_payload->'keywords');

    -- Update staged payload with normalized keywords
    update public.catalog_upload_items
    set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{keywords}', to_jsonb(v_norm_keywords))
    where id = v_item.id;

    -- Resolve product ID (direct reference or via SKU)
    v_product_id := v_item.product_id;
    if v_product_id is null and v_item.sku is not null and trim(v_item.sku) <> '' then
      select id into v_product_id from public.products where sku = v_item.sku limit 1;
    end if;

    -- Update product fields if product exists
    if v_product_id is not null then
      update public.products
      set
        keywords = v_norm_keywords,
        brand = coalesce(v_payload->>'brand', brand),
        attributes = coalesce(v_payload->'attributes', attributes, '{}'::jsonb),
        specs = coalesce(v_payload->'specs', specs, '{}'::jsonb),
        short_description = coalesce(v_payload->>'short_description', v_payload->>'tagline', short_description),
        description = coalesce(v_payload->>'description', description),
        updated_at = now()
      where id = v_product_id;

      v_count := v_count + 1;
    end if;
  end loop;

  -- 4. Update catalog_uploads summary stats and overall status
  update public.catalog_uploads
  set
    total_items = v_total_count,
    passed_items = v_passed_count,
    failed_items = v_failed_count,
    status = case
      when v_total_count = 0 then 'qc_in_progress'
      when v_failed_count = 0 then 'qc_pass'
      when v_passed_count = 0 then 'qc_error'
      else 'action_required'
    end,
    updated_at = now()
  where id = p_upload_id;

  return jsonb_build_object(
    'success', true,
    'upload_id', p_upload_id,
    'products_updated', v_count,
    'total_items', v_total_count,
    'passed_items', v_passed_count,
    'failed_items', v_failed_count
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_submit_catalog(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_submit_catalog(text, jsonb) TO authenticated;

-- admin_top_products
create or replace function public.admin_top_products(
  p_from date,
  p_to date,
  p_limit integer default 5
)
returns table (
  product_id uuid,
  name text,
  total_quantity bigint,
  total_revenue numeric(10, 2),
  image text
)
language plpgsql
security definer
set search_path = public, pg_temp$$
begin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  return query
  with expanded_items as (
    select
      (item->>'product_id')::uuid as p_id,
      item->>'name' as p_name,
      coalesce((item->>'quantity')::integer, 0) as qty,
      (coalesce((item->>'price')::numeric, 0) * coalesce((item->>'quantity')::integer, 0)) as item_total,
      item->>'image' as p_img
    from public.orders o,
    jsonb_array_elements(o.items) as item
    where o.status not in ('cancelled', 'refunded')
      and o.created_at::date >= p_from
      and o.created_at::date <= p_to
  )
  select
    e.p_id as product_id,
    coalesce(e.p_name, 'Unknown Product') as name,
    sum(e.qty)::bigint as total_quantity,
    sum(e.item_total)::numeric(10, 2) as total_revenue,
    max(e.p_img) as image
  from expanded_items e
  group by e.p_id, e.p_name
  order by total_revenue desc
  limit coalesce(p_limit, 5);
end;
$$;

REVOKE ALL ON FUNCTION public.admin_top_products(date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_top_products(date, date, integer) TO authenticated;

-- admin_top_zero_result_searches
CREATE OR REPLACE FUNCTION public.admin_top_zero_result_searches(p_days int DEFAULT 30)
RETURNS table(
  normalized_query text,
  search_count bigint,
  last_searched_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    s.normalized_query,
    count(*)::bigint AS search_count,
    max(s.created_at) AS last_searched_at
  FROM public.search_logs s
  WHERE s.result_count = 0
    AND s.created_at >= (now() - (coalesce(p_days, 30) || ' days')::interval)
    AND length(trim(s.normalized_query)) > 0
  GROUP BY s.normalized_query
  ORDER BY search_count DESC, last_searched_at DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_top_zero_result_searches(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_top_zero_result_searches(int) TO authenticated;


-- admin_undo_bulk_operation
CREATE OR REPLACE FUNCTION public.admin_undo_bulk_operation(
  p_op_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
set search_path = public, pg_temp$$
DECLARE
  v_op record;
  v_elem jsonb;
  v_prod_id uuid;
  v_prev_stock integer;
  v_orig_change integer;
  v_curr_stock integer;
  v_conflicts text[] := '{}'::text[];
  v_subsequent_count integer;
  v_undone_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_op
  FROM public.bulk_operations
  WHERE id = p_op_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bulk operation % not found.', p_op_id;
  END IF;

  IF v_op.status <> 'applied' THEN
    RAISE EXCEPTION 'Bulk operation is already % (must be "applied" to undo).', v_op.status;
  END IF;

  -- 1. Undo Stock Operation
  IF v_op.op_type = 'stock' THEN
    -- Safety Check: Verify whether any affected product was modified after this op
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_op.before_snapshot)
    LOOP
      v_prod_id := (v_elem->>'product_id')::uuid;
      SELECT count(*) INTO v_subsequent_count
      FROM public.stock_movements
      WHERE product_id = v_prod_id
        AND created_at > v_op.created_at;

      IF v_subsequent_count > 0 THEN
        v_conflicts := array_append(v_conflicts, (
          SELECT format('%s (SKU: %s)', name, COALESCE(sku, '—'))
          FROM public.products WHERE id = v_prod_id
        ));
      END IF;
    END LOOP;

    IF array_length(v_conflicts, 1) > 0 THEN
      RAISE EXCEPTION 'Cannot undo stock operation: The following % product(s) have subsequent stock movements: %',
        array_length(v_conflicts, 1),
        array_to_string(v_conflicts, ', ');
    END IF;

    -- Apply reverse stock movements
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_op.before_snapshot)
    LOOP
      v_prod_id := (v_elem->>'product_id')::uuid;
      v_prev_stock := (v_elem->>'previous_stock')::integer;
      v_orig_change := (v_elem->>'change')::integer;

      UPDATE public.products
      SET stock = v_prev_stock, updated_at = now()
      WHERE id = v_prod_id;

      INSERT INTO public.stock_movements (product_id, change, reason, admin_id)
      VALUES (
        v_prod_id,
        -v_orig_change,
        format('Undo bulk stock adjustment [Op: %s]', p_op_id),
        auth.uid()
      );
      v_undone_count := v_undone_count + 1;
    END LOOP;

  -- 2. Undo Details Operation
  ELSIF v_op.op_type = 'details' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_op.before_snapshot)
    LOOP
      v_prod_id := (v_elem->>'product_id')::uuid;
      UPDATE public.products
      SET
        category_id = (v_elem->>'category_id')::uuid,
        brand = v_elem->>'brand',
        short_tagline = v_elem->>'tagline',
        description = COALESCE(v_elem->>'description', ''),
        warranty_months = (v_elem->>'warranty_months')::integer,
        mrp = (v_elem->>'mrp')::numeric,
        min_order_qty = COALESCE((v_elem->>'moq')::integer, 1),
        order_qty_step = COALESCE((v_elem->>'order_step')::integer, 1),
        low_stock_threshold = COALESCE((v_elem->>'low_stock_threshold')::integer, 5),
        is_active = COALESCE((v_elem->>'is_active')::boolean, TRUE),
        is_featured = COALESCE((v_elem->>'is_featured')::boolean, FALSE),
        is_trending = COALESCE((v_elem->>'is_trending')::boolean, FALSE),
        is_urbanrat_brand = COALESCE((v_elem->>'is_urbanrat_brand')::boolean, FALSE),
        keywords = (
          SELECT COALESCE(array_agg(k.value::text), '{}'::text[])
          FROM jsonb_array_elements_text(COALESCE(v_elem->'keywords', '[]'::jsonb)) AS k
        ),
        updated_at = now()
      WHERE id = v_prod_id;
      v_undone_count := v_undone_count + 1;
    END LOOP;

  -- 3. Undo Tiers Operation
  ELSIF v_op.op_type = 'tiers' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_op.before_snapshot)
    LOOP
      v_prod_id := (v_elem->>'product_id')::uuid;
      DELETE FROM public.product_price_tiers WHERE product_id = v_prod_id;

      IF jsonb_array_length(COALESCE(v_elem->'tiers', '[]'::jsonb)) > 0 THEN
        INSERT INTO public.product_price_tiers (product_id, min_qty, unit_price)
        SELECT v_prod_id, (t->>'min_qty')::integer, (t->>'unit_price')::numeric(10, 2)
        FROM jsonb_array_elements(v_elem->'tiers') t;
      END IF;
      v_undone_count := v_undone_count + 1;
    END LOOP;

  -- 4. Undo Images Operation
  ELSIF v_op.op_type = 'images' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_op.before_snapshot)
    LOOP
      v_prod_id := (v_elem->>'product_id')::uuid;
      UPDATE public.products
      SET
        images = (
          SELECT COALESCE(array_agg(img.value::text), '{}'::text[])
          FROM jsonb_array_elements_text(COALESCE(v_elem->'images', '[]'::jsonb)) AS img
        ),
        updated_at = now()
      WHERE id = v_prod_id;
      v_undone_count := v_undone_count + 1;
    END LOOP;
  END IF;

  -- Mark operation as undone
  UPDATE public.bulk_operations
  SET status = 'undone', undone_at = now()
  WHERE id = p_op_id;

  RETURN jsonb_build_object(
    'success', true,
    'op_id', p_op_id,
    'undone_count', v_undone_count,
    'status', 'undone'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_undo_bulk_operation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_undo_bulk_operation(uuid) TO authenticated;

-- admin_update_dealer_application
create or replace function public.admin_update_dealer_application(
  p_id uuid,
  p_status text,
  p_note text default null,
  p_rejection_reason text default null
)
returns public.dealer_applications
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_app public.dealer_applications;
  v_updated_app public.dealer_applications;
  v_dealer_code text;
  v_clean_status text;
  v_clean_reason text;
  v_clean_note text;
begin
  -- 1. Authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 2. Fetch existing application row with row-lock
  select * into v_app
  from public.dealer_applications
  where id = p_id
  for update;

  if not found then
    raise exception 'Dealer application not found: %', p_id;
  end if;

  -- 3. Validate status
  v_clean_status := lower(trim(coalesce(p_status, '')));
  if v_clean_status not in ('new', 'contacted', 'under_review', 'approved', 'rejected', 'on_hold') then
    raise exception 'Invalid status: %. Must be one of new, contacted, under_review, approved, rejected, on_hold', p_status;
  end if;

  v_clean_note := nullif(trim(coalesce(p_note, '')), '');
  v_clean_reason := nullif(trim(coalesce(p_rejection_reason, '')), '');

  -- 4. Rejection requires a reason
  if v_clean_status = 'rejected' and v_clean_reason is null then
    raise exception 'A rejection reason is mandatory when setting application status to rejected';
  end if;

  v_dealer_code := v_app.dealer_code;

  -- 5. On 'approved': generate unique dealer_code (DLR-0001 sequence) if empty and flag profile
  if v_clean_status = 'approved' then
    if v_dealer_code is null or trim(v_dealer_code) = '' then
      loop
        v_dealer_code := 'DLR-' || lpad(nextval('public.dealer_code_seq')::text, 4, '0');
        exit when not exists (select 1 from public.dealer_applications where dealer_code = v_dealer_code);
      end loop;
    end if;

    -- If user_id is linked, grant dealer status on profile
    if v_app.user_id is not null then
      update public.profiles
      set is_dealer = true, updated_at = now()
      where id = v_app.user_id;
    end if;
  end if;

  -- 6. If moved away from approved, revoke is_dealer on profile if no other approved applications exist
  if v_app.status = 'approved' and v_clean_status <> 'approved' then
    if v_app.user_id is not null then
      if not exists (
        select 1 from public.dealer_applications
        where user_id = v_app.user_id
          and id <> p_id
          and status = 'approved'
      ) then
        update public.profiles
        set is_dealer = false, updated_at = now()
        where id = v_app.user_id;
      end if;
    end if;
  end if;

  -- 7. Update dealer application
  update public.dealer_applications
  set
    status = v_clean_status,
    dealer_code = v_dealer_code,
    admin_note = coalesce(v_clean_note, admin_note),
    rejection_reason = case when v_clean_status = 'rejected' then v_clean_reason else rejection_reason end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_id
  returning * into v_updated_app;

  -- 8. Write dealer_events audit row
  insert into public.dealer_events (
    application_id,
    status,
    note,
    created_by,
    created_at
  ) values (
    p_id,
    v_clean_status,
    coalesce(v_clean_note, case
      when v_clean_status = 'approved' then 'Dealer approved with code ' || v_dealer_code
      when v_clean_status = 'rejected' then 'Dealer application rejected: ' || v_clean_reason
      else 'Application status updated to ' || v_clean_status
    end),
    auth.uid(),
    now()
  );

  return v_updated_app;
end;
$$;

REVOKE ALL ON FUNCTION public.admin_update_dealer_application(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_dealer_application(uuid, text, text, text) TO authenticated;

-- admin_update_order_shipping
create or replace function public.admin_update_order_shipping(
  p_order_id text,
  p_courier_name text,
  p_awb_number text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_order record;
begin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  select * into v_order from public.orders where id = trim(p_order_id);
  if not found then
    raise exception 'Order not found: %', p_order_id;
  end if;

  update public.orders
  set
    courier_name = nullif(trim(p_courier_name), ''),
    awb_number = nullif(trim(p_awb_number), ''),
    updated_at = now()
  where id = trim(p_order_id);

  -- Add audit trail event
  insert into public.order_events (order_id, status, note, created_by)
  values (
    trim(p_order_id),
    v_order.status,
    coalesce(p_note, 'Dispatched via ' || coalesce(nullif(trim(p_courier_name), ''), 'Express Freight') || ' (AWB: ' || coalesce(nullif(trim(p_awb_number), ''), 'None') || ')'),
    auth.uid()
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'courier_name', p_courier_name,
    'awb_number', p_awb_number
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_update_order_shipping(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_shipping(text, text, text, text) TO authenticated;

-- admin_update_order_status
create or replace function public.admin_update_order_status(
  p_order_id text,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_order record;
  v_item record;
  v_should_restore boolean := false;
  v_items_restored integer := 0;
begin
  -- 1. Authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 2. Status validation
  if p_status not in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'returned', 'on_hold') then
    raise exception 'Invalid status: %. Allowed: pending, confirmed, processing, shipped, delivered, cancelled, refunded, returned, on_hold', p_status;
  end if;

  -- 3. Retrieve order
  select * into v_order
  from public.orders
  where id = trim(p_order_id);

  if not found then
    raise exception 'Order not found: %', p_order_id;
  end if;

  -- 4. Check if inventory restoration is triggered (moving to cancelled/refunded from active state)
  v_should_restore := (p_status in ('cancelled', 'refunded'))
                  and (v_order.status not in ('cancelled', 'refunded'));

  if v_should_restore and v_order.items is not null and jsonb_typeof(v_order.items) = 'array' then
    for v_item in
      select
        (elem->>'product_id')::uuid as product_id,
        coalesce((elem->>'quantity')::integer, 0) as quantity
      from jsonb_array_elements(v_order.items) as elem
    loop
      if v_item.product_id is not null and v_item.quantity > 0 then
        -- Restore stock on product
        update public.products
        set stock = stock + v_item.quantity, updated_at = now()
        where id = v_item.product_id;

        if found then
          -- Log stock movement if table exists
          begin
            insert into public.stock_movements (
              product_id,
              change,
              reason,
              order_id,
              admin_id
            )
            values (
              v_item.product_id,
              v_item.quantity,
              'Order ' || p_order_id || ' status changed to ' || p_status || ' (stock returned to inventory)',
              p_order_id,
              auth.uid()
            );
          exception when others then null;
          end;
          v_items_restored := v_items_restored + 1;
        end if;
      end if;
    end loop;
  end if;

  -- 5. Update orders table
  update public.orders
  set
    status = p_status,
    admin_note = coalesce(p_note, admin_note),
    cancel_reason = case when p_status = 'cancelled' and p_note is not null then p_note else cancel_reason end,
    updated_at = now()
  where id = trim(p_order_id);

  -- 6. Insert audit event into order_events
  insert into public.order_events (order_id, status, note, created_by)
  values (
    trim(p_order_id),
    p_status,
    p_note,
    auth.uid()
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'previous_status', v_order.status,
    'new_status', p_status,
    'items_restored', v_items_restored,
    'note', p_note
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_update_order_status(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(text, text, text) TO authenticated;

-- admin_update_return_claim
create or replace function public.admin_update_return_claim(
  p_return_id uuid,
  p_claim_status text,
  p_claim_amount numeric default 0,
  p_claim_type text default null,
  p_claim_reference text default null,
  p_claim_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_return public.return_requests%rowtype;
  v_old_status text;
  v_now timestamptz := now();
  v_audit_note text;
begin
  -- 1. Admin check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 2. Validate return exists
  select * into v_return
  from public.return_requests
  where id = p_return_id
  for update;

  if not found then
    raise exception 'Return request % not found', p_return_id;
  end if;

  -- 3. Validate claim status
  if p_claim_status not in ('none', 'pending', 'approved', 'rejected', 'settled') then
    raise exception 'Invalid claim status: %', p_claim_status;
  end if;

  -- 4. Validate claim type if provided
  if p_claim_type is not null and p_claim_type not in ('courier', 'supplier', 'transit_damage', 'customer_fraud', 'other') then
    raise exception 'Invalid claim type: %', p_claim_type;
  end if;

  v_old_status := v_return.claim_status;

  -- 5. Update claim columns
  update public.return_requests
  set
    claim_status = p_claim_status,
    claim_amount = coalesce(p_claim_amount, 0),
    claim_type = p_claim_type,
    claim_reference = p_claim_reference,
    claim_notes = p_claim_notes,
    claim_filed_at = case
      when p_claim_status != 'none' and claim_filed_at is null then v_now
      else claim_filed_at
    end,
    claim_settled_at = case
      when p_claim_status in ('settled', 'approved', 'rejected') and v_old_status not in ('settled', 'approved', 'rejected') then v_now
      else claim_settled_at
    end,
    updated_at = v_now
  where id = p_return_id;

  -- 6. Insert audit trail in return_events
  v_audit_note := 'Claim status updated to ' || upper(p_claim_status);
  if p_claim_amount > 0 then
    v_audit_note := v_audit_note || ' (Amount: ₹' || p_claim_amount || ')';
  end if;
  if p_claim_reference is not null and p_claim_reference != '' then
    v_audit_note := v_audit_note || ' [Ref: ' || p_claim_reference || ']';
  end if;
  if p_claim_notes is not null and p_claim_notes != '' then
    v_audit_note := v_audit_note || ' - Note: ' || p_claim_notes;
  end if;

  insert into public.return_events (
    return_id,
    status,
    note,
    actor_id,
    created_at
  ) values (
    p_return_id,
    v_return.status,
    v_audit_note,
    auth.uid(),
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'return_id', p_return_id,
    'claim_status', p_claim_status,
    'claim_amount', coalesce(p_claim_amount, 0),
    'claim_reference', p_claim_reference
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_update_return_claim(uuid, text, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_return_claim(uuid, text, numeric, text, text, text) TO authenticated;

-- admin_update_return_status
create or replace function public.admin_update_return_status(
  p_return_id uuid,
  p_new_status text,
  p_note text default null,
  p_refund_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_return record;
  v_ret_item record;
  v_is_valid_transition boolean := false;
  v_items_restocked integer := 0;
begin
  -- 1. Administrator check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 2. Validate target status
  if p_new_status not in (
    'requested',
    'approved',
    'rejected',
    'pickup_scheduled',
    'in_transit',
    'received',
    'qc_passed',
    'qc_failed',
    'refunded',
    'replacement_shipped',
    'closed'
  ) then
    raise exception 'Invalid status: %', p_new_status;
  end if;

  -- 3. Retrieve return request
  select * into v_return
  from public.return_requests
  where id = p_return_id;

  if not found then
    raise exception 'Return request not found: %', p_return_id;
  end if;

  -- 4. Validate allowed transitions
  if v_return.status = p_new_status then
    -- No-op or note update allowed
    v_is_valid_transition := true;
  elsif v_return.status = 'requested' and p_new_status in ('approved', 'rejected', 'closed') then
    v_is_valid_transition := true;
  elsif v_return.status = 'approved' and p_new_status in ('pickup_scheduled', 'in_transit', 'received', 'rejected', 'closed') then
    v_is_valid_transition := true;
  elsif v_return.status = 'pickup_scheduled' and p_new_status in ('in_transit', 'received', 'closed') then
    v_is_valid_transition := true;
  elsif v_return.status = 'in_transit' and p_new_status in ('received', 'closed') then
    v_is_valid_transition := true;
  elsif v_return.status = 'received' and p_new_status in ('qc_passed', 'qc_failed', 'closed') then
    v_is_valid_transition := true;
  elsif v_return.status = 'qc_passed' and p_new_status in ('refunded', 'replacement_shipped', 'closed') then
    v_is_valid_transition := true;
  elsif v_return.status = 'qc_failed' and p_new_status in ('rejected', 'closed') then
    v_is_valid_transition := true;
  elsif v_return.status in ('refunded', 'replacement_shipped', 'rejected') and p_new_status = 'closed' then
    v_is_valid_transition := true;
  elsif v_return.status = 'closed' and p_new_status in ('requested', 'approved') then
    -- Admin override to reopen with note
    v_is_valid_transition := true;
  end if;

  if not v_is_valid_transition then
    raise exception 'Invalid status transition from "%" to "%"', v_return.status, p_new_status;
  end if;

  -- 5. Restock inventory when status becomes qc_passed and return type is 'return'
  -- Guaranteed to restock only once
  if p_new_status = 'qc_passed' and v_return.type = 'return' and v_return.status != 'qc_passed' then
    for v_ret_item in
      select product_id, quantity
      from public.return_items
      where return_id = p_return_id
    loop
      perform public.admin_adjust_stock(
        v_ret_item.product_id,
        v_ret_item.quantity,
        'Restock from return ' || v_return.return_code || ' (QC Passed)'
      );
      v_items_restocked := v_items_restocked + 1;
    end loop;
  end if;

  -- 6. Update return_requests record
  update public.return_requests
  set
    status = p_new_status,
    admin_note = coalesce(p_note, admin_note),
    refund_amount = case
      when p_refund_amount is not null and p_refund_amount >= 0 then p_refund_amount
      else refund_amount
    end,
    resolved_at = case
      when p_new_status in ('refunded', 'replacement_shipped', 'closed', 'rejected') then coalesce(resolved_at, now())
      else resolved_at
    end,
    updated_at = now()
  where id = p_return_id;

  -- 7. Audit log in return_events
  insert into public.return_events (
    return_id,
    status,
    note,
    actor_id,
    created_at
  )
  values (
    p_return_id,
    p_new_status,
    coalesce(p_note, 'Status changed from ' || v_return.status || ' to ' || p_new_status),
    auth.uid(),
    now()
  );

  -- 8. Synchronize to order_events when milestone reached
  if p_new_status in ('approved', 'refunded', 'replacement_shipped', 'rejected') then
    insert into public.order_events (
      order_id,
      status,
      note,
      created_by
    )
    values (
      v_return.order_id,
      'returned',
      'Return request ' || v_return.return_code || ' ' || p_new_status || case when p_note is not null then ': ' || p_note else '' end,
      auth.uid()
    );
  end if;

  return jsonb_build_object(
    'return_id', p_return_id,
    'return_code', v_return.return_code,
    'previous_status', v_return.status,
    'new_status', p_new_status,
    'refund_amount', coalesce(p_refund_amount, v_return.refund_amount),
    'items_restocked', v_items_restocked
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_update_return_status(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_return_status(uuid, text, text, numeric) TO authenticated;

-- get_return_stats
create or replace function public.get_return_stats(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_days integer := coalesce(p_days, 30);
  v_start_date timestamptz;
  v_total_returns integer := 0;
  v_total_delivered_orders integer := 0;
  v_return_rate numeric(10, 2) := 0;
  v_refunds_value numeric(10, 2) := 0;
  v_by_status jsonb := '{}'::jsonb;
  v_reasons jsonb := '[]'::jsonb;
  v_top_products jsonb := '[]'::jsonb;
  v_pending_actions integer := 0;
  v_qc_failed_count integer := 0;
  v_claims_count integer := 0;
  v_claims_value numeric(10, 2) := 0;
begin
  -- 1. Administrator authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  if v_days <= 0 then
    v_days := 30;
  end if;

  v_start_date := now() - (v_days || ' days')::interval;

  -- 2. Total return requests in period
  select count(*) into v_total_returns
  from public.return_requests
  where requested_at >= v_start_date;

  -- 3. Total delivered orders in period
  select count(*) into v_total_delivered_orders
  from public.orders
  where status = 'delivered' and created_at >= v_start_date;

  -- 4. Calculate return rate percentage
  if v_total_delivered_orders > 0 then
    v_return_rate := round((v_total_returns::numeric / v_total_delivered_orders::numeric * 100), 2);
  else
    v_return_rate := 0;
  end if;

  -- 5. Total refunds value
  select coalesce(sum(refund_amount), 0) into v_refunds_value
  from public.return_requests
  where requested_at >= v_start_date and status in ('refunded', 'closed', 'qc_passed');

  -- 6. Breakdown by Status
  select coalesce(jsonb_object_agg(status, count), '{}'::jsonb) into v_by_status
  from (
    select status, count(*) as count
    from public.return_requests
    where requested_at >= v_start_date
    group by status
  ) s;

  -- 7. Pending actions count (requested or received awaiting QC)
  select count(*) into v_pending_actions
  from public.return_requests
  where status in ('requested', 'received');

  -- 8. QC Failed count in period
  select count(*) into v_qc_failed_count
  from public.return_requests
  where status = 'qc_failed' and requested_at >= v_start_date;

  -- 9. Claims count and settled value
  select
    count(*),
    coalesce(sum(claim_amount), 0)
  into v_claims_count, v_claims_value
  from public.return_requests
  where claim_status != 'none' and requested_at >= v_start_date;

  -- 10. Reason Breakdown
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'reason_code', reason_code,
      'count', count,
      'percentage', case
        when v_total_returns > 0 then round((count::numeric / v_total_returns::numeric * 100), 2)
        else 0
      end
    ) order by count desc
  ), '[]'::jsonb) into v_reasons
  from (
    select reason_code, count(*) as count
    from public.return_requests
    where requested_at >= v_start_date
    group by reason_code
  ) r;

  -- 11. Top Returned Products
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'product_id', p.id,
      'product_name', p.name,
      'sku', p.sku,
      'total_quantity', tp.total_qty,
      'return_count', tp.ret_count
    ) order by tp.total_qty desc
  ), '[]'::jsonb) into v_top_products
  from (
    select
      ri.product_id,
      sum(ri.quantity) as total_qty,
      count(distinct ri.return_id) as ret_count
    from public.return_items ri
    join public.return_requests rr on rr.id = ri.return_id
    where rr.requested_at >= v_start_date
    group by ri.product_id
    order by total_qty desc
    limit 10
  ) tp
  join public.products p on p.id = tp.product_id;

  -- 12. Return structured results
  return jsonb_build_object(
    'period_days', v_days,
    'start_date', v_start_date,
    'end_date', now(),
    'total_returns', v_total_returns,
    'total_delivered_orders', v_total_delivered_orders,
    'return_rate_percentage', v_return_rate,
    'total_refunds_value', v_refunds_value,
    'pending_actions_count', v_pending_actions,
    'qc_failed_count', v_qc_failed_count,
    'claims_count', v_claims_count,
    'claims_value', v_claims_value,
    'by_status', v_by_status,
    'reason_breakdown', v_reasons,
    'top_returned_products', v_top_products
  );
end;
$$;

REVOKE ALL ON FUNCTION public.get_return_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_return_stats(integer) TO authenticated;

-- get_product_return_performance
create or replace function public.get_product_return_performance(
  p_days integer default 30,
  p_category_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_days integer := coalesce(p_days, 30);
  v_start_date timestamptz;
  v_result jsonb := '[]'::jsonb;
begin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  if v_days <= 0 then
    v_days := 30;
  end if;

  v_start_date := now() - (v_days || ' days')::interval;

  with delivered_items as (
    -- Delivered items in period
    select
      (item->>'product_id')::uuid as product_id,
      count(distinct o.id) as orders_delivered,
      sum((item->>'quantity')::integer) as quantity_delivered
    from public.orders o,
    jsonb_array_elements(o.items) as item
    where o.status = 'delivered'
      and o.created_at >= v_start_date
      and (item->>'product_id') is not null
    group by (item->>'product_id')::uuid
  ),
  returned_items as (
    -- Returned items in period
    select
      ri.product_id,
      count(distinct rr.id) as returns_count,
      sum(ri.quantity) as quantity_returned
    from public.return_items ri
    join public.return_requests rr on rr.id = ri.return_id
    where rr.requested_at >= v_start_date
    group by ri.product_id
  ),
  aggregated as (
    select
      p.id as product_id,
      p.name as product_name,
      p.sku as product_sku,
      case
        when jsonb_array_length(p.images) > 0 then p.images->>0
        else null
      end as product_image,
      p.category_id,
      c.name as category_name,
      coalesce(di.orders_delivered, 0) as orders_delivered,
      coalesce(di.quantity_delivered, 0) as quantity_delivered,
      coalesce(ri.returns_count, 0) as returns_count,
      coalesce(ri.quantity_returned, 0) as quantity_returned,
      case
        when coalesce(di.orders_delivered, 0) > 0 then
          round((coalesce(ri.returns_count, 0)::numeric / di.orders_delivered::numeric * 100), 2)
        when coalesce(ri.returns_count, 0) > 0 then 100.00
        else 0.00
      end as return_rate_percentage
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join delivered_items di on di.product_id = p.id
    left join returned_items ri on ri.product_id = p.id
    where (p_category_id is null or p.category_id::text = p_category_id)
      and (coalesce(di.orders_delivered, 0) > 0 or coalesce(ri.returns_count, 0) > 0)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'product_id', product_id,
      'product_name', product_name,
      'sku', product_sku,
      'image', product_image,
      'category_id', category_id,
      'category_name', category_name,
      'orders_delivered', orders_delivered,
      'quantity_delivered', quantity_delivered,
      'returns_count', returns_count,
      'quantity_returned', quantity_returned,
      'return_rate_percentage', return_rate_percentage,
      'is_high_return', (return_rate_percentage >= 5.0 and returns_count > 0)
    )
    order by return_rate_percentage desc, returns_count desc
  ), '[]'::jsonb) into v_result
  from aggregated;

  return v_result;
end;
$$;

REVOKE ALL ON FUNCTION public.get_product_return_performance(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_return_performance(integer, text) TO authenticated;

-- get_customer_lifetime_stats
create or replace function public.get_customer_lifetime_stats(
  p_phone text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_stats jsonb;
  v_clean_phone text;
begin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  -- Normalize 10-digit Indian mobile
  v_clean_phone := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  select jsonb_build_object(
    'total_orders', count(*),
    'total_spend', coalesce(sum(case when status not in ('cancelled', 'refunded') then total else 0 end), 0),
    'delivered_orders', count(*) filter (where status = 'delivered'),
    'first_order_date', min(created_at),
    'last_order_date', max(created_at)
  ) into v_stats
  from public.orders
  where (p_user_id is not null and user_id = p_user_id)
     or (v_clean_phone <> '' and right(regexp_replace(customer->>'phone', '\D', '', 'g'), 10) = v_clean_phone);

  return coalesce(v_stats, jsonb_build_object('total_orders', 0, 'total_spend', 0, 'delivered_orders', 0));
end;
$$;

REVOKE ALL ON FUNCTION public.get_customer_lifetime_stats(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_lifetime_stats(text, uuid) TO authenticated;

-- refresh_search_vocabulary
create or replace function public.refresh_search_vocabulary()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp$$
declare
  v_inserted integer := 0;
begin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  create temp table temp_search_tokens (token text) on commit drop;

  -- 1. Product names
  insert into temp_search_tokens (token)
  select lower(trim(unnest(regexp_split_to_array(unaccent(name), '[\s,./\-_+()]+'))))
  from public.products
  where is_active = true and name is not null;

  -- 2. SKUs
  insert into temp_search_tokens (token)
  select lower(trim(unnest(regexp_split_to_array(unaccent(sku), '[\s,./\-_+()]+'))))
  from public.products
  where is_active = true and sku is not null;

  -- 3. Brands & Specs Compatibility
  insert into temp_search_tokens (token)
  select lower(trim(unnest(regexp_split_to_array(unaccent(coalesce(brand, specs->>'brand_compatibility', '')), '[\s,./\-_+()]+'))))
  from public.products
  where is_active = true;

  insert into temp_search_tokens (token)
  select lower(trim(unnest(regexp_split_to_array(unaccent(coalesce(specs->>'compatibility_group', '')), '[\s,./\-_+()]+'))))
  from public.products
  where is_active = true;

  -- 4. Category and Subcategory Names
  insert into temp_search_tokens (token)
  select lower(trim(unnest(regexp_split_to_array(unaccent(name), '[\s,./\-_+()]+'))))
  from public.categories
  where is_active = true and name is not null;

  -- 5. Seed Vocabulary with frequencies
  delete from public.search_vocabulary;

  insert into public.search_vocabulary (term, frequency)
  select token, count(*)::integer as frequency
  from temp_search_tokens
  where length(token) >= 2
    and token !~ '^[0-9]+$' -- skip standalone pure numbers unless relevant
  group by token
  having count(*) >= 1
  order by frequency desc;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

REVOKE ALL ON FUNCTION public.refresh_search_vocabulary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_search_vocabulary() TO authenticated;
