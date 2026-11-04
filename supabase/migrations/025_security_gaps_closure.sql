-- ============================================================================
-- Migration 025: Close Evidence Audit Security Gaps
--
-- 1. Orders & Dealer Tracking Tokens:
--    - Adds orders.public_token (128-bit hex) and dealer_applications.public_token.
--    - Hardens get_order_by_id and get_dealer_application_by_code to require token
--      for non-owners/non-admins; returns generic 'not found' on mismatch; masks contact info.
-- 2. Principle of Least Privilege:
--    - Revokes EXECUTE on all functions in schema public from PUBLIC and anon.
--    - Sets ALTER DEFAULT PRIVILEGES to revoke future EXECUTE from PUBLIC and anon.
--    - Explicitly grants EXECUTE to anon only on the approved storefront allowlist.
-- 3. search_products Bounding:
--    - Bounds legacy search_products(q, max_rows) to max 60 chars and max 50 rows.
-- 4. Admin MFA Safe Rollout:
--    - Updates public.is_admin() to support graceful rollout of mandatory aal2.
-- 5. Storage Bucket Hardening:
--    - Drops broad storage.objects SELECT policies allowing public listing.
--    - Restricts object listing to public.is_admin() and user-folder avatars.
--    - Enforces size limit and allowed MIME types on catalog-images bucket.
-- 6. Content-Based Review Moderation & Banner Rating Default Removal:
--    - Replaces star threshold moderation with spam/injection content filtering.
--    - Removes banners.rating default '4.9' and nulls existing defaults.
-- 7. Abuse Prevention & Stale Order Cleanup:
--    - Adds public.rate_limits table and rate_limit_check helper.
--    - Caps unconfirmed orders per phone per 24 hours.
--    - Adds release_stale_pending_orders() to replenish inventory for abandoned checkouts.
-- ============================================================================

-- ============================================================================
-- 1. ORDERS & DEALER TRACKING TOKENS
-- ============================================================================

-- Add 128-bit unguessable public_token to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS public_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_public_token 
  ON public.orders (public_token);

-- Add public_token to dealer_applications
ALTER TABLE public.dealer_applications 
  ADD COLUMN IF NOT EXISTS public_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS idx_dealer_applications_public_token 
  ON public.dealer_applications (public_token);

-- Update get_order_by_id:
-- Admin or authenticated owner: receives full order record.
-- Anyone else: MUST supply matching p_token; receives masked PII (name, city, state, pincode, **** 1234),
-- items, status, events. Missing or invalid token returns generic NULL (not found).
CREATE OR REPLACE FUNCTION public.get_order_by_id(
  p_order_id text,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_items jsonb;
  v_events jsonb;
  v_is_admin boolean := public.is_admin();
  v_caller_uid uuid := auth.uid();
  v_is_owner boolean := false;
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

  -- Determine ownership if authenticated
  IF v_caller_uid IS NOT NULL AND v_order.customer_id = v_caller_uid THEN
    v_is_owner := true;
  END IF;

  -- If neither admin nor authenticated owner, validate token
  IF NOT v_is_admin AND NOT v_is_owner THEN
    IF p_token IS NULL OR trim(p_token) = '' OR v_order.public_token IS DISTINCT FROM trim(p_token) THEN
      -- Identical generic not found: eliminates order enumeration
      RETURN NULL;
    END IF;
  END IF;

  -- Retrieve timeline events
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'status', e.status,
        'title', e.title,
        'description', e.description,
        'created_at', e.created_at
      ) ORDER BY e.created_at ASC
    ), '[]'::jsonb
  ) INTO v_events
  FROM public.order_events e
  WHERE e.order_id = v_order.id;

  -- Retrieve items
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'product_id', i.product_id,
        'product_name', i.product_name,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'subtotal', i.subtotal
      )
    ), '[]'::jsonb
  ) INTO v_items
  FROM public.order_items i
  WHERE i.order_id = v_order.id;

  -- Return privileged view for Admin or Owner
  IF v_is_admin OR v_is_owner THEN
    RETURN jsonb_build_object(
      'id', v_order.id,
      'status', v_order.status,
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at,
      'subtotal', v_order.subtotal,
      'savings', v_order.savings,
      'shipping_amount', v_order.shipping_amount,
      'tax_amount', v_order.tax_amount,
      'total_amount', v_order.total_amount,
      'source', v_order.source,
      'courier_name', v_order.courier_name,
      'awb_number', v_order.awb_number,
      'cancel_reason', v_order.cancel_reason,
      'public_token', v_order.public_token,
      'customer', jsonb_build_object(
        'name', v_order.customer_name,
        'phone', v_order.customer_phone,
        'email', v_order.customer_email,
        'address_line1', v_order.shipping_address_line1,
        'address_line2', v_order.shipping_address_line2,
        'city', v_order.shipping_city,
        'state', v_order.shipping_state,
        'pincode', v_order.shipping_pincode,
        'business_name', v_order.business_name,
        'gstin', v_order.gstin
      ),
      'admin_note', CASE WHEN v_is_admin THEN v_order.admin_note ELSE NULL END,
      'whatsapp_message', v_order.whatsapp_message,
      'items', v_items,
      'events', v_events
    );
  END IF;

  -- Return guest view: masked phone, no address lines, no email, no GSTIN, no admin notes
  RETURN jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'updated_at', v_order.updated_at,
    'subtotal', v_order.subtotal,
    'savings', v_order.savings,
    'shipping_amount', v_order.shipping_amount,
    'tax_amount', v_order.tax_amount,
    'total_amount', v_order.total_amount,
    'source', v_order.source,
    'courier_name', v_order.courier_name,
    'awb_number', v_order.awb_number,
    'cancel_reason', v_order.cancel_reason,
    'customer', jsonb_build_object(
      'name', v_order.customer_name,
      'phone', CASE 
        WHEN length(v_order.customer_phone) >= 4 
        THEN '**** ' || right(v_order.customer_phone, 4) 
        ELSE '****' 
      END,
      'city', v_order.shipping_city,
      'state', v_order.shipping_state,
      'pincode', v_order.shipping_pincode
    ),
    'items', v_items,
    'events', v_events
  );
