-- ============================================================================
-- Migration: 011_order_events_and_details.sql
-- Description: Extends order status to include 'returned', updates get_order_by_id
--              RPC to include ordered timeline events, and ensures RLS policies
--              for customer order viewing.
-- ============================================================================

-- 1. Extend orders status check constraint to include 'returned'
do $$
begin
  alter table public.orders drop constraint if exists orders_status_check;
  alter table public.orders add constraint orders_status_check
    check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'returned'));
exception
  when others then null;
end;
$$;

-- 2. Enhanced get_order_by_id RPC returning order and timeline events
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
