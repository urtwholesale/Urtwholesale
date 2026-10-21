import { useState, useEffect } from "react";
import {
  X,
  FileSpreadsheet,
  Layers,
  Calendar,
  Loader2,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import type { CatalogUpload, CatalogUploadItem } from "../types";

interface UploadDetailModalProps {
  upload: CatalogUpload | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UploadDetailModal({
  upload,
  isOpen,
  onClose,
}: UploadDetailModalProps) {
  const [items, setItems] = useState<CatalogUploadItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!upload || !isOpen) return;

    async function loadItems() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("catalog_upload_items")
          .select("*")
          .eq("upload_id", upload!.id)
          .order("row_number", { ascending: true });

        if (error) throw error;
        setItems(data || []);
      } catch (err) {
        console.error("Failed to load upload items:", err);
      } finally {
        setLoading(false);
      }
    }

    loadItems();
  }, [upload, isOpen]);

  if (!isOpen || !upload) return null;

  const successPercent =
    upload.total_items > 0
      ? Math.round((upload.passed_items / upload.total_items) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-dark text-white flex items-center justify-center shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-slate-900 font-mono">
                  {upload.id}
                </h3>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    upload.status === "qc_pass"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : upload.status === "qc_error"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {upload.status === "qc_pass"
                    ? "QC Pass"
                    : upload.status === "qc_error"
                    ? "QC Error"
                    : "Action Required"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {upload.upload_type === "bulk" ? "Bulk Catalog Import" : "Single Catalog Upload"} • {upload.file_name || "N/A"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Products
              </span>
              <span className="text-lg font-black text-slate-900 block mt-0.5">
                {upload.total_items}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                QC Passed
              </span>
              <span className="text-lg font-black text-emerald-800 block mt-0.5">
                {upload.passed_items}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
                QC Flagged / Failed
              </span>
              <span className="text-lg font-black text-rose-800 block mt-0.5">
                {upload.failed_items}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-brand-light/10 border border-brand-light/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-dark block">
                Quality Score
              </span>
              <span className="text-lg font-black text-brand-dark block mt-0.5">
                {successPercent}%
              </span>
            </div>
          </div>

          {/* Category Path & Notes */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-brand-dark shrink-0" />
              <span className="font-bold text-slate-900">Category:</span>
              <span className="text-slate-600 truncate">{upload.category_path || "General Catalog"}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-400 text-[11px]">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(upload.created_at).toLocaleString()}</span>
            </div>
          </div>

          {upload.notes && (
            <p className="text-xs text-slate-500 italic bg-amber-50/50 border border-amber-200/60 p-3 rounded-xl">
              {upload.notes}
            </p>
          )}

          {/* Row-Level Items Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Item Verification Log ({items.length})
            </h4>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-brand-dark" />
                <span className="text-xs">Loading item verification logs...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                No individual item records found for this upload run.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs divide-y divide-slate-100">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 flex items-start justify-between gap-3 text-xs hover:bg-slate-50 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-slate-400">
                          #{item.row_number}
                        </span>
                        <span className="font-bold text-slate-900 truncate">
                          {item.title}
                        </span>
                        {item.sku && (
                          <span className="text-[10px] font-mono text-slate-500">
                            ({item.sku})
                          </span>
                        )}
                      </div>

                      {item.error_message ? (
                        <p className="text-[11px] text-rose-600 font-medium mt-1">
                          ⚠️ {item.error_message}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Verified &amp; live in catalog
                        </p>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        item.status === "qc_pass"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {item.status === "qc_pass" ? "QC Pass" : "QC Error"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
