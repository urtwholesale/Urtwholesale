import { useState, Fragment } from "react";
import * as XLSX from "xlsx";
import {
  Eye,
  CheckCircle2,
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import type { BulkOpResult } from "@urbanrat/shared";
import { triggerHaptic } from "../../../utils/haptics";

export interface BulkPreviewPanelProps {
  productIds: string[];
  scopeLabel: string;
  isDestructive: boolean;
  destructiveReason?: string;
  isValidToPreview: boolean;
  validationError?: string | null;
  onRunPreview: () => Promise<BulkOpResult>;
  onApplyChunk: (chunkIds: string[]) => Promise<BulkOpResult>;
  onSuccess: (result: { applied: number; skipped: number; opIds: string[] }) => void;
  onCancel?: () => void;
}

export function BulkPreviewPanel({
  productIds,
  scopeLabel,
  isDestructive,
  destructiveReason,
  isValidToPreview,
  validationError,
  onRunPreview,
  onApplyChunk,
  onSuccess,
  onCancel,
}: BulkPreviewPanelProps) {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<BulkOpResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Apply state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState<{
    currentChunk: number;
    totalChunks: number;
    processed: number;
    total: number;
    applied: number;
    skipped: number;
  }>({
    currentChunk: 0,
    totalChunks: 0,
    processed: 0,
    total: 0,
    applied: 0,
    skipped: 0,
  });
  const [failedChunkIds, setFailedChunkIds] = useState<string[] | null>(null);

  const totalSelected = productIds.length;
  const requiresTypeApply = isDestructive || totalSelected > 100;

  // Run Dry-Run Preview
  async function handlePreviewClick() {
    if (!isValidToPreview) return;
    triggerHaptic("selection");
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const res = await onRunPreview();
      setPreviewResult(res);
      triggerHaptic("success");
    } catch (err: any) {
      console.error("Preview failed:", err);
      setPreviewError(err?.message || "Failed to generate preview from server.");
      triggerHaptic("heavy");
    } finally {
      setLoadingPreview(false);
    }
  }

  // Export preview to XLSX
  function handleDownloadXlsx() {
    if (!previewResult || previewResult.items.length === 0) return;
    triggerHaptic("selection");

    const exportRows = previewResult.items.map((item) => ({
      "Product ID": item.product_id,
      "Product Name": item.product_name,
      SKU: item.sku || "",
      Before: typeof item.before === "object" ? JSON.stringify(item.before) : item.before,
      After: typeof item.after === "object" ? JSON.stringify(item.after) : item.after,
      Status: item.errors && item.errors.length > 0 ? "Skipped (Error)" : "Will Change",
      Errors: (item.errors || []).join(" | "),
      Warnings: (item.warnings || []).join(" | "),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bulk Preview");
    XLSX.writeFile(wb, `bulk_edit_preview_${Date.now().toString(36)}.xlsx`);
  }

  // Chunked execution of bulk update
  async function handleConfirmApply() {
    if (requiresTypeApply && confirmInput.trim().toUpperCase() !== "APPLY") {
      return;
    }

    setIsConfirmOpen(false);
    setIsApplying(true);
    triggerHaptic("selection");

    const CHUNK_SIZE = 200;
    const chunks: string[][] = [];
    for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
      chunks.push(productIds.slice(i, i + CHUNK_SIZE));
    }

    setApplyProgress({
      currentChunk: 0,
      totalChunks: chunks.length,
      processed: 0,
      total: productIds.length,
      applied: 0,
      skipped: 0,
    });

    const collectedOpIds: string[] = [];
    let totalApplied = 0;
    let totalSkipped = 0;
    let failedChunks: string[] | null = null;

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      if (!chunk) continue;
      setApplyProgress((prev) => ({
        ...prev,
        currentChunk: idx + 1,
      }));

      try {
        const res = await onApplyChunk(chunk);
        if (res.op_id) {
          collectedOpIds.push(res.op_id);
        }
        totalApplied += res.affected_count;
        totalSkipped += (chunk.length - res.affected_count);

        setApplyProgress((prev) => ({
          ...prev,
          processed: prev.processed + chunk.length,
          applied: totalApplied,
          skipped: totalSkipped,
        }));
      } catch (err: any) {
        console.error(`Chunk ${idx + 1} failed:`, err);
        failedChunks = chunk;
        setFailedChunkIds(chunk);
        triggerHaptic("heavy");
        break;
      }
    }

    setIsApplying(false);

    if (!failedChunks) {
      triggerHaptic("success");
      onSuccess({
        applied: totalApplied,
        skipped: totalSkipped,
        opIds: collectedOpIds,
      });
    }
  }

  // Calculate summary counts
  const items = previewResult?.items || [];
  const willChangeCount = items.filter((i) => !i.errors || i.errors.length === 0).length;
  const skippedCount = items.filter((i) => i.errors && i.errors.length > 0).length;

  return (
    <div className="space-y-4 pt-4 border-t border-slate-100">
      {/* ── Action Buttons ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            disabled={!isValidToPreview || loadingPreview || isApplying}
            onClick={handlePreviewClick}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 active:scale-95"
          >
            {loadingPreview ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
            ) : (
              <Eye className="w-4 h-4 text-brand-dark" />
            )}
            <span>Preview changes</span>
          </button>

          {previewResult && (
            <button
              type="button"
              onClick={handleDownloadXlsx}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer active:scale-95"
              title="Download preview as Excel"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download (.xlsx)</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            disabled={!previewResult || loadingPreview || isApplying}
            onClick={() => {
              triggerHaptic("selection");
              setConfirmInput("");
              setIsConfirmOpen(true);
            }}
            className={`px-5 py-2 rounded-xl text-xs font-extrabold transition shadow-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1.5 active:scale-95 ${
              isDestructive
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "brand-gradient text-white"
            }`}
          >
            <span>Apply to {totalSelected} products</span>
          </button>
        </div>
      </div>

      {validationError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{validationError}</span>
        </div>
      )}

      {previewError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{previewError}</span>
        </div>
      )}

      {/* ── Applying Progress Bar ── */}
      {isApplying && (
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2 animate-pulse">
          <div className="flex items-center justify-between text-xs font-bold text-sky-900">
            <span>
              Applying chunk {applyProgress.currentChunk} of {applyProgress.totalChunks}...
            </span>
            <span>
              {applyProgress.processed} / {applyProgress.total} products
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-sky-200 overflow-hidden">
            <div
              className="h-full bg-brand-dark transition-all duration-300"
              style={{
                width: `${Math.round(
                  (applyProgress.processed / (applyProgress.total || 1)) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Failed Chunk Retry Box ── */}
      {failedChunkIds && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-900">
          <div>
            <p className="font-bold">A batch chunk failed to execute.</p>
            <p className="text-[11px] text-rose-700 mt-0.5">
              {failedChunkIds.length} products remaining in the current batch.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFailedChunkIds(null);
              handleConfirmApply();
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold flex items-center space-x-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Batch</span>
          </button>
        </div>
      )}

      {/* ── Preview Result Table & Chips ── */}
      {previewResult && (
        <div className="space-y-3 pt-2">
          {/* Summary Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-500 text-[11px]">Preview Summary:</span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold flex items-center space-x-1 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Will Change: {willChangeCount}</span>
            </span>
            {skippedCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-extrabold flex items-center space-x-1 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Skipped (Errors): {skippedCount}</span>
              </span>
            )}
            <span className="text-[10px] text-slate-400 ml-auto">
              Showing first {Math.min(50, items.length)} of {items.length} rows
            </span>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-200 text-slate-500 font-extrabold text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Proposed Change</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.slice(0, 50).map((row) => {
                  const hasError = row.errors && row.errors.length > 0;
                  return (
                    <Fragment key={row.product_id}>
                      <tr className={`hover:bg-slate-50/60 transition ${hasError ? "bg-rose-50/30" : ""}`}>
                        <td className="py-2.5 px-3 font-bold text-slate-900 max-w-44 truncate" title={row.product_name}>
                          {row.product_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {row.sku || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-700">
                          {renderPreviewChange(row.before, row.after)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {hasError ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800">
                              Skipped
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Ready
                            </span>
                          )}
                        </td>
                      </tr>
                      {hasError && (
                        <tr className="bg-rose-50/40">
                          <td colSpan={4} className="py-1 px-3 text-[10px] text-rose-700 font-medium">
                            {row.errors?.join("; ")}
                          </td>
                        </tr>
                      )}
                      {!hasError && row.warnings && row.warnings.length > 0 && (
                        <tr className="bg-amber-50/40">
                          <td colSpan={4} className="py-1 px-3 text-[10px] text-amber-700 font-medium">
                            {row.warnings.join("; ")}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  isDestructive ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-brand-dark"
                }`}
              >
                {isDestructive ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {isDestructive ? "Confirm Destructive Bulk Action" : "Apply Bulk Update"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {scopeLabel}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-700">
              <p>
                You are about to modify <strong>{totalSelected}</strong> products.
              </p>
              {destructiveReason && (
                <p className="text-rose-700 font-bold text-[11px]">
                  Warning: {destructiveReason}
                </p>
              )}
              {willChangeCount > 0 && (
                <p className="text-emerald-700 text-[11px]">
                  &bull; {willChangeCount} products ready to update.
                </p>
              )}
              {skippedCount > 0 && (
                <p className="text-rose-600 text-[11px]">
                  &bull; {skippedCount} invalid products will be skipped automatically.
                </p>
              )}
            </div>

            {requiresTypeApply && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Type <span className="font-mono text-rose-600 font-black">APPLY</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="APPLY"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold uppercase"
                />
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={requiresTypeApply && confirmInput.trim().toUpperCase() !== "APPLY"}
                onClick={handleConfirmApply}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDestructive ? "bg-rose-600 hover:bg-rose-700" : "brand-gradient"
                }`}
              >
                Confirm &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatVal(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") {
    if (Array.isArray(v)) {
      if (v.length === 0) return "Empty";
      if (typeof v[0] === "object" && "min_qty" in v[0]) {
        return `${v.length} Tiers`;
      }
      return `${v.length} items`;
    }
    const entries = Object.entries(v)
      .filter(([_, val]) => val !== undefined)
      .map(([key, val]) => `${key}: ${val}`);
    return entries.length > 0 ? entries.join(", ") : "—";
  }
  return String(v);
}

function renderPreviewChange(before: any, after: any) {
  const isImageChange =
    (before && typeof before === "object" && "images" in before && Array.isArray(before.images)) ||
    (after && typeof after === "object" && "images" in after && Array.isArray(after.images)) ||
    (Array.isArray(before) && before.length > 0 && typeof before[0] === "string" && before[0].startsWith("http")) ||
    (Array.isArray(after) && after.length > 0 && typeof after[0] === "string" && after[0].startsWith("http"));

  if (isImageChange) {
    const beforeImgs: string[] = Array.isArray(before) ? before : (before?.images || []);
    const afterImgs: string[] = Array.isArray(after) ? after : (after?.images || []);

    return (
      <div className="flex items-center space-x-1.5 py-0.5">
        <div className="flex items-center space-x-1 shrink-0 opacity-60">
          {beforeImgs.length === 0 ? (
            <span className="text-[10px] text-slate-400 italic">0 imgs</span>
          ) : (
            beforeImgs.slice(0, 2).map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt=""
                className="w-5 h-5 rounded object-cover border border-slate-200"
              />
            ))
          )}
          {beforeImgs.length > 2 && (
            <span className="text-[9px] font-bold text-slate-400">+{beforeImgs.length - 2}</span>
          )}
        </div>

        <span className="text-slate-400 font-bold text-[10px]">&rarr;</span>

        <div className="flex items-center space-x-1 shrink-0">
          {afterImgs.length === 0 ? (
            <span className="text-[10px] text-rose-500 font-bold italic">Empty</span>
          ) : (
            afterImgs.slice(0, 2).map((url, idx) => (
              <div key={idx} className="relative">
                <img
                  src={url}
                  alt=""
                  className={`w-5 h-5 rounded object-cover border ${
                    idx === 0 ? "border-brand-dark ring-1 ring-brand-dark/40" : "border-slate-200"
                  }`}
                />
                {idx === 0 && (
                  <span className="absolute -top-1 -right-1 text-[6px] bg-brand-dark text-white rounded-full px-0.5 font-bold leading-tight">
                    1
                  </span>
                )}
              </div>
            ))
          )}
          {afterImgs.length > 2 && (
            <span className="text-[9px] font-bold text-brand-dark">+{afterImgs.length - 2}</span>
          )}
        </div>
      </div>
    );
  }

  // Stock change
  if (
    before && typeof before === "object" && "stock" in before &&
    after && typeof after === "object" && "stock" in after
  ) {
    const delta = after.stock - before.stock;
    return (
      <div className="flex items-center space-x-1.5 font-mono text-[11px]">
        <span className="text-slate-400 line-through">{before.stock}</span>
        <span className="text-slate-400">&rarr;</span>
        <span className="font-extrabold text-slate-900">{after.stock}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
          delta > 0 ? "bg-emerald-50 text-emerald-700" : delta < 0 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"
        }`}>
          {delta >= 0 ? `+${delta}` : delta}
        </span>
      </div>
    );
  }

  return (
    <div>
      <span className="text-slate-400 line-through mr-1">
        {formatVal(before)}
      </span>
      <span className="font-bold text-brand-dark">
        &rarr; {formatVal(after)}
      </span>
    </div>
  );
}

