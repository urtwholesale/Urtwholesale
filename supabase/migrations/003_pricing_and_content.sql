-- ============================================================================
-- Migration: 003_pricing_and_content.sql
-- Description: Additive & Idempotent Pricing, Reviews, Wishlist, Addresses,
--              Inventory, Banners, Store Settings, Pages, and Storage Buckets
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. HELPER FUNCTIONS (Reuse or create if missing)
-- ----------------------------------------------------------------------------

-- Ensure is_admin() function exists and reads profiles.role with security definer
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Generic updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. PRODUCTS TABLE ENHANCEMENTS (Additive columns & constraints)
-- ----------------------------------------------------------------------------
alter table public.products
  add column if not exists short_description text,
  add column if not exists specs jsonb default '{}'::jsonb,
  add column if not exists warranty_months integer,
  add column if not exists tags text[] default '{}',
  add column if not exists is_trending boolean default false,
  add column if not exists low_stock_threshold integer default 5,
  add column if not exists min_order_qty integer default 1,
  add column if not exists order_qty_step integer default 1,
  add column if not exists rating_avg numeric(2, 1) default 0,
  add column if not exists rating_count integer default 0;

-- Idempotent check constraints for products order quantities
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_min_order_qty_check') then
    alter table public.products add constraint products_min_order_qty_check check (min_order_qty >= 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'products_order_qty_step_check') then
    alter table public.products add constraint products_order_qty_step_check check (order_qty_step >= 1);
  end if;
end $$;

create index if not exists idx_products_trending on public.products(is_trending);
create index if not exists idx_products_tags on public.products using gin(tags);

-- ----------------------------------------------------------------------------
-- 2. PRODUCT_PRICE_TIERS TABLE & DATA MIGRATION
-- ----------------------------------------------------------------------------
create table if not exists public.product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  min_qty integer not null check (min_qty >= 1),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  constraint unique_product_min_qty unique (product_id, min_qty)
);

create index if not exists idx_product_price_tiers_product on public.product_price_tiers(product_id);

-- DATA MIGRATION: Insert 1 default tier for every existing product with no tiers
insert into public.product_price_tiers (product_id, min_qty, unit_price)
select
  p.id,
  coalesce(p.min_order_qty, 1),
  p.price
from public.products p
where not exists (
  select 1 from public.product_price_tiers ppt
  where ppt.product_id = p.id
)
on conflict (product_id, min_qty) do nothing;

-- ----------------------------------------------------------------------------
-- 3. REVIEWS TABLE (Ratings, reviews & moderation)
-- ----------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  constraint unique_product_user_review unique (product_id, user_id)
);

create index if not exists idx_reviews_product on public.reviews(product_id);
create index if not exists idx_reviews_user on public.reviews(user_id);
create index if not exists idx_reviews_status on public.reviews(status);

-- ----------------------------------------------------------------------------
-- 4. WISHLIST_ITEMS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists idx_wishlist_items_user on public.wishlist_items(user_id);
create index if not exists idx_wishlist_items_product on public.wishlist_items(product_id);

-- ----------------------------------------------------------------------------
-- 5. ADDRESSES TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Home',
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_addresses_user on public.addresses(user_id);

drop trigger if exists trigger_addresses_updated_at on public.addresses;
create trigger trigger_addresses_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. BANNERS TABLE (Promotional, brand, & hero cards)
-- ----------------------------------------------------------------------------
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  placement text not null default 'home_hero' check (placement in ('home_hero', 'home_brand', 'urbanrat_hero')),
  title text not null,
  subtitle text not null default '',
  image_url text,
  link_url text,
  badges jsonb not null default '[]'::jsonb,
  badge_text text not null default '',
  cta_text text not null default 'Explore Marketplace',
  cta_link text not null default '/marketplace',
  secondary_cta_text text not null default '',
  secondary_cta_link text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure all required columns exist if banners table was previously created
alter table public.banners add column if not exists placement text not null default 'home_hero' check (placement in ('home_hero', 'home_brand', 'urbanrat_hero'));
alter table public.banners add column if not exists link_url text;
alter table public.banners add column if not exists badges jsonb not null default '[]'::jsonb;
alter table public.banners add column if not exists sort_order integer not null default 0;
alter table public.banners add column if not exists is_active boolean not null default true;

-- ----------------------------------------------------------------------------
-- 7. STORE_SETTINGS TABLE (Key-value store for app configuration)
-- ----------------------------------------------------------------------------
create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null,
  description text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_settings add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trigger_store_settings_updated_at on public.store_settings;
