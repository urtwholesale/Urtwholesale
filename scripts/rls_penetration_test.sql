-- ============================================================================
-- URT Wholesale: Comprehensive Row Level Security (RLS) & Function Penetration Test
-- ============================================================================
-- Safe Execution: Wrapped in BEGIN ... ROLLBACK transaction block.
-- Simulates real attack payloads from 'anon' and unauthorized 'authenticated' roles.
-- Outputs a structured scorecard table: test_id, vector, target, expected, status.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE test_results (
  test_id text,
  attack_vector text,
  target text,
  expected text,
  actual text,
  status text
);

-- ============================================================================
-- SUITE 1: ANONYMOUS ATTACKER ('anon') SIMULATION
-- ============================================================================
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claim.role" = 'anon';

-- TEST-01: Exfiltrate profiles table
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.profiles;
  IF v_cnt = 0 THEN
    INSERT INTO test_results VALUES ('TEST-01', 'Data Exfiltration', 'public.profiles', '0 rows visible to anon', '0 rows returned', 'PASS');
  ELSE
    INSERT INTO test_results VALUES ('TEST-01', 'Data Exfiltration', 'public.profiles', '0 rows visible to anon', v_cnt || ' rows leaked to anon!', 'FAIL');
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-01', 'Data Exfiltration', 'public.profiles', '0 rows visible to anon', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-02: Exfiltrate customer shipping addresses
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.addresses;
  IF v_cnt = 0 THEN
    INSERT INTO test_results VALUES ('TEST-02', 'Data Exfiltration', 'public.addresses', '0 rows visible to anon', '0 rows returned', 'PASS');
  ELSE
    INSERT INTO test_results VALUES ('TEST-02', 'Data Exfiltration', 'public.addresses', '0 rows visible to anon', v_cnt || ' customer addresses leaked!', 'FAIL');
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-02', 'Data Exfiltration', 'public.addresses', '0 rows visible to anon', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-03: Exfiltrate customer addresses via compatibility view
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.customer_addresses;
  IF v_cnt = 0 THEN
    INSERT INTO test_results VALUES ('TEST-03', 'View RLS Bypass', 'public.customer_addresses', '0 rows or view removed', '0 rows returned', 'PASS');
  ELSE
    INSERT INTO test_results VALUES ('TEST-03', 'View RLS Bypass', 'public.customer_addresses', '0 rows or view removed', v_cnt || ' addresses leaked via view!', 'FAIL (SEC-02)');
  END IF;
EXCEPTION WHEN undefined_table THEN
  INSERT INTO test_results VALUES ('TEST-03', 'View RLS Bypass', 'public.customer_addresses', '0 rows or view removed', 'View cleanly removed', 'PASS');
WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-03', 'View RLS Bypass', 'public.customer_addresses', '0 rows or view removed', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-04: Exfiltrate orders table directly
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.orders;
  IF v_cnt = 0 THEN
    INSERT INTO test_results VALUES ('TEST-04', 'Data Exfiltration', 'public.orders', '0 rows visible to anon', '0 rows returned', 'PASS');
  ELSE
    INSERT INTO test_results VALUES ('TEST-04', 'Data Exfiltration', 'public.orders', '0 rows visible to anon', v_cnt || ' orders leaked!', 'FAIL');
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-04', 'Data Exfiltration', 'public.orders', '0 rows visible to anon', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-05: Forge order directly into orders table (Bypassing pricing/stock verification)
DO $$
BEGIN
  INSERT INTO public.orders (id, total, status) VALUES ('HACK-TEST-001', 0, 'delivered');
  INSERT INTO test_results VALUES ('TEST-05', 'Integrity Tampering', 'public.orders (direct insert)', 'Permission denied', 'Direct insert succeeded!', 'FAIL');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-05', 'Integrity Tampering', 'public.orders (direct insert)', 'Permission denied', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-06: Forge dealer application directly (Bypassing review/token generator)
DO $$
BEGIN
  INSERT INTO public.dealer_applications (full_name, phone, status) VALUES ('Attacker', '9999999999', 'approved');
  INSERT INTO test_results VALUES ('TEST-06', 'Integrity Tampering', 'public.dealer_applications (direct insert)', 'Permission denied', 'Direct insert succeeded!', 'FAIL');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-06', 'Integrity Tampering', 'public.dealer_applications (direct insert)', 'Permission denied', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-07: Read raw inventory stock count
DO $$
DECLARE
  v_stock integer;
