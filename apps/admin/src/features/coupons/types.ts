import type { Coupon } from "@urbanrat/shared";

export type DerivedCouponStatus = "active" | "scheduled" | "expired" | "disabled" | "used_up";

export function getCouponDerivedStatus(coupon: Coupon): DerivedCouponStatus {
  if (!coupon.is_active) {
    return "disabled";
  }

  const now = new Date().getTime();

  if (coupon.usage_limit_total != null && coupon.used_count >= coupon.usage_limit_total) {
    return "used_up";
  }

  if (coupon.expires_at) {
    const expiryTime = new Date(coupon.expires_at).getTime();
    if (!isNaN(expiryTime) && expiryTime < now) {
      return "expired";
    }
  }

  if (coupon.starts_at) {
    const startTime = new Date(coupon.starts_at).getTime();
    if (!isNaN(startTime) && startTime > now) {
      return "scheduled";
    }
  }

  return "active";
}

export const STATUS_CONFIG: Record<
  DerivedCouponStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  active: {
    label: "Active",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  scheduled: {
    label: "Scheduled",
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
  },
  expired: {
    label: "Expired",
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
  used_up: {
    label: "Used Up",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  disabled: {
    label: "Disabled",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-400",
  },
};

