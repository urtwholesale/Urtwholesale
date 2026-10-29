-- Migration 021: Add customizable rating column to promotional banners
alter table if exists public.banners
  add column if not exists rating text default '4.9';

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';

