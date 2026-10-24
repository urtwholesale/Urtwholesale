import { useState } from "react";
import type { Category } from "@urbanrat/shared";
import {
  parseSkuFromFilename,
  CANONICAL_FIELD_OPTIONS,
  resolveCanonicalHeader,
} from "@urbanrat/shared";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  ImageIcon,
  Sparkles,
  Wand2,
  AlertTriangle,
  SlidersHorizontal,
} from "lucide-react";
import { CategoryCascader } from "./CategoryCascader";
import {
  downloadCatalogTemplate,
  downloadPrefilledTemplate,
} from "../utils/templateGenerator";
import {
  parseCatalogUploadedFileWithReport,
  revalidateRow,
  validateUploadedImageLinks,
} from "../utils/catalogParser";
import { KeywordsInput } from "./KeywordsInput";
import {
  saveProductMetadata,
  adminSaveProductTiers,
  fetchCatalogImages,
} from "../../../lib/adminService";
import { supabase } from "../../../lib/supabase";
import { triggerHaptic } from "../../../utils/haptics";
import type { BulkCatalogParsedRow } from "../types";
import { ImagePickerModal } from "../images/ImagePickerModal";

interface BulkCatalogModalProps {
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (uploadId: string) => void;
}

interface ImportReportData {
  uploadId: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  ignoredColumns: string[];
  fieldStats: {
    field: string;
    filled: number;
    empty: number;
  }[];
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
  const [ignoredColumns, setIgnoredColumns] = useState<string[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [customMappings, setCustomMappings] = useState<Record<string, string>>({});
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [duplicateColumns, setDuplicateColumns] = useState<{ canonical: string; headers: string[] }[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Duplicate mode: "update" | "skip" | "stop"
  const [duplicateMode, setDuplicateMode] = useState<"update" | "skip" | "stop">("update");
  const [dbExistingSkus, setDbExistingSkus] = useState<Map<string, string>>(new Map());
  const [dbExistingSlugs, setDbExistingSlugs] = useState<Map<string, string>>(new Map());

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [editingRowNumber, setEditingRowNumber] = useState<number | null>(null);

  // Import Report state
  const [importReport, setImportReport] = useState<ImportReportData | null>(null);

  // Image Library integration state
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [downloadingPrefilled, setDownloadingPrefilled] = useState(false);
  const [autoAttaching, setAutoAttaching] = useState(false);

  if (!isOpen) return null;

  function handleSelectCategory(cat: Category, fullPath: string) {
    setSelectedCategory(cat);
    setCategoryBreadcrumb(fullPath);
    setCsvFile(null);
    setParsedRows([]);
    setIgnoredColumns([]);
    setRawHeaders([]);
    setCustomMappings({});
    setShowColumnMapper(false);
    setDuplicateColumns([]);
    setParseError(null);
    setEditingRowNumber(null);
    setImportReport(null);
  }

  function handleDownloadTemplate() {
    if (!selectedCategory) return;
    triggerHaptic("selection");
    downloadCatalogTemplate(selectedCategory, categoryBreadcrumb);
  }

  async function handleDownloadPrefilledTemplate() {
    if (!selectedCategory) return;
    setDownloadingPrefilled(true);
    triggerHaptic("selection");
    try {
      const { data } = await fetchCatalogImages({ limit: 1000 });
      downloadPrefilledTemplate(selectedCategory, categoryBreadcrumb, data);
      triggerHaptic("success");
    } catch (err: any) {
      console.error("Failed to download prefilled template:", err);
    } finally {
      setDownloadingPrefilled(false);
    }
  }

  async function handleAutoAttachImages() {
    setAutoAttaching(true);
    triggerHaptic("selection");
    try {
      const { data: libraryImages } = await fetchCatalogImages({ limit: 1000 });
      const skuMap = new Map<string, string[]>();
      for (const img of libraryImages) {
        const sku = (img.sku_hint || parseSkuFromFilename(img.original_name).sku || "").trim().toUpperCase();
        if (sku) {
          const existing = skuMap.get(sku) || [];
          existing.push(img.public_url);
          skuMap.set(sku, existing);
        }
      }

      setParsedRows((prev) =>
        prev.map((r) => {
          if ((!r.images || r.images.length === 0) && r.sku) {
            const match = skuMap.get(r.sku.trim().toUpperCase());
            if (match && match.length > 0) {
              const updated = { ...r, images: match.slice(0, 5) };
              return revalidateRow(updated);
            }
          }
          return r;
        })
      );
      triggerHaptic("success");
    } catch (err) {
      console.error("Auto attach failed:", err);
    } finally {
      setAutoAttaching(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setParsing(true);
    setParseError(null);
    setEditingRowNumber(null);
    setImportReport(null);

    try {
      const res = await parseCatalogUploadedFileWithReport(file, customMappings);
      setIgnoredColumns(res.ignoredColumns);
      setRawHeaders(res.rawHeaders);
      setDuplicateColumns(res.duplicateColumns || []);
      if (res.ignoredColumns.length > 0) {
        setShowColumnMapper(true);
      }

      // Check DB for existing SKUs and Slugs to detect duplicates against active database
      const existingSkuMap = new Map<string, string>();
      const existingSlugMap = new Map<string, string>();

      try {
        const { data: dbProducts } = await supabase
          .from("products")
          .select("id, sku, slug");

        if (dbProducts) {
          for (const p of dbProducts) {
            if (p.sku) existingSkuMap.set(p.sku.trim().toLowerCase(), p.id);
            if (p.slug) existingSlugMap.set(p.slug.trim().toLowerCase(), p.id);
          }
        }
      } catch (dbErr) {
        console.warn("Could not pre-fetch products for duplicate check:", dbErr);
      }

      setDbExistingSkus(existingSkuMap);
      setDbExistingSlugs(existingSlugMap);

      // Validate image links & add DB duplicate notices if in "stop" mode
      const validatedRows = await validateUploadedImageLinks(res.rows);
      setParsedRows(validatedRows);
      triggerHaptic("success");
    } catch (err: any) {
      setParseError(err.message || "Failed to parse catalog file. Ensure standard formatting.");
      setParsedRows([]);
    } finally {
      setParsing(false);
    }
  }

  async function handleApplyCustomMapping(newMappings: Record<string, string>) {
    if (!csvFile) return;
    setParsing(true);
    setParseError(null);
    try {
      const res = await parseCatalogUploadedFileWithReport(csvFile, newMappings);
      setIgnoredColumns(res.ignoredColumns);
      setRawHeaders(res.rawHeaders);
      setDuplicateColumns(res.duplicateColumns || []);
      setCustomMappings(newMappings);
      const validatedRows = await validateUploadedImageLinks(res.rows);
      setParsedRows(validatedRows);
      triggerHaptic("success");
    } catch (err: any) {
      setParseError(err.message || "Failed to re-parse with column mappings.");
    } finally {
      setParsing(false);
    }
  }

  function reevaluateFileDuplicates(rows: BulkCatalogParsedRow[]): BulkCatalogParsedRow[] {
    const skuSeen = new Map<string, { rowNumber: number; name: string }>();
    const slugSeen = new Map<string, { rowNumber: number; name: string }>();

    return rows.map((r) => {
      const nonDupErrors = r.errors.filter(
        (e) => !e.toLowerCase().includes("duplicate sku") && !e.toLowerCase().includes("duplicate url slug")
      );
      const newErrors = [...nonDupErrors];
      let newSuggestedSku = r.suggestedSku;
      let newSuggestedSlug = r.suggestedSlug;

      if (r.sku) {
        const lowerSku = r.sku.toLowerCase();
        if (skuSeen.has(lowerSku)) {
          const prev = skuSeen.get(lowerSku)!;
          const hasPlusInName = r.name.includes("+");
          const prevHasPlusInName = prev.name.includes("+");
          const skuLacksPlus = !r.sku.toUpperCase().includes("PLUS");

          if ((hasPlusInName || prevHasPlusInName) && skuLacksPlus) {
            newSuggestedSku = `${r.sku.replace(/-+$/, "")}-PLUS`;
            if (r.slug && !r.slug.toLowerCase().includes("plus")) {
              newSuggestedSlug = `${r.slug.replace(/-+$/, "")}-plus`;
            }
            newErrors.push(
              `Duplicate SKU "${r.sku}" (conflicts with row #${prev.rowNumber}). Suggested: "${newSuggestedSku}".`
            );
          } else {
            newErrors.push(`Duplicate SKU "${r.sku}" (conflicts with row #${prev.rowNumber}).`);
          }
        } else {
          skuSeen.set(lowerSku, { rowNumber: r.rowNumber, name: r.name });
          newSuggestedSku = undefined;
          newSuggestedSlug = undefined;
        }
      }

      if (r.slug) {
        const lowerSlug = r.slug.toLowerCase();
        if (slugSeen.has(lowerSlug)) {
          const prev = slugSeen.get(lowerSlug)!;
          newErrors.push(`Duplicate URL Slug "${r.slug}" (conflicts with row #${prev.rowNumber}).`);
        } else {
          slugSeen.set(lowerSlug, { rowNumber: r.rowNumber, name: r.name });
        }
      }

      return {
        ...r,
        suggestedSku: newSuggestedSku,
        suggestedSlug: newSuggestedSlug,
        isValid: newErrors.length === 0,
        errors: newErrors,
      };
    });
  }

  function handleApplySuggestedSku(rowNumber: number) {
    setParsedRows((prev) => {
      const updated = prev.map((r) => {
        if (r.rowNumber === rowNumber && r.suggestedSku) {
          return {
            ...r,
            sku: r.suggestedSku,
            slug: r.suggestedSlug || r.slug,
            suggestedSku: undefined,
            suggestedSlug: undefined,
          };
        }
        return r;
      });
      return reevaluateFileDuplicates(updated);
    });
    triggerHaptic("success");
  }

  function handleApplyAllSuggestions() {
    setParsedRows((prev) => {
      const updated = prev.map((r) => {
        if (r.suggestedSku) {
          return {
            ...r,
            sku: r.suggestedSku,
            slug: r.suggestedSlug || r.slug,
            suggestedSku: undefined,
            suggestedSlug: undefined,
          };
        }
        return r;
      });
      return reevaluateFileDuplicates(updated);
    });
    triggerHaptic("success");
  }

  function handleUpdateRowKeywords(rowNumber: number, newKeywords: string[]) {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.rowNumber === rowNumber) {
          const updated = { ...r, keywords: newKeywords };
          return revalidateRow(updated);
        }
        return r;
      })
    );
  }

