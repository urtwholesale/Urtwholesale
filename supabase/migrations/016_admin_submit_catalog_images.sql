-- ============================================================================
-- 016_admin_submit_catalog_images.sql
-- Updates admin_submit_catalog RPC to:
-- 1. Validate that each catalog item contains at least 1 product image.
-- 2. Accept images from the 'catalog-images' bucket or standard image extensions.
-- 3. Flag items missing images as 'qc_error' with informative error message.
-- 4. Recompute total_items, passed_items, failed_items and overall upload status.
-- ============================================================================

create or replace function public.admin_submit_catalog(
  p_upload_id text,
  p_items jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_norm_keywords text[];
  v_count integer := 0;
  v_product_id uuid;
  v_item_elem jsonb;
  v_images_json jsonb;
  v_image_url text;
  v_valid_image_count integer;
  v_item_status text;
  v_error_msg text;
  v_passed_count integer := 0;
  v_failed_count integer := 0;
  v_total_count integer := 0;
begin
  -- 1. Authorization check
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can submit catalog uploads';
  end if;

  -- 2. If p_items is provided, stage/insert them into catalog_upload_items
  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for v_item_elem in select jsonb_array_elements(p_items)
    loop
      -- Extract images array from top-level or payload
      v_images_json := coalesce(
        v_item_elem->'images',
        v_item_elem->'payload'->'images',
        '[]'::jsonb
      );

      -- Count valid images (must be HTTP(S) URL from catalog-images bucket OR ending in image extension)
      v_valid_image_count := 0;
      if jsonb_typeof(v_images_json) = 'array' then
        for v_image_url in select jsonb_array_elements_text(v_images_json)
        loop
          if v_image_url is not null and trim(v_image_url) <> '' then
            if v_image_url ~* '^https?://' and (
              v_image_url ~* '/catalog-images/' or
              v_image_url ~* '\.(jpg|jpeg|png|webp|gif|avif|svg|bmp|tiff)(\?.*)?$'
            ) then
              v_valid_image_count := v_valid_image_count + 1;
            end if;
          end if;
        end loop;
      end if;

      -- Validate "at least 1 image" rule
      if v_valid_image_count < 1 then
        v_item_status := 'qc_error';
        v_error_msg := 'At least 1 valid product image is required (must be HTTPS ending in image extension or from catalog-images bucket)';
      else
        v_item_status := coalesce(v_item_elem->>'status', 'qc_pass');
        v_error_msg := v_item_elem->>'error_message';
      end if;

      v_norm_keywords := public.normalize_keywords_array(
        coalesce(v_item_elem->'keywords', v_item_elem->'payload'->'keywords', '[]'::jsonb)
      );

      insert into public.catalog_upload_items (
        upload_id,
        row_number,
        title,
        sku,
        status,
        error_message,
        product_id,
        payload
      )
      values (
        p_upload_id,
        coalesce((v_item_elem->>'row_number')::integer, (v_item_elem->>'rowNumber')::integer, 1),
        coalesce(v_item_elem->>'title', v_item_elem->>'name', ''),
        v_item_elem->>'sku',
        v_item_status,
        v_error_msg,
        (v_item_elem->>'product_id')::uuid,
        coalesce(v_item_elem->'payload', v_item_elem) || jsonb_build_object(
          'keywords', to_jsonb(v_norm_keywords),
          'valid_image_count', v_valid_image_count
        )
      );
    end loop;
  end if;

  -- 3. For each item in the upload, recalculate stats & update product keywords
  for v_item in
    select id, upload_id, product_id, sku, status, payload
    from public.catalog_upload_items
    where upload_id = p_upload_id
  loop
    v_total_count := v_total_count + 1;
    if v_item.status = 'qc_pass' then
      v_passed_count := v_passed_count + 1;
    else
      v_failed_count := v_failed_count + 1;
    end if;

    v_norm_keywords := public.normalize_keywords_array(v_item.payload->'keywords');

    -- Update staged payload with normalized keywords
    update public.catalog_upload_items
    set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{keywords}', to_jsonb(v_norm_keywords))
    where id = v_item.id;

    -- Resolve product ID (direct reference or via SKU)
    v_product_id := v_item.product_id;
    if v_product_id is null and v_item.sku is not null and trim(v_item.sku) <> '' then
      select id into v_product_id from public.products where sku = v_item.sku limit 1;
    end if;

    -- Copy normalized keywords into products.keywords
    if v_product_id is not null then
      update public.products
      set
        keywords = v_norm_keywords,
        updated_at = now()
      where id = v_product_id;

      v_count := v_count + 1;
    end if;
  end loop;

  -- 4. Update catalog_uploads summary stats and overall status
  update public.catalog_uploads
  set
    total_items = v_total_count,
    passed_items = v_passed_count,
    failed_items = v_failed_count,
    status = case
      when v_total_count = 0 then 'qc_in_progress'
      when v_failed_count = 0 then 'qc_pass'
      when v_passed_count = 0 then 'qc_error'
      else 'action_required'
    end,
    updated_at = now()
  where id = p_upload_id;

  return jsonb_build_object(
    'success', true,
    'upload_id', p_upload_id,
    'products_updated', v_count,
    'total_items', v_total_count,
    'passed_items', v_passed_count,
    'failed_items', v_failed_count
  );
end;
$$;

grant execute on function public.admin_submit_catalog(text, jsonb) to authenticated;
