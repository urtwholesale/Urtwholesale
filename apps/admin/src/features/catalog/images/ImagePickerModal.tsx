import { useState, useEffect, useCallback } from "react";
import {
  X,
  Search,
  Check,
  ImageIcon,
  Loader2,
  Copy,
  ChevronDown,
  Sparkles,
  CheckCheck,
} from "lucide-react";
import { fetchCatalogImages } from "../../../lib/adminService";
import type { CatalogImage } from "../../../lib/adminService";
import { triggerHaptic } from "../../../utils/haptics";

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the selected image(s) when the user confirms. */
  onSelect: (images: CatalogImage[]) => void;
  /** If true, allows multi-select. Otherwise single-select. */
  multiSelect?: boolean;
  /** Optional title override */
  title?: string;
  /** Optional callback to trigger prefilled template download for selected images */
  onDownloadPrefilledTemplate?: (images: CatalogImage[]) => void;
}

export function ImagePickerModal({
  isOpen,
  onClose,
  onSelect,
  multiSelect = true,
  title = "Image Library",
  onDownloadPrefilledTemplate,
}: ImagePickerModalProps) {
  const [images, setImages] = useState<CatalogImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const PAGE_SIZE = 48;

  const loadImages = useCallback(
    async (searchTerm: string, pageNum: number, append = false) => {
      setLoading(true);
      try {
        const { data, count } = await fetchCatalogImages({
          search: searchTerm || undefined,
          limit: PAGE_SIZE,
          offset: pageNum * PAGE_SIZE,
        });
        setImages((prev) => (append ? [...prev, ...data] : data));
        setTotalCount(count);
      } catch (err) {
        console.error("Failed to load catalog images:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setPage(0);
      setCopiedBatch(false);
      loadImages("", 0);
    }
  }, [isOpen, loadImages]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setPage(0);
      loadImages(search, 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, isOpen, loadImages]);

  function handleToggle(img: CatalogImage) {
    triggerHaptic("selection");
    if (multiSelect) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(img.id)) {
          next.delete(img.id);
        } else {
          next.add(img.id);
        }
        return next;
      });
    } else {
      setSelectedIds(new Set([img.id]));
    }
  }

  function handleSelectAll() {
    triggerHaptic("selection");
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map((img) => img.id)));
    }
  }

  function handleConfirm() {
    const selected = images.filter((img) => selectedIds.has(img.id));
    triggerHaptic("success");
    onSelect(selected);
    onClose();
  }

  function handleCopySelectedLinks(mode: "newline" | "comma" = "newline") {
    const selected = images.filter((img) => selectedIds.has(img.id));
    const urls = selected.map((s) => s.public_url);
    if (urls.length === 0) return;

    const text = mode === "newline" ? urls.join("\n") : urls.join(", ");
    navigator.clipboard?.writeText(text);
    triggerHaptic("success");
    setCopiedBatch(true);
    setTimeout(() => setCopiedBatch(false), 2000);
  }

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    loadImages(search, nextPage, true);
  }

  function handleCopyLink(url: string, e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard?.writeText(url).catch(() => {});
    triggerHaptic("selection");
  }

  if (!isOpen) return null;

  const hasMore = images.length < totalCount;
  const selectedImages = images.filter((img) => selectedIds.has(img.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-brand-dark text-white flex items-center justify-center shadow-2xs shrink-0">
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {title}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {totalCount} images in library • {selectedIds.size} selected
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by filename or SKU hint..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
            />
          </div>

          {multiSelect && images.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer shrink-0 shadow-2xs active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5 text-brand" />
              <span>
                {selectedIds.size === images.length ? "Deselect All" : "Select All"}
              </span>
            </button>
          )}
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading && images.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-brand-dark animate-spin" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <ImageIcon className="w-12 h-12 text-slate-300" />
              <p className="text-xs text-slate-400 font-semibold">
                No catalog images found
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                {images.map((img) => {
                  const isSelected = selectedIds.has(img.id);
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => handleToggle(img)}
                      className={`relative rounded-xl overflow-hidden border-2 aspect-square group cursor-pointer transition-all ${
                        isSelected
                          ? "border-brand-dark ring-2 ring-brand-light/50 shadow-md"
                          : "border-slate-200 hover:border-slate-300 shadow-2xs"
                      }`}
                    >
                      <img
                        src={img.public_url}
                        alt={img.original_name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />

                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-brand-dark text-white flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3 stroke-3" />
                        </div>
                      )}

                      {/* Hover overlay with individual copy */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all">
                        <button
                          type="button"
                          onClick={(e) => handleCopyLink(img.public_url, e)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-md bg-white/95 text-slate-700 opacity-0 group-hover:opacity-100 transition cursor-pointer hover:bg-white shadow-xs"
                          title="Copy direct URL"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>

                      {/* SKU hint badge */}
                      {img.sku_hint && (
                        <span className="absolute bottom-1 left-1 right-1 text-[8px] font-bold text-white bg-black/70 backdrop-blur-xs text-center py-0.5 rounded truncate px-1">
                          {img.sku_hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center mt-4">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    <span>
                      Load More ({images.length} / {totalCount})
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer CTA & Actions */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">
              {selectedIds.size > 0
                ? `${selectedIds.size} image${selectedIds.size > 1 ? "s" : ""} selected`
                : "Select images to use or copy"}
            </span>

            {/* Quick Copy Selected Links button */}
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => handleCopySelectedLinks("newline")}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer shadow-2xs active:scale-95"
              >
                {copiedBatch ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-500" />
                    <span>Copy Links</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {onDownloadPrefilledTemplate && selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  onDownloadPrefilledTemplate(selectedImages);
                  triggerHaptic("success");
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand" />
                <span>Prefill Template ({selectedIds.size})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 rounded-xl brand-gradient text-white text-xs font-bold shadow-2xs hover:opacity-95 transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {multiSelect
                  ? `Use ${selectedIds.size} Image${selectedIds.size !== 1 ? "s" : ""}`
                  : "Use Image"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
