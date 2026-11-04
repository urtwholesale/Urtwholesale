-- ============================================================================
-- Migration 034: Sync and Display Real Customer Names on Reviews
-- ============================================================================

-- 1. Backfill existing reviews with real customer names from public.profiles
UPDATE public.reviews r
SET user_name = COALESCE(NULLIF(trim(p.full_name), ''), NULLIF(trim(p.business_name), ''), r.user_name)
FROM public.profiles p
WHERE r.user_id = p.id
  AND (r.user_name IS NULL OR r.user_name = 'Verified Wholesale Buyer' OR trim(r.user_name) = '');

-- 2. Trigger function to auto-populate user_name from public.profiles on review insert/update
CREATE OR REPLACE FUNCTION public.sync_review_author_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_biz text;
BEGIN
  IF NEW.user_name IS NULL OR NEW.user_name = 'Verified Wholesale Buyer' OR trim(NEW.user_name) = '' THEN
    SELECT NULLIF(trim(full_name), ''), NULLIF(trim(business_name), '')
    INTO v_name, v_biz
    FROM public.profiles
    WHERE id = NEW.user_id;

    NEW.user_name := COALESCE(v_name, v_biz, 'Verified Wholesale Buyer');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_review_author ON public.reviews;
CREATE TRIGGER trg_sync_review_author
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.sync_review_author_name();

-- 3. Trigger function to propagate profile name updates to user's reviews
CREATE OR REPLACE FUNCTION public.propagate_profile_name_to_reviews()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.full_name IS DISTINCT FROM OLD.full_name) OR (NEW.business_name IS DISTINCT FROM OLD.business_name) THEN
    UPDATE public.reviews
    SET user_name = COALESCE(NULLIF(trim(NEW.full_name), ''), NULLIF(trim(NEW.business_name), ''), user_name)
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_profile_name_to_reviews ON public.profiles;
CREATE TRIGGER trg_propagate_profile_name_to_reviews
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.propagate_profile_name_to_reviews();

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

