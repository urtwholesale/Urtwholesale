-- Migration 023: Diverse New Arrivals Per Category
-- Retrieves newest active products distributed evenly across every parent category family
-- prevents single category monopolization of home page showcase

create or replace function public.get_new_arrivals_by_category(items_per_category int default 2)
returns setof public.products
language sql
security definer
set search_path = public
stable
as $$
  with recursive cat_tree as (
    -- Root parent categories
    select id as category_id, id as root_parent_id, sort_order
    from public.categories
    where parent_id is null and is_active = true
    
    union all
    
    -- Child categories mapped to root parent
    select c.id as category_id, ct.root_parent_id, ct.sort_order
    from public.categories c
    join cat_tree ct on c.parent_id = ct.category_id
    where c.is_active = true
  ),
  ranked_products as (
    select 
      p.*,
      ct.sort_order as cat_sort_order,
      row_number() over (
        partition by ct.root_parent_id 
        order by p.created_at desc, p.id
      ) as rn
    from public.products p
    join cat_tree ct on p.category_id = ct.category_id
    where p.is_active = true
  )
  select 
    id, name, slug, description, category_id, price, mrp, stock,
    min_order_quantity, images, is_active, is_featured, is_urbanrat_brand,
    specs, created_at, updated_at
  from ranked_products
  where rn <= items_per_category
  order by rn asc, cat_sort_order asc, created_at desc;
$$;

-- Grant execution to public anon and authenticated users
grant execute on function public.get_new_arrivals_by_category(int) to anon, authenticated;

-- Refresh schema cache
notify pgrst, 'reload schema';