  async function handleBatchSubmit() {
    if (!selectedCategory || parsedRows.length === 0) return;

    // Check duplicate constraints if duplicateMode === "stop"
    const inDbDuplicates = parsedRows.filter(
      (r) => (r.sku && dbExistingSkus.has(r.sku.toLowerCase())) || (r.slug && dbExistingSlugs.has(r.slug.toLowerCase()))
    );

    const inFileDuplicates = parsedRows.filter(
      (r) => r.errors.some((e) => e.toLowerCase().includes("duplicate"))
    );

    if (duplicateMode === "stop" && (inDbDuplicates.length > 0 || inFileDuplicates.length > 0)) {
      setParseError(
        `Import stopped: ${inDbDuplicates.length + inFileDuplicates.length} duplicate SKUs/slugs detected. Select "Update existing by SKU" or "Skip duplicates" to proceed.`
      );
      triggerHaptic("heavy");
      return;
    }

    setProcessing(true);
    setProcessedCount(0);
    triggerHaptic("selection");

    const uploadId = `CAT-BULK-${Date.now().toString(36).toUpperCase()}`;

    try {
      // 1. Create Catalog Upload Entry
      await supabase.from("catalog_uploads").insert({
        id: uploadId,
        upload_type: "bulk",
        category_id: selectedCategory.id,
        category_path: categoryBreadcrumb,
        file_name: csvFile?.name || "bulk_upload.csv",
        total_items: parsedRows.length,
        passed_items: 0,
        failed_items: 0,
        status: "qc_in_progress",
        notes: `Bulk upload for category "${selectedCategory.name}". Mode: ${duplicateMode}.`,
      });

      // 2. Process Rows
      let completed = 0;
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      const seenSkusInThisBatch = new Set<string>();

      for (const row of parsedRows) {
        // Skip duplicate rows if mode is "skip"
        const lowerSku = row.sku ? row.sku.toLowerCase() : "";
        if (duplicateMode === "skip") {
          if (lowerSku && (seenSkusInThisBatch.has(lowerSku) || dbExistingSkus.has(lowerSku))) {
            skippedCount++;
            completed++;
            setProcessedCount(completed);
            continue;
          }
        }

        if (lowerSku) {
          seenSkusInThisBatch.add(lowerSku);
        }

        // Subcategory resolution by name under selected category or whole category tree
        let targetCategoryId = selectedCategory.id;
        if (row.subcategoryName && row.subcategoryName.trim()) {
          const subName = row.subcategoryName.trim().toLowerCase();
          const matchedSub =
            categories.find(
              (c) =>
                c.name.trim().toLowerCase() === subName &&
                (c.parent_id === selectedCategory.id || !c.parent_id)
            ) || categories.find((c) => c.name.trim().toLowerCase() === subName);

          if (matchedSub) {
            targetCategoryId = matchedSub.id;
          }
        }

        // Slug & SKU preserving: NEVER append row number if provided
        const slugToUse =
          row.slug && row.slug.trim()
            ? row.slug.trim()
            : `${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36).substring(4)}`;

        const skuToUse =
          row.sku && row.sku.trim()
            ? row.sku.trim()
            : `URT-${Date.now().toString(36).toUpperCase()}-${row.rowNumber}`;

        // Check if updating existing by SKU
        const existingProductId =
          duplicateMode === "update" && lowerSku ? dbExistingSkus.get(lowerSku) : undefined;

        try {
          // Create or update Product Metadata
          const createdProduct = await saveProductMetadata({
            id: existingProductId,
            name: row.name,
            slug: slugToUse,
            sku: skuToUse,
            category_id: targetCategoryId,
            price: row.price,
            mrp: row.mrp !== null && row.mrp !== undefined ? row.mrp : undefined,
            stock: row.stock,
            min_order_qty: row.minOrderQty,
            order_qty_step: row.orderQtyStep,
            low_stock_threshold: row.lowStockThreshold,
            warranty_months: row.warrantyMonths,
            short_description: row.tagline,
            description: row.description,
            brand: row.brand,
            attributes: row.attributes,
            keywords: row.keywords || [],
            images: row.images,
            specs: row.specs || {},
            is_urbanrat_brand: row.isUrbanrat,
            is_featured: row.isFeatured,
            is_trending: row.isTrending,
            is_active: row.isActive,
          });

          // Save Price Tiers
          if (row.tiers && row.tiers.length > 0) {
            await adminSaveProductTiers(createdProduct.id, row.tiers);
          }

          if (existingProductId) {
            updatedCount++;
          } else {
            createdCount++;
            if (lowerSku) {
              dbExistingSkus.set(lowerSku, createdProduct.id);
            }
          }

          // Record Item QC Pass
          await supabase.from("catalog_upload_items").insert({
            upload_id: uploadId,
            row_number: row.rowNumber,
            title: row.name,
            sku: skuToUse,
            status: "qc_pass",
            product_id: createdProduct.id,
            payload: { ...row, slug: slugToUse, sku: skuToUse },
          });
        } catch (itemErr: any) {
          console.error(`Row ${row.rowNumber} failed:`, itemErr);
          failedCount++;
          await supabase.from("catalog_upload_items").insert({
            upload_id: uploadId,
            row_number: row.rowNumber,
            title: row.name,
            sku: skuToUse,
            status: "qc_error",
            error_message: itemErr.message || "Database insert error",
            payload: { ...row },
          });
        }

        completed++;
        setProcessedCount(completed);
      }

      // Update upload stats in DB
      const overallStatus =
        failedCount === 0 ? "qc_pass" : createdCount + updatedCount === 0 ? "qc_error" : "action_required";

      await supabase.from("catalog_uploads").update({
        passed_items: createdCount + updatedCount,
        failed_items: failedCount,
        status: overallStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", uploadId);

      // Compute field-by-field statistics for Import Report
      const total = parsedRows.length;
      const stats = [
        { field: "Product Name", filled: parsedRows.filter((r) => r.name?.trim()).length, empty: parsedRows.filter((r) => !r.name?.trim()).length },
        { field: "URL Slug", filled: parsedRows.filter((r) => r.slug?.trim()).length, empty: parsedRows.filter((r) => !r.slug?.trim()).length },
        { field: "Product SKU", filled: parsedRows.filter((r) => r.sku?.trim()).length, empty: parsedRows.filter((r) => !r.sku?.trim()).length },
        { field: "Category / Subcategory", filled: parsedRows.filter((r) => r.subcategoryName?.trim() || r.categoryName?.trim()).length, empty: parsedRows.filter((r) => !r.subcategoryName?.trim() && !r.categoryName?.trim()).length },
        { field: "Maximum Retail Price (MRP)", filled: parsedRows.filter((r) => r.mrp !== null && r.mrp !== undefined).length, empty: parsedRows.filter((r) => r.mrp === null || r.mrp === undefined).length },
        { field: "Base Wholesale Price", filled: parsedRows.filter((r) => !isNaN(r.price) && r.price > 0).length, empty: parsedRows.filter((r) => isNaN(r.price) || r.price <= 0).length },
        { field: "Volume Tiers", filled: parsedRows.filter((r) => r.tiers && r.tiers.length > 0).length, empty: parsedRows.filter((r) => !r.tiers || r.tiers.length === 0).length },
        { field: "Current Stock", filled: parsedRows.filter((r) => r.stock > 0).length, empty: parsedRows.filter((r) => r.stock === 0).length },
        { field: "Low Stock Alert", filled: parsedRows.filter((r) => r.lowStockThreshold > 0).length, empty: parsedRows.filter((r) => r.lowStockThreshold === 0).length },
        { field: "Detailed Description", filled: parsedRows.filter((r) => r.description?.trim()).length, empty: parsedRows.filter((r) => !r.description?.trim()).length },
        { field: "Short Tagline", filled: parsedRows.filter((r) => r.tagline?.trim()).length, empty: parsedRows.filter((r) => !r.tagline?.trim()).length },
        { field: "Technical Specs (JSON)", filled: parsedRows.filter((r) => r.specs && Object.keys(r.specs).length > 0).length, empty: parsedRows.filter((r) => !r.specs || Object.keys(r.specs).length === 0).length },
        { field: "Search Keywords", filled: parsedRows.filter((r) => r.keywords && r.keywords.length > 0).length, empty: parsedRows.filter((r) => !r.keywords || r.keywords.length === 0).length },
        { field: "Brand", filled: parsedRows.filter((r) => r.brand?.trim()).length, empty: parsedRows.filter((r) => !r.brand?.trim()).length },
        { field: "Compatibility Group", filled: parsedRows.filter((r) => r.attributes?.compatibility_group).length, empty: parsedRows.filter((r) => !r.attributes?.compatibility_group).length },
        { field: "Image URL", filled: parsedRows.filter((r) => r.images && r.images.length > 0).length, empty: parsedRows.filter((r) => !r.images || r.images.length === 0).length },
      ];

      setImportReport({
        uploadId,
        totalRows: total,
        createdCount,
        updatedCount,
        skippedCount,
        failedCount,
        ignoredColumns,
        fieldStats: stats,
      });

      triggerHaptic("success");
    } catch (err: any) {
      console.error("Batch upload transaction failed:", err);
      setParseError(err.message || "Bulk catalog upload process encountered an error.");
    } finally {
      setProcessing(false);
    }
  }

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  const totalRows = parsedRows.length;
  const withImagesCount = parsedRows.filter((r) => r.images && r.images.length > 0).length;
  const withTiersCount = parsedRows.filter((r) => r.tiers && r.tiers.length > 0).length;
  const withDescCount = parsedRows.filter((r) => r.description && r.description.trim().length > 0).length;
  const withKeywordsCount = parsedRows.filter((r) => r.keywords && r.keywords.length > 0).length;
  const withBrandCount = parsedRows.filter((r) => r.brand && r.brand.trim().length > 0).length;
  const suggestionsCount = parsedRows.filter((r) => Boolean(r.suggestedSku)).length;

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
                Bulk Catalog Upload (Standard CSV &amp; Excel)
              </h3>
              <p className="text-xs text-slate-400">
                Full-field preservation: SKU, slug, tiers, specs JSON, stock, keywords &amp; images
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
          {/* Post-Import Report Screen */}
          {importReport ? (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start space-x-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-base font-extrabold text-emerald-900">
                    Import Report: Batch {importReport.uploadId}
                  </h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    Processed {importReport.totalRows} rows:{" "}
                    <strong>{importReport.createdCount} created</strong>,{" "}
                    <strong>{importReport.updatedCount} updated</strong>,{" "}
                    <strong>{importReport.skippedCount} skipped</strong>,{" "}
                    <strong>{importReport.failedCount} failed</strong>.
                  </p>
                </div>
              </div>

              {/* Ignored columns warning banner */}
              {importReport.ignoredColumns.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Notice for Ignored Columns:</span>
                    <p className="mt-0.5 text-amber-700">
                      The following columns were not recognized by alias dictionary and were ignored:{" "}
                      <span className="font-mono font-semibold">
                        {importReport.ignoredColumns.map((col) => `"${col}"`).join(", ")}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Field Statistics Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between">
                  <span>Column / Field Name</span>
                  <span>Filled vs Empty</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {importReport.fieldStats.map((st, i) => (
                    <div
                      key={i}
                      className="px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-800">{st.field}</span>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {st.filled}/{importReport.totalRows} filled
                        </span>
                        {st.empty > 0 && (
                          <span className="px-2 py-0.5 rounded-md font-mono text-[11px] text-slate-400">
                            ({st.empty} empty)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportReport(null);
                    setParsedRows([]);
                    setCsvFile(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Import Another File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSuccess(importReport.uploadId);
                    onClose();
                  }}
                  className="px-5 py-2.5 rounded-xl brand-gradient text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer"
                >
                  View Catalog Uploads
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: Category Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Step 1: Select Target Category
                  </span>
                  {selectedCategory && (
                    <span className="text-xs font-medium text-brand-dark">
                      Selected: <strong>{categoryBreadcrumb}</strong>
                    </span>
                  )}
                </div>

                <CategoryCascader
                  categories={categories}
                  selectedCategoryId={selectedCategory?.id || null}
                  onSelectCategory={handleSelectCategory}
                />
              </div>

              {/* Step 2: Upload CSV / Excel & Options */}
              {selectedCategory && (
                <div className="space-y-5 animate-fade-in pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      Step 2: Upload File &amp; Configure Duplicate Handling
                    </span>
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="text-xs font-bold text-brand-dark hover:underline flex items-center space-x-1 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Blank Template</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPrefilledTemplate}
                        disabled={downloadingPrefilled}
                        className="text-xs font-bold text-brand-dark hover:underline flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                      >
                        {downloadingPrefilled ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5" />
                        )}
                        <span>Prefilled with Images</span>
                      </button>
                    </div>
                  </div>

                  {/* Duplicate Mode Options */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <label className="text-xs font-extrabold text-slate-800 block">
                      Duplicate SKU &amp; Slug Policy:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label
                        className={`p-3 rounded-xl border flex items-center space-x-2.5 cursor-pointer transition ${
                          duplicateMode === "update"
                            ? "bg-white border-brand-dark shadow-xs"
                            : "bg-slate-100/60 border-slate-200 text-slate-600 hover:bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="duplicateMode"
                          value="update"
                          checked={duplicateMode === "update"}
                          onChange={() => setDuplicateMode("update")}
                          className="accent-slate-900"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">Update existing</p>
                          <p className="text-[10px] text-slate-500">Updates existing product by SKU</p>
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-xl border flex items-center space-x-2.5 cursor-pointer transition ${
                          duplicateMode === "skip"
                            ? "bg-white border-brand-dark shadow-xs"
                            : "bg-slate-100/60 border-slate-200 text-slate-600 hover:bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="duplicateMode"
                          value="skip"
                          checked={duplicateMode === "skip"}
                          onChange={() => setDuplicateMode("skip")}
                          className="accent-slate-900"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">Skip duplicates</p>
                          <p className="text-[10px] text-slate-500">Ignores conflicting SKUs</p>
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-xl border flex items-center space-x-2.5 cursor-pointer transition ${
                          duplicateMode === "stop"
                            ? "bg-white border-brand-dark shadow-xs"
                            : "bg-slate-100/60 border-slate-200 text-slate-600 hover:bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="duplicateMode"
                          value="stop"
                          checked={duplicateMode === "stop"}
                          onChange={() => setDuplicateMode("stop")}
                          className="accent-slate-900"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">Stop on duplicates</p>
                          <p className="text-[10px] text-slate-500">Abort if any SKU exists</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Dropzone */}
                  <div className="border-2 border-dashed border-slate-200 hover:border-slate-400 transition-colors rounded-3xl p-6 text-center space-y-3 bg-slate-50/50">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 mx-auto flex items-center justify-center text-brand-dark shadow-2xs">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {csvFile ? csvFile.name : "Select or drag & drop CSV / Excel spreadsheet"}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        UTF-8 CSV or Excel with headers: Product Name, SKU, MRP, Tiers, Specs JSON, etc.
                      </p>
                    </div>

                    <label className="inline-flex px-5 py-2.5 rounded-xl brand-gradient text-white text-xs font-bold shadow-md hover:shadow-lg transition-all items-center space-x-2 cursor-pointer active:scale-95">
                      {parsing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Parsing File...</span>
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>{csvFile ? "Choose Different File" : "Browse File"}</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
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

                  {/* Column Mapping Notice & Action */}
                  {csvFile && (ignoredColumns.length > 0 || rawHeaders.length > 0) && (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-xs font-bold text-slate-800">
                            Column Mapping {ignoredColumns.length > 0 ? `(${ignoredColumns.length} ignored)` : "(All Matched)"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowColumnMapper(!showColumnMapper)}
                          className="text-xs font-bold text-brand-dark hover:underline cursor-pointer"
                        >
                          {showColumnMapper ? "Hide Column Mapper" : "Customize Column Mapping"}
                        </button>
                      </div>

                      {ignoredColumns.length > 0 && !showColumnMapper && (
                        <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              {ignoredColumns.map((c) => `Column "${c}" was ignored`).join(", ")}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowColumnMapper(true)}
                            className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Map Columns
                          </button>
                        </div>
                      )}

                      {showColumnMapper && (
                        <div className="p-4 space-y-3 animate-fade-in">
                          <p className="text-[11px] text-slate-500">
                            Verify and map spreadsheet columns to catalog fields. Unmapped columns will be ignored.
                          </p>

                          {duplicateColumns.length > 0 && (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                              <span className="font-bold">Notice:</span> Multiple columns mapped to same field:{" "}
                              {duplicateColumns.map((dc) => `"${dc.headers.join('", "')}" → ${dc.canonical}`).join("; ")}.
                            </div>
                          )}

                          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                            {rawHeaders.map((hdr) => {
                              const detected = resolveCanonicalHeader(hdr);
                              const currentSelected =
                                customMappings[hdr] !== undefined ? customMappings[hdr] : (detected || "ignore");

                              return (
                                <div key={hdr} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                                  <div className="min-w-0 flex items-center space-x-2">
                                    <span className="font-mono font-medium text-slate-800 truncate">{hdr}</span>
                                    {ignoredColumns.includes(hdr) && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">
                                        Unmapped
                                      </span>
                                    )}
                                  </div>
                                  <select
                                    value={currentSelected}
                                    onChange={(e) => {
                                      const updated = { ...customMappings, [hdr]: e.target.value };
                                      setCustomMappings(updated);
                                    }}
                                    className="px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white"
                                  >
                                    <option value="ignore">❌ Ignore Column</option>
                                    {CANONICAL_FIELD_OPTIONS.map((opt) => (
                                      <option key={opt.key} value={opt.key}>
                                        ✓ {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => handleApplyCustomMapping(customMappings)}
                              disabled={parsing}
                              className="px-4 py-2 rounded-xl brand-gradient text-white text-xs font-bold shadow-2xs hover:shadow-md transition cursor-pointer disabled:opacity-50"
                            >
                              {parsing ? "Re-checking..." : "Apply Column Mapping & Re-check"}
                            </button>
                          </div>
                        </div>
                      )}
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
                            Valid &amp; Ready
                          </span>
                          <span className="text-lg font-black text-emerald-800 block mt-0.5">
                            {validCount}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
                            Flagged Rows
                          </span>
                          <span className="text-lg font-black text-rose-800 block mt-0.5">
                            {invalidCount}
                          </span>
                        </div>
                      </div>

                      {/* Field Coverage Summary */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                        <span className="font-bold text-slate-700">Coverage:</span>
                        <span>Images: <strong className="text-slate-900">{withImagesCount}/{totalRows}</strong></span>
                        <span>•</span>
                        <span>Tiers: <strong className="text-slate-900">{withTiersCount}/{totalRows}</strong></span>
                        <span>•</span>
                        <span>Description: <strong className="text-slate-900">{withDescCount}/{totalRows}</strong></span>
                        <span>•</span>
                        <span>Keywords: <strong className="text-slate-900">{withKeywordsCount}/{totalRows}</strong></span>
                        <span>•</span>
                        <span>Brand: <strong className="text-slate-900">{withBrandCount}/{totalRows}</strong></span>
                      </div>

                      {/* Duplicate SKU with Symbol Difference Suggestions Banner */}
                      {suggestionsCount > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 animate-fade-in">
                          <div className="flex items-start space-x-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-amber-900">
                                {suggestionsCount} SKU collision{suggestionsCount > 1 ? "s" : ""} detected with symbol difference (e.g. '+')
                              </p>
                              <p className="text-[11px] text-amber-700 mt-0.5">
                                Unique SKUs appending &apos;-PLUS&apos; have been generated for these rows.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleApplyAllSuggestions}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer shrink-0 self-start sm:self-auto"
                          >
                            Apply All Suggestions ({suggestionsCount})
                          </button>
                        </div>
                      )}

                      {/* Auto-attach matched images action */}
                      {parsedRows.some(
                        (r) => (!r.images || r.images.length === 0) && r.sku && r.sku.trim().length > 0
                      ) && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-brand-light/15 border border-brand-light/35 animate-fade-in">
                          <div className="flex items-center space-x-2.5">
                            <Sparkles className="w-4 h-4 text-brand-dark shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-slate-800">
                                Missing images detected
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Some products have no image URLs. Auto-attach matching images from library by SKU hint?
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleAutoAttachImages}
                            disabled={autoAttaching}
                            className="px-3.5 py-1.5 rounded-xl brand-gradient text-white text-xs font-bold flex items-center space-x-1.5 shadow-2xs hover:opacity-95 cursor-pointer active:scale-95 shrink-0 self-start sm:self-auto disabled:opacity-50"
                          >
                            {autoAttaching ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Wand2 className="w-3.5 h-3.5" />
                            )}
                            <span>Auto-attach Matched Images</span>
                          </button>
                        </div>
                      )}

                      {/* Row Preview List */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                        {parsedRows.slice(0, 50).map((r) => {
                          const isEditingThisRow = editingRowNumber === r.rowNumber;
                          return (
                            <div
                              key={r.rowNumber}
                              className={`p-3 space-y-2 ${
                                r.isValid ? "hover:bg-slate-50" : "bg-rose-50/40"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
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
                                    {r.brand && (
                                      <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[9px] font-semibold">
                                        {r.brand}
                                      </span>
                                    )}
                                  </div>

                                  {r.errors.length > 0 ? (
                                    <p className="text-[11px] text-rose-600 mt-1 font-medium">
                                      ⚠️ {r.errors.join("; ")}
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      ₹{r.price} (MRP: ₹{r.mrp ?? "—"}) • Stock: {r.stock} • Alert: {r.lowStockThreshold} • Tiers: {r.tiers.length} ({r.tiers.map((t) => `${t.min_qty}+ @ ₹${t.unit_price}`).join(", ")})
                                    </p>
                                  )}

                                  {/* Suggested SKU Conflict Resolution */}
                                  {r.suggestedSku && (
                                    <div className="flex items-center space-x-2 mt-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                                      <span className="text-[10px] text-amber-800">
                                        Suggested SKU: <strong className="font-mono">{r.suggestedSku}</strong>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleApplySuggestedSku(r.rowNumber)}
                                        className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold cursor-pointer transition"
                                      >
                                        Apply suggestion
                                      </button>
                                    </div>
                                  )}

                                  {/* Images count & specs check */}
                                  <div className="flex items-center space-x-3 mt-1 text-[10px] text-slate-500">
                                    <div className="flex items-center space-x-1">
                                      <ImageIcon className="w-3 h-3 text-slate-400" />
                                      <span>{r.images?.length || 0} images</span>
                                    </div>
                                    {r.specs && Object.keys(r.specs).length > 0 && (
                                      <span className="text-slate-400">
                                        • {Object.keys(r.specs).length} specs parsed
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingRowNumber(isEditingThisRow ? null : r.rowNumber)
                                    }
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border flex items-center space-x-1 cursor-pointer transition ${
                                      isEditingThisRow
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                    }`}
                                  >
                                    <Tag className="w-3 h-3 text-brand-dark" />
                                    <span>{isEditingThisRow ? "Done" : "Keywords"}</span>
                                  </button>

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
                              </div>

                              {/* Keywords Summary or Inline Editor */}
                              {isEditingThisRow && (
                                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 space-y-2 animate-fade-in">
                                  <KeywordsInput
                                    value={r.keywords || []}
                                    onChange={(newKw) => handleUpdateRowKeywords(r.rowNumber, newKw)}
                                    label={`Edit Keywords for Row #${r.rowNumber}`}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {parsedRows.length > 50 && (
                          <div className="p-3 text-center text-slate-400 text-xs">
                            Showing first 50 rows of {parsedRows.length} total products
                          </div>
                        )}
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
                              Importing Products... ({processedCount}/{parsedRows.length})
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              Import &amp; Publish {validCount} Products
                              {invalidCount > 0 ? ` (${invalidCount} flagged)` : ""}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Image Picker Modal */}
      <ImagePickerModal
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelect={(selected) => {
          if (selected.length > 0) {
            const urls = selected.map((s) => s.public_url).join("\n");
            navigator.clipboard?.writeText(urls);
            triggerHaptic("success");
          }
          setShowImagePicker(false);
        }}
        onDownloadPrefilledTemplate={(selected) => {
          if (selectedCategory) {
            downloadPrefilledTemplate(selectedCategory, categoryBreadcrumb, selected);
            setShowImagePicker(false);
          }
        }}
        multiSelect={true}
        title="Image Library - Select & Copy Links"
      />
    </div>
  );
}
