-- ============================================================================
-- Migration: 009_catalog_keywords.sql
-- Description: Adds keywords text[] column & GIN index to products, updates
--              search_products RPC to search keywords, and provides
--              admin_submit_catalog with keyword normalization.
-- ============================================================================

-- 1. ADD KEYWORDS COLUMN TO PRODUCTS (ALTER ONLY)
alter table public.products
  add column if not exists keywords text[] not null default '{}';

-- 2. CREATE GIN INDEX ON PRODUCTS.KEYWORDS
create index if not exists idx_products_keywords
  on public.products using gin (keywords);

-- ----------------------------------------------------------------------------
-- 3. KEYWORD NORMALIZATION HELPER FUNCTION
-- ----------------------------------------------------------------------------
-- Rules applied:
-- - Accepts jsonb array of strings, single string, or delimited text
-- - Handles separators: comma, semicolon, pipe, newline
-- - Trims whitespace
-- - Lowercases all characters
-- - Collapses inner whitespace (\s+ -> ' ')
-- - Removes duplicate keywords (preserving first seen order)
-- - Max 30 keywords per product
-- - Max 50 characters per keyword
-- - Ignores empty values
-- - Optional (returns '{}'::text[] if empty or null)
create or replace function public.normalize_keywords_array(p_raw jsonb)
returns text[]
language plpgsql
immutable
as $$
declare
  v_result text[] := '{}'::text[];
  v_item text;
  v_split text[];
  v_tok text;
  v_cleaned text;
begin
  if p_raw is null or jsonb_typeof(p_raw) = 'null' then
    return '{}'::text[];
  end if;

  for v_item in
    select jsonb_array_elements_text(
      case
        when jsonb_typeof(p_raw) = 'array' then p_raw
        when jsonb_typeof(p_raw) = 'string' then jsonb_build_array(p_raw)
        else '[]'::jsonb
      end
    )
  loop
    v_split := regexp_split_to_array(v_item, '[,;|\n\r]+');
    foreach v_tok in array v_split
    loop
      v_cleaned := regexp_replace(lower(trim(v_tok)), '\s+', ' ', 'g');
      if length(v_cleaned) > 0 then
        if length(v_cleaned) > 50 then
          v_cleaned := substring(v_cleaned from 1 for 50);
        end if;
        if not (v_cleaned = any(v_result)) then
          if array_length(v_result, 1) is null or array_length(v_result, 1) < 30 then
            v_result := array_append(v_result, v_cleaned);
          end if;
        end if;
      end if;
    end loop;
  end loop;

  return v_result;
end;
$$;

grant execute on function public.normalize_keywords_array(jsonb) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. FUNCTION: ADMIN_SUBMIT_CATALOG
-- ----------------------------------------------------------------------------
-- Processes catalog upload items, validates & normalizes keywords from
-- payload.keywords, and synchronizes them to products.keywords.
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
begin
  -- 1. Authorization check
  if not public.is_admin() then
    raise exception 'Unauthorized: Only an administrator can submit catalog uploads';
  end if;

  -- 2. If p_items is provided, stage/insert them into catalog_upload_items
  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for v_item_elem in select jsonb_array_elements(p_items)
    loop
      v_norm_keywords := public.normalize_keywords_array(
        coalesce(v_item_elem->'keywords', v_item_elem->'payload'->'keywords', '[]'::jsonb)
      );

      insert into public.catalog_upload_items (
        upload_id,
        row_number,
        title,
        sku,
        status,
        product_id,
        payload
      )
      values (
        p_upload_id,
        coalesce((v_item_elem->>'row_number')::integer, (v_item_elem->>'rowNumber')::integer, 1),
        coalesce(v_item_elem->>'title', v_item_elem->>'name', ''),
        v_item_elem->>'sku',
        coalesce(v_item_elem->>'status', 'qc_pass'),
        (v_item_elem->>'product_id')::uuid,
        coalesce(v_item_elem->'payload', v_item_elem) || jsonb_build_object('keywords', to_jsonb(v_norm_keywords))
      );
    end loop;
  end if;

  -- 3. For each item in the upload, validate & normalize keywords, then copy into products.keywords
  for v_item in
    select id, upload_id, product_id, sku, payload
    from public.catalog_upload_items
    where upload_id = p_upload_id
  loop
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

  -- 4. Touch upload record updated_at
  update public.catalog_uploads
  set updated_at = now()
  where id = p_upload_id;

  return jsonb_build_object(
    'success', true,
    'upload_id', p_upload_id,
    'products_updated', v_count
  );
end;
$$;

grant execute on function public.admin_submit_catalog(text, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. UPDATE STOREFRONT SEARCH FUNCTION (SEARCH_PRODUCTS)
-- ----------------------------------------------------------------------------
-- Matches products.keywords (case-insensitive partial match) in addition
-- to title, SKU and brand. Preserves existing ranking: Title matches
-- rank first (prefix=1, substring=2), SKU prefix=3, SKU substring=4,
-- Brand=5, Keyword prefix=6, Keyword substring=7, and trigram similarity.
create or replace function public.search_products(
  q text,
  max_rows integer default 8
)
returns setof public.products
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.products
  where is_active = true
    and (
      name ilike ('%' || trim(q) || '%')
      or (sku is not null and sku ilike ('%' || trim(q) || '%'))
      or (
        case
          when is_urbanrat_brand and 'urbanrat' ilike ('%' || trim(q) || '%') then true
          when specs is not null and (specs->>'brand') ilike ('%' || trim(q) || '%') then true
          else false
        end
      )
      or exists (
        select 1
        from unnest(keywords) kw
        where kw ilike ('%' || trim(q) || '%')
      )
      or similarity(name, trim(q)) > 0.15
    )
  order by
    case
      -- 1. Exact or prefix title match
      when name ilike (trim(q) || '%') then 1
      -- 2. Substring title match
      when name ilike ('%' || trim(q) || '%') then 2
      -- 3. SKU prefix match
      when sku is not null and sku ilike (trim(q) || '%') then 3
      -- 4. SKU substring match
      when sku is not null and sku ilike ('%' || trim(q) || '%') then 4
      -- 5. Brand match
      when is_urbanrat_brand and 'urbanrat' ilike ('%' || trim(q) || '%') then 5
      when specs is not null and (specs->>'brand') ilike ('%' || trim(q) || '%') then 5
      -- 6. Keyword prefix match
      when exists (
        select 1 from unnest(keywords) kw
        where kw ilike (trim(q) || '%')
      ) then 6
      -- 7. Keyword substring match
      when exists (
        select 1 from unnest(keywords) kw
        where kw ilike ('%' || trim(q) || '%')
      ) then 7
      else 8
    end,
    similarity(name, trim(q)) desc,
    is_featured desc,
    created_at desc
  limit coalesce(max_rows, 8);
$$;

grant execute on function public.search_products(text, integer) to anon, authenticated;