END;
$$;

-- Update get_dealer_application_by_code
CREATE OR REPLACE FUNCTION public.get_dealer_application_by_code(
  p_code text,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app record;
  v_is_admin boolean := public.is_admin();
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
    IF p_token IS NULL OR v_app.public_token IS DISTINCT FROM trim(p_token) THEN
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

-- ============================================================================
-- 2. EXPLICIT PRIVILEGE REVOCATION & DEFAULT PRIVILEGES LOCKDOWN
-- ============================================================================

-- Revoke all execute privileges on public schema from PUBLIC and anon
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

-- Alter default privileges so any newly created function in schema public automatically revokes EXECUTE from PUBLIC and anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- Ensure keyword normalization function is present
CREATE OR REPLACE FUNCTION public.normalize_keywords_array(p_raw jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result text[] := '{}'::text[];
  v_item text;
  v_split text[];
  v_tok text;
  v_cleaned text;
BEGIN
  IF p_raw IS NULL OR jsonb_typeof(p_raw) = 'null' THEN
    RETURN '{}'::text[];
  END IF;

  FOR v_item IN
    SELECT jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(p_raw) = 'array' THEN p_raw
        WHEN jsonb_typeof(p_raw) = 'string' THEN jsonb_build_array(p_raw)
        ELSE '[]'::jsonb
      END
    )
  LOOP
    v_split := regexp_split_to_array(v_item, '[,;|\n\r]+');
    FOREACH v_tok IN ARRAY v_split
    LOOP
      v_cleaned := regexp_replace(lower(trim(v_tok)), '\s+', ' ', 'g');
      IF length(v_cleaned) > 0 THEN
        IF length(v_cleaned) > 50 THEN
          v_cleaned := substring(v_cleaned from 1 for 50);
        END IF;
        IF NOT (v_cleaned = ANY(v_result)) THEN
          IF array_length(v_result, 1) IS NULL OR array_length(v_result, 1) < 30 THEN
            v_result := array_append(v_result, v_cleaned);
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 3. BOUND OLD search_products(q, max_rows)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_products(
  q text,
  max_rows integer DEFAULT 8
)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.products
  WHERE is_active = true
    AND (
      q IS NULL 
      OR trim(q) = '' 
      OR name ILIKE '%' || left(regexp_replace(trim(q), '[\x00-\x1F\x7F''"\\%*,()]', ' ', 'g'), 60) || '%'
      OR sku ILIKE '%' || left(regexp_replace(trim(q), '[\x00-\x1F\x7F''"\\%*,()]', ' ', 'g'), 60) || '%'
      OR keywords && ARRAY[lower(left(trim(q), 60))]
    )
  ORDER BY is_featured DESC, name ASC
  LIMIT LEAST(GREATEST(COALESCE(max_rows, 8), 1), 50);
$$;

-- ============================================================================
-- 4. ADMIN MFA: GRACEFUL ROLLOUT & aal2 ENFORCEMENT
-- ============================================================================

-- Ensure store_settings key for admin MFA rollout flag exists
INSERT INTO public.store_settings (key, value, description)
VALUES (
  'enforce_admin_mfa',
  'false',
  'When true, public.is_admin() requires auth.jwt()->>''aal'' = ''aal2''. Keep false during initial admin enrollment.'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND (
        -- Safe rollout: require aal2 only once enforce_admin_mfa setting is enabled
        COALESCE((SELECT value = 'true' FROM public.store_settings WHERE key = 'enforce_admin_mfa'), false) = false
        OR (auth.jwt()->>'aal') = 'aal2'
      )
  );
$$;

-- ============================================================================
-- 5. STORAGE BUCKET HARDENING (PREVENT PUBLIC BUCKET ENUMERATION)
-- ============================================================================

-- Drop broad public SELECT policies on storage.objects that permit bucket listing
DROP POLICY IF EXISTS "Anyone can read product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view banners" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view catalog images" ON storage.objects;

-- Allow only administrators to list/query objects across buckets via storage API
DROP POLICY IF EXISTS "Admins can list and view all storage objects" ON storage.objects;
CREATE POLICY "Admins can list and view all storage objects"
  ON storage.objects FOR SELECT
  USING (public.is_admin());

-- Allow authenticated users to view only their own avatars inside their folder
DROP POLICY IF EXISTS "Users can view own avatar objects" ON storage.objects;
CREATE POLICY "Users can view own avatar objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Enforce size limits and MIME restrictions on catalog-images bucket
UPDATE storage.buckets
SET 
  file_size_limit = 10485760, -- 10 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
WHERE id = 'catalog-images';

-- ============================================================================
-- 6. CONTENT-BASED REVIEW MODERATION & BANNER RATING CLEANUP
-- ============================================================================

-- Content-based moderation trigger function:
-- Publishes reviews by default (including 1-3 star reviews). Holds for review
-- only if comment or title contains spam keywords, phone numbers, URLs, or HTML.
CREATE OR REPLACE FUNCTION public.auto_moderate_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_content text := lower(coalesce(NEW.title, '') || ' ' || coalesce(NEW.comment, ''));
  v_is_flagged boolean := false;
BEGIN
  -- Flag potential script injection or HTML tags
  IF v_content ~ '<[^>]+>' OR v_content ~ 'javascript:' THEN
    v_is_flagged := true;
  -- Flag URLs or external links
  ELSIF v_content ~ 'https?://' OR v_content ~ 'www\.' THEN
    v_is_flagged := true;
  -- Flag unsolicited contact numbers (10+ digits)
  ELSIF v_content ~ '\+?[0-9]{10,13}' THEN
    v_is_flagged := true;
  -- Flag common spam patterns
  ELSIF v_content ~ '(whatsapp|telegram|discount code|free gift|cashback|loan|lottery|crypto)' THEN
    v_is_flagged := true;
  END IF;

  IF v_is_flagged THEN
    NEW.is_approved = false;
  ELSE
    NEW.is_approved = true;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop '4.9' default on banners.rating and clear existing defaults
ALTER TABLE public.banners ALTER COLUMN rating DROP DEFAULT;
ALTER TABLE public.banners ALTER COLUMN rating SET DEFAULT NULL;
UPDATE public.banners SET rating = NULL WHERE rating = '4.9';

-- ============================================================================
-- 7. ABUSE PREVENTION, RATE LIMITS, HONEYPOT & STALE ORDER RELEASE
-- ============================================================================

-- Rate limits tracking table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  identifier text NOT NULL, -- phone, IP, or user agent token
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_action_ident_time 
  ON public.rate_limits (action, identifier, created_at DESC);

-- Helper to check rate limits server-side
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text,
  p_identifier text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_identifier IS NULL OR trim(p_identifier) = '' THEN
    RETURN true;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.rate_limits
  WHERE action = p_action
    AND identifier = p_identifier
    AND created_at >= (now() - (p_window_seconds || ' seconds')::interval);

  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limits (action, identifier)
  VALUES (p_action, p_identifier);

  -- Opportunistic cleanup of records older than 24 hours
  DELETE FROM public.rate_limits
  WHERE created_at < (now() - interval '24 hours');

  RETURN true;
END;
$$;

-- Update create_verified_order with rate limiting, honeypot, and 24-hr unconfirmed order cap
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, jsonb, text, text);
CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_customer jsonb,
  p_items jsonb,
  p_whatsapp_message text DEFAULT NULL,
  p_honeypot text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id text;
  v_order_code text;
  v_public_token text := encode(gen_random_bytes(16), 'hex');
  v_customer_phone text := trim(COALESCE(p_customer->>'phone', ''));
  v_unconfirmed_count integer;
  v_subtotal numeric(12,2) := 0;
  v_total_savings numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_free_shipping_threshold numeric(12,2) := 5000;
  v_flat_shipping numeric(12,2) := 250;
  v_max_qty_per_item integer := 10000;
  v_item record;
  v_product record;
  v_unit_price numeric(12,2);
  v_item_subtotal numeric(12,2);
  v_item_savings numeric(12,2);
  v_line_count integer;
  v_product_ids uuid[];