BEGIN
  SELECT stock INTO v_stock FROM public.products LIMIT 1;
  INSERT INTO test_results VALUES ('TEST-07', 'Inventory Scraping', 'public.products.stock', 'Stock column blocked to anon', 'Raw stock leaked: ' || coalesce(v_stock::text, 'null'), 'FAIL (SEC-04: Pending 026b)');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-07', 'Inventory Scraping', 'public.products.stock', 'Stock column blocked to anon', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-08: Exfiltrate internal inventory stock movements
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.stock_movements;
  IF v_cnt = 0 THEN
    INSERT INTO test_results VALUES ('TEST-08', 'Data Exfiltration', 'public.stock_movements', '0 rows visible to anon', '0 rows returned', 'PASS');
  ELSE
    INSERT INTO test_results VALUES ('TEST-08', 'Data Exfiltration', 'public.stock_movements', '0 rows visible to anon', v_cnt || ' movements leaked!', 'FAIL');
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-08', 'Data Exfiltration', 'public.stock_movements', '0 rows visible to anon', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-09: Exfiltrate internal bulk operations audit log
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.bulk_operations;
  IF v_cnt = 0 THEN
    INSERT INTO test_results VALUES ('TEST-09', 'Data Exfiltration', 'public.bulk_operations', '0 rows visible to anon', '0 rows returned', 'PASS');
  ELSE
    INSERT INTO test_results VALUES ('TEST-09', 'Data Exfiltration', 'public.bulk_operations', '0 rows visible to anon', v_cnt || ' logs leaked!', 'FAIL');
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-09', 'Data Exfiltration', 'public.bulk_operations', '0 rows visible to anon', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-10: Exfiltrate warranty return claims
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.return_claims;
  IF v_cnt = 0 THEN
    INSERT INTO test_results VALUES ('TEST-10', 'Data Exfiltration', 'public.return_claims', '0 rows visible to anon', '0 rows returned', 'PASS');
  ELSE
    INSERT INTO test_results VALUES ('TEST-10', 'Data Exfiltration', 'public.return_claims', '0 rows visible to anon', v_cnt || ' claims leaked!', 'FAIL');
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-10', 'Data Exfiltration', 'public.return_claims', '0 rows visible to anon', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-11: Invoke admin RPC (admin_adjust_stock) as anon
DO $$
BEGIN
  PERFORM public.admin_adjust_stock('00000000-0000-0000-0000-000000000000'::uuid, 100, 'hack');
  INSERT INTO test_results VALUES ('TEST-11', 'Privilege Escalation', 'RPC: admin_adjust_stock', 'Permission denied / forbidden', 'Execution allowed!', 'FAIL');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-11', 'Privilege Escalation', 'RPC: admin_adjust_stock', 'Permission denied / forbidden', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-12: Invoke customer phone intelligence leak (get_customer_lifetime_stats) as anon
DO $$
DECLARE
  v_res jsonb;
BEGIN
  v_res := public.get_customer_lifetime_stats('9876543210');
  IF v_res IS NOT NULL AND (v_res->>'total_orders')::int > 0 THEN
    INSERT INTO test_results VALUES ('TEST-12', 'Information Disclosure', 'RPC: get_customer_lifetime_stats', 'Permission denied / forbidden', 'Stats leaked to anon!', 'FAIL (SEC-01)');
  ELSE
    INSERT INTO test_results VALUES ('TEST-12', 'Information Disclosure', 'RPC: get_customer_lifetime_stats', 'Permission denied / forbidden', 'No data returned', 'PASS');
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-12', 'Information Disclosure', 'RPC: get_customer_lifetime_stats', 'Permission denied / forbidden', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-13: Bypass checkout gate via direct create_verified_order_guest
DO $$
BEGIN
  PERFORM public.create_verified_order_guest('{}'::jsonb, '[]'::jsonb);
  INSERT INTO test_results VALUES ('TEST-13', 'Gate Bypass', 'RPC: create_verified_order_guest', 'Permission denied (service_role only)', 'Direct invocation succeeded!', 'FAIL');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-13', 'Gate Bypass', 'RPC: create_verified_order_guest', 'Permission denied (service_role only)', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- ============================================================================
-- SUITE 2: AUTHENTICATED CUSTOMER ATTACKER SIMULATION
-- ============================================================================
-- Simulate Authenticated User A (UUID: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- TEST-14: Authenticated user attempting self-elevation to admin role
DO $$
BEGIN
  UPDATE public.profiles 
  SET role = 'admin' 
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

  INSERT INTO test_results VALUES ('TEST-14', 'Privilege Escalation', 'public.profiles (role update)', 'Exception: role change not permitted', 'Role update succeeded!', 'FAIL');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-14', 'Privilege Escalation', 'public.profiles (role update)', 'Exception: role change not permitted', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- TEST-15: Authenticated user attempting to read Customer B's addresses
DO $$
DECLARE
  v_cnt integer;
BEGIN
  -- Customer B is bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
  SELECT count(*) INTO v_cnt 
  FROM public.addresses 
  WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  IF v_cnt = 0 THEN
    INSERT INTO test_results VALUES ('TEST-15', 'Horizontal Privilege Escalation', 'public.addresses (other user)', '0 rows visible', '0 rows returned', 'PASS');
  ELSE
    INSERT INTO test_results VALUES ('TEST-15', 'Horizontal Privilege Escalation', 'public.addresses (other user)', '0 rows visible', v_cnt || ' addresses leaked across users!', 'FAIL');
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_results VALUES ('TEST-15', 'Horizontal Privilege Escalation', 'public.addresses (other user)', '0 rows visible', 'Blocked: ' || SQLERRM, 'PASS');
END $$;

-- ============================================================================
-- OUTPUT PENETRATION TEST SCORECARD
-- ============================================================================
RESET ROLE;

SELECT 
  test_id,
  attack_vector,
  target,
  status,
  actual AS details
FROM test_results
ORDER BY test_id;

-- Automatically rolls back all test modifications to leave the database pristine
ROLLBACK;

