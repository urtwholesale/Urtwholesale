import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Boxes,
  Plus,
  Minus,
  Hash,
  AlertOctagon,
  Download,
  Upload,
  FileSpreadsheet,
  X,
  AlertCircle,
  FileText,
} from "lucide-react";
import type { BulkStockMode, BulkStockItemPayload } from "@urbanrat/shared";
import { BulkPreviewPanel } from "./BulkPreviewPanel";
import { bulkAdjustStock } from "../../../lib/adminService";
import { supabase } from "../../../lib/supabase";
import { triggerHaptic } from "../../../utils/haptics";

export interface BulkStockTabProps {
  productIds: string[];
  scopeLabel: string;
  onSuccess: (result: { applied: number; skipped: number; opIds: string[] }) => void;
  onCancel?: () => void;
}

type StockSource = "manual" | "sheet";

const QUICK_REASON_CHIPS = ["Restock", "Damaged", "Audit correction"];

export function BulkStockTab({
  productIds,
  scopeLabel,
  onSuccess,
  onCancel,
}: BulkStockTabProps) {
  const [source, setSource] = useState<StockSource>("manual");
  const [mode, setMode] = useState<BulkStockMode>("add");
  const [qty, setQty] = useState<number>(10);
  const [reason, setReason] = useState<string>("");

  // Sheet upload state
  const [sheetFileName, setSheetFileName] = useState<string | null>(null);
  const [sheetItems, setSheetItems] = useState<BulkStockItemPayload[] | null>(null);
  const [sheetErrors, setSheetErrors] = useState<string[]>([]);
  const [isProcessingSheet, setIsProcessingSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download stock sheet (.xlsx) for selected products
  async function handleDownloadTemplate() {
    triggerHaptic("selection");
    try {
      const { data: prods, error } = await supabase
        .from("products")
        .select("id, name, sku, stock")
        .in("id", productIds);

      if (error) throw error;

      const rows = (prods || []).map((p) => ({
        SKU: p.sku || "",
        "Product Name": p.name || "",
        "Current Stock": p.stock || 0,
        "New Stock": "",
        Reason: "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stock Update");
      XLSX.writeFile(wb, `stock_sheet_${productIds.length}_products.xlsx`);
      triggerHaptic("success");
    } catch (err: any) {
      console.error("Failed to download template:", err);
      alert("Failed to export template: " + (err.message || "Unknown error"));
    }
  }

  // Handle Sheet Upload (.xlsx / .csv, max 5 MB, 5000 rows)
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    // Size limit: 5 MB
    if (file.size > 5 * 1024 * 1024) {
      setSheetErrors(["File size exceeds the 5 MB limit."]);
      return;
    }

    setIsProcessingSheet(true);
    setSheetErrors([]);
    triggerHaptic("selection");

    try {
      // 1. Fetch current selected products for SKU matching
      const { data: prods, error: pErr } = await supabase
        .from("products")
        .select("id, name, sku, stock")
        .in("id", productIds);

      if (pErr) throw pErr;

      const skuToProdMap = new Map<string, { id: string; name: string; stock: number }>();
      for (const p of prods || []) {
        if (p.sku) {
          skuToProdMap.set(p.sku.trim().toUpperCase(), {
            id: p.id,
            name: p.name,
            stock: p.stock || 0,
          });
        }
      }

      // 2. Read spreadsheet
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("Spreadsheet contains no sheets.");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      if (!worksheet) {
        throw new Error("Could not read worksheet from file.");
      }
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (jsonRows.length === 0) {
        throw new Error("Spreadsheet is empty.");
      }

      if (jsonRows.length > 5000) {
        throw new Error(`Spreadsheet contains ${jsonRows.length} rows (maximum allowed is 5000).`);
      }

      // 3. Parse and validate rows
      const parsedItems: BulkStockItemPayload[] = [];
      const errors: string[] = [];
      const seenSkus = new Set<string>();

      jsonRows.forEach((row, idx) => {
        const rowNum = idx + 2; // header is row 1
        // Look for SKU
        const rawSku = String(row["SKU"] || row["sku"] || row["Sku"] || "").trim();
        if (!rawSku) {
          errors.push(`Row ${rowNum}: SKU is missing.`);
          return;
        }

        const upperSku = rawSku.toUpperCase();
        if (seenSkus.has(upperSku)) {
          errors.push(`Row ${rowNum}: Duplicate SKU "${rawSku}" in uploaded sheet.`);
          return;
        }
        seenSkus.add(upperSku);

        const prod = skuToProdMap.get(upperSku);
        if (!prod) {
          errors.push(`Row ${rowNum}: SKU "${rawSku}" does not match any selected product.`);
          return;
        }

        // Check for New Stock or Delta
        const rawNewStock = row["New Stock"] ?? row["new_stock"] ?? row["NewStock"] ?? row["Stock"];
        const rawDelta = row["Delta"] ?? row["delta"] ?? row["Change"];
        const rowReason = String(row["Reason"] || row["reason"] || "").trim();

        if (rawNewStock !== undefined && String(rawNewStock).trim() !== "") {
          const parsed = Number(rawNewStock);
          if (isNaN(parsed) || parsed < 0) {
            errors.push(`Row ${rowNum} (${rawSku}): Invalid New Stock value "${rawNewStock}". Must be >= 0.`);
            return;
          }
          parsedItems.push({
            product_id: prod.id,
            mode: "set",
            qty: Math.round(parsed),
            reason: rowReason || undefined,
          });
        } else if (rawDelta !== undefined && String(rawDelta).trim() !== "") {
          const parsed = Number(rawDelta);
          if (isNaN(parsed)) {
            errors.push(`Row ${rowNum} (${rawSku}): Invalid Delta value "${rawDelta}". Must be a valid number.`);
            return;
          }
          parsedItems.push({
            product_id: prod.id,
            mode: "delta",
            qty: Math.round(parsed),
            reason: rowReason || undefined,
          });
        } else {
          errors.push(`Row ${rowNum} (${rawSku}): Must provide either "New Stock" or "Delta".`);
        }
      });

      setSheetFileName(file.name);
      setSheetItems(parsedItems);
      setSheetErrors(errors);
      if (errors.length === 0) {
        triggerHaptic("success");
      } else {
        triggerHaptic("heavy");
      }
    } catch (err: any) {
      console.error("Sheet parsing failed:", err);
      setSheetErrors([err.message || "Failed to parse spreadsheet."]);
      triggerHaptic("heavy");
    } finally {
      setIsProcessingSheet(false);
    }
  }

  // Clear uploaded sheet
  function handleClearSheet() {
    setSheetFileName(null);
    setSheetItems(null);
    setSheetErrors([]);
    triggerHaptic("selection");
  }

  // Validation
  const isReasonValid = reason.trim().length > 0;
  const isQtyValid = mode === "zero" || qty > 0;
  const isManualValid = isReasonValid && isQtyValid;
  const isSheetValid =
    sheetItems !== null &&
    sheetItems.length > 0 &&
    (isReasonValid || sheetItems.every((item) => item.reason && item.reason.trim().length > 0));

  const isValidToPreview = source === "manual" ? isManualValid : isSheetValid;

  let validationError: string | null = null;
  if (source === "manual") {
    if (!isReasonValid) {
      validationError = "An adjustment reason is required for the inventory audit trail.";
    } else if (!isQtyValid) {
      validationError = "Quantity must be greater than 0.";
    }
  } else {
    if (!sheetItems) {
      validationError = "Upload a valid .xlsx or .csv stock sheet to proceed.";
    } else if (!isSheetValid && !isReasonValid) {
      validationError = "Some rows in the sheet lack a reason. Enter a default adjustment reason above.";
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Sub-Source Switcher (Manual Adjustment vs Sheet Upload) ── */}
      <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setSource("manual");
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
            source === "manual"
              ? "bg-white text-brand-dark shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Adjustment Rule</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setSource("sheet");
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
            source === "sheet"
              ? "bg-white text-brand-dark shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Update from Sheet</span>
        </button>
      </div>

      {/* ── SOURCE 1: MANUAL ADJUSTMENT ── */}
      {source === "manual" && (
        <div className="space-y-5 bg-slate-50/70 p-4 sm:p-5 rounded-3xl border border-slate-200">
          <div>
            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">
              Adjustment Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "add" as BulkStockMode, label: "Add (+)", icon: Plus },
                { id: "subtract" as BulkStockMode, label: "Subtract (-)", icon: Minus },
                { id: "set" as BulkStockMode, label: "Set Quantity", icon: Hash },
                { id: "zero" as BulkStockMode, label: "Set to Zero", icon: AlertOctagon },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      setMode(m.id);
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between space-y-1.5 ${
                      isSelected
                        ? "bg-white border-brand-dark shadow-xs ring-1 ring-brand-dark/20"
                        : "bg-white/70 border-slate-200 hover:bg-white text-slate-700"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isSelected
                          ? m.id === "zero"
                            ? "text-rose-600"
                            : "text-brand-dark"
                          : "text-slate-400"
                      }`}
                    />
                    <span className="text-xs font-bold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity Input (Hidden / Disabled if Set to Zero) */}
          {mode !== "zero" ? (
            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Quantity Units
              </label>
              <div className="relative max-w-xs">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-light/50"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
              <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600" />
              <span>All {productIds.length} selected products will be set to 0 stock (Out of Stock).</span>
            </div>
          )}
        </div>
      )}

      {/* ── SOURCE 2: UPDATE FROM SHEET ── */}
      {source === "sheet" && (
        <div className="space-y-4 bg-slate-50/70 p-4 sm:p-5 rounded-3xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Spreadsheet Batch Update
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Download a pre-filled sheet for your selection, fill in New Stock or Delta, and re-upload.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download stock sheet (.xlsx)</span>
            </button>
          </div>

          {/* Upload Drop Zone */}
          <div className="p-5 rounded-2xl border-2 border-dashed border-slate-200 bg-white text-center space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-brand-dark flex items-center justify-center mx-auto">
              <Upload className="w-5 h-5" />
            </div>

            <div>
              <button
                type="button"
                disabled={isProcessingSheet}
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-extrabold text-brand-dark hover:underline cursor-pointer disabled:opacity-50"
              >
                {isProcessingSheet ? "Parsing spreadsheet..." : "Choose Excel (.xlsx) or CSV file"}
              </button>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Max 5 MB &bull; Up to 5,000 rows &bull; Matches by product SKU
              </p>
            </div>
          </div>

          {/* Uploaded File Info Card */}
          {sheetFileName && (
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{sheetFileName}</p>
                  <p className="text-[11px] text-slate-500">
                    {sheetItems?.length || 0} valid stock row(s) mapped
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearSheet}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Row Diagnostics / Errors */}
          {sheetErrors.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1.5 text-xs max-h-40 overflow-y-auto custom-scrollbar">
              <div className="flex items-center space-x-1.5 font-bold text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Spreadsheet row errors ({sheetErrors.length}):</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700">
                {sheetErrors.slice(0, 10).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
                {sheetErrors.length > 10 && (
                  <li className="font-bold">...and {sheetErrors.length - 10} more errors</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── REQUIRED ADJUSTMENT REASON FIELD & CHIPS ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Adjustment Reason <span className="text-rose-500">*</span>
          </label>
          <span className="text-[11px] text-slate-400">Required for audit trail</span>
        </div>

        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Warehouse batch arrival #402"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-light/50"
        />

        {/* Quick Reason Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Quick reasons:</span>
          {QUICK_REASON_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setReason(chip);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                reason === chip
                  ? "bg-brand-dark text-white shadow-2xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* ── DRY RUN PREVIEW & APPLY PANEL ── */}
      <BulkPreviewPanel
        productIds={productIds}
        scopeLabel={scopeLabel}
        isDestructive={mode === "zero"}
        destructiveReason="Setting inventory to zero immediately marks items as out-of-stock."
        isValidToPreview={isValidToPreview}
        validationError={validationError}
        onRunPreview={async () => {
          if (source === "sheet" && sheetItems) {
            return await bulkAdjustStock(
              productIds,
              "sheet",
              0,
              reason,
              true,
              sheetItems
            );
          }
          return await bulkAdjustStock(productIds, mode, qty, reason, true);
        }}
        onApplyChunk={async (chunkIds) => {
          if (source === "sheet" && sheetItems) {
            const chunkItems = sheetItems.filter((item) => chunkIds.includes(item.product_id));
            return await bulkAdjustStock(
              chunkIds,
              "sheet",
              0,
              reason,
              false,
              chunkItems
            );
          }
          return await bulkAdjustStock(chunkIds, mode, qty, reason, false);
        }}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </div>
  );
}
