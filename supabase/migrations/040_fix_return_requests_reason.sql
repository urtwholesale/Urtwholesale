-- Migration 040: Fix return_requests reason column and harden create_return_request RPC
-- Resolves: column "reason" of relation "return_requests" does not exist

-- 1. Ensure `reason` column exists on public.return_requests alongside `reason_code`
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS reason text;

-- Sync existing reason_code values into reason
UPDATE public.return_requests
SET reason = reason_code
WHERE reason IS NULL;

-- 2. Add trigger to keep reason and reason_code always synchronized
CREATE OR REPLACE FUNCTION public.sync_return_request_reason()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reason_code IS NULL AND NEW.reason IS NOT NULL THEN
    NEW.reason_code := NEW.reason;
  ELSIF NEW.reason IS NULL AND NEW.reason_code IS NOT NULL THEN
    NEW.reason := NEW.reason_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_return_request_reason ON public.return_requests;
CREATE TRIGGER trigger_sync_return_request_reason
  BEFORE INSERT OR UPDATE ON public.return_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_return_request_reason();

-- 3. Resilient column compatibility on return_items and return_events
ALTER TABLE public.return_items
  ADD COLUMN IF NOT EXISTS return_request_id uuid,
  ADD COLUMN IF NOT EXISTS qc_passed boolean DEFAULT NULL;

UPDATE public.return_items
SET return_request_id = return_id
WHERE return_request_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_return_item_return_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.return_id IS NULL AND NEW.return_request_id IS NOT NULL THEN
    NEW.return_id := NEW.return_request_id;
  ELSIF NEW.return_request_id IS NULL AND NEW.return_id IS NOT NULL THEN
    NEW.return_request_id := NEW.return_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_return_item_return_id ON public.return_items;
CREATE TRIGGER trigger_sync_return_item_return_id
  BEFORE INSERT OR UPDATE ON public.return_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_return_item_return_id();

ALTER TABLE public.return_events
  ADD COLUMN IF NOT EXISTS return_request_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.return_events
SET return_request_id = return_id
WHERE return_request_id IS NULL;

UPDATE public.return_events
SET created_by = actor_id
WHERE created_by IS NULL;

CREATE OR REPLACE FUNCTION public.sync_return_event_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.return_id IS NULL AND NEW.return_request_id IS NOT NULL THEN
    NEW.return_id := NEW.return_request_id;
  ELSIF NEW.return_request_id IS NULL AND NEW.return_id IS NOT NULL THEN
    NEW.return_request_id := NEW.return_id;
  END IF;
  IF NEW.actor_id IS NULL AND NEW.created_by IS NOT NULL THEN
    NEW.actor_id := NEW.created_by;
  ELSIF NEW.created_by IS NULL AND NEW.actor_id IS NOT NULL THEN
    NEW.created_by := NEW.actor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_return_event_columns ON public.return_events;
CREATE TRIGGER trigger_sync_return_event_columns
  BEFORE INSERT OR UPDATE ON public.return_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_return_event_columns();

