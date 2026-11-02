-- scripts/check_anon_functions.sql
-- Assert that only authorized storefront functions have EXECUTE granted to 'anon'.
-- Fail CI if any unexpected function is exposed to anonymous callers.

WITH anon_functions AS (
  SELECT 
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
),
allowlist (proname) AS (
  VALUES
    ('product_is_in_stock'),
    ('search_products_v2'),
    ('search_products'),
    ('get_order_by_id'),
    ('create_verified_order'),
    ('submit_dealer_application'),
    ('get_dealer_application_by_code'),
    ('get_category_descendant_ids'),
    ('get_new_arrivals_by_category'),
    ('get_unit_price'),
    ('normalize_keywords_array')
),
violations AS (
  SELECT a.proname, a.args
  FROM anon_functions a
  LEFT JOIN allowlist al ON al.proname = a.proname
  WHERE al.proname IS NULL
)
SELECT 
  CASE 
    WHEN count(*) = 0 THEN 'PASS: No unauthorized functions exposed to anon'
    ELSE 'FAIL: Unauthorized functions callable by anon detected!'
  END AS status,
  count(*) AS violation_count
FROM violations;

