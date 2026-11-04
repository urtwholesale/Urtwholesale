-- ============================================================================
-- Migration 027: Fix stock_movements schema and storefront checkout RPCs
-- ============================================================================
-- Purpose:
--   1. Add missing compatibility columns to public.stock_movements (created_by,
--      quantity_change, quantity, movement_type, reference_id, notes) so that
--      legacy or hardened order checkout RPCs and triggers never fail with:
--      "column 'created_by' of relation 'stock_movements' does not exist".
--   2. Install a column synchronization trigger so all column variants
--      (change / quantity_change / quantity and admin_id / created_by) stay
--      in sync automatically.
--   3. Drop all outdated overloads of create_verified_order.
--   4. Re-declare create_verified_order and create_verified_order_guest with
--      hardened atomic stock updates and seamless stock_movements auditing.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ensure public.stock_movements has all compatibility columns
-- ----------------------------------------------------------------------------

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_change integer,
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS movement_type text,
  ADD COLUMN IF NOT EXISTS reference_id text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Index on created_by and order_id for fast audit queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by ON public.stock_movements(created_by);

-- ----------------------------------------------------------------------------
-- 2. Bi-directional Column Synchronization Trigger on stock_movements
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_stock_movements_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Synchronize change / quantity_change / quantity
  IF NEW.change IS NULL THEN
    IF NEW.quantity_change IS NOT NULL THEN
      NEW.change := NEW.quantity_change;
    ELSIF NEW.quantity IS NOT NULL THEN
      NEW.change := NEW.quantity;
    ELSE
      NEW.change := 0;
    END IF;
  END IF;

  IF NEW.quantity_change IS NULL THEN
    NEW.quantity_change := NEW.change;
  END IF;

  IF NEW.quantity IS NULL THEN
    NEW.quantity := NEW.change;
  END IF;

  -- Synchronize admin_id and created_by
  IF NEW.created_by IS NULL AND NEW.admin_id IS NOT NULL THEN
    NEW.created_by := NEW.admin_id;
  ELSIF NEW.admin_id IS NULL AND NEW.created_by IS NOT NULL THEN
    NEW.admin_id := NEW.created_by;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_sync_stock_movements
  BEFORE INSERT OR UPDATE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_stock_movements_columns();

-- ----------------------------------------------------------------------------
-- 3. Drop legacy overloads of create_verified_order
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text);
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text, text);

-- ----------------------------------------------------------------------------
-- 4. Re-declare create_verified_order (Authenticated checkout)
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

  -- Read store delivery thresholds from store_settings safely
  BEGIN
    SELECT
      COALESCE((value->>'free_delivery_min')::numeric, 999),
      COALESCE((value->>'shipping_fee')::numeric, 49)
    INTO v_free_delivery_min, v_shipping_fee
    FROM public.store_settings
    WHERE key = 'store_config'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_free_delivery_min := 999;
    v_shipping_fee := 49;
  END;

  -- 4. Process Each Item (Lock rows FOR UPDATE to prevent race conditions)
  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      COALESCE(
        NULLIF(elem->>'qty', '')::integer,
        NULLIF(elem->>'quantity', '')::integer,
        1
      ) AS quantity,
      NULLIF(trim(COALESCE(elem->>'selected_color', elem->>'color', '')), '') AS selected_color
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'Every item must have a valid product_id';
    END IF;

    IF v_item.product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION 'Duplicate product in order items. Consolidate quantities into a single line';
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, v_item.product_id);

    SELECT id, name, slug, price, stock, is_active, min_order_qty, max_order_qty, price_tiers
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found in catalog', v_item.product_id;
    END IF;

    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'Product "%" is currently discontinued or inactive', v_product.name;
    END IF;

    -- Enforce MOQ
    v_applied_min_qty := GREATEST(1, COALESCE(v_product.min_order_qty, 1));
    v_max_order_qty := LEAST(500, GREATEST(v_applied_min_qty, COALESCE(v_product.max_order_qty, 500)));

    IF v_item.quantity < v_applied_min_qty THEN
      RAISE EXCEPTION 'Minimum order quantity for "%" is % pcs (requested %)',
        v_product.name, v_applied_min_qty, v_item.quantity;
    END IF;

    IF v_item.quantity > v_max_order_qty THEN
      RAISE EXCEPTION 'Quantity for "%" cannot exceed maximum limit of % pcs',
        v_product.name, v_max_order_qty;
    END IF;

    IF v_product.stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for "%". Available: %, Requested: %',
        v_product.name, v_product.stock, v_item.quantity;
    END IF;

    v_qty := v_item.quantity;
    v_first_tier_price := v_product.price;

    -- Compute wholesale volume tier price
    IF v_product.price_tiers IS NOT NULL AND jsonb_typeof(v_product.price_tiers) = 'array' THEN
      SELECT COALESCE(
        (
          SELECT (pt->>'unit_price')::numeric
          FROM jsonb_array_elements(v_product.price_tiers) AS pt
          WHERE (pt->>'min_qty')::integer <= v_qty
          ORDER BY (pt->>'min_qty')::integer DESC
          LIMIT 1
        ),
        v_product.price
      ) INTO v_unit_price;
    ELSE
      v_unit_price := v_product.price;
    END IF;

    v_line_total := round(v_unit_price * v_qty, 2);
    v_line_savings := round((v_first_tier_price - v_unit_price) * v_qty, 2);
    IF v_line_savings < 0 THEN
      v_line_savings := 0;
    END IF;

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'name', v_product.name,
        'slug', v_product.slug,
        'quantity', v_qty,
        'qty', v_qty,
        'unit_price', v_unit_price,
        'total', v_line_total,
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

    -- Record stock movement (populating change, created_by, and reason)
    INSERT INTO public.stock_movements (
      product_id,
      change,
      reason,
      created_by,
      admin_id
    )
    VALUES (
      v_product.id,
      -v_qty,
      'Storefront order checkout',
      v_user_id,
      v_user_id
    );
  END LOOP;

  IF v_subtotal >= v_free_delivery_min THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_shipping_fee;
  END IF;

  v_total := v_subtotal + v_shipping;

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

  -- 6. Insert Order Record
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

  -- Link order_id on stock_movements created for this order
  UPDATE public.stock_movements
  SET order_id = v_order_id,
      reference_id = v_order_id
  WHERE product_id = ANY(v_seen_product_ids)
    AND reason = 'Storefront order checkout'
    AND order_id IS NULL
    AND created_at >= NOW() - INTERVAL '30 seconds';

  -- Record order event audit
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

