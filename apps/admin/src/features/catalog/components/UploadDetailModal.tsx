import { useState, useEffect } from "react";
import {
  X,
  FileSpreadsheet,
  Layers,
  Calendar,
  Loader2,
  Wrench,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { saveProductMetadata } from "../../../lib/adminService";
import { triggerHaptic } from "../../../utils/haptics";
import { KeywordsInput } from "./KeywordsInput";
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

  // Error-fix drawer state
  const [fixingItem, setFixingItem] = useState<CatalogUploadItem | null>(null);
  const [fixTitle, setFixTitle] = useState("");
  const [fixSku, setFixSku] = useState("");
  const [fixPrice, setFixPrice] = useState<number | "">("");
  const [fixStock, setFixStock] = useState<number | "">("");
  const [fixKeywords, setFixKeywords] = useState<string[]>([]);
  const [fixSaving, setFixSaving] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);

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

  const passedCount = items.filter((i) => i.status === "qc_pass").length;
  const failedCount = items.filter((i) => i.status !== "qc_pass").length;
  const successPercent =
    items.length > 0 ? Math.round((passedCount / items.length) * 100) : 0;

  function startFixItem(item: CatalogUploadItem) {
    setFixingItem(item);
    setFixTitle(item.title || item.payload?.name || "");
    setFixSku(item.sku || item.payload?.sku || "");
    setFixPrice(item.payload?.price ?? 100);
    setFixStock(item.payload?.stock ?? 10);
    setFixKeywords(item.payload?.keywords || []);
    setFixError(null);
    triggerHaptic("selection");
  }

  async function handleSaveFix(e: React.FormEvent) {
    e.preventDefault();
    if (!fixingItem || !upload) return;

    setFixSaving(true);
    setFixError(null);

    try {
      const slug = `${fixTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${Date.now().toString(36).substring(4)}`;

      // 1. Save or update product metadata
      const createdProduct = await saveProductMetadata({
        id: fixingItem.product_id || undefined,
        name: fixTitle.trim(),
        slug,
        sku: fixSku.trim() || undefined,
        category_id: upload.category_id || undefined,
        price: Number(fixPrice) || 0,
        stock: Number(fixStock) || 0,
        keywords: fixKeywords,
        is_urbanrat_brand: true,
        is_active: true,
      });

      // 2. Update catalog_upload_items
      const updatedPayload = {
        ...(fixingItem.payload || {}),
        name: fixTitle.trim(),
        sku: fixSku.trim(),
        price: Number(fixPrice) || 0,
        stock: Number(fixStock) || 0,
        keywords: fixKeywords,
      };

      const { error: updateErr } = await supabase
        .from("catalog_upload_items")
        .update({
          status: "qc_pass",
          error_message: null,
          product_id: createdProduct.id,
          title: fixTitle.trim(),
          sku: fixSku.trim(),
          payload: updatedPayload,
        })
        .eq("id", fixingItem.id);

      if (updateErr) throw updateErr;

      // 3. Update local state
      setItems((prev) =>
        prev.map((it) =>
          it.id === fixingItem.id
            ? {
                ...it,
                status: "qc_pass",
                error_message: null,
                product_id: createdProduct.id,
                title: fixTitle.trim(),
                sku: fixSku.trim(),
                payload: updatedPayload,
              }
            : it
        )
      );

      triggerHaptic("success");
      setFixingItem(null);
    } catch (err: any) {
      console.error("Failed to fix item:", err);
      setFixError(err.message || "Failed to save item fix.");
    } finally {
      setFixSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden relative">
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
                    failedCount === 0
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}
                >
                  {failedCount === 0 ? "QC Pass" : `${failedCount} Errors`}
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
                {items.length || upload.total_items}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                QC Passed
              </span>
              <span className="text-lg font-black text-emerald-800 block mt-0.5">
                {passedCount}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
                Action Required
              </span>
              <span className="text-lg font-black text-rose-800 block mt-0.5">
                {failedCount}
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

          {/* Category Path */}
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
                    <div className="min-w-0 flex-1">
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

                      {/* Display keywords tags if present */}
                      {item.payload?.keywords && item.payload.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.payload.keywords.slice(0, 4).map((kw: string, ki: number) => (
                            <span
                              key={ki}
                              className="px-1.5 py-0.2 rounded bg-brand-light/15 text-brand-dark text-[10px] font-medium"
                            >
                              #{kw}
                            </span>
                          ))}
                          {item.payload.keywords.length > 4 && (
                            <span className="text-[10px] text-slate-400 self-center">
                              +{item.payload.keywords.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {item.status !== "qc_pass" && (
                        <button
                          type="button"
                          onClick={() => startFixItem(item)}
                          className="px-2.5 py-1 rounded-xl brand-gradient text-white font-bold text-[11px] shadow-2xs hover:shadow-xs flex items-center space-x-1 cursor-pointer active:scale-95 transition"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Fix Issue</span>
                        </button>
                      )}

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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Slide-over Error-Fix Drawer ── */}
        {fixingItem && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-20 animate-fade-in">
            <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-slate-200 overflow-hidden animate-slide-left">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-dark text-white flex items-center justify-center">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      Fix Catalog Item #{fixingItem.row_number}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Correct flagged values and search keywords
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFixingItem(null)}
                  className="w-7 h-7 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveFix} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {fixingItem.error_message && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Flagged Error:</span>
                      <span>{fixingItem.error_message}</span>
                    </div>
                  </div>
                )}

                {fixError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{fixError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Title*
                  </label>
                  <input
                    type="text"
                    required
                    value={fixTitle}
                    onChange={(e) => setFixTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      SKU
                    </label>
                    <input
                      type="text"
                      value={fixSku}
                      onChange={(e) => setFixSku(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Wholesale Price (₹)*
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={fixPrice}
                      onChange={(e) => setFixPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={fixStock}
                    onChange={(e) => setFixStock(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                  />
                </div>

                {/* Reusable KeywordsInput in Error-Fix Drawer */}
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200">
                  <KeywordsInput
                    value={fixKeywords}
                    onChange={setFixKeywords}
                    label="Search Keywords"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={fixSaving}
                    className="w-full py-3 rounded-xl brand-gradient text-white font-extrabold text-xs shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {fixSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying &amp; Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Save &amp; Mark QC Pass</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
