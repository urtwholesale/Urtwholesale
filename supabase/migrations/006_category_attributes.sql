-- ============================================================================
-- Migration: 009_category_attributes.sql
-- Description: Category attributes schema, options, validation and RLS policies.
-- ============================================================================

create table if not exists public.category_attributes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  label text not null,
  key text not null,
  type text not null default 'text' check (type in ('text', 'number', 'select', 'multiselect', 'boolean')),
  options jsonb not null default '[]'::jsonb, -- string array of choices e.g. ["1m", "2m"]
  required boolean not null default false,
  apply_to_all_products boolean not null default false,
  help_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id, key)
);

-- Indexing for fast lookups & ordering
create index if not exists idx_category_attributes_cat on public.category_attributes(category_id, sort_order asc);

-- Enable RLS
alter table public.category_attributes enable row level security;

-- Public can read attributes
drop policy if exists "Public can read category attributes" on public.category_attributes;
create policy "Public can read category attributes"
  on public.category_attributes
  for select
  using (true);

-- Admins can manage attributes
drop policy if exists "Admins can manage category attributes" on public.category_attributes;
create policy "Admins can manage category attributes"
  on public.category_attributes
  for all
  using (public.is_admin())
  with check (public.is_admin());

grant all on public.category_attributes to authenticated;
grant select on public.category_attributes to anon;
