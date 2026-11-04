import { useState, useEffect } from "react";
import {
  X,
  TrendingUp,
  Tag,
  Receipt,
  Clock,
  ExternalLink,
  Loader2,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";
import type { Coupon } from "@urbanrat/shared";
import {
  getCouponStats,
  listCouponRedemptions,
  type AdminCouponStats,
  type AdminCouponRedemptionItem,
} from "../../lib/adminService";
import { triggerHaptic } from "../../utils/haptics";
import { getCouponDerivedStatus, STATUS_CONFIG } from "./types";

interface CouponDetailDrawerProps {
  coupon: Coupon;
  onClose: () => void;
  onSelectOrder?: (orderId: string) => void;
}

export function CouponDetailDrawer({
  coupon,
  onClose,
  onSelectOrder,
}: CouponDetailDrawerProps) {
  const [stats, setStats] = useState<AdminCouponStats | null>(null);
  const [redemptions, setRedemptions] = useState<AdminCouponRedemptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const derivedStatus = getCouponDerivedStatus(coupon);
  const statusCfg = STATUS_CONFIG[derivedStatus];

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [statsData, redemptionsData] = await Promise.all([
          getCouponStats(coupon.id),
          listCouponRedemptions(coupon.id, 50, 0),
        ]);
        if (isMounted) {
          setStats(statsData);
          setRedemptions(redemptionsData.redemptions || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Failed to load coupon statistics.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [coupon.id]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-[#ECEEED] h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-drawer-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary-soft text-primary border border-primary-border flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h2
                  id="coupon-drawer-title"
                  className="font-mono font-black text-base sm:text-lg text-slate-900 truncate"
                >
                  {coupon.code}
                </h2>
                <span
                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                  <span>{statusCfg.label}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                {coupon.description || "Promotional Coupon Campaign"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onClose();
            }}
            aria-label="Close drawer"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-semibold text-slate-500">
                Loading Campaign Performance &amp; Redemptions...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Campaign KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {/* Total Redemptions */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-500 mb-1">
                    <Receipt className="w-3.5 h-3.5 text-primary" />
                    <span>Redemptions</span>
                  </div>
                  <p className="text-lg font-black text-slate-900">
                    {stats?.total_redemptions ?? coupon.used_count}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Limit: {coupon.usage_limit_total ? coupon.usage_limit_total : "Unlimited"}
                  </p>
                </div>

                {/* Total Discount Given */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-emerald-700 mb-1">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Discounts</span>
                  </div>
                  <p className="text-lg font-black text-emerald-700">
                    ₹{Number(stats?.total_discount_given ?? 0).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Given to buyers</p>
                </div>

                {/* Revenue Influenced */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-500 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Revenue</span>
                  </div>
                  <p className="text-lg font-black text-slate-900">
                    ₹{Number(stats?.revenue_influenced ?? 0).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Order gross</p>
                </div>

                {/* Last Used */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-500 mb-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Last Used</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {stats?.last_used
                      ? new Date(stats.last_used).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : "Never"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {stats?.last_used
                      ? new Date(stats.last_used).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "No usage yet"}
                  </p>
                </div>
              </div>

              {/* Coupon Terms & Rules Summary Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Rules &amp; Eligibility
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Discount Structure:</span>
                    <span className="font-bold text-slate-900">
                      {coupon.discount_type === "percent"
                        ? `${coupon.discount_value}% OFF${
                            coupon.max_discount_amount
                              ? ` (Max ₹${coupon.max_discount_amount})`
                              : ""
                          }`
                        : `Flat ₹${coupon.discount_value} OFF`}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Minimum Order:</span>
                    <span className="font-bold text-slate-900">
                      {coupon.min_order_value > 0
                        ? `₹${coupon.min_order_value.toLocaleString("en-IN")}`
                        : "No minimum"}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Per Customer Limit:</span>
                    <span className="font-bold text-slate-900">
                      {coupon.usage_limit_per_customer} time(s)
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Customer Target:</span>
                    <span className="font-bold text-slate-900">
                      {coupon.first_order_only ? "First-order buyers only" : "All buyers"}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 sm:col-span-2">
                    <span className="text-slate-500">Validity Window:</span>
                    <span className="font-medium text-slate-900">
                      {coupon.starts_at || coupon.expires_at ? (
                        <>
                          {coupon.starts_at
                            ? new Date(coupon.starts_at).toLocaleDateString("en-IN")
                            : "Anytime"}{" "}
                          &rarr;{" "}
                          {coupon.expires_at
                            ? new Date(coupon.expires_at).toLocaleDateString("en-IN")
                            : "Indefinite"}
                        </>
                      ) : (
                        "Always valid"
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 sm:col-span-2">
                    <span className="text-slate-500">Category Scope:</span>
                    <span className="font-medium text-slate-900">
                      {coupon.category_ids && coupon.category_ids.length > 0
                        ? `Restricted to ${coupon.category_ids.length} category(ies)`
                        : "Universal (All catalog categories)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Redemption History List */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <ShoppingBag className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Redemption Log ({redemptions.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400">Recent customer uses</span>
                </div>

                {redemptions.length === 0 ? (
                  <div className="py-8 text-center space-y-1">
                    <p className="text-xs font-bold text-slate-600">No redemptions yet</p>
                    <p className="text-[11px] text-slate-400">
                      Once buyers apply this coupon during checkout, verified orders will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {redemptions.map((red) => (
                      <div
                        key={red.id}
                        className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-100 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900">
                              Order #{red.order_code || red.order_id.slice(0, 8)}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                red.status === "applied"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {red.status}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {red.user_name || "Guest Buyer"} &bull;{" "}
                            {new Date(red.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-black text-emerald-700">
                            -₹{Number(red.discount_amount).toLocaleString("en-IN")}
                          </p>
                          {onSelectOrder && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic("selection");
                                onSelectOrder(red.order_id);
                              }}
                              className="text-[11px] font-bold text-primary hover:underline inline-flex items-center space-x-0.5 cursor-pointer"
                            >
                              <span>View Order</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

