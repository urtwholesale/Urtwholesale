-- ============================================================================
-- Migration: 020_search_engine_v2.sql
-- Description: Typo-tolerant, synonym-aware full-text & trigram search engine
--              with vocabulary harvesting, fallback ladder, and search logs.
-- ============================================================================

-- 1. EXTENSIONS
create extension if not exists pg_trgm with schema public;
create extension if not exists unaccent with schema public;
create extension if not exists fuzzystrmatch with schema public;

-- 2. SCHEMA ALIGNMENT ON PRODUCTS (IDEMPOTENT)
alter table public.products
  add column if not exists brand text,
  add column if not exists attributes jsonb default '{}'::jsonb,
  add column if not exists keywords text[] not null default '{}',
  add column if not exists search_text text,
  add column if not exists search_vector tsvector;

-- 3. SEARCH SYNONYMS TABLE
create table if not exists public.search_synonyms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  synonyms text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_search_synonyms_term on public.search_synonyms(term);
create index if not exists idx_search_synonyms_synonyms on public.search_synonyms using gin(synonyms);

-- RLS for search_synonyms
alter table public.search_synonyms enable row level security;

drop policy if exists "Anyone can read active synonyms" on public.search_synonyms;
create policy "Anyone can read active synonyms"
  on public.search_synonyms for select
  using (is_active = true);

drop policy if exists "Admins have full access to synonyms" on public.search_synonyms;
create policy "Admins have full access to synonyms"
  on public.search_synonyms for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed wholesale mobile-accessory domain synonyms
insert into public.search_synonyms (term, synonyms, is_active)
values
  ('charger', array['charger', 'chargers', 'adapter', 'adapters', 'power adapter', 'fast charger', 'pd charger', 'single usb charger', 'double usb charger', 'charjer', 'chargar', 'charget'], true),
  ('adapter', array['adapter', 'adapters', 'charger', 'chargers', 'power adapter', 'fast charger'], true),
  ('earphone', array['earphone', 'earphones', 'earbuds', 'handsfree', 'headset', 'headphone', 'headphones', 'earfone', 'erfone', 'ear phones', '3.5 mm jack earphone', 'type c earphones'], true),
  ('earbuds', array['earbuds', 'earphone', 'earphones', 'tws', 'buds', 'airpods', 'pods', 'wireless earbuds'], true),
  ('tws', array['tws', 'buds', 'earbuds', 'wireless earbuds', 'bluetooth earbuds', 'airpods'], true),
  ('buds', array['buds', 'tws', 'earbuds', 'earphones', 'wireless earbuds'], true),
  ('cable', array['cable', 'cables', 'cord', 'cords', 'wire', 'wires', 'data cable', 'fast charging cable', 'cabel', 'caable'], true),
  ('glass', array['glass', 'tempered glass', 'screen guard', 'screen protector', 'tempered', 'uv glass', 'd plus', 'super x', 'tempred', 'temperd', '9d', '11d', 'gorilla glass'], true),
  ('tempered', array['tempered', 'tempered glass', 'glass', 'screen guard', 'screen protector', 'tempred', 'temperd'], true),
  ('cover', array['cover', 'covers', 'case', 'cases', 'back cover', 'phone case', 'pouch', 'skin', 'protective case'], true),
  ('case', array['case', 'cases', 'cover', 'covers', 'back cover', 'phone cover'], true),
  ('type c', array['type c', 'type-c', 'typec', 'usb c', 'usbc', 'type c cable', 'type c charger'], true),
  ('typec', array['typec', 'type c', 'type-c', 'usb c', 'usbc'], true),
  ('powerbank', array['powerbank', 'power bank', 'portable charger', 'battery pack', 'powerbanks'], true),
  ('otg', array['otg', 'otg connector', 'otg adapter', 'type-c otg connectors'], true),
  ('neckband', array['neckband', 'neck band', 'bluetooth neckband', 'wireless neckband', 'neckbands'], true),
  ('lens ring', array['lens ring', 'camera protector', 'lens protector', 'camera ring', 'lens guard', 'ar af', 'ar+af'], true),
  ('camera protector', array['camera protector', 'lens ring', 'lens protector', 'camera ring', 'ar+af lens ring'], true),
  ('mobile stand', array['mobile stand', 'phone stand', 'holder', 'mobile holder', 'desktop stand', 'pyramid stand'], true),
  ('iphone', array['iphone', 'apple', 'iphne', 'iphon', 'i phone'], true),
  ('samsung', array['samsung', 'galaxy', 'samsng', 'samung'], true),
  ('realme', array['realme', 'relme', 'realmi'], true),
  ('oneplus', array['oneplus', '1plus', 'onplus', 'one plus'], true),
  ('infinix', array['infinix', 'infnix', 'infinx', 'infinex'], true),
  ('motorola', array['motorola', 'moto'], true),
  ('vivo', array['vivo', 'vvo'], true),
  ('oppo', array['oppo', 'opo'], true),
  ('redmi', array['redmi', 'xiaomi', 'mi'], true),
  ('boat', array['boat', 'boAt'], true)
