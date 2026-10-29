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
  Palette,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { saveProductMetadata } from "../../../lib/adminService";
import { triggerHaptic } from "../../../utils/haptics";
import { KeywordsInput } from "./KeywordsInput";
import { getColorHex, POPULAR_COLOR_PRESETS } from "@urbanrat/shared";
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
  const [fixSlug, setFixSlug] = useState("");
  const [fixPrice, setFixPrice] = useState<number | "">("");
  const [fixMrp, setFixMrp] = useState<number | "">("");
  const [fixStock, setFixStock] = useState<number | "">("");
  const [fixMoq, setFixMoq] = useState<number>(1);
  const [fixOrderStep, setFixOrderStep] = useState<number>(1);
  const [fixLowStock, setFixLowStock] = useState<number>(5);
  const [fixTagline, setFixTagline] = useState("");
  const [fixDescription, setFixDescription] = useState("");
  const [fixBrand, setFixBrand] = useState("");
  const [fixCompatibility, setFixCompatibility] = useState("");
  const [fixIsUrbanrat, setFixIsUrbanrat] = useState(true);
  const [fixIsFeatured, setFixIsFeatured] = useState(false);
  const [fixIsTrending, setFixIsTrending] = useState(false);
  const [fixIsActive, setFixIsActive] = useState(true);
  const [fixKeywords, setFixKeywords] = useState<string[]>([]);
  const [fixImages, setFixImages] = useState<string[]>([]);
  const [fixHasColors, setFixHasColors] = useState(false);
  const [fixColors, setFixColors] = useState<string[]>([]);
  const [fixColorInput, setFixColorInput] = useState("");
  const [fixSaving, setFixSaving] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);

  function handleAddFixColor(colorToAdd?: string) {
    const trimmed = (colorToAdd || fixColorInput).trim();
    if (!trimmed) return;
    if (fixColors.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setFixColorInput("");
      return;
    }
    setFixColors([...fixColors, trimmed]);
    setFixHasColors(true);
    setFixColorInput("");
  }

  function handleRemoveFixColor(idxToRemove: number) {
    setFixColors(fixColors.filter((_, idx) => idx !== idxToRemove));
  }

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
    const p = item.payload || {};
    setFixTitle(item.title || p.name || "");
    setFixSku(item.sku || p.sku || "");
    setFixSlug(p.slug || "");
    setFixPrice(p.price ?? 100);
    setFixMrp(p.mrp ?? "");
    setFixStock(p.stock ?? 10);
    setFixMoq(p.min_order_qty || p.minOrderQty || 1);
    setFixOrderStep(p.order_qty_step || p.orderQtyStep || 1);
    setFixLowStock(p.low_stock_threshold || p.lowStockThreshold || 5);
    setFixTagline(p.tagline || p.short_description || "");
    setFixDescription(p.description || "");
    setFixBrand(p.brand || "");
    setFixCompatibility(p.attributes?.compatibility_group || "");
    setFixIsUrbanrat(p.is_urbanrat_brand !== undefined ? Boolean(p.is_urbanrat_brand) : true);
    setFixIsFeatured(Boolean(p.is_featured || p.isFeatured));
    setFixIsTrending(Boolean(p.is_trending || p.isTrending));
    setFixIsActive(p.is_active !== undefined ? Boolean(p.is_active) : true);
    setFixKeywords(p.keywords || []);
    setFixImages(p.images || []);
    const hasCol = p.hasColors !== undefined ? Boolean(p.hasColors) : Boolean(p.specs?.has_colors || p.attributes?.has_colors);
    const colList = p.colors || p.specs?.colors || p.attributes?.colors || [];
    setFixHasColors(hasCol);
    setFixColors(Array.isArray(colList) ? colList : []);
    setFixColorInput("");
    setFixError(null);
    triggerHaptic("selection");
  }

  async function handleSaveFix(e: React.FormEvent) {
    e.preventDefault();
    if (!fixingItem || !upload) return;

    setFixSaving(true);
    setFixError(null);

    try {
      const slug =
        fixSlug.trim() ||
        `${fixTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}-${Date.now().toString(36).substring(4)}`;

      const specsObj = {
        ...(fixingItem.payload?.specs || {}),
        has_colors: fixHasColors,
        colors: fixHasColors ? fixColors : [],
      };

      // 1. Save or update product metadata
      const createdProduct = await saveProductMetadata({
        id: fixingItem.product_id || undefined,
        name: fixTitle.trim(),
        slug,
        sku: fixSku.trim() || undefined,
        category_id: upload.category_id || undefined,
        price: Number(fixPrice) || 0,
        mrp: fixMrp !== "" ? Number(fixMrp) : undefined,
        stock: Number(fixStock) || 0,
        min_order_qty: fixMoq,
        order_qty_step: fixOrderStep,
        low_stock_threshold: fixLowStock,
        short_description: fixTagline.trim(),
        description: fixDescription.trim(),
        brand: fixBrand.trim() || undefined,
        attributes: {
          ...(fixCompatibility.trim() ? { compatibility_group: fixCompatibility.trim() } : {}),
          has_colors: fixHasColors,
          colors: fixHasColors ? fixColors : [],
        },
        keywords: fixKeywords,
        images: fixImages,
        specs: specsObj,
        is_urbanrat_brand: fixIsUrbanrat,
        is_featured: fixIsFeatured,
        is_trending: fixIsTrending,
        is_active: fixIsActive,
      });

      // 2. Update catalog_upload_items
      const updatedPayload = {
        ...(fixingItem.payload || {}),
        name: fixTitle.trim(),
        sku: fixSku.trim(),
        hasColors: fixHasColors,
        colors: fixHasColors ? fixColors : [],
        specs: specsObj,
        slug,
        price: Number(fixPrice) || 0,
        mrp: fixMrp !== "" ? Number(fixMrp) : null,
        stock: Number(fixStock) || 0,
        min_order_qty: fixMoq,
        order_qty_step: fixOrderStep,
        low_stock_threshold: fixLowStock,
        tagline: fixTagline.trim(),
        description: fixDescription.trim(),
        brand: fixBrand.trim(),
        attributes: fixCompatibility.trim() ? { compatibility_group: fixCompatibility.trim() } : {},
        keywords: fixKeywords,
        images: fixImages,
        is_urbanrat_brand: fixIsUrbanrat,
        is_featured: fixIsFeatured,
        is_trending: fixIsTrending,
        is_active: fixIsActive,
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
                      URL Slug
                    </label>
                    <input
                      type="text"
                      value={fixSlug}
                      onChange={(e) => setFixSlug(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Wholesale Price (₹)*
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="any"
                      value={fixPrice}
                      onChange={(e) => setFixPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      MRP (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={fixMrp}
                      onChange={(e) => setFixMrp(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Stock
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={fixStock}
                      onChange={(e) => setFixStock(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Min Order
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={fixMoq}
                      onChange={(e) => setFixMoq(Number(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Low Stock Alert
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={fixLowStock}
                      onChange={(e) => setFixLowStock(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Brand
                    </label>
                    <input
                      type="text"
                      value={fixBrand}
                      onChange={(e) => setFixBrand(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Compatibility Group
                    </label>
                    <input
                      type="text"
                      value={fixCompatibility}
                      onChange={(e) => setFixCompatibility(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Short Tagline
                  </label>
                  <input
                    type="text"
                    value={fixTagline}
                    onChange={(e) => setFixTagline(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Detailed Description
                  </label>
                  <textarea
                    rows={3}
                    value={fixDescription}
                    onChange={(e) => setFixDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                  />
                </div>

                {/* Flags */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center space-x-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={fixIsUrbanrat}
                      onChange={(e) => setFixIsUrbanrat(e.target.checked)}
                      className="rounded accent-slate-900"
                    />
                    <span className="font-semibold text-slate-800">Urbanrat Brand</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={fixIsActive}
                      onChange={(e) => setFixIsActive(e.target.checked)}
                      className="rounded accent-slate-900"
                    />
                    <span className="font-semibold text-slate-800">Active</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={fixIsFeatured}
                      onChange={(e) => setFixIsFeatured(e.target.checked)}
                      className="rounded accent-slate-900"
                    />
                    <span className="font-semibold text-slate-800">Featured</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={fixIsTrending}
                      onChange={(e) => setFixIsTrending(e.target.checked)}
                      className="rounded accent-slate-900"
                    />
                    <span className="font-semibold text-slate-800">Trending</span>
                  </label>
                </div>

                {/* Color Variants Option */}
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <Palette className="w-3.5 h-3.5 text-brand-dark" />
                      <span>Color Selection</span>
                    </span>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fixHasColors}
                        onChange={(e) => setFixHasColors(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900" />
                      <span className="ml-2 text-xs font-bold text-slate-700">
                        {fixHasColors ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>

                  {fixHasColors && (
                    <div className="space-y-2 pt-1 border-t border-slate-200/60">
                      {fixColors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {fixColors.map((c, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                                style={{ backgroundColor: getColorHex(c) }}
                              />
                              <span>{c}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFixColor(idx)}
                                className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={fixColorInput}
                          onChange={(e) => setFixColorInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddFixColor();
                            }
                          }}
                          placeholder="Add color (e.g. Jet Black, Forest Emerald)..."
                          className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddFixColor()}
                          disabled={!fixColorInput.trim()}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {POPULAR_COLOR_PRESETS.slice(0, 6).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleAddFixColor(preset)}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-slate-200 hover:border-brand text-slate-700 cursor-pointer"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
