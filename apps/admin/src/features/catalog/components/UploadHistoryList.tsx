import { useState, useMemo } from "react";
import type { Category } from "@urbanrat/shared";
import {
  Search,
  ChevronRight,
  FileSpreadsheet,
  Package,
  Sparkles,
  Calendar,
} from "lucide-react";
import { triggerHaptic } from "../../../utils/haptics";
import type { CatalogUpload, QCStatus, UploadType } from "../types";

interface UploadHistoryListProps {
  uploads: CatalogUpload[];
  categories: Category[];
  activeUploadType: UploadType;
  onUploadTypeChange: (type: UploadType) => void;
  onSelectUpload: (upload: CatalogUpload) => void;
}

export function UploadHistoryList({
  uploads,
  categories,
  activeUploadType,
  onUploadTypeChange,
  onSelectUpload,
}: UploadHistoryListProps) {
  const [activeStatus, setActiveStatus] = useState<QCStatus>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Counts for Bulk and Single tabs
  const bulkUploads = useMemo(
    () => uploads.filter((u) => u.upload_type === "bulk"),
    [uploads]
  );
  const singleUploads = useMemo(
    () => uploads.filter((u) => u.upload_type === "single"),
    [uploads]
  );

  const currentPool = activeUploadType === "bulk" ? bulkUploads : singleUploads;

  // Counts for status pills
  const statusCounts = useMemo(() => {
    return {
      all: currentPool.length,
      action_required: currentPool.filter((u) => u.status === "action_required").length,
      qc_in_progress: currentPool.filter((u) => u.status === "qc_in_progress").length,
      qc_error: currentPool.filter((u) => u.status === "qc_error").length,
      qc_pass: currentPool.filter((u) => u.status === "qc_pass").length,
    };
  }, [currentPool]);

  // Filtered uploads
  const filteredUploads = useMemo(() => {
    return currentPool.filter((u) => {
      // 1. Status filter
      if (activeStatus !== "all" && u.status !== activeStatus) return false;

      // 2. Category filter
      if (selectedCategoryFilter && u.category_id !== selectedCategoryFilter) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = u.id.toLowerCase().includes(q);
        const matchesFile = (u.file_name || "").toLowerCase().includes(q);
        const matchesPath = (u.category_path || "").toLowerCase().includes(q);
        const matchesNotes = (u.notes || "").toLowerCase().includes(q);
        if (!matchesId && !matchesFile && !matchesPath && !matchesNotes) return false;
      }

      return true;
    });
  }, [currentPool, activeStatus, selectedCategoryFilter, searchQuery]);

  function handleTabChange(type: UploadType) {
    triggerHaptic("selection");
    onUploadTypeChange(type);
    setActiveStatus("all");
  }

  function handleStatusChange(status: QCStatus) {
    triggerHaptic("selection");
    setActiveStatus(status);
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-4 sm:p-6">
      {/* ── Mode Selection Tabs (Matching Screenshot 2) ── */}
      <div className="flex items-center space-x-6 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => handleTabChange("bulk")}
          className={`pb-2 text-xs sm:text-sm font-extrabold transition-all relative cursor-pointer ${
            activeUploadType === "bulk"
              ? "text-brand-dark"
              : "text-slate-400 hover:text-slate-700"
          }`}
        >
          <span>Bulk Uploads ({bulkUploads.length})</span>
          {activeUploadType === "bulk" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-dark rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("single")}
          className={`pb-2 text-xs sm:text-sm font-extrabold transition-all relative cursor-pointer ${
            activeUploadType === "single"
              ? "text-brand-dark"
              : "text-slate-400 hover:text-slate-700"
          }`}
        >
          <span>Single Uploads ({singleUploads.length})</span>
          {activeUploadType === "single" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-dark rounded-full" />
          )}
        </button>
      </div>

      {/* ── QC Status Filter Pills (Matching Screenshot 2) ── */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            { key: "all", label: "All", count: statusCounts.all },
            {
              key: "action_required",
              label: "Action Required",
              count: statusCounts.action_required,
            },
            {
              key: "qc_in_progress",
              label: "QC in Progress",
              count: statusCounts.qc_in_progress,
            },
            { key: "qc_error", label: "QC Error", count: statusCounts.qc_error },
            { key: "qc_pass", label: "QC Pass", count: statusCounts.qc_pass },
          ] as const
        ).map((pill) => {
          const isActive = activeStatus === pill.key;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => handleStatusChange(pill.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? "bg-brand-dark text-white shadow-2xs scale-102"
                  : "bg-slate-100 hover:bg-slate-200/80 text-slate-600"
              }`}
            >
              <span>{pill.label}</span>
              <span className="ml-1.5 opacity-80">({pill.count})</span>
            </button>
          );
        })}
      </div>

      {/* ── Search & Category Filter Row (Matching Screenshot 2) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
        {/* Category Dropdown */}
        <div className="sm:col-span-5 flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 shrink-0">Filter by:</span>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
          >
            <option value="">Select Category (All)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search by File ID / Name */}
        <div className="sm:col-span-7 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search By File Id / Catalog Name..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
          />
        </div>
      </div>

      {/* ── QC Tip Banner (Matching Screenshot 2) ── */}
      <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-center space-x-2.5 text-xs text-amber-900">
        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-[11px] leading-tight">
          <strong className="font-bold">QC (Quality-Check) Tip:</strong> Error products can be inspected immediately. Resolve pricing or stock flags quickly to accelerate your wholesale catalog deployment.
        </p>
      </div>

      {/* ── Upload History List Items ── */}
      <div className="space-y-2 pt-1">
        {filteredUploads.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-700">No Catalog Uploads Found</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              No matching records for the selected filters. Use "Add Catalog in Bulk" or "Add Single Catalog" above.
            </p>
          </div>
        ) : (
          filteredUploads.map((upload) => (
            <div
              key={upload.id}
              onClick={() => onSelectUpload(upload)}
              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-brand-dark/40 hover:shadow-sm transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
            >
              <div className="flex items-start space-x-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                    upload.upload_type === "bulk"
                      ? "bg-brand-dark text-white"
                      : "bg-teal-600 text-white"
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black font-mono text-slate-900 group-hover:text-brand-dark transition">
                      {upload.id}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
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

                  <p className="text-xs font-bold text-slate-800 truncate mt-0.5">
                    {upload.file_name || "Catalog Batch"}
                  </p>

                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {upload.category_path || "General Accessories"}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end space-x-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div className="text-left sm:text-right">
                  <span className="text-xs font-bold text-slate-800 block">
                    {upload.passed_items}/{upload.total_items} Passed
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center sm:justify-end space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(upload.created_at).toLocaleDateString()}</span>
                  </span>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-dark group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
