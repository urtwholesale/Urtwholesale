-- Migration: 027_admin_mfa_enforcement.sql
-- Description: Admin Multi-Factor Authentication (MFA) Safe Enforcement & Enrollment Audit
-- Applied: MANUAL RUN ONLY — DO NOT EXECUTE AUTOMATICALLY
--
-- PURPOSE:
-- 1. Provides public.admin_get_mfa_enrollment_status() SECURITY DEFINER RPC to allow
--    administrators to inspect cross-account TOTP enrollment status prior to enforcement.
-- 2. Hardens public.is_admin() to robustly check jsonb boolean and string variations of
--    the 'enforce_admin_mfa' store setting, strictly requiring (auth.jwt()->>'aal') = 'aal2'
--    when enabled.
-- 3. Documents the exact reversible one-line SQL commands to enable and roll back
--    system-wide MFA enforcement.

-- ============================================================================
-- 1. ADMIN MFA ENROLLMENT AUDIT RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_mfa_enrollment_status()
RETURNS TABLE (
  admin_id uuid,
  full_name text,
  email text,
  has_mfa boolean,
  factor_count integer,
  enforce_admin_mfa boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_enforced boolean := false;
  v_setting_val jsonb;
BEGIN
  -- Strict administrator authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.'
      USING ERRCODE = '42501';
  END IF;

  -- Determine current enforcement status from store_settings
  SELECT value INTO v_setting_val
  FROM public.store_settings
  WHERE key = 'enforce_admin_mfa';

  IF v_setting_val IS NOT NULL THEN
    v_enforced := (v_setting_val = 'true'::jsonb OR v_setting_val = '"true"'::jsonb OR v_setting_val#>>'{}' = 'true');
  END IF;

  RETURN QUERY
  SELECT
    p.id AS admin_id,
    COALESCE(p.full_name, 'Admin User') AS full_name,
    COALESCE(u.email::text, '') AS email,
    COALESCE(COUNT(f.id) FILTER (WHERE f.status = 'verified'), 0) > 0 AS has_mfa,
    COALESCE(COUNT(f.id) FILTER (WHERE f.status = 'verified'), 0)::integer AS factor_count,
    v_enforced AS enforce_admin_mfa
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN auth.mfa_factors f ON f.user_id = p.id AND f.factor_type = 'totp'
  WHERE p.role = 'admin'
  GROUP BY p.id, p.full_name, u.email
  ORDER BY p.full_name ASC;
END;
$$;

COMMENT ON FUNCTION public.admin_get_mfa_enrollment_status() IS
  'Administrative audit RPC returning verified TOTP factor enrollment status for all administrator accounts. Strictly requires is_admin().';

REVOKE ALL ON FUNCTION public.admin_get_mfa_enrollment_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_mfa_enrollment_status() TO authenticated;

-- ============================================================================
-- 2. HARDENED public.is_admin() WITH ROBUST JSONB HANDLING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND (
        -- Safe rollout: require aal2 only once enforce_admin_mfa setting is enabled
        NOT COALESCE(
          (
            SELECT (value = 'true'::jsonb OR value = '"true"'::jsonb OR value#>>'{}' = 'true')
            FROM public.store_settings
            WHERE key = 'enforce_admin_mfa'
          ),
          false
        )
        OR (auth.jwt()->>'aal') = 'aal2'
      )
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Authoritative admin gatekeeper. When enforce_admin_mfa store setting is true, requires both role = admin and JWT aal2 claim.';

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================================
-- 3. ENSURE DEFAULT STORE SETTING ROW (SAFE ROLLOUT: FALSE)
-- ============================================================================

INSERT INTO public.store_settings (key, value, description)
VALUES (
  'enforce_admin_mfa',
  'false'::jsonb,
  'When true, public.is_admin() requires auth.jwt()->>''aal'' = ''aal2''. Keep false until all admins enroll TOTP.'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 4. ACTIVATION & EMERGENCY ROLLBACK STATEMENTS (MANUAL EXECUTION ONLY)
-- ============================================================================
-- WARNING: DO NOT RUN THE ACTIVATION STATEMENT UNTIL ALL ADMINS ARE VERIFIED!
-- Verify enrollment status first via:
--   SELECT * FROM public.admin_get_mfa_enrollment_status();
--
-- ----------------------------------------------------------------------------
-- TO ACTIVATE MFA ENFORCEMENT (Flipping to Strict Mode):
-- ----------------------------------------------------------------------------
-- UPDATE public.store_settings
-- SET value = 'true'::jsonb, updated_at = now()
-- WHERE key = 'enforce_admin_mfa';
--
-- ----------------------------------------------------------------------------
-- TO ROLL BACK MFA ENFORCEMENT (Emergency Reversal to Safe Rollout Mode):
-- ----------------------------------------------------------------------------
-- UPDATE public.store_settings
-- SET value = 'false'::jsonb, updated_at = now()
-- WHERE key = 'enforce_admin_mfa';
-- ============================================================================

