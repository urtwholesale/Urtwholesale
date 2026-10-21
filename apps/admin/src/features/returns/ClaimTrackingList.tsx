import { useState, useEffect } from "react";
import type {
  ReturnRequest,
  ClaimStatus,
} from "@urbanrat/shared";
import {
  CLAIM_STATUS_LABELS,
  CLAIM_TYPE_LABELS,
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
} from "@urbanrat/shared";
import {
  fetchAdminReturns,
  exportClaimsToExcel,
} from "../../lib/adminService";
import { triggerHaptic } from "../../utils/haptics";
import { ClaimModal } from "./ClaimModal";
import {
  Search,
  Download,
  RefreshCw,
  Loader2,
  Edit,
} from "lucide-react";

export function ClaimTrackingList() {
  const [claims, setClaims] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Claim modal state
  const [selectedReq, setSelectedReq] = useState<ReturnRequest | null>(null);

  useEffect(() => {
    loadClaims();
  }, []);

  async function loadClaims() {
    try {
      setLoading(true);
      // Fetch all returns that either have a claim or are eligible for claim (qc_failed or rejected)
      const data = await fetchAdminReturns();
      const eligible = data.filter(
        (r) =>
          (r.claim_status && r.claim_status !== "none") ||
          r.status === "qc_failed" ||
          r.status === "rejected"
      );
      setClaims(eligible);
    } catch (err) {
      console.error("Failed to load claims:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredClaims = claims.filter((c) => {
    if (statusFilter !== "all") {
      const claimSt = c.claim_status || "none";
      if (statusFilter === "none" && claimSt !== "none") return false;
      if (statusFilter !== "none" && claimSt !== statusFilter) return false;
    }
    if (typeFilter !== "all" && c.claim_type !== typeFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchCode = c.return_code?.toLowerCase().includes(q);
      const matchOrder = c.order_id?.toLowerCase().includes(q);
      const matchCust = c.customer?.name?.toLowerCase().includes(q);
      const matchRef = c.claim_reference?.toLowerCase().includes(q);
      return matchCode || matchOrder || matchCust || matchRef;
    }
    return true;
  });

  // KPI calculations
  const totalClaimsCount = claims.filter((c) => c.claim_status && c.claim_status !== "none").length;
  const totalClaimValue = claims.reduce((sum, c) => sum + (c.claim_amount || 0), 0);
  const settledValue = claims
    .filter((c) => c.claim_status === "settled" || c.claim_status === "approved")
    .reduce((sum, c) => sum + (c.claim_amount || 0), 0);
  const pendingCount = claims.filter((c) => c.claim_status === "pending").length;

  function handleExportExcel() {
    triggerHaptic("selection");
    exportClaimsToExcel(filteredClaims, "URT_Supplier_Courier_Claims.xlsx");
  }

  const getClaimStatusBadge = (status?: ClaimStatus) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-900 border-amber-300";
      case "approved":
        return "bg-blue-100 text-blue-900 border-blue-300";
      case "settled":
        return "bg-emerald-100 text-emerald-900 border-emerald-300";
      case "rejected":
        return "bg-rose-100 text-rose-900 border-rose-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  return (
    <div className="space-y-5">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Claims */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Claims Filed
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {totalClaimsCount}
          </div>
          <span className="text-[10px] font-semibold text-slate-500 block">
            Courier &amp; supplier reimbursements
          </span>
        </div>

        {/* Total Claim Amount */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Total Claim Amount
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            ₹{totalClaimValue.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] font-semibold text-slate-500 block">
            Gross reimbursement value
          </span>
        </div>

        {/* Settled Value */}
        <div className="p-4 sm:p-5 rounded-3xl bg-emerald-50/70 border border-emerald-200 shadow-2xs space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
            Settled / Approved
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-950">
            ₹{settledValue.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] font-bold text-emerald-700 block">
            Recovered from carriers &amp; vendors
          </span>
        </div>

        {/* Pending Review */}
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/70 border border-amber-200 shadow-2xs space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
            Pending Claims
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-950">
            {pendingCount}
          </div>
          <span className="text-[10px] font-bold text-amber-700 block">
            Under active courier / vendor dispute
          </span>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search return code, order, customer, ref #..."
              className="w-full pl-8.5 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-dark"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-dark cursor-pointer"
            >
              <option value="all">Claim Status: All Records</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="settled">Settled / Reimbursed</option>
              <option value="rejected">Rejected</option>
              <option value="none">Eligible (Not Filed Yet)</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-dark cursor-pointer"
            >
              <option value="all">Claim Category: All</option>
              <option value="courier">Courier Transit Loss / Damage</option>
              <option value="supplier">Supplier Warranty Defect</option>
              <option value="transit_damage">Severe Transit Damage</option>
              <option value="customer_fraud">Customer Wrong Return</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-500 font-semibold">
            Showing <span className="font-mono font-bold text-slate-900">{filteredClaims.length}</span> claim consignments
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={loadClaims}
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
              <span>Export Claims XLSX</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Table (Desktop) ── */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-wider">
              <th className="py-3 px-4">Return &amp; Order</th>
              <th className="py-3 px-4">Customer Entity</th>
              <th className="py-3 px-4">RMA Status &amp; Reason</th>
              <th className="py-3 px-4">Claim Category</th>
              <th className="py-3 px-4 text-center">Amount (₹)</th>
              <th className="py-3 px-4">Claim Status</th>
              <th className="py-3 px-4">Reference #</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-dark" />
                  <span>Loading claim pipeline...</span>
                </td>
              </tr>
            ) : filteredClaims.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                  No claims found matching current criteria.
                </td>
              </tr>
            ) : (
              filteredClaims.map((c) => {
                const hasClaim = c.claim_status && c.claim_status !== "none";
                return (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    {/* Return & Order */}
                    <td className="py-3 px-4">
                      <p className="font-mono font-black text-slate-900 text-xs">
                        {c.return_code}
                      </p>
                      <p className="font-mono text-[10px] text-brand-dark font-bold">
                        #{c.order_id}
                      </p>
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-4">
                      <p className="font-black text-slate-900 truncate max-w-xs">
                        {c.customer?.name || "Customer"}
                      </p>
                      {c.customer?.phone && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          +91 {c.customer.phone}
                        </p>
                      )}
                    </td>

                    {/* RMA Status & Reason */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {RETURN_STATUS_LABELS[c.status] || c.status}
                      </span>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {RETURN_REASON_LABELS[c.reason_code] || c.reason_code}
                      </p>
                    </td>

                    {/* Claim Category */}
                    <td className="py-3 px-4">
                      {c.claim_type ? (
                        <span className="font-bold text-slate-800">
                          {CLAIM_TYPE_LABELS[c.claim_type] || c.claim_type}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </td>

                    {/* Claim Amount */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-black text-slate-900 text-xs">
                        ₹{(c.claim_amount || c.refund_amount || 0).toLocaleString("en-IN")}
                      </span>
                    </td>

                    {/* Claim Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getClaimStatusBadge(
                          c.claim_status
                        )}`}
                      >
                        {c.claim_status ? CLAIM_STATUS_LABELS[c.claim_status] : "Not Filed"}
                      </span>
                    </td>

                    {/* Reference # */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {c.claim_reference || "—"}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          setSelectedReq(c);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ml-auto cursor-pointer shadow-2xs ${
                          hasClaim
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-800"
                            : "bg-amber-400 hover:bg-amber-300 text-slate-950 font-black"
                        }`}
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>{hasClaim ? "Update Claim" : "File Claim"}</span>
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
            <span>Loading claims...</span>
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No claim records matching criteria.
          </div>
        ) : (
          filteredClaims.map((c) => {
            const hasClaim = c.claim_status && c.claim_status !== "none";
            return (
              <div
                key={c.id}
                className="p-4 rounded-3xl bg-white border border-slate-200 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-xs text-slate-900">
                    {c.return_code} • #{c.order_id}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getClaimStatusBadge(
                      c.claim_status
                    )}`}
                  >
                    {c.claim_status ? CLAIM_STATUS_LABELS[c.claim_status] : "Not Filed"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Claim Amount</span>
                    <span className="font-black text-slate-900">
                      ₹{(c.claim_amount || c.refund_amount || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Category</span>
                    <span className="font-bold text-slate-700 truncate block">
                      {c.claim_type ? CLAIM_TYPE_LABELS[c.claim_type] : "Not Set"}
                    </span>
                  </div>
                </div>

                {c.claim_reference && (
                  <p className="text-[10px] font-mono text-slate-500">
                    Ref #: <span className="font-bold text-slate-800">{c.claim_reference}</span>
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setSelectedReq(c);
                  }}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    hasClaim
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-800"
                      : "bg-amber-400 hover:bg-amber-300 text-slate-950 font-black"
                  }`}
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>{hasClaim ? "Update Claim Record" : "File Supplier / Courier Claim"}</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Claim Edit Modal ── */}
      {selectedReq && (
        <ClaimModal
          returnReq={selectedReq}
          onClose={() => setSelectedReq(null)}
          onSaved={loadClaims}
        />
      )}
    </div>
  );
}
