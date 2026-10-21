import { useState } from "react";
import type { Category } from "@urbanrat/shared";
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import { CategoryCascader } from "./CategoryCascader";
import { downloadCatalogTemplate } from "../utils/templateGenerator";
import { parseCatalogCSV } from "../utils/catalogParser";
import {
  saveProductMetadata,
  adminSaveProductTiers,
} from "../../../lib/adminService";
import { supabase } from "../../../lib/supabase";
import { triggerHaptic } from "../../../utils/haptics";
import type { BulkCatalogParsedRow } from "../types";

interface BulkCatalogModalProps {
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (uploadId: string) => void;
}

export function BulkCatalogModal({
  categories,
  isOpen,
  onClose,
  onSuccess,
}: BulkCatalogModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryBreadcrumb, setCategoryBreadcrumb] = useState<string>("");

  // Staged File & Parsed Rows
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BulkCatalogParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  if (!isOpen) return null;

  function handleSelectCategory(cat: Category, fullPath: string) {
    setSelectedCategory(cat);
    setCategoryBreadcrumb(fullPath);
    setCsvFile(null);
    setParsedRows([]);
    setParseError(null);
  }

  function handleDownloadTemplate() {
    if (!selectedCategory) return;
    triggerHaptic("selection");
    downloadCatalogTemplate(selectedCategory, categoryBreadcrumb);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setParsing(true);
    setParseError(null);

    try {
      const text = await file.text();
      const rows = parseCatalogCSV(text);
      setParsedRows(rows);
      triggerHaptic("success");
    } catch (err: any) {
      setParseError(err.message || "Failed to parse CSV file. Ensure standard formatting.");
      setParsedRows([]);
    } finally {
      setParsing(false);
    }
  }

  async function handleBatchSubmit() {
    if (!selectedCategory || parsedRows.length === 0) return;

    setProcessing(true);
    setProcessedCount(0);
    triggerHaptic("selection");

    const validRows = parsedRows.filter((r) => r.isValid);
    const failedRows = parsedRows.filter((r) => !r.isValid);

    const uploadId = `CAT-BULK-${Date.now().toString(36).toUpperCase()}`;
    const overallStatus =
      failedRows.length === 0
        ? "qc_pass"
        : validRows.length === 0
        ? "qc_error"
        : "action_required";

    try {
      // 1. Create Catalog Upload Entry
      await supabase.from("catalog_uploads").insert({
        id: uploadId,
        upload_type: "bulk",
        category_id: selectedCategory.id,
        category_path: categoryBreadcrumb,
        file_name: csvFile?.name || "bulk_upload.csv",
        total_items: parsedRows.length,
        passed_items: validRows.length,
        failed_items: failedRows.length,
        status: overallStatus,
        notes: `Bulk upload for category "${selectedCategory.name}". ${validRows.length} passed, ${failedRows.length} flagged.`,
      });

      // 2. Process Valid Rows & Insert Products
      let completed = 0;
      for (const row of validRows) {
        try {
          const generatedSlug = `${row.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}-${Date.now().toString(36).substring(4)}-${row.rowNumber}`;

          // Create Product Metadata
          const createdProduct = await saveProductMetadata({
            name: row.name,
            slug: generatedSlug,
            sku: row.sku || `URT-${Date.now().toString(36).toUpperCase()}-${row.rowNumber}`,
            category_id: selectedCategory.id,
            price: row.price,
            mrp: row.mrp || undefined,
            stock: row.stock,
            min_order_qty: row.minOrderQty,
            description: row.description || "",
            images: row.images,
            specs: row.specs || {},
            is_urbanrat_brand: true,
            is_active: true,
          });

          // Save Price Tiers
          if (row.tiers && row.tiers.length > 0) {
            await adminSaveProductTiers(createdProduct.id, row.tiers);
          }

          // Record Success Item
          await supabase.from("catalog_upload_items").insert({
            upload_id: uploadId,
            row_number: row.rowNumber,
            title: row.name,
            sku: row.sku,
            status: "qc_pass",
            product_id: createdProduct.id,
            payload: { ...row },
          });
        } catch (itemErr: any) {
          console.error(`Row ${row.rowNumber} failed:`, itemErr);
          await supabase.from("catalog_upload_items").insert({
            upload_id: uploadId,
            row_number: row.rowNumber,
            title: row.name,
            sku: row.sku,
            status: "qc_error",
            error_message: itemErr.message || "Database insert error",
            payload: { ...row },
          });
        }

        completed++;
        setProcessedCount(completed);
      }

      // 3. Log Invalid Rows
      for (const fRow of failedRows) {
        await supabase.from("catalog_upload_items").insert({
          upload_id: uploadId,
          row_number: fRow.rowNumber,
          title: fRow.name || `Row #${fRow.rowNumber}`,
          sku: fRow.sku,
          status: "qc_error",
          error_message: fRow.errors.join("; "),
          payload: { ...fRow },
        });
      }

      triggerHaptic("success");
      onSuccess(uploadId);
    } catch (err: any) {
      console.error("Batch upload transaction failed:", err);
      setParseError(err.message || "Bulk catalog upload process encountered an error.");
    } finally {
      setProcessing(false);
    }
  }

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-dark text-white flex items-center justify-center shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Bulk Catalog Upload (Category-Wise)
              </h3>
              <p className="text-xs text-slate-400">
                Download prefilled category template, populate items, and verify in bulk
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Step 1: Category Picker */}
          {!selectedCategory ? (
            <div className="space-y-4">
              <div className="bg-brand-light/10 border border-brand-light/30 rounded-2xl p-4 flex items-start space-x-3">
                <Info className="w-5 h-5 text-brand-dark shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-slate-900">
                    Bulk uploads are strictly category-wise:
                  </p>
                  <p className="text-slate-500">
                    Select the target terminal category (L1 through L4) first. The generated CSV template will be formatted with exact attributes and tier schemas for that category.
                  </p>
                </div>
              </div>

              <CategoryCascader
                categories={categories}
                selectedCategoryId={null}
                onSelectCategory={handleSelectCategory}
                actionButtonLabel="Use Selected Category for Bulk Upload"
              />
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* Selected Category Banner */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Target Category for Bulk Upload
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                    {categoryBreadcrumb}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(null)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Change Category
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-3.5 py-1.5 rounded-xl brand-gradient text-white text-xs font-bold flex items-center space-x-1.5 shadow-2xs hover:opacity-95 cursor-pointer active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV Template</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 bg-slate-50/50 hover:bg-slate-50 transition text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 mx-auto flex items-center justify-center text-brand-dark shadow-2xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {csvFile ? csvFile.name : "Select or drag & drop completed CSV template"}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Standard CSV format with product name, SKU, price, stock, and tiers
                  </p>
                </div>

                <label className="inline-flex px-5 py-2.5 rounded-xl brand-gradient text-white text-xs font-bold shadow-md hover:shadow-lg transition-all items-center space-x-2 cursor-pointer active:scale-95">
                  {parsing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validating CSV Rows...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>{csvFile ? "Choose Different CSV" : "Browse CSV File"}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".csv, text/csv, text/plain"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {parseError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Parsed Results Overview */}
              {parsedRows.length > 0 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Total Rows
                      </span>
                      <span className="text-lg font-black text-slate-900 block mt-0.5">
                        {parsedRows.length}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                        Valid &amp; Ready (QC Pass)
                      </span>
                      <span className="text-lg font-black text-emerald-800 block mt-0.5">
                        {validCount}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
                        Action Required (Errors)
                      </span>
                      <span className="text-lg font-black text-rose-800 block mt-0.5">
                        {invalidCount}
                      </span>
                    </div>
                  </div>

                  {/* Row Validation List preview */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {parsedRows.map((r) => (
                      <div
                        key={r.rowNumber}
                        className={`p-3 flex items-start justify-between gap-3 ${
                          r.isValid ? "hover:bg-slate-50" : "bg-rose-50/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold text-slate-400">
                              #{r.rowNumber}
                            </span>
                            <span className="font-bold text-slate-900 truncate">
                              {r.name || "Untitled Product"}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {r.sku}
                            </span>
                          </div>

                          {r.errors.length > 0 ? (
                            <p className="text-[11px] text-rose-600 mt-1 font-medium">
                              ⚠️ {r.errors.join("; ")}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-1">
                              ₹{r.price} • Stock: {r.stock} • Tiers: {r.tiers.length}
                            </p>
                          )}
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            r.isValid
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {r.isValid ? "QC Ready" : "Error"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Submission CTA */}
                  <button
                    type="button"
                    disabled={processing || validCount === 0}
                    onClick={handleBatchSubmit}
                    className="w-full py-3.5 rounded-2xl brand-gradient text-white font-extrabold text-sm shadow-md hover:shadow-xl transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          Uploading Catalog... ({processedCount}/{validCount})
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          Upload &amp; Publish {validCount} Products
                          {invalidCount > 0 ? ` (${invalidCount} flagged rows will be logged)` : ""}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
