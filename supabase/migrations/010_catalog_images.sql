-- ============================================================================
-- 010_catalog_images.sql
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
drop policy if exists "Public read catalog-images" on storage.objects;
create policy "Public read catalog-images"
  on storage.objects for select
  using (bucket_id = 'catalog-images');

drop policy if exists "Admin insert catalog-images" on storage.objects;
create policy "Admin insert catalog-images"
  on storage.objects for insert
  with check (bucket_id = 'catalog-images' and public.is_admin());

drop policy if exists "Admin update catalog-images" on storage.objects;
create policy "Admin update catalog-images"
  on storage.objects for update
  using (bucket_id = 'catalog-images' and public.is_admin());

drop policy if exists "Admin delete catalog-images" on storage.objects;
create policy "Admin delete catalog-images"
  on storage.objects for delete
  using (bucket_id = 'catalog-images' and public.is_admin());


-- 2. TABLE: CATALOG_IMAGES
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_images (
  id                    uuid primary key default gen_random_uuid(),
  original_name         text not null,
  storage_path          text not null unique,
  public_url            text not null,
  mime_type             text,
  width                 integer,
  height                integer,
  original_size_bytes   integer,
  compressed_size_bytes integer,
  sku_hint              text,
  batch_id              uuid,
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

-- RLS
alter table public.catalog_images enable row level security;

drop policy if exists "Admin select catalog_images" on public.catalog_images;
create policy "Admin select catalog_images"
  on public.catalog_images for select
  using (public.is_admin());

drop policy if exists "Admin insert catalog_images" on public.catalog_images;
create policy "Admin insert catalog_images"
  on public.catalog_images for insert
  with check (public.is_admin());

drop policy if exists "Admin update catalog_images" on public.catalog_images;
create policy "Admin update catalog_images"
  on public.catalog_images for update
  using (public.is_admin());

drop policy if exists "Admin delete catalog_images" on public.catalog_images;
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
-- Blocks deletion if the image URL is referenced by any products.images
-- or catalog_upload_items, and returns which products use it.
-- Otherwise soft-deletes the row (the client removes the storage object).
create or replace function public.admin_delete_catalog_image(p_image_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_storage_path text;
  v_used_by text[];
begin
  -- Authorization check
  if not public.is_admin() then
    raise exception 'Unauthorized: admin only';
  end if;

  -- Get the public URL and storage path
  select public_url, storage_path into v_url, v_storage_path
  from public.catalog_images
  where id = p_image_id and deleted_at is null;

  if v_url is null then
    raise exception 'Image not found or already deleted';
  end if;

  -- Check if referenced by any products.images or catalog_upload_items
  select coalesce(array_agg(distinct item_name), '{}') into v_used_by
  from (
    select name as item_name
    from public.products
    where v_url = any(images)
    union
    select title as item_name
    from public.catalog_upload_items
    where (
      payload->'images' @> to_jsonb(v_url)
      or payload->'images' ? v_url
    )
  ) t;

  -- Block deletion if in use
  if array_length(v_used_by, 1) > 0 then
    return jsonb_build_object(
      'success', false,
      'in_use', true,
      'used_by', to_jsonb(v_used_by),
      'message', 'Cannot delete image: currently referenced by ' || array_to_string(v_used_by, ', ')
    );
  end if;

  -- Soft-delete the row
  update public.catalog_images
  set deleted_at = now()
  where id = p_image_id;

  return jsonb_build_object(
    'success', true,
    'in_use', false,
    'deleted_id', p_image_id,
    'storage_path', v_storage_path
  );
end;
$$;

grant execute on function public.admin_delete_catalog_image(uuid) to authenticated;
