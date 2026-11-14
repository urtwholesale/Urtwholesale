-- ============================================================================
-- Migration: 048_fix_get_order_by_id_return_items_column.sql
-- Description: Align repository migration history with production state of
--              get_order_by_id(text, text). Resolves return items relationship
--              directly via `WHERE ri.return_id = r.id` (removing legacy column hedge).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_order_by_id(p_order_id text, p_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  IF NOT v_is_admin AND NOT v_is_owner THEN
    IF v_clean_token = '' OR v_order.public_token IS NULL OR v_order.public_token <> v_clean_token THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'order_id', e.order_id,
        'status', e.status,
        'note', CASE WHEN (v_is_admin OR v_is_owner OR e.customer_visible) THEN e.note ELSE NULL END,
        'created_at', e.created_at
      ) ORDER BY e.created_at ASC
    ), '[]'::jsonb
  ) INTO v_events
  FROM public.order_events e
  WHERE e.order_id = v_order.id
    AND (v_is_admin OR v_is_owner OR e.customer_visible = true);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'order_id', r.order_id,
        'type', r.type,
        'status', r.status,
        'reason_code', r.reason_code,
        'reason', r.reason,
        'description', r.description,
        'evidence_urls', r.evidence_urls,
        'resolution_notes', r.resolution_notes,
        'created_at', r.created_at,
        'updated_at', r.updated_at,
        'items', (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', ri.id,
                'return_id', ri.return_id,
                'product_id', ri.product_id,
                'sku', ri.sku,
                'name', ri.name,
                'quantity', ri.quantity,
                'unit_price', ri.unit_price,
                'total_price', ri.total_price
              )
            ), '[]'::jsonb
          )
          FROM public.return_items ri
          WHERE ri.return_id = r.id
        )
      ) ORDER BY r.created_at DESC
    ), '[]'::jsonb
  ) INTO v_returns
  FROM public.return_requests r
  WHERE r.order_id = v_order.id;

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
      'is_party_bad_debt', COALESCE(v_order.is_party_bad_debt, false),
      'party_bad_debt_reason', v_order.party_bad_debt_reason,
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at,
      'events', v_events,
      'returns', v_returns
    );
  END IF;

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
    'timeline', v_events,
    'returns', v_returns
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_order_by_id(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_id(text, text) TO anon, authenticated, service_role;
