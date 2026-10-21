import { useState } from "react";
import type {
  ReturnRequest,
  ClaimStatus,
  ClaimType,
} from "@urbanrat/shared";
import {
  CLAIM_STATUS_LABELS,
  CLAIM_TYPE_LABELS,
  CLAIM_STATUSES,
  CLAIM_TYPES,
} from "@urbanrat/shared";
import { adminUpdateReturnClaim } from "../../lib/adminService";
import { triggerHaptic } from "../../utils/haptics";
import {
  X,
  ShieldAlert,
  Loader2,
  Check,
  AlertTriangle,
  IndianRupee,
} from "lucide-react";

interface ClaimModalProps {
  returnReq: ReturnRequest;
  onClose: () => void;
  onSaved: () => void;
}

export function ClaimModal({ returnReq, onClose, onSaved }: ClaimModalProps) {
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>(
    returnReq.claim_status && returnReq.claim_status !== "none"
      ? returnReq.claim_status
      : "pending"
  );
  const [claimType, setClaimType] = useState<ClaimType>(
    returnReq.claim_type || "courier"
  );
  const [claimAmount, setClaimAmount] = useState<number>(
    returnReq.claim_amount || returnReq.refund_amount || 0
  );
  const [claimRef, setClaimRef] = useState<string>(
    returnReq.claim_reference || ""
  );
  const [claimNotes, setClaimNotes] = useState<string>(
    returnReq.claim_notes || ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (claimAmount < 0) {
      setError("Claim amount cannot be negative.");
      triggerHaptic("heavy");
      return;
    }

    try {
      setSaving(true);
      await adminUpdateReturnClaim({
        return_id: returnReq.id,
        claim_status: claimStatus,
        claim_amount: claimAmount,
        claim_type: claimType,
        claim_reference: claimRef.trim() || undefined,
        claim_notes: claimNotes.trim() || undefined,
      });

      triggerHaptic("success");
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Failed to update claim:", err);
      setError(err.message || "Failed to update claim record.");
      triggerHaptic("heavy");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Supplier &amp; Courier Claim Resolution
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                {returnReq.return_code} • Linked Order #{returnReq.order_id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Claim Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Claim Status
              </label>
              <select
                value={claimStatus}
                onChange={(e) => setClaimStatus(e.target.value as ClaimStatus)}
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-dark"
              >
                {CLAIM_STATUSES.map((cs) => (
                  <option key={cs} value={cs}>
                    {CLAIM_STATUS_LABELS[cs]}
                  </option>
                ))}
              </select>
            </div>

            {/* Claim Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Claim Category
              </label>
              <select
                value={claimType}
                onChange={(e) => setClaimType(e.target.value as ClaimType)}
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-dark"
              >
                {CLAIM_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {CLAIM_TYPE_LABELS[ct]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Claim Amount & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Claim Amount (₹)
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-dark"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Claim / Ticket Reference #
              </label>
              <input
                type="text"
                value={claimRef}
                onChange={(e) => setClaimRef(e.target.value)}
                placeholder="E.g. CLM-DLV-88391 or RMA-99"
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-dark"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Dispute &amp; Settlement Notes
            </label>
            <textarea
              rows={3}
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              placeholder="Record courier ticket details, dispute justification, supplier RMA authorization, or proof of transit seal damage..."
              className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-dark resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-1.5 transition shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Claim Record</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
