import { Link } from "react-router";
import type { Product } from "@urbanrat/shared";
import { Plus } from "lucide-react";

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  // Calculate discount percentage
  const discountPercent = product.mrp
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

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
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-white/90 backdrop-blur-md text-[#0A82A8] border border-white/60 shadow-xs">
            Urbanrat
          </div>
        )}
      </Link>

      {/* Info & Price */}
      <div className="flex flex-col flex-1 justify-between">
        <Link to={`/product/${product.slug}`} className="block group-hover:text-[#0A82A8] transition-colors">
          <h3 className="font-semibold text-slate-800 text-xs sm:text-sm line-clamp-2 leading-snug tracking-tight min-h-[2rem]">
            {product.name}
          </h3>
        </Link>

        {/* Bottom row: Pricing & Quick Add Button */}
        <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                ₹{product.price.toLocaleString("en-IN")}
              </span>
              {product.mrp && product.mrp > product.price && (
                <span className="text-[11px] sm:text-xs text-slate-400 line-through">
                  ₹{product.mrp.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold tracking-wide">
              Free Shipping
            </span>
          </div>

          {/* Circular Add / Arrow Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onAddToCart?.(product);
            }}
            aria-label={`Add ${product.name} to cart`}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white shadow-sm hover:shadow-md active:scale-95 transition-all cursor-pointer group/btn"
            style={{
              background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
            }}
          >
            <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover/btn:rotate-90 transition-transform duration-300" />
          </button>
        </div>
      </div>
    </div>
  );
}
