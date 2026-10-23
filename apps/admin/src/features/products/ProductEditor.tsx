import { useState, useEffect, useMemo } from "react";
import type { Product, PriceTier, Category } from "@urbanrat/shared";
import {
  saveProductMetadata,
  adminAdjustStock,
  adminSaveProductTiers,
  uploadProductImage,
  fetchCategories,
} from "../../lib/adminService";
import { KeywordsInput } from "../catalog/components/KeywordsInput";
import {
  X,
  Upload,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Plus,
  Check,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  Zap,
} from "lucide-react";

interface ProductEditorProps {
  product: Product | null; // null means New Product
  onClose: () => void;
  onSaved: () => void;
}

export function ProductEditor({ product, onClose, onSaved }: ProductEditorProps) {
  const isNew = !product;

  const [categories, setCategories] = useState<Category[]>([]);
  const [parentCategoryId, setParentCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");

  // Metadata form fields
  const [name, setName] = useState(product?.name || "");
  const [slug, setSlug] = useState(product?.slug || "");
  const [sku, setSku] = useState(product?.sku || "");
  const [categoryId, setCategoryId] = useState(product?.category_id || "");
  const [mrp, setMrp] = useState<number | string>(product?.mrp ?? "");
  const [shortDesc, setShortDesc] = useState(product?.short_description || "");
  const [desc, setDesc] = useState(product?.description || "");
  const [minOrderQty, setMinOrderQty] = useState<number>(product?.min_order_qty || 1);
  const [orderQtyStep, setOrderQtyStep] = useState<number>(product?.order_qty_step || 1);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(product?.low_stock_threshold || 5);
  const [warrantyMonths, setWarrantyMonths] = useState<number>(product?.warranty_months || 0);

  // Toggles
  const [isUrbanrat, setIsUrbanrat] = useState<boolean>(product?.is_urbanrat_brand ?? true);
  const [isFeatured, setIsFeatured] = useState<boolean>(product?.is_featured ?? false);
  const [isTrending, setIsTrending] = useState<boolean>(product?.is_trending ?? false);
  const [isActive, setIsActive] = useState<boolean>(product?.is_active ?? true);
  const [keywords, setKeywords] = useState<string[]>(product?.keywords || []);

  // Images text[] (first image is primary)
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadStats, setUploadStats] = useState<string | null>(null);

  // Initial stock for new product
  const [initialStock, setInitialStock] = useState<number>(product?.stock || 0);

  // Stock Adjustment for existing product
  const [stockChange, setStockChange] = useState<number | "">("");
  const [stockReason, setStockReason] = useState<string>("");
  const [adjustingStock, setAdjustingStock] = useState(false);
  const [stockAdjustSuccess, setStockAdjustSuccess] = useState<string | null>(null);

  // Specs jsonb key-value list
  const [specsList, setSpecsList] = useState<{ key: string; val: string }[]>(() => {
    if (product?.specs && typeof product.specs === "object") {
      return Object.entries(product.specs).map(([key, val]) => ({
        key,
        val: String(val),
      }));
    }
    return [];
  });

  // Price Tiers [{ min_qty, unit_price }]
  const [tiers, setTiers] = useState<PriceTier[]>(() => {
    if (product?.price_tiers && product.price_tiers.length > 0) {
      return [...product.price_tiers].sort((a, b) => a.min_qty - b.min_qty);
    }
    // Default tier
    return [{ min_qty: product?.min_order_qty || 1, unit_price: product?.price || 100 }];
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Level 1: Root / Primary categories (parent_id is null or missing from categories map)
  const rootCategories = useMemo(() => {
    const idSet = new Set(categories.map((c) => c.id));
    return categories
      .filter((c) => !c.parent_id || !idSet.has(c.parent_id))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
  }, [categories]);

  // Level 2: Subcategories (direct children of the selected root category)
  const level2Categories = useMemo(() => {
    if (!parentCategoryId) return [];
    return categories
      .filter((c) => c.parent_id === parentCategoryId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
  }, [parentCategoryId, categories]);

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        setCategories(cats);
        if (product?.category_id) {
          const catMap = new Map(cats.map((c) => [c.id, c]));
          const currentCat = catMap.get(product.category_id);
          if (currentCat) {
            // Build ancestor chain from leaf to root
            const chain: Category[] = [currentCat];
            let curr = currentCat;
            while (curr.parent_id && catMap.get(curr.parent_id)) {
              curr = catMap.get(curr.parent_id)!;
              chain.unshift(curr);
            }
            const l1 = chain[0]?.id || "";
            const l2 = chain[1]?.id || "";

            setParentCategoryId(l1);
            setSubcategoryId(l2);
            setCategoryId(l2 || l1);
          }
        }
      })
      .catch(console.error);
  }, [product?.category_id]);

  function handleParentCategoryChange(newParentId: string) {
    setParentCategoryId(newParentId);
    setSubcategoryId("");
    setCategoryId(newParentId);
  }

  function handleSubcategoryChange(newSubId: string) {
    setSubcategoryId(newSubId);
    setCategoryId(newSubId || parentCategoryId);
  }

  // Auto-slugify name on new product
  function handleNameChange(val: string) {
    setName(val);
    if (isNew) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setSlug(generatedSlug);
    }
  }

  // Upload image to 'product-images' bucket
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);
    try {
      const publicUrl = await uploadProductImage(file, (stats) => {
        if (stats.savingsPercent > 0) {
          setUploadStats(`⚡ Auto-compressed: ${stats.formattedOriginalSize} → ${stats.formattedCompressedSize} (${stats.savingsPercent}% smaller)!`);
          setTimeout(() => setUploadStats(null), 6000);
        }
      });
      setImages((prev) => [...prev, publicUrl]);
    } catch (err: any) {
      console.error("Image upload error:", err);
      setError(err?.message || "Failed to upload image to product-images bucket.");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleMoveImage(index: number, direction: "left" | "right") {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const copy = [...images];
    const temp = copy[index]!;
    copy[index] = copy[targetIndex]!;
    copy[targetIndex] = temp;
    setImages(copy);
  }

  function handleRemoveImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  // Stock Adjustment for Existing Product via admin_adjust_stock
  async function handleAdjustStockSubmit() {
    if (!product || !stockChange || stockChange === 0) return;
    setAdjustingStock(true);
    setError(null);
    setStockAdjustSuccess(null);

    try {
      const res = await adminAdjustStock(
        product.id,
        Number(stockChange),
        stockReason || "Manual admin adjustment"
      );
      setStockAdjustSuccess(
        `Stock updated: ${res.previous_stock} → ${res.new_stock} (${res.change > 0 ? "+" : ""}${res.change})`
      );
      setStockChange("");
      setStockReason("");
    } catch (err: any) {
      console.error("Adjust stock error:", err);
      setError(err?.message || "Failed to adjust inventory stock.");
    } finally {
      setAdjustingStock(false);
    }
  }

  // Spec management
  function handleAddSpec() {
    setSpecsList((prev) => [...prev, { key: "", val: "" }]);
  }

  function handleSpecChange(index: number, field: "key" | "val", text: string) {
    setSpecsList((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: text } : s))
    );
  }

  function handleRemoveSpec(index: number) {
    setSpecsList((prev) => prev.filter((_, i) => i !== index));
  }

  // Tier management
  function handleAddTier() {
    const lastTier = tiers[tiers.length - 1];
    const nextMin = lastTier ? lastTier.min_qty + 10 : minOrderQty;
    const nextPrice = lastTier ? Math.max(1, lastTier.unit_price - 20) : 100;
    setTiers((prev) => [...prev, { min_qty: nextMin, unit_price: nextPrice }]);
  }

  function handleTierChange(index: number, field: keyof PriceTier, value: number) {
    setTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  }

  function handleRemoveTier(index: number) {
    if (tiers.length <= 1) return; // Must have at least 1 tier
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  // Form Save
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!slug.trim()) {
      setError("Product slug is required.");
      return;
    }

    // Tiers validation
    if (tiers.length === 0) {
      setError("At least one price tier is required.");
      return;
    }

    const sortedTiers = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
    if (sortedTiers[0]!.min_qty !== minOrderQty) {
      setError(`First tier min_qty must match Minimum Order Quantity (${minOrderQty}).`);
      return;
    }

    // Check non-increasing prices
    for (let i = 1; i < sortedTiers.length; i++) {
      if (sortedTiers[i]!.unit_price > sortedTiers[i - 1]!.unit_price) {
        setError(`Tier prices must be non-increasing as quantities increase.`);
        return;
      }
    }

    if (mrp !== "" && sortedTiers[0]!.unit_price > Number(mrp)) {
      setError(`Unit price cannot exceed MRP (₹${mrp}).`);
      return;
    }

    // Convert specs list to jsonb object
    const specsObject: Record<string, string> = {};
    for (const item of specsList) {
      if (item.key.trim()) {
        specsObject[item.key.trim()] = item.val.trim();
      }
    }

    setSaving(true);

    try {
      // 1. Save product row metadata
      const savedProd = await saveProductMetadata({
        id: product?.id,
        name: name.trim(),
        slug: slug.trim(),
        sku: sku.trim() || undefined,
        category_id: categoryId || undefined,
        price: sortedTiers[0]!.unit_price,
        mrp: mrp !== "" ? Number(mrp) : undefined,
        stock: isNew ? initialStock : undefined,
        images,
        short_description: shortDesc.trim(),
        description: desc.trim(),
        keywords,
        specs: specsObject,
        warranty_months: warrantyMonths,
        min_order_qty: minOrderQty,
        order_qty_step: orderQtyStep,
        low_stock_threshold: lowStockThreshold,
        is_urbanrat_brand: isUrbanrat,
        is_featured: isFeatured,
        is_trending: isTrending,
        is_active: isActive,
      });

      // 2. Save tiers strictly via admin_save_product_tiers RPC
      await adminSaveProductTiers(savedProd.id, sortedTiers);

      onSaved();
    } catch (err: any) {
      console.error("Save product error:", err);
      setError(err?.message || "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {isNew ? "Create New Product" : `Edit Product: ${product.name}`}
            </h3>
            <p className="text-xs text-slate-400">
              Live Supabase inventory item with tiered volume pricing
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* ── 1. Basic Product Information ── */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              General Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Urbanrat 65W GaN III Dual USB-C Fast Charger"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-light focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  URL Slug <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="urbanrat-65w-gan-charger"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-brand-light focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Product SKU</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="UR-GAN-65W"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-brand-light focus:outline-none"
                />
              </div>

              {/* Category Hierarchy: Category -> Subcategory -> Product */}
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Category */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Category</label>
                  <select
                    value={parentCategoryId}
                    onChange={(e) => handleParentCategoryChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-light focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="">Select Category...</option>
                    {rootCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Subcategory */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Subcategory</span>
                    {level2Categories.length > 0 && (
                      <span className="text-[10px] text-brand-dark font-medium bg-brand-light/30 px-1.5 py-0.5 rounded-md">
                        {level2Categories.length}
                      </span>
                    )}
                  </label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => handleSubcategoryChange(e.target.value)}
                    disabled={!parentCategoryId || level2Categories.length === 0}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-brand-light focus:outline-none bg-white transition cursor-pointer ${
                      !parentCategoryId || level2Categories.length === 0
                        ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
                        : "border-slate-200 text-slate-800"
                    }`}
                  >
                    {!parentCategoryId ? (
                      <option value="">Select Category first...</option>
                    ) : level2Categories.length === 0 ? (
                      <option value="">None available</option>
                    ) : (
                      <>
                        <option value="">Select Subcategory (Optional)...</option>
                        {level2Categories.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Selected Path Breadcrumb Pill */}
              {parentCategoryId && (
                <div className="sm:col-span-2 -mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 flex-wrap">
                  <span className="font-semibold text-slate-600">Selected Path:</span>
                  <span className="text-brand-dark font-medium">
                    {rootCategories.find((c) => c.id === parentCategoryId)?.name}
                  </span>
                  {subcategoryId && (
                    <>
                      <span className="text-slate-400">›</span>
                      <span className="text-brand-dark font-medium">
                        {level2Categories.find((s) => s.id === subcategoryId)?.name}
                      </span>
                    </>
                  )}
                  {name && (
                    <>
                      <span className="text-slate-400">›</span>
                      <span className="text-slate-700 font-bold bg-white border border-slate-200/80 px-1.5 py-0.5 rounded text-[10px] shadow-2xs">
                        {name} (Product)
                      </span>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Maximum Retail Price (MRP ₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  placeholder="e.g. 1499.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-light focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Warranty (Months)
                </label>
                <input
                  type="number"
                  min="0"
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                  placeholder="e.g. 12"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-light focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">
                  Short Tagline / Subtitle
                </label>
                <input
                  type="text"
                  value={shortDesc}
                  onChange={(e) => setShortDesc(e.target.value)}
                  placeholder="e.g. Ultra-compact high-speed wholesale wall adapter"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-light focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">
                  Detailed Description
                </label>
                <textarea
                  rows={3}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Full technical wholesale product details..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-light focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* ── 2. Product Images (text[] with drag-reorder & product-images bucket) ── */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Product Images ({images.length})
                  </h4>
                  {uploadStats && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-in fade-in">
                      <Zap className="w-3 h-3 fill-current text-emerald-600" />
                      <span>{uploadStats}</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  First image is always primary. Images are auto-compressed to WebP for instant storefront loading.
                </p>
              </div>

              <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-brand-dark text-xs font-bold hover:bg-sky-100 transition cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingImage ? "Compressing & Uploading..." : "Upload & Auto-Compress"}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingImage}
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`relative rounded-2xl border p-2 bg-slate-50 flex flex-col justify-between ${
                      idx === 0 ? "border-brand-dark ring-2 ring-brand-light/40" : "border-slate-200"
                    }`}
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-white mb-2 relative">
                      <img src={img} alt={`prod-${idx}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-brand-dark text-white shadow-xs">
                          Primary
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleMoveImage(idx, "left")}
                          disabled={idx === 0}
                          className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveImage(idx, "right")}
                          disabled={idx === images.length - 1}
                          className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-rose-500 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                <ImageIcon className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                <span>No images uploaded yet. Upload images to product-images bucket.</span>
              </div>
            )}
          </div>

          {/* ── 3. Volume Price Tiers via admin_save_product_tiers ── */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Volume Price Tiers (Bulk Deals)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Saved via admin_save_product_tiers RPC. Unit prices must be non-increasing.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddTier}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Tier</span>
              </button>
            </div>

            <div className="space-y-2">
              {tiers.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <span className="text-xs font-black text-slate-400 w-8">
                    #{idx + 1}
                  </span>

                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-bold text-slate-500">
                        Minimum Quantity (pcs)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={t.min_qty}
                        onChange={(e) =>
                          handleTierChange(idx, "min_qty", Number(e.target.value))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10px] font-bold text-slate-500">
                        Wholesale Unit Price (₹/pc)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={t.unit_price}
                        onChange={(e) =>
                          handleTierChange(idx, "unit_price", Number(e.target.value))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={tiers.length <= 1}
                    onClick={() => handleRemoveTier(idx)}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 disabled:opacity-20 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── 4. Inventory Stock & Ordering Rules ── */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Inventory &amp; Ordering Rules
            </h4>

            {isNew ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={initialStock}
                    onChange={(e) => setInitialStock(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Min Order Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={minOrderQty}
                    onChange={(e) => setMinOrderQty(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Order Qty Step</label>
                  <input
                    type="number"
                    min="1"
                    value={orderQtyStep}
                    onChange={(e) => setOrderQtyStep(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500">Current Stock</span>
                    <p className="text-xl font-black text-slate-900">
                      {product.stock} units
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Audited via stock_movements
                  </span>
                </div>

                {stockAdjustSuccess && (
                  <p className="text-xs text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    {stockAdjustSuccess}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">
                      Stock Delta (+ / -)
                    </label>
                    <input
                      type="number"
                      value={stockChange}
                      onChange={(e) =>
                        setStockChange(e.target.value ? Number(e.target.value) : "")
                      }
                      placeholder="e.g. +50 or -10"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-600">
                      Adjustment Reason
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={stockReason}
                        onChange={(e) => setStockReason(e.target.value)}
                        placeholder="e.g. Warehouse batch arrival #402"
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                      <button
                        type="button"
                        disabled={adjustingStock || !stockChange}
                        onClick={handleAdjustStockSubmit}
                        className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition disabled:opacity-40 cursor-pointer"
                      >
                        {adjustingStock ? "Saving..." : "Apply"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Min Order Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={minOrderQty}
                      onChange={(e) => setMinOrderQty(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Order Qty Step</label>
                    <input
                      type="number"
                      min="1"
                      value={orderQtyStep}
                      onChange={(e) => setOrderQtyStep(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Low Stock Alert</label>
                    <input
                      type="number"
                      min="1"
                      value={lowStockThreshold}
                      onChange={(e) =>
                        setLowStockThreshold(Math.max(1, Number(e.target.value)))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── 5. Technical Specs (JSONB) ── */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Technical Specs
                </h4>
                <p className="text-[11px] text-slate-400">
                  Saved as structured jsonb on products.specs
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSpec}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Spec</span>
              </button>
            </div>

            <div className="space-y-2">
              {specsList.map((item, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={item.key}
                    onChange={(e) => handleSpecChange(idx, "key", e.target.value)}
                    placeholder="Key (e.g. Material)"
                    className="w-1/3 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    value={item.val}
                    onChange={(e) => handleSpecChange(idx, "val", e.target.value)}
                    placeholder="Value (e.g. 9H Sapphire Tempered Glass)"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSpec(idx)}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-500 flex items-center justify-center transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── 6. Search Keywords ── */}
          <div className="pt-4 border-t border-slate-100">
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
              <KeywordsInput
                value={keywords}
                onChange={setKeywords}
              />
            </div>
          </div>

          {/* ── 7. Toggles & Visibility ── */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Flags &amp; Brand Toggles
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <label className="flex items-center space-x-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUrbanrat}
                  onChange={(e) => setIsUrbanrat(e.target.checked)}
                  className="rounded text-brand-dark focus:ring-brand-light"
                />
                <span className="font-bold text-slate-800">Urbanrat Brand</span>
              </label>

              <label className="flex items-center space-x-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded text-brand-dark focus:ring-brand-light"
                />
                <span className="font-bold text-slate-800">Featured</span>
              </label>

              <label className="flex items-center space-x-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTrending}
                  onChange={(e) => setIsTrending(e.target.checked)}
                  className="rounded text-brand-dark focus:ring-brand-light"
                />
                <span className="font-bold text-slate-800">Trending</span>
              </label>

              <label className="flex items-center space-x-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-brand-dark focus:ring-brand-light"
                />
                <span className="font-bold text-slate-800">Active</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
              style={{
                background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
              }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to Live DB...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Product</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
