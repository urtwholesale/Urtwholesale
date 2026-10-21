-- ============================================================================
-- 008_catalog_uploads.sql
-- ============================================================================
-- Catalog upload batch management, row-level verification tracking, and
-- multi-level recursive category lookup helper.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CATALOG_UPLOADS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.catalog_uploads (
  id text primary key, -- Custom formatted code: CAT-YYMMDD-XXXX or UUID
  upload_type text not null check (upload_type in ('bulk', 'single')),
  category_id uuid references public.categories(id) on delete set null,
  category_path text, -- Cached breadcrumb for rapid search (e.g. 'Appliances > Small Appliances > Grooming > Trimmers')
  file_name text,
  total_items integer not null default 0 check (total_items >= 0),
  passed_items integer not null default 0 check (passed_items >= 0),
  failed_items integer not null default 0 check (failed_items >= 0),
  status text not null default 'qc_in_progress' check (status in ('qc_pass', 'qc_error', 'qc_in_progress', 'action_required')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexing for fast filtering & search
create index if not exists idx_catalog_uploads_type on public.catalog_uploads(upload_type);
create index if not exists idx_catalog_uploads_status on public.catalog_uploads(status);
create index if not exists idx_catalog_uploads_category on public.catalog_uploads(category_id);
create index if not exists idx_catalog_uploads_created on public.catalog_uploads(created_at desc);

-- Enable RLS
alter table public.catalog_uploads enable row level security;

-- Admin access policy
drop policy if exists "Admins can view and manage catalog uploads" on public.catalog_uploads;
create policy "Admins can view and manage catalog uploads"
  on public.catalog_uploads
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. CATALOG_UPLOAD_ITEMS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.catalog_upload_items (
  id uuid primary key default gen_random_uuid(),
  upload_id text not null references public.catalog_uploads(id) on delete cascade,
  row_number integer not null default 1,
  title text not null default '',
  sku text,
  status text not null default 'qc_in_progress' check (status in ('qc_pass', 'qc_error', 'qc_in_progress', 'action_required')),
  error_message text,
  product_id uuid references public.products(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for batch item lookups
create index if not exists idx_catalog_upload_items_upload on public.catalog_upload_items(upload_id);
create index if not exists idx_catalog_upload_items_status on public.catalog_upload_items(status);

-- Enable RLS
alter table public.catalog_upload_items enable row level security;

drop policy if exists "Admins can view and manage catalog upload items" on public.catalog_upload_items;
create policy "Admins can view and manage catalog upload items"
  on public.catalog_upload_items
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. RECURSIVE CATEGORY DESCENDANT HELPER FUNCTION
-- ----------------------------------------------------------------------------
-- Retrieves all descendant category IDs for any given category ID (arbitrary depth up to 10 levels)
create or replace function public.get_category_descendant_ids(p_category_id uuid)
returns table(id uuid)
language sql
stable
security definer
as $$
  with recursive category_tree as (
    select c.id
    from public.categories c
    where c.id = p_category_id
    union all
    select c.id
    from public.categories c
    join category_tree ct on c.parent_id = ct.id
  )
  select id from category_tree;
$$;

grant execute on function public.get_category_descendant_ids(uuid) to anon, authenticated;