create trigger trigger_store_settings_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- Seed store_settings (whatsapp_number, store_name, free_delivery_min, shipping_fee, popular_searches)
insert into public.store_settings (key, value, description)
values
  ('whatsapp_number', '"917000947033"'::jsonb, 'Primary WhatsApp order dispatch & support contact number'),
  ('store_name', '"URT Wholesale"'::jsonb, 'Official store brand name'),
  ('free_delivery_min', '999'::jsonb, 'Minimum subtotal threshold (₹) for free wholesale delivery'),
  ('shipping_fee', '49'::jsonb, 'Standard flat-rate shipping fee (₹) below free delivery threshold'),
  ('popular_searches', '["iPhone 16 Glass", "65W GaN", "100W Cable", "AirBass Pro", "MagSafe Car"]'::jsonb, 'Top 5 popular search chips shown in App search drawer'),
  ('value_badges', '[{"icon": "ShieldCheck", "text": "100% Quality Inspected"}, {"icon": "Truck", "text": "Pan-India Express Dispatch"}, {"icon": "Zap", "text": "Wholesale Bulk Margin Ready"}]'::jsonb, 'Homepage trust badges')
on conflict (key) do update set
  value = excluded.value,
  description = coalesce(excluded.description, public.store_settings.description),
  updated_at = now();

-- ----------------------------------------------------------------------------
-- 8. STORE_PAGES TABLE (Static policy & information pages)
-- ----------------------------------------------------------------------------
create table if not exists public.store_pages (
  slug text primary key,
  title text not null,
  summary text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_pages add column if not exists title text;
alter table public.store_pages add column if not exists summary text not null default '';
alter table public.store_pages add column if not exists content text not null default '';
alter table public.store_pages add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trigger_store_pages_updated_at on public.store_pages;
create trigger trigger_store_pages_updated_at
  before update on public.store_pages
  for each row execute function public.set_updated_at();

-- Seed store_pages with exact hardcoded copy from MenuPage.tsx
insert into public.store_pages (slug, title, summary, content)
values
  (
    'about',
    'About Urbanrat',
    'Our factory-direct wholesale story & quality pledge',
    'Urbanrat is a single-vendor specialized supplier of high-grade mobile accessories and digital electronics, supplied by URP Wholesale.

We bypass distributor markups and intermediate traders to provide retailers, corporate buyers, and tech enthusiasts direct access to precision 9H sapphire tempered glass, GaN power bricks, ballistic braided cables, and audio hardware.'
  ),
  (
    'terms',
    'Terms of Service & Warranty',
    'Dead-on-arrival replacements and invoice policy',
    '1. Quality Guarantee: Every unit undergoes standard electrical and drop QC checks before boxing.

2. Transit Replacements: Any parcel reported broken or dead-on-arrival within 48 hours of courier delivery is eligible for immediate 1-to-1 swap.

3. Wholesale Payments: Invoices are generated electronically with full GST breakdown upon order placement.'
  ),
  (
    'privacy',
    'Privacy Policy & Security',
    'Encrypted authentication and zero data trading',
    'Your phone numbers, delivery coordinates, and purchase records are secured with row-level security through Supabase and never shared with third-party advertisers.

WhatsApp interactions are end-to-end encrypted under Meta''s security architecture.'
  )
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  updated_at = now();

-- ----------------------------------------------------------------------------
-- 9. STOCK_MOVEMENTS TABLE (Inventory audit trail)
-- ----------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  change integer not null,
  reason text not null,
  order_id text references public.orders(id) on delete set null,
  admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_product on public.stock_movements(product_id);
create index if not exists idx_stock_movements_order on public.stock_movements(order_id);
create index if not exists idx_stock_movements_created on public.stock_movements(created_at desc);

-- ----------------------------------------------------------------------------
-- 10. ORDER_EVENTS TABLE & ORDERS TABLE ENHANCEMENTS
-- ----------------------------------------------------------------------------
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_events_order on public.order_events(order_id);
create index if not exists idx_order_events_created on public.order_events(created_at desc);

-- Add cancel_reason and admin_note to orders
alter table public.orders add column if not exists cancel_reason text;
alter table public.orders add column if not exists admin_note text;

-- ----------------------------------------------------------------------------
-- 11. SEED BANNERS (From HomePage.tsx and UrbanratPage.tsx)
-- ----------------------------------------------------------------------------
insert into public.banners (
  placement,
  title,
  subtitle,
  image_url,
  link_url,
  badge_text,
  cta_text,
  cta_link,
  secondary_cta_text,
  secondary_cta_link,
  badges,
  sort_order,
  is_active
)
values
  (
    'home_hero',
    'Next-Gen Mobile Gear, Factory Direct',
    'Engineered 9H tempered glass, 65W GaN fast chargers, and indestructible braided cables. Premium retail quality at wholesale prices.',
    '/hero-accessories.jpg',
    '/marketplace',
    'URP Wholesale Direct',
    'Explore Marketplace',
    '/marketplace',
    'Urbanrat Original',
    '/urbanrat',
    '[{"icon": "Sparkles", "text": "URP Wholesale Direct"}, {"icon": "ShieldCheck", "text": "Commercial Retail Ready"}]'::jsonb,
    1,
    true
  ),
  (
    'home_brand',
    'Urbanrat Original Gear',
    'Designed from scratch with high-density ballistic nylon, Gallium Nitride internals, and sapphire-infused glass. Built for heavy commercial and daily use.',
    null,
    '/urbanrat',
    'In-House Engineering',
    'Explore Collection',
    '/urbanrat',
    '',
    '',
    '[{"icon": "Zap", "text": "In-House Engineering"}]'::jsonb,
    2,
    true
  ),
  (
    'urbanrat_hero',
    'The Urbanrat Standard.',
    'Engineered exclusively for extreme durability, daily drops, and maximum power delivery. Certified for commercial retail quality with hassle-free wholesale warranty.',
    null,
    '/marketplace',
    'Urbanrat In-House Labs',
    'Explore Marketplace',
    '/marketplace',
    '',
    '',
    '[{"label": "Hardness", "value": "9H Sapphire"}, {"label": "Conductors", "value": "Pure Copper"}, {"label": "Thermal QA", "value": "GaN III Turbo"}]'::jsonb,
    3,
    true
  )
on conflict do nothing;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RLS: product_price_tiers
-- ----------------------------------------------------------------------------
alter table public.product_price_tiers enable row level security;

drop policy if exists "Anyone can read tiers of active products or admin reads all" on public.product_price_tiers;
create policy "Anyone can read tiers of active products or admin reads all"
  on public.product_price_tiers for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_price_tiers.product_id
        and (p.is_active = true or public.is_admin())
    )
  );