BEGIN
  -- 1. Honeypot Bot Trap: Reject silent automated submissions
  IF p_honeypot IS NOT NULL AND trim(p_honeypot) <> '' THEN
    RAISE EXCEPTION 'Order submission rejected.';
  END IF;

  -- 2. Validate Customer Details
  IF p_customer IS NULL OR v_customer_phone = '' THEN
    RAISE EXCEPTION 'Invalid customer details: phone number is required';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  v_line_count := jsonb_array_length(p_items);
  IF v_line_count > 50 THEN
    RAISE EXCEPTION 'Orders cannot exceed 50 distinct items';
  END IF;

  -- 3. Rate Limit Check: Max 5 orders per phone per 10 minutes
  IF NOT public.check_rate_limit('create_order', v_customer_phone, 5, 600) THEN
    RAISE EXCEPTION 'Too many order attempts. Please wait a few minutes before trying again.';
  END IF;

  -- 4. Cap unconfirmed pending orders per phone per 24 hours (Max 4)
  SELECT count(*) INTO v_unconfirmed_count
  FROM public.orders
  WHERE customer_phone = v_customer_phone
    AND status = 'pending'
    AND created_at >= (now() - interval '24 hours');

  IF v_unconfirmed_count >= 4 THEN
    RAISE EXCEPTION 'Maximum pending orders reached for this phone number today. Please confirm or complete your existing order before placing a new one.';
  END IF;

  -- 5. Duplicate product line prevention
  SELECT array_agg((item->>'product_id')::uuid) INTO v_product_ids
  FROM jsonb_array_elements(p_items) AS item;

  IF array_length(v_product_ids, 1) <> (SELECT count(DISTINCT pid) FROM unnest(v_product_ids) pid) THEN
    RAISE EXCEPTION 'Duplicate product lines detected in order';
  END IF;

  -- 6. Generate order codes
  v_order_code := 'URT-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(2), 'hex'), 1, 4));
  v_order_id := v_order_code;

  -- 7. Validate and lock line items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, qty integer)
  LOOP
    IF v_item.product_id IS NULL THEN
      RAISE EXCEPTION 'Invalid item: product_id is null';
    END IF;

    IF v_item.qty IS NULL OR v_item.qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_item.product_id;
    END IF;

    SELECT p.*, c.is_active AS category_active INTO v_product
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.id = v_item.product_id
    FOR UPDATE OF p;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_item.product_id;
    END IF;

    IF NOT v_product.is_active OR (v_product.category_active IS NOT NULL AND NOT v_product.category_active) THEN
      RAISE EXCEPTION 'Product "%" is currently unavailable', v_product.name;
    END IF;

    IF v_item.qty < v_product.min_order_qty THEN
      RAISE EXCEPTION 'Quantity % below minimum % for "%"', v_item.qty, v_product.min_order_qty, v_product.name;
    END IF;

    IF v_item.qty > v_max_qty_per_item THEN
      RAISE EXCEPTION 'Quantity % exceeds maximum permitted per line (% items) for "%"', v_item.qty, v_max_qty_per_item, v_product.name;
    END IF;

    IF v_product.stock < v_item.qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%": requested %, available %', v_product.name, v_item.qty, v_product.stock;
    END IF;

    v_unit_price := public.get_unit_price(v_item.product_id, v_item.qty);
    v_item_subtotal := round(v_unit_price * v_item.qty, 2);
    v_item_savings := round((v_product.price - v_unit_price) * v_item.qty, 2);

    v_subtotal := v_subtotal + v_item_subtotal;
    v_total_savings := v_total_savings + GREATEST(v_item_savings, 0);

    -- Decrement stock and log movement
    UPDATE public.products
    SET stock = stock - v_item.qty, updated_at = now()
    WHERE id = v_item.product_id;

    INSERT INTO public.stock_movements (
      product_id, quantity, movement_type, reference_id, notes
    ) VALUES (
      v_item.product_id, -v_item.qty, 'order', v_order_id,
      'Order ' || v_order_code || ' (' || v_item.qty || ' units)'
    );

    INSERT INTO public.order_items (
      order_id, product_id, product_name, quantity, unit_price, subtotal
    ) VALUES (
      v_order_id, v_item.product_id, v_product.name, v_item.qty, v_unit_price, v_item_subtotal
    );
  END LOOP;

  -- 8. Compute Shipping & Totals
  IF v_subtotal >= v_free_shipping_threshold THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_flat_shipping;
  END IF;

  v_total := v_subtotal + v_shipping + v_tax;

  -- 9. Insert order record with public_token
  INSERT INTO public.orders (
    id, customer_name, customer_phone, customer_email,
    shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_pincode,
    business_name, gstin, subtotal, savings, shipping_amount, tax_amount, total_amount,
    status, source, whatsapp_message, public_token, customer_id
  ) VALUES (
    v_order_id,
    trim(COALESCE(p_customer->>'name', 'Guest Buyer')),
    v_customer_phone,
    trim(COALESCE(p_customer->>'email', '')),
    trim(COALESCE(p_customer->>'address', p_customer->>'address_line1', '')),
    trim(COALESCE(p_customer->>'address_line2', '')),
    trim(COALESCE(p_customer->>'city', '')),
    trim(COALESCE(p_customer->>'state', '')),
    trim(COALESCE(p_customer->>'pincode', '')),
    trim(COALESCE(p_customer->>'business_name', '')),
    trim(COALESCE(p_customer->>'gstin', '')),
    v_subtotal, v_total_savings, v_shipping, v_tax, v_total,
    'pending', 'storefront', p_whatsapp_message, v_public_token, auth.uid()
  );

  INSERT INTO public.order_events (order_id, status, title, description)
  VALUES (
    v_order_id, 'pending', 'Order Placed',
    'Order received with ' || v_line_count || ' item(s). Awaiting confirmation.'
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_code', v_order_code,
    'public_token', v_public_token,
    'total_amount', v_total
  );
