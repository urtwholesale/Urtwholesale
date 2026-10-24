import { useState, useEffect } from "react";
import {
  History,
  X,
  RotateCcw,
  Sliders,
  Layers,
  Boxes,
  ImageIcon,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { BulkOperationRecord } from "@urbanrat/shared";
import {
  listBulkOperations,
  previewUndoBulkOperation,
  undoBulkOperation,
} from "../../../lib/adminService";
import { triggerHaptic } from "../../../utils/haptics";

export interface BulkHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUndoComplete?: () => void;
}

export function BulkHistoryModal({
  isOpen,
  onClose,
  onUndoComplete,
}: BulkHistoryModalProps) {
  const [operations, setOperations] = useState<BulkOperationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Undo confirmation & preview dialog state
  const [undoTargetOp, setUndoTargetOp] = useState<BulkOperationRecord | null>(null);
  const [undoPreviewLoading, setUndoPreviewLoading] = useState(false);
  const [undoPreviewData, setUndoPreviewData] = useState<{
    canUndo: boolean;
    unrestorableCount: number;
    unrestorableItems: Array<{
      product_id: string;
      product_name?: string;
      sku?: string;
      reason: string;
    }>;
    items: Array<{
      product_id: string;
      product_name: string;
      sku?: string;
      before: any;
      after: any;
    }>;
  } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      setUndoTargetOp(null);
      setUndoPreviewData(null);
      setUndoMessage(null);
    }
  }, [isOpen]);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const data = await listBulkOperations(30);
      setOperations(data);
    } catch (err: any) {
      console.error("Failed to load bulk operations history:", err);
      setError(err?.message || "Failed to load bulk operations history.");
    } finally {
      setLoading(false);
    }
  }

  // Handle clicking "Undo" on an operation
  async function handleOpenUndoPreview(op: BulkOperationRecord) {
    triggerHaptic("selection");
    setUndoTargetOp(op);
    setUndoPreviewLoading(true);
    setUndoPreviewData(null);
    try {
      const preview = await previewUndoBulkOperation(op);
      setUndoPreviewData(preview);
    } catch (err: any) {
      console.error("Failed to load undo preview:", err);
      alert("Undo preview error: " + (err?.message || "Unknown error"));
      setUndoTargetOp(null);
    } finally {
      setUndoPreviewLoading(false);
    }
  }

  // Execute undo
  async function handleConfirmUndo() {
    if (!undoTargetOp) return;
    setUndoing(true);
    triggerHaptic("selection");
    try {
      const res = await undoBulkOperation(undoTargetOp.id);
      triggerHaptic("success");
      setUndoMessage(`Successfully undone bulk operation on ${res.undone_count} products.`);
      setUndoTargetOp(null);
      setUndoPreviewData(null);
      loadHistory();
      onUndoComplete?.();
    } catch (err: any) {
      console.error("Undo failed:", err);
      alert("Undo failed: " + (err?.message || "Unknown error"));
      triggerHaptic("heavy");
    } finally {
      setUndoing(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Bulk Edit History
              </h3>
              <p className="text-xs text-slate-500">
                Audit trail of recent bulk modifications and 1-click restore.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onClose();
            }}
            className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Notification Banner if undo succeeded ── */}
        {undoMessage && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 px-6">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{undoMessage}</span>
          </div>
        )}

        {/* ── Modal Body: Operations Table ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-dark" />
              <span className="text-xs font-medium">Loading history...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : operations.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Clock className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">No bulk operations found</p>
              <p className="text-[11px] text-slate-400">
                Any changes made using the Bulk Edit drawer will appear here.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-extrabold text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3.5">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Summary</th>
                    <th className="py-2.5 px-3 text-center">Count</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {operations.map((op) => {
                    const isUndoable = op.status === "applied";
                    return (
                      <tr key={op.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {formatDateTime(op.created_at)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {renderTypeBadge(op.op_type)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800 max-w-xs truncate" title={buildSummary(op)}>
                          {buildSummary(op)}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">
                          {op.affected_count}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {op.status === "applied" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Applied
                            </span>
                          ) : op.status === "undone" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600">
                              Undone
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {isUndoable && (
                            <button
                              type="button"
                              onClick={() => handleOpenUndoPreview(op)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center space-x-1 cursor-pointer active:scale-95 ml-auto"
                            >
                              <RotateCcw className="w-3 h-3 text-slate-500" />
                              <span>Undo</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Undo Confirmation & Preview Modal (Nested) ── */}
        {undoTargetOp && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Undo Bulk Operation
                  </h4>
                  <p className="text-xs text-slate-500">
                    {buildSummary(undoTargetOp)}
                  </p>
                </div>
              </div>

              {undoPreviewLoading ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-brand-dark" />
                  <p className="text-xs font-medium">Verifying restorable items...</p>
                </div>
              ) : undoPreviewData ? (
                <div className="space-y-3">
                  {/* Unrestorable Warning if any */}
                  {undoPreviewData.unrestorableCount > 0 && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1.5">
                      <div className="flex items-center space-x-1.5 font-bold text-rose-800">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          {undoPreviewData.unrestorableCount} product(s) cannot be restored:
                        </span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700 max-h-24 overflow-y-auto custom-scrollbar">
                        {undoPreviewData.unrestorableItems.map((item, idx) => (
                          <li key={idx}>
                            <span className="font-semibold">{item.product_name || item.product_id}:</span>{" "}
                            {item.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-extrabold text-[10px] uppercase">
                        <tr>
                          <th className="py-2 px-3">Product</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">Rollback To</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {undoPreviewData.items.slice(0, 30).map((row) => (
                          <tr key={row.product_id} className="hover:bg-slate-50/60">
                            <td className="py-2 px-3 font-bold text-slate-800 truncate max-w-36">
                              {row.product_name}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                              {row.sku || "—"}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-brand-dark font-bold">
                              {formatValueDisplay(row.after)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Undoing will create reversal records where applicable and restore previous attribute snapshots.
                  </p>
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  disabled={undoing}
                  onClick={() => {
                    setUndoTargetOp(null);
                    setUndoPreviewData(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    undoing ||
                    undoPreviewLoading ||
                    !undoPreviewData ||
                    !undoPreviewData.canUndo
                  }
                  onClick={handleConfirmUndo}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
                >
                  {undoing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Undo</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderTypeBadge(type: string) {
  switch (type) {
    case "details":
      return (
        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-sky-50 text-brand-dark border border-sky-100 flex items-center space-x-1 w-max">
          <Sliders className="w-3 h-3" />
          <span>Details</span>
        </span>
      );
    case "tiers":
      return (
        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100 flex items-center space-x-1 w-max">
          <Layers className="w-3 h-3" />
          <span>Price Tiers</span>
        </span>
      );
    case "stock":
      return (
        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-100 flex items-center space-x-1 w-max">
          <Boxes className="w-3 h-3" />
          <span>Stock</span>
        </span>
      );
    case "images":
      return (
        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center space-x-1 w-max">
          <ImageIcon className="w-3 h-3" />
          <span>Images</span>
        </span>
      );
    default:
      return <span className="text-[11px] text-slate-500">{type}</span>;
  }
}

function buildSummary(op: BulkOperationRecord): string {
  const p = op.params || {};
  switch (op.op_type) {
    case "details":
      return `Updated attributes on ${op.affected_count} products`;
    case "tiers":
      if (p.mode === "replace") return `Tiers replaced on ${op.affected_count} products`;
      if (p.mode === "adjust") return `Tiers adjusted on ${op.affected_count} products`;
      if (p.mode === "clear") return `Tiers cleared on ${op.affected_count} products`;
      return `Tiers updated on ${op.affected_count} products`;
    case "stock":
      if (p.mode === "add") return `Stock added (+${p.qty}) on ${op.affected_count} products`;
      if (p.mode === "subtract") return `Stock reduced (-${p.qty}) on ${op.affected_count} products`;
      if (p.mode === "set") return `Stock set to ${p.qty} on ${op.affected_count} products`;
      if (p.mode === "zero") return `Stock zeroed out on ${op.affected_count} products`;
      return `Stock adjusted on ${op.affected_count} products`;
    case "images":
      if (p.mode === "clear") return `Images removed on ${op.affected_count} products`;
      if (p.mode === "replace_all") return `Images replaced on ${op.affected_count} products`;
      if (p.mode === "sku_match") return `Images matched by SKU on ${op.affected_count} products`;
      return `Images updated on ${op.affected_count} products`;
    default:
      return `Bulk update on ${op.affected_count} products`;
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatValueDisplay(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") {
    if (Array.isArray(v)) {
      if (v.length === 0) return "Empty (0)";
      if (typeof v[0] === "string" && v[0].startsWith("http")) {
        return `${v.length} images`;
      }
      return `${v.length} items`;
    }
    if ("stock" in v) return `Stock: ${v.stock}`;
    return JSON.stringify(v);
  }
  return String(v);
}