on conflict (term) do update
set synonyms = excluded.synonyms, is_active = excluded.is_active;

-- 4. SEARCH VOCABULARY TABLE
create table if not exists public.search_vocabulary (
  term text primary key,
  frequency integer not null default 1
);

create index if not exists idx_search_vocabulary_term_trgm on public.search_vocabulary using gin(term gin_trgm_ops);

-- Function to harvest distinct search tokens across entire catalog
create or replace function public.refresh_search_vocabulary()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  create temp table temp_search_tokens (token text) on commit drop;

  -- 1. Product names
  insert into temp_search_tokens (token)
  select lower(trim(unnest(regexp_split_to_array(unaccent(name), '[\s,./\-_+()]+'))))
  from public.products
  where is_active = true and name is not null;

  -- 2. SKUs
  insert into temp_search_tokens (token)
  select lower(trim(unnest(regexp_split_to_array(unaccent(sku), '[\s,./\-_+()]+'))))
  from public.products
  where is_active = true and sku is not null;

  -- 3. Brands & Specs Compatibility
  insert into temp_search_tokens (token)
  select lower(trim(unnest(regexp_split_to_array(unaccent(coalesce(brand, specs->>'brand_compatibility', '')), '[\s,./\-_+()]+'))))
  from public.products
  where is_active = true;

  insert into temp_search_tokens (token)
  select lower(trim(unnest(regexp_split_to_array(unaccent(coalesce(specs->>'compatibility_group', '')), '[\s,./\-_+()]+'))))
  from public.products
  where is_active = true;

  -- 4. Category and Subcategory Names
  insert into temp_search_tokens (token)
  select lower(trim(unnest(regexp_split_to_array(unaccent(name), '[\s,./\-_+()]+'))))
  from public.categories
  where is_active = true and name is not null;

  -- 5. Seed Vocabulary with frequencies
  delete from public.search_vocabulary;

  insert into public.search_vocabulary (term, frequency)
  select token, count(*)::integer as frequency
  from temp_search_tokens
  where length(token) >= 2
    and token !~ '^[0-9]+$' -- skip standalone pure numbers unless relevant
  group by token
  having count(*) >= 1
  order by frequency desc;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

grant execute on function public.refresh_search_vocabulary() to anon, authenticated;

-- 5. SEARCH LOGS TABLE
create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  normalized_query text not null,
  result_count integer not null default 0,
  match_type text not null default 'exact',
  clicked_product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_logs_created_at on public.search_logs(created_at desc);
create index if not exists idx_search_logs_result_count on public.search_logs(result_count);
create index if not exists idx_search_logs_norm_query on public.search_logs(normalized_query);

alter table public.search_logs enable row level security;

drop policy if exists "Anyone can insert search logs" on public.search_logs;
create policy "Anyone can insert search logs"
  on public.search_logs for insert
  with check (true);

drop policy if exists "Admins can select search logs" on public.search_logs;
create policy "Admins can select search logs"
  on public.search_logs for select
  using (public.is_admin());

