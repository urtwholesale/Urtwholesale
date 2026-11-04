-- ============================================================================
-- Migration: 028_marquee_announcements.sql
-- Description: Table, RLS policies, triggers, and seed data for dynamic
--              admin-managed continuous marquee announcements and offers.
-- ============================================================================

create table if not exists public.marquee_announcements (
  id uuid primary key default gen_random_uuid(),
  badge text not null default 'WHOLESALE',
  title text not null,
  subtitle text not null default '',
  icon text not null default 'Sparkles',
  link_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for ordering active marquee items
create index if not exists idx_marquee_announcements_active_sort
  on public.marquee_announcements (is_active, sort_order);

-- Enable RLS
alter table public.marquee_announcements enable row level security;

-- Generic updated_at trigger
drop trigger if exists trigger_marquee_announcements_updated_at on public.marquee_announcements;
create trigger trigger_marquee_announcements_updated_at
  before update on public.marquee_announcements
  for each row execute function public.set_updated_at();

-- RLS Policies
-- 1. Anyone can read active announcements (or admins can read all)
drop policy if exists "Anyone can read active marquee announcements" on public.marquee_announcements;
create policy "Anyone can read active marquee announcements"
  on public.marquee_announcements for select
  using (is_active = true or public.is_admin());

-- 2. Admins have full management access (insert, update, delete)
drop policy if exists "Admins can manage marquee announcements" on public.marquee_announcements;
create policy "Admins can manage marquee announcements"
  on public.marquee_announcements for all
  using (public.is_admin())
  with check (public.is_admin());

-- Table Permissions
grant select on public.marquee_announcements to anon, authenticated;
grant all on public.marquee_announcements to authenticated;

-- Initial Seed Data: 8 Canonical High-Converting Wholesale Offers
insert into public.marquee_announcements (
  badge,
  title,
  subtitle,
  icon,
  link_url,
  sort_order,
  is_active
)
values
  (
    'WHOLESALE TIERS',
    'UP TO 35% BULK SAVINGS',
    'Automatic tier volume discounts on 100+ pcs',
    'BadgePercent',
    '/marketplace',
    1,
    true
  ),
  (
    'FREE DELIVERY',
    '₹0 SHIPPING ON ORDERS ₹999+',
    'Pan-India express logistics across all states',
    'Truck',
    '/marketplace',
    2,
    true
  ),
  (
    'EXPRESS DISPATCH',
    'SAME-DAY 24H DISPATCH',
    'Direct surface & air cargo via SafeXpress / Delhivery',
    'Zap',
    '/marketplace',
    3,
    true
  ),
  (
    'URT PROMISE',
    '1-YEAR REPLACEMENT WARRANTY',
    '100% Quality Inspected • Instant DOA replacement',
    'ShieldCheck',
    '/about',
    4,
    true
  ),
  (
    'DIRECT PRICING',
    'FACTORY-DIRECT WHOLESALE',
    'Zero middlemen commissions • Maximum retail shop profit',
    'Flame',
    '/marketplace',
    5,
    true
  ),
  (
    'LOW MOQ',
    'START FROM JUST 10 PIECES',
    'Flexible wholesale lot sizes for shop retailers',
    'PackageCheck',
    '/marketplace',
    6,
    true
  ),
  (
    'READY STOCK',
    '1,600+ ACTIVE PRODUCTS IN STOCK',
    'Cables, Chargers, Earphones, TWS & Premium Accessories',
    'Layers',
    '/marketplace',
    7,
    true
  ),
  (
    'DEALER PROGRAM',
    'EXCLUSIVE DEALER RATES & CREDIT',
    'Apply for verified wholesale dealer net terms',
    'Sparkles',
    '/dealer',
    8,
    true
  );

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';

