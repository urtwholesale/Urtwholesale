-- ============================================================================
-- Urbanrat Store — Initial Database Migration
-- Version: 001_init.sql
-- Description: Core tables, RLS policies, trigger-based profile creation,
--              role tampering prevention, and product-images storage bucket.
-- ============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- ----------------------------------------------------------------------------
-- Helper function to check if current authenticated user is an admin
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2. CATEGORIES TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Index for category lookups
create index if not exists idx_categories_slug on public.categories(slug);
create index if not exists idx_categories_parent on public.categories(parent_id);

-- Enable RLS
alter table public.categories enable row level security;

-- ----------------------------------------------------------------------------
-- 3. PRODUCTS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  mrp numeric(10, 2) check (mrp is null or mrp >= price),
  sku text unique,
  stock integer not null default 0 check (stock >= 0),
  images text[] not null default '{}',
  category_id uuid references public.categories(id) on delete set null,
  is_urbanrat_brand boolean not null default true,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for products
create index if not exists idx_products_slug on public.products(slug);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_active on public.products(is_active);
create index if not exists idx_products_featured on public.products(is_featured);

-- Enable RLS
alter table public.products enable row level security;

-- ----------------------------------------------------------------------------
-- 4. CART_ITEMS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  updated_at timestamptz not null default now(),
  constraint unique_user_product unique (user_id, product_id)
);

create index if not exists idx_cart_items_user on public.cart_items(user_id);

-- Enable RLS
alter table public.cart_items enable row level security;

-- ----------------------------------------------------------------------------
-- 5. ORDERS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  total numeric(10, 2) not null check (total >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  whatsapp_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_status on public.orders(status);

-- Enable RLS
alter table public.orders enable row level security;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
-- Customers read their own profile; admins can read all profiles
create policy "Users can read own profile or admin can read all"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

-- Users can insert their own profile
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Users can update own profile; admins can update any profile
create policy "Users can update own profile or admin can update any"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

-- Block non-admin users from changing their own role
create or replace function public.check_profile_role_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.role <> old.role and not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can modify user roles';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger trigger_prevent_role_tampering
  before update on public.profiles
  for each row
  execute function public.check_profile_role_update();

-- ----------------------------------------------------------------------------
-- CATEGORIES POLICIES
-- ----------------------------------------------------------------------------
-- Anyone can read active categories; admins can read all (active or inactive)
create policy "Anyone can read active categories or admin reads all"
  on public.categories for select
  using (is_active = true or public.is_admin());

-- Only admins can insert categories
create policy "Admins can insert categories"
  on public.categories for insert
  with check (public.is_admin());

-- Only admins can update categories
create policy "Admins can update categories"
  on public.categories for update
  using (public.is_admin());

-- Only admins can delete categories
create policy "Admins can delete categories"
  on public.categories for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- PRODUCTS POLICIES
-- ----------------------------------------------------------------------------
-- Anyone can read active products; admins can read all
create policy "Anyone can read active products or admin reads all"
  on public.products for select
  using (is_active = true or public.is_admin());

-- Only admins can insert products
create policy "Admins can insert products"
  on public.products for insert
  with check (public.is_admin());

-- Only admins can update products
create policy "Admins can update products"
  on public.products for update
  using (public.is_admin());

-- Only admins can delete products
create policy "Admins can delete products"
  on public.products for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- CART ITEMS POLICIES
-- ----------------------------------------------------------------------------
-- Customers read their own cart; admin can view all
create policy "Users can read own cart or admin reads all"
  on public.cart_items for select
  using (auth.uid() = user_id or public.is_admin());

-- Customers insert their own cart items
create policy "Users can insert own cart items"
  on public.cart_items for insert
  with check (auth.uid() = user_id);

-- Customers update their own cart items
create policy "Users can update own cart items"
  on public.cart_items for update
  using (auth.uid() = user_id);

-- Customers delete their own cart items; admin can delete any
create policy "Users can delete own cart items or admin deletes all"
  on public.cart_items for delete
  using (auth.uid() = user_id or public.is_admin());

-- ----------------------------------------------------------------------------
-- ORDERS POLICIES
-- ----------------------------------------------------------------------------
-- Customers read their own orders; admin reads all
create policy "Users can read own orders or admin reads all"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

-- Customers or guests can create orders
create policy "Users can insert orders"
  on public.orders for insert
  with check (auth.uid() = user_id or user_id is null or public.is_admin());

-- Only admins can update orders (e.g. status updates)
create policy "Only admins can update orders"
  on public.orders for update
  using (public.is_admin());

-- Only admins can delete orders
create policy "Only admins can delete orders"
  on public.orders for delete
  using (public.is_admin());

-- ============================================================================
-- AUTH HOOK TRIGGER: Automatic Profile Creation on Signup
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.phone, new.raw_user_meta_data->>'phone', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger on auth.users table
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- STORAGE BUCKET: product-images (Public read, Admin-only write)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'];

-- Storage bucket RLS policies
create policy "Public can view product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Admins can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admins can update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());

create policy "Admins can delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());
