import { useState, useMemo } from "react";
import { Zap } from "lucide-react";
import type {
  CategoryNode,
  BulkProductPatch,
  BulkOpResult,
} from "@urbanrat/shared";
import { KeywordsInput } from "../../catalog/components/KeywordsInput";
import { BulkPreviewPanel } from "./BulkPreviewPanel";
import { bulkUpdateProducts } from "../../../lib/adminService";
import { triggerHaptic } from "../../../utils/haptics";

export interface BulkDetailsTabProps {
  productIds: string[];
  scopeLabel: string;
  categoryTree: CategoryNode[];
  onSuccess: (result: { applied: number; skipped: number; opIds: string[] }) => void;
  onCancel?: () => void;
}

type TriState = "no_change" | "on" | "off";

export function BulkDetailsTab({
  productIds,
  scopeLabel,
  categoryTree,
  onSuccess,
  onCancel,
}: BulkDetailsTabProps) {
  // Enabled checkboxes
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    category_id: false,
    brand: false,
    tagline: false,
    description: false,
    warranty_months: false,
    mrp: false,
    moq: false,
    order_step: false,
    low_stock_threshold: false,
    is_active: false,
    is_featured: false,
    is_trending: false,
    is_urbanrat_brand: false,
    keywords: false,
  });

  // Field values
  const [categoryId, setCategoryId] = useState<string>("");
  const [brand, setBrand] = useState<string>("");
  const [tagline, setTagline] = useState<string>("");
  const [descMode, setDescMode] = useState<"replace" | "append">("replace");
  const [description, setDescription] = useState<string>("");
  const [warrantyMonths, setWarrantyMonths] = useState<number>(0);
  const [mrpMode, setMrpMode] = useState<"set" | "increase_pct" | "decrease_pct" | "increase_amt" | "decrease_amt">("set");
  const [mrpValue, setMrpValue] = useState<number>(0);
  const [moq, setMoq] = useState<number>(1);
  const [orderStep, setOrderStep] = useState<number>(1);
  const [lowStock, setLowStock] = useState<number>(5);

  // Flags tri-states
  const [activeFlag, setActiveFlag] = useState<TriState>("no_change");
  const [featuredFlag, setFeaturedFlag] = useState<TriState>("no_change");
  const [trendingFlag, setTrendingFlag] = useState<TriState>("no_change");
  const [urbanratFlag, setUrbanratFlag] = useState<TriState>("no_change");

  // Keywords
  const [kwMode, setKwMode] = useState<"add" | "remove" | "replace">("add");
  const [keywords, setKeywords] = useState<string[]>([]);

  function toggleField(field: string) {
    triggerHaptic("selection");
    setEnabledFields((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  // Flatten categories for dropdown
  const flatCategories = useMemo(() => {
    const list: Array<{ id: string; name: string; fullPath: string }> = [];
    function traverse(nodes: CategoryNode[]) {
      for (const n of nodes) {
        list.push({ id: n.id, name: n.name, fullPath: n.fullPath || n.name });
        if (n.children && n.children.length > 0) {
          traverse(n.children);
        }
      }
    }
    traverse(categoryTree);
    return list;
  }, [categoryTree]);

  // Build the BulkProductPatch based on enabled fields
  const currentPatch = useMemo<BulkProductPatch>(() => {
    const patch: BulkProductPatch = {};

    if (enabledFields.category_id) {
      patch.category_id = categoryId ? categoryId : null;
    }
    if (enabledFields.brand) {
      patch.brand = brand.trim() || null;
    }
    if (enabledFields.tagline) {
      patch.tagline = tagline.trim() || null;
    }
    if (enabledFields.description) {
      patch.description = description;
    }
    if (enabledFields.warranty_months) {
      patch.warranty_months = warrantyMonths;
    }
    if (enabledFields.mrp) {
      patch.mrp = {
        mode: mrpMode,
        value: mrpValue,
      };
    }
    if (enabledFields.moq) {
      patch.moq = moq;
    }
    if (enabledFields.order_step) {
      patch.order_step = orderStep;
    }
    if (enabledFields.low_stock_threshold) {
      patch.low_stock_threshold = lowStock;
    }
    if (enabledFields.is_active && activeFlag !== "no_change") {
      patch.is_active = activeFlag === "on";
    }
    if (enabledFields.is_featured && featuredFlag !== "no_change") {
      patch.is_featured = featuredFlag === "on";
    }
    if (enabledFields.is_trending && trendingFlag !== "no_change") {
      patch.is_trending = trendingFlag === "on";
    }
    if (enabledFields.is_urbanrat_brand && urbanratFlag !== "no_change") {
      patch.is_urbanrat_brand = urbanratFlag === "on";
    }
    if (enabledFields.keywords && keywords.length > 0) {
      if (kwMode === "add") patch.keywords_add = keywords;
      if (kwMode === "remove") patch.keywords_remove = keywords;
      if (kwMode === "replace") patch.keywords_replace = keywords;
    }

    return patch;
  }, [
    enabledFields,
    categoryId,
    brand,
    tagline,
    description,
    warrantyMonths,
    mrpMode,
    mrpValue,
    moq,
    orderStep,
    lowStock,
    activeFlag,
    featuredFlag,
    trendingFlag,
    urbanratFlag,
    kwMode,
    keywords,
  ]);

  const hasAnyEnabledField = useMemo(() => {
    return Object.values(enabledFields).some(Boolean);
  }, [enabledFields]);

  // Destructive check: deactivating or dropping MRP > 30%
  const isDestructive = useMemo(() => {
    if (enabledFields.is_active && activeFlag === "off") return true;
    if (enabledFields.mrp && mrpMode === "decrease_pct" && mrpValue >= 30) return true;
    return false;
  }, [enabledFields, activeFlag, mrpMode, mrpValue]);

  const destructiveReason = useMemo(() => {
    if (enabledFields.is_active && activeFlag === "off") {
      return "Deactivating products will hide them immediately from the B2B storefront.";
    }
    if (enabledFields.mrp && mrpMode === "decrease_pct" && mrpValue >= 30) {
      return `MRP decrease of ${mrpValue}% is a major price reduction.`;
    }
    return undefined;
  }, [enabledFields, activeFlag, mrpMode, mrpValue]);

  // Run dry-run preview
  async function handleRunPreview(): Promise<BulkOpResult> {
    return await bulkUpdateProducts(productIds, currentPatch, true);
  }

  // Apply chunk
  async function handleApplyChunk(chunkIds: string[]): Promise<BulkOpResult> {
    return await bulkUpdateProducts(chunkIds, currentPatch, false);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
        <span className="text-slate-600 font-medium">
          Only fields with <span className="font-bold text-brand-dark">Apply</span> checked will be modified.
        </span>
        <button
          type="button"
          onClick={() => {
            setEnabledFields({
              category_id: false,
              brand: false,
              tagline: false,
              description: false,
              warranty_months: false,
              mrp: false,
              moq: false,
              order_step: false,
              low_stock_threshold: false,
              is_active: false,
              is_featured: false,
              is_trending: false,
              is_urbanrat_brand: false,
              keywords: false,
            });
          }}
          className="text-[11px] text-slate-500 hover:text-slate-900 font-bold underline"
        >
          Reset All Fields
        </button>
      </div>

      {/* ── Fields Grid ── */}
      <div className="space-y-3">
        {/* Category */}
        <div className={`p-3 rounded-2xl border transition ${enabledFields.category_id ? "bg-sky-50/30 border-brand-dark/30 shadow-2xs" : "bg-white border-slate-200/80"}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledFields.category_id}
                onChange={() => toggleField("category_id")}
                className="rounded text-brand-dark focus:ring-brand-light"
              />
              <span>Target Category</span>
            </label>
            <span className="text-[10px] text-slate-400">Moves products to branch</span>
          </div>
          {enabledFields.category_id && (
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
            >
              <option value="">(Leave Uncategorized)</option>
              {flatCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullPath}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Brand */}
        <div className={`p-3 rounded-2xl border transition ${enabledFields.brand ? "bg-sky-50/30 border-brand-dark/30 shadow-2xs" : "bg-white border-slate-200/80"}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledFields.brand}
                onChange={() => toggleField("brand")}
                className="rounded text-brand-dark focus:ring-brand-light"
              />
              <span>Brand Name</span>
            </label>
          </div>
          {enabledFields.brand && (
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Urbanrat, Samsung, G-TEL"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
            />
          )}
        </div>

        {/* Short Tagline */}
        <div className={`p-3 rounded-2xl border transition ${enabledFields.tagline ? "bg-sky-50/30 border-brand-dark/30 shadow-2xs" : "bg-white border-slate-200/80"}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledFields.tagline}
                onChange={() => toggleField("tagline")}
                className="rounded text-brand-dark focus:ring-brand-light"
              />
              <span>Short Tagline</span>
            </label>
          </div>
          {enabledFields.tagline && (
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Ultra clear 9H tempered glass"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
            />
          )}
        </div>

        {/* Product Description */}
        <div className={`p-3 rounded-2xl border transition ${enabledFields.description ? "bg-sky-50/30 border-brand-dark/30 shadow-2xs" : "bg-white border-slate-200/80"}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledFields.description}
                onChange={() => toggleField("description")}
                className="rounded text-brand-dark focus:ring-brand-light"
              />
              <span>Description</span>
            </label>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setDescMode("replace")}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                  descMode === "replace"
                    ? "bg-brand-light text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => setDescMode("append")}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                  descMode === "append"
                    ? "bg-brand-light text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Append
              </button>
            </div>
          </div>
          {enabledFields.description && (
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                descMode === "replace"
                  ? "Replaces entire existing description text..."
                  : "Appended to the end of existing description text..."
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-brand-light focus:outline-none"
            />
          )}
        </div>

        {/* MRP (Maximum Retail Price) */}
        <div className={`p-3 rounded-2xl border transition ${enabledFields.mrp ? "bg-sky-50/30 border-brand-dark/30 shadow-2xs" : "bg-white border-slate-200/80"}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledFields.mrp}
                onChange={() => toggleField("mrp")}
                className="rounded text-brand-dark focus:ring-brand-light"
              />
              <span>MRP (Maximum Retail Price)</span>
            </label>
          </div>
          {enabledFields.mrp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={mrpMode}
                onChange={(e) => setMrpMode(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
              >
                <option value="set">Set to Exact Amount (₹)</option>
                <option value="increase_pct">Increase by %</option>
                <option value="decrease_pct">Decrease by %</option>
                <option value="increase_amt">Increase by ₹ Amount</option>
                <option value="decrease_amt">Decrease by ₹ Amount</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={mrpValue}
                onChange={(e) => setMrpValue(Number(e.target.value))}
                placeholder="Value"
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black bg-white"
              />
            </div>
          )}
        </div>

        {/* Ordering Rules: MOQ & Order Step */}
        <div className={`p-3 rounded-2xl border transition ${(enabledFields.moq || enabledFields.order_step) ? "bg-sky-50/30 border-brand-dark/30 shadow-2xs" : "bg-white border-slate-200/80"}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={enabledFields.moq}
                  onChange={() => toggleField("moq")}
                  className="rounded text-brand-dark focus:ring-brand-light"
                />
                <span>Min Order Qty (MOQ)</span>
              </label>
              {enabledFields.moq && (
                <input
                  type="number"
                  min="1"
                  value={moq}
                  onChange={(e) => setMoq(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                />
              )}
            </div>

            <div>
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={enabledFields.order_step}
                  onChange={() => toggleField("order_step")}
                  className="rounded text-brand-dark focus:ring-brand-light"
                />
                <span>Order Step</span>
              </label>
              {enabledFields.order_step && (
                <input
                  type="number"
                  min="1"
                  value={orderStep}
                  onChange={(e) => setOrderStep(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                />
              )}
            </div>
          </div>
        </div>

        {/* Low Stock Alert & Warranty */}
        <div className={`p-3 rounded-2xl border transition ${(enabledFields.low_stock_threshold || enabledFields.warranty_months) ? "bg-sky-50/30 border-brand-dark/30 shadow-2xs" : "bg-white border-slate-200/80"}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={enabledFields.low_stock_threshold}
                  onChange={() => toggleField("low_stock_threshold")}
                  className="rounded text-brand-dark focus:ring-brand-light"
                />
                <span>Low Stock Threshold</span>
              </label>
              {enabledFields.low_stock_threshold && (
                <input
                  type="number"
                  min="0"
                  value={lowStock}
                  onChange={(e) => setLowStock(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                />
              )}
            </div>

            <div>
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={enabledFields.warranty_months}
                  onChange={() => toggleField("warranty_months")}
                  className="rounded text-brand-dark focus:ring-brand-light"
                />
                <span>Warranty (Months)</span>
              </label>
              {enabledFields.warranty_months && (
                <input
                  type="number"
                  min="0"
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                />
              )}
            </div>
          </div>
        </div>

        {/* Visibility & Badges (Tri-State) */}
        <div className="p-3 rounded-2xl border bg-white border-slate-200/80 space-y-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
            Catalog Flags &amp; Badges
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Active */}
            <div className={`p-2.5 rounded-xl border ${enabledFields.is_active ? "border-brand-dark/40 bg-sky-50/20" : "border-slate-100"}`}>
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer mb-1.5">
                <input
                  type="checkbox"
                  checked={enabledFields.is_active}
                  onChange={() => toggleField("is_active")}
                  className="rounded text-brand-dark"
                />
                <span>Active Status</span>
              </label>
              {enabledFields.is_active && (
                <div className="flex items-center space-x-1">
                  {(["on", "off"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setActiveFlag(mode)}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                        activeFlag === mode
                          ? mode === "on" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {mode === "on" ? "Active" : "Inactive"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Urbanrat Brand */}
            <div className={`p-2.5 rounded-xl border ${enabledFields.is_urbanrat_brand ? "border-brand-dark/40 bg-sky-50/20" : "border-slate-100"}`}>
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer mb-1.5">
                <input
                  type="checkbox"
                  checked={enabledFields.is_urbanrat_brand}
                  onChange={() => toggleField("is_urbanrat_brand")}
                  className="rounded text-brand-dark"
                />
                <span className="flex items-center space-x-1">
                  <Zap className="w-3 h-3 text-brand-dark" />
                  <span>Urbanrat Brand</span>
                </span>
              </label>
              {enabledFields.is_urbanrat_brand && (
                <div className="flex items-center space-x-1">
                  {(["on", "off"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setUrbanratFlag(mode)}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                        urbanratFlag === mode
                          ? "bg-brand-dark text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {mode === "on" ? "Brand Yes" : "Brand No"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Featured */}
            <div className={`p-2.5 rounded-xl border ${enabledFields.is_featured ? "border-brand-dark/40 bg-sky-50/20" : "border-slate-100"}`}>
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer mb-1.5">
                <input
                  type="checkbox"
                  checked={enabledFields.is_featured}
                  onChange={() => toggleField("is_featured")}
                  className="rounded text-brand-dark"
                />
                <span>Featured Badge</span>
              </label>
              {enabledFields.is_featured && (
                <div className="flex items-center space-x-1">
                  {(["on", "off"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFeaturedFlag(mode)}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                        featuredFlag === mode ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {mode === "on" ? "Featured" : "Not Featured"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Trending */}
            <div className={`p-2.5 rounded-xl border ${enabledFields.is_trending ? "border-brand-dark/40 bg-sky-50/20" : "border-slate-100"}`}>
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer mb-1.5">
                <input
                  type="checkbox"
                  checked={enabledFields.is_trending}
                  onChange={() => toggleField("is_trending")}
                  className="rounded text-brand-dark"
                />
                <span>Trending Badge</span>
              </label>
              {enabledFields.is_trending && (
                <div className="flex items-center space-x-1">
                  {(["on", "off"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTrendingFlag(mode)}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                        trendingFlag === mode ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {mode === "on" ? "Trending" : "Not Trending"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Keywords */}
        <div className={`p-3 rounded-2xl border transition ${enabledFields.keywords ? "bg-sky-50/30 border-brand-dark/30 shadow-2xs" : "bg-white border-slate-200/80"}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledFields.keywords}
                onChange={() => toggleField("keywords")}
                className="rounded text-brand-dark focus:ring-brand-light"
              />
              <span>Search Keywords</span>
            </label>
            {enabledFields.keywords && (
              <div className="flex items-center space-x-1">
                {(["add", "remove", "replace"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setKwMode(m)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase cursor-pointer ${
                      kwMode === m ? "bg-brand-dark text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          {enabledFields.keywords && (
            <div className="mt-2">
              <KeywordsInput
                value={keywords}
                onChange={setKeywords}
                helperText={`Mode: ${kwMode.toUpperCase()}. Max 30 keywords per product.`}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Preview and Apply Section ── */}
      <BulkPreviewPanel
        productIds={productIds}
        scopeLabel={scopeLabel}
        isDestructive={isDestructive}
        destructiveReason={destructiveReason}
        isValidToPreview={hasAnyEnabledField}
        validationError={!hasAnyEnabledField ? "Please enable and configure at least one field above." : null}
        onRunPreview={handleRunPreview}
        onApplyChunk={handleApplyChunk}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </div>
  );
}