-- 4. Recreate create_return_request RPC with correct column names, validations, and return shape
CREATE OR REPLACE FUNCTION public.create_return_request(
  p_order_id text,
  p_items jsonb,
  p_type text,
  p_reason text,
  p_description text DEFAULT NULL,
  p_evidence_paths text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_order record;
  v_delivered_at timestamptz;
  v_window_days integer := 7;
  v_return_code text;
  v_return_id uuid;
  v_date_prefix text;
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_rand text;
  v_attempt integer;
  v_req_item record;
  v_delivered_qty integer;
  v_already_returned_qty integer;
  v_available_qty integer;
  v_prod_name text;
  v_inserted_items jsonb := '[]'::jsonb;
  v_ev_path text;
  v_expected_prefix text;
BEGIN
  -- 1. Authentication check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a return request';
  END IF;

  -- 2. Validate Order existence and ownership
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = trim(p_order_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order "%" not found', p_order_id;
  END IF;

  IF v_order.user_id IS NULL OR v_order.user_id <> v_user_id THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'forbidden: You can only create return requests for your own registered orders';
    END IF;
  END IF;

  -- 3. Validate Return Window: Must be delivered
  IF v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'Returns are only accepted for delivered orders. Current order status is "%"', v_order.status;
  END IF;

  SELECT coalesce((value#>>'{}')::integer, 7) INTO v_window_days
  FROM public.store_settings
  WHERE key = 'return_window_days';

  IF v_window_days IS NULL OR v_window_days <= 0 THEN
    v_window_days := 7;
  END IF;

  SELECT created_at INTO v_delivered_at
  FROM public.order_events
  WHERE order_id = v_order.id AND status = 'delivered'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_delivered_at IS NULL THEN
    v_delivered_at := coalesce(v_order.updated_at, v_order.created_at);
  END IF;

  IF NOW() > (v_delivered_at + (v_window_days || ' days')::interval) THEN
    RAISE EXCEPTION 'Return window expired. Orders can only be returned within % days of delivery', v_window_days;
  END IF;

  -- 4. Validate Return Type
  IF p_type NOT IN ('return', 'replacement', 'refund') THEN
    RAISE EXCEPTION 'Invalid return type "%". Must be "return", "replacement", or "refund"', p_type;
  END IF;

  -- 5. Validate Reason
  IF p_reason NOT IN ('damaged', 'defective', 'wrong_item', 'short_quantity', 'quality_issue', 'other') THEN
    RAISE EXCEPTION 'Invalid reason code: %. Allowed: damaged, defective, wrong_item, short_quantity, quality_issue, other', p_reason;
  END IF;

  -- 6. Validate Evidence Paths: Must reside in user folder if provided
  v_expected_prefix := v_user_id::text || '/';
  IF p_evidence_paths IS NOT NULL AND array_length(p_evidence_paths, 1) IS NOT NULL THEN
    FOREACH v_ev_path IN ARRAY p_evidence_paths LOOP
      v_ev_path := trim(coalesce(v_ev_path, ''));
      IF NOT (v_ev_path LIKE (v_expected_prefix || '%')) THEN
        RAISE EXCEPTION 'Invalid evidence file path: %. All uploaded evidence must be inside your user folder "%"', v_ev_path, v_expected_prefix;
      END IF;
    END LOOP;
  END IF;

  -- 7. Validate Items payload
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item must be specified for return';
  END IF;

  -- 8. Generate Unique Return Code: RET-YYMMDD-XXXX
  v_date_prefix := 'RET-' || to_char(NOW(), 'YYMMDD') || '-';
  v_attempt := 0;

  LOOP
    v_attempt := v_attempt + 1;
    v_rand := '';
    FOR i IN 1..4 LOOP
      v_rand := v_rand || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;
    v_return_code := v_date_prefix || v_rand;

    IF NOT EXISTS (SELECT 1 FROM public.return_requests WHERE return_code = v_return_code) THEN
      EXIT;
    END IF;

    IF v_attempt > 10 THEN
      v_return_code := v_date_prefix || upper(substr(gen_random_uuid()::text, 1, 6));
      EXIT;
    END IF;
  END LOOP;

  -- 9. Create Return Request Header (populates both reason_code and reason)
  INSERT INTO public.return_requests (
    return_code,
    order_id,
    user_id,
    type,
    status,
    reason_code,
    reason,
    description,
    evidence_paths,
    requested_at
  )
  VALUES (
    v_return_code,
    v_order.id,
    v_user_id,
    p_type,
    'requested',
    p_reason,
    p_reason,
    p_description,
    coalesce(p_evidence_paths, '{}'::text[]),
    NOW()
  )
  RETURNING id INTO v_return_id;

  -- 10. Validate & Insert Line Items
  FOR v_req_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      sum(coalesce((elem->>'quantity')::integer, 0)) AS quantity,
      max(elem->>'order_item_id') AS order_item_id,
      max(coalesce(elem->>'reason_code', p_reason)) AS reason_code,
      max(coalesce(elem->>'condition', 'unopened')) AS condition
    FROM jsonb_array_elements(p_items) AS elem
    GROUP BY (elem->>'product_id')::uuid
  LOOP
    IF v_req_item.product_id IS NULL OR v_req_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Each return item must have a valid product_id and positive quantity';
    END IF;

    -- Verify product in catalog
    SELECT name INTO v_prod_name
    FROM public.products
    WHERE id = v_req_item.product_id;

    IF v_prod_name IS NULL THEN
      RAISE EXCEPTION 'Product % not found in catalog', v_req_item.product_id;
    END IF;

    -- Calculate total delivered quantity from orders.items
    SELECT coalesce(sum((item->>'quantity')::integer), 0) INTO v_delivered_qty
    FROM jsonb_array_elements(v_order.items) AS item
    WHERE (item->>'product_id')::uuid = v_req_item.product_id;

    IF v_delivered_qty = 0 THEN
      RAISE EXCEPTION 'Product "%" was not part of delivered order #%', v_prod_name, v_order.id;
    END IF;

    -- Calculate already returned/requested quantity across active return requests (excluding rejected)
    SELECT coalesce(sum(ri.quantity), 0) INTO v_already_returned_qty
    FROM public.return_items ri
    JOIN public.return_requests rr ON (rr.id = ri.return_id OR rr.id = ri.return_request_id)
    WHERE rr.order_id = v_order.id
      AND ri.product_id = v_req_item.product_id
      AND rr.id <> v_return_id
      AND rr.status NOT IN ('rejected', 'cancelled');

    v_available_qty := v_delivered_qty - v_already_returned_qty;

    IF v_req_item.quantity > v_available_qty THEN
      RAISE EXCEPTION 'Requested return quantity (% units) for "%" exceeds available eligible quantity (% units)',
        v_req_item.quantity, v_prod_name, greatest(0, v_available_qty);
    END IF;

    -- Insert into return_items
    INSERT INTO public.return_items (
      return_id,
      return_request_id,
      order_item_id,
      product_id,
      quantity,
      reason_code,
      condition
    )
    VALUES (
      v_return_id,
      v_return_id,
      v_req_item.order_item_id,
      v_req_item.product_id,
      v_req_item.quantity,
      v_req_item.reason_code,
      v_req_item.condition
    );

    v_inserted_items := v_inserted_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_req_item.product_id,
        'product_name', v_prod_name,
        'quantity', v_req_item.quantity,
        'reason_code', v_req_item.reason_code
      )
    );
  END LOOP;

  -- 11. Record Return Event
  INSERT INTO public.return_events (
    return_id,
    return_request_id,
    status,
    note,
    actor_id,
    created_by,
    created_at
  )
  VALUES (
    v_return_id,
    v_return_id,
    'requested',
    coalesce(p_description, 'Return request ' || v_return_code || ' submitted by customer'),
    v_user_id,
    v_user_id,
    NOW()
  );

  -- 12. Also notify order_events audit trail
  INSERT INTO public.order_events (
    order_id,
    status,
    note,
    created_by
  )
  VALUES (
    v_order.id,
    'returned',
    'Customer submitted ' || p_type || ' request ' || v_return_code || ' (Reason: ' || p_reason || ')',
    v_user_id
  );

  -- 13. Return complete ReturnRequest payload
  RETURN jsonb_build_object(
    'id', v_return_id,
    'return_id', v_return_id,
    'return_code', v_return_code,
    'order_id', v_order.id,
    'user_id', v_user_id,
    'type', p_type,
    'status', 'requested',
    'reason_code', p_reason,
    'reason', p_reason,
    'description', p_description,
    'evidence_paths', p_evidence_paths,
    'items', v_inserted_items,
    'requested_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_return_request(text, jsonb, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_return_request(text, jsonb, text, text, text, text[]) TO authenticated;
