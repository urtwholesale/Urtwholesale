-- ============================================================================
-- Migration: 005_create_verified_order.sql
-- Description: Server-side Verified Order Creation with Inventory Locking,
--              Volume Pricing Tier Application, Automatic ID Generation,
--              Audit Events, and Direct-Insert Revocation.
-- ============================================================================

/*
--------------------------------------------------------------------------------
GUEST ABUSE MITIGATION: CLOUDFLARE TURNSTILE & EDGE FUNCTION RATE LIMITING
--------------------------------------------------------------------------------
Because this function is executable by the 'anon' role (enabling seamless
guest checkout without mandatory prior account registration), public endpoints
can be susceptible to bot spam, inventory locking attacks, or fake orders.

RECOMMENDED ARCHITECTURE FOR PRODUCTION HARDENING:
1. Cloudflare Turnstile Verification:
   - Embed Cloudflare Turnstile (<Turnstile siteKey="..." />) in CartPage.tsx.
   - On checkout submission, client obtains an ephemeral token `cf-turnstile-response`.
2. Supabase Edge Function Gateway (/functions/v1/create-order):
   - Rather than exposing the create_verified_order RPC directly to anon, routes
     guest requests through a Deno Edge Function.
   - Validates Turnstile token against Cloudflare Siteverify API:
       POST https://challenges.cloudflare.com/turnstile/v0/siteverify
       secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: client_ip
   - Enforces Redis / Upstash sliding window rate limiting (e.g. max 5 orders
     per 15 minutes per IP / device fingerprint).
   - Upon successful verification, the Edge Function invokes create_verified_order
     using the Supabase Service Role client or forwarded user context.
3. If keeping direct RPC invocation:
   - Pass an optional p_turnstile_token text parameter to the Edge Function wrapper.
--------------------------------------------------------------------------------
*/

-- ----------------------------------------------------------------------------
-- 1. FUNCTION: CREATE_VERIFIED_ORDER (Atomic order placement & validation)
-- ----------------------------------------------------------------------------
-- Drop previous versions to avoid function signature collisions
drop function if exists public.create_verified_order(text, jsonb, jsonb, text);
drop function if exists public.create_verified_order(jsonb, jsonb);
drop function if exists public.create_verified_order(jsonb, jsonb, text);

