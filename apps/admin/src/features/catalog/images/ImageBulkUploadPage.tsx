import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  Plus,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Copy,
  Trash2,
  Download,
  ImageIcon,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  HelpCircle,
  Ban,
  Layers,
  Edit2,
} from "lucide-react";
import {
  uploadCatalogImage,
  listCatalogImages,
  deleteCatalogImage,
  type CatalogImage,
} from "../../../lib/adminService";
import {
  parseSkuFromFilename,
  parseImageIndex,
} from "@urbanrat/shared";
import { formatBytes } from "../../../utils/imageCompressor";
import { triggerHaptic } from "../../../utils/haptics";
import { supabase } from "../../../lib/supabase";

/** Staged queue item for files selected before or during upload */
interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  width: number;
  height: number;
  aspectRatio: number;
  skuHint: string | null;
  imageIndex: number;
  status: "queued" | "compressing" | "uploading" | "done" | "failed";
  progress: number;
  warnings: string[];
  errorMessage?: string;
  uploadedRecord?: CatalogImage;
}

export function ImageBulkUploadPage() {
  const [activeTab, setActiveTab] = useState<"upload" | "library">("upload");
  const [showHowToModal, setShowHowToModal] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false); // For mobile collapsible

  // ── Upload Queue State ──
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentBatchId] = useState<string>(() => crypto.randomUUID());
  const [uploadStats, setUploadStats] = useState<{ total: number; completed: number }>({
    total: 0,
    completed: 0,
  });

  // ── Image Links Table (Session uploads) ──
  const [sessionLinks, setSessionLinks] = useState<CatalogImage[]>([]);
  const [copiedLinkMap, setCopiedLinkMap] = useState<Record<string, boolean>>({});
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [editingSkuValue, setEditingSkuValue] = useState<string>("");

  // ── Deletion Conflict Modal State ──
  const [deleteConflict, setDeleteConflict] = useState<{
    image: CatalogImage;
    usedBy: string[];
  } | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState<CatalogImage | null>(null);

  // ── Library Tab State ──
  const [libraryImages, setLibraryImages] = useState<CatalogImage[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryTotalCount, setLibraryTotalCount] = useState(0);
  const [libraryTotalPages, setLibraryTotalPages] = useState(1);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch Library Images ──
  const loadLibrary = useCallback(async (search = "", page = 1) => {
    setLibraryLoading(true);
    try {
      const res = await listCatalogImages({
        search: search.trim() || undefined,
        page,
        pageSize: 40,
      });
      setLibraryImages(res.data);
      setLibraryTotalCount(res.count);
      setLibraryTotalPages(res.totalPages);
      setLibraryPage(res.page);
    } catch (err) {
      console.error("Failed to load library images:", err);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "library") {
      loadLibrary(librarySearch, libraryPage);
    }
  }, [activeTab, libraryPage, loadLibrary]);

  // Handle Search Debounce in Library
  useEffect(() => {
    if (activeTab !== "library") return;
    const timer = setTimeout(() => {
      loadLibrary(librarySearch, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [librarySearch, activeTab, loadLibrary]);

  // ── Clipboard Paste Support ──
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (activeTab !== "upload") return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        processIncomingFiles(files);
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeTab, queue]);

  // ── File Pre-Validation & Staging ──
  async function processIncomingFiles(files: FileList | File[]) {
    triggerHaptic("selection");
    const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
    const maxFilesAllowed = 50;
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB limit before compression

    const fileList = Array.from(files);
    if (queue.length + fileList.length > maxFilesAllowed) {
      alert(`Batch limit exceeded: You can upload a maximum of ${maxFilesAllowed} images per batch.`);
    }

    const availableSlots = Math.max(0, maxFilesAllowed - queue.length);
    const candidateFiles = fileList.slice(0, availableSlots);

    const newItems: QueueItem[] = [];

    for (const file of candidateFiles) {
      // 1. Check extension & mime type
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!allowedExtensions.includes(ext)) {
        alert(`Unsupported file format for "${file.name}". Only JPG, PNG, and WebP are allowed.`);
        continue;
      }

      // 2. Max size check
      if (file.size > maxSizeBytes) {
        alert(`File "${file.name}" exceeds the 10 MB pre-compression limit (${formatBytes(file.size)}).`);
        continue;
      }

      // 3. Duplicate detection in queue (same name and size)
      const isDuplicate = queue.some(
        (q) => q.name.toLowerCase() === file.name.toLowerCase() && q.size === file.size
      );
      if (isDuplicate) {
        continue; // silently ignore identical file duplicate
      }

      // 4. Measure image dimensions & aspect ratio
      const previewUrl = URL.createObjectURL(file);
      const dimensions = await getImageDimensions(previewUrl);

      const warnings: string[] = [];
      if (dimensions.width < 500 || dimensions.height < 500) {
        warnings.push(`< 500x500 (${dimensions.width}×${dimensions.height})`);
      }

      const ratio = dimensions.width / Math.max(1, dimensions.height);
      if (ratio < 0.8 || ratio > 1.25) {
        warnings.push(`Ratio ${dimensions.width}:${dimensions.height}`);
      }

      const parsed = parseSkuFromFilename(file.name);
      const imageIndex = parseImageIndex(file.name);

      newItems.push({
        id: crypto.randomUUID(),
        file,
        previewUrl,
        name: file.name,
        size: file.size,
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: ratio,
        skuHint: parsed.sku,
        imageIndex,
        status: "queued",
        progress: 0,
        warnings,
      });
    }

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems]);
      triggerHaptic("success");
    }
  }

  function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth || 500, height: img.naturalHeight || 500 });
      };
      img.onerror = () => {
        resolve({ width: 500, height: 500 });
      };
      img.src = url;
    });
  }

  function handleRemoveFromQueue(id: string) {
    triggerHaptic("selection");
    setQueue((prev) => {
      const item = prev.find((q) => q.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((q) => q.id !== id);
    });
  }

  // ── Drag & Drop Handlers ──
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  }

  // ── Concurrent Batch Upload (3 at a time) ──
  async function handleBatchUpload() {
    const queuedItems = queue.filter((item) => item.status === "queued" || item.status === "failed");
    if (queuedItems.length === 0 || isUploading) return;

    setIsUploading(true);
    triggerHaptic("selection");
    setUploadStats({ total: queuedItems.length, completed: 0 });

    const queuePool = [...queuedItems];
    const concurrency = 3;

    async function worker() {
      while (queuePool.length > 0) {
        const item = queuePool.shift();
        if (!item) break;

        // Set status to compressing
        updateItemState(item.id, { status: "compressing", progress: 20 });

        try {
          const result = await uploadCatalogImage(item.file, {
            batchId: currentBatchId,
            onProgress: (pct) => {
              updateItemState(item.id, {
                status: pct < 50 ? "compressing" : "uploading",
                progress: pct,
              });
            },
          });

          // Uploaded successfully
          updateItemState(item.id, {
            status: "done",
            progress: 100,
            uploadedRecord: result,
          });

          setSessionLinks((prev) => [result, ...prev]);
          setUploadStats((prev) => ({ ...prev, completed: prev.completed + 1 }));
          triggerHaptic("success");
        } catch (err: any) {
          console.error(`Failed to upload ${item.name}:`, err);
          updateItemState(item.id, {
            status: "failed",
            progress: 0,
            errorMessage: err.message || "Upload failed. Click retry.",
          });
          triggerHaptic("heavy");
        }
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    setIsUploading(false);
  }

  function updateItemState(id: string, updates: Partial<QueueItem>) {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }

  // ── Retry Individual Failed Item ──
  async function handleRetryItem(id: string) {
    const item = queue.find((q) => q.id === id);
    if (!item) return;

    triggerHaptic("selection");
    updateItemState(id, { status: "compressing", progress: 20, errorMessage: undefined });

    try {
      const result = await uploadCatalogImage(item.file, {
        batchId: currentBatchId,
        onProgress: (pct) => {
          updateItemState(id, {
            status: pct < 50 ? "compressing" : "uploading",
            progress: pct,
          });
        },
      });

      updateItemState(id, {
        status: "done",
        progress: 100,
        uploadedRecord: result,
      });

      setSessionLinks((prev) => [result, ...prev]);
      triggerHaptic("success");
    } catch (err: any) {
      updateItemState(id, {
        status: "failed",
        errorMessage: err.message || "Retry failed.",
      });
      triggerHaptic("heavy");
    }
  }

  // ── Clipboard Copy Helpers ──
  function copyToClipboard(text: string, id?: string) {
    navigator.clipboard.writeText(text);
    triggerHaptic("success");

    if (id) {
      setCopiedLinkMap((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedLinkMap((prev) => ({ ...prev, [id]: false }));
      }, 2000);
    }
  }

  function handleCopyAllLinks(type: "newline" | "comma") {
    const list = activeTab === "upload" ? sessionLinks : libraryImages;
    if (list.length === 0) return;

    const urls = list.map((img) => img.public_url);
    const output = type === "newline" ? urls.join("\n") : urls.join(", ");
    copyToClipboard(output);
  }

  function handleCopySelectedLibrary() {
    const selected = libraryImages.filter((img) => selectedLibraryIds.has(img.id));
    if (selected.length === 0) return;
    const output = selected.map((img) => img.public_url).join("\n");
    copyToClipboard(output);
  }

  // ── Download Excel Sheet with SheetJS ──
  function handleDownloadExcelSheet() {
    triggerHaptic("selection");
    const list = activeTab === "upload" ? sessionLinks : libraryImages;
    if (list.length === 0) return;

    const rows = list.map((img) => {
      const parsed = parseSkuFromFilename(img.original_name);
      return {
        "File Name": img.original_name,
        "SKU Hint": img.sku_hint || parsed.sku || "",
        "Image Index": parsed.index || 1,
        "Public Link": img.public_url,
        "Format": img.mime_type || "image/webp",
        "Original Size (Bytes)": img.original_size_bytes || "",
        "Optimized Size (Bytes)": img.compressed_size_bytes || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 18 },
      { wch: 14 },
      { wch: 65 },
      { wch: 14 },
      { wch: 22 },
      { wch: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Image Links");
    XLSX.writeFile(workbook, `urbanrat_image_links_${Date.now().toString(36)}.xlsx`);
  }

  // ── SKU Inline Editing ──
  async function handleSaveSkuHint(id: string) {
    if (!editingSkuValue.trim()) {
      setEditingSkuId(null);
      return;
    }

    try {
      await supabase
        .from("catalog_images")
        .update({ sku_hint: editingSkuValue.trim().toUpperCase() })
        .eq("id", id);

      const updateList = (prev: CatalogImage[]) =>
        prev.map((img) =>
          img.id === id ? { ...img, sku_hint: editingSkuValue.trim().toUpperCase() } : img
        );

      setSessionLinks(updateList);
      setLibraryImages(updateList);
      triggerHaptic("success");
    } catch (err) {
      console.error("Failed to update SKU hint:", err);
    } finally {
      setEditingSkuId(null);
    }
  }

  // ── Remove Image with Usage Guard ──
  async function handleExecuteDelete(image: CatalogImage) {
    setIsDeletingId(image.id);
    triggerHaptic("selection");
    try {
      await deleteCatalogImage(image.id);
      setSessionLinks((prev) => prev.filter((img) => img.id !== image.id));
      setLibraryImages((prev) => prev.filter((img) => img.id !== image.id));
      setConfirmDeleteImage(null);
      triggerHaptic("success");
    } catch (err: any) {
      // Check if blocked because image is in use
      const msg = err.message || "";
      if (msg.includes("in use by") || msg.includes("referenced by")) {
        const parts = msg.split(":");
        const usedByStr = parts[1] || "";
        const usedBy = usedByStr
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        setDeleteConflict({ image, usedBy });
      } else {
        alert(msg || "Failed to delete image.");
      }
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* ── Tabs: New Upload | Image Library ── */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("upload");
          }}
          className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center space-x-2 transition cursor-pointer ${
            activeTab === "upload"
              ? "bg-brand-dark text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>New Upload</span>
          {queue.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-brand-light/30 text-white font-bold">
              {queue.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("library");
          }}
          className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center space-x-2 transition cursor-pointer ${
            activeTab === "library"
              ? "bg-brand-dark text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Image Library</span>
          {libraryTotalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-800 font-bold">
              {libraryTotalCount}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: NEW UPLOAD ── */}
      {activeTab === "upload" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Upload Column (8 cols desktop) */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. Dismissible Info Banner */}
            {!bannerDismissed && (
              <div className="p-4 rounded-3xl bg-brand-light/10 border border-brand-light/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-fade-in relative">
                <div className="flex items-start space-x-3">
                  <div className="w-9 h-9 rounded-2xl bg-white border border-brand-light/40 flex items-center justify-center text-brand-dark shrink-0 shadow-2xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                      Introducing pre-filled templates for faster bulk uploads
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
                      Upload product images, get links, and paste them into your Excel template. Name files like{" "}
                      <span className="font-mono font-bold text-brand-dark">CHG-001_1.jpg</span> to match SKUs automatically.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      setShowHowToModal(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-brand text-brand-dark bg-white hover:bg-brand-light/15 font-bold text-xs transition cursor-pointer shadow-2xs"
                  >
                    Get Started
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      setBannerDismissed(true);
                    }}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-black/5 transition cursor-pointer"
                    aria-label="Dismiss Banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 2. Large Dashed Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 transition-all cursor-pointer text-center flex flex-col items-center justify-center space-y-3 ${
                isDragging
                  ? "border-brand-dark bg-brand-light/20 scale-[0.99]"
                  : "border-brand-dark/40 bg-brand-light/5 hover:bg-brand-light/10"
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-brand-dark text-white flex items-center justify-center shadow-md">
                <Plus className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-brand-dark tracking-tight">
                  Add Images
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  You can drop images here or paste from clipboard (JPG, PNG, WebP)
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  if (e.target.files) processIncomingFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </div>

            {/* 3. Staged Thumbnails Grid */}
            {queue.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4 animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Staged Images ({queue.length}/50)
                    </span>
                    {uploadStats.total > 0 && (
                      <span className="text-[11px] font-bold text-slate-400">
                        • {uploadStats.completed} of {uploadStats.total} uploaded
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => {
                      triggerHaptic("selection");
                      queue.forEach((q) => URL.revokeObjectURL(q.previewUrl));
                      setQueue([]);
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer disabled:opacity-50"
                  >
                    Clear All
                  </button>
                </div>

                {/* Progress bar during active upload */}
                {isUploading && (
                  <div className="space-y-1.5 animate-fade-in">
                    <div className="flex justify-between text-[11px] font-bold text-slate-600">
                      <span>Uploading batch...</span>
                      <span>
                        {Math.round((uploadStats.completed / Math.max(1, uploadStats.total)) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full brand-gradient transition-all duration-300"
                        style={{
                          width: `${(uploadStats.completed / Math.max(1, uploadStats.total)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-96 overflow-y-auto p-1">
                  {queue.map((item) => (
                    <div
                      key={item.id}
                      className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col justify-between p-1.5 shadow-2xs"
                    >
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="absolute inset-0 w-full h-full object-cover rounded-xl"
                      />

                      {/* Top Action / Remove X */}
                      <div className="relative z-10 flex items-center justify-between">
                        {item.warnings.length > 0 && (
                          <span
                            title={item.warnings.join("\n")}
                            className="p-1 rounded-md bg-amber-400 text-slate-950 font-bold text-[9px] flex items-center space-x-0.5 shadow-xs"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveFromQueue(item.id)}
                          className="ml-auto p-1 rounded-full bg-slate-900/70 hover:bg-rose-600 text-white transition cursor-pointer shadow-xs"
                          title="Remove from queue"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Status Badges */}
                      <div className="relative z-10">
                        {item.status === "done" && (
                          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-3" />
                          </div>
                        )}

                        {item.status === "failed" && (
                          <button
                            type="button"
                            onClick={() => handleRetryItem(item.id)}
                            className="w-full py-1 rounded-lg bg-rose-600 text-white text-[9px] font-bold shadow-xs hover:bg-rose-700 flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>Retry</span>
                          </button>
                        )}

                        {(item.status === "compressing" || item.status === "uploading") && (
                          <div className="p-1 rounded-lg bg-black/60 text-white text-[9px] font-bold flex items-center justify-center space-x-1">
                            <Loader2 className="w-3 h-3 animate-spin text-brand-light" />
                            <span>{item.progress}%</span>
                          </div>
                        )}

                        {item.status === "queued" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/50 text-white truncate max-w-full block">
                            {formatBytes(item.size)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 4. Primary Upload Button "Get Image Link" */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {queue.filter((q) => q.status === "queued").length} queued • Parallel upload (3 concurrent)
                  </div>

                  <button
                    type="button"
                    disabled={isUploading || queue.filter((q) => q.status === "queued" || q.status === "failed").length === 0}
                    onClick={handleBatchUpload}
                    className="px-6 py-2.5 rounded-xl brand-gradient text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing &amp; Uploading...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Get Image Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 5. "Image Links" Table (Cards on Mobile) */}
            {sessionLinks.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4 animate-fade-in">
                {/* Table Header & Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                      Image Links ({sessionLinks.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Generated CDN links ready for Excel catalog upload
                    </p>
                  </div>

                  {/* Toolbar Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyAllLinks("newline")}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center space-x-1 cursor-pointer shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5 text-brand-dark" />
                      <span>Copy All Links</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyAllLinks("comma")}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center space-x-1 cursor-pointer shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5 text-brand-dark" />
                      <span>Copy Comma-Separated</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadExcelSheet}
                      className="px-3 py-1.5 rounded-xl brand-gradient text-white text-xs font-bold flex items-center space-x-1 cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .xlsx</span>
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto divide-y divide-slate-100 text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400 pb-2">
                        <th className="py-2 pr-3">Image</th>
                        <th className="py-2 px-3">Title</th>
                        <th className="py-2 px-3">Link</th>
                        <th className="py-2 px-3">SKU Hint</th>
                        <th className="py-2 px-3">Size Savings</th>
                        <th className="py-2 pl-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessionLinks.map((img) => {
                        const isCopied = copiedLinkMap[img.id];
                        const savings =
                          img.original_size_bytes && img.compressed_size_bytes
                            ? Math.max(
                                0,
                                Math.round(
                                  ((img.original_size_bytes - img.compressed_size_bytes) /
                                    img.original_size_bytes) *
                                    100
                                )
                              )
                            : 0;

                        return (
                          <tr key={img.id} className="hover:bg-slate-50/70 transition">
                            {/* Image Thumbnail */}
                            <td className="py-3 pr-3">
                              <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                                <img
                                  src={img.public_url}
                                  alt={img.original_name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </td>

                            {/* Title */}
                            <td className="py-3 px-3 max-w-35 truncate">
                              <span className="font-bold text-slate-900 block truncate" title={img.original_name}>
                                {img.original_name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {img.mime_type || "image/webp"}
                              </span>
                            </td>

                            {/* Public Link */}
                            <td className="py-3 px-3 max-w-50">
                              <span
                                className="font-mono text-[11px] text-slate-600 block truncate"
                                title={img.public_url}
                              >
                                {img.public_url}
                              </span>
                            </td>

                            {/* SKU Hint Editable */}
                            <td className="py-3 px-3">
                              {editingSkuId === img.id ? (
                                <div className="flex items-center space-x-1">
                                  <input
                                    type="text"
                                    value={editingSkuValue}
                                    onChange={(e) => setEditingSkuValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveSkuHint(img.id);
                                    }}
                                    className="px-2 py-1 rounded border border-brand text-xs font-mono uppercase w-24 bg-white"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveSkuHint(img.id)}
                                    className="p-1 rounded bg-brand-dark text-white text-[10px] cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSkuId(img.id);
                                    setEditingSkuValue(img.sku_hint || "");
                                  }}
                                  className="group flex items-center space-x-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-mono font-bold cursor-pointer transition"
                                >
                                  <span>{img.sku_hint || "Set SKU"}</span>
                                  <Edit2 className="w-2.5 h-2.5 text-slate-400 group-hover:text-slate-700" />
                                </button>
                              )}
                            </td>

                            {/* Size Savings */}
                            <td className="py-3 px-3">
                              {img.original_size_bytes && img.compressed_size_bytes ? (
                                <div>
                                  <span className="font-bold text-slate-800 block text-[11px]">
                                    {formatBytes(img.original_size_bytes)} → {formatBytes(img.compressed_size_bytes)}
                                  </span>
                                  <span className="text-[10px] font-extrabold text-emerald-600">
                                    {savings}% saved (WebP)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            {/* Actions: Copy Link & Remove */}
                            <td className="py-3 pl-3 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(img.public_url, img.id)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition cursor-pointer ${
                                    isCopied
                                      ? "bg-emerald-600 text-white"
                                      : "bg-brand-dark text-white hover:bg-brand"
                                  }`}
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{isCopied ? "Copied" : "Copy Link"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteImage(img)}
                                  className="px-3 py-1.5 rounded-xl border border-brand/40 text-brand-dark hover:bg-brand-light/10 text-xs font-bold transition cursor-pointer"
                                >
                                  Remove Image
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Guidelines Column (4 cols desktop, collapsible accordion mobile) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
              {/* Header with Mobile Accordion Toggle */}
              <div
                onClick={() => setGuidelinesOpen((prev) => !prev)}
                className="flex items-center justify-between cursor-pointer lg:cursor-default"
              >
                <div className="flex items-center space-x-2">
                  <Ban className="w-4 h-4 text-rose-500" />
                  <h3 className="text-xs sm:text-sm font-black text-rose-600 tracking-tight uppercase">
                    Image types which are not allowed:
                  </h3>
                </div>
                <button
                  type="button"
                  className="lg:hidden p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                  aria-label="Toggle Guidelines"
                >
                  {guidelinesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Guidelines List (visible always on desktop, toggled on mobile) */}
              <div className={`space-y-2.5 ${guidelinesOpen ? "block" : "hidden lg:block"} animate-fade-in`}>
                {/* 1. Watermark Image */}
                <div className="flex items-center space-x-3 p-2 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 relative overflow-hidden flex items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6 text-slate-400" />
                    <div className="absolute inset-0 flex items-center justify-center rotate-45 text-[8px] font-black text-slate-600 tracking-widest bg-white/40">
                      SAMPLE
                    </div>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 leading-tight">Watermark image</h5>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                      ⊘ NOT ALLOWED
                    </span>
                  </div>
                </div>

                {/* 2. Fake Branded / 1st Copy */}
                <div className="flex items-center space-x-3 p-2 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 relative overflow-hidden flex items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6 text-slate-400" />
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[8px] font-bold">
                      !
                    </div>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 leading-tight">Fake branded/1st copy</h5>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                      ⊘ NOT ALLOWED
                    </span>
                  </div>
                </div>

                {/* 3. Image with Price */}
                <div className="flex items-center space-x-3 p-2 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 relative overflow-hidden flex items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6 text-slate-400" />
                    <span className="absolute bottom-1 left-1 bg-amber-400 text-slate-900 text-[8px] font-extrabold px-1 rounded">
                      ₹99
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 leading-tight">Image with price</h5>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                      ⊘ NOT ALLOWED
                    </span>
                  </div>
                </div>

                {/* 4. Pixelated Image */}
                <div className="flex items-center space-x-3 p-2 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-slate-300 relative overflow-hidden grid grid-cols-3 grid-rows-3 gap-0.5 p-1 shrink-0">
                    <div className="bg-slate-400 rounded-2xs" />
                    <div className="bg-slate-200 rounded-2xs" />
                    <div className="bg-slate-500 rounded-2xs" />
                    <div className="bg-slate-100 rounded-2xs" />
                    <div className="bg-slate-400 rounded-2xs" />
                    <div className="bg-slate-300 rounded-2xs" />
                    <div className="bg-slate-500 rounded-2xs" />
                    <div className="bg-slate-300 rounded-2xs" />
                    <div className="bg-slate-200 rounded-2xs" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 leading-tight">Pixelated image</h5>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                      ⊘ NOT ALLOWED
                    </span>
                  </div>
                </div>

                {/* 5. Inverted Image */}
                <div className="flex items-center space-x-3 p-2 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 relative overflow-hidden flex items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6 text-slate-400 scale-y-[-1]" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 leading-tight">Inverted image</h5>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                      ⊘ NOT ALLOWED
                    </span>
                  </div>
                </div>

                {/* 6. Blur / Unclear Image */}
                <div className="flex items-center space-x-3 p-2 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 relative overflow-hidden flex items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6 text-slate-400 blur-xs" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 leading-tight">Blur/unclear image</h5>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                      ⊘ NOT ALLOWED
                    </span>
                  </div>
                </div>

                {/* 7. Incomplete Image */}
                <div className="flex items-center space-x-3 p-2 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 relative overflow-hidden shrink-0">
                    <div className="absolute -right-3 top-2 w-10 h-10 rounded-lg bg-slate-400" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 leading-tight">Incomplete image</h5>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                      ⊘ NOT ALLOWED
                    </span>
                  </div>
                </div>

                {/* Tip box */}
                <div className="p-3 rounded-2xl bg-brand-light/15 border border-brand-light/35 text-[11px] text-slate-800 font-medium">
                  <span className="font-extrabold text-brand-dark block mb-0.5">💡 Best Practice</span>
                  Use the front image of the product on a plain background for maximum buyer conversions.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: IMAGE LIBRARY ── */}
      {activeTab === "library" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5 animate-fade-in">
          {/* Library Header & Search Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                All Catalog Images ({libraryTotalCount})
              </h3>
              <p className="text-[11px] text-slate-400">
                Browse, search by SKU hint or filename, and copy CDN links
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search filename or SKU..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs w-48 sm:w-56 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
                />
              </div>

              {/* Multi-select Action */}
              {selectedLibraryIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleCopySelectedLibrary}
                  className="px-3 py-1.5 rounded-xl brand-gradient text-white text-xs font-bold flex items-center space-x-1 cursor-pointer shadow-2xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy {selectedLibraryIds.size} Selected</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadExcelSheet}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center space-x-1 cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .xlsx</span>
              </button>
            </div>
          </div>

          {/* Library Grid */}
          {libraryLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : libraryImages.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No images found in catalog library</h4>
              <p className="text-xs text-slate-400">
                Upload images via the New Upload tab to start building your catalog library.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {libraryImages.map((img) => {
                const isSelected = selectedLibraryIds.has(img.id);
                const isCopied = copiedLinkMap[img.id];

                return (
                  <div
                    key={img.id}
                    className={`group relative aspect-square rounded-2xl overflow-hidden border transition shadow-2xs bg-slate-50 flex flex-col justify-between p-2 ${
                      isSelected ? "border-brand-dark ring-2 ring-brand-dark/20" : "border-slate-200"
                    }`}
                  >
                    <img
                      src={img.public_url}
                      alt={img.original_name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Checkbox overlay top-left */}
                    <div className="relative z-10 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic("selection");
                          setSelectedLibraryIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(img.id)) next.delete(img.id);
                            else next.add(img.id);
                            return next;
                          });
                        }}
                        className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer shadow-xs transition ${
                          isSelected
                            ? "bg-brand-dark text-white"
                            : "bg-white/80 hover:bg-white text-transparent border border-slate-300"
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-3" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteImage(img);
                        }}
                        className="p-1 rounded-full bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition cursor-pointer shadow-xs"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Bottom Metadata & Copy */}
                    <div className="relative z-10 pt-1">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(img.public_url, img.id)}
                        className={`w-full py-1 rounded-lg text-[10px] font-bold flex items-center justify-center space-x-1 shadow-xs transition cursor-pointer ${
                          isCopied
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-900/80 hover:bg-slate-900 text-white"
                        }`}
                      >
                        {isCopied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                        <span>{isCopied ? "Copied" : "Copy Link"}</span>
                      </button>

                      {img.sku_hint && (
                        <span className="block text-[8px] font-mono font-bold text-center bg-white/90 text-slate-800 rounded mt-1 truncate px-1 py-0.5">
                          {img.sku_hint}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Library Pagination */}
          {libraryTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
              <span className="text-slate-400">
                Page {libraryPage} of {libraryTotalPages} ({libraryTotalCount} images)
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={libraryPage <= 1}
                  onClick={() => setLibraryPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={libraryPage >= libraryTotalPages}
                  onClick={() => setLibraryPage((p) => Math.min(libraryTotalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HOW-TO MODAL ("Get Started") ── */}
      {showHowToModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-brand-dark" />
                <h3 className="text-base font-black text-slate-900">
                  How Image Bulk Upload Works
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHowToModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start space-x-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-brand-dark text-white flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <span className="font-extrabold text-slate-900 block">Name Your Files with SKUs</span>
                  <p className="mt-0.5 text-slate-500">
                    Use names like <code className="font-mono font-bold text-brand-dark">CHG-001_1.jpg</code> or{" "}
                    <code className="font-mono font-bold text-brand-dark">URT-CBL-2.webp</code>. The system automatically associates the SKU and image index.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-brand-dark text-white flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <span className="font-extrabold text-slate-900 block">Automatic WebP Compression</span>
                  <p className="mt-0.5 text-slate-500">
                    Files are compressed directly in the browser to WebP format (saving up to 88% payload) before uploading to high-speed CDN storage.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-brand-dark text-white flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <span className="font-extrabold text-slate-900 block">Copy Links or Download Excel</span>
                  <p className="mt-0.5 text-slate-500">
                    Copy individual URLs, comma-separated link lists for Excel cells, or download a structured Excel sheet with all links mapped.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHowToModal(false)}
              className="w-full py-2.5 rounded-xl brand-gradient text-white text-xs font-bold cursor-pointer shadow-md"
            >
              Got it, let's upload
            </button>
          </div>
        </div>
      )}

      {/* ── CONFIRM REMOVE IMAGE MODAL ── */}
      {confirmDeleteImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="font-black text-sm text-slate-900">Remove Image from Catalog?</h4>
            </div>

            <p className="text-xs text-slate-500">
              Are you sure you want to remove <span className="font-bold text-slate-800">"{confirmDeleteImage.original_name}"</span>?
              If this image is currently used by any active products, deletion will be blocked.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteImage(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingId === confirmDeleteImage.id}
                onClick={() => handleExecuteDelete(confirmDeleteImage)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                {isDeletingId === confirmDeleteImage.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETION CONFLICT MODAL (Image in use by products) ── */}
      {deleteConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-amber-600">
              <Ban className="w-5 h-5 shrink-0 text-rose-500" />
              <h4 className="font-black text-sm text-slate-900">Cannot Delete: Image In Use</h4>
            </div>

            <p className="text-xs text-slate-600">
              This image cannot be deleted because it is currently referenced by{" "}
              <span className="font-bold text-slate-900">{deleteConflict.usedBy.length}</span> active product(s):
            </p>

            <div className="max-h-40 overflow-y-auto rounded-2xl bg-slate-50 border border-slate-200 p-3 divide-y divide-slate-100 text-xs">
              {deleteConflict.usedBy.map((prod, i) => (
                <div key={i} className="py-1.5 font-semibold text-slate-800">
                  • {prod}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400">
              To delete this image, first remove or replace it in the corresponding product listings.
            </p>

            <button
              type="button"
              onClick={() => setDeleteConflict(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
