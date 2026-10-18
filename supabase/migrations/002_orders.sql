-- ============================================================================
-- Migration: 002_orders.sql
-- Urbanrat Store — Orders Schema & Single-Order Public Access Policy
-- ============================================================================

-- 1. Create or update orders table
-- Supports custom order IDs formatted as URT-YYMMDD-XXXX (text primary key),
-- customer delivery details, and item price breakdown.

create table if not exists public.orders (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  customer jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  savings numeric(10, 2) not null default 0 check (savings >= 0),
  shipping numeric(10, 2) not null default 0 check (shipping >= 0),
  total numeric(10, 2) not null check (total >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  whatsapp_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- For existing deployments where orders table might already exist:
alter table public.orders alter column id type text;
alter table public.orders add column if not exists customer jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists subtotal numeric(10, 2) not null default 0;
alter table public.orders add column if not exists savings numeric(10, 2) not null default 0;
alter table public.orders add column if not exists shipping numeric(10, 2) not null default 0;

-- 2. Performance indexes
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_user_id on public.orders(user_id);

-- 3. Row Level Security (RLS)
alter table public.orders enable row level security;

-- Drop obsolete policies to avoid conflicts
drop policy if exists "Users can read own orders or admin reads all" on public.orders;
drop policy if exists "Users can insert orders" on public.orders;
drop policy if exists "Anyone can insert orders" on public.orders;
drop policy if exists "Admins can view all orders" on public.orders;
drop policy if exists "Users can view own orders" on public.orders;

-- Policy 1: Order Creation (Anyone can insert orders)
create policy "Anyone can insert orders"
  on public.orders for insert
  with check (true);

-- Policy 2: Admin Access (Admins can view and manage all orders)
create policy "Admins can view and manage all orders"
  on public.orders for all
  using (public.is_admin());

-- Policy 3: Authenticated Customer Access (Registered customers can list their own orders)
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() is not null and auth.uid() = user_id);

-- 4. Public Single-Order Read (NO listing all orders)
-- Unauthenticated users cannot list the table via SELECT * FROM orders.
-- Access to a specific order is strictly guarded via a security-definer RPC function
-- that requires an exact order ID parameter.
create or replace function public.get_order_by_id(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order jsonb;
begin
  select to_jsonb(o) into v_order
  from public.orders o
  where o.id = p_order_id;

  return v_order;
end;
$$;

grant execute on function public.get_order_by_id(text) to anon, authenticated;
