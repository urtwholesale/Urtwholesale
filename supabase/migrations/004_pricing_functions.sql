-- ============================================================================
-- Migration: 004_pricing_functions.sql
-- Description: Triggers, Pricing Logic, Search, Inventory Adjustments,
--              Order Status Transitions with Stock Restoration, & Admin Analytics
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRIGGER: SYNC PRODUCTS.PRICE FROM LOWEST PRODUCT_PRICE_TIER
-- ----------------------------------------------------------------------------
-- Automatically sets products.price to the unit_price of the tier with the
-- lowest min_qty for that product after insert, update, or delete on tiers.

create or replace function public.sync_product_price_from_tiers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_lowest_price numeric(10, 2);
begin
  -- For DELETE or UPDATE, process the old product
  if tg_op = 'DELETE' or tg_op = 'UPDATE' then
    v_product_id := old.product_id;
    select unit_price into v_lowest_price
    from public.product_price_tiers
    where product_id = v_product_id
    order by min_qty asc
    limit 1;

    if v_lowest_price is not null then
      update public.products
      set price = v_lowest_price, updated_at = now()
      where id = v_product_id;
    end if;
  end if;

  -- For INSERT or UPDATE, process the new product
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    v_product_id := new.product_id;
    select unit_price into v_lowest_price
    from public.product_price_tiers
    where product_id = v_product_id
    order by min_qty asc
    limit 1;

    if v_lowest_price is not null then
      update public.products
      set price = v_lowest_price, updated_at = now()
      where id = v_product_id;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trigger_sync_product_price_tiers on public.product_price_tiers;
create trigger trigger_sync_product_price_tiers
  after insert or update or delete on public.product_price_tiers
  for each row execute function public.sync_product_price_from_tiers();

-- ----------------------------------------------------------------------------
-- 2. TRIGGER: RECOMPUTE RATINGS FROM APPROVED REVIEWS ONLY
-- ----------------------------------------------------------------------------
-- Recomputes products.rating_avg and products.rating_count from approved reviews.

create or replace function public.sync_product_review_ratings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_avg numeric(2, 1);
  v_count integer;
begin
  if tg_op = 'DELETE' or tg_op = 'UPDATE' then
    v_product_id := old.product_id;
    select
      coalesce(round(avg(rating)::numeric, 1), 0),
      count(*)
    into v_avg, v_count
    from public.reviews
    where product_id = v_product_id and status = 'approved';

    update public.products
    set
      rating_avg = v_avg,
      rating_count = v_count,
      updated_at = now()
    where id = v_product_id;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    v_product_id := new.product_id;
    select
      coalesce(round(avg(rating)::numeric, 1), 0),
      count(*)
    into v_avg, v_count
    from public.reviews
    where product_id = v_product_id and status = 'approved';

    update public.products
    set
      rating_avg = v_avg,
      rating_count = v_count,
      updated_at = now()
    where id = v_product_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trigger_sync_product_reviews on public.reviews;
create trigger trigger_sync_product_reviews
  after insert or update or delete on public.reviews
  for each row execute function public.sync_product_review_ratings();

-- ----------------------------------------------------------------------------
-- 3. FUNCTION: GET_UNIT_PRICE
-- ----------------------------------------------------------------------------
-- Returns applicable tier unit price for a given product and quantity.
-- Picks tier with highest min_qty <= p_qty. Raises exception if p_qty < min_order_qty
-- or product is inactive.

