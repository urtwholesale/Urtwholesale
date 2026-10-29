import { useState, useEffect } from "react";
import type { Category } from "@urbanrat/shared";
import {
  normalizeKeywords,
  POPULAR_COLOR_PRESETS,
  getColorHex,
} from "@urbanrat/shared";
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
  Copy,
  Save,
  Link2,
  Clipboard,
  X,
  Palette,
} from "lucide-react";
import { CategoryCascader } from "./CategoryCascader";
import { KeywordsInput } from "./KeywordsInput";
import {
  saveProductMetadata,
  adminSaveProductTiers,
  uploadCatalogImage,
} from "../../../lib/adminService";
import type { CatalogImage } from "../../../lib/adminService";
import { supabase } from "../../../lib/supabase";
import { triggerHaptic } from "../../../utils/haptics";
import { ImagePickerModal } from "../images/ImagePickerModal";

const DRAFT_STORAGE_KEY = "urbanrat_catalog_single_draft";

export interface SingleProductDraft {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number | "";
  mrp: number | "";
  stock: number;
  minOrderQty: number;
  orderQtyStep: number;
  lowStockThreshold: number;
  warrantyMonths: number;
  description: string;
  shortDesc: string;
  keywords: string[];
  specs: { key: string; val: string }[];
  hasColors?: boolean;
  colors?: string[];
  tiers: { min_qty: number; unit_price: number }[];
  frontImage: string | null;
  galleryImages: string[];
  isUrbanrat: boolean;
  isFeatured: boolean;
  isTrending: boolean;
}

