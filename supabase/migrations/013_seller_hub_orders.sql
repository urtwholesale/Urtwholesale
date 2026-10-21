-- ============================================================================
-- Migration: 013_seller_hub_orders.sql
-- Description: Upgrades orders system for Seller Hub:
--              1. Adds 'on_hold' to orders status check constraint
--              2. Adds source, payment_status, courier_name, awb_number to orders
--              3. Updates admin_update_order_status to support 'on_hold' and 'returned'
--              4. Adds admin_update_order_shipping RPC for courier and AWB updates
--              5. Adds get_customer_lifetime_stats RPC for customer lifetime spend
--              6. Adds admin_get_order_notice_counts RPC for real-time seller notices
-- ============================================================================

-- 1. Extend orders status check constraint to include 'on_hold'
do $$
begin
  alter table public.orders drop constraint if exists orders_status_check;
  alter table public.orders add constraint orders_status_check
    check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'returned', 'on_hold'));
exception
  when others then null;
end;
$$;

-- 2. Add Seller Hub columns to public.orders
alter table public.orders add column if not exists source text not null default 'website';
alter table public.orders add column if not exists payment_status text not null default 'pending';
alter table public.orders add column if not exists courier_name text;
alter table public.orders add column if not exists awb_number text;

-- Performance indexes for Seller Hub filtering
create index if not exists idx_orders_source on public.orders(source);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_awb on public.orders(awb_number) where awb_number is not null;

-- 3. Enhanced admin_update_order_status supporting 'on_hold' and 'returned'
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

grant execute on function public.admin_update_order_status(text, text, text) to authenticated;

-- 4. Update order shipping details (courier & AWB)
create or replace function public.admin_update_order_shipping(
  p_order_id text,
  p_courier_name text,
  p_awb_number text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can update shipping info';
  end if;

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

grant execute on function public.admin_update_order_shipping(text, text, text, text) to authenticated;

-- 5. Customer lifetime statistics RPC
create or replace function public.get_customer_lifetime_stats(
  p_phone text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stats jsonb;
  v_clean_phone text;
begin
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

grant execute on function public.get_customer_lifetime_stats(text, uuid) to anon, authenticated;

-- 6. Real-data seller hub notice counts
create or replace function public.admin_get_order_notice_counts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delayed_pending integer := 0;
  v_low_stock_count integer := 0;
  v_ready_to_ship_count integer := 0;
  v_on_hold_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

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

grant execute on function public.admin_get_order_notice_counts() to authenticated;

-- 7. Update get_order_by_id RPC to include new Seller Hub columns
create or replace function public.get_order_by_id(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order jsonb;
begin
  select
    jsonb_build_object(
      'id', o.id,
      'user_id', o.user_id,
      'customer', o.customer,
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
      'admin_note', o.admin_note,
      'whatsapp_message', o.whatsapp_message,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'events', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'order_id', e.order_id,
            'status', e.status,
            'note', e.note,
            'created_at', e.created_at
          ) order by e.created_at asc
        ), '[]'::jsonb)
        from public.order_events e
        where e.order_id = o.id
      )
    ) into v_order
  from public.orders o
  where o.id = trim(p_order_id);

  return v_order;
end;
$$;

grant execute on function public.get_order_by_id(text) to anon, authenticated;
