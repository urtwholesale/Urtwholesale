import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { listCustomerReturns } from "../services/returnService";
import type { ReturnRequest, ReturnStatus } from "@urbanrat/shared";
import {
  RETURN_STATUS_LABELS,
  RETURN_REASON_LABELS,
} from "@urbanrat/shared";
import { triggerHaptic } from "../utils/haptics";
import {
  RotateCcw,
  Search,
  AlertCircle,
  Copy,
  Check,
  ChevronRight,
  Package,
  Calendar,
  Sparkles,
  Loader2,
  X,
  ShoppingBag,
} from "lucide-react";

type TabFilter = "all" | "active" | "completed" | "rejected";

export function ReturnsPage() {
  const navigate = useNavigate();

  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [tabFilter, setTabFilter] = useState<TabFilter>("all");

  // Copy Feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCustomerReturns();
      setReturns(data);
    } catch (err: unknown) {
      console.error("Failed to load returns:", err);
      const e = err as Error;
      setError(e.message || "Failed to load returns. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  function handleCopy(code: string, e: React.MouseEvent) {
    e.stopPropagation();
    triggerHaptic("selection");
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  // Filtered Returns
  const filteredReturns = useMemo(() => {
    return returns.filter((ret) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const codeMatch = ret.return_code.toLowerCase().includes(q);
        const orderMatch = ret.order_id.toLowerCase().includes(q);
        const itemMatch = ret.items?.some((i) =>
          i.product?.name.toLowerCase().includes(q)
        );
        if (!codeMatch && !orderMatch && !itemMatch) return false;
      }

      // 2. Tab Filter
      if (tabFilter === "active") {
        const activeStatuses: ReturnStatus[] = [
          "requested",
          "approved",
          "pickup_scheduled",
          "in_transit",
          "received",
          "qc_passed",
        ];
        return activeStatuses.includes(ret.status);
      }

      if (tabFilter === "completed") {
        const completedStatuses: ReturnStatus[] = [
          "refunded",
          "replacement_shipped",
          "closed",
        ];
        return completedStatuses.includes(ret.status);
      }

      if (tabFilter === "rejected") {
        const rejectedStatuses: ReturnStatus[] = ["rejected", "qc_failed"];
        return rejectedStatuses.includes(ret.status);
      }

      return true;
    });
  }, [returns, searchQuery, tabFilter]);

  // Status Styling Configuration
  function getStatusMeta(status: ReturnStatus) {
    switch (status) {
      case "requested":
        return {
          dot: "bg-amber-500",
          badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
        };
      case "approved":
        return {
          dot: "bg-blue-500",
          badge: "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60",
        };
      case "pickup_scheduled":
      case "in_transit":
        return {
          dot: "bg-indigo-500",
          badge: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60",
        };
      case "received":
        return {
          dot: "bg-purple-500",
          badge: "bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60",
        };
      case "qc_passed":
      case "refunded":
      case "replacement_shipped":
        return {
          dot: "bg-emerald-500",
          badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
        };
      case "rejected":
      case "qc_failed":
        return {
          dot: "bg-rose-500",
          badge: "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
        };
      case "closed":
      default:
        return {
          dot: "bg-slate-400 dark:bg-slate-500",
          badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
        };
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-6 px-3 sm:px-4 space-y-5 animate-in fade-in duration-300 pb-20">
      {/* ── Breadcrumb Navigation ── */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 overflow-x-auto py-1">
        <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition shrink-0">
          Home
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
        <Link to="/account" className="hover:text-slate-900 dark:hover:text-white transition shrink-0">
          My Account
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
        <span className="font-bold text-slate-900 dark:text-white shrink-0">Returns &amp; Replacements</span>
      </nav>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <RotateCcw className="w-6 h-6 text-brand-dark dark:text-orange-400" />
            <span>Returns &amp; Replacements</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track warranty claims, replacement dispatches, and refund credit statuses
          </p>
        </div>

        <Link
          to="/my-orders"
          onClick={() => triggerHaptic("selection")}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition self-start sm:self-auto shadow-2xs"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>Delivered Orders</span>
        </Link>
      </div>

      {/* ── Search & Filter Tabs ── */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Return Code (e.g. RET-261021-...) or Order ID..."
            className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-brand-dark dark:focus:border-brand transition shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: "all", label: "All Returns" },
            { id: "active", label: "Active" },
            { id: "completed", label: "Completed" },
            { id: "rejected", label: "Rejected" },
          ].map((tab) => {
            const isActive = tabFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setTabFilter(tab.id as TabFilter);
                }}
                style={{
                  background: isActive ? "var(--brand-gradient)" : undefined,
                  boxShadow: isActive ? "var(--brand-shadow)" : undefined,
                }}
                className={`px-3.5 py-1.5 rounded-full font-bold transition cursor-pointer shrink-0 ${
                  isActive
                    ? "text-white scale-102"
                    : "bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-800 shadow-2xs space-y-3">
          <Loader2 className="w-8 h-8 text-brand-dark dark:text-orange-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading return history...</p>
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && error && (
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-8 text-center border border-rose-100 dark:border-rose-900/50 shadow-2xs space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Failed to load returns</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{error}</p>
          <button
            type="button"
            onClick={loadReturns}
            style={{
              background: "var(--brand-gradient)",
              boxShadow: "var(--brand-shadow)",
            }}
            className="px-4 py-2 rounded-xl text-white font-bold text-xs transition cursor-pointer hover:opacity-95"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && filteredReturns.length === 0 && (
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-8 sm:p-12 text-center border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-orange-500/15 text-amber-700 dark:text-orange-400 flex items-center justify-center mx-auto border border-amber-100 dark:border-orange-500/30">
            <RotateCcw className="w-8 h-8 stroke-[1.8]" />
          </div>
          <div className="max-w-sm mx-auto">
            <h3 className="font-black text-base text-slate-900 dark:text-white">
              {searchQuery || tabFilter !== "all"
                ? "No matching return requests"
                : "No returns or replacements requested"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {searchQuery || tabFilter !== "all"
                ? "Try clearing your search query or selecting a different status filter tab."
                : "All delivered wholesale purchases come with a 1-Year Direct Replacement Warranty. You can request a return from your Orders page."}
            </p>
          </div>

          <Link
            to="/my-orders"
            onClick={() => triggerHaptic("selection")}
            style={{
              background: "var(--brand-gradient)",
              boxShadow: "var(--brand-shadow)",
            }}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-sm cursor-pointer hover:opacity-95 transition"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Go to My Orders</span>
          </Link>
        </div>
      )}

      {/* ── Returns Cards List ── */}
      {!loading && !error && filteredReturns.length > 0 && (
        <div className="space-y-4">
          {filteredReturns.map((ret) => {
            const statusMeta = getStatusMeta(ret.status);
            const firstItem = ret.items?.[0];
            const formattedDate = new Date(ret.requested_at).toLocaleDateString(
              "en-IN",
              {
                day: "numeric",
                month: "short",
                year: "numeric",
              }
            );

            return (
              <div
                key={ret.id}
                onClick={() => {
                  triggerHaptic("selection");
                  navigate(`/returns/${ret.id}`);
                }}
                className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all p-4 sm:p-5 shadow-2xs hover:shadow-xs cursor-pointer group space-y-4"
              >
                {/* Top Row: Return Code & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                      {ret.return_code}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => handleCopy(ret.return_code, e)}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
                      title="Copy Return Code"
                    >
                      {copiedCode === ret.return_code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{formattedDate}</span>
                    </span>

                    <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                    <Link
                      to={`/order/${ret.order_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-bold text-brand-dark dark:text-orange-400 hover:underline"
                    >
                      Order #{ret.order_id}
                    </Link>
                  </div>

                  {/* Status & Type Pills */}
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {ret.type === "replacement" ? (
                        <Sparkles className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                      ) : (
                        <RotateCcw className="w-3 h-3 text-amber-600 dark:text-orange-400" />
                      )}
                      <span>{ret.type}</span>
                    </span>

                    <span
                      className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.badge}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
                      <span>{RETURN_STATUS_LABELS[ret.status]}</span>
                    </span>
                  </div>
                </div>

                {/* Items & Reason Preview */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      {firstItem?.product?.images?.[0] ? (
                        <img
                          src={firstItem.product.images[0]}
                          alt={firstItem.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 space-y-1">
                      <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {firstItem?.product?.name || "Product Unit"}
                      </p>

                      <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-y-0.5">
                        <span>
                          Qty: <strong className="text-slate-700 dark:text-slate-200">{firstItem?.quantity || 1} pcs</strong>
                        </span>
                        {ret.items && ret.items.length > 1 && (
                          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                            (+{ret.items.length - 1} more items)
                          </span>
                        )}
                        <span>&bull;</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {RETURN_REASON_LABELS[ret.reason_code]}
                        </span>
                      </div>

                      {ret.refund_amount > 0 && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                          Refund Value: ₹{ret.refund_amount.toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Action */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <span className="inline-flex items-center space-x-1 text-xs font-bold text-brand-dark dark:text-orange-400 group-hover:translate-x-0.5 transition-transform">
                      <span>View Timeline</span>
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                {/* Latest note / status update */}
                {ret.admin_note && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/60 p-2.5 rounded-xl">
                    <span className="font-bold text-slate-800 dark:text-white">Note: </span>
                    <span>{ret.admin_note}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