drop policy if exists "Admins can insert price tiers" on public.product_price_tiers;
create policy "Admins can insert price tiers"
  on public.product_price_tiers for insert
  with check (public.is_admin());

drop policy if exists "Admins can update price tiers" on public.product_price_tiers;
create policy "Admins can update price tiers"
  on public.product_price_tiers for update
  using (public.is_admin());

drop policy if exists "Admins can delete price tiers" on public.product_price_tiers;
create policy "Admins can delete price tiers"
  on public.product_price_tiers for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: reviews
-- ----------------------------------------------------------------------------
alter table public.reviews enable row level security;

drop policy if exists "Anyone can read approved reviews or own reviews or admin reads all" on public.reviews;
create policy "Anyone can read approved reviews or own reviews or admin reads all"
  on public.reviews for select
  using (
    status = 'approved'
    or (auth.uid() is not null and auth.uid() = user_id)
    or public.is_admin()
  );

-- Users may insert their OWN review only with status 'pending'
drop policy if exists "Users can insert own pending review" on public.reviews;
create policy "Users can insert own pending review"
  on public.reviews for insert
  with check (
    auth.uid() is not null
    and auth.uid() = user_id
    and status = 'pending'
  );

drop policy if exists "Users can update own pending review or admin updates any" on public.reviews;
create policy "Users can update own pending review or admin updates any"
  on public.reviews for update
  using (
    (auth.uid() = user_id and status = 'pending')
    or public.is_admin()
  )
  with check (
    (auth.uid() = user_id and status = 'pending')
    or public.is_admin()
  );

