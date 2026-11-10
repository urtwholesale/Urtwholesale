-- Migration 041: Embed returns array in get_order_by_id RPC
-- Ensures Order objects reliably include return requests and items across both owner and guest token lookups

CREATE OR REPLACE FUNCTION public.get_order_by_id(
  p_order_id text,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_order record;
  v_events jsonb;
  v_returns jsonb;
  v_is_admin boolean := public.is_admin();
  v_caller_uid uuid := auth.uid();
  v_is_owner boolean := false;
  v_clean_token text := trim(COALESCE(p_token, ''));
BEGIN
  IF p_order_id IS NULL OR trim(p_order_id) = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = trim(p_order_id);

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_caller_uid IS NOT NULL AND v_order.user_id = v_caller_uid THEN
    v_is_owner := true;
  END IF;

  -- Non-owners and non-admins must supply a valid matching token
  IF NOT v_is_admin AND NOT v_is_owner THEN
    IF v_clean_token = '' OR v_order.public_token <> v_clean_token THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Events timeline
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'order_id', e.order_id,
        'status', e.status,
        'note', e.note,
        'created_at', e.created_at
      ) ORDER BY e.created_at ASC
    ), '[]'::jsonb
  ) INTO v_events
  FROM public.order_events e
  WHERE e.order_id = v_order.id
    AND (v_is_admin OR e.customer_visible = true);

  -- Return Requests for this order (including line items and events)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', rr.id,
        'return_code', rr.return_code,
        'order_id', rr.order_id,
        'user_id', rr.user_id,
        'type', rr.type,
        'status', rr.status,
        'reason_code', rr.reason_code,
        'reason', COALESCE(rr.reason, rr.reason_code),
        'description', rr.description,
        'evidence_paths', rr.evidence_paths,
        'refund_amount', rr.refund_amount,
        'requested_at', rr.requested_at,
        'items', (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', ri.id,
                'return_id', ri.return_id,
                'product_id', ri.product_id,
                'quantity', ri.quantity,
                'reason_code', ri.reason_code,
                'condition', ri.condition
              )
            ), '[]'::jsonb
          )
          FROM public.return_items ri
          WHERE ri.return_id = rr.id OR ri.return_request_id = rr.id
        ),
        'events', (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', re.id,
                'return_id', re.return_id,
                'status', re.status,
                'note', re.note,
                'created_at', re.created_at
              ) ORDER BY re.created_at ASC
            ), '[]'::jsonb
          )
          FROM public.return_events re
          WHERE re.return_id = rr.id OR re.return_request_id = rr.id
        )
      ) ORDER BY rr.requested_at DESC
    ), '[]'::jsonb
  ) INTO v_returns
  FROM public.return_requests rr
  WHERE rr.order_id = v_order.id;

  -- Owner / Admin View
  IF v_is_admin OR v_is_owner THEN
    RETURN jsonb_build_object(
      'id', v_order.id,
      'user_id', v_order.user_id,
      'customer', v_order.customer,
      'items', v_order.items,
      'subtotal', v_order.subtotal,
      'subtotal_before_discount', v_order.subtotal_before_discount,
      'savings', v_order.savings,
      'shipping', v_order.shipping,
      'total', v_order.total,
      'coupon_code', v_order.coupon_code,
      'discount_amount', COALESCE(v_order.discount_amount, 0),
      'status', v_order.status,
      'source', COALESCE(v_order.source, 'website'),
      'payment_status', COALESCE(v_order.payment_status, 'pending'),
      'courier_name', v_order.courier_name,
      'awb_number', v_order.awb_number,
      'cancel_reason', v_order.cancel_reason,
      'admin_note', CASE WHEN v_is_admin THEN v_order.admin_note ELSE NULL END,
      'whatsapp_message', v_order.whatsapp_message,
      'public_token', v_order.public_token,
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at,
      'events', v_events,
      'returns', v_returns
    );
  END IF;

  -- Minimal Guest View with coupon summary and return summary
  RETURN jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'courier_name', v_order.courier_name,
    'awb_number', v_order.awb_number,
    'cancel_reason', v_order.cancel_reason,
    'coupon_code', v_order.coupon_code,
    'discount_amount', COALESCE(v_order.discount_amount, 0),
    'customer', jsonb_build_object(
      'phone', CASE 
        WHEN length(COALESCE(v_order.customer->>'phone', '')) >= 4 
        THEN '******' || right(v_order.customer->>'phone', 4) 
        ELSE '******' 
      END
    ),
    'items', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'product_id', COALESCE(elem->>'product_id', elem->'product'->>'id'),
            'name', COALESCE(elem->>'name', elem->'product'->>'name', 'Item'),
            'quantity', CASE 
              WHEN (elem->>'quantity') ~ '^\d+$' THEN (elem->>'quantity')::integer 
              ELSE 1 
            END,
            'price', COALESCE((elem->>'price')::numeric, 0),
            'unit_price', COALESCE((elem->>'unit_price')::numeric, 0),
            'sku', elem->>'sku'
          )
        ), '[]'::jsonb
      )
      FROM jsonb_array_elements(v_order.items) AS elem
    ),
    'timeline', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'status', e.status,
            'note', CASE WHEN e.customer_visible THEN e.note ELSE NULL END,
            'created_at', e.created_at
          ) ORDER BY e.created_at ASC
        ), '[]'::jsonb
      )
      FROM public.order_events e
      WHERE e.order_id = v_order.id
    ),
    'returns', v_returns
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_by_id(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_id(text, text) TO anon, authenticated;