-- RPC: Top zero-result searches for admin analytics
create or replace function public.admin_top_zero_result_searches(p_days int default 30)
returns table(
  normalized_query text,
  search_count bigint,
  last_searched_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    normalized_query,
    count(*) as search_count,
    max(created_at) as last_searched_at
  from public.search_logs
  where result_count = 0
    and created_at >= (now() - (coalesce(p_days, 30) || ' days')::interval)
    and length(trim(normalized_query)) > 0
  group by normalized_query
  order by search_count desc, last_searched_at desc
  limit 50;
$$;

grant execute on function public.admin_top_zero_result_searches(int) to anon, authenticated;

-- RPC: Log a search event
create or replace function public.log_search_event(
  p_query text,
  p_normalized_query text,
  p_result_count integer default 0,
  p_match_type text default 'exact'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.search_logs (query, normalized_query, result_count, match_type)
  values (
    coalesce(trim(p_query), ''),
    coalesce(trim(p_normalized_query), ''),
    coalesce(p_result_count, 0),
    coalesce(p_match_type, 'exact')
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_search_event(text, text, integer, text) to anon, authenticated;

-- RPC: Log click on product from search
create or replace function public.log_search_click(
  p_search_id uuid,
  p_product_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.search_logs
  set clicked_product_id = p_product_id
  where id = p_search_id;
$$;

grant execute on function public.log_search_click(uuid, uuid) to anon, authenticated;

-- 6. MAINTAINED SEARCH VECTOR AND TEXT ON PRODUCTS
create or replace function public.build_product_search_text(p_product public.products)
returns text
language plpgsql
stable
as $$
declare
  v_cat_name text := '';
  v_subcat_name text := '';
  v_parent_id uuid;
  v_brand text;
  v_comp_brand text;
  v_comp_grp text;
  v_keywords_text text := '';
begin
  -- Resolve Category & Subcategory names
  if p_product.category_id is not null then
    select name, parent_id into v_cat_name, v_parent_id
    from public.categories
    where id = p_product.category_id;

    if v_parent_id is not null then
      v_subcat_name := v_cat_name;
      select name into v_cat_name
      from public.categories
      where id = v_parent_id;
    end if;
  end if;

  v_brand := coalesce(p_product.brand, '');
  v_comp_brand := coalesce(p_product.specs->>'brand_compatibility', '');
  v_comp_grp := coalesce(p_product.specs->>'compatibility_group', '');
  v_keywords_text := coalesce(array_to_string(p_product.keywords, ' '), '');

  return trim(
    coalesce(p_product.name, '') || ' ' ||
    coalesce(p_product.sku, '') || ' ' ||
    v_brand || ' ' ||
    v_comp_brand || ' ' ||
    v_comp_grp || ' ' ||
    v_cat_name || ' ' ||
    v_subcat_name || ' ' ||
    v_keywords_text || ' ' ||
    substring(coalesce(p_product.description, ''), 1, 300)
  );
end;
$$;

create or replace function public.build_product_search_vector(p_product public.products)
returns tsvector
language plpgsql
stable
as $$
declare
  v_cat_name text := '';
  v_brand text;
  v_comp_brand text;
  v_comp_grp text;
  v_keywords_text text := '';
begin
  if p_product.category_id is not null then
    select name into v_cat_name
    from public.categories
    where id = p_product.category_id;
  end if;

  v_brand := coalesce(p_product.brand, p_product.specs->>'brand_compatibility', '');
  v_comp_brand := coalesce(p_product.specs->>'brand_compatibility', '');
  v_comp_grp := coalesce(p_product.specs->>'compatibility_group', '');
  v_keywords_text := coalesce(array_to_string(p_product.keywords, ' '), '');

  return (
    setweight(to_tsvector('english', unaccent(coalesce(p_product.name, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(p_product.sku, ''))), 'A') ||
    setweight(to_tsvector('english', unaccent(v_brand)), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(v_cat_name, ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(v_comp_brand || ' ' || v_comp_grp)), 'C') ||
    setweight(to_tsvector('english', unaccent(v_keywords_text)), 'C') ||
    setweight(to_tsvector('english', unaccent(substring(coalesce(p_product.description, ''), 1, 200))), 'D')
  );
end;
$$;

-- Trigger to maintain search_text and search_vector automatically
create or replace function public.trg_maintain_product_search()
returns trigger
language plpgsql
as $$
begin
  NEW.search_text := public.build_product_search_text(NEW);
  NEW.search_vector := public.build_product_search_vector(NEW);
  return NEW;
end;
$$;

drop trigger if exists trg_maintain_product_search on public.products;
create trigger trg_maintain_product_search
  before insert or update on public.products
  for each row
  execute function public.trg_maintain_product_search();

-- Backfill existing products
update public.products
set
  search_text = public.build_product_search_text(products),
  search_vector = public.build_product_search_vector(products)
where search_vector is null or search_text is null;

-- Populate search vocabulary initially
select public.refresh_search_vocabulary();

-- Create search indexes
create index if not exists idx_products_search_vector on public.products using gin(search_vector);
create index if not exists idx_products_name_trgm on public.products using gin(name gin_trgm_ops);
create index if not exists idx_products_sku_trgm on public.products using gin(sku gin_trgm_ops);
create index if not exists idx_products_search_text_trgm on public.products using gin(search_text gin_trgm_ops);

-- 7. SPELLING CORRECTION HELPER
create or replace function public.correct_query_token(p_token text)
returns text
language plpgsql
stable
as $$
declare
  v_tok text := lower(trim(p_token));
  v_match text;
begin
  if length(v_tok) < 3 then
    return v_tok;
  end if;

  -- 1. Exact match in vocabulary
  if exists (select 1 from public.search_vocabulary where term = v_tok) then
    return v_tok;
  end if;

  -- 2. Exact match in synonyms
  if exists (select 1 from public.search_synonyms where term = v_tok or synonyms @> array[v_tok]) then
    return v_tok;
  end if;

  -- 3. Trigram & Levenshtein matching in search_vocabulary
  select term into v_match
  from public.search_vocabulary
  where similarity(term, v_tok) >= 0.35
     or (length(v_tok) <= 4 and levenshtein(term, v_tok) <= 1)
     or (length(v_tok) > 4 and levenshtein(term, v_tok) <= 2)
  order by
    similarity(term, v_tok) desc,
    frequency desc
  limit 1;

  return coalesce(v_match, v_tok);
end;
$$;

-- 8. RPC: SEARCH_PRODUCTS_V2
create or replace function public.search_products_v2(
  p_query text,
  p_category_ids uuid[] default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_urbanrat_only boolean default false,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_query text;
  v_norm_query text;
  v_corrected_query text := '';
  v_did_you_mean text := null;
  v_words text[];
  v_word text;
  v_corrected_word text;
  v_expanded_terms text[];
  v_tsquery tsquery;
  v_match_type text := 'exact';
  v_total integer := 0;
  v_limit integer := coalesce(p_limit, 24);
  v_offset integer := coalesce(p_offset, 0);
  v_results jsonb := '[]'::jsonb;
begin
  -- 1. Normalize query
  v_clean_query := trim(regexp_replace(coalesce(p_query, ''), '[,():/\\+*&^%$#@!~]+', ' ', 'g'));
  v_clean_query := trim(regexp_replace(v_clean_query, '\s+', ' ', 'g'));
  v_norm_query := lower(unaccent(v_clean_query));

  -- If empty query, return popular / newest items
  if length(v_norm_query) = 0 then
    select count(*) into v_total
    from public.products p
    where p.is_active = true
      and (p_category_ids is null or p.category_id = any(p_category_ids))
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (not p_urbanrat_only or p.is_urbanrat_brand = true);

    select coalesce(jsonb_agg(sub.p_obj), '[]'::jsonb) into v_results
    from (
      select jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'description', p.description,
        'short_description', p.short_description,
        'price', p.price,
        'mrp', p.mrp,
        'sku', p.sku,
        'stock', case when p.stock > 0 then 9999 else 0 end,
        'in_stock', (p.stock > 0),
        'images', p.images,
        'category_id', p.category_id,
        'is_urbanrat_brand', p.is_urbanrat_brand,
        'is_active', p.is_active,
        'is_featured', p.is_featured,
        'is_trending', p.is_trending,
        'specs', p.specs,
        'warranty_months', p.warranty_months,
        'rating_avg', p.rating_avg,
        'rating_count', p.rating_count,
        'min_order_qty', p.min_order_qty,
        'order_qty_step', p.order_qty_step,
        'created_at', p.created_at,
        'price_tiers', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', t.id,
              'product_id', t.product_id,
              'min_qty', t.min_qty,
              'unit_price', t.unit_price
            ) order by t.min_qty asc
          )
          from public.product_price_tiers t
          where t.product_id = p.id
        ), '[]'::jsonb)
      ) as p_obj
      from public.products p
      where p.is_active = true
        and (p_category_ids is null or p.category_id = any(p_category_ids))
        and (p_min_price is null or p.price >= p_min_price)
        and (p_max_price is null or p.price <= p_max_price)
        and (not p_urbanrat_only or p.is_urbanrat_brand = true)
      order by
        case when p_sort = 'price_asc' then p.price end asc,
        case when p_sort = 'price_desc' then p.price end desc,
        case when p_sort = 'newest' then p.created_at end desc,
        (p.stock > 0) desc,
        p.is_featured desc,
        p.is_trending desc,
        p.created_at desc
      limit v_limit offset v_offset
    ) sub;

    return jsonb_build_object(
      'normalized_query', '',
      'corrected_query', null,
      'did_you_mean', null,
      'match_type', 'popular',
      'total', v_total,
      'products', v_results
    );
  end if;

  -- 2. Spell-check query token-by-token
  v_words := regexp_split_to_array(v_norm_query, '\s+');
  foreach v_word in array v_words
  loop
    v_corrected_word := public.correct_query_token(v_word);
    v_corrected_query := trim(v_corrected_query || ' ' || v_corrected_word);
  end loop;

  if v_corrected_query <> v_norm_query and length(v_corrected_query) > 0 then
    v_did_you_mean := v_corrected_query;
  else
    v_corrected_query := v_norm_query;
  end if;

  -- 3. Synonym expansion
  select coalesce(array_agg(distinct s_elem), array[]::text[]) into v_expanded_terms
  from (
    select unnest(synonyms) as s_elem
    from public.search_synonyms
    where is_active = true
      and (term = v_norm_query or term = v_corrected_query or synonyms @> array[v_norm_query] or synonyms @> array[v_corrected_query])
    union
    select v_norm_query
    union
    select v_corrected_query
  ) syns
  where s_elem is not null and length(s_elem) > 0;

  -- Build tsquery
  begin
    v_tsquery := websearch_to_tsquery('english', v_corrected_query);
  exception when others then
    v_tsquery := plainto_tsquery('english', v_corrected_query);
  end;

  -- -------------------------------------------------------------------------
  -- FALLBACK LADDER
  -- -------------------------------------------------------------------------

  -- Temporary table to hold candidates with scoring
  create temp table temp_search_candidates (
    id uuid,
    score numeric,
    stock_status boolean,
    is_featured boolean,
    is_trending boolean,
    created_at timestamptz,
    price numeric
  ) on commit drop;

  -- LEVEL 1: Exact SKU, Name Prefix, tsquery, or high trigram
  insert into temp_search_candidates (id, score, stock_status, is_featured, is_trending, created_at, price)
  select
    p.id,
    (
      case when lower(p.sku) = v_norm_query then 120 else 0 end +
      case when lower(p.name) = v_norm_query then 100 else 0 end +
      case when lower(p.name) ilike (v_norm_query || '%') then 80 else 0 end +
      case when lower(p.name) ilike ('%' || v_norm_query || '%') then 60 else 0 end +
      case when (p.search_vector @@ v_tsquery) then 40 * ts_rank(p.search_vector, v_tsquery) else 0 end +
      case when p.name % v_norm_query then 30 * similarity(p.name, v_norm_query) else 0 end +
      case when p.stock > 0 then 15 else 0 end +
      case when p.is_featured then 5 else 0 end +
      case when p.is_trending then 3 else 0 end +
      case when p.is_urbanrat_brand then 2 else 0 end
    )::numeric as score,
    (p.stock > 0) as stock_status,
    p.is_featured,
    p.is_trending,
    p.created_at,
    p.price
  from public.products p
  where p.is_active = true
    and (p_category_ids is null or p.category_id = any(p_category_ids))
    and (p_min_price is null or p.price >= p_min_price)
    and (p_max_price is null or p.price <= p_max_price)
    and (not p_urbanrat_only or p.is_urbanrat_brand = true)
    and (
      lower(p.sku) = v_norm_query
      or lower(p.name) ilike ('%' || v_norm_query || '%')
      or (p.sku is not null and lower(p.sku) ilike ('%' || v_norm_query || '%'))
      or (p.search_vector is not null and p.search_vector @@ v_tsquery)
      or similarity(p.name, v_norm_query) >= 0.35
    );

  select count(*) into v_total from temp_search_candidates;
  if v_total > 0 then
    v_match_type := 'exact';
  end if;

  -- LEVEL 2: Synonym expansion & Fuzzy Matching (if Level 1 is empty)
  if v_total = 0 then
    insert into temp_search_candidates (id, score, stock_status, is_featured, is_trending, created_at, price)
    select
      p.id,
      (
        case when p.name % v_corrected_query then 40 * similarity(p.name, v_corrected_query) else 0 end +
        case when word_similarity(v_corrected_query, p.search_text) > 0.25 then 30 * word_similarity(v_corrected_query, p.search_text) else 0 end +
        case when p.search_text ilike any(select '%' || t || '%' from unnest(v_expanded_terms) t) then 25 else 0 end +
        case when p.stock > 0 then 10 else 0 end
      )::numeric as score,
      (p.stock > 0) as stock_status,
      p.is_featured,
      p.is_trending,
      p.created_at,
      p.price
    from public.products p
    where p.is_active = true
      and (p_category_ids is null or p.category_id = any(p_category_ids))
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (not p_urbanrat_only or p.is_urbanrat_brand = true)
      and (
        p.name % v_corrected_query
        or word_similarity(v_corrected_query, p.search_text) >= 0.25
        or (v_expanded_terms is not null and p.search_text ilike any(select '%' || t || '%' from unnest(v_expanded_terms) t))
      );

    select count(*) into v_total from temp_search_candidates;
    if v_total > 0 then
      v_match_type := 'fuzzy';
    end if;
  end if;

  -- LEVEL 3: Relaxed Token OR Matching (if Level 2 is empty)
  if v_total = 0 and array_length(v_words, 1) > 1 then
    insert into temp_search_candidates (id, score, stock_status, is_featured, is_trending, created_at, price)
    select
      p.id,
      (
        (select count(*)::numeric * 15 from unnest(v_words) w where length(w) >= 3 and p.search_text ilike ('%' || w || '%')) +
        case when p.stock > 0 then 5 else 0 end
      )::numeric as score,
      (p.stock > 0) as stock_status,
      p.is_featured,
      p.is_trending,
      p.created_at,
      p.price
    from public.products p
    where p.is_active = true
      and (p_category_ids is null or p.category_id = any(p_category_ids))
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (not p_urbanrat_only or p.is_urbanrat_brand = true)
      and exists (
        select 1 from unnest(v_words) w
        where length(w) >= 3 and p.search_text ilike ('%' || w || '%')
      );

    select count(*) into v_total from temp_search_candidates;
    if v_total > 0 then
      v_match_type := 'fuzzy';
    end if;
  end if;

  -- LEVEL 4: Related Products (same category / compatibility as best partial match)
  if v_total = 0 then
    declare
      v_best_cat_id uuid;
      v_best_comp text;
    begin
      select category_id, coalesce(specs->>'brand_compatibility', '')
      into v_best_cat_id, v_best_comp
      from public.products
      where is_active = true
      order by similarity(name, v_norm_query) desc
      limit 1;

      if v_best_cat_id is not null then
        insert into temp_search_candidates (id, score, stock_status, is_featured, is_trending, created_at, price)
        select
          p.id,
          (case when p.stock > 0 then 20 else 0 end + case when p.is_featured then 5 else 0 end)::numeric,
          (p.stock > 0),
          p.is_featured,
          p.is_trending,
          p.created_at,
          p.price
        from public.products p
        where p.is_active = true
          and p.category_id = v_best_cat_id
          and (p_min_price is null or p.price >= p_min_price)
          and (p_max_price is null or p.price <= p_max_price)
          and (not p_urbanrat_only or p.is_urbanrat_brand = true)
        limit 24;

        select count(*) into v_total from temp_search_candidates;
        if v_total > 0 then
          v_match_type := 'related';
        end if;
      end if;
    end;
  end if;

  -- LEVEL 5: Popular / Trending fallback (Never leave shopper at a dead end)
  if v_total = 0 then
    insert into temp_search_candidates (id, score, stock_status, is_featured, is_trending, created_at, price)
    select
      p.id,
      (case when p.stock > 0 then 10 else 0 end + case when p.is_featured then 5 else 0 end)::numeric,
      (p.stock > 0),
      p.is_featured,
      p.is_trending,
      p.created_at,
      p.price
    from public.products p
    where p.is_active = true
      and (p_category_ids is null or p.category_id = any(p_category_ids))
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (not p_urbanrat_only or p.is_urbanrat_brand = true)
    order by
      (p.stock > 0) desc,
      p.is_featured desc,
      p.is_trending desc,
      p.created_at desc
    limit 24;

    select count(*) into v_total from temp_search_candidates;
    v_match_type := 'popular';
    v_did_you_mean := null;
  end if;

  -- Aggregate paginated product payloads
  select coalesce(jsonb_agg(sub.p_obj), '[]'::jsonb) into v_results
  from (
    select jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'slug', p.slug,
      'description', p.description,
      'short_description', p.short_description,
      'price', p.price,
      'mrp', p.mrp,
      'sku', p.sku,
      'stock', case when p.stock > 0 then 9999 else 0 end,
      'in_stock', (p.stock > 0),
      'images', p.images,
      'category_id', p.category_id,
      'is_urbanrat_brand', p.is_urbanrat_brand,
      'is_active', p.is_active,
      'is_featured', p.is_featured,
      'is_trending', p.is_trending,
      'specs', p.specs,
      'warranty_months', p.warranty_months,
      'rating_avg', p.rating_avg,
      'rating_count', p.rating_count,
      'min_order_qty', p.min_order_qty,
      'order_qty_step', p.order_qty_step,
      'created_at', p.created_at,
      'price_tiers', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'product_id', t.product_id,
            'min_qty', t.min_qty,
            'unit_price', t.unit_price
          ) order by t.min_qty asc
        )
        from public.product_price_tiers t
        where t.product_id = p.id
      ), '[]'::jsonb)
    ) as p_obj
    from temp_search_candidates c
    join public.products p on p.id = c.id
    order by
      case when p_sort = 'price_asc' then c.price end asc,
      case when p_sort = 'price_desc' then c.price end desc,
      case when p_sort = 'newest' then c.created_at end desc,
      c.score desc,
      c.stock_status desc,
      c.is_featured desc,
      c.created_at desc
    limit v_limit offset v_offset
  ) sub;

  return jsonb_build_object(
    'normalized_query', v_norm_query,
    'corrected_query', case when v_did_you_mean is not null then v_corrected_query else null end,
    'did_you_mean', v_did_you_mean,
    'match_type', v_match_type,
    'total', v_total,
    'products', v_results
  );
end;
$$;

grant execute on function public.search_products_v2(text, uuid[], numeric, numeric, boolean, text, integer, integer) to anon, authenticated;