END;
$$;

-- Update submit_dealer_application with honeypot and rate limits
CREATE OR REPLACE FUNCTION public.submit_dealer_application(
  p_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app_no text;
  v_public_token text := encode(gen_random_bytes(16), 'hex');
  v_mobile text := trim(COALESCE(p_data->>'mobile', ''));
  v_honeypot text := trim(COALESCE(p_data->>'honeypot', ''));
  v_created_at timestamptz := now();
  v_business_name text := trim(COALESCE(p_data->>'business_name', ''));
  v_owner_name text := trim(COALESCE(p_data->>'owner_name', ''));
  v_categories text[] := '{}';
BEGIN
  -- Honeypot bot rejection
  IF v_honeypot <> '' THEN
    RAISE EXCEPTION 'Submission rejected.';
  END IF;

  IF v_business_name = '' OR length(v_business_name) < 2 THEN
    RAISE EXCEPTION 'Business name is required (minimum 2 characters)';
  END IF;

  IF v_owner_name = '' OR length(v_owner_name) < 2 THEN
    RAISE EXCEPTION 'Owner name is required (minimum 2 characters)';
  END IF;

  IF v_mobile = '' OR length(v_mobile) < 10 THEN
    RAISE EXCEPTION 'A valid 10-digit mobile number is required';
  END IF;

  -- Rate limit check: max 3 dealer applications per phone per hour
  IF NOT public.check_rate_limit('dealer_application', v_mobile, 3, 3600) THEN
    RAISE EXCEPTION 'Too many application submissions. Please try again later.';
  END IF;

  v_app_no := 'DLR-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(2), 'hex'), 1, 4));

  IF p_data->'categories_interest' IS NOT NULL AND jsonb_typeof(p_data->'categories_interest') = 'array' THEN
    SELECT COALESCE(array_agg(elem.val::text), '{}'::text[]) INTO v_categories
    FROM (
      SELECT DISTINCT trim(BOTH '"' FROM value::text) AS val
      FROM jsonb_array_elements(p_data->'categories_interest')
      WHERE trim(BOTH '"' FROM value::text) <> ''
    ) AS elem;
  END IF;

  INSERT INTO public.dealer_applications (
    application_no, business_name, owner_name, mobile,
    whatsapp, email, gstin, business_type, address,
    city, state, pincode, expected_monthly_volume,
    categories_interest, message, status, public_token,
    user_id, accepted_terms_at, created_at, updated_at
  ) VALUES (
    v_app_no, v_business_name, v_owner_name, v_mobile,
    trim(COALESCE(p_data->>'whatsapp', '')),
    trim(COALESCE(p_data->>'email', '')),
    trim(COALESCE(p_data->>'gstin', '')),
    trim(COALESCE(p_data->>'business_type', '')),
    trim(COALESCE(p_data->>'address', '')),
    trim(COALESCE(p_data->>'city', '')),
    trim(COALESCE(p_data->>'state', '')),
    trim(COALESCE(p_data->>'pincode', '')),
    trim(COALESCE(p_data->>'expected_monthly_volume', '')),
    v_categories,
    trim(COALESCE(p_data->>'message', '')),
    'new', v_public_token, auth.uid(), now(), v_created_at, v_created_at
  );

  INSERT INTO public.dealer_events (
    dealer_id, status, title, description, created_by, created_at
  ) VALUES (
    (SELECT id FROM public.dealer_applications WHERE application_no = v_app_no),
    'new', 'Application Submitted',
    'Dealer application received from ' || v_business_name || ' (' || v_owner_name || ')',
    auth.uid(), v_created_at
  );

  RETURN jsonb_build_object(
    'application_no', v_app_no,
    'created_at', v_created_at,
    'public_token', v_public_token
  );
END;
$$;

-- Automatic replenishment of stock for stale pending orders
CREATE OR REPLACE FUNCTION public.release_stale_pending_orders(
  p_stale_hours integer DEFAULT 24
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stale_order record;
  v_item record;
  v_count integer := 0;
BEGIN
  FOR v_stale_order IN
    SELECT id, customer_phone
    FROM public.orders
    WHERE status = 'pending'
      AND created_at < (now() - (p_stale_hours || ' hours')::interval)
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Replenish stock for all items in the stale pending order
    FOR v_item IN
      SELECT product_id, quantity
      FROM public.order_items
      WHERE order_id = v_stale_order.id
    LOOP
      UPDATE public.products
      SET stock = stock + v_item.quantity, updated_at = now()
      WHERE id = v_item.product_id;

      INSERT INTO public.stock_movements (
        product_id, quantity, movement_type, reference_id, notes
      ) VALUES (
        v_item.product_id, v_item.quantity, 'adjustment', v_stale_order.id,
        'Auto-released inventory from expired pending order ' || v_stale_order.id
      );
    END LOOP;

    -- Cancel stale order
    UPDATE public.orders
    SET status = 'cancelled',
        cancel_reason = 'Payment/Confirmation timed out. Auto-cancelled after ' || p_stale_hours || ' hours.',
        updated_at = now()
    WHERE id = v_stale_order.id;

    INSERT INTO public.order_events (order_id, status, title, description)
    VALUES (
      v_stale_order.id, 'cancelled', 'Order Cancelled',
      'Inventory automatically released after order confirmation period expired.'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- 8. STOREFRONT FUNCTION EXECUTION ALLOWLIST
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.product_is_in_stock(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_products_v2(text, uuid[], numeric, numeric, boolean, text, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_products(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_id(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_verified_order(jsonb, jsonb, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_dealer_application(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dealer_application_by_code(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_descendant_ids(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_new_arrivals_by_category(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_unit_price(uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_keywords_array(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO anon, authenticated;

