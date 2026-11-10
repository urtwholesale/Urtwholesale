-- Migration 045: Fix Return Request resolution_notes and return_events status
-- Adds resolution_notes column to return_requests and extends return_events status check for 'cancelled'

-- 1. Ensure resolution_notes column exists on return_requests
ALTER TABLE public.return_requests ADD COLUMN IF NOT EXISTS resolution_notes text;

-- 2. Ensure return_events status check constraint includes 'cancelled'
DO $$
BEGIN
  ALTER TABLE public.return_events DROP CONSTRAINT IF EXISTS return_events_status_check;
  ALTER TABLE public.return_events ADD CONSTRAINT return_events_status_check
    CHECK (status IN (
      'requested',
      'approved',
      'rejected',
      'pickup_scheduled',
      'in_transit',
      'received',
      'qc_passed',
      'qc_failed',
      'refunded',
      'replacement_shipped',
      'closed',
      'cancelled'
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- 3. Update customer_cancel_return_request RPC with complete resilience
CREATE OR REPLACE FUNCTION public.customer_cancel_return_request(
  p_return_id text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_return record;
  v_user_id uuid;
  v_is_admin boolean;
  v_clean_reason text;
  v_target_id uuid;
BEGIN
  -- 1. Authorization check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_is_admin := public.is_admin();

  -- Find return request by either uuid or return_code
  IF p_return_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_target_id := p_return_id::uuid;
    SELECT * INTO v_return
    FROM public.return_requests
    WHERE id = v_target_id;
  ELSE
    SELECT * INTO v_return
    FROM public.return_requests
    WHERE upper(trim(return_code)) = upper(trim(p_return_id));
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return request not found: %', p_return_id;
  END IF;

  -- 2. Ownership check: user can only cancel their own return unless admin
  IF NOT v_is_admin AND v_return.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only cancel your own return requests';
  END IF;

  -- 3. State validation: can only cancel before items are physically received/processed
  IF v_return.status IN ('cancelled', 'rejected', 'closed', 'refunded', 'replacement_shipped', 'received', 'in_transit') THEN
    RAISE EXCEPTION 'Return request cannot be cancelled because it is already in "%" state', v_return.status;
  END IF;

  v_clean_reason := coalesce(trim(p_reason), 'Cancelled by customer via Return Portal');

  -- 4. Update return request status & resolution notes
  UPDATE public.return_requests
  SET
    status = 'cancelled',
    resolution_notes = CASE
      WHEN resolution_notes IS NOT NULL AND resolution_notes <> '' THEN resolution_notes || E'\n' || v_clean_reason
      ELSE v_clean_reason
    END,
    admin_note = CASE
      WHEN admin_note IS NOT NULL AND admin_note <> '' THEN admin_note || E'\n' || v_clean_reason
      ELSE v_clean_reason
    END,
    resolved_at = now(),
    updated_at = now()
  WHERE id = v_return.id;

  -- 5. Insert timeline event into return_events
  INSERT INTO public.return_events (
    return_id,
    status,
    note,
    actor_id
  )
  VALUES (
    v_return.id,
    'cancelled',
    v_clean_reason,
    v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'return_id', v_return.id,
    'return_code', v_return.return_code,
    'status', 'cancelled',
    'reason', v_clean_reason,
    'cancelled_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_cancel_return_request(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_cancel_return_request(text, text) TO authenticated;
