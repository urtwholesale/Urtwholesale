export type ReturnType = "return" | "replacement" | "refund";

export type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "pickup_scheduled"
  | "in_transit"
  | "received"
  | "qc_passed"
  | "qc_failed"
  | "refunded"
  | "replacement_shipped"
  | "closed";

export type ReturnReasonCode =
  | "damaged"
  | "defective"
  | "wrong_item"
  | "short_quantity"
  | "quality_issue"
  | "other";

export type ClaimStatus = "none" | "pending" | "approved" | "rejected" | "settled";

export type ClaimType =
  | "courier"
  | "supplier"
  | "transit_damage"
  | "customer_fraud"
  | "other";

export interface ReturnItem {
  id: string;
  return_id: string;
  order_item_id?: string | null;
  product_id: string;
  quantity: number;
  reason_code: ReturnReasonCode;
  condition?: string;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
    images?: string[];
    price?: number;
  };
  created_at: string;
}

export interface ReturnEvent {
  id: string;
  return_id: string;
  status: ReturnStatus;
  note?: string | null;
  actor_id?: string | null;
  created_at: string;
}

export interface ReturnRequest {
  id: string;
  return_code: string;
  order_id: string;
  user_id: string;
  type: ReturnType;
  status: ReturnStatus;
  reason_code: ReturnReasonCode;
  description?: string | null;
  evidence_paths: string[];
  requested_at: string;
  resolved_at?: string | null;
  refund_amount: number;
  admin_note?: string | null;
  // Claim fields
  claim_status?: ClaimStatus;
  claim_type?: ClaimType | null;
  claim_amount?: number;
  claim_reference?: string | null;
  claim_notes?: string | null;
  claim_filed_at?: string | null;
  claim_settled_at?: string | null;
  // Joined relations
  items?: ReturnItem[];
  events?: ReturnEvent[];
  customer?: {
    name?: string;
    phone?: string;
    business_name?: string;
    email?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateReturnItemInput {
  product_id: string;
  quantity: number;
  order_item_id?: string | null;
  reason_code?: ReturnReasonCode;
  condition?: string;
}

export interface CreateReturnRequestInput {
  order_id: string;
  items: CreateReturnItemInput[];
  type: ReturnType;
  reason: ReturnReasonCode;
  description?: string;
  evidence_paths?: string[];
}

export interface AdminUpdateReturnStatusInput {
  return_id: string;
  new_status: ReturnStatus;
  note?: string;
  refund_amount?: number;
}

export interface AdminUpdateReturnClaimInput {
  return_id: string;
  claim_status: ClaimStatus;
  claim_amount?: number;
  claim_type?: ClaimType;
  claim_reference?: string;
  claim_notes?: string;
}

export interface ProductReturnPerformance {
  product_id: string;
  product_name: string;
  sku: string;
  image: string | null;
  category_id: string | null;
  category_name: string | null;
  orders_delivered: number;
  quantity_delivered: number;
  returns_count: number;
  quantity_returned: number;
  return_rate_percentage: number;
  is_high_return: boolean;
}

export interface ReturnStats {
  period_days: number;
  start_date: string;
  end_date: string;
  total_returns: number;
  total_delivered_orders: number;
  return_rate_percentage: number;
  total_refunds_value: number;
  pending_actions_count?: number;
  qc_failed_count?: number;
  claims_count?: number;
  claims_value?: number;
  by_status: Partial<Record<ReturnStatus, number>>;
  reason_breakdown: {
    reason_code: ReturnReasonCode;
    count: number;
    percentage: number;
  }[];
  top_returned_products: {
    product_id: string;
    product_name: string;
    sku?: string | null;
    total_quantity: number;
    return_count: number;
  }[];
}

export const RETURN_TYPES: readonly ReturnType[] = [
  "return",
  "replacement",
  "refund",
] as const;

export const RETURN_STATUSES: readonly ReturnStatus[] = [
  "requested",
  "approved",
  "rejected",
  "pickup_scheduled",
  "in_transit",
  "received",
  "qc_passed",
  "qc_failed",
  "refunded",
  "replacement_shipped",
  "closed",
] as const;

export const RETURN_REASON_CODES: readonly ReturnReasonCode[] = [
  "damaged",
  "defective",
  "wrong_item",
  "short_quantity",
  "quality_issue",
  "other",
] as const;

export const RETURN_REASON_LABELS: Record<ReturnReasonCode, string> = {
  damaged: "Damaged in transit (Broken seal / packaging)",
  defective: "Defective / Dead on Arrival (DOA)",
  wrong_item: "Wrong item / SKU received",
  short_quantity: "Short quantity / Missing units",
  quality_issue: "Quality / Performance defect",
  other: "Other wholesale issue",
};

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "Return Requested",
  approved: "Return Approved",
  rejected: "Return Rejected",
  pickup_scheduled: "Pickup Scheduled",
  in_transit: "In Transit to Warehouse",
  received: "Received at Warehouse",
  qc_passed: "QC Passed & Verified",
  qc_failed: "QC Failed",
  refunded: "Refund Processed",
  replacement_shipped: "Replacement Shipped",
  closed: "Closed",
};

export function isValidReturnType(val: unknown): val is ReturnType {
  return typeof val === "string" && RETURN_TYPES.includes(val as ReturnType);
}

export function isValidReturnStatus(val: unknown): val is ReturnStatus {
  return typeof val === "string" && RETURN_STATUSES.includes(val as ReturnStatus);
}

export function isValidReturnReasonCode(val: unknown): val is ReturnReasonCode {
  return typeof val === "string" && RETURN_REASON_CODES.includes(val as ReturnReasonCode);
}

export const CLAIM_STATUSES: readonly ClaimStatus[] = [
  "none",
  "pending",
  "approved",
  "rejected",
  "settled",
] as const;

export const CLAIM_TYPES: readonly ClaimType[] = [
  "courier",
  "supplier",
  "transit_damage",
  "customer_fraud",
  "other",
] as const;

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  none: "No Claim",
  pending: "Claim Under Review",
  approved: "Claim Approved",
  rejected: "Claim Rejected",
  settled: "Claim Settled / Reimbursed",
};

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  courier: "Courier Transit Loss / Damage",
  supplier: "Supplier Warranty / Factory Defect",
  transit_damage: "Severe Transit Impact",
  customer_fraud: "Disputed / Wrong Return",
  other: "Other Reimbursement",
};

export function isValidClaimStatus(val: unknown): val is ClaimStatus {
  return typeof val === "string" && CLAIM_STATUSES.includes(val as ClaimStatus);
}

export function isValidClaimType(val: unknown): val is ClaimType {
  return typeof val === "string" && CLAIM_TYPES.includes(val as ClaimType);
}
