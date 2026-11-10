-- Migration 044: Customer Return Request Cancellation
-- Enables customers (and admins) to cancel pending return requests directly from the user end.

-- 1. Extend return_requests status check constraint to include 'cancelled'
DO $$
BEGIN
  ALTER TABLE public.return_requests DROP CONSTRAINT IF EXISTS return_requests_status_check;
  ALTER TABLE public.return_requests ADD CONSTRAINT return_requests_status_check
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

-- 2. customer_cancel_return_request RPC
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
BEGIN
  v_user_id := auth.uid();
  v_is_admin := public.is_admin();

  IF v_user_id IS NULL AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Authentication required to cancel return request';
  END IF;

  -- 1. Find return request by UUID or return_code
  SELECT * INTO v_return
  FROM public.return_requests
  WHERE id::text = trim(p_return_id) OR return_code = trim(p_return_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return request "%" not found', p_return_id;
  END IF;

  -- 2. Authorization check: Customer can only cancel their own return
  IF NOT v_is_admin AND v_return.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only cancel your own return requests';
  END IF;

  -- 3. State validation: can only cancel before items are physically received/processed
  IF v_return.status IN ('cancelled', 'rejected', 'closed', 'refunded', 'replacement_shipped', 'received', 'in_transit') THEN
    RAISE EXCEPTION 'Return request cannot be cancelled because it is already in "%" state', v_return.status;
  END IF;

  v_clean_reason := coalesce(trim(p_reason), 'Cancelled by customer via Return Portal');

  -- 4. Update return request status
  UPDATE public.return_requests
  SET
    status = 'cancelled',
    resolution_notes = CASE
      WHEN resolution_notes IS NOT NULL THEN resolution_notes || E'\n' || v_clean_reason
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
    'previous_status', v_return.status,
    'status', 'cancelled',
    'cancelled_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_cancel_return_request(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_cancel_return_request(text, text) TO authenticated;

-- 3. Update admin_update_return_status to also support 'cancelled'
CREATE OR REPLACE FUNCTION public.admin_update_return_status(
  p_return_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL,
  p_refund_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_return record;
  v_ret_item record;
  v_items_restocked integer := 0;
  v_is_valid_transition boolean := false;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_return
  FROM public.return_requests
  WHERE id = p_return_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return request not found';
  END IF;

  IF v_return.status = p_new_status THEN
    v_is_valid_transition := true;
  ELSIF v_return.status = 'requested' AND p_new_status IN ('approved', 'rejected', 'closed', 'cancelled') THEN
    v_is_valid_transition := true;
  ELSIF v_return.status = 'approved' AND p_new_status IN ('pickup_scheduled', 'in_transit', 'received', 'rejected', 'closed', 'cancelled') THEN
    v_is_valid_transition := true;
  ELSIF v_return.status = 'pickup_scheduled' AND p_new_status IN ('in_transit', 'received', 'closed', 'cancelled') THEN
    v_is_valid_transition := true;
  ELSIF v_return.status = 'in_transit' AND p_new_status IN ('received', 'closed') THEN
    v_is_valid_transition := true;
  ELSIF v_return.status = 'received' AND p_new_status IN ('qc_passed', 'qc_failed', 'closed') THEN
    v_is_valid_transition := true;
  ELSIF v_return.status = 'qc_passed' AND p_new_status IN ('refunded', 'replacement_shipped', 'closed') THEN
    v_is_valid_transition := true;
  ELSIF v_return.status = 'qc_failed' AND p_new_status IN ('rejected', 'closed') THEN
    v_is_valid_transition := true;
  ELSIF v_return.status IN ('refunded', 'replacement_shipped', 'rejected', 'cancelled') AND p_new_status = 'closed' THEN
    v_is_valid_transition := true;
  ELSIF v_return.status = 'closed' AND p_new_status IN ('requested', 'approved') THEN
    v_is_valid_transition := true;
  END IF;

  IF NOT v_is_valid_transition THEN
    RAISE EXCEPTION 'Invalid status transition from "%" to "%"', v_return.status, p_new_status;
  END IF;

  -- Restock inventory if qc_passed and return
  IF p_new_status = 'qc_passed' AND v_return.type = 'return' AND v_return.status != 'qc_passed' THEN
    FOR v_ret_item IN
      SELECT product_id, quantity
      FROM public.return_items
      WHERE return_id = p_return_id
    LOOP
      PERFORM public.admin_adjust_stock(
        v_ret_item.product_id,
        v_ret_item.quantity,
        'Restock from return ' || v_return.return_code || ' (QC Passed)'
      );
      v_items_restocked := v_items_restocked + 1;
    END LOOP;
  END IF;

  UPDATE public.return_requests
  SET
    status = p_new_status,
    admin_note = coalesce(p_note, admin_note),
    refund_amount = CASE
      WHEN p_refund_amount IS NOT NULL AND p_refund_amount >= 0 THEN p_refund_amount
      ELSE refund_amount
    END,
    resolved_at = CASE
      WHEN p_new_status IN ('refunded', 'replacement_shipped', 'closed', 'rejected', 'cancelled') THEN coalesce(resolved_at, now())
      ELSE resolved_at
    END,
    updated_at = now()
  WHERE id = p_return_id;

  INSERT INTO public.return_events (
    return_id,
    status,
    note,
    actor_id
  )
  VALUES (
    p_return_id,
    p_new_status,
    p_note,
    auth.uid()
  );

  RETURN jsonb_build_object(
    'return_id', p_return_id,
    'previous_status', v_return.status,
    'new_status', p_new_status,
    'items_restocked', v_items_restocked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_return_status(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_return_status(uuid, text, text, numeric) TO authenticated;
