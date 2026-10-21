import { useState, useEffect } from "react";
import type {
  ReturnRequest,
  ReturnStatus,
} from "@urbanrat/shared";
import {
  RETURN_STATUS_LABELS,
  RETURN_REASON_LABELS,
} from "@urbanrat/shared";
import {
  fetchAdminReturns,
  exportReturnsToExcel,
} from "../../lib/adminService";
import { triggerHaptic } from "../../utils/haptics";
import { ReturnDetailDrawer } from "./ReturnDetailDrawer";
import { ClaimModal } from "./ClaimModal";
import {
  Search,
  Download,
  Check,
  Copy,
  Eye,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface ReturnTrackingListProps {
  initialSearchQuery?: string;
  initialStatusFilter?: string;
}

type TrackingTab =
  | "all"
  | "requested"
  | "approved"
  | "in_transit"
  | "qc"
  | "resolved"
  | "closed";

const TRACKING_TABS: { key: TrackingTab; label: string; statuses?: ReturnStatus[] }[] = [
  { key: "all", label: "All Returns" },
  { key: "requested", label: "Pending Verification", statuses: ["requested"] },
  { key: "approved", label: "Approved / Reverse Pickup", statuses: ["approved", "pickup_scheduled"] },
  { key: "in_transit", label: "In Transit", statuses: ["in_transit"] },
  { key: "qc", label: "Warehouse QC", statuses: ["received", "qc_passed", "qc_failed"] },
  { key: "resolved", label: "Refunded / Replaced", statuses: ["refunded", "replacement_shipped"] },
  { key: "closed", label: "Closed / Rejected", statuses: ["closed", "rejected"] },
];

export function ReturnTrackingList({
  initialSearchQuery = "",
  initialStatusFilter = "all",
}: ReturnTrackingListProps) {
  const [activeTab, setActiveTab] = useState<TrackingTab>(
    initialStatusFilter === "requested" ? "requested" : "all"
  );
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drawer & modal states
  const [activeReturnId, setActiveReturnId] = useState<string | null>(null);
  const [claimModalReq, setClaimModalReq] = useState<ReturnRequest | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadReturns();
  }, [typeFilter, fromDate, toDate]);

  async function loadReturns() {
    try {
      setLoading(true);
      const data = await fetchAdminReturns({
        type: typeFilter !== "all" ? typeFilter : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setReturns(data);
    } catch (err) {
      console.error("Failed to fetch returns:", err);
    } finally {
      setLoading(false);
    }
  }

  // Filter returns by active tab & search query
  const filteredReturns = returns.filter((r) => {
    // 1. Tab check
    if (activeTab !== "all") {
      const currentTabDef = TRACKING_TABS.find((t) => t.key === activeTab);
      if (currentTabDef?.statuses && !currentTabDef.statuses.includes(r.status)) {
        return false;
      }
    }

    // 2. Search query check
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchCode = r.return_code?.toLowerCase().includes(q);
      const matchOrder = r.order_id?.toLowerCase().includes(q);
      const matchCustName = r.customer?.name?.toLowerCase().includes(q);
      const matchCustPhone = r.customer?.phone?.toLowerCase().includes(q);
      const matchCustBiz = r.customer?.business_name?.toLowerCase().includes(q);
      const matchSku = r.items?.some(
        (it) =>
          it.product?.sku?.toLowerCase().includes(q) ||
          it.product?.name?.toLowerCase().includes(q)
      );
      return matchCode || matchOrder || matchCustName || matchCustPhone || matchCustBiz || matchSku;
    }

    return true;
  });

  // Tab counts
  const tabCounts: Record<TrackingTab, number> = {
    all: returns.length,
    requested: returns.filter((r) => r.status === "requested").length,
    approved: returns.filter((r) => r.status === "approved" || r.status === "pickup_scheduled").length,
    in_transit: returns.filter((r) => r.status === "in_transit").length,
    qc: returns.filter((r) => ["received", "qc_passed", "qc_failed"].includes(r.status)).length,
    resolved: returns.filter((r) => ["refunded", "replacement_shipped"].includes(r.status)).length,
    closed: returns.filter((r) => ["closed", "rejected"].includes(r.status)).length,
  };

  function handleSelectAll() {
    triggerHaptic("selection");
    if (selectedIds.size === filteredReturns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReturns.map((r) => r.id)));
    }
  }

  function handleToggleSelect(id: string) {
    triggerHaptic("selection");
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    triggerHaptic("selection");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleExportExcel() {
    triggerHaptic("selection");
    const targetReturns =
      selectedIds.size > 0
        ? returns.filter((r) => selectedIds.has(r.id))
        : filteredReturns;
    exportReturnsToExcel(targetReturns, `URT_Return_Tracking_${activeTab}.xlsx`);
  }

  const getStatusColor = (status: ReturnStatus) => {
    switch (status) {
      case "requested":
        return "bg-amber-100 text-amber-900 border-amber-300";
      case "approved":
      case "pickup_scheduled":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "in_transit":
        return "bg-indigo-100 text-indigo-800 border-indigo-300";
      case "received":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "qc_passed":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "qc_failed":
      case "rejected":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "refunded":
      case "replacement_shipped":
      case "closed":
        return "bg-slate-100 text-slate-800 border-slate-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Tabs Strip with Live Badges ── */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        {TRACKING_TABS.map((tab) => {
          const count = tabCounts[tab.key] || 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setActiveTab(tab.key);
              }}
              className={`px-3.5 py-2.5 rounded-t-2xl text-xs font-black tracking-tight whitespace-nowrap transition-all flex items-center space-x-2 border-b-2 cursor-pointer ${
                isActive
                  ? "border-slate-900 text-slate-900 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : count > 0 && tab.key === "requested"
                    ? "bg-amber-400 text-slate-950 font-black animate-pulse"
                    : "bg-slate-200/80 text-slate-700"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search return code, order, customer, SKU..."
              className="w-full pl-8.5 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-dark"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-dark cursor-pointer"
            >
              <option value="all">Resolution Type: All</option>
              <option value="return">Return with Refund</option>
              <option value="replacement">Wholesale Replacement</option>
              <option value="refund">Direct Refund</option>
            </select>
          </div>

          {/* From Date */}
          <div className="relative">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-dark"
            />
          </div>

          {/* To Date */}
          <div className="relative">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-dark"
            />
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-semibold">
              Showing <span className="font-mono font-bold text-slate-900">{filteredReturns.length}</span> returns
            </span>
            {selectedIds.size > 0 && (
              <span className="text-xs font-bold text-brand-dark bg-brand-light/20 px-2 py-0.5 rounded-full">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={loadReturns}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-1.5 transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {selectedIds.size > 0 ? "Selected" : "All"} to XLSX</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Desktop Data Grid ── */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-wider">
              <th className="py-3 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={filteredReturns.length > 0 && selectedIds.size === filteredReturns.length}
                  onChange={handleSelectAll}
                  className="rounded text-brand-dark focus:ring-brand-dark cursor-pointer"
                />
              </th>
              <th className="py-3 px-4">Return Code</th>
              <th className="py-3 px-4">Customer &amp; Business</th>
              <th className="py-3 px-4">Order Code</th>
              <th className="py-3 px-4 text-center">Items</th>
              <th className="py-3 px-4">Type &amp; Reason</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-dark" />
                  <span>Loading returns pipeline...</span>
                </td>
              </tr>
            ) : filteredReturns.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                  No return requests found matching current tab filters.
                </td>
              </tr>
            ) : (
              filteredReturns.map((r) => {
                const isSelected = selectedIds.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-slate-50/80 transition ${
                      isSelected ? "bg-brand-light/10" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(r.id)}
                        className="rounded text-brand-dark focus:ring-brand-dark cursor-pointer"
                      />
                    </td>

                    {/* Return Code */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono font-black text-slate-900 text-xs">
                          {r.return_code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(r.return_code)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700"
                        >
                          {copiedId === r.return_code ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-4">
                      <p className="font-black text-slate-900 truncate max-w-xs">
                        {r.customer?.name || "Customer"}
                      </p>
                      {r.customer?.business_name && (
                        <p className="text-[10px] font-bold text-slate-500 truncate max-w-xs">
                          {r.customer.business_name}
                        </p>
                      )}
                      {r.customer?.phone && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          +91 {r.customer.phone}
                        </p>
                      )}
                    </td>

                    {/* Order Code */}
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-brand-dark text-xs">
                        #{r.order_id}
                      </span>
                    </td>

                    {/* Items */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-black text-slate-900 text-xs">
                        {r.items?.length || 0}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        ({r.items?.reduce((sum, it) => sum + (it.quantity || 0), 0) || 0} units)
                      </span>
                    </td>

                    {/* Type & Reason */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-800">
                        {r.type}
                      </span>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate max-w-35">
                        {RETURN_REASON_LABELS[r.reason_code] || r.reason_code}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getStatusColor(
                          r.status
                        )}`}
                      >
                        {RETURN_STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {new Date(r.requested_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          setActiveReturnId(r.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center space-x-1.5 ml-auto cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Cards View (< 768px) ── */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-dark" />
            <span>Loading returns...</span>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No return records matching filters.
          </div>
        ) : (
          filteredReturns.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-3xl bg-white border border-slate-200/90 space-y-3 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black text-sm text-slate-900">
                    {r.return_code}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(r.return_code)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700"
                  >
                    {copiedId === r.return_code ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getStatusColor(
                    r.status
                  )}`}
                >
                  {RETURN_STATUS_LABELS[r.status] || r.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-800">{r.customer?.name || "Customer"}</p>
                  <p className="text-[10px] text-slate-500">{r.customer?.business_name || "—"}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">Order #{r.order_id}</span>
                  <span className="text-xs font-black text-slate-900">
                    {r.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0} units
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-700 uppercase">{r.type}</span>
                <span className="text-slate-500 font-medium">
                  {RETURN_REASON_LABELS[r.reason_code] || r.reason_code}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setActiveReturnId(r.id);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Inspect &amp; Resolve</span>
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {activeReturnId && (
        <ReturnDetailDrawer
          returnId={activeReturnId}
          onClose={() => setActiveReturnId(null)}
          onUpdated={loadReturns}
          onOpenClaimModal={(req) => setClaimModalReq(req)}
        />
      )}

      {/* ── Claim Modal ── */}
      {claimModalReq && (
        <ClaimModal
          returnReq={claimModalReq}
          onClose={() => setClaimModalReq(null)}
          onSaved={() => {
            loadReturns();
            if (activeReturnId) setActiveReturnId(activeReturnId);
          }}
        />
      )}
    </div>
  );
}