function createDefaultProduct(cat?: Category | null, index = 1): SingleProductDraft {
  const catSlug = cat?.slug || "prod";
  const catName = cat?.name || "Product";
  const idSuffix = Date.now().toString(36).substring(4);
  return {
    id: `prod-${Date.now()}-${index}`,
    name: cat ? `Premium ${catName} Model ${index}` : "",
    slug: cat ? `premium-${catSlug}-${idSuffix}-${index}` : "",
    sku: cat ? `URT-${catSlug.substring(0, 3).toUpperCase()}-${idSuffix.toUpperCase()}-${index}` : "",
    price: "",
    mrp: "",
    stock: 50,
    minOrderQty: 10,
    orderQtyStep: 5,
    lowStockThreshold: 5,
    warrantyMonths: 12,
    description: "",
    shortDesc: "",
    keywords: [],
    specs: [{ key: "Packaging", val: "Retail Box Wholesale Pack" }],
    hasColors: false,
    colors: [],
    tiers: [{ min_qty: 10, unit_price: 100 }],
    frontImage: null,
    galleryImages: [],
    isUrbanrat: true,
    isFeatured: false,
    isTrending: false,
  };
}

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

  // Image Library & Link Paste integration state
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<"front" | "gallery">("front");
  const [showLinkInputFor, setShowLinkInputFor] = useState<"front" | "gallery" | null>(null);
  const [pastedLinkText, setPastedLinkText] = useState("");
  const [pastedLinkError, setPastedLinkError] = useState<string | null>(null);

  function handleAddPastedLink() {
    const raw = pastedLinkText.trim();
    if (!raw) {
      setPastedLinkError("Please enter or paste an image URL.");
      return;
    }
    const parts = raw.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
    const valid: string[] = [];
    for (const p of parts) {
      try {
        const u = new URL(p);
        if (u.protocol === "http:" || u.protocol === "https:") {
          valid.push(u.href);
        }
      } catch {}
    }
    if (valid.length === 0) {
      setPastedLinkError("Please enter a valid HTTP or HTTPS image URL.");
      return;
    }

    triggerHaptic("success");
    if (showLinkInputFor === "front") {
      setFrontImage(valid[0]!);
      updateCurrentProduct({ frontImage: valid[0]! });
    } else if (showLinkInputFor === "gallery") {
      updateCurrentProduct({
        galleryImages: [...currentProduct.galleryImages, ...valid],
      });
    }
    setPastedLinkText("");
    setPastedLinkError(null);
    setShowLinkInputFor(null);
  }

  async function handlePasteFromClipboardToWizard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setPastedLinkText(text.trim());
        setPastedLinkError(null);
      }
    } catch {
      setPastedLinkError("Unable to access clipboard. Please paste manually into the box.");
    }
  }

  function handleImagePickerSelect(selected: CatalogImage[]) {
    if (selected.length === 0) return;
    triggerHaptic("selection");
    if (imagePickerTarget === "front") {
      const first = selected[0];
      if (first) {
        setFrontImage(first.public_url);
        updateCurrentProduct({ frontImage: first.public_url });
      }
    } else {
      const newUrls = selected.map((s) => s.public_url);
      updateCurrentProduct({
        galleryImages: [...currentProduct.galleryImages, ...newUrls],
      });
    }
    setShowImagePicker(false);
  }

  // Step 2: Multi-product batch tabs
  const [products, setProducts] = useState<SingleProductDraft[]>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.products) && parsed.products.length > 0) {
          return parsed.products;
        }
      }
    } catch (e) {
      console.warn("Could not load draft:", e);
    }
    return [createDefaultProduct()];
  });
  const [activeProductIndex, setActiveProductIndex] = useState<number>(0);
  const [applyKeywordsToAll, setApplyKeywordsToAll] = useState<boolean>(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAutosaved, setLastAutosaved] = useState<string | null>(null);

  // Load category from saved draft if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.categoryId && categories.length > 0) {
          const match = categories.find((c) => c.id === parsed.categoryId);
          if (match && !selectedCategory) {
            setSelectedCategory(match);
            setCategoryBreadcrumb(parsed.categoryBreadcrumb || match.name);
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  }, [categories]);

  // Draft Autosave Effect
  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          categoryId: selectedCategory?.id,
          categoryBreadcrumb,
          products,
        })
      );
      setLastAutosaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (e) {
      // Ignore quota errors
    }
  }, [selectedCategory, categoryBreadcrumb, products]);

  // Ensure currentProduct is always defined
  const fallbackProduct = createDefaultProduct(selectedCategory, 1);
  const currentProduct: SingleProductDraft =
    products[activeProductIndex] ?? products[0] ?? fallbackProduct;

  const [colorInput, setColorInput] = useState("");

  function updateCurrentProduct(patch: Partial<SingleProductDraft>) {
    setProducts((prev) =>
      prev.map((p, idx) => (idx === activeProductIndex ? { ...p, ...patch } : p))
    );
  }

  function handleAddColor(colorName?: string) {
    const trimmed = (colorName || colorInput).trim();
    if (!trimmed) return;
    const current = currentProduct.colors || [];
    if (current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setColorInput("");
      return;
    }
    updateCurrentProduct({ colors: [...current, trimmed], hasColors: true });
    setColorInput("");
  }

  function handleRemoveColor(idxToRemove: number) {
    const current = currentProduct.colors || [];
    updateCurrentProduct({ colors: current.filter((_, idx) => idx !== idxToRemove) });
  }

  function handleCopyColorsToAll() {
    if (!currentProduct.colors || currentProduct.colors.length === 0) return;
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        hasColors: currentProduct.hasColors,
        colors: [...(currentProduct.colors || [])],
      }))
    );
    triggerHaptic("success");
  }

  // Handle category selected from Step 1 Cascader
  function handleCategorySelected(cat: Category, fullPath: string) {
    setSelectedCategory(cat);
    setCategoryBreadcrumb(fullPath);
    // Refresh empty fields on default product
    if (!currentProduct.name) {
      updateCurrentProduct({
        name: `Premium ${cat.name}`,
        slug: `premium-${cat.slug}-${Date.now().toString(36).substring(4)}`,
        sku: `URT-${cat.slug.substring(0, 3).toUpperCase()}-${Date.now().toString(36).substring(4).toUpperCase()}`,
      });
    }
  }

  // Upload Front Image (Step 1)
  async function handleFrontImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFront(true);
    setError(null);
    try {
      const catalogImg = await uploadCatalogImage(file);
      if (catalogImg.compressed_size_bytes && catalogImg.original_size_bytes) {
        const savedPct = Math.round(
          (1 - catalogImg.compressed_size_bytes / catalogImg.original_size_bytes) * 100
        );
        setFrontSavingsBadge(`WebP • ${savedPct}% saved`);
      }
      setFrontImage(catalogImg.public_url);
      updateCurrentProduct({ frontImage: catalogImg.public_url });
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
        const catalogImg = await uploadCatalogImage(file);
        uploaded.push(catalogImg.public_url);
      }
      updateCurrentProduct({
        galleryImages: [...currentProduct.galleryImages, ...uploaded],
      });
      triggerHaptic("success");
    } catch (err: any) {
      setError(err.message || "Failed to upload gallery images");
    } finally {
      setUploadingGallery(false);
    }
  }

  // Tier Management
  function handleAddTier() {
    triggerHaptic("selection");
    const lastTier = currentProduct.tiers[currentProduct.tiers.length - 1] || { min_qty: 10, unit_price: 100 };
    updateCurrentProduct({
      tiers: [
        ...currentProduct.tiers,
        { min_qty: lastTier.min_qty + 20, unit_price: Math.max(1, Math.round(lastTier.unit_price * 0.9)) },
      ],
    });
  }

  function handleRemoveTier(index: number) {
    triggerHaptic("selection");
    if (currentProduct.tiers.length <= 1) return;
    const remaining = currentProduct.tiers.filter((_, idx) => idx !== index);
    const updates: Partial<SingleProductDraft> = { tiers: remaining };
    if (index === 0 && remaining[0]) {
      updates.minOrderQty = remaining[0].min_qty;
    }
    updateCurrentProduct(updates);
  }

  function handleTierChange(index: number, field: "min_qty" | "unit_price", val: number) {
    const nextTiers = currentProduct.tiers.map((t, idx) => (idx === index ? { ...t, [field]: val } : t));
    const updates: Partial<SingleProductDraft> = { tiers: nextTiers };
    if (index === 0 && field === "min_qty") {
      updates.minOrderQty = Math.max(1, val || 1);
    }
    updateCurrentProduct(updates);
  }

  // Specs Management
  function handleAddSpec() {
    updateCurrentProduct({
      specs: [...currentProduct.specs, { key: "", val: "" }],
    });
  }

  function handleRemoveSpec(index: number) {
    updateCurrentProduct({
      specs: currentProduct.specs.filter((_, idx) => idx !== index),
    });
  }

  // Multi-Product Tab Controls
  function handleAddProductTab() {
    triggerHaptic("selection");
    const newIndex = products.length + 1;
    const newProduct = createDefaultProduct(selectedCategory, newIndex);
    setProducts((prev) => [...prev, newProduct]);
    setActiveProductIndex(products.length);
  }

  function handleRemoveProductTab(indexToRemove: number) {
    if (products.length <= 1) return;
    triggerHaptic("selection");
    const filtered = products.filter((_, i) => i !== indexToRemove);
    setProducts(filtered);
    if (activeProductIndex >= filtered.length) {
      setActiveProductIndex(filtered.length - 1);
    }
  }

  /**
   * Copy input details from current active product to all other products.
   * Keywords are explicitly NOT copied unless "Apply keywords to all products" is toggled on!
   */
  function handleCopyDetailsToAll() {
    if (products.length <= 1) return;
    triggerHaptic("selection");
    const src = currentProduct;

    setProducts((prev) =>
      prev.map((p, idx) => {
        if (idx === activeProductIndex) return p;
        return {
          ...p,
          price: src.price,
          mrp: src.mrp,
          stock: src.stock,
          minOrderQty: src.minOrderQty,
          orderQtyStep: src.orderQtyStep,
          lowStockThreshold: src.lowStockThreshold,
          warrantyMonths: src.warrantyMonths,
          description: src.description,
          shortDesc: src.shortDesc,
          specs: JSON.parse(JSON.stringify(src.specs)),
          hasColors: src.hasColors,
          colors: src.colors ? [...src.colors] : [],
          tiers: JSON.parse(JSON.stringify(src.tiers)),
          isUrbanrat: src.isUrbanrat,
          isFeatured: src.isFeatured,
          isTrending: src.isTrending,
          // Only copy keywords if the toggle is explicitly enabled
          keywords: applyKeywordsToAll ? [...src.keywords] : p.keywords,
        };
      })
    );
  }

  function handleClearDraft() {
    if (window.confirm("Clear all draft details and start over?")) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setProducts([createDefaultProduct()]);
      setActiveProductIndex(0);
      setSelectedCategory(null);
      setCategoryBreadcrumb("");
      setFrontImage(null);
      setStep(1);
      triggerHaptic("selection");
    }
  }

  // Final Form Submission
  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory) {
      setError("Please select a valid category in Step 1.");
      setStep(1);
      return;
    }

    // Validate all products in batch
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p) continue;
      if (!p.name.trim()) {
        setError(`Product #${i + 1} Title is required.`);
        setActiveProductIndex(i);
        return;
      }
      if (p.price === "" || Number(p.price) <= 0) {
        setError(`Product #${i + 1} Wholesale Price is required.`);
        setActiveProductIndex(i);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const uploadId = `CAT-SNGL-${Date.now().toString(36).toUpperCase()}`;
      const normalizationNotes: string[] = [];
      const createdProducts: any[] = [];

      for (let i = 0; i < products.length; i++) {
        const prod = products[i];
        if (!prod) continue;
        const allImages = prod.frontImage || frontImage
          ? [prod.frontImage || frontImage!, ...prod.galleryImages.filter((img) => img !== (prod.frontImage || frontImage))]
          : prod.galleryImages;

        // Ensure first tier matches MOQ and base price
        const normalizedTiers = [...prod.tiers].sort((a, b) => a.min_qty - b.min_qty);
        normalizedTiers[0] = {
          min_qty: prod.minOrderQty || 1,
          unit_price: Number(prod.price),
        };

        const specsObj: Record<string, any> = {};
        prod.specs.forEach((s) => {
          if (s.key.trim() && s.key.trim() !== "colors" && s.key.trim() !== "has_colors") {
            specsObj[s.key.trim()] = s.val.trim();
          }
        });
        specsObj.has_colors = !!prod.hasColors;
        specsObj.colors = prod.hasColors ? (prod.colors || []) : [];

        // Normalize keywords and track deduplication/trimming
        const rawKwCount = prod.keywords.length;
        const normalizedKeywords = normalizeKeywords(prod.keywords);
        if (normalizedKeywords.length < rawKwCount) {
          normalizationNotes.push(`Product #${i + 1}: ${rawKwCount - normalizedKeywords.length} duplicate keywords removed`);
        }

        // 1. Create Product Metadata
        const newProduct = await saveProductMetadata({
          name: prod.name.trim(),
          slug: prod.slug.trim().toLowerCase(),
          sku: prod.sku.trim() || undefined,
          category_id: selectedCategory.id,
          price: Number(prod.price),
          mrp: prod.mrp ? Number(prod.mrp) : undefined,
          stock: Number(prod.stock) || 0,
          min_order_qty: prod.minOrderQty || 1,
          order_qty_step: prod.orderQtyStep || 1,
          low_stock_threshold: prod.lowStockThreshold || 5,
          warranty_months: prod.warrantyMonths || 0,
          description: prod.description.trim(),
          short_description: prod.shortDesc.trim(),
          keywords: normalizedKeywords,
          images: allImages,
          attributes: {
            has_colors: !!prod.hasColors,
            colors: prod.hasColors ? (prod.colors || []) : [],
          },
          specs: specsObj,
          is_urbanrat_brand: prod.isUrbanrat,
          is_featured: prod.isFeatured,
          is_trending: prod.isTrending,
          is_active: true,
        });

        // 2. Save Volume Price Tiers
        if (normalizedTiers.length > 0) {
          await adminSaveProductTiers(newProduct.id, normalizedTiers);
        }

        // 3. Log item in catalog_upload_items
        await supabase.from("catalog_upload_items").insert({
          upload_id: uploadId,
          row_number: i + 1,
          title: newProduct.name,
          sku: newProduct.sku,
          status: "qc_pass",
          product_id: newProduct.id,
          payload: {
            category_id: selectedCategory.id,
            price: newProduct.price,
            stock: newProduct.stock,
            images: allImages,
            keywords: normalizedKeywords,
          },
        });

        createdProducts.push(newProduct);
      }

      // Log overall upload record
      const summaryNotes = `Successfully onboarded ${createdProducts.length} product(s). ${
        normalizationNotes.length > 0 ? normalizationNotes.join("; ") : "All keywords normalized."
      }`;

      await supabase.from("catalog_uploads").insert({
        id: uploadId,
        upload_type: "single",
        category_id: selectedCategory.id,
        category_path: categoryBreadcrumb,
        file_name: `Single Wizard: ${createdProducts[0]?.name || "Catalog Batch"}`,
        total_items: createdProducts.length,
        passed_items: createdProducts.length,
        failed_items: 0,
        status: "qc_pass",
        notes: summaryNotes,
      });

      // Clear draft on successful upload
      localStorage.removeItem(DRAFT_STORAGE_KEY);

      triggerHaptic("success");
      onSuccess(uploadId);
    } catch (err: any) {
      console.error("Single catalog upload failed:", err);
      setError(err.message || "Failed to create catalog products.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header & Stepper ── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Single Catalog Upload Wizard
              </h2>
              {lastAutosaved && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <Save className="w-2.5 h-2.5 text-emerald-500" />
                  <span>Draft saved {lastAutosaved}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Step {step} of 2 • {step === 1 ? "Select Category & Front Image" : "Product Details & Discovery Keywords"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleClearDraft}
            className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition cursor-pointer"
          >
            Clear Draft
          </button>

          {/* Stepper Pills */}
          <div className="flex items-center space-x-2 text-xs font-bold">
            <span
              className={`px-3 py-1.5 rounded-xl transition ${
                step === 1
                  ? "brand-gradient text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              }`}
              onClick={() => setStep(1)}
            >
              1. Category &amp; Front
            </span>
            <span
              className={`px-3 py-1.5 rounded-xl transition ${
                step === 2
                  ? "brand-gradient text-white shadow-2xs"
                  : selectedCategory
                  ? "bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                  : "bg-slate-50 text-slate-300 pointer-events-none"
              }`}
              onClick={() => selectedCategory && setStep(2)}
            >
              2. Details ({products.length})
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── STEP 1: Category Selection & Front Image ── */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Left Column: Category Cascader */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-brand-dark" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-700">
                  Select Category
                </h3>
              </div>
              {selectedCategory && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  ✓ Selected: {selectedCategory.name}
                </span>
              )}
            </div>

            <CategoryCascader
              categories={categories}
              selectedCategoryId={selectedCategory?.id || null}
              onSelectCategory={handleCategorySelected}
            />
          </div>

          {/* Right Column: Front Image Card */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-700">
                  Product Front Image
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Primary photo shown in marketplace search results
                </p>
              </div>

              <div className="relative aspect-4/3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-dark transition-all flex flex-col items-center justify-center p-4 bg-slate-50/50 overflow-hidden group">
                {frontImage ? (
                  <>
                    <img
                      src={frontImage}
                      alt="Front Preview"
                      className="w-full h-full object-cover rounded-xl"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center space-x-2">
                      <label className="px-3 py-1.5 rounded-xl bg-white text-slate-900 font-bold text-xs shadow-md cursor-pointer hover:bg-slate-100">
                        Replace
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFrontImageUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          setImagePickerTarget("front");
                          setShowImagePicker(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white text-slate-900 font-bold text-xs shadow-md cursor-pointer hover:bg-slate-100"
                      >
                        From Library
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFrontImage(null);
                          setFrontSavingsBadge(null);
                          updateCurrentProduct({ frontImage: null });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md cursor-pointer hover:bg-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3 text-center">
                    <label className="flex flex-col items-center justify-center cursor-pointer space-y-2">
                      {uploadingFront ? (
                        <Loader2 className="w-8 h-8 text-brand-dark animate-spin" />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-brand-light/20 text-brand-dark flex items-center justify-center shadow-2xs">
                          <Upload className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">
                          Upload Front Image
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          JPG, PNG, WebP • Auto-compressed to WebP
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFrontImageUpload}
                        disabled={uploadingFront}
                        className="hidden"
                      />
                    </label>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          setImagePickerTarget("front");
                          setShowImagePicker(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs shadow-2xs hover:bg-slate-50 flex items-center space-x-1 cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-brand" />
                        <span>Add from Library</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          setShowLinkInputFor(showLinkInputFor === "front" ? null : "front");
                          setPastedLinkError(null);
                        }}
                        className={`px-3 py-1.5 rounded-xl border font-bold text-xs shadow-2xs flex items-center space-x-1 cursor-pointer transition ${
                          showLinkInputFor === "front"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Link2 className="w-3.5 h-3.5 text-brand" />
                        <span>Paste Link</span>
                      </button>
                    </div>

                    {showLinkInputFor === "front" && (
                      <div className="w-full max-w-md p-3 bg-white border border-slate-200 rounded-2xl space-y-2 text-left shadow-2xs animate-fade-in">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span className="flex items-center space-x-1">
                            <Link2 className="w-3 h-3 text-brand" />
                            <span>Paste Image Link</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowLinkInputFor(null);
                              setPastedLinkText("");
                              setPastedLinkError(null);
                            }}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <div className="relative flex-1">
                            <input
                              type="url"
                              value={pastedLinkText}
                              onChange={(e) => {
                                setPastedLinkText(e.target.value);
                                pastedLinkError && setPastedLinkError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddPastedLink();
                                }
                              }}
                              placeholder="https://... (image URL)"
                              className="w-full pl-2.5 pr-16 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark transition text-slate-800"
                            />
                            <button
                              type="button"
                              onClick={handlePasteFromClipboardToWizard}
                              className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center space-x-1"
                            >
                              <Clipboard className="w-2.5 h-2.5 text-slate-400" />
                              <span>Paste</span>
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddPastedLink}
                            className="px-3 py-1.5 rounded-xl brand-gradient text-white text-xs font-bold shadow-2xs hover:shadow-md cursor-pointer shrink-0"
                          >
                            Set Front
                          </button>
                        </div>
                        {pastedLinkError && (
                          <p className="text-[10px] font-semibold text-rose-500">{pastedLinkError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {frontSavingsBadge && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800 flex items-center space-x-1.5 animate-fade-in">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{frontSavingsBadge}</span>
                </div>
              )}

              <button
                type="button"
                disabled={!selectedCategory}
                onClick={() => setStep(2)}
                className="w-full py-3.5 rounded-2xl brand-gradient text-white font-extrabold text-sm shadow-md hover:shadow-xl transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <span>Continue to Product Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Product & Tier Details with Multi-Product Tabs ── */}
      {step === 2 && (
        <form onSubmit={handleFinalSubmit} className="space-y-6 animate-fade-in">
          {/* Breadcrumb banner & Multi-Product Tabs bar */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-brand-dark shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {categoryBreadcrumb}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-bold text-brand-dark hover:underline self-start sm:self-auto cursor-pointer"
              >
                Change Category →
              </button>
            </div>

            {/* Product Tabs Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
                {products.map((prod, idx) => (
                  <div
                    key={prod.id}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                      activeProductIndex === idx
                        ? "brand-gradient text-white shadow-2xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                    onClick={() => setActiveProductIndex(idx)}
                  >
                    <span>{prod.name || `Product ${idx + 1}`}</span>
                    {products.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveProductTab(idx);
                        }}
                        className="hover:opacity-75 transition ml-1 cursor-pointer"
                        title="Remove product"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddProductTab}
                  className="px-3 py-1.5 rounded-xl border border-dashed border-slate-300 hover:border-brand-dark text-slate-600 hover:text-brand-dark text-xs font-bold flex items-center space-x-1 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product</span>
                </button>
              </div>

              {/* Copy input details to all products bar */}
              {products.length > 1 && (
                <div className="flex items-center space-x-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80">
                  <label className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyKeywordsToAll}
                      onChange={(e) => setApplyKeywordsToAll(e.target.checked)}
                      className="rounded text-brand-dark focus:ring-brand-light"
                    />
                    <span>Apply keywords to all products</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleCopyDetailsToAll}
                    className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-black text-white text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer"
                    title="Copy details to all other products"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy details to all</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Product Metadata */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Product Information (#{activeProductIndex + 1})</span>
                <span className="text-[10px] font-bold text-slate-400">
                  {currentProduct.keywords.length} keywords
                </span>
              </h4>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Name / Title*
                </label>
                <input
                  type="text"
                  value={currentProduct.name}
                  onChange={(e) => updateCurrentProduct({ name: e.target.value })}
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
                    value={currentProduct.sku}
                    onChange={(e) => updateCurrentProduct({ sku: e.target.value })}
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
                    value={currentProduct.slug}
                    onChange={(e) => updateCurrentProduct({ slug: e.target.value })}
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
                    value={currentProduct.price}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                      updateCurrentProduct({ price: val });
                      if (currentProduct.tiers.length > 0 && typeof val === "number") {
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
                    value={currentProduct.mrp}
                    onChange={(e) =>
                      updateCurrentProduct({
                        mrp: e.target.value === "" ? "" : parseFloat(e.target.value),
                      })
                    }
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
                    value={currentProduct.stock}
                    onChange={(e) =>
                      updateCurrentProduct({ stock: parseInt(e.target.value, 10) || 0 })
                    }
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
                    value={currentProduct.minOrderQty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 1;
                      updateCurrentProduct({ minOrderQty: val });
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
                    value={currentProduct.orderQtyStep}
                    onChange={(e) =>
                      updateCurrentProduct({
                        orderQtyStep: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                  />
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={currentProduct.shortDesc}
                  onChange={(e) => updateCurrentProduct({ shortDesc: e.target.value })}
                  placeholder="Quick 1-liner summary for listings"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
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
                  {currentProduct.specs.map((s, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={s.key}
                        onChange={(e) =>
                          updateCurrentProduct({
                            specs: currentProduct.specs.map((item, i) =>
                              i === idx ? { ...item, key: e.target.value } : item
                            ),
                          })
                        }
                        placeholder="Key (e.g. Material)"
                        className="w-1/3 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                      />
                      <input
                        type="text"
                        value={s.val}
                        onChange={(e) =>
                          updateCurrentProduct({
                            specs: currentProduct.specs.map((item, i) =>
                              i === idx ? { ...item, val: e.target.value } : item
                            ),
                          })
                        }
                        placeholder="Value (e.g. Fireproof PC/ABS)"
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSpec(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Color Variants & Selective Options ── */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Palette className="w-4 h-4 text-brand-dark" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Color Variants &amp; Selective Options
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Enable color selection if this product has color options. Disabled products won't show color selectors.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!currentProduct.hasColors}
                      onClick={() =>
                        updateCurrentProduct({
                          hasColors: !currentProduct.hasColors,
                          colors: !currentProduct.hasColors
                            ? currentProduct.colors && currentProduct.colors.length > 0
                              ? currentProduct.colors
                              : []
                            : [],
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        currentProduct.hasColors ? "bg-slate-900" : "bg-slate-200"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          currentProduct.hasColors ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span
                      onClick={() =>
                        updateCurrentProduct({
                          hasColors: !currentProduct.hasColors,
                          colors: !currentProduct.hasColors
                            ? currentProduct.colors && currentProduct.colors.length > 0
                              ? currentProduct.colors
                              : []
                            : [],
                        })
                      }
                      className="text-xs font-bold text-slate-700 cursor-pointer select-none"
                    >
                      {currentProduct.hasColors ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

                {currentProduct.hasColors ? (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    {/* Active Colors List */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-600">
                          Active Colors ({(currentProduct.colors || []).length})
                        </span>
                        {products.length > 1 && (currentProduct.colors || []).length > 0 && (
                          <button
                            type="button"
                            onClick={handleCopyColorsToAll}
                            className="text-[10px] font-bold text-brand-dark hover:underline flex items-center space-x-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy colors to all products</span>
                          </button>
                        )}
                      </div>

                      {(currentProduct.colors || []).length === 0 ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/60 p-2.5 rounded-xl">
                          Colors enabled. Add custom colors or pick quick presets below.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(currentProduct.colors || []).map((c, idx) => {
                            const hex = getColorHex(c);
                            return (
                              <span
                                key={idx}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs text-xs font-bold text-slate-800"
                              >
                                <span
                                  className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                                  style={{ backgroundColor: hex }}
                                />
                                <span>{c}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveColor(idx)}
                                  className="ml-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                  aria-label={`Remove color ${c}`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Add Custom Color Input */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={colorInput}
                        onChange={(e) => setColorInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddColor();
                          }
                        }}
                        placeholder="Enter color name (e.g. Jet Black, Forest Emerald)..."
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddColor()}
                        disabled={!colorInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold transition disabled:opacity-40 cursor-pointer"
                      >
                        Add Color
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        Quick Presets
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {POPULAR_COLOR_PRESETS.slice(0, 10).map((preset) => {
                          const alreadyAdded = (currentProduct.colors || []).some(
                            (c) => c.toLowerCase() === preset.toLowerCase()
                          );
                          const hex = getColorHex(preset);
                          return (
                            <button
                              key={preset}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => handleAddColor(preset)}
                              className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                                alreadyAdded
                                  ? "bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-brand hover:text-brand-dark hover:bg-sky-50/50"
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                                style={{ backgroundColor: hex }}
                              />
                              <span>{preset}</span>
                              {!alreadyAdded && <Plus className="w-2.5 h-2.5 ml-0.5 text-slate-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                    <span>Color selection is disabled for this product.</span>
                  </div>
                )}
              </div>

              {/* Full Technical Description (Below Specifications) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Technical Description
                </label>
                <textarea
                  rows={3}
                  value={currentProduct.description}
                  onChange={(e) => updateCurrentProduct({ description: e.target.value })}
                  placeholder="Detailed specifications, compatibility, and wholesale packaging details"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs resize-none"
                />
              </div>

              {/* ── Search & Discovery Section with KeywordsInput ── */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <KeywordsInput
                  value={currentProduct.keywords || []}
                  onChange={(newKeywords) => updateCurrentProduct({ keywords: newKeywords })}
                  label={`Search Keywords (Product #${activeProductIndex + 1})`}
                />
              </div>
            </div>

            {/* Right 5 Columns: Volume Tiers & Additional Images */}
            <div className="lg:col-span-5 space-y-4">
              {/* Volume Price Tiers Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Volume Price Tiers
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddTier}
                    className="text-[11px] font-bold text-brand-dark hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Tier</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {currentProduct.tiers.map((tier, idx) => (
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
                          onChange={(e) =>
                            handleTierChange(idx, "min_qty", parseInt(e.target.value, 10) || 1)
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
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
                      Additional Images ({currentProduct.galleryImages.length})
                    </h4>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        setImagePickerTarget("gallery");
                        setShowImagePicker(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <ImageIcon className="w-3 h-3 text-brand" />
                      <span>Add from Library</span>
                    </button>
                    <label className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center space-x-1 cursor-pointer">
                      {uploadingGallery ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      <span>Upload</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleGalleryImageUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        setShowLinkInputFor(showLinkInputFor === "gallery" ? null : "gallery");
                        setPastedLinkError(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition ${
                        showLinkInputFor === "gallery"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      <Link2 className="w-3 h-3 text-brand" />
                      <span>Paste Link</span>
                    </button>
                  </div>
                </div>

                {showLinkInputFor === "gallery" && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-left shadow-2xs animate-fade-in mb-3">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span className="flex items-center space-x-1">
                        <Link2 className="w-3 h-3 text-brand" />
                        <span>Paste Image Links</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLinkInputFor(null);
                          setPastedLinkText("");
                          setPastedLinkError(null);
                        }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="relative flex-1">
                        <input
                          type="url"
                          value={pastedLinkText}
                          onChange={(e) => {
                            setPastedLinkText(e.target.value);
                            pastedLinkError && setPastedLinkError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddPastedLink();
                            }
                          }}
                          placeholder="https://... (single URL or comma separated)"
                          className="w-full pl-2.5 pr-16 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-dark transition text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={handlePasteFromClipboardToWizard}
                          className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center space-x-1"
                        >
                          <Clipboard className="w-2.5 h-2.5 text-slate-400" />
                          <span>Paste</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddPastedLink}
                        className="px-3 py-1.5 rounded-xl brand-gradient text-white text-xs font-bold shadow-2xs hover:shadow-md cursor-pointer shrink-0"
                      >
                        Add
                      </button>
                    </div>
                    {pastedLinkError && (
                      <p className="text-[10px] font-semibold text-rose-500">{pastedLinkError}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2">
                  {(currentProduct.frontImage || frontImage) && (
                    <div className="relative rounded-xl overflow-hidden border-2 border-brand-dark aspect-square shadow-2xs group">
                      <img
                        src={currentProduct.frontImage || frontImage!}
                        alt="Front"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 right-1 text-[8px] font-black uppercase bg-brand-dark text-white text-center py-0.5 rounded">
                        Front
                      </span>
                    </div>
                  )}
                  {currentProduct.galleryImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-xl overflow-hidden border border-slate-200 aspect-square shadow-2xs group"
                    >
                      <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentProduct({
                            galleryImages: currentProduct.galleryImages.filter((_, i) => i !== idx),
                          })
                        }
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
                    <span>Publishing Catalog ({products.length} Products)...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Upload &amp; Publish {products.length} Product{products.length > 1 ? "s" : ""}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Image Picker Modal */}
      <ImagePickerModal
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelect={handleImagePickerSelect}
        multiSelect={imagePickerTarget === "gallery"}
        title={
          imagePickerTarget === "front"
            ? "Choose Front Image from Library"
            : "Choose Gallery Images from Library"
        }
      />
    </div>
  );
}
