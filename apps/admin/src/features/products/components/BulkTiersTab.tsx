import { useState, useMemo, useEffect } from "react";
import {
  Layers,
  Plus,
  Trash2,
  AlertTriangle,
  Search,
  ShieldAlert,
  ArrowDown,
  ArrowUp,
  Loader2,
} from "lucide-react";
import type {
  BulkTierMode,
  BulkTierPayload,
  BulkTierAdjustmentPayload,
  BulkTierFromBasePayload,
  BulkOpResult,
  PriceTier,
} from "@urbanrat/shared";
import { validateTiers } from "@urbanrat/shared";
import { BulkPreviewPanel } from "./BulkPreviewPanel";
import { bulkSaveTiers } from "../../../lib/adminService";
import { supabase } from "../../../lib/supabase";
import { triggerHaptic } from "../../../utils/haptics";

export interface BulkTiersTabProps {
  productIds: string[];
  scopeLabel: string;
  onSuccess: (result: { applied: number; skipped: number; opIds: string[] }) => void;
  onCancel?: () => void;
}

export function BulkTiersTab({
  productIds,
  scopeLabel,
  onSuccess,
  onCancel,
}: BulkTiersTabProps) {
  // Mode selection
  const [mode, setMode] = useState<BulkTierMode>("replace");

  // Replace Mode State
  const [replaceTiers, setReplaceTiers] = useState<
    Array<{ min_qty: number; price: number }>
  >([
    { min_qty: 10, price: 100 },
    { min_qty: 50, price: 90 },
  ]);

  // Adjust Mode State
  const [adjustDirection, setAdjustDirection] = useState<"up" | "down">("down");
  const [adjustType, setAdjustType] = useState<"pct" | "amount">("pct");
  const [adjustValue, setAdjustValue] = useState<number | "">(5);
  const [adjustRoundTo, setAdjustRoundTo] = useState<number>(0); // 0 = none, 0.5, 1

  // Set From Base Price Mode State
  const [baseTierRules, setBaseTierRules] = useState<BulkTierFromBasePayload[]>([
    { min_qty: 10, discount_pct: 5 },
    { min_qty: 50, discount_pct: 10 },
  ]);

  // Copy From Another Product Mode State
  const [searchProductQuery, setSearchProductQuery] = useState("");
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [productSearchResults, setProductSearchResults] = useState<
    Array<{
      id: string;
      name: string;
      sku?: string | null;
      price: number;
      price_tiers?: PriceTier[];
    }>
  >([]);
  const [selectedSourceProduct, setSelectedSourceProduct] = useState<{
    id: string;
    name: string;
    sku?: string | null;
    price: number;
    price_tiers?: PriceTier[];
  } | null>(null);

  // Search product debounce for copy_from
  useEffect(() => {
    if (mode !== "copy_from" || !searchProductQuery.trim()) {
      setProductSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const query = searchProductQuery.trim();
        const { data, error } = await supabase
          .from("products")
          .select("id, name, sku, price, price_tiers:product_price_tiers(*)")
          .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
          .limit(6);
        if (!error && data) {
          setProductSearchResults(data as any);
        }
      } catch (e) {
        console.warn("Product search failed:", e);
      } finally {
        setSearchingProducts(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [mode, searchProductQuery]);

  // Replace mode helpers
  function handleAddReplaceTier() {
    triggerHaptic("selection");
    setReplaceTiers((prev) => {
      const last = prev[prev.length - 1];
      const nextQty = last ? last.min_qty + 10 : 10;
      const nextPrice = last ? Math.max(1, last.price - 5) : 50;
      return [...prev, { min_qty: nextQty, price: nextPrice }];
    });
  }

  function handleUpdateReplaceTier(
    index: number,
    field: "min_qty" | "price",
    value: number
  ) {
    setReplaceTiers((prev) => {
      const copy = [...prev];
      const item = copy[index];
      if (!item) return prev;
      copy[index] = {
        min_qty: field === "min_qty" ? value : item.min_qty,
        price: field === "price" ? value : item.price,
      };
      return copy;
    });
  }

  function handleRemoveReplaceTier(index: number) {
    triggerHaptic("selection");
    setReplaceTiers((prev) => prev.filter((_, i) => i !== index));
  }

  // From-base mode helpers
  function handleAddBaseTierRule() {
    triggerHaptic("selection");
    setBaseTierRules((prev) => {
      const last = prev[prev.length - 1];
      const nextQty = last ? last.min_qty + 20 : 10;
      const nextDiscount = last ? Math.min(90, last.discount_pct + 5) : 5;
      return [...prev, { min_qty: nextQty, discount_pct: nextDiscount }];
    });
  }

  function handleUpdateBaseTierRule(
    index: number,
    field: "min_qty" | "discount_pct",
    value: number
  ) {
    setBaseTierRules((prev) => {
      const copy = [...prev];
      const item = copy[index];
      if (!item) return prev;
      copy[index] = {
        min_qty: field === "min_qty" ? value : item.min_qty,
        discount_pct: field === "discount_pct" ? value : item.discount_pct,
      };
      return copy;
    });
  }

  function handleRemoveBaseTierRule(index: number) {
    triggerHaptic("selection");
    setBaseTierRules((prev) => prev.filter((_, i) => i !== index));
  }

  // Construct payload and validation based on active mode
  const { payload, isValid, validationError, isDestructive, destructiveReason } =
    useMemo(() => {
      if (mode === "clear") {
        return {
          payload: null as BulkTierPayload,
          isValid: true,
          validationError: null,
          isDestructive: true,
          destructiveReason:
            "Clearing all wholesale price tiers will remove all volume discounts from the selected products.",
        };
      }

      if (mode === "replace") {
        if (replaceTiers.length === 0) {
          return {
            payload: [] as BulkTierPayload,
            isValid: false,
            validationError: "At least one price tier is required in Replace mode.",
            isDestructive: false,
            destructiveReason: undefined,
          };
        }
        const validation = validateTiers(replaceTiers);
        if (!validation.isValid) {
          return {
            payload: replaceTiers as BulkTierPayload,
            isValid: false,
            validationError: validation.errors[0] || "Invalid price tiers.",
            isDestructive: false,
            destructiveReason: undefined,
          };
        }
        return {
          payload: replaceTiers as BulkTierPayload,
          isValid: true,
          validationError: null,
          isDestructive: false,
          destructiveReason: undefined,
        };
      }

      if (mode === "adjust") {
        const val = typeof adjustValue === "number" ? adjustValue : 0;
        if (val <= 0) {
          return {
            payload: null as any,
            isValid: false,
            validationError: "Adjustment value must be greater than 0.",
            isDestructive: false,
            destructiveReason: undefined,
          };
        }

        const isPriceDecreaseOver30 =
          adjustDirection === "down" && adjustType === "pct" && val >= 30;

        const payload: BulkTierAdjustmentPayload = {
          type: adjustType,
          direction: adjustDirection,
          value: val,
          round_to: adjustRoundTo > 0 ? adjustRoundTo : undefined,
        };

        return {
          payload,
          isValid: true,
          validationError: null,
          isDestructive: isPriceDecreaseOver30,
          destructiveReason: isPriceDecreaseOver30
            ? `Price decrease of ${val}% exceeds 30% safety threshold.`
            : undefined,
        };
      }

      if (mode === "from_base") {
        if (baseTierRules.length === 0) {
          return {
            payload: null as any,
            isValid: false,
            validationError: "At least one discount tier rule is required.",
            isDestructive: false,
            destructiveReason: undefined,
          };
        }
        // Validate increasing min_qty and valid discount %
        for (let i = 0; i < baseTierRules.length; i++) {
          const rule = baseTierRules[i];
          if (!rule) continue;
          if (rule.min_qty <= 0) {
            return {
              payload: null as any,
              isValid: false,
              validationError: `Tier #${i + 1} quantity must be greater than 0.`,
              isDestructive: false,
              destructiveReason: undefined,
            };
          }
          if (rule.discount_pct <= 0 || rule.discount_pct >= 100) {
            return {
              payload: null as any,
              isValid: false,
              validationError: `Tier #${i + 1} discount must be between 0.1% and 99.9%.`,
              isDestructive: false,
              destructiveReason: undefined,
            };
          }
          const prevRule = baseTierRules[i - 1];
          if (i > 0 && prevRule && rule.min_qty <= prevRule.min_qty) {
            return {
              payload: null as any,
              isValid: false,
              validationError: `Tier #${i + 1} quantity must be strictly greater than tier #${i}.`,
              isDestructive: false,
              destructiveReason: undefined,
            };
          }
        }

        return {
          payload: baseTierRules as BulkTierPayload,
          isValid: true,
          validationError: null,
          isDestructive: false,
          destructiveReason: undefined,
        };
      }

      if (mode === "copy_from") {
        if (!selectedSourceProduct) {
          return {
            payload: null as any,
            isValid: false,
            validationError: "Please select a source product to copy tiers from.",
            isDestructive: false,
            destructiveReason: undefined,
          };
        }
        return {
          payload: selectedSourceProduct.id as BulkTierPayload,
          isValid: true,
          validationError: null,
          isDestructive: false,
          destructiveReason: undefined,
        };
      }

      return {
        payload: null as any,
        isValid: false,
        validationError: "Select a tier update mode.",
        isDestructive: false,
        destructiveReason: undefined,
      };
    }, [
      mode,
      replaceTiers,
      adjustDirection,
      adjustType,
      adjustValue,
      adjustRoundTo,
      baseTierRules,
      selectedSourceProduct,
    ]);

  // Dry-run preview caller
  async function handleRunPreview(): Promise<BulkOpResult> {
    return bulkSaveTiers(productIds, mode, payload, true);
  }

  // Chunk apply caller
  async function handleApplyChunk(chunkIds: string[]): Promise<BulkOpResult> {
    return bulkSaveTiers(chunkIds, mode, payload, false);
  }

  return (
    <div className="space-y-6">
      {/* ── Mode Selector Tabs ── */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
          <Layers className="w-4 h-4 text-brand-dark" />
          <span>Tier Update Mode</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            {
              id: "replace",
              label: "Replace All Tiers",
              desc: "Set exact tiers across products",
            },
            {
              id: "adjust",
              label: "Adjust Existing",
              desc: "+ / - by % or ₹ on existing tiers",
            },
            {
              id: "from_base",
              label: "Set from Base Price",
              desc: "Compute tiers via discount %",
            },
            {
              id: "copy_from",
              label: "Copy from Product",
              desc: "Mirror tiers of another product",
            },
            {
              id: "clear",
              label: "Clear All Tiers",
              desc: "Remove all wholesale deals",
              destructive: true,
            },
          ].map((tab) => {
            const isSelected = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setMode(tab.id as BulkTierMode);
                }}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? tab.destructive
                      ? "bg-rose-50 border-rose-300 ring-2 ring-rose-500/20"
                      : "bg-sky-50 border-brand-light ring-2 ring-brand-light/30"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-extrabold ${
                        isSelected
                          ? tab.destructive
                            ? "text-rose-700"
                            : "text-brand-dark"
                          : "text-slate-800"
                      }`}
                    >
                      {tab.label}
                    </span>
                    {tab.destructive && (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                    {tab.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mode Settings Panels ── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/80 border border-slate-200/80 space-y-4">
        {/* 1. REPLACE MODE */}
        {mode === "replace" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Tier Rows ({replaceTiers.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Every selected product will receive these exact tier rows. Quantities must
                  be strictly increasing and prices non-increasing.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddReplaceTier}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 transition cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-brand-dark" />
                <span>Add Tier</span>
              </button>
            </div>

            <div className="space-y-2">
              {replaceTiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="flex items-center space-x-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs"
                >
                  <span className="text-xs font-black text-slate-400 w-7">
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
                        value={tier.min_qty}
                        onChange={(e) =>
                          handleUpdateReplaceTier(
                            idx,
                            "min_qty",
                            Math.max(1, Number(e.target.value))
                          )
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
                        min="0.01"
                        step="0.01"
                        value={tier.price}
                        onChange={(e) =>
                          handleUpdateReplaceTier(
                            idx,
                            "price",
                            Number(e.target.value)
                          )
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black text-slate-900"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={replaceTiers.length <= 1}
                    onClick={() => handleRemoveReplaceTier(idx)}
                    className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 disabled:opacity-20 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. ADJUST EXISTING TIERS */}
        {mode === "adjust" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Adjust Existing Tier Prices
              </h4>
              <p className="text-[11px] text-slate-500">
                Each product keeps its own quantity breakdown, but existing wholesale unit
                prices are adjusted up or down.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Direction */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">
                  Direction
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-white rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAdjustDirection("down")}
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 transition cursor-pointer ${
                      adjustDirection === "down"
                        ? "bg-rose-50 text-rose-700 font-black shadow-2xs"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowDown className="w-3 h-3 text-rose-600" />
                    <span>Decrease</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustDirection("up")}
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 transition cursor-pointer ${
                      adjustDirection === "up"
                        ? "bg-emerald-50 text-emerald-700 font-black shadow-2xs"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowUp className="w-3 h-3 text-emerald-600" />
                    <span>Increase</span>
                  </button>
                </div>
              </div>

              {/* Type and Value */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">
                  Adjustment Value
                </label>
                <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-brand-light">
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value as any)}
                    className="px-2.5 py-2 text-xs font-bold bg-slate-100 border-r border-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="pct">% Percent</option>
                    <option value="amount">₹ Amount</option>
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    step={adjustType === "pct" ? "1" : "0.5"}
                    value={adjustValue}
                    onChange={(e) =>
                      setAdjustValue(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* Rounding */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">
                  Rounding Rule
                </label>
                <select
                  value={adjustRoundTo}
                  onChange={(e) => setAdjustRoundTo(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold focus:ring-2 focus:ring-brand-light focus:outline-none cursor-pointer"
                >
                  <option value={0}>None (exact 2 decimals)</option>
                  <option value={0.5}>Nearest ₹0.50 (e.g. 19.50)</option>
                  <option value={1}>Nearest ₹1.00 (e.g. 20.00)</option>
                </select>
              </div>
            </div>

            {adjustDirection === "down" &&
              adjustType === "pct" &&
              typeof adjustValue === "number" &&
              adjustValue >= 30 && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Price decrease of <strong>{adjustValue}%</strong> is considered
                    destructive. Confirmation with the word <code>APPLY</code> will be
                    required.
                  </span>
                </div>
              )}
          </div>
        )}

        {/* 3. SET FROM BASE PRICE */}
        {mode === "from_base" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Discount Tiers from Base Price
                </h4>
                <p className="text-[11px] text-slate-500">
                  Tier prices are automatically computed from each individual product&apos;s
                  base wholesale price (price - discount %).
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddBaseTierRule}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 transition cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-brand-dark" />
                <span>Add Tier</span>
              </button>
            </div>

            <div className="space-y-2">
              {baseTierRules.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex items-center space-x-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs"
                >
                  <span className="text-xs font-black text-slate-400 w-7">
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
                        value={rule.min_qty}
                        onChange={(e) =>
                          handleUpdateBaseTierRule(
                            idx,
                            "min_qty",
                            Math.max(1, Number(e.target.value))
                          )
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-bold text-slate-500">
                        Discount off Base Price (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0.1"
                          max="99.9"
                          step="0.5"
                          value={rule.discount_pct}
                          onChange={(e) =>
                            handleUpdateBaseTierRule(
                              idx,
                              "discount_pct",
                              Number(e.target.value)
                            )
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black text-slate-900 pr-7"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={baseTierRules.length <= 1}
                    onClick={() => handleRemoveBaseTierRule(idx)}
                    className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 disabled:opacity-20 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. COPY FROM ANOTHER PRODUCT */}
        {mode === "copy_from" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Copy Tiers from Existing Product
              </h4>
              <p className="text-[11px] text-slate-500">
                Search and choose a reference product. Its exact wholesale tiers will be
                copied to all selected products.
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchProductQuery}
                  onChange={(e) => setSearchProductQuery(e.target.value)}
                  placeholder="Search reference product by name or SKU..."
                  className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-brand-light focus:outline-none"
                />
                {searchingProducts && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark" />
                )}
              </div>

              {/* Search results dropdown */}
              {productSearchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-md divide-y divide-slate-100">
                  {productSearchResults.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        setSelectedSourceProduct(prod);
                        setProductSearchResults([]);
                        setSearchProductQuery("");
                      }}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-sky-50 transition cursor-pointer flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {prod.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          SKU: {prod.sku || "N/A"} • Base: ₹{prod.price}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                        {(prod.price_tiers || []).length} tiers
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Source Product Preview */}
              {selectedSourceProduct && (
                <div className="p-3.5 rounded-2xl bg-white border border-brand-light/50 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-brand-dark">
                        Selected Source Product
                      </span>
                      <p className="text-xs font-extrabold text-slate-900">
                        {selectedSourceProduct.name}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        SKU: {selectedSourceProduct.sku || "N/A"} • Base: ₹
                        {selectedSourceProduct.price}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSourceProduct(null)}
                      className="text-xs text-slate-400 hover:text-rose-500 font-bold"
                    >
                      Change
                    </button>
                  </div>

                  {/* Tiers preview */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 mb-1.5">
                      Source Tiers ({selectedSourceProduct.price_tiers?.length || 0}):
                    </p>
                    {selectedSourceProduct.price_tiers &&
                    selectedSourceProduct.price_tiers.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {selectedSourceProduct.price_tiers
                          .sort((a, b) => a.min_qty - b.min_qty)
                          .map((t, i) => (
                            <div
                              key={i}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px]"
                            >
                              <span className="text-slate-500 font-medium">
                                ≥ {t.min_qty} pcs:
                              </span>{" "}
                              <strong className="text-slate-900 font-black">
                                ₹{t.unit_price}
                              </strong>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                        This source product has no price tiers defined. Applying this will
                        clear tiers on target products.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. CLEAR ALL TIERS */}
        {mode === "clear" && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
            <div className="flex items-center space-x-2 text-rose-800">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <h4 className="text-xs font-black uppercase tracking-wider">
                Clear All Wholesale Price Tiers
              </h4>
            </div>
            <p className="text-xs text-rose-700">
              This will remove all wholesale volume tiers from the selected products. Products
              will only sell at their single base price.
            </p>
            <div className="text-[11px] font-bold text-rose-600 bg-white/70 p-2 rounded-xl border border-rose-200/80">
              ⚠️ Destructive operation: You will be asked to type <strong>APPLY</strong> in
              the confirmation step.
            </div>
          </div>
        )}
      </div>

      {/* ── Integrated Reusable Preview & Chunk Apply Panel ── */}
      <BulkPreviewPanel
        productIds={productIds}
        scopeLabel={scopeLabel}
        isDestructive={isDestructive}
        destructiveReason={destructiveReason}
        isValidToPreview={isValid}
        validationError={validationError}
        onRunPreview={handleRunPreview}
        onApplyChunk={handleApplyChunk}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </div>
  );
}