create or replace function public.get_unit_price(
  p_product_id uuid,
  p_qty integer
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_active boolean;
  v_min_order_qty integer;
  v_base_price numeric(10, 2);
  v_unit_price numeric(10, 2);
begin
  select is_active, coalesce(min_order_qty, 1), price
  into v_is_active, v_min_order_qty, v_base_price
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found: %', p_product_id;
  end if;

  if not v_is_active then
    raise exception 'Product is inactive: %', p_product_id;
  end if;

  if p_qty < v_min_order_qty then
    raise exception 'Quantity % is below minimum order quantity % for product %',
      p_qty, v_min_order_qty, p_product_id;
  end if;

  -- Pick highest min_qty tier where min_qty <= p_qty
  select unit_price into v_unit_price
  from public.product_price_tiers
  where product_id = p_product_id and min_qty <= p_qty
  order by min_qty desc
  limit 1;

  if v_unit_price is null then
    v_unit_price := v_base_price;
  end if;

  return v_unit_price;
end;
$$;

grant execute on function public.get_unit_price(uuid, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. FUNCTION: ADMIN_SAVE_PRODUCT_TIERS
-- ----------------------------------------------------------------------------
-- Atomically validates and saves product price tiers.
-- Validations:
--   - Admin role check
--   - At least 1 tier provided
--   - All min_qty unique and >= 1
--   - First tier min_qty equals products.min_order_qty
--   - unit_price strictly non-increasing as min_qty increases
--   - No unit_price above product.mrp (when mrp is set)

create or replace function public.admin_save_product_tiers(
  p_product_id uuid,
  p_tiers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_tier record;
  v_index integer := 0;
  v_prev_min_qty integer := 0;
  v_prev_price numeric(10, 2) := null;
  v_count integer;
begin
  -- 1. Authorization check
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can modify product price tiers';
  end if;

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

grant execute on function public.admin_save_product_tiers(uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. FUNCTION: SEARCH_PRODUCTS (pg_trgm + ILIKE with GIN index)
-- ----------------------------------------------------------------------------
-- Enables pg_trgm extension and adds GIN trigram index on products.name
create extension if not exists pg_trgm;

create index if not exists idx_products_name_trgm on public.products using gin (name gin_trgm_ops);

create or replace function public.search_products(
  q text,
  max_rows integer default 8
)
returns setof public.products
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.products
  where is_active = true
    and (
      name ilike ('%' || trim(q) || '%')
      or (sku is not null and sku ilike ('%' || trim(q) || '%'))
      or similarity(name, trim(q)) > 0.15
    )
  order by
    case
      when name ilike (trim(q) || '%') then 1
      when name ilike ('%' || trim(q) || '%') then 2
      when sku is not null and sku ilike (trim(q) || '%') then 3
      else 4
    end,
    similarity(name, trim(q)) desc,
    is_featured desc,
    created_at desc
  limit coalesce(max_rows, 8);
$$;

grant execute on function public.search_products(text, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. FUNCTION: ADMIN_ADJUST_STOCK
-- ----------------------------------------------------------------------------
-- Admin-only inventory stock adjustment. Updates products.stock (never below 0)
-- and writes an audit row to stock_movements.

create or replace function public.admin_adjust_stock(
  p_product_id uuid,
  p_change integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_stock integer;
  v_new_stock integer;
  v_product_name text;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can adjust inventory stock';
  end if;

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

grant execute on function public.admin_adjust_stock(uuid, integer, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. FUNCTION: ADMIN_UPDATE_ORDER_STATUS
-- ----------------------------------------------------------------------------
-- Admin-only order status transition.
-- Validates allowed status list ('pending', 'confirmed', 'processing',
-- 'shipped', 'delivered', 'cancelled', 'refunded'), writes order_events.
-- When moving to 'cancelled' or 'refunded' from a non-cancelled state:
--   RESTORES inventory stock for every product in orders.items and writes
--   stock_movements records. Guaranteed never to restore twice.

create or replace function public.admin_update_order_status(
  p_order_id text,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_item record;
  v_should_restore boolean := false;
  v_items_restored integer := 0;
begin
  -- 1. Authorization check
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can update order statuses';
  end if;

  -- 2. Status validation
  if p_status not in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') then
    raise exception 'Invalid status: %. Allowed: pending, confirmed, processing, shipped, delivered, cancelled, refunded', p_status;
  end if;

  -- 3. Retrieve order
  select * into v_order
  from public.orders
  where id = p_order_id;

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
          -- Log stock movement
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
  where id = p_order_id;

  -- 6. Insert audit event into order_events
  insert into public.order_events (order_id, status, note, created_by)
  values (
    p_order_id,
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

grant execute on function public.admin_update_order_status(text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. ADMIN DASHBOARD RPCS (Excludes cancelled & refunded from revenue)
-- ----------------------------------------------------------------------------

-- 8A. admin_dashboard_stats
-- Computes revenue, order_count, avg_order_value, pending_count, low_stock_count,
-- and new_customers for given period [p_from, p_to] and the previous equal-length period.
create or replace function public.admin_dashboard_stats(
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can view dashboard analytics';
  end if;

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

grant execute on function public.admin_dashboard_stats(date, date) to authenticated;

-- 8B. admin_sales_by_day
-- Daily revenue and order counts for date range, including zero-order days.
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
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can view sales by day';
  end if;

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

grant execute on function public.admin_sales_by_day(date, date) to authenticated;

-- 8C. admin_orders_by_status
-- Aggregated orders distribution by lifecycle status.
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
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can view orders by status';
  end if;

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

grant execute on function public.admin_orders_by_status(date, date) to authenticated;

-- 8D. admin_top_products
-- Top performing products derived from orders.items JSON array elements.
-- Key names read from orders.items: product_id, name, quantity, price, image.
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
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can view top products';
  end if;

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

grant execute on function public.admin_top_products(date, date, integer) to authenticated;
