-- ============================================================================
-- Migration: 003_settings_and_content.sql
-- Description: Dynamic store settings, banners, store pages, and verified order RPC
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STORE_SETTINGS TABLE (Key-Value configuration for WhatsApp, searches, badges)
-- ----------------------------------------------------------------------------
create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.store_settings enable row level security;

-- Policies: Anyone can read settings, only admins can modify
create policy "Anyone can read store settings"
  on public.store_settings for select
  using (true);

create policy "Admins can insert store settings"
  on public.store_settings for insert
  with check (public.is_admin());

create policy "Admins can update store settings"
  on public.store_settings for update
  using (public.is_admin());

create policy "Admins can delete store settings"
  on public.store_settings for delete
  using (public.is_admin());

-- Seed default settings
insert into public.store_settings (key, value, description)
values
  ('whatsapp_number', '"917000947033"'::jsonb, 'Primary WhatsApp order dispatch & support number'),
  ('popular_searches', '["iPhone 16 Glass", "65W GaN", "100W Cable", "AirBass Pro", "MagSafe Car"]'::jsonb, 'Top search keywords shown in mobile search drawer'),
  ('value_badges', '[{"icon": "ShieldCheck", "text": "100% Quality Inspected"}, {"icon": "Truck", "text": "Pan-India Express Dispatch"}, {"icon": "Zap", "text": "Wholesale Bulk Margin Ready"}]'::jsonb, 'Hero value proposition badges'),
  ('store_info', '{"name": "URT Wholesale", "tagline": "Factory Direct Wholesale Mobile Gear", "currency": "₹"}'::jsonb, 'General store branding metadata')
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description;

