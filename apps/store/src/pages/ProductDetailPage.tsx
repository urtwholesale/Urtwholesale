import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { fetchProductBySlug, fetchRelatedProducts } from "../services/storeService";
import { ProductCard } from "../components/ProductCard";
import { ProductDetailSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/EmptyState";
import type { Product } from "@urbanrat/shared";
import {
  ArrowLeft,
  ShieldCheck,
  Truck,
  RotateCcw,
  Plus,
  Minus,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

interface ProductDetailPageProps {
  onAddToCart: (product: Product, quantity: number) => void;
}

export function ProductDetailPage({ onAddToCart }: ProductDetailPageProps) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToast, setAddedToast] = useState(false);

  // Swipe support for mobile gallery
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProductData() {
      if (!slug) return;
      setLoading(true);
      setActiveImageIndex(0);
      setQuantity(1);

      try {
        const prod = await fetchProductBySlug(slug);
        if (isMounted) {
          setProduct(prod);
          if (prod) {
            const related = await fetchRelatedProducts(prod.id, prod.category_id);
            if (isMounted) setRelatedProducts(related);
          }
        }
      } catch (err) {
        console.error("Failed to load product detail:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProductData();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-300">
        <div className="h-4 w-16 bg-slate-100 rounded" />
        <ProductDetailSkeleton />
      </div>
    );
  }

  if (!product) {
    return (
      <EmptyState
        title="Product not found"
        description="The product you are looking for does not exist or has been discontinued."
        actionText="Browse Marketplace"
        onAction={() => navigate("/marketplace")}
      />
    );
  }

  const images = product.images.length > 0
    ? product.images
    : ["https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80"];

  const discountPercent = product.mrp
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (touch) {
      touchStartX.current = touch.clientX;
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const diff = touchStartX.current - touch.clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swipe left -> next image
        setActiveImageIndex((prev) => (prev + 1) % images.length);
      } else {
        // Swipe right -> previous image
        setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
      }
    }
    touchStartX.current = null;
  }

  function handleAddToCart() {
    if (!product) return;
    triggerHaptic("success");
    onAddToCart(product, quantity);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2200);
  }

  function handleBuyNow() {
    if (!product) return;
    triggerHaptic("medium");
    onAddToCart(product, quantity);
    navigate("/cart");
  }

  const whatsappInquiryUrl = `https://wa.me/917000947033?text=${encodeURIComponent(
    `Hi URT Wholesale, I am interested in wholesale order: ${product.name} (SKU: ${product.sku || "N/A"}). Price: ₹${product.price}`
  )}`;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-16 -mt-4 sm:mt-0">
      {/* ── Breadcrumb / Back Navigation (Desktop only, Mobile uses TopBar back button) ── */}
      <div className="hidden sm:flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate("/");
            }
          }}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <span className="text-[11px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-100 shadow-2xs">
          SKU: {product.sku || "UR-ACCESSORY"}
        </span>
      </div>

      {/* ── Main Showcase Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 xl:gap-14 items-start">
        {/* Left: Gallery with Swipe & Thumbnails */}
        <div className="space-y-3 lg:col-span-5 xl:col-span-5">
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative aspect-square sm:rounded-3xl overflow-hidden bg-white sm:border sm:border-slate-100 sm:shadow-xs flex items-center justify-center p-0 group select-none -mx-4 sm:mx-0 border-b border-slate-100 sm:border-b-0"
          >
            <img
              src={images[activeImageIndex]}
              alt={product.name}
              className="w-full h-full object-cover object-center transition-transform duration-500"
            />

            {/* Badges */}
            {discountPercent > 0 && (
              <div
                className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-md"
                style={{
                  background: "linear-gradient(135deg, #FF6B6B 0%, #E83A59 100%)",
                }}
              >
                {discountPercent}% OFF
              </div>
            )}

            {product.is_urbanrat_brand && (
              <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/95 backdrop-blur-md text-[#0A82A8] border border-slate-200/60 shadow-xs flex items-center space-x-1">
                <Zap className="w-3 h-3 text-[#5ADBE5]" />
                <span>Urbanrat Original</span>
              </div>
            )}

            {/* Gallery Navigation Arrows (if multiple images) */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() =>
                    setActiveImageIndex(
                      (prev) => (prev - 1 + images.length) % images.length
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-700 hover:bg-white active:scale-90 transition opacity-80 group-hover:opacity-100 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() =>
                    setActiveImageIndex((prev) => (prev + 1) % images.length)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-700 hover:bg-white active:scale-90 transition opacity-80 group-hover:opacity-100 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Swipe instruction pill for mobile */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-xs text-[10px] text-white font-medium md:hidden">
                Swipe for more ({activeImageIndex + 1}/{images.length})
              </div>
            )}
          </div>

          {/* Thumbnails row */}
          {images.length > 1 && (
            <div className="flex space-x-2.5 overflow-x-auto pb-1 scrollbar-none justify-center px-4 sm:px-0">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-14 h-14 rounded-2xl overflow-hidden border-2 bg-white transition cursor-pointer shrink-0 ${
                    activeImageIndex === idx
                      ? "border-[#0A82A8] shadow-xs ring-2 ring-[#5ADBE5]/40"
                      : "border-slate-200/80 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img}
                    alt={`thumbnail-${idx}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Details & Purchase Actions */}
        <div className="space-y-5 lg:col-span-7 xl:col-span-7">
          <div>
            <div className="flex items-center gap-2 mb-2 sm:hidden">
              <span className="text-[11px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-100 shadow-2xs">
                SKU: {product.sku || "UR-ACCESSORY"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-snug">
              {product.name}
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Pricing Box */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs space-y-1.5">
            <div className="flex items-baseline space-x-2.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ₹{product.price.toLocaleString("en-IN")}
              </span>
              {product.mrp && product.mrp > product.price && (
                <span className="text-sm text-slate-400 line-through">
                  ₹{product.mrp.toLocaleString("en-IN")}
                </span>
              )}
              {discountPercent > 0 && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Save ₹{(product.mrp! - product.price).toLocaleString("en-IN")}
                </span>
              )}
            </div>

            {/* Stock Status Indicator */}
            <div className="pt-1 flex items-center space-x-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  product.stock > 20
                    ? "bg-emerald-500"
                    : product.stock > 0
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
              />
              <span className="text-xs font-bold text-slate-700">
                {product.stock > 20
                  ? `In Stock (${product.stock} units ready to ship)`
                  : product.stock > 0
                  ? `Low Stock (${product.stock} units remaining)`
                  : "Out of Stock"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Tax invoice included • Pan-India courier dispatch within 24 hours
            </p>
          </div>

          {/* Quantity Stepper */}
          <div className="flex items-center space-x-4 bg-white p-3 rounded-2xl border border-slate-100">
            <span className="text-xs font-bold text-slate-700">Order Quantity</span>
            <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 shadow-2xs">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-10 text-center font-black text-xs text-slate-800">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Subtotal: <span className="text-slate-900 font-bold">₹{(product.price * quantity).toLocaleString("en-IN")}</span>
            </span>
          </div>

          {/* Action Buttons: Add to Cart & Buy Now */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 py-3.5 px-6 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                style={{
                  background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                }}
              >
                {addedToast ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Added to Cart!</span>
                  </>
                ) : (
                  <span>Add to Cart</span>
                )}
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer"
              >
                Buy Now
              </button>
            </div>

            {/* WhatsApp Inquiry */}
            <a
              href={whatsappInquiryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center space-x-2 py-3 px-5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200/80 transition"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>Direct WhatsApp Inquiry / Bulk Quote</span>
            </a>
          </div>

          {/* Guarantees */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center text-slate-600 text-[11px]">
            <div className="bg-white p-2.5 rounded-2xl border border-slate-100">
              <Truck className="w-4 h-4 text-[#0A82A8] mx-auto mb-1" />
              <span className="font-semibold">Fast Shipping</span>
            </div>
            <div className="bg-white p-2.5 rounded-2xl border border-slate-100">
              <ShieldCheck className="w-4 h-4 text-[#0A82A8] mx-auto mb-1" />
              <span className="font-semibold">QA Tested</span>
            </div>
            <div className="bg-white p-2.5 rounded-2xl border border-slate-100">
              <RotateCcw className="w-4 h-4 text-[#0A82A8] mx-auto mb-1" />
              <span className="font-semibold">Dead on Arrival Guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Related Products Row ── */}
      {relatedProducts.length > 0 && (
        <section className="pt-8 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Related Accessories
            </h2>
            <Link
              to="/marketplace"
              className="text-xs font-bold text-[#0A82A8] hover:underline"
            >
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
            {relatedProducts.map((rel) => (
              <ProductCard
                key={rel.id}
                product={rel}
                onAddToCart={(p) => onAddToCart(p, 1)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