-- ----------------------------------------------------------------------------
-- 5. Re-declare create_verified_order_guest (Guest checkout via service_role)
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_verified_order_guest(jsonb, jsonb, text, text);

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

  -- Read store delivery thresholds from store_settings safely
  BEGIN
    SELECT
      COALESCE((value->>'free_delivery_min')::numeric, 999),
      COALESCE((value->>'shipping_fee')::numeric, 49)
    INTO v_free_delivery_min, v_shipping_fee
    FROM public.store_settings
    WHERE key = 'store_config'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_free_delivery_min := 999;
    v_shipping_fee := 49;
  END;

  -- 4. Process Each Item (Lock rows FOR UPDATE)
  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      COALESCE(
        NULLIF(elem->>'qty', '')::integer,
        NULLIF(elem->>'quantity', '')::integer,
        1
      ) AS quantity,
      NULLIF(trim(COALESCE(elem->>'selected_color', elem->>'color', '')), '') AS selected_color
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'Every item must have a valid product_id';
    END IF;

    IF v_item.product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION 'Duplicate product in order items. Consolidate quantities into a single line';
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, v_item.product_id);

    SELECT id, name, slug, price, stock, is_active, min_order_qty, max_order_qty, price_tiers
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found in catalog', v_item.product_id;
    END IF;

    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'Product "%" is currently discontinued or inactive', v_product.name;
    END IF;

    v_applied_min_qty := GREATEST(1, COALESCE(v_product.min_order_qty, 1));
    v_max_order_qty := LEAST(500, GREATEST(v_applied_min_qty, COALESCE(v_product.max_order_qty, 500)));

    IF v_item.quantity < v_applied_min_qty THEN
      RAISE EXCEPTION 'Minimum order quantity for "%" is % pcs (requested %)',
        v_product.name, v_applied_min_qty, v_item.quantity;
    END IF;

    IF v_item.quantity > v_max_order_qty THEN
      RAISE EXCEPTION 'Quantity for "%" cannot exceed maximum limit of % pcs',
        v_product.name, v_max_order_qty;
    END IF;

    IF v_product.stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for "%". Available: %, Requested: %',
        v_product.name, v_product.stock, v_item.quantity;
    END IF;

    v_qty := v_item.quantity;
    v_first_tier_price := v_product.price;

    IF v_product.price_tiers IS NOT NULL AND jsonb_typeof(v_product.price_tiers) = 'array' THEN
      SELECT COALESCE(
        (
          SELECT (pt->>'unit_price')::numeric
          FROM jsonb_array_elements(v_product.price_tiers) AS pt
          WHERE (pt->>'min_qty')::integer <= v_qty
          ORDER BY (pt->>'min_qty')::integer DESC
          LIMIT 1
        ),
        v_product.price
      ) INTO v_unit_price;
    ELSE
      v_unit_price := v_product.price;
    END IF;

    v_line_total := round(v_unit_price * v_qty, 2);
    v_line_savings := round((v_first_tier_price - v_unit_price) * v_qty, 2);
    IF v_line_savings < 0 THEN
      v_line_savings := 0;
    END IF;

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'name', v_product.name,
        'slug', v_product.slug,
        'quantity', v_qty,
        'qty', v_qty,
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
      'Guest storefront order checkout'
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
  RETURNING * INTO v_created_order;

  -- Link order_id on stock_movements created for this order
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
    customer_visible
  )
  VALUES (
    v_order_id,
    'pending',
    'Guest order created via storefront checkout',
    true
  );

  RETURN v_created_order;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Permissions Hardening
-- ----------------------------------------------------------------------------

-- create_verified_order is executable by authenticated users and service_role
REVOKE ALL ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text) TO authenticated, service_role;

-- create_verified_order_guest is strictly restricted to service_role (via checkout-gate)
REVOKE ALL ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_verified_order_guest(jsonb, jsonb, text, text) TO service_role;

-- Ensure stock_movements has insert/select permissions for authenticated and service_role
GRANT SELECT, INSERT ON public.stock_movements TO authenticated, service_role;
