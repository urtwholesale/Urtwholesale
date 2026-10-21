-- ============================================================================
-- Migration: 012_returns_backend.sql
-- Description: Comprehensive wholesale returns, replacements, and refunds backend:
--              1. return_requests, return_items, return_events tables
--              2. Private 'return-evidence' storage bucket for photos/videos with RLS
--              3. Configurable return_window_days in store_settings
--              4. Validated RPCs: create_return_request, admin_update_return_status, get_return_stats
--              5. Row Level Security policies for customers (own rows) and admins (all)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STORE SETTINGS: return_window_days
-- ----------------------------------------------------------------------------
insert into public.store_settings (key, value, description)
values (
  'return_window_days',
  '7'::jsonb,
  'Configurable customer return, replacement, and refund window in days from order delivery'
)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 2. TABLE: return_requests
-- ----------------------------------------------------------------------------
create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  return_code text not null unique,
  order_id text not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('return', 'replacement', 'refund')),
  status text not null default 'requested' check (
    status in (
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
    )
  ),
  reason_code text not null check (
    reason_code in (
      'damaged',
      'defective',
      'wrong_item',
      'short_quantity',
      'quality_issue',
      'other'
    )
  ),
  description text,
  evidence_paths text[] not null default '{}'::text[],
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  refund_amount numeric(10, 2) not null default 0 check (refund_amount >= 0),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_return_requests_order_id on public.return_requests(order_id);
create index if not exists idx_return_requests_user_id on public.return_requests(user_id);
create index if not exists idx_return_requests_status on public.return_requests(status);
create index if not exists idx_return_requests_return_code on public.return_requests(return_code);
create index if not exists idx_return_requests_created_at on public.return_requests(created_at desc);

-- Auto-update updated_at trigger
drop trigger if exists trigger_return_requests_updated_at on public.return_requests;
create trigger trigger_return_requests_updated_at
  before update on public.return_requests
  for each row execute procedure public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 3. TABLE: return_items
-- ----------------------------------------------------------------------------
create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  order_item_id text,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  reason_code text not null check (
    reason_code in (
      'damaged',
      'defective',
      'wrong_item',
      'short_quantity',
      'quality_issue',
      'other'
    )
  ),
  condition text not null default 'unopened',
  created_at timestamptz not null default now()
);

create index if not exists idx_return_items_return_id on public.return_items(return_id);
create index if not exists idx_return_items_product_id on public.return_items(product_id);