drop policy if exists "Users can delete own review or admin deletes any" on public.reviews;
create policy "Users can delete own review or admin deletes any"
  on public.reviews for delete
  using (auth.uid() = user_id or public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: wishlist_items
-- ----------------------------------------------------------------------------
alter table public.wishlist_items enable row level security;

drop policy if exists "Users can read own wishlist or admin reads all" on public.wishlist_items;
create policy "Users can read own wishlist or admin reads all"
  on public.wishlist_items for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can insert into own wishlist" on public.wishlist_items;
create policy "Users can insert into own wishlist"
  on public.wishlist_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete from own wishlist" on public.wishlist_items;
create policy "Users can delete from own wishlist"
  on public.wishlist_items for delete
  using (auth.uid() = user_id or public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: addresses
-- ----------------------------------------------------------------------------
alter table public.addresses enable row level security;

drop policy if exists "Users can read own addresses or admin reads all" on public.addresses;
create policy "Users can read own addresses or admin reads all"
  on public.addresses for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can insert own addresses" on public.addresses;
create policy "Users can insert own addresses"
  on public.addresses for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own addresses" on public.addresses;
create policy "Users can update own addresses"
  on public.addresses for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can delete own addresses" on public.addresses;
create policy "Users can delete own addresses"
  on public.addresses for delete
  using (auth.uid() = user_id or public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: banners
-- ----------------------------------------------------------------------------
alter table public.banners enable row level security;

drop policy if exists "Anyone can read active banners" on public.banners;
create policy "Anyone can read active banners"
  on public.banners for select
  using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage banners" on public.banners;
create policy "Admins can manage banners"
  on public.banners for all
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: store_settings
-- ----------------------------------------------------------------------------
alter table public.store_settings enable row level security;

drop policy if exists "Anyone can read store settings" on public.store_settings;
create policy "Anyone can read store settings"
  on public.store_settings for select
  using (true);

drop policy if exists "Admins can manage store settings" on public.store_settings;
create policy "Admins can manage store settings"
  on public.store_settings for all
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: store_pages
-- ----------------------------------------------------------------------------
alter table public.store_pages enable row level security;

drop policy if exists "Anyone can read store pages" on public.store_pages;
create policy "Anyone can read store pages"
  on public.store_pages for select
  using (true);

drop policy if exists "Admins can manage store pages" on public.store_pages;
create policy "Admins can manage store pages"
  on public.store_pages for all
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: stock_movements
-- ----------------------------------------------------------------------------
alter table public.stock_movements enable row level security;

drop policy if exists "Admins can view stock movements" on public.stock_movements;
create policy "Admins can view stock movements"
  on public.stock_movements for select
  using (public.is_admin());

drop policy if exists "Admins can insert stock movements" on public.stock_movements;
create policy "Admins can insert stock movements"
  on public.stock_movements for insert
  with check (public.is_admin());

drop policy if exists "Admins can update stock movements" on public.stock_movements;
create policy "Admins can update stock movements"
  on public.stock_movements for update
  using (public.is_admin());

drop policy if exists "Admins can delete stock movements" on public.stock_movements;
create policy "Admins can delete stock movements"
  on public.stock_movements for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: order_events
-- ----------------------------------------------------------------------------
alter table public.order_events enable row level security;

drop policy if exists "Users can view events for own orders or admin views all" on public.order_events;
create policy "Users can view events for own orders or admin views all"
  on public.order_events for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and o.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can insert order events" on public.order_events;
create policy "Admins can insert order events"
  on public.order_events for insert
  with check (public.is_admin());

drop policy if exists "Admins can update order events" on public.order_events;
create policy "Admins can update order events"
  on public.order_events for update
  using (public.is_admin());

drop policy if exists "Admins can delete order events" on public.order_events;
create policy "Admins can delete order events"
  on public.order_events for delete
  using (public.is_admin());

-- ============================================================================
-- STORAGE BUCKETS: banners & avatars (Additive to existing product-images)
-- ============================================================================

-- 1. Banners Bucket (Public read, Admin upload/manage)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banners',
  'banners',
  true,
  5242880, -- 5 MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'];

-- Policies for banners bucket
drop policy if exists "Public can view banners" on storage.objects;
create policy "Public can view banners"
  on storage.objects for select
  using (bucket_id = 'banners');

drop policy if exists "Admins can upload banners" on storage.objects;
create policy "Admins can upload banners"
  on storage.objects for insert
  with check (bucket_id = 'banners' and public.is_admin());

drop policy if exists "Admins can update banners" on storage.objects;
create policy "Admins can update banners"
  on storage.objects for update
  using (bucket_id = 'banners' and public.is_admin());

drop policy if exists "Admins can delete banners" on storage.objects;
create policy "Admins can delete banners"
  on storage.objects for delete
  using (bucket_id = 'banners' and public.is_admin());

-- 2. Avatars Bucket (Public read, User-folder upload)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

-- Policies for avatars bucket (user folder upload: auth.uid()::text = folder)
drop policy if exists "Public can view avatars" on storage.objects;
create policy "Public can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload own avatar to user folder" on storage.objects;
create policy "Users can upload own avatar to user folder"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or split_part(name, '/', 1) = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or split_part(name, '/', 1) = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or split_part(name, '/', 1) = auth.uid()::text
      or public.is_admin()
    )
  );