create or replace function public.create_verified_order(
  p_customer jsonb,
  p_items jsonb,
  p_whatsapp_message text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
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
begin
  -- 1. Validate Customer Payload
  if p_customer is null or jsonb_typeof(p_customer) <> 'object' then
    raise exception 'Invalid customer details provided';
  end if;

  v_cust_name := trim(coalesce(p_customer->>'name', ''));
  if length(v_cust_name) < 2 then
    raise exception 'Customer name is required (minimum 2 characters)';
  end if;

  -- Clean phone: strip non-digits, normalize 10-digit format
  v_raw_phone := regexp_replace(coalesce(p_customer->>'phone', ''), '\D', '', 'g');
  if length(v_raw_phone) = 12 and v_raw_phone like '91%' then
    v_cust_phone := substr(v_raw_phone, 3);
  elsif length(v_raw_phone) = 11 and v_raw_phone like '0%' then
    v_cust_phone := substr(v_raw_phone, 2);
  else
    v_cust_phone := v_raw_phone;
  end if;

  if v_cust_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Invalid 10-digit mobile number: %. Must be a valid Indian mobile number', coalesce(p_customer->>'phone', '');
  end if;

  v_cust_address := trim(coalesce(p_customer->>'address', ''));
  if length(v_cust_address) < 5 then
    raise exception 'Delivery address is required (minimum 5 characters)';
  end if;

  v_cust_pincode := trim(coalesce(p_customer->>'pincode', ''));
  if v_cust_pincode !~ '^[0-9]{6}$' then
    raise exception 'Invalid 6-digit postal PIN code: %', coalesce(p_customer->>'pincode', '');
  end if;

  v_sanitized_customer := jsonb_build_object(
    'name', v_cust_name,
    'phone', v_cust_phone,
    'address', v_cust_address,
    'pincode', v_cust_pincode
  );

  -- 2. Validate Items Array
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be a valid list';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  if v_item_count > 50 then
    raise exception 'Order cannot exceed maximum limit of 50 item lines';
  end if;

  -- 3. Read Store Shipping Settings
  select coalesce((value#>>'{}')::numeric, 999) into v_free_delivery_min
  from public.store_settings
  where key = 'free_delivery_min';

  if v_free_delivery_min is null then
    v_free_delivery_min := 999;
  end if;

  select coalesce((value#>>'{}')::numeric, 49) into v_shipping_fee
  from public.store_settings
  where key = 'shipping_fee';

  if v_shipping_fee is null then
    v_shipping_fee := 49;
  end if;

  -- 4. Process Each Item (Lock row, validate rules, compute tiers)
  for v_item in
    select
      (elem->>'product_id')::uuid as product_id,
      coalesce((elem->>'qty')::integer, (elem->>'quantity')::integer, 0) as qty
    from jsonb_array_elements(p_items) as elem
  loop
    v_qty := v_item.qty;

    if v_item.product_id is null then
      raise exception 'Missing product ID in order item';
    end if;

    if v_qty <= 0 then
      raise exception 'Quantity must be greater than zero';
    end if;

    -- Lock the product row FOR UPDATE to prevent race conditions & overselling
    select * into v_product
    from public.products
    where id = v_item.product_id
    for update;

    if not found then
      raise exception 'Product % not found in catalog', v_item.product_id;
    end if;

    if not v_product.is_active then
      raise exception 'Product "%" is inactive and unavailable for ordering', v_product.name;
    end if;

    if v_qty < coalesce(v_product.min_order_qty, 1) then
      raise exception 'Quantity % for "%" is below minimum order quantity of %',
        v_qty, v_product.name, coalesce(v_product.min_order_qty, 1);
    end if;

    if coalesce(v_product.order_qty_step, 1) > 1 and (v_qty % v_product.order_qty_step <> 0) then
      raise exception 'Quantity % for "%" must be an exact multiple of %',
        v_qty, v_product.name, v_product.order_qty_step;
    end if;

    if v_qty > v_product.stock then
      raise exception 'Insufficient stock for "%". Requested %, only % available',
        v_product.name, v_qty, v_product.stock;
    end if;

    -- Compute true unit price based on volume tiers
    v_unit_price := public.get_unit_price(v_product.id, v_qty);

    -- Find first-tier base price for calculating savings
    select unit_price into v_first_tier_price
    from public.product_price_tiers
    where product_id = v_product.id
    order by min_qty asc
    limit 1;

    v_first_tier_price := coalesce(v_first_tier_price, v_product.price);

    -- Find tier min_qty applied
    select min_qty into v_applied_min_qty
    from public.product_price_tiers
    where product_id = v_product.id and min_qty <= v_qty
    order by min_qty desc
    limit 1;

    v_applied_min_qty := coalesce(v_applied_min_qty, coalesce(v_product.min_order_qty, 1));

    -- Calculate line financial metrics
    v_line_total := v_unit_price * v_qty;
    v_line_savings := greatest(0, (v_first_tier_price - v_unit_price) * v_qty);

    v_subtotal := v_subtotal + v_line_total;
    v_total_savings := v_total_savings + v_line_savings;

    -- Build snapshot item object matching existing store & public view schema
    v_order_items := v_order_items || jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'price', v_unit_price,
      'unit_price', v_unit_price,
      'quantity', v_qty,
      'line_total', v_line_total,
      'tier_min_qty', v_applied_min_qty,
      'mrp', v_product.mrp,
      'sku', v_product.sku,
      'image', coalesce(v_product.images[1], null)
    );
  end loop;

  -- 5. Calculate Final Shipping and Grand Total
  if v_subtotal >= v_free_delivery_min then
    v_shipping := 0;
  else
    v_shipping := v_shipping_fee;
  end if;

  v_total := v_subtotal + v_shipping;

  -- 6. Generate Unique Order ID (URT-YYMMDD-XXXX) with Collision Retry
  v_date_prefix := 'URT-' || to_char(now(), 'YYMMDD') || '-';

  for v_attempt in 1..10 loop
    v_rand := '';
    for i in 1..4 loop
      v_rand := v_rand || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    end loop;
    v_order_id := v_date_prefix || v_rand;

    if not exists (select 1 from public.orders where id = v_order_id) then
      exit;
    end if;

    if v_attempt = 10 then
      v_order_id := v_date_prefix || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    end if;
  end loop;

  v_whatsapp_msg := coalesce(
    p_whatsapp_message,
    'Order ' || v_order_id || ' placed by ' || v_cust_name || ' (' || v_cust_phone || '). Total: ₹' || v_total::text
  );

  -- 7. Insert Order Row
  insert into public.orders (
    id,
    user_id,
    customer,
    items,
    subtotal,
    savings,
    shipping,
    total,
    status,
    whatsapp_message,
    created_at,
    updated_at
  )
  values (
    v_order_id,
    v_user_id,
    v_sanitized_customer,
    v_order_items,
    v_subtotal,
    v_total_savings,
    v_shipping,
    v_total,
    'pending',
    v_whatsapp_msg,
    now(),
    now()
  )
  returning * into v_created_order;

  -- 8. Insert Initial Order Event
  insert into public.order_events (
    order_id,
    status,
    note,
    created_by
  )
  values (
    v_order_id,
    'pending',
    'Order created with server-verified prices and inventory reservation',
    v_user_id
  );

  -- 9. Decrement Inventory & Record Stock Movements
  for v_item in
    select
      (elem->>'product_id')::uuid as product_id,
      (elem->>'quantity')::integer as quantity
    from jsonb_array_elements(v_order_items) as elem
  loop
    update public.products
    set
      stock = stock - v_item.quantity,
      updated_at = now()
    where id = v_item.product_id;

    insert into public.stock_movements (
      product_id,
      change,
      reason,
      order_id,
      admin_id
    )
    values (
      v_item.product_id,
      -v_item.quantity,
      'Order placed: ' || v_order_id,
      v_order_id,
      null
    );
  end loop;

  -- 10. Return the full order row
  return v_created_order;
end;
$$;

-- Grant execution to anon (guests) and authenticated (registered customers)
grant execute on function public.create_verified_order(jsonb, jsonb, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. SECURITY HARDENING: REVOKE DIRECT INSERT & DROP WIDE OPEN POLICY
-- ----------------------------------------------------------------------------
-- Drop wide-open INSERT policies on public.orders
drop policy if exists "Anyone can insert orders" on public.orders;
drop policy if exists "Users can insert orders" on public.orders;

-- Revoke direct INSERT privileges from anon and authenticated roles
revoke insert on public.orders from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. PUBLIC SINGLE-ORDER LOOKUP POLICY VERIFICATION
-- ----------------------------------------------------------------------------
-- The existing get_order_by_id(p_order_id text) function is a SECURITY DEFINER
-- function that looks up an order by exact ID without exposing the table to SELECT *.
-- Ensure permissions are actively granted to anon and authenticated:
grant execute on function public.get_order_by_id(text) to anon, authenticated;
