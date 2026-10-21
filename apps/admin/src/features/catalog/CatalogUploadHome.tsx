import { useState, useEffect, useMemo } from "react";
import type { Category } from "@urbanrat/shared";
import {
  FileSpreadsheet,
  Plus,
  HelpCircle,
  FolderTree,
  Sparkles,
  Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { triggerHaptic } from "../../utils/haptics";
import { SingleCatalogWizard } from "./components/SingleCatalogWizard";
import { BulkCatalogModal } from "./components/BulkCatalogModal";
import { CategoryManagerModal } from "./CategoryManagerModal";
import { UploadHistoryList } from "./components/UploadHistoryList";
import { UploadDetailModal } from "./components/UploadDetailModal";
import type { CatalogUpload, UploadType } from "./types";

export function CatalogUploadHome() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [uploads, setUploads] = useState<CatalogUpload[]>([]);
  const [loading, setLoading] = useState(true);

  // Active modal / flow states
  const [activeFlow, setActiveFlow] = useState<"idle" | "single" | "bulk">("idle");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedUploadForDetail, setSelectedUploadForDetail] = useState<CatalogUpload | null>(null);

  // Upload type tab in history ("bulk" | "single")
  const [activeHistoryTab, setActiveHistoryTab] = useState<UploadType>("bulk");

  async function loadData() {
    setLoading(true);
    try {
      // 1. Fetch Categories
      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (catErr) throw catErr;
      setCategories((catData as Category[]) || []);

      // 2. Fetch Upload Batches
      const { data: uploadData, error: uploadErr } = await supabase
        .from("catalog_uploads")
        .select("*")
        .order("created_at", { ascending: false });

      if (uploadErr) {
        // Table may be fresh, handle gracefully
        console.warn("Could not load catalog_uploads:", uploadErr.message);
        setUploads([]);
      } else {
        setUploads((uploadData as CatalogUpload[]) || []);
      }
    } catch (err) {
      console.error("Failed to load catalog data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Overview Counts (Matching Screenshot 1 & 2)
  const overviewStats = useMemo(() => {
    const total = uploads.length;
    const bulk = uploads.filter((u) => u.upload_type === "bulk").length;
    const single = uploads.filter((u) => u.upload_type === "single").length;
    return { total, bulk, single };
  }, [uploads]);

  function handleUploadSuccess(uploadId: string) {
    setActiveFlow("idle");
    loadData();
    // Open detail modal for the newly created batch
    setTimeout(() => {
      const match = uploads.find((u) => u.id === uploadId);
      if (match) setSelectedUploadForDetail(match);
    }, 600);
  }

  return (
    <div className="space-y-6 pb-24 md:pb-12 max-w-7xl mx-auto">
      {/* ── Page Header & Top Links (Matching Screenshot 1) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Upload Catalog
            </h1>
            {loading && <Loader2 className="w-4 h-4 text-brand-dark animate-spin" />}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Category-wise wholesale inventory onboarding, bulk CSV import &amp; QC verification
          </p>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 self-start sm:self-auto">
          {/* Category Tree Manager button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setIsCategoryModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
          >
            <FolderTree className="w-3.5 h-3.5 text-brand-dark" />
            <span>Category Hierarchy</span>
          </button>

          {/* Guide / Help Links (Matching Screenshot 1) */}
          <a
            href="https://wa.me/919425000000?text=Hello%20Urbanrat%20Support,%20I%20need%20help%20with%20Catalog%20Upload."
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Need Help?</span>
          </a>
        </div>
      </div>

      {/* ── Announcement Banner (Matching Screenshot 1) ── */}
      <div className="rounded-3xl p-4 sm:p-5 border border-amber-200/90 bg-linear-to-r from-amber-50/90 via-orange-50/50 to-amber-50/80 shadow-2xs flex items-center space-x-4 animate-fade-in">
        <div className="w-12 h-12 rounded-2xl bg-amber-100/90 border border-amber-300/80 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs">
          <Sparkles className="w-6 h-6 text-amber-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
            Wholesale catalogs undergo instant quality verification before going live
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
            All category catalogs are verified to ensure quality, tiered price integrity, MOQ alignment, and WebP compression standards.
          </p>
        </div>
      </div>

      {/* ── Mode Selection Buttons (Matching Screenshot 1) ── */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-slate-600">
          Have wholesale products to onboard? Choose an option below:
        </p>

        <div className="flex flex-wrap gap-3">
          {/* Add Catalog in Bulk */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setActiveFlow("bulk");
            }}
            className="px-6 py-3 rounded-2xl brand-gradient text-white text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center space-x-2.5 cursor-pointer active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Add Catalog in Bulk</span>
          </button>

          {/* Add Single Catalog */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setActiveFlow("single");
            }}
            className="px-6 py-3 rounded-2xl bg-white border-2 border-brand-dark/30 hover:border-brand-dark text-brand-dark hover:bg-brand-light/5 text-xs sm:text-sm font-black shadow-2xs hover:shadow-sm transition-all flex items-center space-x-2.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Single Catalog</span>
          </button>
        </div>
      </div>

      {/* ── Overview Metrics Cards (Matching Screenshot 1 & 2) ── */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Overview
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-xs font-bold text-slate-500 block">
              Total Uploads Done
            </span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1">
              {overviewStats.total}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-xs font-bold text-slate-500 block">
              Using Bulk Uploads
            </span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1">
              {overviewStats.bulk}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-xs font-bold text-slate-500 block">
              Using Single Uploads
            </span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1">
              {overviewStats.single}
            </span>
          </div>
        </div>
      </div>

      {/* ── Active Workflow Sub-Views ── */}
      {activeFlow === "single" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm animate-fade-in">
          <SingleCatalogWizard
            categories={categories}
            onClose={() => setActiveFlow("idle")}
            onSuccess={handleUploadSuccess}
          />
        </div>
      )}

      {/* ── Upload History & QC Tabs ── */}
      {activeFlow !== "single" && (
        <UploadHistoryList
          uploads={uploads}
          categories={categories}
          activeUploadType={activeHistoryTab}
          onUploadTypeChange={setActiveHistoryTab}
          onSelectUpload={(upload) => setSelectedUploadForDetail(upload)}
        />
      )}

      {/* ── Bulk Upload Modal ── */}
      <BulkCatalogModal
        categories={categories}
        isOpen={activeFlow === "bulk"}
        onClose={() => setActiveFlow("idle")}
        onSuccess={handleUploadSuccess}
      />

      {/* ── Category Manager Modal ── */}
      <CategoryManagerModal
        categories={categories}
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesUpdated={loadData}
      />

      {/* ── Upload Batch Inspection Modal ── */}
      <UploadDetailModal
        upload={selectedUploadForDetail}
        isOpen={Boolean(selectedUploadForDetail)}
        onClose={() => setSelectedUploadForDetail(null)}
      />
    </div>
  );
}