-- ----------------------------------------------------------------------------
-- 4. TABLE: return_events (Audit Trail)
-- ----------------------------------------------------------------------------
create table if not exists public.return_events (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  status text not null check (
    status in (
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
    )
  ),
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_return_events_return_id on public.return_events(return_id);
create index if not exists idx_return_events_created_at on public.return_events(created_at desc);

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

-- Enable RLS on all return tables
alter table public.return_requests enable row level security;
alter table public.return_items enable row level security;
alter table public.return_events enable row level security;

-- Policies: return_requests
drop policy if exists "Customers can view own return requests" on public.return_requests;
create policy "Customers can view own return requests"
  on public.return_requests for select
  using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "Admins can view and manage all return requests" on public.return_requests;
create policy "Admins can view and manage all return requests"
  on public.return_requests for all
  using (public.is_admin());

-- Policies: return_items
drop policy if exists "Customers can view own return items" on public.return_items;
create policy "Customers can view own return items"
  on public.return_items for select
  using (
    exists (
      select 1 from public.return_requests r
      where r.id = return_items.return_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can view and manage all return items" on public.return_items;
create policy "Admins can view and manage all return items"
  on public.return_items for all
  using (public.is_admin());

-- Policies: return_events
drop policy if exists "Customers can view own return events" on public.return_events;
create policy "Customers can view own return events"
  on public.return_events for select
  using (
    exists (
      select 1 from public.return_requests r
      where r.id = return_events.return_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can view and manage all return events" on public.return_events;
create policy "Admins can view and manage all return events"
  on public.return_events for all
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. STORAGE BUCKET: return-evidence (Private)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'return-evidence',
  'return-evidence',
  false, -- Private bucket
  20971520, -- 20 MB file size limit
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ];

-- Storage RLS on storage.objects for return-evidence
drop policy if exists "Customers can upload own return evidence" on storage.objects;
create policy "Customers can upload own return evidence"
  on storage.objects for insert
  with check (
    bucket_id = 'return-evidence'
    and auth.uid() is not null
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Customers can view own return evidence" on storage.objects;
create policy "Customers can view own return evidence"
  on storage.objects for select
  using (
    bucket_id = 'return-evidence'
    and auth.uid() is not null
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Admins have full access to return evidence" on storage.objects;
create policy "Admins have full access to return evidence"
  on storage.objects for all
  using (
    bucket_id = 'return-evidence'
    and public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 7. RPC: create_return_request
-- ----------------------------------------------------------------------------
-- Validates:
-- - User authentication (must match order.user_id)
-- - Order must be 'delivered'
-- - Order delivery must be within store_settings.return_window_days (default 7)
-- - Type in ('return', 'replacement', 'refund')
-- - Reason in ('damaged', 'defective', 'wrong_item', 'short_quantity', 'quality_issue', 'other')
-- - Item quantities cannot exceed (delivered quantity - already requested/returned quantity)
-- - Generates unique RET-YYMMDD-XXXX return code
-- - Atomically creates return_requests, return_items, and audit return_events
create or replace function public.create_return_request(
  p_order_id text,
  p_items jsonb,
  p_type text,
  p_reason text,
  p_description text default null,
  p_evidence_paths text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
begin
  -- 1. Authentication check
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required to create a return request';
  end if;

  -- 2. Validate Order existence and ownership
  select * into v_order
  from public.orders
  where id = trim(p_order_id);

  if not found then
    raise exception 'Order not found: %', p_order_id;
  end if;

  if v_order.user_id is null or v_order.user_id != v_user_id then
    raise exception 'Unauthorized: You can only request returns for your own orders';
  end if;

  -- 3. Only delivered orders can be returned
  if v_order.status != 'delivered' then
    raise exception 'Returns can only be requested for delivered orders. Current order status: %', v_order.status;
  end if;

  -- 4. Check return window (store_settings.return_window_days, default 7)
  select coalesce((value#>>'{}')::integer, 7) into v_window_days
  from public.store_settings
  where key = 'return_window_days';

  if v_window_days is null or v_window_days <= 0 then
    v_window_days := 7;
  end if;

  -- Find exact delivery timestamp from order_events or fallback to order update time
  select created_at into v_delivered_at
  from public.order_events
  where order_id = v_order.id and status = 'delivered'
  order by created_at desc
  limit 1;

  if v_delivered_at is null then
    v_delivered_at := coalesce(v_order.updated_at, v_order.created_at);
  end if;

  if (now() - v_delivered_at) > (v_window_days || ' days')::interval then
    raise exception 'Return window of % days expired on %',
      v_window_days,
      to_char(v_delivered_at + (v_window_days || ' days')::interval, 'YYYY-MM-DD HH24:MI');
  end if;

  -- 5. Validate Type and Reason
  if p_type not in ('return', 'replacement', 'refund') then
    raise exception 'Invalid return type: %. Allowed: return, replacement, refund', p_type;
  end if;

  if p_reason not in ('damaged', 'defective', 'wrong_item', 'short_quantity', 'quality_issue', 'other') then
    raise exception 'Invalid reason code: %. Allowed: damaged, defective, wrong_item, short_quantity, quality_issue, other', p_reason;
  end if;

  -- 6. Validate Items payload
  if p_items is null or jsonb_typeof(p_items) != 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item must be specified for return';
  end if;

  -- 7. Generate Unique Return Code (RET-YYMMDD-XXXX)
  v_date_prefix := 'RET-' || to_char(now(), 'YYMMDD') || '-';

  for v_attempt in 1..10 loop
    v_rand := '';
    for i in 1..4 loop
      v_rand := v_rand || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    end loop;
    v_return_code := v_date_prefix || v_rand;

    if not exists (select 1 from public.return_requests where return_code = v_return_code) then
      exit;
    end if;

    if v_attempt = 10 then
      v_return_code := v_date_prefix || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    end if;
  end loop;

  -- 8. Create return_requests row
  insert into public.return_requests (
    return_code,
    order_id,
    user_id,
    type,
    status,
    reason_code,
    description,
    evidence_paths,
    requested_at
  )
  values (
    v_return_code,
    v_order.id,
    v_user_id,
    p_type,
    'requested',
    p_reason,
    p_description,
    coalesce(p_evidence_paths, '{}'::text[]),
    now()
  )
  returning id into v_return_id;

  -- 9. Validate each requested product quantity against delivered - already returned
  for v_req_item in
    select
      (elem->>'product_id')::uuid as product_id,
      sum(coalesce((elem->>'quantity')::integer, 0)) as quantity,
      max(elem->>'order_item_id') as order_item_id,
      max(coalesce(elem->>'reason_code', p_reason)) as reason_code,
      max(coalesce(elem->>'condition', 'unopened')) as condition
    from jsonb_array_elements(p_items) as elem
    group by (elem->>'product_id')::uuid
  loop
    if v_req_item.product_id is null or v_req_item.quantity <= 0 then
      raise exception 'Each return item must have a valid product_id and positive quantity';
    end if;

    -- Get product name and verify it was in original order items
    select name into v_prod_name from public.products where id = v_req_item.product_id;
    if v_prod_name is null then
      raise exception 'Product % not found in catalog', v_req_item.product_id;
    end if;

    -- Calculate total delivered quantity from orders.items
    select coalesce(sum((item->>'quantity')::integer), 0) into v_delivered_qty
    from jsonb_array_elements(v_order.items) as item
    where (item->>'product_id')::uuid = v_req_item.product_id;

    if v_delivered_qty = 0 then
      raise exception 'Product "%" was not part of delivered order #%', v_prod_name, v_order.id;
    end if;

    -- Calculate already returned/requested quantity across active return requests (excluding rejected)
    select coalesce(sum(ri.quantity), 0) into v_already_returned_qty
    from public.return_items ri
    join public.return_requests rr on rr.id = ri.return_id
    where rr.order_id = v_order.id
      and ri.product_id = v_req_item.product_id
      and rr.id != v_return_id
      and rr.status != 'rejected';

    v_available_qty := v_delivered_qty - v_already_returned_qty;

    if v_req_item.quantity > v_available_qty then
      raise exception 'Requested return quantity (%) for "%" exceeds eligible quantity (Delivered: %, Already requested: %, Remaining: %)',
        v_req_item.quantity,
        v_prod_name,
        v_delivered_qty,
        v_already_returned_qty,
        greatest(0, v_available_qty);
    end if;

    -- Insert into return_items
    insert into public.return_items (
      return_id,
      order_item_id,
      product_id,
      quantity,
      reason_code,
      condition
    )
    values (
      v_return_id,
      v_req_item.order_item_id,
      v_req_item.product_id,
      v_req_item.quantity,
      v_req_item.reason_code,
      v_req_item.condition
    );
  end loop;

  -- 10. Write initial audit event to return_events
  insert into public.return_events (
    return_id,
    status,
    note,
    actor_id,
    created_at
  )
  values (
    v_return_id,
    'requested',
    coalesce(p_description, 'Return request ' || v_return_code || ' submitted by customer'),
    v_user_id,
    now()
  );

  -- 11. Also notify order_events audit trail
  insert into public.order_events (
    order_id,
    status,
    note,
    created_by
  )
  values (
    v_order.id,
    'returned',
    'Customer submitted ' || p_type || ' request ' || v_return_code || ' (Reason: ' || p_reason || ')',
    v_user_id
  );

  -- Return complete payload
  return jsonb_build_object(
    'id', v_return_id,
    'return_code', v_return_code,
    'order_id', v_order.id,
    'user_id', v_user_id,
    'type', p_type,
    'status', 'requested',
    'reason_code', p_reason,
    'description', p_description,
    'evidence_paths', p_evidence_paths,
    'requested_at', now()
  );
end;
$$;

grant execute on function public.create_return_request(text, jsonb, text, text, text, text[]) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. RPC: admin_update_return_status
-- ----------------------------------------------------------------------------
-- Validates:
-- - Only administrators can call (public.is_admin())
-- - Valid allowed transitions
-- - Logs transition to return_events
-- - When new_status = 'qc_passed' and type = 'return', optionally restocks via admin_adjust_stock
-- - Updates refund_amount and resolved_at
create or replace function public.admin_update_return_status(
  p_return_id uuid,
  p_new_status text,
  p_note text default null,
  p_refund_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return record;
  v_ret_item record;
  v_is_valid_transition boolean := false;
  v_items_restocked integer := 0;
begin
  -- 1. Administrator check
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can update return requests';
  end if;

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

grant execute on function public.admin_update_return_status(uuid, text, text, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- 9. RPC: get_return_stats
-- ----------------------------------------------------------------------------
-- Returns aggregate business metrics:
-- - total returns
-- - return rate % (returns / delivered orders * 100)
-- - refunds value
-- - top returned products
-- - reason breakdown
-- - by status breakdown
create or replace function public.get_return_stats(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
begin
  -- 1. Administrator authorization check
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can view return statistics';
  end if;

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

  -- 7. Reason Breakdown
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

  -- 8. Top Returned Products
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

  -- 9. Return structured results
  return jsonb_build_object(
    'period_days', v_days,
    'start_date', v_start_date,
    'end_date', now(),
    'total_returns', v_total_returns,
    'total_delivered_orders', v_total_delivered_orders,
    'return_rate_percentage', v_return_rate,
    'total_refunds_value', v_refunds_value,
    'by_status', v_by_status,
    'reason_breakdown', v_reasons,
    'top_returned_products', v_top_products
  );
end;
$$;

grant execute on function public.get_return_stats(integer) to authenticated;