-- ----------------------------------------------------------------------------
-- 2. BANNERS TABLE (Hero banners, brand spotlights, promotional cards)
-- ----------------------------------------------------------------------------
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  badge_text text not null default '',
  image_url text,
  cta_text text not null default 'Explore Marketplace',
  cta_link text not null default '/marketplace',
  secondary_cta_text text not null default '',
  secondary_cta_link text not null default '',
  placement text not null default 'home_hero' check (placement in ('home_hero', 'home_brand', 'urbanrat_hero')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.banners enable row level security;

create policy "Anyone can read active banners"
  on public.banners for select
  using (is_active = true or public.is_admin());

create policy "Admins can manage banners"
  on public.banners for all
  using (public.is_admin());

-- Seed default banners
insert into public.banners (title, subtitle, badge_text, image_url, cta_text, cta_link, secondary_cta_text, secondary_cta_link, placement, sort_order, is_active)
values
  (
    'Next-Gen Mobile Gear, Factory Direct',
    'Engineered 9H tempered glass, 65W GaN fast chargers, and indestructible braided cables. Premium retail quality at wholesale prices.',
    'URP Wholesale Direct',
    '/hero-accessories.jpg',
    'Explore Marketplace',
    '/marketplace',
    'Urbanrat Original',
    '/urbanrat',
    'home_hero',
    1,
    true
  ),
  (
    'Urbanrat Original Gear',
    'Designed from scratch with high-density ballistic nylon, Gallium Nitride internals, and sapphire-infused glass. Built for heavy commercial and daily use.',
    'In-House Engineering',
    null,
    'Explore Collection',
    '/urbanrat',
    '',
    '',
    'home_brand',
    2,
    true
  ),
  (
    'The Urbanrat Standard.',
    'Engineered exclusively for extreme durability, daily drops, and maximum power delivery. Certified for commercial retail quality with hassle-free wholesale warranty.',
    'Urbanrat In-House Labs',
    null,
    'Explore Marketplace',
    '/marketplace',
    '',
    '',
    'urbanrat_hero',
    3,
    true
  );

-- ----------------------------------------------------------------------------
-- 3. STORE_PAGES TABLE (About Us, Terms of Service, Privacy Policy)
-- ----------------------------------------------------------------------------
create table if not exists public.store_pages (
  slug text primary key,
  title text not null,
  summary text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.store_pages enable row level security;

create policy "Anyone can read store pages"
  on public.store_pages for select
  using (true);

create policy "Admins can manage store pages"
  on public.store_pages for all
  using (public.is_admin());

-- Seed default store pages
insert into public.store_pages (slug, title, summary, content)
values
  (
    'about',
    'About Urbanrat & URP Wholesale',
    'Our factory-direct wholesale story & quality pledge',
    'Urbanrat is a single-vendor specialized supplier of high-grade mobile accessories and digital electronics, supplied by URP Wholesale.\n\nWe bypass distributor markups and intermediate traders to provide retailers, corporate buyers, and tech enthusiasts direct access to precision 9H sapphire tempered glass, GaN power bricks, ballistic braided cables, and audio hardware.'
  ),
  (
    'terms',
    'Terms of Service & Warranty',
    'Dead-on-arrival replacements and invoice policy',
    '1. Quality Guarantee: Every unit undergoes standard electrical and drop QC checks before boxing.\n2. Replacement Policy: 7-day hassle-free replacement on manufacturer defects or transit damage. Instant video verification required.\n3. Wholesale Invoices: Full GST tax invoices generated on every dispatch for commercial tax credit.'
  ),
  (
    'privacy',
    'Privacy & Data Policy',
    'How we handle customer and shipping information',
    'We respect your business confidentiality. Order contact information, delivery addresses, and WhatsApp phone numbers are used strictly for courier delivery, status notifications, and wholesale dispatch tracking. We never monetize or distribute customer data.'
  )
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content;

-- ----------------------------------------------------------------------------
-- 4. VERIFIED ORDER CREATION RPC (Server-side price calculation)
-- ----------------------------------------------------------------------------
-- Recalculates product prices directly from public.products table to prevent
-- client tampering. Generates confirmed item breakdown, subtotal, and total.
create or replace function public.create_verified_order(
  p_order_id text,
  p_customer jsonb,
  p_items jsonb,
  p_whatsapp_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_product record;
  v_verified_items jsonb := '[]'::jsonb;
  v_subtotal numeric(10, 2) := 0;
  v_total_mrp numeric(10, 2) := 0;
  v_savings numeric(10, 2) := 0;
  v_shipping numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_user_id uuid := auth.uid();
  v_created_order jsonb;
begin
  -- Validate parameters
  if p_order_id is null or trim(p_order_id) = '' then
    raise exception 'Order ID is required';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  -- Iterate through items and verify prices from public.products table
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer) loop
    select * into v_product
    from public.products
    where id = v_item.product_id and is_active = true;

    if not found then
      raise exception 'Product % not found or is inactive', v_item.product_id;
    end if;

    if v_item.quantity <= 0 then
      raise exception 'Invalid quantity for product %', v_product.name;
    end if;

    -- Append verified item object
    v_verified_items := v_verified_items || jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'price', v_product.price,
      'mrp', v_product.mrp,
      'quantity', v_item.quantity,
      'image', coalesce(v_product.images[1], null)
    );

    v_subtotal := v_subtotal + (v_product.price * v_item.quantity);
    v_total_mrp := v_total_mrp + (coalesce(v_product.mrp, v_product.price) * v_item.quantity);
  end loop;

  v_savings := greatest(0, v_total_mrp - v_subtotal);
  v_total := v_subtotal + v_shipping;

  -- Insert verified order record into public.orders
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
    p_order_id,
    v_user_id,
    p_customer,
    v_verified_items,
    v_subtotal,
    v_savings,
    v_shipping,
    v_total,
    'pending',
    p_whatsapp_message,
    now(),
    now()
  );

  select to_jsonb(o) into v_created_order
  from public.orders o
  where o.id = p_order_id;

  return v_created_order;
end;
$$;

grant execute on function public.create_verified_order(text, jsonb, jsonb, text) to anon, authenticated;
