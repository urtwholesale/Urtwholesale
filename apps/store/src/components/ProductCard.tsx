import React, { useState } from "react";
import { Link } from "react-router";
import type { Product } from "@urbanrat/shared";
import {
  getProductHighlightSpec,
  getProductTopBadge,
  resolveColorHex,
} from "@urbanrat/shared";
import { Plus, Check, Star } from "lucide-react";
import { triggerHaptic } from "../utils/haptics";
import { recordRecentlyViewed } from "../services/recentViews";
import { useLanguage } from "../context/LanguageContext";
import {
  translateSpecHighlight,
  translateBadgeText,
} from "../locales/categoryTranslations";

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product, quantity?: number) => void;
  onClick?: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart, onClick }: ProductCardProps) {
  const [isAdded, setIsAdded] = useState(false);
  const { isHindi, t } = useLanguage();

  // Check for bulk pricing tiers
  const tiers = product.price_tiers || [];
  const hasBulkDeals = tiers.length > 1;
  const bestPrice = hasBulkDeals
    ? Math.min(...tiers.map((t) => t.unit_price))
    : product.price;

  // Calculate discount percentage based on best price
  const discountPercent = product.mrp
    ? Math.round(((product.mrp - bestPrice) / product.mrp) * 100)
    : 0;

  const rawHighlightSpec = getProductHighlightSpec(product);
  const highlightSpec = translateSpecHighlight(rawHighlightSpec, isHindi);

  const rawTopBadge = getProductTopBadge(product, discountPercent);
  const topBadge = {
    icon: rawTopBadge.icon,
    text: translateBadgeText(rawTopBadge.text, isHindi),
  };

  // Resolved color variants for boAt-style swatches
  const colorList =
    product.colors && product.colors.length > 0
      ? product.colors
      : ["Black", "Slate"];
  const displaySwatches = colorList.slice(0, 2);
  const extraCount = Math.max(0, colorList.length - 2);

  function handleAddToCartClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    triggerHaptic("success");
    setIsAdded(true);
    const firstTierMin = tiers[0]?.min_qty;
    const addQty = Math.max(10, product.min_order_qty || firstTierMin || 10);
    onAddToCart?.(product, addQty);

    setTimeout(() => {
      setIsAdded(false);
    }, 1800);
  }

  function handleCardClick() {
    recordRecentlyViewed(product);
    onClick?.(product);
  }

  return (
    <div className="group relative bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_4px_24px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-6px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
      {/* ── Top Image Container ── */}
      <div className="relative w-full aspect-square bg-slate-50 dark:bg-slate-800/40 shrink-0 overflow-hidden">
        <Link
          to={`/product/${product.slug}`}
          onClick={handleCardClick}
          className="block w-full h-full relative"
        >
          <img
            src={
              product.images[0] ||
              "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=500"
            }
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          />
        </Link>

        {/* Apple/boAt Signature Top Left Badge Tag */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider bg-black/85 dark:bg-white/90 text-white dark:text-black backdrop-blur-md shadow-xs flex items-center space-x-1">
          <span>{topBadge.icon}</span>
          <span>{topBadge.text}</span>
        </div>

        {/* Urbanrat Original Brand Logo (Top Right) */}
        {product.is_urbanrat_brand && (
          <div
            title="Urbanrat Original Brand"
            className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-white/95 dark:bg-[#1D1D1F]/95 backdrop-blur-md border border-white/80 dark:border-white/10 shadow-xs flex items-center justify-center p-1"
          >
            <img
              src="/logo.png"
              alt="Urbanrat"
              className="w-full h-full rounded-full object-contain"
            />
          </div>
        )}
      </div>

      {/* ── Signature Feature Spec Ribbon (Flush with Image) ── */}
      <div className="w-full bg-[#FFB800] dark:bg-[#FDB913] px-2.5 py-1 sm:py-1.5 flex items-center justify-between text-slate-950 shrink-0 select-none">
        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight text-slate-950 truncate max-w-[70%]">
          {highlightSpec}
        </span>
        <div className="inline-flex items-center space-x-0.5 bg-white text-slate-950 px-1.5 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-black shadow-2xs shrink-0">
          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
          <span>{(product.rating_avg || 4.8).toFixed(1)}</span>
        </div>
      </div>

      {/* ── Product Details Section ── */}
      <div className="p-3 sm:p-3.5 flex flex-col flex-1 justify-between space-y-2">
        <Link
          to={`/product/${product.slug}`}
          onClick={handleCardClick}
          className="block group-hover:text-[#FF4500] dark:group-hover:text-[#FF6B00] transition-colors"
        >
          <h3 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm line-clamp-1 leading-snug tracking-tight">
            {product.name}
          </h3>
        </Link>

        {/* Price & boAt-style Color Swatches Row */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-baseline space-x-1 min-w-0">
            {hasBulkDeals && (
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                {t("product.from", "From")}
              </span>
            )}
            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              ₹{bestPrice.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Color Swatches Pill (●● +3) */}
          <div
            className="flex items-center shrink-0"
            title={colorList.join(", ")}
          >
            <div className="flex items-center -space-x-1">
              {displaySwatches.map((col, idx) => (
                <span
                  key={idx}
                  className="w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#1D1D1F] shadow-2xs inline-block"
                  style={{ backgroundColor: resolveColorHex(col) }}
                />
              ))}
            </div>
            {extraCount > 0 && (
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 ml-1">
                +{extraCount}
              </span>
            )}
          </div>
        </div>

        {/* Strikethrough MRP + Green Discount % */}
        <div className="flex items-baseline space-x-1.5 text-[10.5px] sm:text-[11px]">
          {product.mrp && product.mrp > bestPrice && (
            <span className="text-slate-400 dark:text-slate-500 line-through">
              ₹{product.mrp.toLocaleString("en-IN")}
            </span>
          )}
          {discountPercent > 0 && (
            <span className="font-black text-[#34C759] dark:text-[#30D158]">
              {discountPercent}% {t("product.off", "off")}
            </span>
          )}
        </div>

        {/* Wholesale MOQ & Quick Add Button Row */}
        <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-2 mt-auto">
          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-black/[0.04] dark:bg-white/[0.08] px-2 py-0.5 rounded-full border border-black/[0.05] dark:border-white/[0.08]">
            {t("product.moq", "MOQ")}: {product.min_order_qty || 10} {t("product.pcs", "pcs")}
          </span>

          <button
            type="button"
            onClick={handleAddToCartClick}
            aria-label={
              isAdded
                ? `${t("product.added", "Added")} ${product.name}`
                : `${t("product.add", "Add")} ${product.name}`
            }
            className={`relative h-7 sm:h-7.5 px-2.5 sm:px-3 rounded-full flex items-center space-x-1 text-[11px] font-black text-white cursor-pointer transition-all duration-300 shrink-0 ${
              isAdded
                ? "bg-[#34C759] dark:bg-[#30D158] shadow-[0_4px_16px_rgba(52,199,89,0.5)] ring-2 ring-emerald-300"
                : "hover:opacity-95 active:scale-95 shadow-2xs"
            }`}
            style={
              isAdded
                ? undefined
                : {
                    background: "var(--brand-gradient)",
                    boxShadow: "var(--brand-shadow)",
                  }
            }
          >
            {isAdded ? (
              <>
                <Check className="w-3 h-3 stroke-3" />
                <span>{t("product.added", "Added")}</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3 stroke-2.5" />
                <span>{t("product.add", "Add")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
