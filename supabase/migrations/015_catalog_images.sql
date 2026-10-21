-- ============================================================================
-- 015_catalog_images.sql
-- Image Library: storage bucket, catalog_images table, RLS, indexes,
-- and admin_delete_catalog_image RPC.
-- ============================================================================

-- 1. STORAGE BUCKET
-- ---------------------------------------------------------------------------
-- Public-read so storefront can display the URLs directly.
-- Only admins can insert / update / delete objects.
insert into storage.buckets (id, name, public) values ('catalog-images', 'catalog-images', true)
on conflict (id) do nothing;

-- Storage policies (reuse existing is_admin() pattern)
create policy "Public read catalog-images"
  on storage.objects for select
  using (bucket_id = 'catalog-images');

create policy "Admin insert catalog-images"
  on storage.objects for insert
  with check (bucket_id = 'catalog-images' and public.is_admin());

create policy "Admin update catalog-images"
  on storage.objects for update
  using (bucket_id = 'catalog-images' and public.is_admin());

create policy "Admin delete catalog-images"
  on storage.objects for delete
  using (bucket_id = 'catalog-images' and public.is_admin());


-- 2. TABLE: CATALOG_IMAGES
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_images (
  id                   uuid primary key default gen_random_uuid(),
  original_name        text not null,
  storage_path         text not null unique,
  public_url           text not null,
  mime_type            text,
  width                integer,
  height               integer,
  original_size_bytes  integer,
  compressed_size_bytes integer,
  sku_hint             text,
  batch_id             uuid,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

-- RLS
alter table public.catalog_images enable row level security;

create policy "Admin select catalog_images"
  on public.catalog_images for select
  using (public.is_admin());

create policy "Admin insert catalog_images"
  on public.catalog_images for insert
  with check (public.is_admin());

create policy "Admin update catalog_images"
  on public.catalog_images for update
  using (public.is_admin());

create policy "Admin delete catalog_images"
  on public.catalog_images for delete
  using (public.is_admin());


-- 3. INDEXES
-- ---------------------------------------------------------------------------
create index if not exists idx_catalog_images_created_at
  on public.catalog_images (created_at desc);

create index if not exists idx_catalog_images_batch_id
  on public.catalog_images (batch_id);

create index if not exists idx_catalog_images_sku_hint
  on public.catalog_images (sku_hint);


-- 4. RPC: admin_delete_catalog_image
-- ---------------------------------------------------------------------------
-- Blocks deletion if the image URL is referenced by any product's images array.
create or replace function public.admin_delete_catalog_image(p_image_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_ref_count integer;
begin
  -- Authorization
  if not public.is_admin() then
    raise exception 'Unauthorized: admin only';
  end if;

  -- Get the URL
  select public_url into v_url
  from public.catalog_images
  where id = p_image_id and deleted_at is null;

  if v_url is null then
    raise exception 'Image not found or already deleted';
  end if;

  -- Check for product references
  select count(*) into v_ref_count
  from public.products
  where v_url = any(images);

  if v_ref_count > 0 then
    raise exception 'Cannot delete: image is used by % product(s)', v_ref_count;
  end if;

  -- Soft-delete
  update public.catalog_images
  set deleted_at = now()
  where id = p_image_id;

  return jsonb_build_object(
    'success', true,
    'deleted_id', p_image_id
  );
end;
$$;

grant execute on function public.admin_delete_catalog_image(uuid) to authenticated;
