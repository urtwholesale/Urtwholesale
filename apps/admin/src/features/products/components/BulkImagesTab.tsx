import { useState, useRef } from "react";
import {
  ImageIcon,
  ArrowLeft,
  ArrowRight,
  Trash2,
  FolderOpen,
  Upload,
  AlertTriangle,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { BulkImageMode, CatalogImage } from "@urbanrat/shared";
import { parseSkuFromFilename, parseImageIndex } from "@urbanrat/shared";
import { BulkPreviewPanel } from "./BulkPreviewPanel";
import {
  bulkUpdateImages,
  uploadCatalogImage,
  fetchCatalogImages,
} from "../../../lib/adminService";
import { ImagePickerModal } from "../../catalog/images/ImagePickerModal";
import { supabase } from "../../../lib/supabase";
import { triggerHaptic } from "../../../utils/haptics";

export interface BulkImagesTabProps {
  productIds: string[];
  scopeLabel: string;
  onSuccess: (result: { applied: number; skipped: number; opIds: string[] }) => void;
  onCancel?: () => void;
}

export function BulkImagesTab({
  productIds,
  scopeLabel,
  onSuccess,
  onCancel,
}: BulkImagesTabProps) {
  const [mode, setMode] = useState<BulkImageMode>("append");
  const [matchBySku, setMatchBySku] = useState(false);

  // Selected images to apply
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [targetUrl, setTargetUrl] = useState<string>(""); // for set_primary or remove_url
  const [uploadedDirectlyCount, setUploadedDirectlyCount] = useState(0);

  // Modal / upload state
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SKU matching preview state
  const [skuMatchMap, setSkuMatchMap] = useState<Map<string, string[]> | null>(null);
  const [unmatchedProductNames, setUnmatchedProductNames] = useState<string[]>([]);
  const [isMatchingSku, setIsMatchingSku] = useState(false);

  // Pick from Image Library
  function handleSelectFromLibrary(images: CatalogImage[]) {
    triggerHaptic("selection");
    const newUrls = images.map((img) => img.public_url).filter(Boolean);
    setSelectedUrls((prev) => {
      const merged = [...prev];
      for (const u of newUrls) {
        if (!merged.includes(u)) merged.push(u);
      }
      return merged.slice(0, 10);
    });
    const firstNew = newUrls[0];
    if (firstNew && !targetUrl) {
      setTargetUrl(firstNew);
    }
  }

  // Upload new files (auto WebP compression + library save)
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    triggerHaptic("selection");

    try {
      const uploadedUrls: string[] = [];
      const total = files.length;

      for (let i = 0; i < total; i++) {
        const file = files[i];
        if (!file) continue;

        const record = await uploadCatalogImage(file, {
          onProgress: (p) => {
            const overall = Math.round(((i + p / 100) / total) * 100);
            setUploadProgress(overall);
          },
        });
        if (record.public_url) {
          uploadedUrls.push(record.public_url);
        }
      }

      setSelectedUrls((prev) => {
        const merged = [...prev];
        for (const u of uploadedUrls) {
          if (!merged.includes(u)) merged.push(u);
        }
        return merged.slice(0, 10);
      });

      setUploadedDirectlyCount((prev) => prev + uploadedUrls.length);
      const firstUploaded = uploadedUrls[0];
      if (firstUploaded && !targetUrl) {
        setTargetUrl(firstUploaded);
      }
      triggerHaptic("success");
    } catch (err: any) {
      console.error("Direct upload failed:", err);
      alert("Image upload failed: " + (err.message || "Unknown error"));
      triggerHaptic("heavy");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Move image left in grid
  function handleMoveLeft(index: number) {
    if (index <= 0) return;
    triggerHaptic("selection");
    setSelectedUrls((prev) => {
      const copy = [...prev];
      const prevImg = copy[index - 1];
      const currImg = copy[index];
      if (prevImg === undefined || currImg === undefined) return prev;
      copy[index - 1] = currImg;
      copy[index] = prevImg;
      return copy;
    });
  }

  // Move image right in grid
  function handleMoveRight(index: number) {
    if (index >= selectedUrls.length - 1) return;
    triggerHaptic("selection");
    setSelectedUrls((prev) => {
      const copy = [...prev];
      const nextImg = copy[index + 1];
      const currImg = copy[index];
      if (nextImg === undefined || currImg === undefined) return prev;
      copy[index + 1] = currImg;
      copy[index] = nextImg;
      return copy;
    });
  }

  // Remove image from selected list
  function handleRemoveFromSelection(index: number) {
    triggerHaptic("selection");
    setSelectedUrls((prev) => prev.filter((_, i) => i !== index));
  }

  // Match library images by SKU
  async function computeSkuMatchMapping() {
    setIsMatchingSku(true);
    triggerHaptic("selection");

    try {
      // 1. Fetch products for their SKUs
      const { data: prods, error: pErr } = await supabase
        .from("products")
        .select("id, name, sku")
        .in("id", productIds);

      if (pErr) throw pErr;

      // 2. Fetch all catalog images
      const { data: catalogImages } = await fetchCatalogImages({ limit: 2000 });

      const mapping = new Map<string, string[]>();
      const unmatched: string[] = [];

      for (const prod of prods || []) {
        if (!prod.sku) {
          unmatched.push(prod.name);
          continue;
        }

        const targetSku = prod.sku.trim().toUpperCase();
        const matched = (catalogImages || []).filter((img) => {
          const hint = (
            img.sku_hint ||
            parseSkuFromFilename(img.original_name).sku ||
            ""
          )
            .trim()
            .toUpperCase();
          return hint === targetSku;
        });

        if (matched.length === 0) {
          unmatched.push(`${prod.name} (${prod.sku})`);
        } else {
          matched.sort((a, b) => {
            const idxA = parseImageIndex(a.original_name);
            const idxB = parseImageIndex(b.original_name);
            return idxA - idxB;
          });
          mapping.set(
            prod.id,
            matched.map((m) => m.public_url).slice(0, 10)
          );
        }
      }

      setSkuMatchMap(mapping);
      setUnmatchedProductNames(unmatched);
      triggerHaptic("success");
    } catch (err: any) {
      console.error("Failed to match images by SKU:", err);
      alert("Failed to compute SKU matches: " + (err.message || "Unknown error"));
      triggerHaptic("heavy");
    } finally {
      setIsMatchingSku(false);
    }
  }

  // Validation
  const isDestructive = mode === "clear" && !matchBySku;
  const isUrlMode = mode === "set_primary" || mode === "remove_url";
  const effectiveUrls = isUrlMode ? (targetUrl ? [targetUrl] : []) : selectedUrls;

  let isValidToPreview = false;
  let validationError: string | null = null;

  if (matchBySku) {
    isValidToPreview = true;
  } else if (mode === "clear") {
    isValidToPreview = true;
  } else if (isUrlMode) {
    isValidToPreview = effectiveUrls.length > 0;
    if (!isValidToPreview) {
      validationError = "Please select or enter the target image URL.";
    }
  } else {
    isValidToPreview = selectedUrls.length > 0;
    if (!isValidToPreview) {
      validationError = "Please pick or upload at least one image.";
    }
  }

  const showHighVolumeWarning =
    productIds.length > 100 && uploadedDirectlyCount > 0 && !matchBySku;

  return (
    <div className="space-y-6">
      {/* ── Mode Selection Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Bulk Image Actions
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Modify catalog image galleries across all {productIds.length} selected products.
          </p>
        </div>

        {/* Match by SKU Toggle */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            const next = !matchBySku;
            setMatchBySku(next);
            if (next && !skuMatchMap) {
              computeSkuMatchMapping();
            }
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer active:scale-95 border ${
            matchBySku
              ? "bg-purple-50 text-purple-800 border-purple-200 shadow-2xs font-extrabold"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${matchBySku ? "text-purple-600" : "text-slate-400"}`} />
          <span>Match images by SKU</span>
        </button>
      </div>

      {/* ── High-Volume Warning (> 100 products with direct upload) ── */}
      {showHighVolumeWarning && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold">Large product selection warning</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              You have selected {productIds.length} products and directly uploaded new images.
              Consider using the centralized Image Library for high-volume catalogs to maintain consistency.
            </p>
          </div>
        </div>
      )}

      {/* ── OPTION A: SKU MATCHING INFO ── */}
      {matchBySku ? (
        <div className="p-5 rounded-3xl bg-purple-50/60 border border-purple-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-purple-900 font-extrabold text-xs">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>SKU Hint Auto-Attachment Active</span>
            </div>

            <button
              type="button"
              disabled={isMatchingSku}
              onClick={computeSkuMatchMapping}
              className="text-[11px] font-bold text-purple-700 hover:underline cursor-pointer"
            >
              {isMatchingSku ? "Matching..." : "Re-scan library"}
            </button>
          </div>

          <p className="text-xs text-purple-800 leading-relaxed">
            Attaches library images whose filename or hint matches each product's SKU (e.g.{" "}
            <code className="px-1 py-0.5 bg-white/80 rounded font-mono text-[10px]">
              SKU-001_1.webp
            </code>
            ,{" "}
            <code className="px-1 py-0.5 bg-white/80 rounded font-mono text-[10px]">
              SKU-001_2.webp
            </code>
            ).
          </p>

          {skuMatchMap && (
            <div className="pt-2 text-xs text-slate-700 space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-emerald-700">
                  {skuMatchMap.size} product(s) matched
                </span>
                {unmatchedProductNames.length > 0 && (
                  <span className="font-bold text-rose-600">
                    &bull; {unmatchedProductNames.length} product(s) without matching images
                  </span>
                )}
              </div>

              {unmatchedProductNames.length > 0 && (
                <div className="mt-2 p-2.5 rounded-xl bg-white/80 border border-purple-100 max-h-28 overflow-y-auto custom-scrollbar text-[11px] text-slate-600">
                  <p className="font-bold text-slate-700 mb-1">Products with no matching images:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {unmatchedProductNames.slice(0, 10).map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                    {unmatchedProductNames.length > 10 && (
                      <li className="font-bold">...and {unmatchedProductNames.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── OPTION B: STANDARD ACTION MODES & IMAGE PICKER ── */
        <div className="space-y-5">
          {/* Action Mode Radio Grid */}
          <div>
            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">
              Action Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: "append" as BulkImageMode, label: "Add to end" },
                { id: "prepend" as BulkImageMode, label: "Add as primary (first)" },
                { id: "replace_all" as BulkImageMode, label: "Replace all images" },
                { id: "set_primary" as BulkImageMode, label: "Make existing primary" },
                { id: "remove_url" as BulkImageMode, label: "Remove one image URL" },
                { id: "clear" as BulkImageMode, label: "Remove all images", isDestructive: true },
              ].map((m) => {
                const isSelected = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      setMode(m.id);
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? m.isDestructive
                          ? "bg-rose-50 border-rose-300 text-rose-900 shadow-xs"
                          : "bg-white border-brand-dark shadow-xs ring-1 ring-brand-dark/20 text-brand-dark"
                        : "bg-white/70 border-slate-200 hover:bg-white text-slate-700"
                    }`}
                  >
                    <span className="text-xs font-bold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* If Mode is Clear: show destructive note */}
          {mode === "clear" ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
              <p className="font-extrabold flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Destructive bulk action: Remove all images</span>
              </p>
              <p className="text-[11px] text-rose-700">
                This will unlink and remove all photos from the {productIds.length} selected products.
                Files will NEVER be deleted from storage or the Image Library.
              </p>
            </div>
          ) : isUrlMode ? (
            /* If Mode is Set Primary or Remove URL: Target URL selector/input */
            <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                {mode === "set_primary" ? "Target Image to Make Primary" : "Target Image URL to Remove"}
              </label>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://... image URL"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-light/50"
                />

                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center space-x-1 cursor-pointer shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                  <span>Pick</span>
                </button>
              </div>

              {targetUrl && (
                <div className="flex items-center space-x-2 pt-1">
                  <img
                    src={targetUrl}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                  />
                  <span className="text-[11px] text-slate-500 font-mono truncate max-w-xs">
                    {targetUrl}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* If Mode is Append, Prepend, or Replace: Image Grid & Pick/Upload Buttons */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Target Images ({selectedUrls.length} / 10)
                </label>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      setIsPickerOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-brand-dark" />
                    <span>Image Library</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl brand-gradient hover:opacity-95 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{isUploading ? `Uploading ${uploadProgress}%` : "Upload New"}</span>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Image Grid with PRIMARY badge, arrows, and delete */}
              {selectedUrls.length === 0 ? (
                <div className="p-8 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50">
                  <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-600">No images selected</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Pick existing images from your library or upload new files to apply to selected products.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {selectedUrls.map((url, idx) => {
                    const isPrimary = idx === 0;
                    return (
                      <div
                        key={url}
                        className="group relative rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs flex flex-col"
                      >
                        {/* Thumbnail */}
                        <div className="aspect-square bg-slate-100 relative overflow-hidden">
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                          />

                          {/* PRIMARY badge */}
                          {isPrimary && (
                            <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-brand-dark text-white font-black text-[9px] uppercase tracking-wider shadow-xs">
                              Primary
                            </span>
                          )}

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveFromSelection(idx)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center transition cursor-pointer"
                            title="Remove from selection"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Reorder Arrows Bar */}
                        <div className="p-1 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveLeft(idx)}
                            className="p-1 rounded text-slate-500 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                            title="Move left"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                          <button
                            type="button"
                            disabled={idx === selectedUrls.length - 1}
                            onClick={() => handleMoveRight(idx)}
                            className="p-1 rounded text-slate-500 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                            title="Move right"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Image Library Picker Modal ── */}
      <ImagePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        multiSelect={!isUrlMode}
        onSelect={(imgs) => {
          if (isUrlMode && imgs[0]) {
            setTargetUrl(imgs[0].public_url);
          } else {
            handleSelectFromLibrary(imgs);
          }
          setIsPickerOpen(false);
        }}
      />

      {/* ── DRY RUN PREVIEW & APPLY PANEL ── */}
      <BulkPreviewPanel
        productIds={productIds}
        scopeLabel={scopeLabel}
        isDestructive={isDestructive}
        destructiveReason="Removing all images clears product galleries. Requires typing APPLY to confirm."
        isValidToPreview={isValidToPreview}
        validationError={validationError}
        onRunPreview={async () => {
          if (matchBySku) {
            // Compute SKU matches and simulate preview
            const mapping = skuMatchMap || (await (async () => {
              await computeSkuMatchMapping();
              return skuMatchMap || new Map();
            })());

            const { data: prods } = await supabase
              .from("products")
              .select("id, name, sku, images")
              .in("id", productIds);

            const previewItems = (prods || []).map((p) => {
              const matchedUrls = mapping.get(p.id) || [];
              const errors = matchedUrls.length === 0 ? ["No matching library images for SKU."] : undefined;
              return {
                product_id: p.id,
                product_name: p.name,
                sku: p.sku,
                before: { images: p.images || [] },
                after: { images: matchedUrls.length > 0 ? matchedUrls : p.images || [] },
                errors,
              };
            });

            return {
              success: true,
              dry_run: true,
              total_count: productIds.length,
              affected_count: previewItems.filter((i) => !i.errors).length,
              items: previewItems,
            };
          }

          return await bulkUpdateImages(productIds, mode, effectiveUrls, true);
        }}
        onApplyChunk={async (chunkIds) => {
          if (matchBySku && skuMatchMap) {
            // Apply per product with its matched images
            const { data: session } = await supabase.auth.getSession();
            const userId = session?.session?.user?.id || null;
            const opId = crypto.randomUUID();
            let affected = 0;
            const items: any[] = [];
            const beforeSnapshot: any[] = [];

            for (const id of chunkIds) {
              const matched = skuMatchMap.get(id);
              if (matched && matched.length > 0) {
                const { data: prod } = await supabase
                  .from("products")
                  .select("id, name, sku, images")
                  .eq("id", id)
                  .single();

                if (prod) {
                  beforeSnapshot.push({ product_id: id, images: prod.images || [] });
                  await supabase
                    .from("products")
                    .update({ images: matched, updated_at: new Date().toISOString() })
                    .eq("id", id);
                  affected++;
                  items.push({
                    product_id: id,
                    product_name: prod.name,
                    sku: prod.sku,
                    before: { images: prod.images || [] },
                    after: { images: matched },
                  });
                }
              }
            }

            if (affected > 0) {
              try {
                await supabase.from("bulk_operations").insert({
                  id: opId,
                  op_type: "images",
                  params: { mode: "sku_match" },
                  product_ids: chunkIds,
                  before_snapshot: beforeSnapshot,
                  affected_count: affected,
                  status: "applied",
                  created_by: userId,
                });
              } catch (err) {
                console.warn("Could not insert bulk_operations record:", err);
              }
            }

            return {
              success: true,
              dry_run: false,
              op_id: opId,
              total_count: chunkIds.length,
              affected_count: affected,
              items,
            };
          }

          return await bulkUpdateImages(chunkIds, mode, effectiveUrls, false);
        }}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </div>
  );
}
