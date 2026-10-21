import { useState } from "react";
import type { Category } from "@urbanrat/shared";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Check,
  AlertCircle,
  Loader2,
  Layers,
  Plus,
  Trash2,
  ImageIcon,
  Sparkles,
} from "lucide-react";
import { CategoryCascader } from "./CategoryCascader";
import {
  saveProductMetadata,
  adminSaveProductTiers,
  uploadProductImage,
} from "../../../lib/adminService";
import { supabase } from "../../../lib/supabase";
import { triggerHaptic } from "../../../utils/haptics";

interface SingleCatalogWizardProps {
  categories: Category[];
  onClose: () => void;
  onSuccess: (uploadId: string) => void;
}

export function SingleCatalogWizard({
  categories,
  onClose,
  onSuccess,
}: SingleCatalogWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Category & Front Image
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryBreadcrumb, setCategoryBreadcrumb] = useState<string>("");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [frontSavingsBadge, setFrontSavingsBadge] = useState<string | null>(null);

  // Step 2: Product & Tier Details
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [mrp, setMrp] = useState<number | "">("");
  const [stock, setStock] = useState<number>(50);
  const [minOrderQty, setMinOrderQty] = useState<number>(10);
  const [orderQtyStep, setOrderQtyStep] = useState<number>(5);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);
  const [warrantyMonths, setWarrantyMonths] = useState<number>(12);
  const [description, setDescription] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [isUrbanrat, setIsUrbanrat] = useState<boolean>(true);
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [isTrending, setIsTrending] = useState<boolean>(false);

  // Multiple gallery images
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // Volume price tiers
  const [tiers, setTiers] = useState<{ min_qty: number; unit_price: number }[]>([
    { min_qty: 10, unit_price: 100 },
  ]);

  const [specs, setSpecs] = useState<{ key: string; val: string }[]>([
    { key: "Packaging", val: "Retail Box Wholesale Pack" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle category selected from Step 1 Cascader
  function handleCategorySelected(cat: Category, fullPath: string) {
    setSelectedCategory(cat);
    setCategoryBreadcrumb(fullPath);
    if (!name) {
      setName(`Premium ${cat.name}`);
      const generatedSlug = `premium-${cat.slug}-${Date.now().toString(36).substring(4)}`;
      setSlug(generatedSlug);
      setSku(`URT-${cat.slug.substring(0, 3).toUpperCase()}-${Date.now().toString(36).substring(4).toUpperCase()}`);
    }
  }

  // Upload Front Image (Step 1)
  async function handleFrontImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFront(true);
    setError(null);
    try {
      const url = await uploadProductImage(file, (stats) => {
        if (stats.savingsPercent > 0) {
          setFrontSavingsBadge(`WebP • ${stats.formattedCompressedSize} (${stats.savingsPercent}% smaller)`);
        }
      });
      setFrontImage(url);
      triggerHaptic("success");
    } catch (err: any) {
      setError(err.message || "Failed to upload front image");
    } finally {
      setUploadingFront(false);
    }
  }

  // Upload Gallery Images (Step 2)
  async function handleGalleryImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        const url = await uploadProductImage(file);
        uploaded.push(url);
      }
      setGalleryImages((prev) => [...prev, ...uploaded]);
      triggerHaptic("success");
    } catch (err: any) {
      setError(err.message || "Failed to upload gallery images");
    } finally {
      setUploadingGallery(false);
    }
  }

  function handleAddTier() {
    triggerHaptic("selection");
    const lastTier = tiers[tiers.length - 1] || { min_qty: 10, unit_price: 100 };
    setTiers((prev) => [
      ...prev,
      { min_qty: lastTier.min_qty + 20, unit_price: Math.max(1, Math.round(lastTier.unit_price * 0.9)) },
    ]);
  }

  function handleRemoveTier(index: number) {
    triggerHaptic("selection");
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleTierChange(index: number, field: "min_qty" | "unit_price", val: number) {
    setTiers((prev) =>
      prev.map((t, idx) => (idx === index ? { ...t, [field]: val } : t))
    );
  }

  function handleAddSpec() {
    setSpecs((prev) => [...prev, { key: "", val: "" }]);
  }

  function handleRemoveSpec(index: number) {
    setSpecs((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory) {
      setError("Please select a valid category in Step 1.");
      setStep(1);
      return;
    }
    if (!name.trim()) {
      setError("Product Title is required.");
      return;
    }
    if (price === "" || Number(price) <= 0) {
      setError("Valid Wholesale Price is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const allImages = frontImage
        ? [frontImage, ...galleryImages.filter((img) => img !== frontImage)]
        : galleryImages;

      // Ensure first tier matches MOQ and base price
      const normalizedTiers = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
      normalizedTiers[0] = {
        min_qty: minOrderQty || 1,
        unit_price: Number(price),
      };

      // 1. Create Product Metadata
      const specsObj: Record<string, string> = {};
      specs.forEach((s) => {
        if (s.key.trim()) specsObj[s.key.trim()] = s.val.trim();
      });

      const newProduct = await saveProductMetadata({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        sku: sku.trim() || undefined,
        category_id: selectedCategory.id,
        price: Number(price),
        mrp: mrp ? Number(mrp) : undefined,
        stock: Number(stock) || 0,
        min_order_qty: minOrderQty || 1,
        order_qty_step: orderQtyStep || 1,
        low_stock_threshold: lowStockThreshold || 5,
        warranty_months: warrantyMonths || 0,
        description: description.trim(),
        short_description: shortDesc.trim(),
        images: allImages,
        specs: specsObj,
        is_urbanrat_brand: isUrbanrat,
        is_featured: isFeatured,
        is_trending: isTrending,
        is_active: true,
      });

      // 2. Save Volume Price Tiers
      if (normalizedTiers.length > 0) {
        await adminSaveProductTiers(newProduct.id, normalizedTiers);
      }

      // 3. Log Upload to catalog_uploads table
      const uploadId = `CAT-SNGL-${Date.now().toString(36).toUpperCase()}`;
      await supabase.from("catalog_uploads").insert({
        id: uploadId,
        upload_type: "single",
        category_id: selectedCategory.id,
        category_path: categoryBreadcrumb,
        file_name: `Single: ${newProduct.name}`,
        total_items: 1,
        passed_items: 1,
        failed_items: 0,
        status: "qc_pass",
        notes: `Successfully created product "${newProduct.name}" (SKU: ${newProduct.sku || "N/A"})`,
      });

      // 4. Log item details in catalog_upload_items
      await supabase.from("catalog_upload_items").insert({
        upload_id: uploadId,
        row_number: 1,
        title: newProduct.name,
        sku: newProduct.sku,
        status: "qc_pass",
        product_id: newProduct.id,
        payload: {
          category_id: selectedCategory.id,
          price: newProduct.price,
          stock: newProduct.stock,
          images: allImages,
        },
      });

      triggerHaptic("success");
      onSuccess(uploadId);
    } catch (err: any) {
      console.error("Single catalog upload failed:", err);
      setError(err.message || "Failed to create catalog product.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header & Stepper (Matching Screenshots 4 & 5) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={step === 2 ? () => setStep(1) : onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Add Single Catalog</h3>
            <p className="text-xs text-slate-400">
              {step === 1 ? "Step 1: Select Category & Front Image" : "Step 2: Add Product Details & Tiers"}
            </p>
          </div>
        </div>

        {/* 2-Step Pill Indicators */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${
              step === 1
                ? "bg-brand-dark text-white shadow-2xs"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white/20 text-center text-[10px] flex items-center justify-center">
              1
            </span>
            <span>Select Category</span>
          </div>

          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${
              step === 2
                ? "bg-brand-dark text-white shadow-2xs"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-black/10 text-center text-[10px] flex items-center justify-center">
              2
            </span>
            <span>Add Product Details</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2.5 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── STEP 1: CATEGORY SELECTION & FRONT IMAGE ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Cascader (Left 8 cols on desktop) */}
            <div className="lg:col-span-8">
              <CategoryCascader
                categories={categories}
                selectedCategoryId={selectedCategory?.id || null}
                onSelectCategory={handleCategorySelected}
                actionButtonLabel="Category Selected"
              />
            </div>

            {/* Front Image Uploader (Right 4 cols on desktop - matching Screenshot 5) */}
            <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-light/20 text-brand-dark flex items-center justify-center">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Front Product Image
                  </h4>
                </div>

                <p className="text-[11px] text-slate-400">
                  Please provide the primary front showcase image for this catalog product.
                </p>

                {/* Image Preview Box (Fixed 5:4 ratio standard) */}
                <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden aspect-5/4 flex items-center justify-center group">
                  {frontImage ? (
                    <>
                      <img
                        src={frontImage}
                        alt="Front Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <label className="px-3 py-1.5 rounded-xl bg-white text-slate-800 text-xs font-bold cursor-pointer shadow-md hover:bg-slate-50">
                          Replace Front Image
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFrontImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      {uploadingFront ? (
                        <div className="flex flex-col items-center space-y-2">
                          <Loader2 className="w-8 h-8 text-brand-dark animate-spin" />
                          <span className="text-xs font-semibold text-slate-600">
                            Auto-optimizing to WebP...
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-2 text-slate-400">
                          <Upload className="w-8 h-8 text-slate-300" />
                          <span className="text-xs font-medium">Front image preview</span>
                          <span className="text-[10px] text-slate-400">
                            PNG, JPG, WebP up to 10MB
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {frontSavingsBadge && (
                  <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl text-center animate-fade-in">
                    ⚡ {frontSavingsBadge}
                  </div>
                )}
              </div>

              {/* Upload CTA button */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <label className="w-full py-2.5 rounded-xl border border-slate-200 hover:border-brand-dark bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-2xs">
                  <Upload className="w-4 h-4 text-brand-dark" />
                  <span>{frontImage ? "Change Front Image" : "Add Product Images"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFrontImageUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  disabled={!selectedCategory}
                  onClick={() => {
                    triggerHaptic("selection");
                    setStep(2);
                  }}
                  className="w-full py-2.5 rounded-xl brand-gradient text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <span>Continue to Product Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: PRODUCT DETAILS & TIER PRICING ── */}
      {step === 2 && (
        <form onSubmit={handleFinalSubmit} className="space-y-6 animate-fade-in">
          {/* Active Category Header Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-brand-light/20 text-brand-dark flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Target Category
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                  {categoryBreadcrumb}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-bold text-brand-dark hover:underline self-start sm:self-auto cursor-pointer"
            >
              Change Category →
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Product Metadata */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
                General Product Information
              </h4>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Name / Title*
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Urbanrat WarpCharge 65W GaN Charger"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                />
              </div>

              {/* SKU & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Wholesale SKU
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. URT-CHG-65W"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. warpcharge-65w-gan"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                  />
                </div>
              </div>

              {/* Base Price & MRP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Base Wholesale Price (₹)*
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                      setPrice(val);
                      if (tiers.length > 0 && typeof val === "number") {
                        handleTierChange(0, "unit_price", val);
                      }
                    }}
                    placeholder="450"
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Retail MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    placeholder="999"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                  />
                </div>
              </div>

              {/* Stock, MOQ, Step */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Stock*
                  </label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(parseInt(e.target.value, 10) || 0)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Min Order Qty (MOQ)*
                  </label>
                  <input
                    type="number"
                    value={minOrderQty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 1;
                      setMinOrderQty(val);
                      handleTierChange(0, "min_qty", val);
                    }}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Order Step
                  </label>
                  <input
                    type="number"
                    value={orderQtyStep}
                    onChange={(e) => setOrderQtyStep(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                  />
                </div>
              </div>

              {/* Descriptions */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={shortDesc}
                  onChange={(e) => setShortDesc(e.target.value)}
                  placeholder="Quick 1-liner summary for listings"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Technical Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed specifications, compatibility, and wholesale packaging details"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs resize-none"
                />
              </div>

              {/* Specifications */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Product Specifications
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSpec}
                    className="text-[11px] font-bold text-brand-dark hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Spec</span>
                  </button>
                </div>
                <div className="space-y-1.5">
                  {specs.map((s, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={s.key}
                        onChange={(e) =>
                          setSpecs((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, key: e.target.value } : item))
                          )
                        }
                        placeholder="Key (e.g. Material)"
                        className="w-1/2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 shadow-2xs"
                      />
                      <input
                        type="text"
                        value={s.val}
                        onChange={(e) =>
                          setSpecs((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, val: e.target.value } : item))
                          )
                        }
                        placeholder="Value (e.g. Braided Nylon)"
                        className="w-1/2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSpec(idx)}
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Low Stock & Warranty */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(parseInt(e.target.value, 10) || 5)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Warranty (Months)
                  </label>
                  <input
                    type="number"
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 shadow-2xs"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-2 flex flex-wrap gap-4 text-xs font-bold text-slate-700">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUrbanrat}
                    onChange={(e) => setIsUrbanrat(e.target.checked)}
                    className="w-4 h-4 text-brand-dark rounded border-slate-300 focus:ring-brand-light"
                  />
                  <span>Urbanrat Brand Original</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-4 h-4 text-brand-dark rounded border-slate-300 focus:ring-brand-light"
                  />
                  <span>Featured Product</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTrending}
                    onChange={(e) => setIsTrending(e.target.checked)}
                    className="w-4 h-4 text-brand-dark rounded border-slate-300 focus:ring-brand-light"
                  />
                  <span>Trending</span>
                </label>
              </div>
            </div>

            {/* Right 5 Columns: Volume Tiers & Gallery */}
            <div className="lg:col-span-5 space-y-6">
              {/* Volume Price Tiers Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-brand-dark" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      B2B Volume Price Tiers
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTier}
                    className="px-2.5 py-1 rounded-lg bg-brand-light/10 text-brand-dark hover:bg-brand-light/20 text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Tier</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {tiers.map((tier, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">
                          Min Quantity (MOQ)
                        </span>
                        <input
                          type="number"
                          value={tier.min_qty}
                          disabled={idx === 0}
                          onChange={(e) =>
                            handleTierChange(idx, "min_qty", parseInt(e.target.value, 10) || 1)
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 disabled:bg-slate-100"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">
                          Unit Price (₹)
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={tier.unit_price}
                          onChange={(e) =>
                            handleTierChange(idx, "unit_price", parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                        />
                      </div>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(idx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer self-end mb-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Gallery Images Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4 text-brand-dark" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Additional Images ({galleryImages.length})
                    </h4>
                  </div>
                  <label className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1 cursor-pointer">
                    {uploadingGallery ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    <span>Add</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleGalleryImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {frontImage && (
                    <div className="relative rounded-xl overflow-hidden border-2 border-brand-dark aspect-square shadow-2xs group">
                      <img src={frontImage} alt="Front" className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 left-1 right-1 text-[8px] font-black uppercase bg-brand-dark text-white text-center py-0.5 rounded">
                        Front
                      </span>
                    </div>
                  )}
                  {galleryImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-xl overflow-hidden border border-slate-200 aspect-square shadow-2xs group"
                    >
                      <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setGalleryImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl brand-gradient text-white font-extrabold text-sm shadow-md hover:shadow-xl transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing Catalog Item...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Upload &amp; Publish Catalog Item</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
