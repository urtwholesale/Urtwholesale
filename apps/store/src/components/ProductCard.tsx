import { useState } from "react";
import { Link } from "react-router";
import type { Product } from "@urbanrat/shared";
import { Plus, Check, Layers } from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [isAdded, setIsAdded] = useState(false);

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

  function handleAddToCartClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Trigger success rhythmic haptic feedback
    triggerHaptic("success");

    setIsAdded(true);
    onAddToCart?.(product);

    // Keep checkmark for 1.8 seconds, then morph smoothly back to plus
    setTimeout(() => {
      setIsAdded(false);
    }, 1800);
  }

  return (
    <div className="group relative bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-6px_rgba(10,130,168,0.12)] transition-all duration-300 flex flex-col justify-between">
      {/* Top Image Container */}
      <Link
        to={`/product/${product.slug}`}
        className="block relative aspect-square w-full rounded-xl sm:rounded-2xl overflow-hidden bg-slate-50 mb-3"
      >
        <img
          src={product.images[0] || "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=500"}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
        />

        {/* Discount Badge (Top Right) */}
        {discountPercent > 0 && (
          <div
            className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm tracking-wide"
            style={{
              background: "linear-gradient(135deg, #FF6B6B 0%, #E83A59 100%)",
            }}
          >
            {discountPercent}% OFF
          </div>
        )}

        {/* Brand Tag (Top Left) */}
        {product.is_urbanrat_brand && (
          <div className="absolute top-2 left-2 inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-white/95 backdrop-blur-md text-brand-dark border border-white/60 shadow-xs">
            <img
              src="/logo.png"
              alt="Urbanrat"
              className="w-3 h-3 rounded-full object-cover"
            />
            <span>Urbanrat</span>
          </div>
        )}

        {/* Bulk Deals Badge (Bottom Left overlay) */}
        {hasBulkDeals && (
          <div className="absolute bottom-2 left-2 inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-slate-900/85 backdrop-blur-md text-brand-light border border-cyan-500/30 shadow-xs">
            <Layers className="w-2.5 h-2.5 text-brand-light" />
            <span>Bulk Deals</span>
          </div>
        )}
      </Link>

      {/* Info & Price */}
      <div className="flex flex-col flex-1 justify-between">
        <Link to={`/product/${product.slug}`} className="block group-hover:text-brand-dark transition-colors">
          <h3 className="font-semibold text-slate-800 text-xs sm:text-sm line-clamp-2 leading-snug tracking-tight min-h-8">
            {product.name}
          </h3>
        </Link>

        {/* Bottom row: Pricing & Quick Add Button */}
        <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-baseline space-x-1">
              {hasBulkDeals ? (
                <span className="text-[11px] font-bold text-slate-500">
                  From
                </span>
              ) : null}
              <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                ₹{bestPrice.toLocaleString("en-IN")}
              </span>
              {product.mrp && product.mrp > bestPrice && (
                <span className="text-[11px] sm:text-xs text-slate-400 line-through">
                  ₹{product.mrp.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="text-[10px] text-emerald-600 font-semibold tracking-wide">
                Free Shipping
              </span>
              {hasBulkDeals && (
                <span className="text-[9px] font-bold text-brand-dark bg-cyan-50 px-1.5 py-0.2 rounded">
                  {tiers.length} Tiers
                </span>
              )}
            </div>
          </div>

          {/* Morphing Add to Cart / Checkmark Button */}
          <button
            type="button"
            onClick={handleAddToCartClick}
            aria-label={isAdded ? `Added ${product.name} to cart` : `Add ${product.name} to cart`}
            className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white cursor-pointer transition-all duration-300 ${
              isAdded
                ? "scale-110 shadow-[0_4px_16px_rgba(16,185,129,0.5)] ring-2 ring-emerald-300"
                : "shadow-sm hover:shadow-md active:scale-90"
            }`}
            style={{
              background: isAdded
                ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                : "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
            }}
          >
            {isAdded ? (
              <span className="flex items-center justify-center animate-in zoom-in-75 duration-200">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-3 text-white" />
              </span>
            ) : (
              <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover:rotate-90 transition-transform duration-300" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
