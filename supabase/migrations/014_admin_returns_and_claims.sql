-- ============================================================================
-- Migration: 014_admin_returns_and_claims.sql
-- Description: Supplier Hub Returns & Claims Backend:
--              1. Adds claim tracking columns to return_requests
--              2. RPC admin_update_return_claim with audit logging
--              3. RPC get_product_return_performance for returns analytics
--              4. RPC admin_get_returns_pending_count for live badges
--              5. Enhances get_return_stats with pending_actions & qc_failed counts
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD CLAIM TRACKING COLUMNS TO return_requests
-- ----------------------------------------------------------------------------
alter table public.return_requests
  add column if not exists claim_status text not null default 'none'
  check (claim_status in ('none', 'pending', 'approved', 'rejected', 'settled'));

alter table public.return_requests
  add column if not exists claim_type text
  check (claim_type in ('courier', 'supplier', 'transit_damage', 'customer_fraud', 'other'));

alter table public.return_requests
  add column if not exists claim_amount numeric(10, 2) not null default 0
  check (claim_amount >= 0);

alter table public.return_requests
  add column if not exists claim_reference text;

alter table public.return_requests
  add column if not exists claim_notes text;

alter table public.return_requests
  add column if not exists claim_filed_at timestamptz;

alter table public.return_requests
  add column if not exists claim_settled_at timestamptz;

create index if not exists idx_return_requests_claim_status on public.return_requests(claim_status);
create index if not exists idx_return_requests_claim_type on public.return_requests(claim_type);

-- ----------------------------------------------------------------------------
-- 2. RPC: admin_update_return_claim
-- Updates claim parameters for courier or supplier reimbursement and writes audit event
-- ----------------------------------------------------------------------------
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
set search_path = public
as $$
declare
  v_return public.return_requests%rowtype;
  v_old_status text;
  v_now timestamptz := now();
  v_audit_note text;
begin
  -- 1. Admin check
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can update return claims';
  end if;

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

grant execute on function public.admin_update_return_claim(uuid, text, numeric, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. RPC: admin_get_returns_pending_count
-- Returns active counts of returns needing review or QC inspection for badges
-- ----------------------------------------------------------------------------
create or replace function public.admin_get_returns_pending_count()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested_count integer := 0;
  v_received_count integer := 0;
  v_qc_failed_count integer := 0;
  v_pending_claims_count integer := 0;
begin
  if not public.is_admin() then
    return jsonb_build_object(
      'total_pending', 0,
      'requested_count', 0,
      'received_count', 0,
      'qc_failed_count', 0,
      'pending_claims_count', 0
    );
  end if;

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

grant execute on function public.admin_get_returns_pending_count() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPC: get_product_return_performance
-- Computes delivered orders vs returns per product with high-return threshold flags
-- ----------------------------------------------------------------------------
create or replace function public.get_product_return_performance(
  p_days integer default 30,
  p_category_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := coalesce(p_days, 30);
  v_start_date timestamptz;
  v_result jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can view product return performance';
  end if;

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

grant execute on function public.get_product_return_performance(integer, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. UPDATE get_return_stats TO INCLUDE PENDING ACTIONS & QC FAILED COUNTS
-- ----------------------------------------------------------------------------
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
  v_pending_actions integer := 0;
  v_qc_failed_count integer := 0;
  v_claims_count integer := 0;
  v_claims_value numeric(10, 2) := 0;
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
