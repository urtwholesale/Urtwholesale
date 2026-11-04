import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Plus,
  Ticket,
  Copy,
  Check,
  Edit2,
  BarChart2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Percent,
  IndianRupee,
  Lock,
} from "lucide-react";
import type { Coupon } from "@urbanrat/shared";
import {
  listCoupons,
  toggleCoupon,
  deleteCoupon,
} from "../../lib/adminService";
import { triggerHaptic } from "../../utils/haptics";
import {
  getCouponDerivedStatus,
  STATUS_CONFIG,
  type DerivedCouponStatus,
} from "./types";
import { CouponEditor } from "./CouponEditor";
import { CouponDetailDrawer } from "./CouponDetailDrawer";

type StatusFilter = "all" | DerivedCouponStatus;

const FILTER_PILLS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All Coupons" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "expired", label: "Expired" },
  { key: "disabled", label: "Disabled" },
  { key: "used_up", label: "Used Up" },
];

interface CouponListProps {
  onSelectOrder?: (orderId: string) => void;
}

export function CouponList({ onSelectOrder }: CouponListProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<StatusFilter>("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal / Drawer state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [drawerCoupon, setDrawerCoupon] = useState<Coupon | null>(null);

  // Delete / Disable modal state
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Error / Toast
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCoupons(undefined, "all", 100, 0);
      setCoupons(res.coupons || []);
    } catch (err: any) {
      setErrorToast(err?.message || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleCopy = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("light");
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleToggle = async (c: Coupon, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("selection");
    const newActive = !c.is_active;

    // Optimistic UI update
    setCoupons((prev) =>
      prev.map((item) => (item.id === c.id ? { ...item, is_active: newActive } : item))
    );

    try {
      await toggleCoupon(c.id, newActive);
    } catch (err: any) {
      // Revert on failure
      setCoupons((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, is_active: c.is_active } : item))
      );
      setErrorToast(err?.message || "Failed to toggle coupon status");
    }
  };

  const handleConfirmDelete = async () => {
    if (!couponToDelete) return;
    setDeleting(true);
    try {
      await deleteCoupon(couponToDelete.id);
      triggerHaptic("success");
      setCoupons((prev) => prev.filter((c) => c.id !== couponToDelete.id));
      setCouponToDelete(null);
    } catch (err: any) {
      triggerHaptic("heavy");
      setErrorToast(err?.message || "Failed to delete coupon");
    } finally {
      setDeleting(false);
    }
  };

  const handleDisableInstead = async () => {
    if (!couponToDelete) return;
    setDeleting(true);
    try {
      await toggleCoupon(couponToDelete.id, false);
      triggerHaptic("success");
      setCoupons((prev) =>
        prev.map((c) => (c.id === couponToDelete.id ? { ...c, is_active: false } : c))
      );
      setCouponToDelete(null);
    } catch (err: any) {
      triggerHaptic("heavy");
      setErrorToast(err?.message || "Failed to disable coupon");
    } finally {
      setDeleting(false);
    }
  };

  // Client-side filtering by search query and derived status
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const codeMatch = c.code.toLowerCase().includes(q);
        const descMatch = (c.description || "").toLowerCase().includes(q);
        if (!codeMatch && !descMatch) return false;
      }

      // 2. Status Filter
      if (selectedStatusFilter !== "all") {
        const derived = getCouponDerivedStatus(c);
        if (derived !== selectedStatusFilter) return false;
      }

      return true;
    });
  }, [coupons, searchQuery, selectedStatusFilter]);

  // Status Counts for Badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: coupons.length,
      active: 0,
      scheduled: 0,
      expired: 0,
      disabled: 0,
      used_up: 0,
    };
    for (const c of coupons) {
      const s = getCouponDerivedStatus(c);
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [coupons]);

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
      {/* Toast Alert */}
      {errorToast && (
        <div className="p-3 sm:p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-1">
          <span>{errorToast}</span>
          <button
            type="button"
            onClick={() => setErrorToast(null)}
            className="text-rose-600 hover:underline font-bold ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Page Header & Primary Action ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary border border-primary-border flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
            <h1 className="text-base sm:text-lg font-black text-slate-900">
              Coupons &amp; Offers
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create promotional coupon codes, set checkout order thresholds, and monitor redemptions
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              loadCoupons();
            }}
            title="Refresh coupons"
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setEditingCoupon(null);
              setEditorOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary-active text-on-primary font-bold text-xs shadow-xs transition active:scale-95 flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Coupon</span>
          </button>
        </div>
      </div>

      {/* ── Filter Pills & Search Bar ── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        {/* Status Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {FILTER_PILLS.map((pill) => {
            const isSelected = selectedStatusFilter === pill.key;
            const count = statusCounts[pill.key] ?? 0;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setSelectedStatusFilter(pill.key);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200/70 text-slate-600"
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search coupon code or campaign description..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-ring/30 text-xs transition-all outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Coupon Content (Desktop Table / Mobile Cards) ── */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-semibold text-slate-500">Loading Promotional Coupons...</p>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 shadow-2xs text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">No coupons found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
              {searchQuery || selectedStatusFilter !== "all"
                ? "Try adjusting your search query or status filter pill to find what you need."
                : "No coupon campaigns created yet. Click 'Create Coupon' to launch your first promotional discount."}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table View (Hidden on mobile < md) */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Coupon Code</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Order Condition</th>
                  <th className="py-3 px-4">Redemptions</th>
                  <th className="py-3 px-4">Validity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCoupons.map((c) => {
                  const status = getCouponDerivedStatus(c);
                  const cfg = STATUS_CONFIG[status];
                  const discountSummary =
                    c.discount_type === "percent"
                      ? `${c.discount_value}% off${
                          c.max_discount_amount ? `, max ₹${c.max_discount_amount}` : ""
                        }`
                      : `₹${c.discount_value} off`;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-black text-slate-900 text-xs sm:text-sm tracking-wide">
                            {c.code}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(c.code, e)}
                            title="Copy code"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          >
                            {copiedCode === c.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {c.description && (
                          <p className="text-[11px] text-slate-500 truncate max-w-44 mt-0.5">
                            {c.description}
                          </p>
                        )}
                      </td>

                      {/* Discount */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center space-x-1.5">
                          {c.discount_type === "percent" ? (
                            <Percent className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <IndianRupee className="w-3.5 h-3.5 text-primary" />
                          )}
                          <span>{discountSummary}</span>
                        </div>
                      </td>

                      {/* Order Condition */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <p className="font-medium">
                          {c.min_order_value > 0
                            ? `Min ₹${c.min_order_value.toLocaleString("en-IN")}`
                            : "No min order"}
                        </p>
                        {c.first_order_only && (
                          <span className="text-[10px] font-bold text-indigo-700">
                            First order only
                          </span>
                        )}
                        {c.category_ids && c.category_ids.length > 0 && (
                          <span className="text-[10px] text-slate-400 block">
                            {c.category_ids.length} category restriction
                          </span>
                        )}
                      </td>

                      {/* Usage */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {c.used_count} / {c.usage_limit_total ? c.usage_limit_total : "\u221E"}
                        <span className="text-[10px] text-slate-400 block font-sans font-normal">
                          Max {c.usage_limit_per_customer}/customer
                        </span>
                      </td>

                      {/* Validity */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {c.starts_at || c.expires_at ? (
                          <div>
                            <span>
                              {c.starts_at
                                ? new Date(c.starts_at).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                  })
                                : "Now"}{" "}
                              &ndash;{" "}
                              {c.expires_at
                                ? new Date(c.expires_at).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "2-digit",
                                  })
                                : "No expiry"}
                            </span>
                          </div>
                        ) : (
                          <span className="font-semibold text-slate-600">Always active</span>
                        )}
                      </td>

                      {/* Status & Active Switch */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={(e) => handleToggle(c, e)}
                            role="switch"
                            aria-checked={c.is_active}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              c.is_active ? "bg-emerald-600" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                c.is_active ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full mr-1 ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic("selection");
                              setDrawerCoupon(c);
                            }}
                            title="View campaign performance & redemptions"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary-soft transition cursor-pointer"
                          >
                            <BarChart2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic("selection");
                              setEditingCoupon(c);
                              setEditorOpen(true);
                            }}
                            title="Edit coupon configuration"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic("heavy");
                              setCouponToDelete(c);
                            }}
                            title="Delete or disable coupon"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (< md) */}
          <div className="md:hidden space-y-3">
            {filteredCoupons.map((c) => {
              const status = getCouponDerivedStatus(c);
              const cfg = STATUS_CONFIG[status];
              const discountSummary =
                c.discount_type === "percent"
                  ? `${c.discount_value}% off${
                      c.max_discount_amount ? `, max ₹${c.max_discount_amount}` : ""
                    }`
                  : `₹${c.discount_value} off`;

              return (
                <div
                  key={c.id}
                  className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-black text-sm text-slate-900 tracking-wider">
                        {c.code}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(c.code, e)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {copiedCode === c.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={(e) => handleToggle(c, e)}
                        role="switch"
                        aria-checked={c.is_active}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          c.is_active ? "bg-emerald-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            c.is_active ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1 ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {c.description && (
                    <p className="text-xs text-slate-500">{c.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">
                        Discount
                      </span>
                      <span className="font-black text-slate-900">{discountSummary}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">
                        Condition
                      </span>
                      <span className="font-bold text-slate-800">
                        {c.min_order_value > 0
                          ? `Min ₹${c.min_order_value.toLocaleString("en-IN")}`
                          : "No min"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">
                        Usage
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {c.used_count} / {c.usage_limit_total ? c.usage_limit_total : "\u221E"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">
                        Expires
                      </span>
                      <span className="text-slate-700 font-medium">
                        {c.expires_at
                          ? new Date(c.expires_at).toLocaleDateString("en-IN")
                          : "Never"}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        setDrawerCoupon(c);
                      }}
                      className="text-xs font-bold text-primary hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span>Stats &amp; Logs</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          setEditingCoupon(c);
                          setEditorOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("heavy");
                          setCouponToDelete(c);
                        }}
                        className="px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Coupon Editor Modal / Bottom-Sheet ── */}
      {editorOpen && (
        <CouponEditor
          coupon={editingCoupon}
          onClose={() => {
            setEditorOpen(false);
            setEditingCoupon(null);
          }}
          onSaved={(saved) => {
            setCoupons((prev) => {
              const idx = prev.findIndex((c) => c.id === saved.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
              }
              return [saved, ...prev];
            });
          }}
        />
      )}

      {/* ── Coupon Detail / Stats Drawer ── */}
      {drawerCoupon && (
        <CouponDetailDrawer
          coupon={drawerCoupon}
          onClose={() => setDrawerCoupon(null)}
          onSelectOrder={onSelectOrder}
        />
      )}

      {/* ── Delete / Disable Confirmation Dialog ── */}
      {couponToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200/80 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              {couponToDelete.used_count > 0 ? (
                <Lock className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-slate-900">
                {couponToDelete.used_count > 0
                  ? `Cannot Delete Coupon "${couponToDelete.code}"`
                  : `Delete Coupon "${couponToDelete.code}"?`}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {couponToDelete.used_count > 0
                  ? `This coupon has already been redeemed ${couponToDelete.used_count} time(s). Deleting it would break historical invoice records and order audit logs. You can disable it instead so buyers can no longer use it.`
                  : "Are you sure you want to permanently delete this coupon campaign? This action cannot be undone."}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setCouponToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>

              {couponToDelete.used_count > 0 ? (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDisableInstead}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Disabling...</span>
                    </>
                  ) : (
                    <span>Disable Coupon</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Permanently</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

