-- ============================================================================
-- Migration: 010_customer_auth_and_addresses.sql
-- Description: Extends profiles table with wholesale business fields (business_name, gstin),
--              updates handle_new_user auth trigger, extends public.addresses with
--              business_name, gstin, and landmark, adds single-default address trigger,
--              partial unique index, and customer_addresses compatibility view.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTEND PROFILES TABLE WITH WHOLESALE BUSINESS METADATA
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists business_name text,
  add column if not exists gstin text;

-- Add check constraint for GSTIN format if not exists (15 alphanumeric characters)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_gstin_check'
  ) then
    alter table public.profiles
      add constraint profiles_gstin_check
      check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. UPDATE ON_AUTH_USER_CREATED TRIGGER TO CAPTURE EXTENDED METADATA
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    phone,
    role,
    business_name,
    gstin,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''), ''),
    coalesce(nullif(trim(new.phone), ''), nullif(trim(new.raw_user_meta_data->>'phone'), ''), null),
    'customer',
    nullif(trim(new.raw_user_meta_data->>'business_name'), ''),
    nullif(upper(trim(new.raw_user_meta_data->>'gstin')), ''),
    now(),
    now()
  )
  on conflict (id) do update set
    full_name = case
      when nullif(trim(excluded.full_name), '') is not null then excluded.full_name
      else public.profiles.full_name
    end,
    phone = coalesce(excluded.phone, public.profiles.phone),
    business_name = coalesce(excluded.business_name, public.profiles.business_name),
    gstin = coalesce(excluded.gstin, public.profiles.gstin),
    updated_at = now();

  return new;
end;
$$;

-- Ensure trigger is active on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. EXTEND ADDRESSES TABLE WITH BUSINESS & LANDMARK FIELDS
-- ----------------------------------------------------------------------------
alter table public.addresses
  add column if not exists business_name text,
  add column if not exists gstin text,
  add column if not exists landmark text;

-- Add check constraint for addresses GSTIN format if not exists
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'addresses_gstin_check'
  ) then
    alter table public.addresses
      add constraint addresses_gstin_check
      check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. ENSURE ONLY ONE DEFAULT ADDRESS PER USER (TRIGGER & PARTIAL UNIQUE INDEX)
-- ----------------------------------------------------------------------------
-- Trigger function: automatically un-sets previous default when a new default is designated
create or replace function public.handle_address_default_toggle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_default = true then
    update public.addresses
    set is_default = false
    where user_id = new.user_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_single_default_address on public.addresses;
create trigger trigger_single_default_address
  before insert or update of is_default on public.addresses
  for each row
  when (new.is_default = true)
  execute function public.handle_address_default_toggle();

-- Partial unique index ensuring strictly one default address per user
create unique index if not exists idx_addresses_single_default
  on public.addresses(user_id)
  where is_default = true;

-- Performance indexes on addresses
create index if not exists idx_addresses_user_created
  on public.addresses(user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) FOR ADDRESSES
-- ----------------------------------------------------------------------------
alter table public.addresses enable row level security;

-- Drop existing to avoid conflicts
drop policy if exists "Users can read own addresses or admin reads all" on public.addresses;
drop policy if exists "Users can insert own addresses" on public.addresses;
drop policy if exists "Users can update own addresses" on public.addresses;
drop policy if exists "Users can delete own addresses" on public.addresses;

-- Customers can only read their own addresses; admins can read all
create policy "Users can read own addresses or admin reads all"
  on public.addresses for select
  using (auth.uid() = user_id or public.is_admin());

-- Customers can only insert rows for their own authenticated user ID
create policy "Users can insert own addresses"
  on public.addresses for insert
  with check (auth.uid() = user_id);

-- Customers can only update their own addresses; admins can update any
create policy "Users can update own addresses"
  on public.addresses for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- Customers can only delete their own addresses; admins can delete any
create policy "Users can delete own addresses"
  on public.addresses for delete
  using (auth.uid() = user_id or public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. COMPATIBILITY VIEW: CUSTOMER_ADDRESSES
-- ----------------------------------------------------------------------------
-- Creates an alias view so queries to either 'addresses' or 'customer_addresses' succeed
create or replace view public.customer_addresses as
  select * from public.addresses;

grant select, insert, update, delete on public.addresses to authenticated;
grant select on public.addresses to anon;
